import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Settings2,
  X,
  CheckCircle2,
  CalendarClock,
  Clock,
  Timer,
  CalendarRange,
  Inbox,
  BookOpen,
  CalendarDays,
  Search,
} from 'lucide-react'
import { collection, collectionGroup, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { addDays, ocurrenciasEntre, formatFechaSesion } from './scheduleUtils'
import Select from './Select'
import ButtonGroup from './ButtonGroup'
import { colorActivoTipoCurso, estiloTipoCurso } from './tipoCursoColors'
import { iconoEquipo } from './equipoFlags'
import TimePicker from './TimePicker'
import { ordenarPorNombreYFecha, ordenOpciones, type OrdenOpcion } from './sortUtils'

type Equipo = 'Colombia' | 'USA'
type TipoCurso = 'Educación Continua' | 'Unimetab' | 'Academia' | 'Poder del Conocimiento'
type Estado = 'Activo' | 'Inactivo'
type Dia = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'

const dias: Dia[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const diaIndex: Record<Dia, number> = Object.fromEntries(dias.map((d, i) => [d, i])) as Record<Dia, number>
const diaCorto: Record<Dia, string> = {
  Lunes: 'Lu',
  Martes: 'Ma',
  Miércoles: 'Mi',
  Jueves: 'Ju',
  Viernes: 'Vi',
  Sábado: 'Sá',
  Domingo: 'Do',
}

type Usuario = {
  id: string
  nombre: string
  equipo: Equipo | null
  tipoCurso: TipoCurso | null
  activo: boolean
}

type Inscripcion = {
  userId: string
  cursoId: string
  asignadoEn: { toMillis: () => number } | null
}

type Modo = 'semanal' | 'mensual'

type Horario = {
  userId: string
  cursoId: string
  modo: Modo
  dias: Dia[]
  fechas: string[]
  hora: string | null
  duracionMin: number | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
}

function horarioId(cursoId: string, userId: string): string {
  return `${cursoId}_${userId}`
}

type Fila = {
  key: string
  userId: string
  cursoId: string
  colaborador: string
  equipo: Equipo | null
  tipoCurso: TipoCurso | null
  activo: boolean
  curso: string
  modo: Modo
  dias: Dia[]
  fechas: string[]
  hora: string | null
  duracionMin: number | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
  asignadoEn: { toMillis: () => number } | null
}

const estadoStyles: Record<Estado, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

function formatHora(hora: string | null): string {
  if (!hora) return '–'
  const [hStr, mStr] = hora.split(':')
  const h = Number(hStr)
  const suffix = h >= 12 ? 'p.m.' : 'a.m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${suffix}`
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  const letras = partes.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return letras || '?'
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatVigencia(inicio: string | null, fin: string | null): string {
  if (!inicio) return '–'
  return fin ? `Desde ${formatFecha(inicio)} hasta ${formatFecha(fin)}` : `Desde ${formatFecha(inicio)}`
}

function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayIso(): string {
  return dateToIso(new Date())
}

function endOfMonthIso(): string {
  const now = new Date()
  return dateToIso(new Date(now.getFullYear(), now.getMonth() + 1, 0))
}

function formatFechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

const mesLabel = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

function buildMonthGrid(): (string | null)[] {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const startOffset = (first.getDay() + 6) % 7 // lunes=0
  const cells: (string | null)[] = new Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dateToIso(new Date(now.getFullYear(), now.getMonth(), d)))
  }
  return cells
}

const emptyForm = {
  dias: [] as Dia[],
  fechas: [] as string[],
  hora: '',
  duracionHoras: '',
  duracionMinutos: '',
  programarMes: false,
}

export default function Horarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cursoNombres, setCursoNombres] = useState<Record<string, string>>({})
  const [cursosPorId, setCursosPorId] = useState<Record<string, { nombre: string; duracionValor: number }>>({})
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [horarios, setHorarios] = useState<Record<string, Horario>>({})
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [loadingCursos, setLoadingCursos] = useState(true)
  const [loadingInscripciones, setLoadingInscripciones] = useState(true)
  const [loadingHorarios, setLoadingHorarios] = useState(true)

  const [equipo, setEquipo] = useState('Todas')
  const [tipoCurso, setTipoCurso] = useState('Todos')
  const [colaborador, setColaborador] = useState('Todos')
  const [curso, setCurso] = useState('Todos')
  const [estado, setEstado] = useState('Todos')
  const [orden, setOrden] = useState<OrdenOpcion>('az')

  const [vista, setVista] = useState<'tabla' | 'colaborador'>('tabla')
  const [colaboradorVistaId, setColaboradorVistaId] = useState<string | null>(null)
  const [colaboradorBusqueda, setColaboradorBusqueda] = useState('')
  const [cursoBusqueda, setCursoBusqueda] = useState('')

  const [editing, setEditing] = useState<Fila | null>(null)
  const [form, setForm] = useState(emptyForm)
  const monthGrid = useMemo(() => buildMonthGrid(), [])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('nombre'))
    return onSnapshot(
      q,
      (snap) => {
        setUsuarios(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              nombre: data.nombre ?? '',
              equipo: (data.equipo as Equipo) ?? null,
              tipoCurso: (data.tipoCurso as TipoCurso) ?? null,
              activo: data.activo !== false,
            }
          }),
        )
        setLoadingUsuarios(false)
      },
      (err) => {
        console.error('[Horarios] fallo listener users:', err)
        setLoadingUsuarios(false)
      },
    )
  }, [])

  useEffect(() => {
    return onSnapshot(
      collection(db, 'cursos'),
      (snap) => {
        const map: Record<string, string> = {}
        const infoMap: Record<string, { nombre: string; duracionValor: number }> = {}
        snap.docs.forEach((d) => {
          const data = d.data()
          const nombre = (data.nombre as string) ?? d.id
          map[d.id] = nombre
          infoMap[d.id] = { nombre, duracionValor: (data.duracionValor as number) ?? 0 }
        })
        setCursoNombres(map)
        setCursosPorId(infoMap)
        setLoadingCursos(false)
      },
      (err) => {
        console.error('[Horarios] fallo listener cursos:', err)
        setLoadingCursos(false)
      },
    )
  }, [])

  useEffect(() => {
    return onSnapshot(
      collectionGroup(db, 'inscripciones'),
      (snap) => {
        setInscripciones(
          snap.docs
            .map((d): Inscripcion | null => {
              const data = d.data()
              const userId = data.userId as string | undefined
              const cursoId = d.ref.parent.parent?.id
              if (!userId || !cursoId) return null
              return {
                userId,
                cursoId,
                asignadoEn: (data.asignadoEn as { toMillis: () => number } | undefined) ?? null,
              }
            })
            .filter((v): v is Inscripcion => v !== null),
        )
        setLoadingInscripciones(false)
      },
      (err) => {
        console.error('[Horarios] fallo listener inscripciones:', err)
        setLoadingInscripciones(false)
      },
    )
  }, [])

  useEffect(() => {
    return onSnapshot(
      collection(db, 'horarios'),
      (snap) => {
        const map: Record<string, Horario> = {}
        snap.docs.forEach((d) => {
          const data = d.data()
          const userId = data.userId as string | undefined
          const cursoId = data.cursoId as string | undefined
          if (!userId || !cursoId) return
          map[d.id] = {
            userId,
            cursoId,
            modo: (data.modo as Modo) ?? 'semanal',
            dias: (data.dias as Dia[]) ?? [],
            fechas: (data.fechas as string[]) ?? [],
            hora: (data.hora as string | undefined) ?? null,
            duracionMin: (data.duracionMin as number | undefined) ?? null,
            vigenciaInicio: (data.vigenciaInicio as string | undefined) ?? null,
            vigenciaFin: (data.vigenciaFin as string | undefined) ?? null,
          }
        })
        setHorarios(map)
        setLoadingHorarios(false)
      },
      (err) => {
        console.error('[Horarios] fallo listener horarios:', err)
        setLoadingHorarios(false)
      },
    )
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  const loading = loadingUsuarios || loadingCursos || loadingInscripciones || loadingHorarios

  const usuariosPorId = useMemo(() => {
    const map: Record<string, Usuario> = {}
    usuarios.forEach((u) => {
      map[u.id] = u
    })
    return map
  }, [usuarios])

  const filas: Fila[] = useMemo(() => {
    return inscripciones
      .map((insc) => {
        const u = usuariosPorId[insc.userId]
        if (!u) return null
        const h = horarios[horarioId(insc.cursoId, insc.userId)]
        return {
          key: horarioId(insc.cursoId, insc.userId),
          userId: insc.userId,
          cursoId: insc.cursoId,
          colaborador: u.nombre,
          equipo: u.equipo,
          tipoCurso: u.tipoCurso,
          activo: u.activo,
          curso: cursoNombres[insc.cursoId] ?? insc.cursoId,
          modo: h?.modo ?? 'semanal',
          dias: h ? [...h.dias].sort((a, b) => diaIndex[a] - diaIndex[b]) : [],
          fechas: h ? [...h.fechas].sort() : [],
          hora: h?.hora ?? null,
          duracionMin: h?.duracionMin ?? null,
          vigenciaInicio: h?.vigenciaInicio ?? null,
          vigenciaFin: h?.vigenciaFin ?? null,
          asignadoEn: insc.asignadoEn,
        }
      })
      .filter((f): f is Fila => f !== null)
  }, [inscripciones, usuariosPorId, cursoNombres, horarios])

  const colaboradoresOpciones = useMemo(
    () => [...new Set(filas.map((f) => f.colaborador))].sort(),
    [filas],
  )
  const cursosOpciones = useMemo(() => [...new Set(filas.map((f) => f.curso))].sort(), [filas])

  const palabrasColaboradorLista = normalizar(colaboradorBusqueda.trim())
    .split(/\s+/)
    .filter(Boolean)
  const usuariosListaFiltrados =
    palabrasColaboradorLista.length === 0
      ? usuarios
      : usuarios.filter((u) => {
          const texto = normalizar(u.nombre)
          return palabrasColaboradorLista.every((p) => texto.includes(p))
        })

  const filtradasSinOrden = filas.filter((f) => {
    const matchEquipo = equipo === 'Todas' || f.equipo === equipo
    const matchTipoCurso = tipoCurso === 'Todos' || f.tipoCurso === tipoCurso
    const matchColaborador = colaborador === 'Todos' || f.colaborador === colaborador
    const matchCurso = curso === 'Todos' || f.curso === curso
    const estadoFila: Estado = f.activo ? 'Activo' : 'Inactivo'
    const matchEstado = estado === 'Todos' || estadoFila === estado
    return matchEquipo && matchTipoCurso && matchColaborador && matchCurso && matchEstado
  })
  const filtradas = ordenarPorNombreYFecha(
    filtradasSinOrden,
    orden,
    (f) => f.colaborador,
    (f) => f.asignadoEn,
  )

  useEffect(() => {
    if (vista !== 'colaborador') return
    if (colaboradorVistaId && usuariosPorId[colaboradorVistaId]) return
    setColaboradorVistaId(usuarios[0]?.id ?? null)
  }, [vista, colaboradorVistaId, usuarios, usuariosPorId])

  const cursosColaboradorVista = useMemo(() => {
    if (!colaboradorVistaId) return []
    const hoy = todayIso()
    const ventana = addDays(hoy, 180)
    return filas
      .filter((f) => f.userId === colaboradorVistaId)
      .map((f) => {
        const duracionValor = cursosPorId[f.cursoId]?.duracionValor ?? 0
        const tieneHorario = f.dias.length > 0 || f.fechas.length > 0
        let progreso: number | null = null
        let proxima: { fecha: string; hora: string } | null = null
        if (tieneHorario && f.hora) {
          const completadas = ocurrenciasEntre(
            { modo: f.modo, dias: f.dias, fechas: f.fechas, hora: f.hora, vigenciaInicio: f.vigenciaInicio, vigenciaFin: f.vigenciaFin },
            '0001-01-01',
            hoy,
          ).length
          const total = duracionValor > 0 ? duracionValor : 1
          progreso = Math.min(100, Math.round((completadas / total) * 100))
          const siguiente = ocurrenciasEntre(
            { modo: f.modo, dias: f.dias, fechas: f.fechas, hora: f.hora, vigenciaInicio: f.vigenciaInicio, vigenciaFin: f.vigenciaFin },
            hoy,
            ventana,
          )[0]
          if (siguiente) proxima = { fecha: siguiente, hora: f.hora }
        }
        const estadoCurso =
          progreso === null ? 'Sin horario asignado' : progreso >= 100 ? 'Completado' : 'En progreso'
        return {
          cursoId: f.cursoId,
          curso: f.curso,
          modo: f.modo,
          dias: f.dias,
          fechas: f.fechas,
          hora: f.hora,
          progreso,
          proxima,
          estadoCurso,
          fila: f,
        }
      })
      .sort((a, b) => a.curso.localeCompare(b.curso))
  }, [colaboradorVistaId, filas, cursosPorId])

  const terminoCursoBusqueda = normalizar(cursoBusqueda.trim())
  const cursosColaboradorVistaFiltrados = terminoCursoBusqueda
    ? cursosColaboradorVista.filter((c) => normalizar(c.curso).includes(terminoCursoBusqueda))
    : cursosColaboradorVista

  function estaCompletado(f: Fila): boolean {
    const duracionValor = cursosPorId[f.cursoId]?.duracionValor ?? 0
    const tieneHorario = f.dias.length > 0 || f.fechas.length > 0
    if (!tieneHorario || !f.hora || duracionValor <= 0) return false
    const completadas = ocurrenciasEntre(
      { modo: f.modo, dias: f.dias, fechas: f.fechas, hora: f.hora, vigenciaInicio: f.vigenciaInicio, vigenciaFin: f.vigenciaFin },
      '0001-01-01',
      todayIso(),
    ).length
    return completadas >= duracionValor
  }

  function openEditModal(f: Fila) {
    if (estaCompletado(f)) return
    setEditing(f)
    const horas = f.duracionMin ? Math.floor(f.duracionMin / 60) : 0
    const minutos = f.duracionMin ? f.duracionMin % 60 : 0
    setForm({
      dias: f.dias,
      fechas: f.fechas,
      hora: f.hora ?? '',
      duracionHoras: horas ? String(horas) : '',
      duracionMinutos: minutos ? String(minutos) : '',
      programarMes: f.modo === 'mensual',
    })
    setFormError(null)
  }

  function closeModal() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
  }

  function toggleDia(d: Dia) {
    setForm((prev) => ({
      ...prev,
      dias: prev.dias.includes(d) ? prev.dias.filter((x) => x !== d) : [...prev.dias, d],
    }))
  }

  function toggleFecha(fecha: string) {
    setForm((prev) => ({
      ...prev,
      fechas: prev.fechas.includes(fecha) ? prev.fechas.filter((x) => x !== fecha) : [...prev.fechas, fecha],
    }))
  }

  function duracionTotalMin(): number {
    return Number(form.duracionHoras || 0) * 60 + Number(form.duracionMinutos || 0)
  }

  function validar(): string | null {
    if (form.programarMes) {
      if (form.fechas.length === 0) return 'Seleccioná al menos una fecha en el calendario.'
    } else if (form.dias.length === 0) {
      return 'Seleccioná al menos un día.'
    }
    if (!form.hora) return 'Seleccioná una hora.'
    if (duracionTotalMin() <= 0) return 'Ingresá una duración válida.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const err = validar()
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        userId: editing.userId,
        cursoId: editing.cursoId,
        modo: form.programarMes ? 'mensual' : 'semanal',
        dias: form.programarMes ? [] : form.dias,
        fechas: form.programarMes ? form.fechas : [],
        hora: form.hora,
        duracionMin: duracionTotalMin(),
        vigenciaFin: form.programarMes ? endOfMonthIso() : null,
      }
      if (!editing.vigenciaInicio) {
        payload.vigenciaInicio = todayIso()
      }
      await setDoc(doc(db, 'horarios', horarioId(editing.cursoId, editing.userId)), payload, { merge: true })
      setToast('Horario guardado correctamente.')
      closeModal()
    } catch {
      setFormError('No se pudo guardar el horario. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Horarios de estudio
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerencia consulta los horarios de cada colaborador y puede modificarlos en cualquier
            momento
          </p>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setVista('tabla')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${
              vista === 'tabla'
                ? 'bg-blue-600 text-white dark:bg-indigo-500'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Tabla
          </button>
          <button
            type="button"
            onClick={() => setVista('colaborador')}
            className={`flex items-center gap-1.5 border-l border-gray-300 px-3 py-2 text-sm font-medium transition dark:border-gray-700 ${
              vista === 'colaborador'
                ? 'bg-blue-600 text-white dark:bg-indigo-500'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            Por colaborador
          </button>
        </div>
      </div>

      {vista === 'tabla' ? (
      <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Equipo
            </span>
            <ButtonGroup
              value={equipo}
              onChange={setEquipo}
              className="w-40"
              options={['Todas', 'Colombia', 'USA']}
              ariaLabel="Equipo"
              iconFor={iconoEquipo}
              noWrap
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Tipo de curso
            </span>
            <ButtonGroup
              value={tipoCurso}
              onChange={setTipoCurso}
              className="w-96"
              options={['Todos', 'Educación Continua', 'Unimetab', 'Academia', 'Poder del Conocimiento']}
              ariaLabel="Tipo de curso"
              colorFor={colorActivoTipoCurso}
            />
          </div>
          <div>
            <label htmlFor="horColaborador" className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Colaborador
            </label>
            <Select
              id="horColaborador"
              value={colaborador}
              onChange={setColaborador}
              className="w-44"
              options={['Todos', ...colaboradoresOpciones]}
              searchable
            />
          </div>
          <div>
            <label htmlFor="horCurso" className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Curso
            </label>
            <Select
              id="horCurso"
              value={curso}
              onChange={setCurso}
              className="w-44"
              options={['Todos', ...cursosOpciones]}
              searchable
            />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Estado
            </span>
            <ButtonGroup
              value={estado}
              onChange={setEstado}
              className="w-52"
              options={['Todos', 'Activo', 'Inactivo']}
              ariaLabel="Estado"
            />
          </div>
          <div>
            <label htmlFor="horOrden" className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Ordenar
            </label>
            <Select
              id="horOrden"
              value={orden}
              onChange={(v) => setOrden(v as OrdenOpcion)}
              className="w-44"
              options={ordenOpciones.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:bg-gray-950 dark:text-gray-500">
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Colaborador</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Equipo</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Tipo de curso</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Curso</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Días</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Hora</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Duración</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Vigencia</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Estado</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 text-right font-semibold dark:bg-gray-950">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">
                    No hay horarios todavía.
                  </td>
                </tr>
              ) : (
                filtradas.map((f) => {
                  const estadoFila: Estado = f.activo ? 'Activo' : 'Inactivo'
                  const completado = estaCompletado(f)
                  return (
                    <tr key={f.key}>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        {f.colaborador}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.equipo ?? '–'}</td>
                      <td className="px-5 py-3">
                        {f.tipoCurso ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${estiloTipoCurso(f.tipoCurso)?.badge ?? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${estiloTipoCurso(f.tipoCurso)?.dot ?? 'bg-gray-400'}`} />
                            {f.tipoCurso}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">–</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.curso}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        {f.modo === 'mensual' && f.fechas.length > 0
                          ? f.fechas.map((fecha) => formatFechaCorta(fecha)).join(', ')
                          : f.dias.length > 0
                            ? f.dias.join(', ')
                            : 'Sin programar'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {formatHora(f.hora)}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        {f.duracionMin ? `${f.duracionMin} min` : '–'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-gray-400 dark:text-gray-500">
                        {formatVigencia(f.vigenciaInicio, f.vigenciaFin)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estadoStyles[estadoFila]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {estadoFila}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(f)}
                          disabled={completado}
                          title={completado ? 'Curso completado: no se puede modificar el horario' : 'Editar horario'}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                        >
                          <Settings2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-2 px-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
              Colaboradores
            </p>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={colaboradorBusqueda}
                onChange={(e) => setColaboradorBusqueda(e.target.value)}
                placeholder="Buscar colaborador..."
                aria-label="Buscar colaborador"
                className="w-full rounded-lg border border-gray-300 py-1.5 pr-7 pl-8 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              {colaboradorBusqueda && (
                <button
                  type="button"
                  onClick={() => setColaboradorBusqueda('')}
                  title="Limpiar búsqueda"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex max-h-[520px] flex-col gap-0.5 overflow-y-auto">
              {usuariosListaFiltrados.length === 0 ? (
                <p className="px-1.5 py-3 text-center text-sm text-gray-400 dark:text-gray-500">
                  Sin resultados.
                </p>
              ) : (
                usuariosListaFiltrados.map((u) => {
                const activo = u.id === colaboradorVistaId
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setColaboradorVistaId(u.id)}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                      activo
                        ? 'bg-blue-50 text-blue-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        activo
                          ? 'bg-blue-600 text-white dark:bg-indigo-500'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {iniciales(u.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.nombre}</span>
                      {u.equipo && (
                        <span className="block truncate text-xs text-gray-400 dark:text-gray-500">{u.equipo}</span>
                      )}
                    </span>
                  </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white dark:bg-indigo-500">
                  {iniciales(usuariosPorId[colaboradorVistaId ?? '']?.nombre ?? '?')}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {usuariosPorId[colaboradorVistaId ?? '']?.nombre ?? 'Selecciona un colaborador'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {cursosColaboradorVista.length} curso{cursosColaboradorVista.length === 1 ? '' : 's'} asignado
                    {cursosColaboradorVista.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className="relative w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={cursoBusqueda}
                  onChange={(e) => setCursoBusqueda(e.target.value)}
                  placeholder="Buscar curso..."
                  aria-label="Buscar curso"
                  className="w-full rounded-lg border border-gray-300 py-2 pr-9 pl-9 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                {cursoBusqueda && (
                  <button
                    type="button"
                    onClick={() => setCursoBusqueda('')}
                    title="Limpiar búsqueda"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                ))}
              </div>
            ) : cursosColaboradorVista.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-gray-400 dark:text-gray-500">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">No tiene cursos asignados.</p>
              </div>
            ) : cursosColaboradorVistaFiltrados.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-gray-400 dark:text-gray-500">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">Ningún curso coincide con la búsqueda.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {cursosColaboradorVistaFiltrados.map((c) => (
                  <div
                    key={c.cursoId}
                    className="rounded-xl border border-gray-100 p-4 transition-shadow hover:shadow-sm dark:border-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                          <BookOpen className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{c.curso}</p>
                          <p
                            className={`text-xs font-medium ${
                              c.estadoCurso === 'Completado'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : c.estadoCurso === 'En progreso'
                                  ? 'text-blue-600 dark:text-indigo-400'
                                  : 'text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {c.estadoCurso}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {c.progreso !== null && (
                          <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                            {c.progreso}%
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(c.fila)}
                          disabled={c.estadoCurso === 'Completado'}
                          title={
                            c.estadoCurso === 'Completado'
                              ? 'Curso completado: no se puede modificar el horario'
                              : 'Editar horario'
                          }
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                        >
                          <Settings2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {c.progreso !== null && (
                      <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-1.5 rounded-full bg-blue-500 transition-[width] dark:bg-indigo-500"
                          style={{ width: `${c.progreso}%` }}
                        />
                      </div>
                    )}
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {c.modo === 'mensual' && c.fechas.length > 0
                        ? c.fechas.map((fecha) => formatFechaCorta(fecha)).join(', ')
                        : c.dias.length > 0
                          ? c.dias.join(', ')
                          : 'Sin horario asignado'}
                      {c.hora ? ` · ${formatHora(c.hora)}` : ''}
                    </p>
                    {c.proxima && (
                      <p className="mt-1.5 text-xs font-medium text-blue-600 dark:text-indigo-400">
                        Próxima sesión: {formatFechaSesion(c.proxima.fecha)} · {formatHora(c.proxima.hora)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <CalendarClock className="h-5.5 w-5.5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Editar horario</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {editing.colaborador} · {editing.curso}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5 dark:border-gray-800">
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <CalendarRange className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  Programar solo este mes
                </span>
                <input
                  type="checkbox"
                  checked={form.programarMes}
                  onChange={(e) => setForm({ ...form, programarMes: e.target.checked })}
                  className="h-5 w-5 accent-blue-600 dark:accent-indigo-500"
                />
              </label>

              {form.programarMes ? (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center justify-between bg-gradient-to-br from-blue-500 to-blue-400 px-4 py-3 text-white dark:from-indigo-500 dark:to-indigo-400">
                    <span className="flex items-center gap-2 text-sm font-bold capitalize">
                      <CalendarDays className="h-4 w-4" />
                      {mesLabel}
                    </span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                      {form.fechas.length} fecha{form.fechas.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                      {dias.map((d) => (
                        <span key={d}>{diaCorto[d]}</span>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-1">
                      {monthGrid.map((fecha, i) => {
                        if (!fecha) return <span key={`pad-${i}`} />
                        const habilitado = fecha >= todayIso()
                        const activo = form.fechas.includes(fecha)
                        const esHoy = fecha === todayIso()
                        const dayNum = Number(fecha.split('-')[2])
                        return (
                          <button
                            key={fecha}
                            type="button"
                            disabled={!habilitado}
                            onClick={() => toggleFecha(fecha)}
                            className={`relative flex aspect-square items-center justify-center rounded-full text-sm font-medium transition-all ${
                              activo
                                ? 'scale-105 bg-blue-600 text-white shadow-md shadow-blue-600/30 dark:bg-indigo-500 dark:shadow-indigo-500/30'
                                : habilitado
                                  ? 'text-gray-700 hover:scale-105 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
                                  : 'text-gray-300 dark:text-gray-700'
                            }`}
                          >
                            {dayNum}
                            {esHoy && !activo && (
                              <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500 dark:bg-indigo-400" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Días de la semana
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {dias.map((d) => {
                      const activo = form.dias.includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          title={d}
                          onClick={() => toggleDia(d)}
                          className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition ${
                            activo
                              ? 'bg-blue-600 text-white shadow-sm ring-4 ring-blue-100 dark:bg-indigo-500 dark:ring-indigo-500/20'
                              : 'border border-gray-300 text-gray-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
                          }`}
                        >
                          {diaCorto[d]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="hora"
                    className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    Hora
                  </label>
                  <TimePicker id="hora" value={form.hora} onChange={(hora) => setForm({ ...form, hora })} />
                </div>
                <div>
                  <label
                    htmlFor="duracionHoras"
                    className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <Timer className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    Horas
                  </label>
                  <input
                    id="duracionHoras"
                    type="number"
                    min="0"
                    value={form.duracionHoras}
                    onChange={(e) => setForm({ ...form, duracionHoras: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="duracionMinutos"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Minutos
                  </label>
                  <input
                    id="duracionMinutos"
                    type="number"
                    min="0"
                    max="59"
                    value={form.duracionMinutos}
                    onChange={(e) => setForm({ ...form, duracionMinutos: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-sm text-blue-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                {(form.programarMes ? form.fechas.length > 0 : form.dias.length > 0) && form.hora ? (
                  <span>
                    Se dictará{' '}
                    <strong className="font-semibold">
                      {form.programarMes
                        ? [...form.fechas].sort().map((f) => formatFechaCorta(f)).join(', ')
                        : [...form.dias].sort((a, b) => diaIndex[a] - diaIndex[b]).join(', ')}
                    </strong>{' '}
                    a las <strong className="font-semibold">{formatHora(form.hora)}</strong>
                    {duracionTotalMin() > 0 ? (
                      <>
                        {' '}
                        ·{' '}
                        <strong className="font-semibold">
                          {form.duracionHoras ? `${form.duracionHoras} h ` : ''}
                          {form.duracionMinutos ? `${form.duracionMinutos} min` : ''}
                        </strong>
                      </>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-blue-700/70 dark:text-indigo-300/70">
                    {form.programarMes
                      ? 'Seleccioná fechas del calendario y una hora para ver el resumen.'
                      : 'Seleccioná días y hora para ver el resumen del horario.'}
                  </span>
                )}
              </div>

              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

              <div className="mt-1 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  <CalendarClock className="h-4 w-4" />
                  {submitting ? 'Guardando...' : 'Guardar horario'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div
          key={toast}
          className="animate-fade-in fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700 shadow-lg dark:border-emerald-500/20 dark:bg-gray-900 dark:text-emerald-400"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  )
}
