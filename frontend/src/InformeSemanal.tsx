import { Download, Send } from 'lucide-react'

type FilaStaff = {
  colaborador: string
  cursoActual: string
  cursoASeguir: string | null
  horarios: string
  completaciones: number
  lecciones: number
  observaciones: string
}

type Grupo = {
  titulo: string
  filas: FilaStaff[]
}

const grupos: Grupo[] = [
  {
    titulo: 'Staff Colombia',
    filas: [
      {
        colaborador: 'Jackie Leguizamón',
        cursoActual: 'Aprendiendo a aprender',
        cursoASeguir: 'Integridad Personal',
        horarios: 'Mié 10:00',
        completaciones: 1,
        lecciones: 9,
        observaciones: 'Buen ritmo; aplicó repaso espaciado.',
      },
      {
        colaborador: 'María López',
        cursoActual: 'Liderazgo efectivo',
        cursoASeguir: 'Programa de Ética',
        horarios: 'Lun, Jue 08:00',
        completaciones: 0,
        lecciones: 6,
        observaciones: 'Avanza según lo previsto.',
      },
      {
        colaborador: 'Sofía Ramírez',
        cursoActual: 'Unimetab Tiroides',
        cursoASeguir: null,
        horarios: 'Vie 16:00',
        completaciones: 1,
        lecciones: 8,
        observaciones: 'Completó el curso esta semana.',
      },
    ],
  },
  {
    titulo: 'Staff USA',
    filas: [
      {
        colaborador: 'John Smith',
        cursoActual: 'Consultor en metabolismo',
        cursoASeguir: 'Liderazgo efectivo',
        horarios: 'Mar, Jue 14:00',
        completaciones: 1,
        lecciones: 7,
        observaciones: 'Constante en ambas sesiones.',
      },
      {
        colaborador: 'David Turner',
        cursoActual: 'Integridad Personal',
        cursoASeguir: null,
        horarios: 'Mié 11:00',
        completaciones: 0,
        lecciones: 5,
        observaciones: 'Reflexiones sobre hábitos.',
      },
      {
        colaborador: 'Kevin Brooks',
        cursoActual: 'Llevarse bien con los demás',
        cursoASeguir: null,
        horarios: 'Mié 13:00',
        completaciones: 0,
        lecciones: 4,
        observaciones: 'Enfoque en escucha activa.',
      },
    ],
  },
  {
    titulo: 'CMC Entrenamiento',
    filas: [
      {
        colaborador: 'Carlos Ruiz',
        cursoActual: 'CMC Sistema a distancia',
        cursoASeguir: 'Programa de Ética',
        horarios: 'Vie 09:00',
        completaciones: 1,
        lecciones: 5,
        observaciones: 'Terminó el módulo de nutrición.',
      },
      {
        colaborador: 'Laura Peña',
        cursoActual: 'Programa de Ética',
        cursoASeguir: null,
        horarios: 'Vie 15:00',
        completaciones: 0,
        lecciones: 2,
        observaciones: 'Inició la primera unidad.',
      },
    ],
  },
]

const totalCompletaciones = grupos.reduce(
  (sum, g) => sum + g.filas.reduce((s, f) => s + f.completaciones, 0),
  0,
)
const totalLecciones = grupos.reduce(
  (sum, g) => sum + g.filas.reduce((s, f) => s + f.lecciones, 0),
  0,
)

type FilaCumplimiento = {
  colaborador: string
  sede: string
  programadas: number
  realizados: number
  sinReporte: number
}

const cumplimiento: FilaCumplimiento[] = [
  { colaborador: 'Jackie Leguizamón', sede: 'Colombia', programadas: 1, realizados: 1, sinReporte: 0 },
  { colaborador: 'John Smith', sede: 'USA', programadas: 2, realizados: 2, sinReporte: 0 },
  { colaborador: 'María López', sede: 'Colombia', programadas: 2, realizados: 1, sinReporte: 1 },
  { colaborador: 'Carlos Ruiz', sede: 'CMC Entrenamiento', programadas: 1, realizados: 1, sinReporte: 0 },
  { colaborador: 'Laura Peña', sede: 'CMC Entrenamiento', programadas: 1, realizados: 0, sinReporte: 1 },
]

function cumplimientoStyle(pct: number) {
  if (pct >= 100) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
  if (pct > 0) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
  return 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
}

function GrupoTabla({ grupo }: { readonly grupo: Grupo }) {
  const totalG = grupo.filas.reduce(
    (acc, f) => ({
      completaciones: acc.completaciones + f.completaciones,
      lecciones: acc.lecciones + f.lecciones,
    }),
    { completaciones: 0, lecciones: 0 },
  )

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <p className="px-5 pt-4 text-sm font-bold tracking-wide text-blue-600 uppercase dark:text-indigo-400">
        {grupo.titulo}
      </p>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-y border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
              <th className="px-5 py-2.5 font-semibold">Colaborador</th>
              <th className="px-5 py-2.5 font-semibold">Curso actual</th>
              <th className="px-5 py-2.5 font-semibold">Curso a seguir</th>
              <th className="px-5 py-2.5 font-semibold">Horarios</th>
              <th className="px-5 py-2.5 font-semibold">Completaciones</th>
              <th className="px-5 py-2.5 font-semibold">Lecciones</th>
              <th className="px-5 py-2.5 font-semibold">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {grupo.filas.map((f) => (
              <tr key={f.colaborador}>
                <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                  {f.colaborador}
                </td>
                <td className="px-5 py-3 text-blue-600 dark:text-indigo-400">{f.cursoActual}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                  {f.cursoASeguir ?? '—'}
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                  {f.horarios}
                </td>
                <td className="px-5 py-3 font-medium text-blue-600 dark:text-indigo-400">
                  {f.completaciones}
                </td>
                <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{f.lecciones}</td>
                <td className="px-5 py-3 text-gray-400 italic dark:text-gray-500">
                  {f.observaciones}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold text-gray-900 dark:bg-gray-800/60 dark:text-gray-100">
              <td className="px-5 py-3" colSpan={4}>
                Total
              </td>
              <td className="px-5 py-3">{totalG.completaciones}</td>
              <td className="px-5 py-3">{totalG.lecciones}</td>
              <td className="px-5 py-3" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function InformeSemanal() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Informe semanal</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Del 28 de julio al 3 de agosto de 2026
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Download className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <Send className="h-4 w-4" />
            Enviar a gerencia
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-500/10">
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            {totalCompletaciones}
          </p>
          <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80">
            Total completaciones
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-500/10">
          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            {totalLecciones}
          </p>
          <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80">
            Total lecciones / pasos
          </p>
        </div>
      </div>

      {grupos.map((g) => (
        <GrupoTabla key={g.titulo} grupo={g} />
      ))}

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <p className="px-5 pt-4 text-sm font-bold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Cumplimiento gerencial
        </p>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-y border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                <th className="px-5 py-2.5 font-semibold">Colaborador</th>
                <th className="px-5 py-2.5 font-semibold">Sede</th>
                <th className="px-5 py-2.5 font-semibold">Sesiones programadas</th>
                <th className="px-5 py-2.5 font-semibold">Reportes realizados</th>
                <th className="px-5 py-2.5 font-semibold">Sin reporte</th>
                <th className="px-5 py-2.5 font-semibold">% Cumplimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {cumplimiento.map((f) => {
                const pct = Math.round((f.realizados / f.programadas) * 100)
                return (
                  <tr key={f.colaborador}>
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {f.colaborador}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.sede}</td>
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{f.programadas}</td>
                    <td className="px-5 py-3 font-medium text-blue-600 dark:text-indigo-400">
                      {f.realizados}
                    </td>
                    <td className="px-5 py-3 text-gray-900 dark:text-gray-100">{f.sinReporte}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cumplimientoStyle(pct)}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {pct}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="h-4" />
      </div>
    </div>
  )
}
