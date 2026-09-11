import { useState, type FormEvent } from 'react'
import { User, Mail, ShieldCheck, KeyRound, Lock, Eye, EyeOff, CheckCircle2, TriangleAlert } from 'lucide-react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { auth } from './firebase'

type MiPerfilProps = {
  readonly nombre: string | null
  readonly email: string | null
  readonly rol: 'Admin' | 'Usuario'
  readonly puedeCambiarPassword: boolean
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  const letras = partes.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return letras || '?'
}

export default function MiPerfil({ nombre, email, rol, puedeCambiarPassword }: MiPerfilProps) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarActual, setMostrarActual] = useState(false)
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)

  const nombreMostrado = nombre ?? 'Colaborador'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setExito(false)

    const nuevaValida = nueva.length >= 8 && /\d/.test(nueva)
    if (!actual || !nuevaValida || !confirmar) {
      setError(
        !nuevaValida && nueva.length > 0
          ? 'La nueva contraseña debe tener al menos 8 caracteres y un número.'
          : 'Completá todos los campos.',
      )
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      const user = auth.currentUser
      if (!user?.email) throw new Error('sin-sesion')
      const credential = EmailAuthProvider.credential(user.email, actual)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, nueva)
      setExito(true)
      setActual('')
      setNueva('')
      setConfirmar('')
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? 'La contraseña actual es incorrecta.'
          : 'No se pudo cambiar la contraseña. Intentá de nuevo.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mi perfil</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Tu información de cuenta y seguridad</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            {iniciales(nombreMostrado)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{nombreMostrado}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Datos de la cuenta</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 border-t border-gray-100 pt-5 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Nombre</p>
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{nombreMostrado}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Correo</p>
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{email ?? '–'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Rol</p>
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{rol}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Cambiar contraseña</h2>
        </div>

        {!puedeCambiarPassword ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Solicitá permiso al administrador para cambiar tu contraseña.</p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Por seguridad, confirmá tu contraseña actual para cambiarla.
          </p>
        )}

        <fieldset disabled={!puedeCambiarPassword} className="contents">
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div>
              <label htmlFor="actual" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Contraseña actual
              </label>
              <div className="relative mt-1">
                <input
                  id="actual"
                  type={mostrarActual ? 'text' : 'password'}
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:disabled:bg-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setMostrarActual((v) => !v)}
                  disabled={!puedeCambiarPassword}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:hover:text-gray-400 dark:hover:text-gray-300"
                >
                  {mostrarActual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="nueva" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Nueva contraseña
              </label>
              <div className="relative mt-1">
                <input
                  id="nueva"
                  type={mostrarNueva ? 'text' : 'password'}
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:disabled:bg-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setMostrarNueva((v) => !v)}
                  disabled={!puedeCambiarPassword}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:hover:text-gray-400 dark:hover:text-gray-300"
                >
                  {mostrarNueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmar" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirmar nueva contraseña
              </label>
              <input
                id="confirmar"
                type={mostrarNueva ? 'text' : 'password'}
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:disabled:bg-gray-900"
              />
            </div>

            {error && (
              <p className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            {exito && (
              <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Contraseña actualizada correctamente.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!puedeCambiarPassword || submitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {submitting ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </form>
        </fieldset>
      </div>
    </div>
  )
}
