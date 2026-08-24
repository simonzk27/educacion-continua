import { useEffect, useState, type FormEvent } from 'react'
import { BellRing, CheckCircle2, Info } from 'lucide-react'
import { doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import { db } from './firebase'

const opcionesMinutos = [
  { valor: 15, etiqueta: '15 minutos antes' },
  { valor: 30, etiqueta: '30 minutos antes' },
  { valor: 60, etiqueta: '1 hora antes' },
  { valor: 120, etiqueta: '2 horas antes' },
  { valor: 1440, etiqueta: '1 día antes' },
]

type ConfigAlertas = {
  activo: boolean
  minutosAntes: number
  actualizadoEn: Timestamp | null
}

type AlertasProps = {
  readonly userId: string
}

export default function Alertas({ userId }: AlertasProps) {
  const [config, setConfig] = useState<ConfigAlertas>({ activo: false, minutosAntes: 30, actualizadoEn: null })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'alertas'), (snap) => {
      const data = snap.data()
      if (data) {
        setConfig({
          activo: data.activo ?? false,
          minutosAntes: (data.minutosAntes as number) ?? 30,
          actualizadoEn: (data.actualizadoEn as Timestamp | undefined) ?? null,
        })
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await setDoc(doc(db, 'config', 'alertas'), {
        activo: config.activo,
        minutosAntes: config.minutosAntes,
        actualizadoEn: serverTimestamp(),
        actualizadoPor: userId,
      })
      setToast('Configuración guardada correctamente.')
    } catch {
      setToast(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Alertas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configurá con cuánto tiempo de anticipación se avisa por correo de una sesión próxima.
          Aplica a todos los cursos.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Esta pantalla guarda la configuración. El envío automático de correos todavía no está
          conectado — requiere un proceso programado en el servidor (Cloud Function) y un
          proveedor de correo, que aún no está implementado.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Cargando...</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 px-3.5 py-3 dark:border-gray-800">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <BellRing className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              Activar alertas por correo
            </span>
            <input
              type="checkbox"
              checked={config.activo}
              onChange={(e) => setConfig({ ...config, activo: e.target.checked })}
              className="h-5 w-5 accent-blue-600 dark:accent-indigo-500"
            />
          </label>

          <div>
            <label
              htmlFor="minutosAntes"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Enviar recordatorio
            </label>
            <select
              id="minutosAntes"
              disabled={!config.activo}
              value={config.minutosAntes}
              onChange={(e) => setConfig({ ...config, minutosAntes: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              {opcionesMinutos.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Se aplica a las sesiones programadas de todos los cursos. Solo reciben el correo
              los colaboradores marcados como Activo en Colaboradores.
            </p>
          </div>

          {config.actualizadoEn && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Última actualización:{' '}
              {config.actualizadoEn.toDate().toLocaleString('es-CO', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {submitting ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </form>
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
