import { useState } from 'react'

type Estado = 'Reportó' | 'Pendiente' | 'No reportó'

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

export default function Dashboard() {
  const [fecha, setFecha] = useState('2026-08-07')
  const [sede, setSede] = useState('Todas')
  const [estado, setEstado] = useState('Todos')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Miércoles, 7 de agosto de 2026
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Datos de demostración
        </span>
      </div>

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
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
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
              setFecha('2026-08-07')
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
    </div>
  )
}
