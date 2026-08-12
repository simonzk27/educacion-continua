import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Pencil,
  X,
  CheckCircle2,
  CalendarClock,
  Clock,
  Timer,
  CalendarDays,
  CalendarRange,
} from 'lucide-react'
import { collection, collectionGroup, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

type Sede = 'Colombia' | 'USA' | 'CMC Entrenamiento'
type Estado = 'Activo' | 'Inactivo'
type Dia = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'

const dias: Dia[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const diaIndex: Record<Dia, number> = Object.fromEntries(dias.map((d, i) => [d, i])) as Record<Dia, number>
const diaCorto: Record<Dia, string> = {
  Lunes: 'Lu',
  Martes: 'Ma',
  Miércoles: 'Mi',
  Jueves: 'Ju',
  Viernes: 'Vi',
  Sábado: 'Sá',
  Domingo: 'Do',
}

type Usuario = {
  id: string
  nombre: string
  sede: Sede | null
  activo: boolean
}

type Inscripcion = {
  userId: string
  cursoId: string
  dias: Dia[]
  hora: string | null
  duracionMin: number | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
}

type Fila = {
  key: string
  userId: string
  cursoId: string
  colaborador: string
  sede: Sede | null
  activo: boolean
  curso: string
  dias: Dia[]
  hora: string | null
  duracionMin: number | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
}

const estadoStyles: Record<Estado, string> = {
  Activo: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

function formatHora(hora: string | null): string {
  if (!hora) return '–'
  const [hStr, mStr] = hora.split(':')
  const h = Number(hStr)
  const suffix = h >= 12 ? 'p.m.' : 'a.m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${suffix}`
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatVigencia(inicio: string | null, fin: string | null): string {
  if (!inicio) return '–'
  return fin ? `Desde ${formatFecha(inicio)} hasta ${formatFecha(fin)}` : `Desde ${formatFecha(inicio)}`
}

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function endOfMonthIso(): string {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}

const emptyForm = {
  dias: [] as Dia[],
  hora: '',
  duracionMin: '',
}

export default function Horarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cursoNombres, setCursoNombres] = useState<Record<string, string>>({})
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [loadingCursos, setLoadingCursos] = useState(true)
  const [loadingInscripciones, setLoadingInscripciones] = useState(true)

  const [sede, setSede] = useState('Todas')
  const [colaborador, setColaborador] = useState('Todos')
  const [curso, setCurso] = useState('Todos')
  const [estado, setEstado] = useState('Todos')

  const [editing, setEditing] = useState<Fila | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('nombre'))
    return onSnapshot(
      q,
      (snap) => {
        setUsuarios(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              nombre: data.nombre ?? '',
              sede: (data.sede as Sede) ?? null,
              activo: data.activo !== false,
            }
          }),
        )
        setLoadingUsuarios(false)
      },
      (err) => {
        console.error('[Horarios] fallo listener users:', err)
        setLoadingUsuarios(false)
      },
    )
  }, [])

  useEffect(() => {
    return onSnapshot(
      collection(db, 'cursos'),
      (snap) => {
        const map: Record<string, string> = {}
        snap.docs.forEach((d) => {
          map[d.id] = (d.data().nombre as string) ?? d.id
        })
        setCursoNombres(map)
        setLoadingCursos(false)
      },
      (err) => {
        console.error('[Horarios] fallo listener cursos:', err)
        setLoadingCursos(false)
      },
    )
  }, [])

  useEffect(() => {
    return onSnapshot(
      collectionGroup(db, 'inscripciones'),
      (snap) => {
        setInscripciones(
          snap.docs
            .map((d): Inscripcion | null => {
              const data = d.data()
              const userId = data.userId as string | undefined
              const cursoId = d.ref.parent.parent?.id
              if (!userId || !cursoId) return null
              return {
                userId,
                cursoId,
                dias: (data.dias as Dia[]) ?? [],
                hora: (data.hora as string | undefined) ?? null,
                duracionMin: (data.duracionMin as number | undefined) ?? null,
                vigenciaInicio: (data.vigenciaInicio as string | undefined) ?? null,
                vigenciaFin: (data.vigenciaFin as string | undefined) ?? null,
              }
            })
            .filter((v): v is Inscripcion => v !== null),
        )
        setLoadingInscripciones(false)
      },
      (err) => {
        console.error('[Horarios] fallo listener inscripciones:', err)
        setLoadingInscripciones(false)
      },
    )
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timer)
  }, [toast])

  const loading = loadingUsuarios || loadingCursos || loadingInscripciones

  const usuariosPorId = useMemo(() => {
    const map: Record<string, Usuario> = {}
    usuarios.forEach((u) => {
      map[u.id] = u
    })
    return map
  }, [usuarios])

  const filas: Fila[] = useMemo(() => {
    return inscripciones
      .map((insc) => {
        const u = usuariosPorId[insc.userId]
        if (!u) return null
        return {
          key: `${insc.cursoId}_${insc.userId}`,
          userId: insc.userId,
          cursoId: insc.cursoId,
          colaborador: u.nombre,
          sede: u.sede,
          activo: u.activo,
          curso: cursoNombres[insc.cursoId] ?? insc.cursoId,
          dias: [...insc.dias].sort((a, b) => diaIndex[a] - diaIndex[b]),
          hora: insc.hora,
          duracionMin: insc.duracionMin,
          vigenciaInicio: insc.vigenciaInicio,
          vigenciaFin: insc.vigenciaFin,
        }
      })
      .filter((f): f is Fila => f !== null)
      .sort((a, b) => a.colaborador.localeCompare(b.colaborador))
  }, [inscripciones, usuariosPorId, cursoNombres])

  const colaboradoresOpciones = useMemo(
    () => [...new Set(filas.map((f) => f.colaborador))].sort(),
    [filas],
  )
  const cursosOpciones = useMemo(() => [...new Set(filas.map((f) => f.curso))].sort(), [filas])

  const filtradas = filas.filter((f) => {
    const matchSede = sede === 'Todas' || f.sede === sede
    const matchColaborador = colaborador === 'Todos' || f.colaborador === colaborador
    const matchCurso = curso === 'Todos' || f.curso === curso
    const estadoFila: Estado = f.activo ? 'Activo' : 'Inactivo'
    const matchEstado = estado === 'Todos' || estadoFila === estado
    return matchSede && matchColaborador && matchCurso && matchEstado
  })

  function openEditModal(f: Fila) {
    setEditing(f)
    setForm({
      dias: f.dias,
      hora: f.hora ?? '',
      duracionMin: f.duracionMin ? String(f.duracionMin) : '',
    })
    setFormError(null)
  }

  function closeModal() {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
  }

  function toggleDia(d: Dia) {
    setForm((prev) => ({
      ...prev,
      dias: prev.dias.includes(d) ? prev.dias.filter((x) => x !== d) : [...prev.dias, d],
    }))
  }

  function validar(): string | null {
    if (form.dias.length === 0) return 'Seleccioná al menos un día.'
    if (!form.hora) return 'Seleccioná una hora.'
    const dur = Number(form.duracionMin)
    if (!form.duracionMin || dur <= 0) return 'Ingresá una duración válida.'
    return null
  }

  async function guardar(vigenciaFin: string | null) {
    if (!editing) return
    const err = validar()
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        dias: form.dias,
        hora: form.hora,
        duracionMin: Number(form.duracionMin),
        vigenciaFin,
      }
      if (!editing.vigenciaInicio) {
        payload.vigenciaInicio = todayIso()
      }
      await updateDoc(doc(db, 'cursos', editing.cursoId, 'inscripciones', editing.userId), payload)
      setToast('Horario guardado correctamente.')
      closeModal()
    } catch {
      setFormError('No se pudo guardar el horario. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await guardar(null)
  }

  async function handleProgramarMes() {
    await guardar(endOfMonthIso())
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Horarios de estudio
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerencia consulta los horarios de cada colaborador y puede modificarlos en cualquier
            momento
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Sede
            </label>
            <select
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option>Todas</option>
              <option>Colombia</option>
              <option>USA</option>
              <option>CMC Entrenamiento</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Colaborador
            </label>
            <select
              value={colaborador}
              onChange={(e) => setColaborador(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option>Todos</option>
              {colaboradoresOpciones.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Curso
            </label>
            <select
              value={curso}
              onChange={(e) => setCurso(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option>Todos</option>
              {cursosOpciones.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Estado
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option>Todos</option>
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:text-gray-500">
                <th className="px-5 py-3 font-semibold">Colaborador</th>
                <th className="px-5 py-3 font-semibold">Sede</th>
                <th className="px-5 py-3 font-semibold">Curso</th>
                <th className="px-5 py-3 font-semibold">Días</th>
                <th className="px-5 py-3 font-semibold">Hora</th>
                <th className="px-5 py-3 font-semibold">Duración</th>
                <th className="px-5 py-3 font-semibold">Vigencia</th>
                <th className="px-5 py-3 font-semibold">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">
                    Cargando...
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-6 text-center text-gray-400 dark:text-gray-500">
                    No hay horarios todavía.
                  </td>
                </tr>
              ) : (
                filtradas.map((f) => {
                  const estadoFila: Estado = f.activo ? 'Activo' : 'Inactivo'
                  return (
                    <tr key={f.key}>
                      <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        {f.colaborador}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.sede ?? '–'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.curso}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        {f.dias.length > 0 ? f.dias.join(', ') : 'Sin programar'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {formatHora(f.hora)}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        {f.duracionMin ? `${f.duracionMin} min` : '–'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-gray-400 dark:text-gray-500">
                        {formatVigencia(f.vigenciaInicio, f.vigenciaFin)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estadoStyles[estadoFila]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {estadoFila}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(f)}
                          title="Editar horario"
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  <CalendarClock className="h-5.5 w-5.5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Editar horario</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {editing.colaborador} · {editing.curso}
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

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
              <div>
                <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Días de la semana
                </span>
                <div className="flex flex-wrap gap-2">
                  {dias.map((d) => {
                    const activo = form.dias.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        title={d}
                        onClick={() => toggleDia(d)}
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold transition ${
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="hora"
                    className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    Hora
                  </label>
                  <input
                    id="hora"
                    type="time"
                    value={form.hora}
                    onChange={(e) => setForm({ ...form, hora: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="duracion"
                    className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    <Timer className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                    Duración (min)
                  </label>
                  <input
                    id="duracion"
                    type="number"
                    min="1"
                    value={form.duracionMin}
                    onChange={(e) => setForm({ ...form, duracionMin: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-sm text-blue-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                {form.dias.length > 0 && form.hora ? (
                  <span>
                    Se dictará <strong className="font-semibold">{[...form.dias].sort((a, b) => diaIndex[a] - diaIndex[b]).join(', ')}</strong> a las{' '}
                    <strong className="font-semibold">{formatHora(form.hora)}</strong>
                    {form.duracionMin ? (
                      <>
                        {' '}· <strong className="font-semibold">{form.duracionMin} min</strong>
                      </>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-blue-700/70 dark:text-indigo-300/70">
                    Seleccioná días y hora para ver el resumen del horario.
                  </span>
                )}
              </div>

              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

              <div className="mt-1 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleProgramarMes}
                    className="group flex flex-col items-center gap-1 rounded-xl border border-gray-300 px-3 py-2.5 text-gray-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <CalendarRange className="h-4 w-4" />
                      {submitting ? 'Guardando...' : 'Programar mes'}
                    </span>
                    <span className="text-[11px] text-gray-400 group-hover:text-blue-500 dark:text-gray-500">
                      Hasta {formatFecha(endOfMonthIso())}
                    </span>
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex flex-col items-center gap-1 rounded-xl bg-blue-600 px-3 py-2.5 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <CalendarDays className="h-4 w-4" />
                      {submitting ? 'Guardando...' : 'Guardar horario'}
                    </span>
                    <span className="text-[11px] text-blue-100 dark:text-indigo-100">Sin fecha de fin</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="self-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancelar
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
