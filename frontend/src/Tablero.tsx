import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Search, Check, X, TriangleAlert, Inbox } from 'lucide-react'
import { collection, collectionGroup, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore'
import { db } from './firebase'

type Tipo = 'Educación Continua' | 'Academia' | 'Unimetab'

type Curso = {
  id: string
  nombre: string
  tipo: Tipo
  duracionValor: number
}

type PersonaTablero = {
  id: string
  nombre: string
  equipo: string | null
  tipoCurso: string | null
}

type InscripcionTablero = {
  userId: string
  cursoId: string
  completado: boolean
  confirmado: boolean
  fechaCompletado: Timestamp | null
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2)
  const letras = partes.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return letras || '?'
}

type TableroProps = {
  readonly isAdmin: boolean
}

export default function Tablero({ isAdmin }: TableroProps) {
  const [cursos, setCursos] = useState<Curso[]>([])
  const [loading, setLoading] = useState(true)
  const [personasTablero, setPersonasTablero] = useState<PersonaTablero[]>([])
  const [inscripcionesTablero, setInscripcionesTablero] = useState<InscripcionTablero[]>([])
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [avancesLecciones, setAvancesLecciones] = useState<{ userId: string; cursoId: string; lecciones: number }[]>(
    [],
  )

  const [equipoFiltro, setEquipoFiltro] = useState('Todos')
  const [tipoCursoFiltro, setTipoCursoFiltro] = useState('Todos')
  const [cursoFiltro, setCursoFiltro] = useState('Todos')
  const [buscar, setBuscar] = useState('')

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
    const q = query(collection(db, 'cursos'), orderBy('nombre'))
    return onSnapshot(q, (snap) => {
      setCursos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Curso, 'id'>) })))
      setLoading(false)
    })
  }, [])

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
            tipoCurso: (data.tipoCurso as string) ?? null,
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
    } finally {
      setTogglingKey(null)
    }
  }

  const inscripcionesPorClave = new Map(inscripcionesTablero.map((i) => [`${i.cursoId}_${i.userId}`, i]))

  const equiposOpciones = ['Colombia', 'USA']
  const tiposCursoOpciones = ['Educación Continua', 'Unimetab', 'Academia']

  const cursosVisibles = cursoFiltro === 'Todos' ? cursos : cursos.filter((c) => c.id === cursoFiltro)

  const personasFiltradas = personasTablero.filter((p) => {
    const matchEquipo = equipoFiltro === 'Todos' || (p.equipo ?? '') === equipoFiltro
    const matchTipoCurso = tipoCursoFiltro === 'Todos' || (p.tipoCurso ?? '') === tipoCursoFiltro
    const term = buscar.trim().toLowerCase()
    const matchBusqueda = !term || p.nombre.toLowerCase().includes(term)
    return matchEquipo && matchTipoCurso && matchBusqueda
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Buscar colaborador</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Nombre..."
              className="rounded-lg border border-gray-300 py-2 pr-3 pl-8 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Equipo</label>
          <select
            value={equipoFiltro}
            onChange={(e) => setEquipoFiltro(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            <option value="Todos">Todos</option>
            {equiposOpciones.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Tipo de curso</label>
          <select
            value={tipoCursoFiltro}
            onChange={(e) => setTipoCursoFiltro(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            <option value="Todos">Todos</option>
            {tiposCursoOpciones.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Curso</label>
          <select
            value={cursoFiltro}
            onChange={(e) => setCursoFiltro(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          >
            <option value="Todos">Todos</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setBuscar('')
            setEquipoFiltro('Todos')
            setTipoCursoFiltro('Todos')
            setCursoFiltro('Todos')
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Limpiar
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[800px] table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: colWidths.colaborador ?? 180 }} />
              <col style={{ width: colWidths.equipo ?? 150 }} />
              {cursosVisibles.map((c) => (
                <col key={c.id} style={{ width: colWidths[c.id] ?? 130 }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-500">
                <th className="sticky top-0 left-0 z-30 bg-gray-50/60 px-5 py-3 font-semibold dark:bg-gray-950/40">
                  <span className="block truncate">Colaborador</span>
                  <span
                    onMouseDown={(e) => startColumnResize(e, 'colaborador', 180)}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Ajustar ancho de columna"
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-blue-400/50 active:bg-blue-500/60 dark:hover:bg-indigo-400/50"
                  />
                </th>
                <th className="sticky top-0 z-20 bg-gray-50/60 px-5 py-3 font-semibold dark:bg-gray-950/40">
                  <span className="block truncate">Equipo</span>
                  <span
                    onMouseDown={(e) => startColumnResize(e, 'equipo', 150)}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Ajustar ancho de columna"
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-blue-400/50 active:bg-blue-500/60 dark:hover:bg-indigo-400/50"
                  />
                </th>
                {cursosVisibles.map((c) => (
                  <th
                    key={c.id}
                    className="sticky top-0 z-20 bg-gray-50/60 px-3 py-3 text-center font-semibold dark:bg-gray-950/40"
                  >
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
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`tablero-skeleton-${i}`}>
                    <td className="sticky left-0 z-10 bg-white px-5 py-3 dark:bg-gray-900">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-4 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                    </td>
                    {cursosVisibles.map((c) => (
                      <td key={c.id} className="px-3 py-3 text-center">
                        <div className="mx-auto h-6 w-6 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : personasFiltradas.length === 0 || cursosVisibles.length === 0 ? (
                <tr>
                  <td colSpan={2 + cursosVisibles.length} className="px-5 py-10">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <Inbox className="h-8 w-8" />
                      <p className="text-sm">No hay datos suficientes todavía.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                personasFiltradas.map((p) => (
                  <tr key={p.id} className="group transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="sticky left-0 z-10 bg-white px-5 py-3 font-semibold text-gray-900 group-hover:bg-gray-50/80 dark:bg-gray-900 dark:text-gray-100 dark:group-hover:bg-gray-800/40">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                          {iniciales(p.nombre)}
                        </span>
                        <span className="truncate">{p.nombre}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{p.equipo ?? '–'}</td>
                    {cursosVisibles.map((c) => {
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
                            <span
                              className="inline-block h-6 w-6 rounded-md bg-gray-100 dark:bg-gray-800"
                              title="No inscrito"
                            />
                          </td>
                        )
                      }

                      const confirmado = insc.completado && insc.confirmado
                      const pendienteConfirmar = insc.completado && !insc.confirmado
                      const puedeConfirmar = isAdmin && pendienteConfirmar && c.tipo === 'Educación Continua'

                      const celda = (
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${
                            confirmado
                              ? 'bg-emerald-500 text-white'
                              : pendienteConfirmar
                                ? 'bg-amber-500 text-white'
                                : 'bg-red-500 text-white'
                          }`}
                        >
                          {confirmado ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : pendienteConfirmar ? (
                            <TriangleAlert className="h-3.5 w-3.5" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
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
                                className="transition-transform hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
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
                              <div className={`h-full rounded-full transition-[width] ${barColor}`} style={{ width: `${pct}%` }} />
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
    </div>
  )
}
