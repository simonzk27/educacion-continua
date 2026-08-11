import { useState } from 'react'

const sesion = {
  curso: 'Aprendiendo a aprender',
  horario: '10:00 a. m.',
  fecha: '7 ago 2026',
}

export default function RegistrarAvance() {
  const [fecha, setFecha] = useState('2026-08-07')
  const [horaInicio, setHoraInicio] = useState('10:00')
  const [horaFin, setHoraFin] = useState('11:00')
  const [lecciones, setLecciones] = useState('3')
  const [leccionInicial, setLeccionInicial] = useState('')
  const [leccionFinal, setLeccionFinal] = useState('')
  const [aprendizaje, setAprendizaje] = useState('')
  const [comentario, setComentario] = useState('')
  const [guardado, setGuardado] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setGuardado(true)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Registrar avance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Completa este formulario en menos de un minuto
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
              Curso
            </p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{sesion.curso}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
              Horario
            </p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{sesion.horario}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
              Fecha
            </p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{sesion.fecha}</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div>
          <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            Confirma el día y horario de tu sesión
          </p>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <p className="mt-2 text-xs text-gray-400 italic dark:text-gray-500">
            Ajusta el día u horario si tu sesión ocurrió en otro momento.
          </p>
        </div>

        <hr className="border-gray-100 dark:border-gray-800" />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            ¿Cuántas lecciones avanzaste hoy?
          </label>
          <input
            type="number"
            min={0}
            value={lecciones}
            onChange={(e) => setLecciones(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Lección inicial <span className="font-normal text-gray-400 dark:text-gray-500">(opcional)</span>
            </label>
            <input
              type="number"
              min={0}
              value={leccionInicial}
              onChange={(e) => setLeccionInicial(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Lección final <span className="font-normal text-gray-400 dark:text-gray-500">(opcional)</span>
            </label>
            <input
              type="number"
              min={0}
              value={leccionFinal}
              onChange={(e) => setLeccionFinal(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            ¿Cuál fue tu principal aprendizaje o ganancia de esta sesión?
          </label>
          <textarea
            rows={3}
            maxLength={300}
            value={aprendizaje}
            onChange={(e) => setAprendizaje(e.target.value)}
            placeholder="Entendí cómo..."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {aprendizaje.length}/300
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            Comentario adicional <span className="font-normal text-gray-400 dark:text-gray-500">(opcional)</span>
          </label>
          <textarea
            rows={3}
            maxLength={500}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Algo más que quieras registrar..."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {comentario.length}/500
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          Guardar avance
        </button>

        {guardado && (
          <p className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Avance guardado (simulado).
          </p>
        )}
      </form>
    </div>
  )
}
