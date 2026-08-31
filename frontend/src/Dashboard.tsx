import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  ListChecks,
  CircleDot,
  CalendarDays,
  CheckCircle2,
  AlarmClockCheck,
  XCircle,
  Gauge,
  Inbox,
} from 'lucide-react'
import { collection, collectionGroup, onSnapshot, type Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import { type Dia, type Modo, addDays, dateToIso, formatHora, ocurrenciasEntre, todayIso } from './scheduleUtils'

const diasCortos = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

function addMonths(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1 + delta, 1)
  return dateToIso(dt)
}

function buildMonthGridFor(monthIso: string): (string | null)[] {
  const [y, m] = monthIso.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const daysInMonth = new Date(y, m, 0).getDate()
  const startOffset = (first.getDay() + 6) % 7
  const cells: (string | null)[] = new Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dateToIso(new Date(y, m - 1, d)))
  }
  return cells
}

type FechaCalendarioProps = {
  readonly value: string
  readonly onChange: (fecha: string) => void
  readonly disabled?: boolean
}

function FechaCalendario({ value, onChange, disabled }: FechaCalendarioProps) {
  const [abierto, setAbierto] = useState(false)
  const [mesVista, setMesVista] = useState(`${value.slice(0, 7)}-01`)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [abierto])

  function abrir() {
    setMesVista(`${value.slice(0, 7)}-01`)
    setAbierto(true)
  }

  const grid = useMemo(() => buildMonthGridFor(mesVista), [mesVista])
  const mesLabel = new Date(`${mesVista}T00:00:00`).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
      >
        <CalendarDays className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        {formatFechaCorta(value)}
      </button>

      {abierto && (
        <div className="absolute top-full left-0 z-20 mt-1.5 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between bg-gradient-to-br from-blue-500 to-blue-400 px-3 py-2.5 text-white dark:from-indigo-500 dark:to-indigo-400">
            <button
              type="button"
              onClick={() => setMesVista((m) => addMonths(m, -1))}
              disabled={mesVista <= `${todayIso().slice(0, 7)}-01`}
              className="rounded-lg p-1 hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold capitalize">{mesLabel}</span>
            <button
              type="button"
              onClick={() => setMesVista((m) => addMonths(m, 1))}
              className="rounded-lg p-1 hover:bg-white/20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
              {diasCortos.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1">
              {grid.map((fecha, i) => {
                if (!fecha) return <span key={`pad-${i}`} />
                const habilitado = fecha >= todayIso()
                const activo = fecha === value
                const esHoy = fecha === todayIso()
                const dayNum = Number(fecha.split('-')[2])
                return (
                  <button
                    key={fecha}
                    type="button"
                    disabled={!habilitado}
                    onClick={() => {
                      onChange(fecha)
                      setAbierto(false)
                    }}
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
      )}
    </div>
  )
}

type Estado = 'Reportó' | 'Pendiente' | 'No reportó'
type Tab = 'general' | 'diario'

type Usuario = {
  id: string
  nombre: string
  equipo: string | null
  activo: boolean
}

type Curso = {
  id: string
  nombre: string
}

type Inscripcion = {
  userId: string
  cursoId: string
}

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

type Avance = {
  userId: string
  cursoId: string
  fecha: string
  lecciones: number
  aprendizaje: string
  creadoEn: Timestamp | null
}

type Fila = {
  key: string
  fecha: string
  userId: string
  colaborador: string
  equipo: string | null
  curso: string
  horaMin: number
  horario: string
  duracionMin: number
  estado: Estado
  lecciones: number | null
  aprendizaje: string | null
  reporte: string | null
}

function horarioKey(cursoId: string, userId: string): string {
  return `${cursoId}_${userId}`
}

const estadoStyles: Record<Estado, string> = {
  Reportó:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Pendiente: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  'No reportó': 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
}

const railStyles: Record<Estado, string> = {
  Reportó: 'bg-emerald-500',
  Pendiente: 'bg-amber-500',
  'No reportó': 'bg-red-500',
}

function formatFechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function horaAMin(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function finDeAnioIso(): string {
  return `${new Date().getFullYear()}-12-31`
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  const letras = partes.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return letras || '?'
}

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

// Racha de cumplimiento no tiene una definición de dato real todavía (requeriría
// historial agregado por colaborador); se deja como dato de prueba a propósito.
const RACHA_PRUEBA_DIAS = 12

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('general')
  const [fecha, setFecha] = useState(todayIso())
  const [verAnio, setVerAnio] = useState(false)
  const [equipo, setEquipo] = useState('Todas')
  const [estado, setEstado] = useState('Todos')

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cursosPorId, setCursosPorId] = useState<Record<string, Curso>>({})
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [horariosPorKey, setHorariosPorKey] = useState<Record<string, Horario>>({})
  const [avances, setAvances] = useState<Avance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      setUsuarios(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            nombre: (data.nombre as string) ?? '',
            equipo: (data.equipo as string) ?? null,
            activo: data.activo !== false,
          }
        }),
      )
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'cursos'), (snap) => {
      const map: Record<string, Curso> = {}
      snap.docs.forEach((d) => {
        map[d.id] = { id: d.id, nombre: (d.data().nombre as string) ?? d.id }
      })
      setCursosPorId(map)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collectionGroup(db, 'inscripciones'), (snap) => {
      setInscripciones(
        snap.docs
          .map((d) => {
            const userId = d.data().userId as string | undefined
            const cursoId = d.ref.parent.parent?.id
            return userId && cursoId ? { userId, cursoId } : null
          })
          .filter((v): v is Inscripcion => v !== null),
      )
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'horarios'), (snap) => {
      const map: Record<string, Horario> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        const userId = data.userId as string | undefined
        const cursoId = data.cursoId as string | undefined
        if (!userId || !cursoId) return
        map[horarioKey(cursoId, userId)] = {
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
      setHorariosPorKey(map)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'avances'), (snap) => {
      setAvances(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            userId: (data.userId as string) ?? '',
            cursoId: (data.cursoId as string) ?? '',
            fecha: (data.fecha as string) ?? '',
            lecciones: (data.lecciones as number) ?? 0,
            aprendizaje: (data.aprendizaje as string) ?? '',
            creadoEn: (data.creadoEn as Timestamp | undefined) ?? null,
          }
        }),
      )
    })
  }, [])

  const usuariosPorId = useMemo(() => {
    const map: Record<string, Usuario> = {}
    usuarios.forEach((u) => {
      map[u.id] = u
    })
    return map
  }, [usuarios])

  const cantidadCursosPorUsuario = useMemo(() => {
    const map: Record<string, number> = {}
    inscripciones.forEach((insc) => {
      map[insc.userId] = (map[insc.userId] ?? 0) + 1
    })
    return map
  }, [inscripciones])

  function filasEnRango(desdeIso: string, hastaIso: string): Fila[] {
    return inscripciones
      .flatMap((insc): Fila[] => {
        const horario = horariosPorKey[horarioKey(insc.cursoId, insc.userId)]
        if (!horario || !horario.hora) return []
        const ocurrencias = ocurrenciasEntre(horario, desdeIso, hastaIso)
        if (ocurrencias.length === 0) return []

        const user = usuariosPorId[insc.userId]
        const curso = cursosPorId[insc.cursoId]
        if (!user || !curso) return []

        return ocurrencias.map((diaIso): Fila => {
          const avance = avances
            .filter((a) => a.userId === insc.userId && a.cursoId === insc.cursoId && a.fecha === diaIso)
            .sort((a, b) => (b.creadoEn?.toMillis() ?? 0) - (a.creadoEn?.toMillis() ?? 0))[0]

          const estadoFila: Estado = avance ? 'Reportó' : diaIso < todayIso() ? 'No reportó' : 'Pendiente'
          const reporteHora = avance?.creadoEn
            ? avance.creadoEn.toDate().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
            : null

          return {
            key: `${horarioKey(insc.cursoId, insc.userId)}_${diaIso}`,
            fecha: diaIso,
            userId: insc.userId,
            colaborador: user.nombre,
            equipo: user.equipo,
            curso: curso.nombre,
            horaMin: horaAMin(horario.hora as string),
            horario: formatHora(horario.hora),
            duracionMin: horario.duracionMin ?? 60,
            estado: estadoFila,
            lecciones: avance?.lecciones ?? null,
            aprendizaje: avance?.aprendizaje ?? null,
            reporte: reporteHora,
          }
        })
      })
      .sort((a, b) => (a.fecha === b.fecha ? a.horaMin - b.horaMin : a.fecha.localeCompare(b.fecha)))
  }

  const filasFecha = useMemo(
    () => (verAnio ? filasEnRango(todayIso(), finDeAnioIso()) : filasEnRango(fecha, fecha)),
    [fecha, verAnio, inscripciones, horariosPorKey, usuariosPorId, cursosPorId, avances],
  )

  const filtradas = filasFecha.filter((f) => {
    const matchEquipo = equipo === 'Todas' || f.equipo === equipo
    const matchEstado = estado === 'Todos' || f.estado === estado
    return matchEquipo && matchEstado
  })

  const programadas = filtradas.length
  const reportaron = filtradas.filter((f) => f.estado === 'Reportó').length
  const pendientes = filtradas.filter((f) => f.estado === 'Pendiente').length
  const noReportaron = filtradas.filter((f) => f.estado === 'No reportó').length
  const porcentaje = programadas > 0 ? Math.round((reportaron / programadas) * 100) : 0

  const filasHoy = useMemo(
    () => filasEnRango(todayIso(), todayIso()),
    [inscripciones, horariosPorKey, usuariosPorId, cursosPorId, avances],
  )

  const ahoraMin = useMemo(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  }, [])

  const enCurso = filasHoy.filter(
    (f) => f.estado === 'Pendiente' && f.horaMin <= ahoraMin && ahoraMin < f.horaMin + f.duracionMin,
  ).length
  const proxima =
    filasHoy.find((f) => f.estado === 'Pendiente' && f.horaMin > ahoraMin) ?? null
  const completadasHoy = filasHoy.filter((f) => f.estado === 'Reportó').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tab === 'general' && verAnio
              ? `Desde hoy hasta ${formatFechaCorta(finDeAnioIso())}`
              : formatFechaLarga(fecha)}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setTab('general')}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'general'
              ? 'border-blue-600 text-blue-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Dashboard general
        </button>
        <button
          type="button"
          onClick={() => setTab('diario')}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'diario'
              ? 'border-blue-600 text-blue-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Diario
        </button>
      </div>

      {tab === 'general' ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="group rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-2 flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                <CalendarDays className="h-4 w-4" />
                <p className="text-xs font-medium tracking-wide">Programadas</p>
              </div>
              <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{programadas}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 transition-shadow hover:shadow-md dark:border-emerald-500/10 dark:bg-emerald-500/10">
              <div className="mb-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-xs font-medium tracking-wide">Reportaron</p>
              </div>
              <p className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{reportaron}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 transition-shadow hover:shadow-md dark:border-amber-500/10 dark:bg-amber-500/10">
              <div className="mb-2 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlarmClockCheck className="h-4 w-4" />
                <p className="text-xs font-medium tracking-wide">Pendientes</p>
              </div>
              <p className="text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{pendientes}</p>
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 transition-shadow hover:shadow-md dark:border-red-500/10 dark:bg-red-500/10">
              <div className="mb-2 flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                <p className="text-xs font-medium tracking-wide">No reportaron</p>
              </div>
              <p className="text-3xl font-bold tabular-nums text-red-700 dark:text-red-400">{noReportaron}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 transition-shadow hover:shadow-md dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <div className="mb-2 flex items-center gap-1.5 text-blue-600 dark:text-indigo-400">
                <Gauge className="h-4 w-4" />
                <p className="text-xs font-medium tracking-wide">Porcentaje de reporte</p>
              </div>
              <p className="text-3xl font-bold tabular-nums text-blue-700 dark:text-indigo-300">{porcentaje}%</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Fecha
                </label>
                <div className="flex items-stretch gap-1.5">
                  <FechaCalendario
                    value={fecha}
                    disabled={verAnio}
                    onChange={(f) => setFecha(f < todayIso() ? todayIso() : f)}
                  />
                  <div className="flex flex-col overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
                    <button
                      type="button"
                      title="Un día después"
                      disabled={verAnio}
                      onClick={() => setFecha((f) => addDays(f, 1))}
                      className="flex h-[19px] w-8 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Un día antes"
                      disabled={verAnio || fecha === todayIso()}
                      onClick={() => setFecha((f) => (f === todayIso() ? f : addDays(f, -1)))}
                      className="flex h-[19px] w-8 items-center justify-center border-t border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-indigo-400 dark:disabled:text-gray-700"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <span className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Rango
                </span>
                <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={verAnio}
                    onChange={(e) => setVerAnio(e.target.checked)}
                    className="h-4 w-4 accent-blue-600 dark:accent-indigo-500"
                  />
                  Ver todo el año
                </label>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Equipo / Línea de negocio
                </label>
                <select
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option>Todas</option>
                  <option>Educación Continua</option>
                  <option>Unimetab</option>
                  <option>Academia</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option>Todos</option>
                  <option>Reportó</option>
                  <option>Pendiente</option>
                  <option>No reportó</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFecha(todayIso())
                  setVerAnio(false)
                  setEquipo('Todas')
                  setEstado('Todos')
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-500">
                    <th className="px-5 py-3 font-semibold">Colaborador</th>
                    <th className="px-5 py-3 font-semibold">Equipo</th>
                    <th className="px-5 py-3 font-semibold">Curso</th>
                    {verAnio && <th className="px-5 py-3 font-semibold">Fecha</th>}
                    <th className="px-5 py-3 font-semibold">Horario</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold">Lecciones</th>
                    <th className="px-5 py-3 font-semibold">Aprendizaje</th>
                    <th className="px-5 py-3 font-semibold">Reporte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        <td colSpan={verAnio ? 9 : 8} className="px-5 py-4">
                          <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                        </td>
                      </tr>
                    ))
                  ) : filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={verAnio ? 9 : 8} className="px-5 py-12">
                        <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                          <Inbox className="h-8 w-8" />
                          <p className="text-sm">
                            {verAnio
                              ? 'No hay sesiones programadas de hoy en adelante.'
                              : 'No hay sesiones programadas para esta fecha.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtradas.map((f) => (
                      <tr key={f.key} className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                        <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                          <span className="inline-flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                              {iniciales(f.colaborador)}
                            </span>
                            {f.colaborador}
                            {(cantidadCursosPorUsuario[f.userId] ?? 0) > 1 && (
                              <span
                                title={`${cantidadCursosPorUsuario[f.userId]} cursos asociados`}
                                className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                              >
                                {cantidadCursosPorUsuario[f.userId]} cursos
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.equipo ?? '–'}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.curso}</td>
                        {verAnio && (
                          <td className="px-5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                            {formatFechaCorta(f.fecha)}
                          </td>
                        )}
                        <td className="px-5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {f.horario}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estadoStyles[f.estado]}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {f.estado}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                          {f.lecciones ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                          {f.aprendizaje ?? '—'}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-gray-400 dark:text-gray-500">
                          {f.reporte ?? '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-1 flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                <ListChecks className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Sesiones hoy</p>
              </div>
              <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{filasHoy.length}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 transition-shadow hover:shadow-md dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <div className="mb-1 flex items-center gap-1.5 text-blue-500 dark:text-indigo-400">
                <CircleDot className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">En curso ahora</p>
              </div>
              <p className="text-3xl font-bold tabular-nums text-blue-700 dark:text-indigo-300">{enCurso}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 transition-shadow hover:shadow-md dark:border-emerald-500/10 dark:bg-emerald-500/10">
              <div className="mb-1 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ListChecks className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Completadas</p>
              </div>
              <p className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{completadasHoy}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <Flame className="h-4 w-4" />
                  <p className="text-xs font-medium uppercase tracking-wide">Racha de cumplimiento</p>
                </div>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                  Prueba
                </span>
              </div>
              <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{RACHA_PRUEBA_DIAS} días</p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
              ))}
            </div>
          ) : (
            <>
              {proxima && (
                <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                  <Clock className="h-5 w-5 shrink-0 text-blue-600 dark:text-indigo-400" />
                  <p className="text-sm text-blue-800 dark:text-indigo-300">
                    Próxima sesión: <strong className="font-semibold">{proxima.colaborador}</strong> ·{' '}
                    {proxima.curso} a las <strong className="font-semibold">{proxima.horario}</strong>
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Línea de tiempo de hoy
                </h2>
                {filasHoy.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-gray-400 dark:text-gray-500">
                    <Inbox className="h-8 w-8" />
                    <p className="text-sm">No hay sesiones programadas para hoy.</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {filasHoy.map((f) => (
                      <li
                        key={f.key}
                        className="-mx-2 flex gap-3 rounded-xl px-2 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                      >
                        <div className="flex flex-col items-center">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-gray-900 ${railStyles[f.estado]}`}
                          />
                          <span className="w-px flex-1 bg-gray-200 dark:bg-gray-800" />
                        </div>
                        <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pb-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {f.colaborador}{' '}
                              {(cantidadCursosPorUsuario[f.userId] ?? 0) > 1 && (
                                <span
                                  title={`${cantidadCursosPorUsuario[f.userId]} cursos asociados`}
                                  className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                                >
                                  {cantidadCursosPorUsuario[f.userId]} cursos
                                </span>
                              )}{' '}
                              <span className="font-normal text-gray-400 dark:text-gray-500">
                                · {f.equipo ?? '–'}
                              </span>
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{f.curso}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-400">
                              {f.horario}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estadoStyles[f.estado]}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {f.estado}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
