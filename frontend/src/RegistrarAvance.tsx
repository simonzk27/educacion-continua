import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, Clock, CheckCircle2, Inbox } from 'lucide-react'
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDocs,
  onSnapshot,
  query,
  type QuerySnapshot,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  type Dia,
  type Modo,
  addDays,
  formatFechaSesion,
  formatHora,
  ocurrenciasEntre,
  todayIso,
} from './scheduleUtils'

type Tipo = 'Educación Continua' | 'Academia' | 'Unimetab'

type Curso = {
  id: string
  nombre: string
  tipo: Tipo
  duracionValor: number
  capitulos: number[] | null
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

type InscripcionSeleccionada = {
  completado: boolean
  confirmado: boolean
}

function horaActualStr(): string {
  const ahora = new Date()
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
}

const emptyForm = {
  fecha: '',
  horaInicio: '',
  horaFin: '',
  leccionInicial: '',
  leccionFinal: '',
  aprendizaje: '',
  comentario: '',
}

const dateTimeInputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:[color-scheme:dark]'

function rangosSolapan(aInicio: number, aFin: number, bInicio: number, bFin: number): boolean {
  return aInicio <= bFin && bInicio <= aFin
}

const emptyFormEC = {
  fecha: '',
  aprendizaje: '',
  comentario: '',
}

type RegistrarAvanceProps = {
  readonly userId: string
}

export default function RegistrarAvance({ userId }: RegistrarAvanceProps) {
  const [cursosPorId, setCursosPorId] = useState<Record<string, Curso>>({})
  const [cursoIds, setCursoIds] = useState<string[]>([])
  const [horariosPorCurso, setHorariosPorCurso] = useState<Record<string, Horario>>({})
  const [loading, setLoading] = useState(true)
  const [selectedCursoId, setSelectedCursoId] = useState<string | null>(null)

  const [form, setForm] = useState(emptyForm)
  const [formEC, setFormEC] = useState(emptyFormEC)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  const [inscripcionSeleccionada, setInscripcionSeleccionada] = useState<InscripcionSeleccionada | null>(null)
  const [avanceExistenteEC, setAvanceExistenteEC] = useState<boolean | null>(null)
  const [rangosRegistrados, setRangosRegistrados] = useState<{ leccionInicial: number; leccionFinal: number }[]>([])

  useEffect(() => {
    function aplicarCursos(snap: QuerySnapshot) {
      const map: Record<string, Curso> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        map[d.id] = {
          id: d.id,
          nombre: (data.nombre as string) ?? d.id,
          tipo: (data.tipo as Tipo) ?? 'Academia',
          duracionValor: (data.duracionValor as number) ?? 0,
          capitulos: (data.capitulos as number[] | undefined) ?? null,
        }
      })
      setCursosPorId(map)
    }
    const q = collection(db, 'cursos')
    getDocs(q).then(aplicarCursos).catch(() => {})
    return onSnapshot(q, aplicarCursos)
  }, [])

  useEffect(() => {
    function aplicarSnapshot(snap: QuerySnapshot) {
      setCursoIds(snap.docs.map((d) => d.ref.parent.parent?.id).filter((id): id is string => !!id))
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

  useEffect(() => {
    if (cursoIds.length === 1) {
      setSelectedCursoId(cursoIds[0])
    } else if (cursoIds.length === 0) {
      setSelectedCursoId(null)
    } else {
      setSelectedCursoId((prev) => (prev && cursoIds.includes(prev) ? prev : null))
    }
  }, [cursoIds])

  const cursoSeleccionado = selectedCursoId ? (cursosPorId[selectedCursoId] ?? null) : null
  const esEducacionContinua = cursoSeleccionado?.tipo === 'Educación Continua'

  useEffect(() => {
    if (!selectedCursoId) {
      setInscripcionSeleccionada(null)
      return
    }
    return onSnapshot(doc(db, 'cursos', selectedCursoId, 'inscripciones', userId), (snap) => {
      const data = snap.data()
      if (!data) {
        setInscripcionSeleccionada(null)
        return
      }
      setInscripcionSeleccionada({
        completado: data.completado === true,
        confirmado: data.confirmado !== false,
      })
    })
  }, [selectedCursoId, userId])

  useEffect(() => {
    if (!selectedCursoId || !esEducacionContinua) {
      setAvanceExistenteEC(null)
      return
    }
    setAvanceExistenteEC(null)
    const q = query(
      collection(db, 'avances'),
      where('userId', '==', userId),
      where('cursoId', '==', selectedCursoId),
    )
    getDocs(q)
      .then((snap) => setAvanceExistenteEC(!snap.empty))
      .catch(() => setAvanceExistenteEC(false))
  }, [selectedCursoId, esEducacionContinua, userId])

  const opcionesCursos = useMemo(() => {
    const hoy = todayIso()
    const ventana = addDays(hoy, 180)
    return cursoIds.map((id) => {
      const curso = cursosPorId[id]
      const horario = horariosPorCurso[id]
      let proxima: string | null = null
      if (curso && curso.tipo !== 'Educación Continua' && horario?.hora) {
        proxima = ocurrenciasEntre(horario, hoy, ventana)[0] ?? null
      }
      return { id, nombre: curso?.nombre ?? id, tipo: curso?.tipo ?? null, proxima }
    })
  }, [cursoIds, cursosPorId, horariosPorCurso])

  const capitulosInfo = useMemo(() => {
    const capitulos = cursoSeleccionado?.capitulos
    if (!capitulos || capitulos.length === 0) return []
    let inicio = 1
    return capitulos.map((lecciones, i) => {
      const fin = inicio + lecciones - 1
      const info = { numero: i + 1, inicio, fin, lecciones }
      inicio = fin + 1
      return info
    })
  }, [cursoSeleccionado])

  function capituloDeLeccion(leccion: number): number | null {
    const c = capitulosInfo.find((c) => leccion >= c.inicio && leccion <= c.fin)
    return c?.numero ?? null
  }

  const leccionesInfo = useMemo(() => {
    const total = cursoSeleccionado?.duracionValor ?? 0
    const cubiertas = new Set<number>()
    rangosRegistrados.forEach((r) => {
      for (let i = r.leccionInicial; i <= r.leccionFinal; i++) cubiertas.add(i)
    })
    const libres: number[] = []
    for (let i = 1; i <= total; i++) {
      if (!cubiertas.has(i)) libres.push(i)
    }
    return { total, cubiertas, libres }
  }, [cursoSeleccionado, rangosRegistrados])

  const opcionesLeccionFinal = useMemo(() => {
    const inicial = Number(form.leccionInicial)
    if (!form.leccionInicial || !Number.isInteger(inicial) || leccionesInfo.cubiertas.has(inicial)) return []
    const out: number[] = []
    for (let i = inicial; i <= leccionesInfo.total; i++) {
      if (leccionesInfo.cubiertas.has(i)) break
      out.push(i)
    }
    return out
  }, [form.leccionInicial, leccionesInfo])

  function handleClickLeccion(n: number) {
    if (leccionesInfo.cubiertas.has(n)) return
    const inicial = Number(form.leccionInicial)
    const eligiendoFinal = form.leccionInicial !== '' && form.leccionFinal === ''

    if (!eligiendoFinal) {
      setForm({ ...form, leccionInicial: String(n), leccionFinal: '' })
      return
    }
    if (n === inicial) {
      setForm({ ...form, leccionInicial: '', leccionFinal: '' })
      return
    }
    if (n > inicial) {
      const alcanzable = opcionesLeccionFinal.includes(n)
      if (alcanzable) {
        setForm({ ...form, leccionFinal: String(n) })
        return
      }
    }
    setForm({ ...form, leccionInicial: String(n), leccionFinal: '' })
  }

  const sesionObjetivo = useMemo(() => {
    if (!selectedCursoId || esEducacionContinua) return null
    const curso = cursosPorId[selectedCursoId]
    const horario = horariosPorCurso[selectedCursoId]
    if (!curso || !horario || !horario.hora) return null

    const hoy = todayIso()
    const ventana = addDays(hoy, 180)
    const ahora = new Date()
    const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`

    const candidatas = ocurrenciasEntre(horario, hoy, ventana).map((fecha) => ({
      cursoId: selectedCursoId,
      cursoNombre: curso.nombre,
      fecha,
      hora: horario.hora as string,
    }))

    return (
      candidatas
        .filter((s) => s.fecha > hoy || s.hora >= horaActual)
        .sort((a, b) => (a.fecha === b.fecha ? a.hora.localeCompare(b.hora) : a.fecha.localeCompare(b.fecha)))[0] ??
      null
    )
  }, [selectedCursoId, esEducacionContinua, cursosPorId, horariosPorCurso])

  useEffect(() => {
    if (!sesionObjetivo) return
    setForm((prev) => ({
      ...prev,
      horaInicio: prev.horaInicio || sesionObjetivo.hora,
    }))
  }, [sesionObjetivo])

  useEffect(() => {
    setForm({ ...emptyForm, fecha: todayIso(), horaFin: horaActualStr() })
    setFormEC(emptyFormEC)
    setFormError(null)
    setGuardado(false)
  }, [selectedCursoId])

  useEffect(() => {
    if (!selectedCursoId || esEducacionContinua) {
      setRangosRegistrados([])
      return
    }
    const q = query(
      collection(db, 'avances'),
      where('userId', '==', userId),
      where('cursoId', '==', selectedCursoId),
    )
    return onSnapshot(q, (snap) => {
      const rangos = snap.docs
        .map((d) => {
          const data = d.data()
          const leccionInicial = data.leccionInicial as number | null
          const leccionFinal = data.leccionFinal as number | null
          if (leccionInicial == null || leccionFinal == null) return null
          return { leccionInicial, leccionFinal }
        })
        .filter((r): r is { leccionInicial: number; leccionFinal: number } => r !== null)
        .sort((a, b) => a.leccionInicial - b.leccionInicial)
      setRangosRegistrados(rangos)
    })
  }, [selectedCursoId, esEducacionContinua, userId])

  function validar(): string | null {
    if (!sesionObjetivo) return 'No tenés una sesión programada para registrar avance.'
    if (!form.horaInicio) return 'Completá la hora de inicio.'
    if (!form.horaFin) return 'Completá la hora de finalización.'
    if (form.horaFin <= form.horaInicio) return 'La hora de finalización debe ser posterior a la hora de inicio.'
    if (!form.leccionInicial || !form.leccionFinal) return 'Indicá lección inicial y lección final.'
    const inicial = Number(form.leccionInicial)
    const final = Number(form.leccionFinal)
    if (!Number.isInteger(inicial) || inicial < 1) return 'La lección inicial debe ser un número entero mayor a 0.'
    if (!Number.isInteger(final) || final < 1) return 'La lección final debe ser un número entero mayor a 0.'
    if (final < inicial) return 'La lección final no puede ser menor a la lección inicial.'
    const solapa = rangosRegistrados.some((r) => rangosSolapan(inicial, final, r.leccionInicial, r.leccionFinal))
    if (solapa) return 'Ya registraste un avance que incluye alguna de estas lecciones.'
    if (!form.aprendizaje.trim()) return 'Contanos tu principal aprendizaje de la sesión.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validar()
    if (err) {
      setFormError(err)
      return
    }
    if (!sesionObjetivo || !selectedCursoId) return
    setFormError(null)
    setSubmitting(true)
    try {
      const leccionInicial = Number(form.leccionInicial)
      const leccionFinal = Number(form.leccionFinal)
      await addDoc(collection(db, 'avances'), {
        userId,
        cursoId: selectedCursoId,
        fecha: form.fecha,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        lecciones: leccionFinal - leccionInicial + 1,
        leccionInicial,
        leccionFinal,
        aprendizaje: form.aprendizaje.trim(),
        comentario: form.comentario.trim() || null,
        creadoEn: serverTimestamp(),
      })

      const curso = cursosPorId[selectedCursoId]
      if (curso && curso.duracionValor > 0) {
        const avancesSnap = await getDocs(
          query(
            collection(db, 'avances'),
            where('userId', '==', userId),
            where('cursoId', '==', selectedCursoId),
          ),
        )
        const totalLecciones = avancesSnap.docs.reduce(
          (acc, d) => acc + ((d.data().lecciones as number) ?? 0),
          0,
        )
        if (totalLecciones >= curso.duracionValor) {
          await updateDoc(doc(db, 'cursos', selectedCursoId, 'inscripciones', userId), {
            completado: true,
            confirmado: true,
            fechaCompletado: serverTimestamp(),
          })
        }
      }

      setGuardado(true)
      setForm(emptyForm)
    } catch {
      setFormError('No se pudo guardar el avance. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitEC(e: FormEvent) {
    e.preventDefault()
    if (!formEC.fecha) {
      setFormError('Seleccioná la fecha.')
      return
    }
    if (!formEC.aprendizaje.trim()) {
      setFormError('Contanos tu principal aprendizaje.')
      return
    }
    if (!selectedCursoId) return
    setFormError(null)
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'avances'), {
        userId,
        cursoId: selectedCursoId,
        fecha: formEC.fecha,
        aprendizaje: formEC.aprendizaje.trim(),
        comentario: formEC.comentario.trim() || null,
        creadoEn: serverTimestamp(),
      })
      await updateDoc(doc(db, 'cursos', selectedCursoId, 'inscripciones', userId), {
        completado: true,
        confirmado: false,
        fechaCompletado: null,
      })
      setGuardado(true)
      setFormEC(emptyFormEC)
      setAvanceExistenteEC(true)
      setInscripcionSeleccionada({ completado: true, confirmado: false })
    } catch {
      setFormError('No se pudo guardar el avance. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <CalendarClock className="h-5.5 w-5.5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Registrar avance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Completa este formulario en menos de un minuto ·{' '}
            <span className="text-red-500">*</span> campos obligatorios
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : cursoIds.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 py-12 text-gray-400 dark:border-gray-800 dark:text-gray-500">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">No tenés ningún curso asignado todavía.</p>
        </div>
      ) : (
        <>
          {cursoIds.length > 1 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                Selecciona el curso <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCursoId ?? ''}
                onChange={(e) => setSelectedCursoId(e.target.value || null)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="">Selecciona un curso...</option>
                {opcionesCursos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                    {o.tipo ? ` · ${o.tipo}` : ''}
                    {o.proxima ? ` · próxima sesión ${formatFechaSesion(o.proxima)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!selectedCursoId ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Selecciona un curso arriba para continuar.
            </p>
          ) : esEducacionContinua ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              {avanceExistenteEC === null ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Cargando...</p>
              ) : avanceExistenteEC || inscripcionSeleccionada?.completado ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Ya registraste tu avance para este curso.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {inscripcionSeleccionada?.confirmado
                      ? 'Completado y confirmado por un administrador.'
                      : 'Pendiente de confirmación por un administrador.'}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitEC} className="flex flex-col gap-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Fecha <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formEC.fecha}
                      onChange={(e) => setFormEC({ ...formEC, fecha: e.target.value })}
                      className={dateTimeInputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                      ¿Cuál fue tu principal aprendizaje o ganancia de este curso?{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      maxLength={300}
                      value={formEC.aprendizaje}
                      onChange={(e) => setFormEC({ ...formEC, aprendizaje: e.target.value })}
                      placeholder="Entendí cómo..."
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                      {formEC.aprendizaje.length}/300
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Comentario adicional{' '}
                      <span className="font-normal text-gray-400 dark:text-gray-500">(opcional)</span>
                    </label>
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={formEC.comentario}
                      onChange={(e) => setFormEC({ ...formEC, comentario: e.target.value })}
                      placeholder="Algo más que quieras registrar..."
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                      {formEC.comentario.length}/500
                    </p>
                  </div>

                  {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    {submitting ? 'Guardando...' : 'Guardar avance'}
                  </button>

                  {guardado && (
                    <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Avance guardado correctamente. Queda pendiente de confirmación por un administrador.
                    </p>
                  )}
                </form>
              )}
            </div>
          ) : (
            <>
              {sesionObjetivo ? (
                <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-400 p-6 text-white shadow-sm dark:from-indigo-500 dark:to-indigo-400">
                  <p className="text-xs font-medium tracking-wide text-blue-100 uppercase dark:text-indigo-100">
                    Sesión más próxima programada
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{sesionObjetivo.cursoNombre}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-blue-50 dark:text-indigo-50">
                    <Clock className="h-4 w-4" />
                    {formatFechaSesion(sesionObjetivo.fecha)} · {formatHora(sesionObjetivo.hora)}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 py-8 text-gray-400 dark:border-gray-800 dark:text-gray-500">
                  <Inbox className="h-7 w-7" />
                  <p className="text-sm">No tenés ninguna sesión programada todavía.</p>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
              >
                <div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Fecha <span className="font-normal text-gray-400 dark:text-gray-500">(automática)</span>
                      </label>
                      <input
                        type="date"
                        value={form.fecha}
                        disabled
                        className={`${dateTimeInputClass} disabled:opacity-70`}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Hora de inicio <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={form.horaInicio}
                        onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                        className={dateTimeInputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Hora de fin <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={form.horaFin}
                        onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                        className={dateTimeInputClass}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-400 italic dark:text-gray-500">
                    La hora de fin viene precargada con la hora actual — ajustala si terminaste antes o después.
                  </p>
                </div>

                <hr className="border-gray-100 dark:border-gray-800" />

                {rangosRegistrados.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-400 dark:text-gray-500">Ya registradas:</span>
                    {rangosRegistrados.map((r) => {
                      const capIni = capituloDeLeccion(r.leccionInicial)
                      const capFin = capituloDeLeccion(r.leccionFinal)
                      const capTag =
                        capIni && capFin ? (capIni === capFin ? ` · Cap. ${capIni}` : ` · Cap. ${capIni}–${capFin}`) : ''
                      return (
                        <span
                          key={`${r.leccionInicial}-${r.leccionFinal}`}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {r.leccionInicial === r.leccionFinal
                            ? r.leccionInicial
                            : `${r.leccionInicial}–${r.leccionFinal}`}
                          {capTag}
                        </span>
                      )
                    })}
                  </div>
                )}

                {leccionesInfo.total === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Este curso no tiene sesiones configuradas todavía.
                  </p>
                ) : leccionesInfo.libres.length === 0 ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    Ya registraste todas las lecciones de este curso.
                  </p>
                ) : (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Lecciones de esta sesión <span className="text-red-500">*</span>
                      </label>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {form.leccionInicial && form.leccionFinal
                          ? `Seleccionado: ${form.leccionInicial}–${form.leccionFinal}`
                          : form.leccionInicial
                            ? `Inicio: ${form.leccionInicial} · elegí el final`
                            : ''}
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                      Tocá la lección donde empezaste y luego la lección donde terminaste. Las lecciones en gris ya
                      fueron registradas antes.
                    </p>
                    <div className="flex flex-col gap-3">
                      {(capitulosInfo.length > 0
                        ? capitulosInfo
                        : [{ numero: 0, inicio: 1, fin: leccionesInfo.total, lecciones: leccionesInfo.total }]
                      ).map((cap) => (
                        <div key={cap.numero}>
                          {capitulosInfo.length > 0 && (
                            <p className="mb-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                              Capítulo {cap.numero}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: cap.fin - cap.inicio + 1 }, (_, i) => cap.inicio + i).map((n) => {
                              const bloqueada = leccionesInfo.cubiertas.has(n)
                              const inicial = Number(form.leccionInicial)
                              const final = Number(form.leccionFinal)
                              const enRango =
                                form.leccionInicial !== '' &&
                                form.leccionFinal !== '' &&
                                n >= inicial &&
                                n <= final
                              const esInicioSolo = form.leccionInicial !== '' && n === inicial && form.leccionFinal === ''
                              let estilo =
                                'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-indigo-400'
                              if (bloqueada) {
                                estilo =
                                  'cursor-not-allowed border-gray-100 bg-gray-100 text-gray-300 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-600'
                              } else if (enRango || esInicioSolo) {
                                estilo =
                                  'border-blue-600 bg-blue-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                              }
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  disabled={bloqueada}
                                  onClick={() => handleClickLeccion(n)}
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${estilo}`}
                                >
                                  {n}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                    ¿Cuál fue tu principal aprendizaje o ganancia de esta sesión?{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    maxLength={300}
                    value={form.aprendizaje}
                    onChange={(e) => setForm({ ...form, aprendizaje: e.target.value })}
                    placeholder="Entendí cómo..."
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                  <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                    {form.aprendizaje.length}/300
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Comentario adicional{' '}
                    <span className="font-normal text-gray-400 dark:text-gray-500">(opcional)</span>
                  </label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={form.comentario}
                    onChange={(e) => setForm({ ...form, comentario: e.target.value })}
                    placeholder="Algo más que quieras registrar..."
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                  <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
                    {form.comentario.length}/500
                  </p>
                </div>

                {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

                <button
                  type="submit"
                  disabled={submitting || !sesionObjetivo}
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {submitting ? 'Guardando...' : 'Guardar avance'}
                </button>

                {guardado && (
                  <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Avance guardado correctamente.
                  </p>
                )}
              </form>
            </>
          )}
        </>
      )}
    </div>
  )
}
