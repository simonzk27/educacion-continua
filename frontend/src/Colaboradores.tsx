import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, X, CheckCircle2 } from 'lucide-react'
import { createUserWithEmailAndPassword, signOut as secondarySignOut, type AuthError } from 'firebase/auth'
import { collection, doc, setDoc, updateDoc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, getSecondaryAuth, disposeSecondaryApp } from './firebase'

type Rol = 'Admin' | 'Usuario'
type Estado = 'Activo' | 'Inactivo'

type Colaborador = {
  id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
}

const rolToFirestore: Record<Rol, string> = { Admin: 'admin', Usuario: 'usuario' }
const firestoreToRol: Record<string, Rol> = { admin: 'Admin', usuario: 'Usuario' }

const roles: Rol[] = ['Admin', 'Usuario']
const estados: Estado[] = ['Activo', 'Inactivo']

const estadoStyles: Record<Estado, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

const createErrorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'Ese correo ya tiene una cuenta.',
  'auth/invalid-email': 'Correo inválido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
}

const emptyForm = {
  nombre: '',
  email: '',
  password: '',
  rol: '' as Rol | '',
  estado: '' as Estado | '',
}

export default function Colaboradores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('nombre'))
    return onSnapshot(q, (snap) => {
      setColaboradores(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            nombre: data.nombre ?? '',
            email: data.email ?? '',
            rol: firestoreToRol[data.rol] ?? 'Usuario',
            activo: data.activo !== false,
          }
        }),
      )
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  function openCreateModal() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(colaborador: Colaborador) {
    setEditingId(colaborador.id)
    setForm({
      nombre: colaborador.nombre,
      email: colaborador.email,
      password: '',
      rol: colaborador.rol,
      estado: colaborador.activo ? 'Activo' : 'Inactivo',
    })
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (
      !form.nombre.trim() ||
      !form.email.trim() ||
      (!editingId && form.password.length < 6) ||
      !form.rol ||
      !form.estado
    ) {
      setFormError(
        !editingId && form.password.length > 0 && form.password.length < 6
          ? 'La contraseña debe tener al menos 6 caracteres.'
          : 'Completá todos los campos.',
      )
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        await updateDoc(doc(db, 'users', editingId), {
          nombre: form.nombre.trim(),
          rol: rolToFirestore[form.rol],
          activo: form.estado === 'Activo',
        })
        setToast('Colaborador actualizado correctamente.')
      } else {
        const secondaryAuth = getSecondaryAuth()
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), form.password)
          await setDoc(doc(db, 'users', cred.user.uid), {
            nombre: form.nombre.trim(),
            email: form.email.trim(),
            rol: rolToFirestore[form.rol],
            activo: form.estado === 'Activo',
          })
        } finally {
          await secondarySignOut(secondaryAuth)
          await disposeSecondaryApp()
        }
        setToast('Colaborador creado correctamente.')
      }
      closeModal()
    } catch (err) {
      const code = (err as AuthError).code
      setFormError(
        (code && createErrorMessages[code]) ??
          (editingId ? 'No se pudo guardar el colaborador. Intentá de nuevo.' : 'No se pudo crear el colaborador. Intentá de nuevo.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Colaboradores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Administración de usuarios y roles
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex w-fit items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <Plus className="h-4 w-4" />
          Nuevo colaborador
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                <th className="px-5 py-3 font-semibold">Nombre</th>
                <th className="px-5 py-3 font-semibold">Correo</th>
                <th className="px-5 py-3 font-semibold">Rol</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : colaboradores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">
                    No hay colaboradores todavía.
                  </td>
                </tr>
              ) : (
                colaboradores.map((c) => {
                  const estado: Estado = c.activo ? 'Activo' : 'Inactivo'
                  return (
                    <tr key={c.id}>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        {c.nombre}
                      </td>
                      <td className="px-5 py-3 text-gray-400 dark:text-gray-500">{c.email}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.rol}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estadoStyles[estado]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {estado}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          title="Editar colaborador"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {editingId ? 'Editar colaborador' : 'Nuevo colaborador'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="nombre" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nombre
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div>
                <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Correo
                </label>
                <input
                  id="email"
                  type="email"
                  disabled={!!editingId}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              {!editingId && (
                <div>
                  <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contraseña
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              )}

              <div>
                <label htmlFor="rol" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rol
                </label>
                <select
                  id="rol"
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="">Seleccionar...</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="estado" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Estado
                </label>
                <select
                  id="estado"
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value as Estado })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="">Seleccionar...</option>
                  {estados.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {submitting ? (editingId ? 'Guardando...' : 'Creando...') : editingId ? 'Guardar cambios' : 'Crear colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
