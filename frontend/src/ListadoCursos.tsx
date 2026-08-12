import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, UserPlus, X, CheckCircle2, Search, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  increment,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

type Estado = 'Activo' | 'Inactivo' | 'Próximo'
type Tipo = 'Natural' | 'Academia'
type DuracionUnidad = 'Semanas' | 'Meses'
type Tab = 'Todos los cursos' | Tipo

type Curso = {
  id: string
  nombre: string
  categoria: string
  instructor: string
  duracionValor: number
  duracionUnidad: DuracionUnidad
  inscritos: number
  estado: Estado
  tipo: Tipo
}

const estadoStyles: Record<Estado, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  Próximo: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
}

const estados: Estado[] = ['Activo', 'Inactivo', 'Próximo']
const tipos: Tipo[] = ['Natural', 'Academia']
const duracionUnidades: DuracionUnidad[] = ['Semanas', 'Meses']
const tabs: Tab[] = ['Todos los cursos', 'Natural', 'Academia']

const emptyForm = {
  nombre: '',
  categoria: '',
  instructor: '',
  duracionValor: '',
  duracionUnidad: 'Semanas' as DuracionUnidad,
  estado: '' as Estado | '',
  tipo: '' as Tipo | '',
}

type RolUsuario = 'Admin' | 'Usuario'
type RolFiltro = 'Todos' | RolUsuario

type Usuario = {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
}

const firestoreToRol: Record<string, RolUsuario> = { admin: 'Admin', usuario: 'Usuario' }
const rolFiltros: RolFiltro[] = ['Todos', 'Admin', 'Usuario']
const PAGE_SIZE = 10

export default function ListadoCursos() {
  const [tab, setTab] = useState<Tab>('Todos los cursos')
  const [cursos, setCursos] = useState<Curso[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [assignCurso, setAssignCurso] = useState<Curso | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [rolFiltro, setRolFiltro] = useState<RolFiltro>('Todos')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const q = query(collection(db, 'cursos'), orderBy('nombre'))
    return onSnapshot(q, (snap) => {
      setCursos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Curso, 'id'>) })))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!assignCurso) return
    const q = query(collection(db, 'users'), orderBy('nombre'))
    return onSnapshot(q, (snap) => {
      setUsuarios(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            nombre: data.nombre ?? '',
            email: data.email ?? '',
            rol: firestoreToRol[data.rol] ?? 'Usuario',
          }
        }),
      )
    })
  }, [assignCurso])

  useEffect(() => {
    if (!assignCurso) return
    return onSnapshot(collection(db, 'cursos', assignCurso.id, 'inscripciones'), (snap) => {
      setAssignedIds(new Set(snap.docs.map((d) => d.id)))
    })
  }, [assignCurso])

  const filtrados = tab === 'Todos los cursos' ? cursos : cursos.filter((c) => c.tipo === tab)

  function openAssignModal(curso: Curso) {
    setAssignCurso(curso)
    setSearch('')
    setRolFiltro('Todos')
    setPage(1)
  }

  function closeAssignModal() {
    setAssignCurso(null)
    setUsuarios([])
    setAssignedIds(new Set())
  }

  async function handleAssign(usuario: Usuario) {
    if (!assignCurso || assignedIds.has(usuario.id)) return
    setAssigningId(usuario.id)
    try {
      await setDoc(doc(db, 'cursos', assignCurso.id, 'inscripciones', usuario.id), {
        userId: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        asignadoEn: serverTimestamp(),
      })
      await updateDoc(doc(db, 'cursos', assignCurso.id), { inscritos: increment(1) })
      setToast(`${usuario.nombre} asignado a ${assignCurso.nombre}.`)
    } catch {
      setToast(null)
    } finally {
      setAssigningId(null)
    }
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchRol = rolFiltro === 'Todos' || u.rol === rolFiltro
    const term = search.trim().toLowerCase()
    const matchSearch = !term || u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    return matchRol && matchSearch
  })
  const totalPages = Math.max(1, Math.ceil(usuariosFiltrados.length / PAGE_SIZE))
  const paginaActual = Math.min(page, totalPages)
  const usuariosPagina = usuariosFiltrados.slice(
    (paginaActual - 1) * PAGE_SIZE,
    paginaActual * PAGE_SIZE,
  )

  function openCreateModal() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(curso: Curso) {
    setEditingId(curso.id)
    setForm({
      nombre: curso.nombre,
      categoria: curso.categoria,
      instructor: curso.instructor,
      duracionValor: String(curso.duracionValor),
      duracionUnidad: curso.duracionUnidad,
      estado: curso.estado,
      tipo: curso.tipo,
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

    const duracionValor = Number(form.duracionValor)
    if (
      !form.nombre.trim() ||
      !form.categoria.trim() ||
      !form.instructor.trim() ||
      !form.duracionValor ||
      duracionValor <= 0 ||
      !form.estado ||
      !form.tipo
    ) {
      setFormError('Completá todos los campos.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        categoria: form.categoria.trim(),
        instructor: form.instructor.trim(),
        duracionValor,
        duracionUnidad: form.duracionUnidad,
        estado: form.estado,
        tipo: form.tipo,
      }
      if (editingId) {
        await updateDoc(doc(db, 'cursos', editingId), payload)
        setToast('Curso actualizado correctamente.')
      } else {
        await addDoc(collection(db, 'cursos'), { ...payload, inscritos: 0 })
        setToast('Curso creado correctamente.')
      }
      closeModal()
    } catch {
      setFormError(
        editingId ? 'No se pudo guardar el curso. Intentá de nuevo.' : 'No se pudo crear el curso. Intentá de nuevo.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Listado de cursos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Catálogo de cursos, instructores y estado de inscripción
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex w-fit items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <Plus className="h-4 w-4" />
          Nuevo curso
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Tipo</th>
                <th className="px-5 py-3 font-semibold">Categoría</th>
                <th className="px-5 py-3 font-semibold">Instructor</th>
                <th className="px-5 py-3 font-semibold">Duración</th>
                <th className="px-5 py-3 font-semibold">Inscritos</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">
                    No hay cursos todavía.
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {c.nombre}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.tipo}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.categoria}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.instructor}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                      {c.duracionValor} {c.duracionUnidad.toLowerCase()}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{c.inscritos}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estadoStyles[c.estado]}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openAssignModal(c)}
                          title="Asignar usuarios"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          title="Editar curso"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
                {editingId ? 'Editar curso' : 'Nuevo curso'}
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
                <label htmlFor="categoria" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoría
                </label>
                <input
                  id="categoria"
                  type="text"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div>
                <label htmlFor="instructor" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Instructor
                </label>
                <input
                  id="instructor"
                  type="text"
                  value={form.instructor}
                  onChange={(e) => setForm({ ...form, instructor: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="duracionValor" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Duración
                  </label>
                  <input
                    id="duracionValor"
                    type="number"
                    min="1"
                    value={form.duracionValor}
                    onChange={(e) => setForm({ ...form, duracionValor: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="duracionUnidad" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Unidad
                  </label>
                  <select
                    id="duracionUnidad"
                    value={form.duracionUnidad}
                    onChange={(e) =>
                      setForm({ ...form, duracionUnidad: e.target.value as DuracionUnidad })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    {duracionUnidades.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="tipo" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo
                </label>
                <select
                  id="tipo"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="">Seleccionar...</option>
                  {tipos.map((t) => (
                    <option key={t} value={t}>
                      {t}
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
                  {submitting ? (editingId ? 'Guardando...' : 'Creando...') : editingId ? 'Guardar cambios' : 'Crear curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignCurso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Asignar usuarios</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{assignCurso.nombre}</p>
              </div>
              <button
                type="button"
                onClick={closeAssignModal}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Buscar por nombre o correo..."
                  className="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <select
                value={rolFiltro}
                onChange={(e) => {
                  setRolFiltro(e.target.value as RolFiltro)
                  setPage(1)
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {rolFiltros.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
              {usuariosPagina.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  No hay usuarios que coincidan.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {usuariosPagina.map((u) => {
                    const asignado = assignedIds.has(u.id)
                    return (
                      <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {u.nombre}
                          </p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {u.email} · {u.rol}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={asignado || assigningId === u.id}
                          onClick={() => handleAssign(u)}
                          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            asignado
                              ? 'cursor-default bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600'
                          }`}
                        >
                          {asignado ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Asignado
                            </>
                          ) : assigningId === u.id ? (
                            'Asignando...'
                          ) : (
                            'Asignar'
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <button
                  type="button"
                  disabled={paginaActual <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <span>
                  Página {paginaActual} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={paginaActual >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
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
