import { useState } from 'react'

type Estado = 'Activo' | 'Inactivo'

type Fila = {
  colaborador: string
  sede: string
  curso: string
  dias: string
  hora: string
  duracion: string
  vigencia: string
  estado: Estado
}

const filas: Fila[] = [
  {
    colaborador: 'Jackie Leguizamón',
    sede: 'Colombia',
    curso: 'Aprendiendo a aprender',
    dias: 'Miércoles',
    hora: '10:00 a.m.',
    duracion: '60 min',
    vigencia: 'Desde 01 jul 2026',
    estado: 'Activo',
  },
  {
    colaborador: 'John Smith',
    sede: 'USA',
    curso: 'Consultor en metabolismo',
    dias: 'Martes, Jueves',
    hora: '2:00 p.m.',
    duracion: '60 min',
    vigencia: 'Desde 15 jun 2026',
    estado: 'Activo',
  },
  {
    colaborador: 'Carlos Ruiz',
    sede: 'CMC Entrenamiento',
    curso: 'CMC Sistema a distancia',
    dias: 'Viernes',
    hora: '9:00 a.m.',
    duracion: '90 min',
    vigencia: 'Desde 01 jul 2026',
    estado: 'Activo',
  },
  {
    colaborador: 'María López',
    sede: 'Colombia',
    curso: 'Liderazgo efectivo',
    dias: 'Lunes, Jueves',
    hora: '8:00 a.m.',
    duracion: '60 min',
    vigencia: 'Desde 10 jul 2026',
    estado: 'Inactivo',
  },
  {
    colaborador: 'Laura Peña',
    sede: 'CMC Entrenamiento',
    curso: 'Programa de Ética',
    dias: 'Viernes',
    hora: '3:00 p.m.',
    duracion: '45 min',
    vigencia: 'Desde 20 jul 2026',
    estado: 'Activo',
  },
]

const estadoStyles: Record<Estado, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

export default function Horarios() {
  const [sede, setSede] = useState('Todas')
  const [colaborador, setColaborador] = useState('Todos')
  const [estado, setEstado] = useState('Todos')

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
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Datos de demostración
        </span>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-4">
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
              Colaborador
            </label>
            <select
              value={colaborador}
              onChange={(e) => setColaborador(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option>Todos</option>
              {filas.map((f) => (
                <option key={f.colaborador}>{f.colaborador}</option>
              ))}
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
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
          </div>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            Filtrar
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
                <th className="px-5 py-3 font-semibold">Días</th>
                <th className="px-5 py-3 font-semibold">Hora</th>
                <th className="px-5 py-3 font-semibold">Duración</th>
                <th className="px-5 py-3 font-semibold">Vigencia</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3" />
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
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.dias}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                    {f.hora}
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.duracion}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-gray-400 dark:text-gray-500">
                    {f.vigencia}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estadoStyles[f.estado]}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {f.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Editar
                    </button>
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
