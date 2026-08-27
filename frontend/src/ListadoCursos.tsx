import { useEffect, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react'
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
} from 'lucide-react'
import {
  collection,
  collectionGroup,
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
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

type Estado = 'Activo' | 'Inactivo' | 'Próximo'
type Tipo = 'Educación Continua' | 'Academia' | 'Unimetab'
type DuracionUnidad = 'Semanas' | 'Lecciones'
type Tab = 'Todos los cursos' | Tipo | 'Tablero'

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
  link: string | null
}

const estadoStyles: Record<Estado, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  Próximo: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
}

const estados: Estado[] = ['Activo', 'Inactivo', 'Próximo']
const tipos: Tipo[] = ['Educación Continua', 'Academia', 'Unimetab']
const duracionUnidades: DuracionUnidad[] = ['Semanas', 'Lecciones']
const tabs: Tab[] = ['Todos los cursos', 'Educación Continua', 'Academia', 'Unimetab', 'Tablero']

const emptyForm = {
  nombre: '',
  categoria: '',
  instructor: '',
  duracionValor: '',
  duracionUnidad: 'Semanas' as DuracionUnidad,
  estado: '' as Estado | '',
  tipo: '' as Tipo | '',
  link: '',
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

type PersonaTablero = {
  id: string
  nombre: string
  equipo: string | null
}

type InscripcionTablero = {
  userId: string
  cursoId: string
  completado: boolean
  confirmado: boolean
  fechaCompletado: Timestamp | null
}

type ListadoCursosProps = {
  isAdmin: boolean
}

export default function ListadoCursos({ isAdmin }: ListadoCursosProps) {
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

  const [deleting, setDeleting] = useState<Curso | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const [personasTablero, setPersonasTablero] = useState<PersonaTablero[]>([])
  const [inscripcionesTablero, setInscripcionesTablero] = useState<InscripcionTablero[]>([])
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [avancesLecciones, setAvancesLecciones] = useState<{ userId: string; cursoId: string; lecciones: number }[]>(
    [],
  )

  const [equipoFiltroTablero, setEquipoFiltroTablero] = useState('Todos')
  const [estadoFiltroTablero, setEstadoFiltroTablero] = useState<'Todos' | 'Completado' | 'Pendiente' | 'No inscrito'>(
    'Todos',
  )
  const [buscarTablero, setBuscarTablero] = useState('')

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    colaborador: 180,
    equipo: 150,
  })

  function startColumnResize(e: ReactMouseEvent, columnKey: string, defaultWidth: number) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = colWidths[columnKey] ?? defaultWidth

    function onMouseMove(ev: MouseEvent) {
      const next = Math.max(60, startWidth + (ev.clientX - startX))
      setColWidths((prev) => ({ ...prev, [columnKey]: next }))
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('nombre'))
    return onSnapshot(q, (snap) => {
      setPersonasTablero(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            nombre: (data.nombre as string) ?? '',
            equipo: (data.equipo as string) ?? null,
          }
        }),
      )
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collectionGroup(db, 'inscripciones'), (snap) => {
      setInscripcionesTablero(
        snap.docs
          .map((d) => {
            const data = d.data()
            const userId = data.userId as string | undefined
            const cursoId = d.ref.parent.parent?.id
            if (!userId || !cursoId) return null
            return {
              userId,
              cursoId,
              completado: data.completado === true,
              confirmado: data.confirmado !== false,
              fechaCompletado: (data.fechaCompletado as Timestamp | undefined) ?? null,
            }
          })
          .filter((v): v is InscripcionTablero => v !== null),
      )
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'avances'), (snap) => {
      setAvancesLecciones(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            userId: (data.userId as string) ?? '',
            cursoId: (data.cursoId as string) ?? '',
            lecciones: (data.lecciones as number) ?? 0,
          }
        }),
      )
    })
  }, [])

  const progresoPorClave = new Map<string, number>()
  avancesLecciones.forEach((a) => {
    const key = `${a.cursoId}_${a.userId}`
    progresoPorClave.set(key, (progresoPorClave.get(key) ?? 0) + a.lecciones)
  })

  async function handleConfirmarCompletado(userId: string, cursoId: string) {
    const key = `${cursoId}_${userId}`
    setTogglingKey(key)
    try {
      await updateDoc(doc(db, 'cursos', cursoId, 'inscripciones', userId), {
        confirmado: true,
        fechaCompletado: serverTimestamp(),
      })
    } catch {
      setToast(null)
    } finally {
      setTogglingKey(null)
    }
  }

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

  const filtrados =
    tab === 'Todos los cursos' || tab === 'Tablero' ? cursos : cursos.filter((c) => c.tipo === tab)

  const inscripcionesPorClave = new Map(
    inscripcionesTablero.map((i) => [`${i.cursoId}_${i.userId}`, i]),
  )

  const equiposOpcionesTablero = [...new Set(personasTablero.map((p) => p.equipo ?? 'Sin equipo'))].sort()

  function estadoPersonaCurso(personaId: string, cursoId: string): 'Completado' | 'Pendiente' | 'No inscrito' {
    const insc = inscripcionesPorClave.get(`${cursoId}_${personaId}`)
    if (!insc) return 'No inscrito'
    return insc.completado && insc.confirmado ? 'Completado' : 'Pendiente'
  }

  const personasFiltradasTablero = personasTablero.filter((p) => {
    const matchEquipo = equipoFiltroTablero === 'Todos' || (p.equipo ?? 'Sin equipo') === equipoFiltroTablero
    const term = buscarTablero.trim().toLowerCase()
    const matchBusqueda = !term || p.nombre.toLowerCase().includes(term)
    const matchEstado =
      estadoFiltroTablero === 'Todos' ||
      cursos.some((c) => estadoPersonaCurso(p.id, c.id) === estadoFiltroTablero)
    return matchEquipo && matchBusqueda && matchEstado
  })

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
      link: curso.link ?? '',
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
        link: form.link.trim() || null,
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

  const filtrosMatriz = (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
          Buscar colaborador
        </label>
        <input
          type="text"
          value={buscarTablero}
          onChange={(e) => setBuscarTablero(e.target.value)}
          placeholder="Nombre..."
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
          Equipo
        </label>
        <select
          value={equipoFiltroTablero}
          onChange={(e) => setEquipoFiltroTablero(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        >
          <option value="Todos">Todos</option>
          {equiposOpcionesTablero.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Estado</label>
        <select
          value={estadoFiltroTablero}
          onChange={(e) => setEstadoFiltroTablero(e.target.value as typeof estadoFiltroTablero)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        >
          <option value="Todos">Todos</option>
          <option value="Completado">Tiene algún curso completado</option>
          <option value="Pendiente">Tiene algún curso pendiente</option>
          <option value="No inscrito">No inscrito en algún curso</option>
        </select>
      </div>
      <button
        type="button"
        onClick={() => {
          setBuscarTablero('')
          setEquipoFiltroTablero('Todos')
          setEstadoFiltroTablero('Todos')
        }}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Limpiar
      </button>
    </div>
  )

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

      {tab === 'Tablero' ? (
        <>
          {filtrosMatriz}

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] table-fixed text-left text-sm">
              <colgroup>
                <col style={{ width: colWidths.colaborador ?? 180 }} />
                <col style={{ width: colWidths.equipo ?? 150 }} />
                {cursos.map((c) => (
                  <col key={c.id} style={{ width: colWidths[c.id] ?? 130 }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                  <th className="sticky left-0 z-10 relative bg-white px-5 py-3 font-semibold dark:bg-gray-900">
                    <span className="block truncate">Colaborador</span>
                    <span
                      onMouseDown={(e) => startColumnResize(e, 'colaborador', 180)}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Ajustar ancho de columna"
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-blue-400/50 active:bg-blue-500/60 dark:hover:bg-indigo-400/50"
                    />
                  </th>
                  <th className="relative px-5 py-3 font-semibold">
                    <span className="block truncate">Equipo</span>
                    <span
                      onMouseDown={(e) => startColumnResize(e, 'equipo', 150)}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Ajustar ancho de columna"
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-blue-400/50 active:bg-blue-500/60 dark:hover:bg-indigo-400/50"
                    />
                  </th>
                  {cursos.map((c) => (
                    <th key={c.id} className="relative px-3 py-3 text-center font-semibold">
                      <span className="block truncate">{c.nombre}</span>
                      <span
                        onMouseDown={(e) => startColumnResize(e, c.id, 130)}
                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-blue-400/50 active:bg-blue-500/60 dark:hover:bg-indigo-400/50"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {personasFiltradasTablero.length === 0 || cursos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + cursos.length}
                      className="px-5 py-6 text-center text-gray-400 dark:text-gray-500"
                    >
                      No hay datos suficientes todavía.
                    </td>
                  </tr>
                ) : (
                  personasFiltradasTablero.map((p) => (
                    <tr key={p.id}>
                      <td className="sticky left-0 z-10 bg-white px-5 py-3 font-semibold text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                        {p.nombre}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{p.equipo ?? '–'}</td>
                      {cursos.map((c) => {
                        const insc = inscripcionesPorClave.get(`${c.id}_${p.id}`)
                        const key = `${c.id}_${p.id}`
                        const fecha = insc?.fechaCompletado
                          ? insc.fechaCompletado.toDate().toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : null

                        if (!insc) {
                          return (
                            <td key={c.id} className="px-3 py-3 text-center">
                              <span className="inline-block h-6 w-6 rounded-md bg-gray-100 dark:bg-gray-800" title="No inscrito" />
                            </td>
                          )
                        }

                        const confirmado = insc.completado && insc.confirmado
                        const pendienteConfirmar = insc.completado && !insc.confirmado
                        const puedeConfirmar = isAdmin && pendienteConfirmar && c.tipo === 'Educación Continua'

                        const celda = (
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                              confirmado
                                ? 'bg-emerald-500 text-white'
                                : pendienteConfirmar
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-red-500 text-white'
                            }`}
                          >
                            {confirmado ? '✓' : pendienteConfirmar ? '!' : '✕'}
                          </span>
                        )

                        const totalCurso = c.duracionValor > 0 ? c.duracionValor : 1
                        const leccionesHechas = progresoPorClave.get(`${c.id}_${p.id}`) ?? 0
                        const pct = insc.completado
                          ? 100
                          : Math.min(100, Math.round((leccionesHechas / totalCurso) * 100))
                        const barColor =
                          pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'

                        const tituloCelda = confirmado
                          ? `Completado${fecha ? ` el ${fecha}` : ''}`
                          : pendienteConfirmar
                            ? `100% · pendiente de confirmación${puedeConfirmar ? ' · clic para confirmar' : ''}`
                            : 'Pendiente'

                        return (
                          <td key={c.id} className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {puedeConfirmar ? (
                                <button
                                  type="button"
                                  disabled={togglingKey === key}
                                  onClick={() => handleConfirmarCompletado(p.id, c.id)}
                                  title={tituloCelda}
                                  className="disabled:opacity-50"
                                >
                                  {celda}
                                </button>
                              ) : (
                                <span title={tituloCelda}>{celda}</span>
                              )}
                              {confirmado && fecha && (
                                <span className="text-[10px] whitespace-nowrap text-gray-400 dark:text-gray-500">
                                  {fecha}
                                </span>
                              )}
                              <div
                                className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                                title={`${pct}% completado`}
                              >
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">{pct}%</span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>
        </>
      ) : (
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
                      {c.link ? (
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 hover:text-blue-600 hover:underline dark:hover:text-indigo-400"
                        >
                          {c.nombre}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        </a>
                      ) : (
                        c.nombre
                      )}
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
                        <button
                          type="button"
                          onClick={() => setDeleting(c)}
                          title="Eliminar curso"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
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
      )}

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
                <label htmlFor="link" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enlace externo (opcional)
                </label>
                <input
                  id="link"
                  type="url"
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
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
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingBusy}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
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
