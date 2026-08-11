const cursosActuales = [
  { nombre: 'Aprendiendo a aprender', estado: 'En progreso · Curso actual', progreso: 58 },
  { nombre: 'Integridad Personal', estado: 'Asignado · Curso a seguir', progreso: 0 },
]

const proximasSesiones = [
  { nombre: 'Aprendiendo a aprender', fecha: 'Mié 14 ago · 10:00 a.m.' },
  { nombre: 'Aprendiendo a aprender', fecha: 'Mié 21 ago · 10:00 a.m.' },
  { nombre: 'Integridad Personal', fecha: 'Vie 23 ago · 09:00 a.m.' },
]

const ultimosReportes = [
  {
    fecha: '31 jul 2026',
    curso: 'Aprendiendo a aprender',
    lecciones: 3,
    aprendizaje: 'Aprendí a hacer mapas mentales antes de leer.',
  },
  {
    fecha: '24 jul 2026',
    curso: 'Aprendiendo a aprender',
    lecciones: 2,
    aprendizaje: 'La técnica de repaso espaciado me ayudó a retener.',
  },
  {
    fecha: '17 jul 2026',
    curso: 'Aprendiendo a aprender',
    lecciones: 4,
    aprendizaje: 'Identifiqué mis horas de mayor concentración.',
  },
]

type MiPanelProps = {
  readonly nombre: string | null
  readonly onRegistrarAvance: () => void
}

export default function MiPanel({ nombre, onRegistrarAvance }: MiPanelProps) {
  const primerNombre = nombre?.split(' ')[0] ?? 'Usuario'
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hola, {primerNombre}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Miércoles, 7 de agosto de 2026 · Sede Colombia
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Datos de demostración
        </span>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-400 p-6 text-white shadow-sm dark:from-indigo-500 dark:to-indigo-400">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-blue-100 uppercase dark:text-indigo-100">
              Tu próxima sesión
            </p>
            <h2 className="mt-1 text-xl font-bold">Aprendiendo a aprender</h2>
            <p className="mt-1 text-sm text-blue-50 dark:text-indigo-50">Hoy · 10:00 a. m. – 11:00 a. m.</p>
            <p className="text-xs text-blue-100 dark:text-indigo-100">
              Duración estimada: 60 minutos · Recordatorio 15 min antes
            </p>
          </div>
          <button
            type="button"
            onClick={onRegistrarAvance}
            className="w-fit rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50 dark:text-indigo-600 dark:hover:bg-indigo-50"
          >
            Registrar avance →
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
            Cursos actuales
          </p>
          <div className="flex flex-col gap-4">
            {cursosActuales.map((c) => (
              <div key={c.nombre}>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{c.nombre}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.estado}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {c.progreso}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 dark:bg-indigo-500"
                    style={{ width: `${c.progreso}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
            Próximas sesiones
          </p>
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {proximasSesiones.map((s, i) => (
              <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">{s.nombre}</span>
                <span className="text-gray-500 dark:text-gray-400">{s.fecha}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
          Últimos reportes
        </p>
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
              {ultimosReportes.map((r, i) => (
                <tr key={i}>
                  <td className="py-2.5 pr-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {r.fecha}
                  </td>
                  <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-gray-100">
                    {r.curso}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{r.lecciones}</td>
                  <td className="py-2.5 text-gray-500 dark:text-gray-400">{r.aprendizaje}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
