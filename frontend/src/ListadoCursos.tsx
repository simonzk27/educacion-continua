import { useEffect, useState, type FormEvent } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  X,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  TriangleAlert,
  ExternalLink,
  Inbox,
  Layers,
  GraduationCap,
  BookText,
  Building2,
} from 'lucide-react'
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  increment,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import Select from './Select'
import { estiloTipoCurso } from './tipoCursoColors'
import { ordenarPorNombreYFecha, ordenOpciones, type OrdenOpcion } from './sortUtils'

type Estado = 'Activo' | 'Inactivo' | 'Próximo'
type Tipo = 'Educación Continua' | 'Academia' | 'Unimetab'
type DuracionUnidad = 'Lecciones'
type Tab = 'Todos los cursos' | Tipo

type Curso = {
  id: string
  nombre: string
  duracionValor: number
  duracionUnidad: DuracionUnidad
  inscritos: number
  estado: Estado
  tipo: Tipo
  link: string | null
  capitulos: number[] | null
  creadoEn: { toMillis: () => number } | null
}

const estadoStyles: Record<Estado, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  Próximo: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  const letras = partes.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return letras || '?'
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

const estados: Estado[] = ['Activo', 'Inactivo', 'Próximo']
const tabs: Tab[] = ['Todos los cursos', 'Educación Continua', 'Academia', 'Unimetab']

const emptyForm = {
  nombre: '',
  duracionValor: '',
  duracionUnidad: 'Lecciones' as DuracionUnidad,
  estado: '' as Estado | '',
  tipo: '' as Tipo | '',
  link: '',
  capitulos: [''] as string[],
}

type RolUsuario = 'Admin' | 'Usuario'
type AsignacionFiltro = 'Todos' | 'Asignado' | 'No asignado'

type Usuario = {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
}

const firestoreToRol: Record<string, RolUsuario> = { admin: 'Admin', usuario: 'Usuario' }
const asignacionFiltros: AsignacionFiltro[] = ['Todos', 'Asignado', 'No asignado']
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
  const [asignacionFiltro, setAsignacionFiltro] = useState<AsignacionFiltro>('Todos')
  const [cursoSearch, setCursoSearch] = useState('')
  const [orden, setOrden] = useState<OrdenOpcion>('az')
  const [page, setPage] = useState(1)

  const [deleting, setDeleting] = useState<Curso | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

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

  const porTab = tab === 'Todos los cursos' ? cursos : cursos.filter((c) => c.tipo === tab)
  const terminoCurso = normalizar(cursoSearch.trim())
  const palabrasCurso = terminoCurso.split(/\s+/).filter(Boolean)
  const filtradosSinOrden =
    palabrasCurso.length === 0
      ? porTab
      : porTab.filter((c) => {
          const texto = normalizar(c.nombre)
          return palabrasCurso.every((p) => texto.includes(p))
        })
  const filtrados = ordenarPorNombreYFecha(
    filtradosSinOrden,
    orden,
    (c) => c.nombre,
    (c) => c.creadoEn,
  )

  function openAssignModal(curso: Curso) {
    setAssignCurso(curso)
    setSearch('')
    setAsignacionFiltro('Todos')
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

  async function handleUnassign(usuario: Usuario) {
    if (!assignCurso || !assignedIds.has(usuario.id)) return
    setAssigningId(usuario.id)
    try {
      await deleteDoc(doc(db, 'cursos', assignCurso.id, 'inscripciones', usuario.id))
      await deleteDoc(doc(db, 'horarios', `${assignCurso.id}_${usuario.id}`))
      await updateDoc(doc(db, 'cursos', assignCurso.id), { inscritos: increment(-1) })
      setToast(`${usuario.nombre} desasignado de ${assignCurso.nombre}.`)
    } catch {
      setToast(null)
    } finally {
      setAssigningId(null)
    }
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    const asignado = assignedIds.has(u.id)
    const matchAsignacion =
      asignacionFiltro === 'Todos' ||
      (asignacionFiltro === 'Asignado' ? asignado : !asignado)
    const palabras = normalizar(search.trim()).split(/\s+/).filter(Boolean)
    const texto = normalizar(`${u.nombre} ${u.email}`)
    const matchSearch = palabras.every((p) => texto.includes(p))
    return matchAsignacion && matchSearch
  })
  const totalPages = Math.max(1, Math.ceil(usuariosFiltrados.length / PAGE_SIZE))
  const paginaActual = Math.min(page, totalPages)
  const usuariosPagina = usuariosFiltrados.slice(
    (paginaActual - 1) * PAGE_SIZE,
    paginaActual * PAGE_SIZE,
  )

  const totalLeccionesForm = form.capitulos.reduce((acc, v) => acc + (Number(v) > 0 ? Number(v) : 0), 0)
  const formEsUnimetab = form.tipo === 'Unimetab'
  const formEsEC = form.tipo === 'Educación Continua'

  function rangoCapitulo(index: number): { inicio: number; fin: number } | null {
    const n = Number(form.capitulos[index])
    if (!Number.isInteger(n) || n <= 0) return null
    let inicio = 1
    for (let i = 0; i < index; i++) {
      const prev = Number(form.capitulos[i])
      if (Number.isInteger(prev) && prev > 0) inicio += prev
    }
    return { inicio, fin: inicio + n - 1 }
  }

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
      duracionValor: String(curso.duracionValor),
      duracionUnidad: curso.duracionUnidad,
      estado: curso.estado,
      tipo: curso.tipo,
      link: curso.link ?? '',
      capitulos:
        curso.capitulos && curso.capitulos.length > 0 ? curso.capitulos.map((n) => String(n)) : [''],
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

    const esUnimetab = form.tipo === 'Unimetab'
    const esEC = form.tipo === 'Educación Continua'
    const capitulosNums = form.capitulos.map((c) => Number(c))

    if (!form.nombre.trim() || !form.estado || !form.tipo) {
      setFormError('Completá todos los campos.')
      return
    }

    let duracionValor: number
    let duracionUnidad: DuracionUnidad
    let capitulos: number[] | null

    if (esEC) {
      duracionValor = 1
      duracionUnidad = 'Lecciones'
      capitulos = null
    } else if (esUnimetab) {
      if (
        capitulosNums.length === 0 ||
        capitulosNums.some((n) => !Number.isInteger(n) || n <= 0)
      ) {
        setFormError('Indicá cuántas lecciones tiene cada capítulo.')
        return
      }
      capitulos = capitulosNums
      duracionValor = capitulosNums.reduce((acc, n) => acc + n, 0)
      duracionUnidad = 'Lecciones'
    } else {
      duracionValor = Number(form.duracionValor)
      if (!form.duracionValor || duracionValor <= 0) {
        setFormError('Completá todos los campos.')
        return
      }
      duracionUnidad = form.duracionUnidad
      capitulos = null
    }

    setSubmitting(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        duracionValor,
        duracionUnidad,
        estado: form.estado,
        tipo: form.tipo,
        link: esEC ? form.link.trim() || null : null,
        capitulos,
      }
      if (editingId) {
        await updateDoc(doc(db, 'cursos', editingId), payload)
        setToast('Curso actualizado correctamente.')
      } else {
        await addDoc(collection(db, 'cursos'), { ...payload, inscritos: 0, creadoEn: serverTimestamp() })
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

  async function handleDeleteConfirm() {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      const cursoId = deleting.id
      const [inscSnap, horSnap, avSnap] = await Promise.all([
        getDocs(collection(db, 'cursos', cursoId, 'inscripciones')),
        getDocs(query(collection(db, 'horarios'), where('cursoId', '==', cursoId))),
        getDocs(query(collection(db, 'avances'), where('cursoId', '==', cursoId))),
      ])
      const batch = writeBatch(db)
      inscSnap.forEach((d) => batch.delete(d.ref))
      horSnap.forEach((d) => batch.delete(d.ref))
      avSnap.forEach((d) => batch.delete(d.ref))
      batch.delete(doc(db, 'cursos', cursoId))
      await batch.commit()

      setToast(`${deleting.nombre} eliminado permanentemente.`)
      setDeleting(null)
    } catch {
      setToast(null)
    } finally {
      setDeletingBusy(false)
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
          className="flex w-fit items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <Plus className="h-4 w-4" />
          Nuevo curso
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((t) => {
          const estilo = estiloTipoCurso(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? estilo
                    ? `${estilo.borde} ${estilo.texto}`
                    : 'border-blue-600 text-blue-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {t}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Select
          value={orden}
          onChange={(v) => setOrden(v as OrdenOpcion)}
          className="w-full sm:w-44"
          options={ordenOpciones.map((o) => ({ value: o.value, label: o.label }))}
        />
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={cursoSearch}
            onChange={(e) => setCursoSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full rounded-lg border border-gray-300 py-2 pr-9 pl-9 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          {cursoSearch && (
            <button
              type="button"
              onClick={() => setCursoSearch('')}
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
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Curso</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Tipo</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Duración</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Inscritos</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 font-semibold dark:bg-gray-950">Estado</th>
                <th className="sticky top-0 z-10 bg-gray-50 px-5 py-3 text-right font-semibold dark:bg-gray-950">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`curso-skeleton-${i}`}>
                    <td className="px-5 py-3">
                      <div className="h-4 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-4 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-4 w-10 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
                    </td>
                    <td className="px-5 py-3" />
                  </tr>
                ))
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <Inbox className="h-8 w-8" />
                      <p className="text-sm">
                        {terminoCurso ? 'No hay cursos que coincidan con la búsqueda.' : 'No hay cursos todavía.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      <span className="inline-flex items-center gap-1.5">
                        {c.nombre}
                        {c.link && (
                          <a
                            href={c.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir enlace externo"
                            className="shrink-0 text-gray-400 transition-colors hover:text-blue-600 dark:hover:text-indigo-400"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estiloTipoCurso(c.tipo)?.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${estiloTipoCurso(c.tipo)?.dot}`} />
                        {c.tipo}
                      </span>
                    </td>
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
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          title="Editar curso"
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(c)}
                          title="Eliminar curso"
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
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
          <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  {editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {editingId ? 'Editar curso' : 'Nuevo curso'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {editingId ? 'Actualizá los datos del curso' : 'Completá los datos del nuevo curso'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="nombre" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nombre
                  </label>
                  <input
                    id="nombre"
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Ej. Fundamentos de nutrición clínica"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              </div>

              <hr className="border-gray-100 dark:border-gray-800" />

              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de curso</span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                  {(
                    [
                      { valor: 'Educación Continua', icono: GraduationCap },
                      { valor: 'Academia', icono: BookText },
                      { valor: 'Unimetab', icono: Building2 },
                    ] as const
                  ).map(({ valor, icono: Icono }) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setForm({ ...form, tipo: valor })}
                      className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                        form.tipo === valor
                          ? `bg-white shadow-sm dark:bg-gray-950 ${estiloTipoCurso(valor)?.texto ?? 'text-blue-700 dark:text-indigo-400'}`
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      <Icono className="h-4 w-4" />
                      <span className="text-center leading-tight">{valor}</span>
                    </button>
                  ))}
                </div>
              </div>

              {formEsEC ? null : formEsUnimetab ? (
                <div className="animate-fade-in rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-950/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Layers className="h-4 w-4 text-blue-600 dark:text-indigo-400" />
                      Capítulos y lecciones
                    </span>
                    {totalLeccionesForm > 0 && (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-blue-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                        {totalLeccionesForm} lecciones · {form.capitulos.length} cap.
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    {form.capitulos.map((valor, i) => {
                      const rango = rangoCapitulo(i)
                      return (
                        <div key={i} className="animate-fade-in flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            <input
                              type="number"
                              min="1"
                              placeholder="N.º de lecciones"
                              value={valor}
                              onChange={(e) => {
                                const capitulos = [...form.capitulos]
                                capitulos[i] = e.target.value
                                setForm({ ...form, capitulos })
                              }}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            />
                            {rango && (
                              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                Lecciones {rango.inicio}–{rango.fin}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                capitulos: form.capitulos.filter((_, idx) => idx !== i),
                              })
                            }
                            disabled={form.capitulos.length === 1}
                            className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-red-500/10"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, capitulos: [...form.capitulos, ''] })}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-400 dark:hover:text-indigo-400"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar capítulo
                  </button>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <label htmlFor="duracionValor" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Duración (lecciones)
                  </label>
                  <input
                    id="duracionValor"
                    type="number"
                    min="1"
                    value={form.duracionValor}
                    onChange={(e) => setForm({ ...form, duracionValor: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              )}

              {formEsEC && (
                <>
                  <hr className="border-gray-100 dark:border-gray-800" />

                  <div>
                    <label htmlFor="link" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enlace externo <span className="font-normal text-gray-400 dark:text-gray-500">(opcional)</span>
                    </label>
                    <input
                      id="link"
                      type="url"
                      value={form.link}
                      onChange={(e) => setForm({ ...form, link: e.target.value })}
                      placeholder="https://..."
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </div>
                </>
              )}

              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado</span>
                <div className="mt-1.5 flex gap-1.5">
                  {estados.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm({ ...form, estado: e })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                        form.estado === e
                          ? estadoStyles[e] + ' border-transparent shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="animate-shake animate-fade-in flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  {formError}
                </p>
              )}

              <div className="mt-1 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
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
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <UserPlus className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Asignar usuarios</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{assignCurso.nombre}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAssignModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 px-6 pt-5 sm:flex-row">
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
                  className="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <Select
                value={asignacionFiltro}
                onChange={(v) => {
                  setAsignacionFiltro(v as AsignacionFiltro)
                  setPage(1)
                }}
                className="w-44"
                options={asignacionFiltros}
              />
            </div>

            <div
              className={`mx-6 mt-4 flex-1 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 ${
                totalPages > 1 ? '' : 'mb-6'
              }`}
            >
              {usuariosPagina.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-gray-400 dark:text-gray-500">
                  <Inbox className="h-7 w-7" />
                  <p className="text-sm">No hay usuarios que coincidan.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {usuariosPagina.map((u) => {
                    const asignado = assignedIds.has(u.id)
                    return (
                      <li
                        key={u.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            {iniciales(u.nombre)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                              {u.nombre}
                            </p>
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                              {u.email} · {u.rol}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={assigningId === u.id}
                          onClick={() => (asignado ? handleUnassign(u) : handleAssign(u))}
                          title={asignado ? 'Quitar del curso' : undefined}
                          className={`group flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                            asignado
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-red-500/10 dark:hover:text-red-400'
                              : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
                          }`}
                        >
                          {asignado ? (
                            assigningId === u.id ? (
                              'Quitando...'
                            ) : (
                              <>
                                <Check className="h-3.5 w-3.5 group-hover:hidden" />
                                <X className="hidden h-3.5 w-3.5 group-hover:inline" />
                                <span className="group-hover:hidden">Asignado</span>
                                <span className="hidden group-hover:inline">Quitar</span>
                              </>
                            )
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
              <div className="mt-4 flex items-center justify-between px-6 pb-6 text-sm text-gray-500 dark:text-gray-400">
                <button
                  type="button"
                  disabled={paginaActual <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
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
                  className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                <TriangleAlert className="h-5.5 w-5.5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  ¿Eliminar {deleting.nombre}?
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Esta acción no se puede deshacer. Se eliminará permanentemente el curso y todos
                  sus datos asociados: inscripciones, horarios y avances reportados
                  {deleting.inscritos > 0 ? ` (${deleting.inscritos} colaborador${deleting.inscritos === 1 ? '' : 'es'} inscrito${deleting.inscritos === 1 ? '' : 's'})` : ''}.
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
