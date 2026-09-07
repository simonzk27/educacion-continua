import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, X, CheckCircle2, TriangleAlert, KeyRound, Lock, LockOpen, Inbox, Search } from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as secondarySignOut,
  type AuthError,
} from 'firebase/auth'
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  increment,
  setDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db, getSecondaryAuth, disposeSecondaryApp } from './firebase'

type Rol = 'Admin' | 'Usuario'
type Estado = 'Activo' | 'Inactivo'
type Equipo = 'Colombia' | 'USA'
type TipoCurso = 'Educación Continua' | 'Unimetab' | 'Academia'

type Colaborador = {
  id: string
  nombre: string
  email: string
  rol: Rol
  equipo: Equipo | null
  tipoCurso: TipoCurso | null
  activo: boolean
  puedeCambiarPassword: boolean
}

const rolToFirestore: Record<Rol, string> = { Admin: 'admin', Usuario: 'usuario' }
const firestoreToRol: Record<string, Rol> = { admin: 'Admin', usuario: 'Usuario' }

const roles: Rol[] = ['Admin', 'Usuario']
const estados: Estado[] = ['Activo', 'Inactivo']
const equipos: Equipo[] = ['Colombia', 'USA']
const tiposCurso: TipoCurso[] = ['Educación Continua', 'Unimetab', 'Academia']

const estadoStyles: Record<Estado, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

const createErrorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'Ese correo ya tiene una cuenta.',
  'auth/invalid-email': 'Correo inválido.',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres y un número.',
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  const letras = partes.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return letras || '?'
}

const emptyForm = {
  nombre: '',
  email: '',
  password: '',
  rol: '' as Rol | '',
  equipo: '' as Equipo | '',
  tipoCurso: '' as TipoCurso | '',
  estado: '' as Estado | '',
}

export default function Colaboradores() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [cursoNombres, setCursoNombres] = useState<Record<string, string>>({})
  const [inscripciones, setInscripciones] = useState<{ userId: string; cursoId: string }[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Colaborador | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [resetting, setResetting] = useState<Colaborador | null>(null)
  const [resettingBusy, setResettingBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [cursosExpandidos, setCursosExpandidos] = useState<Set<string>>(new Set())
  const [colabSearch, setColabSearch] = useState('')

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
            equipo: (data.equipo as Equipo) ?? null,
            tipoCurso: (data.tipoCurso as TipoCurso) ?? null,
            activo: data.activo !== false,
            puedeCambiarPassword: data.puedeCambiarPassword === true,
          }
        }),
      )
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'cursos'), (snap) => {
      const map: Record<string, string> = {}
      snap.docs.forEach((d) => {
        map[d.id] = (d.data().nombre as string) ?? d.id
      })
      setCursoNombres(map)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collectionGroup(db, 'inscripciones'), (snap) => {
      setInscripciones(
        snap.docs
          .map((d) => {
            const userId = d.data().userId as string | undefined
            const cursoId = d.ref.parent.parent?.id
            return userId && cursoId ? { userId, cursoId } : null
          })
          .filter((v): v is { userId: string; cursoId: string } => v !== null),
      )
    })
  }, [])

  const cursosPorColaborador = useMemo(() => {
    const map: Record<string, string[]> = {}
    inscripciones.forEach(({ userId, cursoId }) => {
      const nombre = (cursoNombres[cursoId] ?? cursoId).toLowerCase()
      map[userId] = [...(map[userId] ?? []), nombre]
    })
    return map
  }, [inscripciones, cursoNombres])

  const terminoColab = normalizar(colabSearch.trim())
  const palabrasColab = terminoColab.split(/\s+/).filter(Boolean)
  const colaboradoresFiltrados =
    palabrasColab.length === 0
      ? colaboradores
      : colaboradores.filter((c) => {
          const texto = normalizar(`${c.nombre} ${c.email}`)
          return palabrasColab.every((p) => texto.includes(p))
        })

  function toggleCursosExpandido(colaboradorId: string) {
    setCursosExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(colaboradorId)) next.delete(colaboradorId)
      else next.add(colaboradorId)
      return next
    })
  }

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
      equipo: colaborador.equipo ?? '',
      tipoCurso: colaborador.tipoCurso ?? '',
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

    const passwordValida = form.password.length >= 8 && /\d/.test(form.password)

    if (
      !form.nombre.trim() ||
      !form.email.trim() ||
      (!editingId && !passwordValida) ||
      !form.rol ||
      !form.equipo ||
      !form.tipoCurso ||
      !form.estado
    ) {
      setFormError(
        !editingId && form.password.length > 0 && !passwordValida
          ? 'La contraseña debe tener al menos 8 caracteres y un número.'
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
          equipo: form.equipo,
          tipoCurso: form.tipoCurso,
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
            equipo: form.equipo,
            tipoCurso: form.tipoCurso,
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

  async function handleDeleteConfirm() {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      const uid = deleting.id
      const cursoIds = inscripciones.filter((i) => i.userId === uid).map((i) => i.cursoId)

      const batch = writeBatch(db)
      cursoIds.forEach((cursoId) => {
        batch.delete(doc(db, 'cursos', cursoId, 'inscripciones', uid))
        batch.delete(doc(db, 'horarios', `${cursoId}_${uid}`))
        batch.update(doc(db, 'cursos', cursoId), { inscritos: increment(-1) })
      })
      batch.delete(doc(db, 'users', uid))
      await batch.commit()

      const avancesSnap = await getDocs(query(collection(db, 'avances'), where('userId', '==', uid)))
      if (!avancesSnap.empty) {
        const batch2 = writeBatch(db)
        avancesSnap.forEach((d) => batch2.delete(d.ref))
        await batch2.commit()
      }

      setToast(`${deleting.nombre} eliminado permanentemente.`)
      setDeleting(null)
    } catch {
      setToast(null)
    } finally {
      setDeletingBusy(false)
    }
  }

  async function handleResetConfirm() {
    if (!resetting) return
    setResettingBusy(true)
    try {
      await sendPasswordResetEmail(auth, resetting.email)
      setToast(`Correo de restablecimiento enviado a ${resetting.email}.`)
      setResetting(null)
    } catch {
      setToast('No se pudo enviar el correo de restablecimiento.')
    } finally {
      setResettingBusy(false)
    }
  }

  async function handleTogglePuedeCambiarPassword(c: Colaborador) {
    setTogglingId(c.id)
    try {
      await updateDoc(doc(db, 'users', c.id), { puedeCambiarPassword: !c.puedeCambiarPassword })
      setToast(
        !c.puedeCambiarPassword
          ? `${c.nombre} ahora puede cambiar su propia contraseña.`
          : `Se deshabilitó el cambio de contraseña para ${c.nombre}.`,
      )
    } catch {
      setToast('No se pudo actualizar el permiso.')
    } finally {
      setTogglingId(null)
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
          className="flex w-fit items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <Plus className="h-4 w-4" />
          Nuevo colaborador
        </button>
      </div>

      <div className="flex justify-end">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={colabSearch}
            onChange={(e) => setColabSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full rounded-lg border border-gray-300 py-2 pr-9 pl-9 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          {colabSearch && (
            <button
              type="button"
              onClick={() => setColabSearch('')}
              title="Limpiar búsqueda"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Nombre</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Correo</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Rol</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Equipo</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">
                  Tipo de curso
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">
                  Curso asociado
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Estado</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td colSpan={8} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                    </td>
                  </tr>
                ))
              ) : colaboradoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <Inbox className="h-8 w-8" />
                      <p className="text-sm">
                        {terminoColab ? 'No hay colaboradores que coincidan con la búsqueda.' : 'No hay colaboradores todavía.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                colaboradoresFiltrados.map((c) => {
                  const estado: Estado = c.activo ? 'Activo' : 'Inactivo'
                  const cursos = cursosPorColaborador[c.id]
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        <span className="inline-flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            {iniciales(c.nombre)}
                          </span>
                          {c.nombre}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 dark:text-gray-500">{c.email}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.rol}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.equipo ?? '–'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.tipoCurso ?? '–'}</td>
                      <td className="max-w-[220px] px-5 py-3 text-gray-600 dark:text-gray-400">
                        {(() => {
                          if (!cursos || cursos.length === 0) return 'Sin curso asignado'
                          const texto = cursos.join(', ')
                          const expandido = cursosExpandidos.has(c.id)
                          const esLargo = texto.length > 40
                          if (!esLargo) return texto
                          return (
                            <span>
                              {expandido ? texto : `${texto.slice(0, 40)}…`}{' '}
                              <button
                                type="button"
                                onClick={() => toggleCursosExpandido(c.id)}
                                className="font-medium text-blue-600 hover:underline dark:text-indigo-400"
                              >
                                {expandido ? 'Ver menos' : 'Ver más'}
                              </button>
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estadoStyles[estado]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {estado}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setResetting(c)}
                            title="Enviar restablecimiento de contraseña"
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePuedeCambiarPassword(c)}
                            disabled={togglingId === c.id}
                            title={
                              c.puedeCambiarPassword
                                ? 'Deshabilitar cambio de contraseña propio'
                                : 'Habilitar cambio de contraseña propio'
                            }
                            className={`rounded-lg p-1.5 transition-colors disabled:opacity-60 ${
                              c.puedeCambiarPassword
                                ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400'
                            }`}
                          >
                            {c.puedeCambiarPassword ? (
                              <LockOpen className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            title="Editar colaborador"
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(c)}
                            title="Eliminar colaborador"
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  {editingId ? <Pencil className="h-5.5 w-5.5" /> : <Plus className="h-5.5 w-5.5" />}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {editingId ? 'Editar colaborador' : 'Nuevo colaborador'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {editingId ? 'Actualizá los datos del colaborador.' : 'Completá los datos para crear una cuenta.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
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
                    placeholder="Mínimo 8 caracteres y un número"
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
                <label htmlFor="equipo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Equipo
                </label>
                <select
                  id="equipo"
                  value={form.equipo}
                  onChange={(e) => setForm({ ...form, equipo: e.target.value as Equipo })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="">Seleccionar...</option>
                  {equipos.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tipoCurso" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo de curso
                </label>
                <select
                  id="tipoCurso"
                  value={form.tipoCurso}
                  onChange={(e) => setForm({ ...form, tipoCurso: e.target.value as TipoCurso })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="">Seleccionar...</option>
                  {tiposCurso.map((s) => (
                    <option key={s} value={s}>
                      {s}
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
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {submitting ? (editingId ? 'Guardando...' : 'Creando...') : editingId ? 'Guardar cambios' : 'Crear colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                <TriangleAlert className="h-5.5 w-5.5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  ¿Eliminar a {deleting.nombre}?
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Esta acción no se puede deshacer. Se eliminará permanentemente el colaborador y
                  todos sus datos asociados: inscripciones, horarios y avances reportados.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                disabled={deletingBusy}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingBusy}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {deletingBusy ? 'Eliminando...' : 'Sí, eliminar por completo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <KeyRound className="h-5.5 w-5.5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  ¿Enviar restablecimiento a {resetting.nombre}?
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Se enviará un correo a <strong>{resetting.email}</strong> con un enlace para que
                  defina una nueva contraseña.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetting(null)}
                disabled={resettingBusy}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetConfirm}
                disabled={resettingBusy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {resettingBusy ? 'Enviando...' : 'Sí, enviar correo'}
              </button>
            </div>
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
