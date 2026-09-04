import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Inbox,
  KeyRound,
  X,
} from 'lucide-react'
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QuerySnapshot,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type AuthError,
} from 'firebase/auth'
import { auth, db } from './firebase'
import {
  type Dia,
  type Modo,
  addDays,
  formatFechaSesion,
  formatHora,
  ocurrenciasEntre,
  todayIso,
} from './scheduleUtils'

type Curso = {
  id: string
  nombre: string
  tipo: string
  duracionValor: number
  duracionUnidad: string
}

type InscripcionInfo = {
  completado: boolean
  confirmado: boolean
}

type Horario = {
  cursoId: string
  modo: Modo
  dias: Dia[]
  fechas: string[]
  hora: string | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
}

type Avance = {
  id: string
  fecha: string
  cursoId: string
  lecciones: number
  aprendizaje: string
}

type MiPanelProps = {
  readonly nombre: string | null
  readonly userId: string
  readonly puedeCambiarPassword: boolean
  readonly onRegistrarAvance: () => void
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  const letras = partes.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return letras || '?'
}

const passwordErrorMessages: Record<string, string> = {
  'auth/wrong-password': 'Contraseña actual incorrecta.',
  'auth/invalid-credential': 'Contraseña actual incorrecta.',
  'auth/weak-password': 'La nueva contraseña debe tener al menos 8 caracteres y un número.',
  'auth/requires-recent-login': 'Sesión muy antigua. Cerrá sesión y volvé a entrar antes de cambiarla.',
}

export default function MiPanel({ nombre, userId, puedeCambiarPassword, onRegistrarAvance }: MiPanelProps) {
  const primerNombre = nombre?.split(' ')[0] ?? 'Usuario'

  const [pwActual, setPwActual] = useState('')
  const [pwNueva, setPwNueva] = useState('')
  const [pwConfirmar, setPwConfirmar] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [pwExito, setPwExito] = useState(false)

  async function handleCambiarPassword(e: FormEvent) {
    e.preventDefault()
    setPwError(null)

    if (pwNueva.length < 8 || !/\d/.test(pwNueva)) {
      setPwError('La nueva contraseña debe tener al menos 8 caracteres y un número.')
      return
    }
    if (pwNueva !== pwConfirmar) {
      setPwError('Las contraseñas no coinciden.')
      return
    }

    const firebaseUser = auth.currentUser
    if (!firebaseUser?.email) return

    setPwSubmitting(true)
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, pwActual)
      await reauthenticateWithCredential(firebaseUser, credential)
      await updatePassword(firebaseUser, pwNueva)

      try {
        await updateDoc(doc(db, 'users', userId), { puedeCambiarPassword: false })
      } catch {
        // ya cambió la contraseña; que el admin la deshabilite manualmente si esto falla
      }

      setPwExito(true)
      setPwActual('')
      setPwNueva('')
      setPwConfirmar('')
    } catch (err) {
      const code = (err as AuthError).code
      setPwError((code && passwordErrorMessages[code]) ?? 'No se pudo cambiar la contraseña. Intentá de nuevo.')
    } finally {
      setPwSubmitting(false)
    }
  }

  const [cursosPorId, setCursosPorId] = useState<Record<string, Curso>>({})
  const [cursoIds, setCursoIds] = useState<string[]>([])
  const [horariosPorCurso, setHorariosPorCurso] = useState<Record<string, Horario>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function aplicarCursos(snap: QuerySnapshot) {
      const map: Record<string, Curso> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        map[d.id] = {
          id: d.id,
          nombre: (data.nombre as string) ?? d.id,
          tipo: (data.tipo as string) ?? '',
          duracionValor: (data.duracionValor as number) ?? 0,
          duracionUnidad: (data.duracionUnidad as string) ?? '',
        }
      })
      setCursosPorId(map)
    }
    const q = collection(db, 'cursos')
    getDocs(q).then(aplicarCursos).catch(() => {})
    return onSnapshot(q, aplicarCursos)
  }, [])

  const [inscripcionesPorCurso, setInscripcionesPorCurso] = useState<Record<string, InscripcionInfo>>({})

  useEffect(() => {
    function aplicarSnapshot(snap: QuerySnapshot) {
      setCursoIds(snap.docs.map((d) => d.ref.parent.parent?.id).filter((id): id is string => !!id))
      const map: Record<string, InscripcionInfo> = {}
      snap.docs.forEach((d) => {
        const cursoId = d.ref.parent.parent?.id
        if (!cursoId) return
        const data = d.data()
        map[cursoId] = {
          completado: data.completado === true,
          confirmado: data.confirmado !== false,
        }
      })
      setInscripcionesPorCurso(map)
      setLoading(false)
    }

    const q = query(collectionGroup(db, 'inscripciones'), where('userId', '==', userId))
    getDocs(q)
      .then(aplicarSnapshot)
      .catch(() => {})
    return onSnapshot(q, aplicarSnapshot, () => setLoading(false))
  }, [userId])

  useEffect(() => {
    function aplicarHorarios(snap: QuerySnapshot) {
      const map: Record<string, Horario> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        const cursoId = data.cursoId as string | undefined
        if (!cursoId) return
        map[cursoId] = {
          cursoId,
          modo: (data.modo as Modo) ?? 'semanal',
          dias: (data.dias as Dia[]) ?? [],
          fechas: (data.fechas as string[]) ?? [],
          hora: (data.hora as string | undefined) ?? null,
          vigenciaInicio: (data.vigenciaInicio as string | undefined) ?? null,
          vigenciaFin: (data.vigenciaFin as string | undefined) ?? null,
        }
      })
      setHorariosPorCurso(map)
    }
    const q = query(collection(db, 'horarios'), where('userId', '==', userId))
    getDocs(q).then(aplicarHorarios).catch(() => {})
    return onSnapshot(q, aplicarHorarios)
  }, [userId])

  const [ultimosReportes, setUltimosReportes] = useState<Avance[]>([])

  useEffect(() => {
    const q = query(
      collection(db, 'avances'),
      where('userId', '==', userId),
      orderBy('creadoEn', 'desc'),
      limit(3),
    )
    return onSnapshot(q, (snap) => {
      setUltimosReportes(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            fecha: (data.fecha as string) ?? '',
            cursoId: (data.cursoId as string) ?? '',
            lecciones: (data.lecciones as number) ?? 0,
            aprendizaje: (data.aprendizaje as string) ?? '',
          }
        }),
      )
    })
  }, [userId])

  const cursosActuales = useMemo(() => {
    return cursoIds
      .map((cursoId) => {
        const curso = cursosPorId[cursoId]
        if (!curso) return null
        const horario = horariosPorCurso[cursoId]
        if (!horario || !horario.hora) {
          return { id: cursoId, nombre: curso.nombre, progreso: null as number | null, estado: 'Sin horario asignado' }
        }
        const completadas = ocurrenciasEntre(horario, '0001-01-01', todayIso()).length
        const total = curso.duracionValor > 0 ? curso.duracionValor : 1
        const progreso = Math.min(100, Math.round((completadas / total) * 100))
        const estado =
          completadas === 0 ? 'Asignado · Aún sin sesiones' : progreso >= 100 ? 'Completado' : 'En progreso'
        return { id: cursoId, nombre: curso.nombre, progreso, estado }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
  }, [cursoIds, cursosPorId, horariosPorCurso])

  const proximasSesiones = useMemo(() => {
    const hoy = todayIso()
    const ventana = addDays(hoy, 180)
    const ahora = new Date()
    const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`

    const candidatas = cursoIds.flatMap((cursoId) => {
      const curso = cursosPorId[cursoId]
      const horario = horariosPorCurso[cursoId]
      if (!curso || !horario || !horario.hora) return []
      return ocurrenciasEntre(horario, hoy, ventana).map((fecha) => ({
        cursoId,
        nombre: curso.nombre,
        fecha,
        hora: horario.hora as string,
      }))
    })

    return candidatas
      .filter((s) => s.fecha > hoy || s.hora >= horaActual)
      .sort((a, b) => (a.fecha === b.fecha ? a.hora.localeCompare(b.hora) : a.fecha.localeCompare(b.fecha)))
      .slice(0, 3)
  }, [cursoIds, cursosPorId, horariosPorCurso])

  const proximaSesion = proximasSesiones[0] ?? null

  const [tab, setTab] = useState<'resumen' | 'tablero'>('resumen')

  const misCursos = cursoIds
    .map((id) => cursosPorId[id])
    .filter((c): c is Curso => !!c)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white dark:bg-indigo-500">
            {iniciales(nombre ?? primerNombre)}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hola, {primerNombre}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{formatFechaSesion(todayIso())}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setTab('resumen')}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'resumen'
              ? 'border-blue-600 text-blue-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Resumen
        </button>
        <button
          type="button"
          onClick={() => setTab('tablero')}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'tablero'
              ? 'border-blue-600 text-blue-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Mi Tablero
        </button>
      </div>

      {tab === 'tablero' ? (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-500">
                  <th className="px-5 py-3 font-semibold">Curso</th>
                  <th className="px-5 py-3 font-semibold">Tipo de Curso</th>
                  <th className="px-5 py-3 font-semibold">Finalizados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={`mi-tablero-skeleton-${i}`}>
                      <td colSpan={3} className="px-5 py-4">
                        <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                      </td>
                    </tr>
                  ))
                ) : misCursos.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-12">
                      <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                        <Inbox className="h-8 w-8" />
                        <p className="text-sm">No tenés cursos asignados todavía.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  misCursos.map((c) => {
                    const insc = inscripcionesPorCurso[c.id]
                    const finalizado = insc?.completado === true && insc?.confirmado === true
                    return (
                      <tr key={c.id} className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                        <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">{c.nombre}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.tipo || '–'}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${
                              finalizado ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                            }`}
                          >
                            {finalizado ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
      <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-400 p-6 text-white shadow-sm dark:from-indigo-500 dark:to-indigo-400">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-blue-100 uppercase dark:text-indigo-100">
              <CalendarClock className="h-3.5 w-3.5" />
              Tu próxima sesión
            </p>
            {proximaSesion ? (
              <>
                <h2 className="mt-1.5 text-xl font-bold">{proximaSesion.nombre}</h2>
                <p className="mt-1 text-sm text-blue-50 dark:text-indigo-50">
                  {formatFechaSesion(proximaSesion.fecha)} · {formatHora(proximaSesion.hora)}
                </p>
              </>
            ) : (
              <h2 className="mt-1.5 text-xl font-bold">No tenés sesiones programadas</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onRegistrarAvance}
            className="flex w-fit items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm transition-colors hover:bg-blue-50 dark:text-indigo-600 dark:hover:bg-indigo-50"
          >
            Registrar avance
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
            <BookOpen className="h-3.5 w-3.5" />
            Cursos actuales
          </p>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={`skeleton-curso-${i}`} className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : cursosActuales.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-gray-400 dark:text-gray-500">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">No tenés cursos asignados todavía.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {cursosActuales.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{c.nombre}</p>
                      <p
                        className={`text-xs font-medium ${
                          c.estado === 'Completado'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : c.estado === 'En progreso'
                              ? 'text-blue-600 dark:text-indigo-400'
                              : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {c.estado}
                      </p>
                    </div>
                    {c.progreso !== null && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                        {c.progreso}%
                      </span>
                    )}
                  </div>
                  {c.progreso !== null && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 transition-[width] dark:bg-indigo-500"
                        style={{ width: `${c.progreso}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
            <CalendarClock className="h-3.5 w-3.5" />
            Próximas sesiones
          </p>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={`skeleton-sesion-${i}`} className="h-9 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : proximasSesiones.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-gray-400 dark:text-gray-500">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">No tenés sesiones programadas.</p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
              {proximasSesiones.map((s, i) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{s.nombre}</span>
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {formatFechaSesion(s.fecha)} · {formatHora(s.hora)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
          <ClipboardList className="h-3.5 w-3.5" />
          Últimos reportes
        </p>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={`skeleton-reporte-${i}`} className="h-9 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : ultimosReportes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-gray-400 dark:text-gray-500">
            <Inbox className="h-8 w-8" />
            <p className="text-sm">Todavía no registraste ningún avance.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                  <th className="pb-2 pr-4 font-semibold">Fecha</th>
                  <th className="pb-2 pr-4 font-semibold">Curso</th>
                  <th className="pb-2 pr-4 font-semibold">Lecciones</th>
                  <th className="pb-2 font-semibold">Aprendizaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ultimosReportes.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {formatFechaSesion(r.fecha)}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      {cursosPorId[r.cursoId]?.nombre ?? r.cursoId}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{r.lecciones}</td>
                    <td className="py-2.5 text-gray-500 dark:text-gray-400">{r.aprendizaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {puedeCambiarPassword && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-4 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
            <KeyRound className="h-3.5 w-3.5" />
            Cambiar contraseña
          </p>
          {pwExito ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Contraseña actualizada correctamente.
            </p>
          ) : (
            <form onSubmit={handleCambiarPassword} className="flex max-w-sm flex-col gap-3">
              <div>
                <label htmlFor="pwActual" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Contraseña actual
                </label>
                <input
                  id="pwActual"
                  type="password"
                  value={pwActual}
                  onChange={(e) => setPwActual(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="pwNueva" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nueva contraseña
                </label>
                <input
                  id="pwNueva"
                  type="password"
                  value={pwNueva}
                  onChange={(e) => setPwNueva(e.target.value)}
                  placeholder="Mínimo 8 caracteres y un número"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="pwConfirmar" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirmar nueva contraseña
                </label>
                <input
                  id="pwConfirmar"
                  type="password"
                  value={pwConfirmar}
                  onChange={(e) => setPwConfirmar(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              {pwError && <p className="text-sm text-red-600 dark:text-red-400">{pwError}</p>}
              <button
                type="submit"
                disabled={pwSubmitting}
                className="mt-1 flex w-fit items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                <KeyRound className="h-4 w-4" />
                {pwSubmitting ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </form>
          )}
        </div>
      )}
        </>
      )}
    </div>
  )
}
