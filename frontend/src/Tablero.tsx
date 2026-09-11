import { useEffect, useState } from 'react'
import { Search, Check, X, TriangleAlert, Inbox, ChevronRight } from 'lucide-react'
import { collection, collectionGroup, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import Select from './Select'
import ButtonGroup from './ButtonGroup'
import { ordenarPorNombreYFecha, ordenOpciones, type OrdenOpcion } from './sortUtils'
import { colorActivoTipoCurso, estiloTipoCurso } from './tipoCursoColors'
import { iconoEquipo } from './equipoFlags'

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
  creadoEn: { toMillis: () => number } | null
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
  const [orden, setOrden] = useState<OrdenOpcion>('az')
  const [ocultarSinCursos, setOcultarSinCursos] = useState(false)
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())

  function toggleColapsada(id: string) {
    setColapsadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
            creadoEn: (data.creadoEn as { toMillis: () => number } | undefined) ?? null,
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
  const avanceExisteSet = new Set<string>()
  avancesLecciones.forEach((a) => {
    const key = `${a.cursoId}_${a.userId}`
    progresoPorClave.set(key, (progresoPorClave.get(key) ?? 0) + a.lecciones)
    avanceExisteSet.add(key)
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

  const personasFiltradasSinOrden = personasTablero.filter((p) => {
    const matchEquipo = equipoFiltro === 'Todos' || (p.equipo ?? '') === equipoFiltro
    const matchTipoCurso = tipoCursoFiltro === 'Todos' || (p.tipoCurso ?? '') === tipoCursoFiltro
    const term = buscar.trim().toLowerCase()
    const matchBusqueda = !term || p.nombre.toLowerCase().includes(term)
    return matchEquipo && matchTipoCurso && matchBusqueda
  })
  const personasFiltradas = ordenarPorNombreYFecha(
    personasFiltradasSinOrden,
    orden,
    (p) => p.nombre,
    (p) => p.creadoEn,
  )

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
          <ButtonGroup
            value={equipoFiltro}
            onChange={setEquipoFiltro}
            className="w-40"
            options={['Todos', ...equiposOpciones]}
            iconFor={iconoEquipo}
            noWrap
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Tipo de curso</label>
          <ButtonGroup
            value={tipoCursoFiltro}
            onChange={setTipoCursoFiltro}
            className="w-96"
            options={['Todos', ...tiposCursoOpciones]}
            colorFor={colorActivoTipoCurso}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Curso</label>
          <Select
            value={cursoFiltro}
            onChange={setCursoFiltro}
            className="w-44"
            options={[{ value: 'Todos', label: 'Todos' }, ...cursos.map((c) => ({ value: c.id, label: c.nombre }))]}
            searchable
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Ordenar</label>
          <Select
            value={orden}
            onChange={(v) => setOrden(v as OrdenOpcion)}
            className="w-44"
            options={ordenOpciones.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={ocultarSinCursos}
            onChange={(e) => setOcultarSinCursos(e.target.checked)}
            className="h-4 w-4 accent-blue-600 dark:accent-indigo-500"
          />
          Ocultar sin cursos
        </label>
        <button
          type="button"
          onClick={() => setColapsadas(new Set(personasFiltradas.map((p) => p.id)))}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Minimizar todo
        </button>
        <button
          type="button"
          onClick={() => setColapsadas(new Set())}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Expandir todo
        </button>
        <button
          type="button"
          onClick={() => {
            setBuscar('')
            setEquipoFiltro('Todos')
            setTipoCursoFiltro('Todos')
            setCursoFiltro('Todos')
            setOcultarSinCursos(false)
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Limpiar
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`tablero-skeleton-${i}`}
              className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
                <div className="h-4 w-40 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
                <div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      ) : personasFiltradas.length === 0 || cursosVisibles.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
            <Inbox className="h-8 w-8" />
            <p className="text-sm">No hay datos suficientes todavía.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {personasFiltradas.map((p) => {
            const cursosPersona = cursosVisibles
              .map((c) => ({ curso: c, insc: inscripcionesPorClave.get(`${c.id}_${p.id}`) }))
              .filter(
                (x): x is { curso: Curso; insc: InscripcionTablero } => x.insc !== undefined,
              )

            const filas = cursosPersona.map(({ curso: c, insc }) => {
              const clave = `${c.id}_${p.id}`
              const tieneAvance = avanceExisteSet.has(clave)
              const esEC = c.tipo === 'Educación Continua'
              const totalCurso = c.duracionValor > 0 ? c.duracionValor : 1
              const leccionesHechas = progresoPorClave.get(clave) ?? 0
              const ajustadoPorAdmin = insc.completado === true && insc.confirmado === true
              const completadoReal = ajustadoPorAdmin || (esEC ? tieneAvance : leccionesHechas >= totalCurso)
              const confirmado = ajustadoPorAdmin || (esEC ? tieneAvance && insc.confirmado : completadoReal)
              const pendienteConfirmar = esEC && tieneAvance && !insc.confirmado
              const puedeConfirmar = isAdmin && pendienteConfirmar
              const pct = ajustadoPorAdmin
                ? 100
                : esEC
                  ? tieneAvance
                    ? 100
                    : 0
                  : Math.min(100, Math.round((leccionesHechas / totalCurso) * 100))
              const fecha = insc.fechaCompletado
                ? insc.fechaCompletado.toDate().toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : null
              return { curso: c, confirmado, pendienteConfirmar, puedeConfirmar, pct, fecha }
            })

            if (ocultarSinCursos && filas.length === 0) return null

            const completados = filas.filter((f) => f.confirmado).length
            const colapsada = colapsadas.has(p.id)

            return (
              <div
                key={p.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              >
                <button
                  type="button"
                  onClick={() => toggleColapsada(p.id)}
                  aria-expanded={!colapsada}
                  className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4 text-left transition-colors hover:bg-gray-100/60 dark:border-gray-800 dark:bg-gray-950/40 dark:hover:bg-gray-900/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${colapsada ? '' : 'rotate-90'}`}
                    />
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                      {iniciales(p.nombre)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{p.nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{p.equipo ?? 'Sin equipo'}</p>
                    </div>
                  </div>
                  {filas.length > 0 && (
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
                      {completados}/{filas.length} completados
                    </span>
                  )}
                </button>

                {!colapsada && (
                <>

                {filas.length === 0 ? (
                  <p className="px-5 py-5 text-sm text-gray-400 dark:text-gray-500">
                    Sin cursos que coincidan con el filtro.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filas.map(({ curso: c, confirmado, pendienteConfirmar, puedeConfirmar, pct, fecha }) => {
                      const estilo = estiloTipoCurso(c.tipo)
                      const key = `${c.id}_${p.id}`
                      const barColor =
                        pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-700'
                      const estadoIcono = confirmado ? (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <Check className="h-4 w-4" />
                        </span>
                      ) : pendienteConfirmar ? (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                          <TriangleAlert className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
                          <X className="h-4 w-4" />
                        </span>
                      )
                      const titulo = confirmado
                        ? `Completado${fecha ? ` el ${fecha}` : ''}`
                        : pendienteConfirmar
                          ? `100% · pendiente de confirmación${puedeConfirmar ? ' · clic para confirmar' : ''}`
                          : 'Pendiente'

                      return (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                        >
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${estilo?.dot ?? 'bg-gray-300 dark:bg-gray-700'}`} />

                          <div className="min-w-[180px] flex-1">
                            <p className="text-sm font-medium break-words text-gray-900 dark:text-gray-100">
                              {c.nombre}
                            </p>
                            <span
                              className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${estilo?.badge ?? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                            >
                              {c.tipo}
                            </span>
                          </div>

                          <div className="flex w-36 shrink-0 items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                              <div
                                className={`h-full rounded-full transition-[width] ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-9 shrink-0 text-right text-xs text-gray-400 dark:text-gray-500">
                              {pct}%
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {fecha && confirmado && (
                              <span className="text-xs whitespace-nowrap text-gray-400 dark:text-gray-500">
                                {fecha}
                              </span>
                            )}
                            {puedeConfirmar ? (
                              <button
                                type="button"
                                disabled={togglingKey === key}
                                onClick={() => handleConfirmarCompletado(p.id, c.id)}
                                title={titulo}
                                className="transition-transform hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
                              >
                                {estadoIcono}
                              </button>
                            ) : (
                              <span title={titulo}>{estadoIcono}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
