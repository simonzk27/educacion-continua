// Cron job: revisa las sesiones programadas y envía un recordatorio por correo
// "minutosAntes" antes de que empiecen, a colaboradores activos. Corre vía
// GitHub Actions (ver .github/workflows/alertas-cron.yml), no depende de
// Firebase Functions ni de ningún plan pago.

const admin = require('firebase-admin')

// Colombia no observa horario de verano: offset fijo UTC-5.
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000
const CATCH_UP_WINDOW_MS = 35 * 60 * 1000 // debe ser >= al intervalo del cron

const DIA_INDEX = {
  Lunes: 0,
  Martes: 1,
  Miércoles: 2,
  Jueves: 3,
  Viernes: 4,
  Sábado: 5,
  Domingo: 6,
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function isoDateFromUtcDate(date) {
  const shifted = new Date(date.getTime() - BOGOTA_OFFSET_MS)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

function addDaysIso(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

// Instante UTC (ms) correspondiente a una fecha+hora en horario de Bogotá.
function bogotaDateTimeToUtcMs(fechaIso, horaHHmm) {
  const [y, m, d] = fechaIso.split('-').map(Number)
  const [hh, mm] = horaHHmm.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) + BOGOTA_OFFSET_MS
}

// Misma lógica que frontend/src/scheduleUtils.ts (ocurrenciasEntre), portada
// a JS plano porque este script corre fuera del bundle de Vite.
function ocurrenciasEntre(h, desde, hasta) {
  if (h.modo === 'mensual') {
    return (h.fechas || []).filter((f) => f >= desde && f <= hasta).sort()
  }
  const dias = h.dias || []
  const diasSet = new Set(dias.map((d) => DIA_INDEX[d]))
  if (diasSet.size === 0) return []
  const inicio = h.vigenciaInicio && h.vigenciaInicio > desde ? h.vigenciaInicio : desde
  const fin = h.vigenciaFin && h.vigenciaFin < hasta ? h.vigenciaFin : hasta
  if (inicio > fin) return []
  const [iy, im, id] = inicio.split('-').map(Number)
  const [fy, fm, fd] = fin.split('-').map(Number)
  const cursor = new Date(Date.UTC(iy, im - 1, id))
  const finDate = new Date(Date.UTC(fy, fm - 1, fd))
  const out = []
  let guard = 0
  while (cursor <= finDate && guard < 3000) {
    const weekday = (cursor.getUTCDay() + 6) % 7
    if (diasSet.has(weekday)) {
      out.push(`${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`)
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    guard++
  }
  return out
}

function formatHora12(horaHHmm) {
  const [hStr, mStr] = horaHHmm.split(':')
  const h = Number(hStr)
  const suffix = h >= 12 ? 'p.m.' : 'a.m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${suffix}`
}

function formatFechaLarga(fechaIso) {
  const [y, m, d] = fechaIso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

async function enviarCorreo({ to, nombre, curso, fecha, hora, minutosAntes }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Falta RESEND_API_KEY')
  const from = process.env.ALERTAS_FROM_EMAIL || 'onboarding@resend.dev'

  const cuandoTexto = minutosAntes >= 60 ? `${Math.round(minutosAntes / 60)} h` : `${minutosAntes} min`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `Recordatorio: tu sesión de "${curso}" empieza en ${cuandoTexto}`,
      html: `
        <p>Hola ${nombre},</p>
        <p>Este es un recordatorio de que tenés una sesión programada:</p>
        <ul>
          <li><strong>Curso:</strong> ${curso}</li>
          <li><strong>Fecha:</strong> ${formatFechaLarga(fecha)}</li>
          <li><strong>Hora:</strong> ${formatHora12(hora)}</li>
        </ul>
        <p>Te lo recordamos con ${cuandoTexto} de anticipación.</p>
      `,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend respondió ${res.status}: ${text}`)
  }
}

async function main() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountJson) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT')
  const serviceAccount = JSON.parse(serviceAccountJson)

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  const db = admin.firestore()

  const configSnap = await db.doc('config/alertas').get()
  const config = configSnap.data()
  if (!config || !config.activo) {
    console.log('Alertas desactivadas en config/alertas. Nada que hacer.')
    return
  }
  const minutosAntes = Number(config.minutosAntes) || 30

  const now = new Date()
  const nowMs = now.getTime()
  const hoy = isoDateFromUtcDate(now)
  const manana = addDaysIso(hoy, 1)

  const [usersSnap, cursosSnap, horariosSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('cursos').get(),
    db.collection('horarios').get(),
  ])

  const usersById = {}
  usersSnap.forEach((d) => (usersById[d.id] = d.data()))
  const cursosById = {}
  cursosSnap.forEach((d) => (cursosById[d.id] = d.data()))

  let enviados = 0
  let omitidos = 0

  for (const horarioDoc of horariosSnap.docs) {
    const h = horarioDoc.data()
    if (!h.hora || !h.userId || !h.cursoId) continue

    const user = usersById[h.userId]
    if (!user || user.activo === false || !user.email) continue

    const curso = cursosById[h.cursoId]
    if (!curso) continue

    const fechasCandidatas = [...ocurrenciasEntre(h, hoy, hoy), ...ocurrenciasEntre(h, manana, manana)]

    for (const fecha of fechasCandidatas) {
      const sessionUtcMs = bogotaDateTimeToUtcMs(fecha, h.hora)
      const alertUtcMs = sessionUtcMs - minutosAntes * 60 * 1000

      if (nowMs < alertUtcMs) continue // todavía no toca avisar
      if (nowMs > sessionUtcMs) continue // la sesión ya empezó
      if (nowMs - alertUtcMs > CATCH_UP_WINDOW_MS) continue // se pasó la ventana, evita spam viejo

      const dedupeKey = `${horarioDoc.id}_${fecha}`
      const dedupeRef = db.collection('alertasEnviadas').doc(dedupeKey)
      try {
        await dedupeRef.create({
          enviadoEn: admin.firestore.FieldValue.serverTimestamp(),
          userId: h.userId,
          cursoId: h.cursoId,
          fecha,
        })
      } catch {
        omitidos++
        continue // ya se había enviado (otra corrida del cron ya lo tomó)
      }

      try {
        await enviarCorreo({
          to: user.email,
          nombre: user.nombre || 'colaborador',
          curso: curso.nombre || h.cursoId,
          fecha,
          hora: h.hora,
          minutosAntes,
        })
        enviados++
        console.log(`Enviado a ${user.email} — ${curso.nombre} ${fecha} ${h.hora}`)
      } catch (err) {
        console.error(`Error enviando a ${user.email}:`, err.message)
        await dedupeRef.delete().catch(() => {}) // permite reintento en la próxima corrida
      }
    }
  }

  console.log(`Listo. ${enviados} enviado(s), ${omitidos} ya estaban enviados.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
