import { useState } from 'react'
import { ChevronUp, ChevronDown, Clock, Flame, ListChecks, CircleDot } from 'lucide-react'

type Estado = 'Reportó' | 'Pendiente' | 'No reportó'
type Tab = 'general' | 'diario'

type Fila = {
  colaborador: string
  sede: string
  curso: string
  horario: string
  estado: Estado
  lecciones: number | null
  aprendizaje: string | null
  reporte: string | null
}

const filas: Fila[] = [
  {
    colaborador: 'Jackie Leguizamón',
    sede: 'Colombia',
    curso: 'Aprendiendo a aprender',
    horario: '10:00 a.m.',
    estado: 'Reportó',
    lecciones: 3,
    aprendizaje: 'Bloques de estudio espaciados.',
    reporte: '10:52 a.m.',
  },
  {
    colaborador: 'John Smith',
    sede: 'USA',
    curso: 'Curso consultor certificado en el metabolismo',
    horario: '2:00 p.m.',
    estado: 'Pendiente',
    lecciones: null,
    aprendizaje: null,
    reporte: null,
  },
  {
    colaborador: 'Carlos Ruiz',
    sede: 'CMC Entrenamiento',
    curso: 'Curso CMC Sistema a distancia',
    horario: '9:00 a.m.',
    estado: 'Reportó',
    lecciones: 5,
    aprendizaje: 'Terminé el módulo de nutrición básica.',
    reporte: '10:14 a.m.',
  },
  {
    colaborador: 'María López',
    sede: 'Colombia',
    curso: 'Liderazgo efectivo',
    horario: '8:00 a.m.',
    estado: 'No reportó',
    lecciones: null,
    aprendizaje: null,
    reporte: null,
  },
  {
    colaborador: 'David Turner',
    sede: 'USA',
    curso: 'Integridad Personal',
    horario: '11:00 a.m.',
    estado: 'Reportó',
    lecciones: 2,
    aprendizaje: 'Reflexión sobre coherencia y hábitos.',
    reporte: '12:30 p.m.',
  },
  {
    colaborador: 'Laura Peña',
    sede: 'CMC Entrenamiento',
    curso: 'Programa de Ética',
    horario: '3:00 p.m.',
    estado: 'Pendiente',
    lecciones: null,
    aprendizaje: null,
    reporte: null,
  },
  {
    colaborador: 'Kevin Brooks',
    sede: 'USA',
    curso: 'Cómo llevarse bien con los demás',
    horario: '1:00 p.m.',
    estado: 'Reportó',
    lecciones: 4,
    aprendizaje: 'Escucha activa en conversaciones difíciles.',
    reporte: '2:05 p.m.',
  },
  {
    colaborador: 'Sofía Ramírez',
    sede: 'Colombia',
    curso: 'Unimetab Tiroides, problemas y soluciones',
    horario: '4:00 p.m.',
    estado: 'Reportó',
    lecciones: 6,
    aprendizaje: 'Repaso de casos clínicos de tiroides.',
    reporte: '5:20 p.m.',
  },
]

const programadas = filas.length
const reportaron = filas.filter((f) => f.estado === 'Reportó').length
const pendientes = filas.filter((f) => f.estado === 'Pendiente').length
const noReportaron = filas.filter((f) => f.estado === 'No reportó').length
const porcentaje = Math.round((reportaron / programadas) * 100)

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

function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayIso(): string {
  return dateToIso(new Date())
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return dateToIso(dt)
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

// Hora fija de referencia para simular "ahora" en los datos de demostración del tab Diario.
const AHORA_MIN = 12 * 60 + 30

const HORA_RE = /(\d{1,2}):(\d{2})\s([ap])\.m\./i

function horaToMin(horario: string): number {
  const match = HORA_RE.exec(horario)
  if (!match) return 0
  let h = Number(match[1])
  const min = Number(match[2])
  const pm = match[3].toLowerCase() === 'p'
  if (pm && h !== 12) h += 12
  if (!pm && h === 12) h = 0
  return h * 60 + min
}

const filasOrdenadas = [...filas].sort((a, b) => horaToMin(a.horario) - horaToMin(b.horario))
const enCurso = filasOrdenadas.filter((f) => {
  const inicio = horaToMin(f.horario)
  return f.estado === 'Pendiente' && inicio <= AHORA_MIN && AHORA_MIN < inicio + 60
}).length
const proxima = filasOrdenadas.find((f) => horaToMin(f.horario) > AHORA_MIN) ?? null
const rachaDias = 12

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('general')
  const [fecha, setFecha] = useState(todayIso())
  const [sede, setSede] = useState('Todas')
  const [estado, setEstado] = useState('Todos')

  const enHoy = fecha === todayIso()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{formatFechaLarga(fecha)}</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Datos de demostración
        </span>
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
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{programadas}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Programadas</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-500/10">
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{reportaron}</p>
              <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80">Reportaron</p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-5 dark:bg-amber-500/10">
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{pendientes}</p>
              <p className="text-sm text-amber-700/80 dark:text-amber-400/80">Pendientes</p>
            </div>
            <div className="rounded-2xl bg-red-50 p-5 dark:bg-red-500/10">
              <p className="text-3xl font-bold text-red-700 dark:text-red-400">{noReportaron}</p>
              <p className="text-sm text-red-700/80 dark:text-red-400/80">No reportaron</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{porcentaje}%</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Porcentaje de reporte</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Fecha
                </label>
                <div className="flex items-stretch gap-1.5">
                  <input
                    type="date"
                    value={fecha}
                    min={todayIso()}
                    onChange={(e) => setFecha(e.target.value < todayIso() ? todayIso() : e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                  <div className="flex flex-col overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
                    <button
                      type="button"
                      title="Un día después"
                      onClick={() => setFecha((f) => addDays(f, 1))}
                      className="flex h-[19px] w-8 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Un día antes"
                      disabled={enHoy}
                      onClick={() => setFecha((f) => (f === todayIso() ? f : addDays(f, -1)))}
                      className="flex h-[19px] w-8 items-center justify-center border-t border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-indigo-400 dark:disabled:text-gray-700"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Sede
                </label>
                <select
                  value={sede}
                  onChange={(e) => setSede(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option>Todas</option>
                  <option>Colombia</option>
                  <option>USA</option>
                  <option>CMC Entrenamiento</option>
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
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                Filtrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setFecha(todayIso())
                  setSede('Todas')
                  setEstado('Todos')
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                    <th className="px-5 py-3 font-semibold">Colaborador</th>
                    <th className="px-5 py-3 font-semibold">Sede</th>
                    <th className="px-5 py-3 font-semibold">Curso</th>
                    <th className="px-5 py-3 font-semibold">Horario</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3 font-semibold">Lecciones</th>
                    <th className="px-5 py-3 font-semibold">Aprendizaje</th>
                    <th className="px-5 py-3 font-semibold">Reporte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filas.map((f) => (
                    <tr key={f.colaborador}>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        {f.colaborador}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.sede}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.curso}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-1 flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                <ListChecks className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Sesiones hoy</p>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{programadas}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <div className="mb-1 flex items-center gap-1.5 text-blue-500 dark:text-indigo-400">
                <CircleDot className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">En curso ahora</p>
              </div>
              <p className="text-3xl font-bold text-blue-700 dark:text-indigo-300">{enCurso}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-500/10">
              <div className="mb-1 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <ListChecks className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Completadas</p>
              </div>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{reportaron}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-1 flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                <Flame className="h-4 w-4" />
                <p className="text-xs font-medium uppercase tracking-wide">Racha de cumplimiento</p>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{rachaDias} días</p>
            </div>
          </div>

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
            <ul className="flex flex-col gap-4">
              {filasOrdenadas.map((f) => (
                <li key={f.colaborador} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`h-2.5 w-2.5 rounded-full ${railStyles[f.estado]}`} />
                    <span className="w-px flex-1 bg-gray-200 dark:bg-gray-800" />
                  </div>
                  <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pb-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {f.colaborador}{' '}
                        <span className="font-normal text-gray-400 dark:text-gray-500">· {f.sede}</span>
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
          </div>
        </>
      )}
    </div>
  )
}
