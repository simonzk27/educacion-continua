import { useEffect, useMemo, useState } from 'react'
import {
  Clock,
  Flame,
  ListChecks,
  CircleDot,
  CheckCircle2,
  AlarmClockCheck,
  XCircle,
  Gauge,
  Inbox,
  TrendingUp,
  Search,
  X,
} from 'lucide-react'
import { collection, collectionGroup, onSnapshot, type Timestamp } from 'firebase/firestore'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DatePicker from './DatePicker'
import Select from './Select'
import { db } from './firebase'
import { type Dia, type Modo, addDays, dateToIso, formatHora, ocurrenciasEntre, todayIso } from './scheduleUtils'
import Tablero from './Tablero'

type Estado = 'Reportó' | 'Pendiente' | 'No reportó'
type Tab = 'general' | 'diario' | 'tablero'

type Usuario = {
  id: string
  nombre: string
  equipo: string | null
  tipoCurso: string | null
  activo: boolean
}

type Curso = {
  id: string
  nombre: string
  tipo: string
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
  tipoCurso: string | null
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

function horaAMin(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  const letras = partes.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return letras || '?'
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function inicioMesIso(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return dateToIso(new Date(y, m - 1, 1))
}

function finMesIso(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return dateToIso(new Date(y, m, 0))
}

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const el = document.documentElement
    const observer = new MutationObserver(() => setIsDark(el.classList.contains('dark')))
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

function inicioSemanaLunes(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dow)
  return dateToIso(date)
}

// Racha de cumplimiento no tiene una definición de dato real todavía (requeriría
// historial agregado por colaborador); se deja como dato de prueba a propósito.
const RACHA_PRUEBA_DIAS = 12

type DashboardProps = {
  readonly isAdmin: boolean
}

export default function Dashboard({ isAdmin }: DashboardProps) {
  const isDark = useIsDark()
  const axisColor = isDark ? '#9ca3af' : '#6b7280'
  const gridColor = isDark ? '#1f2937' : '#f3f4f6'
  const [tab, setTab] = useState<Tab>('general')
  const [rangoDesde, setRangoDesde] = useState('')
  const [rangoHasta, setRangoHasta] = useState('')
  const [equipo, setEquipo] = useState('Todas')
  const [tipoCurso, setTipoCurso] = useState('Todos')
  const [estado, setEstado] = useState('Todos')
  const [usuarioFiltro, setUsuarioFiltro] = useState('Todos')
  const [busquedaGeneral, setBusquedaGeneral] = useState('')
  const [mostrarTodo, setMostrarTodo] = useState(false)

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
            tipoCurso: (data.tipoCurso as string) ?? null,
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
        const data = d.data()
        map[d.id] = { id: d.id, nombre: (data.nombre as string) ?? d.id, tipo: (data.tipo as string) ?? '' }
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
            tipoCurso: curso.tipo,
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

  const rangoActivo = Boolean(rangoDesde && rangoHasta)

  const filasFecha = useMemo(() => {
    let desde: string
    let hasta: string
    if (rangoActivo) {
      desde = rangoDesde
      hasta = rangoHasta
    } else if (mostrarTodo) {
      desde = addDays(todayIso(), -1825)
      hasta = addDays(todayIso(), 1825)
    } else {
      desde = inicioMesIso(todayIso())
      hasta = finMesIso(todayIso())
    }
    return filasEnRango(desde, hasta)
  }, [
    rangoActivo,
    rangoDesde,
    rangoHasta,
    mostrarTodo,
    inscripciones,
    horariosPorKey,
    usuariosPorId,
    cursosPorId,
    avances,
  ])

  const terminoGeneral = normalizar(busquedaGeneral.trim())
  const filtradas = filasFecha.filter((f) => {
    const matchEquipo = equipo === 'Todas' || f.equipo === equipo
    const matchTipoCurso = tipoCurso === 'Todos' || f.tipoCurso === tipoCurso
    const matchEstado = estado === 'Todos' || f.estado === estado
    const matchUsuario = usuarioFiltro === 'Todos' || f.userId === usuarioFiltro
    const matchGeneral =
      !terminoGeneral ||
      normalizar(f.colaborador).includes(terminoGeneral) ||
      normalizar(f.curso).includes(terminoGeneral)
    return matchEquipo && matchTipoCurso && matchEstado && matchUsuario && matchGeneral
  })

  const usuariosOpciones = useMemo(
    () =>
      [...usuarios]
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map((u) => ({ value: u.id, label: u.nombre })),
    [usuarios],
  )

  const programadas = filtradas.length
  const reportaron = filtradas.filter((f) => f.estado === 'Reportó').length
  const noReportaron = filtradas.filter((f) => f.estado === 'No reportó').length
  const porcentaje = programadas > 0 ? Math.round((reportaron / programadas) * 100) : 0

  function porcentajeReporteEnRango(desde: string, hasta: string): number {
    const rows = filasEnRango(desde, hasta).filter((f) => {
      const matchEquipo = equipo === 'Todas' || f.equipo === equipo
      const matchTipoCurso = tipoCurso === 'Todos' || f.tipoCurso === tipoCurso
      return matchEquipo && matchTipoCurso
    })
    if (rows.length === 0) return 0
    return Math.round((rows.filter((f) => f.estado === 'Reportó').length / rows.length) * 100)
  }

  const tendencia = useMemo(() => {
    const diasPeriodo = rangoActivo
      ? Math.round((new Date(rangoHasta).getTime() - new Date(rangoDesde).getTime()) / 86_400_000) + 1
      : 7
    const actualHasta = rangoActivo ? rangoHasta : todayIso()
    const actualDesde = rangoActivo ? rangoDesde : addDays(todayIso(), -(diasPeriodo - 1))
    const anteriorHasta = addDays(actualDesde, -1)
    const anteriorDesde = addDays(anteriorHasta, -(diasPeriodo - 1))

    const actual = porcentajeReporteEnRango(actualDesde, actualHasta)
    const anterior = porcentajeReporteEnRango(anteriorDesde, anteriorHasta)
    return { actual, anterior, delta: actual - anterior }
  }, [rangoActivo, rangoDesde, rangoHasta, equipo, tipoCurso, inscripciones, horariosPorKey, usuariosPorId, cursosPorId, avances])

  const equipoMenorCumplimiento = useMemo((): { equipo: string; porcentaje: number } | null => {
    const equiposDisponibles = ['Colombia', 'USA']
    const candidatos = equiposDisponibles.flatMap((eq) => {
      const rows = filasFecha.filter((f) => {
        const matchTipoCurso = tipoCurso === 'Todos' || f.tipoCurso === tipoCurso
        return f.equipo === eq && matchTipoCurso
      })
      if (rows.length === 0) return []
      const pct = Math.round((rows.filter((f) => f.estado === 'Reportó').length / rows.length) * 100)
      return [{ equipo: eq, porcentaje: pct }]
    })
    return candidatos.reduce<{ equipo: string; porcentaje: number } | null>(
      (peor, cur) => (!peor || cur.porcentaje < peor.porcentaje ? cur : peor),
      null,
    )
  }, [filasFecha, tipoCurso])

  const leccionesPorSemana = useMemo(() => {
    const semanaActualInicio = inicioSemanaLunes(todayIso())
    const semanas = Array.from({ length: 8 }, (_, i) => addDays(semanaActualInicio, -7 * (7 - i)))
    const totales: Record<string, Record<string, number>> = {}
    semanas.forEach((s) => {
      totales[s] = { 'Educación Continua': 0, Unimetab: 0, Academia: 0 }
    })
    avances.forEach((a) => {
      if (!a.fecha) return
      const semana = inicioSemanaLunes(a.fecha)
      if (!(semana in totales)) return
      const tipo = cursosPorId[a.cursoId]?.tipo
      if (tipo === 'Educación Continua' || tipo === 'Unimetab' || tipo === 'Academia') {
        totales[semana][tipo] += a.lecciones
      }
    })
    return semanas.map((s) => ({
      semana: s,
      label: formatFechaCorta(s),
      ...totales[s],
    }))
  }, [avances, cursosPorId])

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
            {tab === 'tablero'
              ? 'Matriz de colaboradores y cursos'
              : rangoActivo
                ? `Del ${formatFechaCorta(rangoDesde)} al ${formatFechaCorta(rangoHasta)}`
                : mostrarTodo
                  ? 'Todas las sesiones programadas'
                  : 'Sesiones del mes actual'}
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
        <button
          type="button"
          onClick={() => setTab('tablero')}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'tablero'
              ? 'border-blue-600 text-blue-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Tablero
        </button>
      </div>

      {tab === 'tablero' ? (
        <Tablero isAdmin={isAdmin} />
      ) : tab === 'general' ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="group rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-2 flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                <TrendingUp className="h-4 w-4" />
                <p className="text-xs font-medium tracking-wide">Tendencia vs. período anterior</p>
              </div>
              <p
                className={`text-3xl font-bold tabular-nums ${
                  tendencia.delta > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : tendencia.delta < 0
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {tendencia.delta > 0 ? '+' : ''}
                {tendencia.delta}%
              </p>
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
                <p className="text-xs font-medium tracking-wide">Menor cumplimiento</p>
              </div>
              <p className="text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
                {equipoMenorCumplimiento ? `${equipoMenorCumplimiento.porcentaje}%` : '–'}
              </p>
              {equipoMenorCumplimiento && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{equipoMenorCumplimiento.equipo}</p>
              )}
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
            <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Lecciones por semana y tipo de curso · últimas 8 semanas
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leccionesPorSemana} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: gridColor }}
                    contentStyle={{
                      borderRadius: 12,
                      border: 'none',
                      fontSize: 13,
                      backgroundColor: isDark ? '#111827' : '#ffffff',
                      color: isDark ? '#f3f4f6' : '#111827',
                    }}
                    labelFormatter={(label) => `Semana del ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: axisColor }} />
                  <Bar dataKey="Educación Continua" stackId="lecciones" fill="#2563eb" />
                  <Bar dataKey="Unimetab" stackId="lecciones" fill="#f59e0b" />
                  <Bar dataKey="Academia" stackId="lecciones" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-44">
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Desde
                </label>
                <DatePicker value={rangoDesde} onChange={setRangoDesde} maxDate={rangoHasta || undefined} />
              </div>
              <div className="w-44">
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Hasta
                </label>
                <DatePicker value={rangoHasta} onChange={setRangoHasta} minDate={rangoDesde || undefined} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Equipo
                </label>
                <Select
                  value={equipo}
                  onChange={setEquipo}
                  className="w-36"
                  options={['Todas', 'Colombia', 'USA']}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Tipo de curso
                </label>
                <Select
                  value={tipoCurso}
                  onChange={setTipoCurso}
                  className="w-44"
                  options={['Todos', 'Educación Continua', 'Unimetab', 'Academia']}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Estado
                </label>
                <Select
                  value={estado}
                  onChange={setEstado}
                  className="w-36"
                  options={['Todos', 'Reportó', 'Pendiente', 'No reportó']}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Usuario
                </label>
                <Select
                  value={usuarioFiltro}
                  onChange={setUsuarioFiltro}
                  className="w-48"
                  options={[{ value: 'Todos', label: 'Todos' }, ...usuariosOpciones]}
                  searchable
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Buscar
                </label>
                <div className="relative w-56">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaGeneral}
                    onChange={(e) => setBusquedaGeneral(e.target.value)}
                    placeholder="Colaborador o curso..."
                    className="w-full rounded-lg border border-gray-300 py-2 pr-9 pl-9 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                  {busquedaGeneral && (
                    <button
                      type="button"
                      onClick={() => setBusquedaGeneral('')}
                      title="Limpiar búsqueda"
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  &nbsp;
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarTodo((v) => !v)}
                  disabled={rangoActivo}
                  title={
                    rangoActivo
                      ? 'Ya hay un rango de fechas personalizado activo'
                      : mostrarTodo
                        ? 'Mostrando todo el historial'
                        : 'Por defecto solo se muestra el mes actual'
                  }
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    mostrarTodo
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  Mostrar todo
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRangoDesde('')
                  setRangoHasta('')
                  setEquipo('Todas')
                  setTipoCurso('Todos')
                  setUsuarioFiltro('Todos')
                  setEstado('Todos')
                  setBusquedaGeneral('')
                  setMostrarTodo(false)
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:bg-gray-950 dark:text-gray-500">
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Colaborador</th>
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Equipo</th>
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Tipo de curso</th>
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Curso</th>
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Fecha</th>
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Horario</th>
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Estado</th>
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Lecciones</th>
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Aprendizaje</th>
                    <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Reporte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={`skeleton-${i}`}>
                        <td colSpan={10} className="px-5 py-4">
                          <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                        </td>
                      </tr>
                    ))
                  ) : filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12">
                        <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                          <Inbox className="h-8 w-8" />
                          <p className="text-sm">
                            {rangoActivo
                              ? 'No hay sesiones programadas en ese rango de fechas.'
                              : 'No hay sesiones programadas.'}
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
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.tipoCurso ?? '–'}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.curso}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {formatFechaCorta(f.fecha)}
                        </td>
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
