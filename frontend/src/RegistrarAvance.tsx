import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, Clock, CheckCircle2, Inbox } from 'lucide-react'
import DatePicker from './DatePicker'
import TimePicker from './TimePicker'
import Select from './Select'
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

type Tipo = 'Educación Continua' | 'Academia' | 'Unimetab' | 'Poder del Conocimiento'
type DuracionUnidad = 'Lecciones' | 'Horas'

type Curso = {
  id: string
  nombre: string
  tipo: Tipo
  duracionValor: number
  duracionUnidad: DuracionUnidad
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
  leccionFinal: '',
  horas: '',
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
  readonly preselectCursoId?: string | null
}

export default function RegistrarAvance({ userId, preselectCursoId }: RegistrarAvanceProps) {
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
  const [horasRegistradas, setHorasRegistradas] = useState(0)

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
          duracionUnidad: (data.duracionUnidad as DuracionUnidad) ?? 'Lecciones',
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
    } else if (preselectCursoId && cursoIds.includes(preselectCursoId)) {
      setSelectedCursoId(preselectCursoId)
    } else {
      setSelectedCursoId((prev) => (prev && cursoIds.includes(prev) ? prev : null))
    }
  }, [cursoIds, preselectCursoId])

  const cursoSeleccionado = selectedCursoId ? (cursosPorId[selectedCursoId] ?? null) : null
  const esEducacionContinua = cursoSeleccionado?.tipo === 'Educación Continua'
  const esHoras = !esEducacionContinua && cursoSeleccionado?.duracionUnidad === 'Horas'

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
    return onSnapshot(
      q,
      (snap) => setAvanceExistenteEC(!snap.empty),
      () => setAvanceExistenteEC(false),
    )
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

  function leccionRelativa(leccion: number): number {
    const c = capitulosInfo.find((c) => leccion >= c.inicio && leccion <= c.fin)
    return c ? leccion - c.inicio + 1 : leccion
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

  const cursoCompletado = leccionesInfo.total > 0 && leccionesInfo.libres.length === 0

  const proximaLeccion = leccionesInfo.libres.length > 0 ? leccionesInfo.libres[0] : null

  const opcionesLeccionFinal = useMemo(() => {
    if (proximaLeccion === null) return []
    const out: number[] = []
    for (let i = proximaLeccion; i <= leccionesInfo.total; i++) {
      if (leccionesInfo.cubiertas.has(i)) break
      out.push(i)
    }
    return out
  }, [proximaLeccion, leccionesInfo])

  function handleClickLeccion(n: number) {
    if (!opcionesLeccionFinal.includes(n)) return
    setForm({ ...form, leccionFinal: String(n) })
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
    if (!selectedCursoId || esEducacionContinua || esHoras) {
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
  }, [selectedCursoId, esEducacionContinua, esHoras, userId])

  useEffect(() => {
    if (!selectedCursoId || !esHoras) {
      setHorasRegistradas(0)
      return
    }
    const q = query(
      collection(db, 'avances'),
      where('userId', '==', userId),
      where('cursoId', '==', selectedCursoId),
    )
    return onSnapshot(q, (snap) => {
      const total = snap.docs.reduce((acc, d) => acc + ((d.data().horas as number) ?? 0), 0)
      setHorasRegistradas(total)
    })
  }, [selectedCursoId, esHoras, userId])

  const horasInfo = useMemo(() => {
    const total = cursoSeleccionado?.duracionValor ?? 0
    const restantes = Math.max(0, total - horasRegistradas)
    return { total, restantes }
  }, [cursoSeleccionado, horasRegistradas])

  const cursoCompletadoHoras = horasInfo.total > 0 && horasInfo.restantes <= 0

  function validar(): string | null {
    if (cursoCompletado) return 'Ya completaste todas las lecciones de este curso.'
    if (!sesionObjetivo) return 'No tenés una sesión programada para registrar avance.'
    if (!form.horaInicio) return 'Completá la hora de inicio.'
    if (!form.horaFin) return 'Completá la hora de finalización.'
    if (form.horaFin <= form.horaInicio) return 'La hora de finalización debe ser posterior a la hora de inicio.'
    if (proximaLeccion === null || !form.leccionFinal) return 'Indicá hasta qué lección llegaste.'
    const inicial = proximaLeccion
    const final = Number(form.leccionFinal)
    if (!Number.isInteger(final) || final < inicial) {
      return 'La lección final no puede ser menor a la próxima lección pendiente.'
    }
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
    if (!sesionObjetivo || !selectedCursoId || proximaLeccion === null) return
    setFormError(null)
    setSubmitting(true)
    try {
      const leccionInicial = proximaLeccion
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
      setRangosRegistrados((prev) => [...prev, { leccionInicial, leccionFinal }])

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

  function validarHoras(): string | null {
    if (cursoCompletadoHoras) return 'Ya completaste todas las horas de este curso.'
    if (!sesionObjetivo) return 'No tenés una sesión programada para registrar avance.'
    if (!form.horaInicio) return 'Completá la hora de inicio.'
    if (!form.horaFin) return 'Completá la hora de finalización.'
    if (form.horaFin <= form.horaInicio) return 'La hora de finalización debe ser posterior a la hora de inicio.'
    const horas = Number(form.horas)
    if (!form.horas || !Number.isFinite(horas) || horas <= 0) return 'Indicá cuántas horas completaste.'
    if (horas > horasInfo.restantes) return 'No podés registrar más horas de las que le quedan al curso.'
    if (!form.aprendizaje.trim()) return 'Contanos tu principal aprendizaje de la sesión.'
    return null
  }

  async function handleSubmitHoras(e: FormEvent) {
    e.preventDefault()
    const err = validarHoras()
    if (err) {
      setFormError(err)
      return
    }
    if (!sesionObjetivo || !selectedCursoId) return
    setFormError(null)
    setSubmitting(true)
    try {
      const horas = Number(form.horas)
      await addDoc(collection(db, 'avances'), {
        userId,
        cursoId: selectedCursoId,
        fecha: form.fecha,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        horas,
        aprendizaje: form.aprendizaje.trim(),
        comentario: form.comentario.trim() || null,
        creadoEn: serverTimestamp(),
      })
      setHorasRegistradas((prev) => prev + horas)

      const curso = cursosPorId[selectedCursoId]
      if (curso && curso.duracionValor > 0) {
        const avancesSnap = await getDocs(
          query(
            collection(db, 'avances'),
            where('userId', '==', userId),
            where('cursoId', '==', selectedCursoId),
          ),
        )
        const totalHoras = avancesSnap.docs.reduce((acc, d) => acc + ((d.data().horas as number) ?? 0), 0)
        if (totalHoras >= curso.duracionValor) {
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
              <Select
                value={selectedCursoId ?? ''}
                onChange={(v) => setSelectedCursoId(v || null)}
                placeholder="Selecciona un curso..."
                options={opcionesCursos.map((o) => {
                  const partes = [o.nombre]
                  if (o.tipo) partes.push(o.tipo)
                  if (o.proxima) partes.push(`próxima sesión ${formatFechaSesion(o.proxima)}`)
                  return { value: o.id, label: partes.join(' · ') }
                })}
              />
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
              ) : avanceExistenteEC ? (
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
                    <DatePicker
                      value={formEC.fecha}
                      onChange={(fecha) => setFormEC({ ...formEC, fecha })}
                      minDate={todayIso()}
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
          ) : esHoras ? (
            cursoCompletadoHoras ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Ya completaste todas las horas de este curso.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {inscripcionSeleccionada?.confirmado
                      ? 'Completado y confirmado.'
                      : 'Registro completo. Pendiente de confirmación por un administrador.'}
                  </p>
                </div>
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
                  onSubmit={handleSubmitHoras}
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
                        <TimePicker
                          value={form.horaInicio}
                          onChange={(horaInicio) => setForm({ ...form, horaInicio })}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                          Hora de fin <span className="text-red-500">*</span>
                        </label>
                        <TimePicker
                          value={form.horaFin}
                          onChange={(horaFin) => setForm({ ...form, horaFin })}
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-gray-100 dark:border-gray-800" />

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="horasCompletadas" className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Horas completadas en esta sesión <span className="text-red-500">*</span>
                      </label>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {horasRegistradas}/{horasInfo.total} horas
                      </span>
                    </div>
                    <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-violet-600 transition-all dark:bg-violet-500"
                        style={{
                          width: `${horasInfo.total > 0 ? Math.min(100, (horasRegistradas / horasInfo.total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <input
                      id="horasCompletadas"
                      type="number"
                      min="0.5"
                      step="0.5"
                      max={horasInfo.restantes}
                      value={form.horas}
                      onChange={(e) => setForm({ ...form, horas: e.target.value })}
                      placeholder={`Máximo ${horasInfo.restantes} horas restantes`}
                      className={dateTimeInputClass}
                    />
                  </div>

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
                    className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-60 dark:bg-violet-500 dark:hover:bg-violet-600"
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
            )
          ) : cursoCompletado ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Ya completaste todas las lecciones de este curso.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {inscripcionSeleccionada?.confirmado
                    ? 'Completado y confirmado.'
                    : 'Registro completo. Pendiente de confirmación por un administrador.'}
                </p>
              </div>
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
                      <TimePicker
                        value={form.horaInicio}
                        onChange={(horaInicio) => setForm({ ...form, horaInicio })}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Hora de fin <span className="text-red-500">*</span>
                      </label>
                      <TimePicker
                        value={form.horaFin}
                        onChange={(horaFin) => setForm({ ...form, horaFin })}
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
                            ? leccionRelativa(r.leccionInicial)
                            : `${leccionRelativa(r.leccionInicial)}–${leccionRelativa(r.leccionFinal)}`}
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
                ) : (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Lecciones de esta sesión <span className="text-red-500">*</span>
                      </label>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {form.leccionFinal && proximaLeccion !== null
                          ? `Seleccionado: ${leccionRelativa(proximaLeccion)}–${leccionRelativa(Number(form.leccionFinal))}`
                          : proximaLeccion !== null
                            ? `Próxima lección: ${leccionRelativa(proximaLeccion)}`
                            : ''}
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                      Empezás automáticamente desde la lección {proximaLeccion !== null ? leccionRelativa(proximaLeccion) : ''}. Tocá hasta dónde llegaste. Las
                      lecciones en gris ya fueron registradas antes.
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
                              const seleccionable = opcionesLeccionFinal.includes(n)
                              const final = Number(form.leccionFinal)
                              const enRango =
                                form.leccionFinal !== '' && proximaLeccion !== null && n >= proximaLeccion && n <= final
                              const esProxima = n === proximaLeccion && form.leccionFinal === ''
                              let estilo =
                                'cursor-not-allowed border-gray-100 bg-gray-100 text-gray-300 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-600'
                              if (seleccionable) {
                                estilo =
                                  'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-indigo-400'
                              }
                              if (enRango || esProxima) {
                                estilo =
                                  'border-blue-600 bg-blue-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                              }
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  disabled={!seleccionable}
                                  onClick={() => handleClickLeccion(n)}
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${estilo}`}
                                >
                                  {leccionRelativa(n)}
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
