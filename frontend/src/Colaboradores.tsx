import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Pencil, X, CheckCircle2, KeyRound, Lock, LockOpen, Inbox, Search, Eye, EyeOff } from 'lucide-react'
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
  increment,
  setDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db, getSecondaryAuth, disposeSecondaryApp } from './firebase'
import Select from './Select'
import TimePicker from './TimePicker'
import { ordenarPorNombreYFecha, ordenOpciones, type OrdenOpcion } from './sortUtils'
import { type Dia, diaCorto, todayIso } from './scheduleUtils'

const dias: Dia[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

type Rol = 'Admin' | 'Usuario'
type Estado = 'Activo' | 'Inactivo'
type Equipo = 'Colombia' | 'USA'

type Colaborador = {
  id: string
  nombre: string
  email: string
  rol: Rol
  equipo: Equipo | null
  activo: boolean
  puedeCambiarPassword: boolean
  creadoEn: { toMillis: () => number } | null
}

const rolToFirestore: Record<Rol, string> = { Admin: 'admin', Usuario: 'usuario' }
const firestoreToRol: Record<string, Rol> = { admin: 'Admin', usuario: 'Usuario' }

const roles: Rol[] = ['Admin', 'Usuario']
const estados: Estado[] = ['Activo', 'Inactivo']
const equipos: Equipo[] = ['Colombia', 'USA']

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

function capitalizarPalabras(texto: string): string {
  return texto.replace(/(^|\s)(\S)/g, (_, sep, letra) => sep + letra.toUpperCase())
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
  const [resetting, setResetting] = useState<Colaborador | null>(null)
  const [resettingBusy, setResettingBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [cursosExpandidos, setCursosExpandidos] = useState<Set<string>>(new Set())
  const [colabSearch, setColabSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<Estado | 'Todos'>('Todos')
  const [equipoFiltro, setEquipoFiltro] = useState<Equipo | 'Todos'>('Todos')
  const [rolFiltro, setRolFiltro] = useState<Rol | 'Todos'>('Todos')
  const [showPassword, setShowPassword] = useState(false)
  const [orden, setOrden] = useState<OrdenOpcion>('az')

  const [horarioSetup, setHorarioSetup] = useState<{ userId: string; nombre: string; email: string; rol: Rol } | null>(
    null,
  )
  const emptyHorarioForm = { cursoId: '', dias: [] as Dia[], hora: '', duracionHoras: '', duracionMinutos: '' }
  const [horarioForm, setHorarioForm] = useState(emptyHorarioForm)
  const [horarioSubmitting, setHorarioSubmitting] = useState(false)
  const [horarioError, setHorarioError] = useState<string | null>(null)

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
            activo: data.activo !== false,
            puedeCambiarPassword: data.puedeCambiarPassword === true,
            creadoEn: (data.creadoEn as { toMillis: () => number } | undefined) ?? null,
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
  const colaboradoresFiltradosSinOrden = colaboradores.filter((c) => {
    const estado: Estado = c.activo ? 'Activo' : 'Inactivo'
    const matchEstado = estadoFiltro === 'Todos' || estado === estadoFiltro
    const matchEquipo = equipoFiltro === 'Todos' || c.equipo === equipoFiltro
    const matchRol = rolFiltro === 'Todos' || c.rol === rolFiltro
    const texto = normalizar(`${c.nombre} ${c.email}`)
    const matchSearch = palabrasColab.every((p) => texto.includes(p))
    return matchEstado && matchEquipo && matchRol && matchSearch
  })
  const colaboradoresFiltrados = ordenarPorNombreYFecha(
    colaboradoresFiltradosSinOrden,
    orden,
    (c) => c.nombre,
    (c) => c.creadoEn,
  )

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
          activo: form.estado === 'Activo',
        })
        setToast('Colaborador actualizado correctamente.')
      } else {
        const secondaryAuth = getSecondaryAuth()
        let uid: string
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email.trim(), form.password)
          uid = cred.user.uid
          await setDoc(doc(db, 'users', uid), {
            nombre: form.nombre.trim(),
            email: form.email.trim(),
            rol: rolToFirestore[form.rol],
            equipo: form.equipo,
            activo: form.estado === 'Activo',
            creadoEn: serverTimestamp(),
          })
        } finally {
          await secondarySignOut(secondaryAuth)
          await disposeSecondaryApp()
        }
        setToast('Colaborador creado correctamente.')
        closeModal()
        setHorarioSetup({ userId: uid, nombre: form.nombre.trim(), email: form.email.trim(), rol: form.rol })
        setHorarioForm(emptyHorarioForm)
        setHorarioError(null)
        return
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

  function closeHorarioSetup() {
    setHorarioSetup(null)
    setHorarioForm(emptyHorarioForm)
    setHorarioError(null)
  }

  function toggleHorarioDia(d: Dia) {
    setHorarioForm((prev) => ({
      ...prev,
      dias: prev.dias.includes(d) ? prev.dias.filter((x) => x !== d) : [...prev.dias, d],
    }))
  }

  async function handleHorarioSetupSubmit(e: FormEvent) {
    e.preventDefault()
    if (!horarioSetup) return
    const duracionMin = Number(horarioForm.duracionHoras || 0) * 60 + Number(horarioForm.duracionMinutos || 0)
    if (!horarioForm.cursoId) {
      setHorarioError('Elegí un curso.')
      return
    }
    if (horarioForm.dias.length === 0) {
      setHorarioError('Seleccioná al menos un día.')
      return
    }
    if (!horarioForm.hora) {
      setHorarioError('Seleccioná una hora.')
      return
    }
    if (duracionMin <= 0) {
      setHorarioError('Ingresá una duración válida.')
      return
    }
    setHorarioError(null)
    setHorarioSubmitting(true)
    try {
      const { userId, nombre, email, rol } = horarioSetup
      const { cursoId } = horarioForm
      await setDoc(doc(db, 'cursos', cursoId, 'inscripciones', userId), {
        userId,
        nombre,
        email,
        rol,
        asignadoEn: serverTimestamp(),
      })
      await updateDoc(doc(db, 'cursos', cursoId), { inscritos: increment(1) })
      await setDoc(doc(db, 'horarios', `${cursoId}_${userId}`), {
        userId,
        cursoId,
        modo: 'semanal',
        dias: horarioForm.dias,
        fechas: [],
        hora: horarioForm.hora,
        duracionMin,
        vigenciaInicio: todayIso(),
        vigenciaFin: null,
      })
      setToast(`Curso y horario asignados a ${nombre}.`)
      closeHorarioSetup()
    } catch {
      setHorarioError('No se pudo guardar el curso y horario. Intentá de nuevo.')
    } finally {
      setHorarioSubmitting(false)
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(['Todos', ...estados] as const).map((es) => (
            <button
              key={es}
              type="button"
              onClick={() => setEstadoFiltro(es)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                estadoFiltro === es
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-400'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {es}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-gray-200 dark:bg-gray-700" />
          {(['Todos', ...equipos] as const).map((eq) => (
            <button
              key={eq}
              type="button"
              onClick={() => setEquipoFiltro(eq)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                equipoFiltro === eq
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-400'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {eq}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-gray-200 dark:bg-gray-700" />
          {(['Todos', ...roles] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRolFiltro(r)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                rolFiltro === r
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-400'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Select
            value={orden}
            onChange={(v) => setOrden(v as OrdenOpcion)}
            className="w-44"
            options={ordenOpciones.map((o) => ({ value: o.value, label: o.label }))}
          />
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
                  Curso asociado
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Estado</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 text-right font-semibold dark:bg-gray-950">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                    </td>
                  </tr>
                ))
              ) : colaboradoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12">
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
                  onChange={(e) => setForm({ ...form, nombre: capitalizarPalabras(e.target.value) })}
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
                  onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              {!editingId && (
                <div>
                  <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contraseña
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Mínimo 8 caracteres y un número"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Rol</span>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                  {roles.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, rol: r })}
                      className={`rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                        form.rol === r
                          ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-950 dark:text-indigo-400'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Equipo</span>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                  {equipos.map((eq) => (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => setForm({ ...form, equipo: eq })}
                      className={`rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                        form.equipo === eq
                          ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-950 dark:text-indigo-400'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      {eq}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado</span>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                  {estados.map((es) => (
                    <button
                      key={es}
                      type="button"
                      onClick={() => setForm({ ...form, estado: es })}
                      className={`rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                        form.estado === es
                          ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-950 dark:text-indigo-400'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      {es}
                    </button>
                  ))}
                </div>
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

      {horarioSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Asignar curso y horario</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {horarioSetup.nombre} · podés hacerlo ahora o más tarde desde Horarios.
                </p>
              </div>
              <button
                type="button"
                onClick={closeHorarioSetup}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleHorarioSetupSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
              <div>
                <label htmlFor="horarioCurso" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Curso
                </label>
                <Select
                  id="horarioCurso"
                  value={horarioForm.cursoId}
                  onChange={(v) => setHorarioForm({ ...horarioForm, cursoId: v })}
                  placeholder="Seleccionar..."
                  className="mt-1"
                  options={Object.entries(cursoNombres).map(([id, nombre]) => ({ value: id, label: nombre }))}
                  searchable
                />
              </div>

              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Días de la semana
                </span>
                <div className="flex flex-wrap gap-2">
                  {dias.map((d) => {
                    const activo = horarioForm.dias.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        title={d}
                        onClick={() => toggleHorarioDia(d)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition ${
                          activo
                            ? 'bg-blue-600 text-white shadow-sm ring-4 ring-blue-100 dark:bg-indigo-500 dark:ring-indigo-500/20'
                            : 'border border-gray-300 text-gray-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
                        }`}
                      >
                        {diaCorto[d]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="horarioSetupHora" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hora
                  </label>
                  <TimePicker
                    id="horarioSetupHora"
                    value={horarioForm.hora}
                    onChange={(hora) => setHorarioForm({ ...horarioForm, hora })}
                  />
                </div>
                <div>
                  <label
                    htmlFor="horarioHoras"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Horas
                  </label>
                  <input
                    id="horarioHoras"
                    type="number"
                    min="0"
                    value={horarioForm.duracionHoras}
                    onChange={(e) => setHorarioForm({ ...horarioForm, duracionHoras: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="horarioMinutos"
                    className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Minutos
                  </label>
                  <input
                    id="horarioMinutos"
                    type="number"
                    min="0"
                    step="15"
                    value={horarioForm.duracionMinutos}
                    onChange={(e) => setHorarioForm({ ...horarioForm, duracionMinutos: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              </div>

              {horarioError && <p className="text-sm text-red-600 dark:text-red-400">{horarioError}</p>}

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeHorarioSetup}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Más tarde
                </button>
                <button
                  type="submit"
                  disabled={horarioSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {horarioSubmitting ? 'Guardando...' : 'Asignar curso y horario'}
                </button>
              </div>
            </form>
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
