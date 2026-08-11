import { useState, type FormEvent } from 'react'
import { signInWithEmailAndPassword, type AuthError } from 'firebase/auth'
import { AlertCircle, Loader2 } from 'lucide-react'
import { auth } from './firebase'

const errorMessages: Record<string, string> = {
  'auth/invalid-email': 'Correo inválido.',
  'auth/invalid-credential': 'Revisá tus credenciales, correo o contraseña incorrectos.',
  'auth/user-disabled': 'Esta cuenta fue deshabilitada.',
  'auth/too-many-requests': 'Demasiados intentos. Probá de nuevo en unos minutos.',
}

type LoginProps = {
  readonly blockedMessage?: string | null
}

function Login({ blockedMessage }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(blockedMessage ?? null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      const code = (err as AuthError).code
      setError(errorMessages[code] ?? 'No se pudo iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-12 bg-gradient-to-br from-blue-100 via-white to-sky-100 px-4 dark:from-gray-950 dark:via-gray-950 dark:to-indigo-950/40">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
          Sistema Gestión Educativa
        </h1>
        <p className="mt-3 text-lg text-gray-500 dark:text-gray-400">Ingresá con tu cuenta</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/80"
      >
        <div className="flex flex-col gap-4">
          <div className="text-left">
            <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              disabled={submitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@gmail.com"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            />
          </div>
          <div className="text-left">
            <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              disabled={submitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            />
          </div>

          {error && (
            <div
              key={error}
              className="animate-shake animate-fade-in flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Login
