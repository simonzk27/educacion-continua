import { useEffect, useMemo, useState } from 'react'
import { CalendarCog, CheckCircle2 } from 'lucide-react'
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import DatePicker from './DatePicker'
import Select from './Select'

type Usuario = {
  id: string
  nombre: string
}

type Curso = {
  id: string
  nombre: string
  tipo: string
  duracionValor: number
  duracionUnidad: string
}

type Inscripcion = {
  userId: string
  cursoId: string
}

function parseIsoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function AjustarCompletado() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cursosPorId, setCursosPorId] = useState<Record<string, Curso>>({})
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedCursoId, setSelectedCursoId] = useState<string | null>(null)
  const [fecha, setFecha] = useState('')
  const [sinFecha, setSinFecha] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [fechaActual, setFechaActual] = useState<Timestamp | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('nombre'))
    return onSnapshot(q, (snap) => {
      setUsuarios(
        snap.docs.map((d) => ({ id: d.id, nombre: (d.data().nombre as string) ?? d.id })),
      )
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'cursos'), (snap) => {
      const map: Record<string, Curso> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        map[d.id] = {
          id: d.id,
          nombre: (data.nombre as string) ?? d.id,
          tipo: (data.tipo as string) ?? '',
          duracionValor: (data.duracionValor as number) ?? 0,
          duracionUnidad: (data.duracionUnidad as string) ?? 'Lecciones',
        }
      })
      setCursosPorId(map)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collectionGroup(db, 'inscripciones'), (snap) => {
      setInscripciones(
        snap.docs
          .map((d) => {
            const data = d.data()
            const userId = data.userId as string | undefined
            const cursoId = d.ref.parent.parent?.id
            if (!userId || !cursoId) return null
            return { userId, cursoId }
          })
          .filter((v): v is Inscripcion => v !== null),
      )
    })
  }, [])

  const cursosDelUsuario = useMemo(() => {
    if (!selectedUserId) return []
    return inscripciones
      .filter((i) => i.userId === selectedUserId)
      .map(
        (i) =>
          cursosPorId[i.cursoId] ?? {
            id: i.cursoId,
            nombre: i.cursoId,
            tipo: '',
            duracionValor: 0,
            duracionUnidad: 'Lecciones',
          },
      )
  }, [selectedUserId, inscripciones, cursosPorId])

  const cursoSeleccionado = selectedCursoId ? (cursosPorId[selectedCursoId] ?? null) : null

  useEffect(() => {
    setSelectedCursoId(null)
    setFecha('')
    setSinFecha(false)
    setError(null)
    setGuardado(false)
  }, [selectedUserId])

  useEffect(() => {
    setFecha('')
    setSinFecha(false)
    setError(null)
    setGuardado(false)
    setFechaActual(null)
    if (!selectedUserId || !selectedCursoId) return
    return onSnapshot(doc(db, 'cursos', selectedCursoId, 'inscripciones', selectedUserId), (snap) => {
      const f = snap.data()?.fechaCompletado as Timestamp | undefined
      setFechaActual(f ?? null)
    })
  }, [selectedUserId, selectedCursoId])

  async function handleGuardar() {
    if (!selectedUserId || !selectedCursoId || (!sinFecha && !fecha) || !cursoSeleccionado) {
      setError('Selecciona usuario, curso y fecha (o marca "Sin fecha").')
      return
    }
    setError(null)
    setGuardando(true)
    try {
      const esEC = cursoSeleccionado.tipo === 'Educación Continua'
      const fechaCompletado = sinFecha ? null : Timestamp.fromDate(parseIsoToDate(fecha))

      if (esEC) {
        await addDoc(collection(db, 'avances'), {
          userId: selectedUserId,
          cursoId: selectedCursoId,
          fecha: sinFecha ? '' : fecha,
          aprendizaje: 'Curso completado (ajuste administrativo).',
          comentario: null,
          creadoEn: serverTimestamp(),
        })
        await updateDoc(doc(db, 'cursos', selectedCursoId, 'inscripciones', selectedUserId), {
          completado: true,
          confirmado: true,
          fechaCompletado,
        })
      } else if (cursoSeleccionado.duracionUnidad === 'Horas') {
        const total = cursoSeleccionado.duracionValor
        if (total <= 0) {
          setError('Este curso no tiene una duración configurada, no se puede completar.')
          setGuardando(false)
          return
        }
        const horasHechas = await new Promise<number>((resolve, reject) => {
          const q = query(
            collection(db, 'avances'),
            where('userId', '==', selectedUserId),
            where('cursoId', '==', selectedCursoId),
          )
          const unsub = onSnapshot(
            q,
            (snap) => {
              unsub()
              resolve(snap.docs.reduce((acc, d) => acc + ((d.data().horas as number) ?? 0), 0))
            },
            reject,
          )
        })

        if (horasHechas >= total) {
          setError('Este colaborador ya completó todas las horas de este curso.')
          setGuardando(false)
          return
        }

        await addDoc(collection(db, 'avances'), {
          userId: selectedUserId,
          cursoId: selectedCursoId,
          fecha: sinFecha ? '' : fecha,
          horaInicio: '00:00',
          horaFin: '00:00',
          horas: total - horasHechas,
          aprendizaje: 'Curso completado (ajuste administrativo).',
          comentario: null,
          creadoEn: serverTimestamp(),
        })
        await updateDoc(doc(db, 'cursos', selectedCursoId, 'inscripciones', selectedUserId), {
          completado: true,
          confirmado: true,
          fechaCompletado,
        })
      } else {
        const total = cursoSeleccionado.duracionValor
        if (total <= 0) {
          setError('Este curso no tiene una duración configurada, no se puede completar.')
          setGuardando(false)
          return
        }
        const avancesSnap = await new Promise<number>((resolve, reject) => {
          const q = query(
            collection(db, 'avances'),
            where('userId', '==', selectedUserId),
            where('cursoId', '==', selectedCursoId),
          )
          const unsub = onSnapshot(
            q,
            (snap) => {
              unsub()
              let maxLeccion = 0
              snap.docs.forEach((d) => {
                const f = d.data().leccionFinal as number | undefined
                if (typeof f === 'number' && f > maxLeccion) maxLeccion = f
              })
              resolve(maxLeccion)
            },
            reject,
          )
        })

        if (avancesSnap >= total) {
          setError('Este colaborador ya completó todas las lecciones de este curso.')
          setGuardando(false)
          return
        }

        const leccionInicial = avancesSnap + 1
        const leccionFinal = total

        await addDoc(collection(db, 'avances'), {
          userId: selectedUserId,
          cursoId: selectedCursoId,
          fecha: sinFecha ? '' : fecha,
          horaInicio: '00:00',
          horaFin: '00:00',
          lecciones: leccionFinal - leccionInicial + 1,
          leccionInicial,
          leccionFinal,
          aprendizaje: 'Curso completado (ajuste administrativo).',
          comentario: null,
          creadoEn: serverTimestamp(),
        })
        await updateDoc(doc(db, 'cursos', selectedCursoId, 'inscripciones', selectedUserId), {
          completado: true,
          confirmado: true,
          fechaCompletado,
        })
      }
      setGuardado(true)
    } catch {
      setError('No se pudo guardar el avance. Intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <CalendarCog className="h-5.5 w-5.5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Registrar completado (ajuste)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Registra un avance del 100% para un colaborador, con la fecha que elijas.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <label htmlFor="ajustarColaborador" className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            Colaborador <span className="text-red-500">*</span>
          </label>
          <Select
            id="ajustarColaborador"
            value={selectedUserId ?? ''}
            onChange={(v) => setSelectedUserId(v || null)}
            placeholder="Selecciona un colaborador..."
            searchable
            options={usuarios.map((u) => ({ value: u.id, label: u.nombre }))}
          />
        </div>

        {selectedUserId && (
          <div>
            <label htmlFor="ajustarCurso" className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Curso <span className="text-red-500">*</span>
            </label>
            {cursosDelUsuario.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Este colaborador no tiene cursos asignados.
              </p>
            ) : (
              <Select
                id="ajustarCurso"
                value={selectedCursoId ?? ''}
                onChange={(v) => setSelectedCursoId(v || null)}
                placeholder="Selecciona un curso..."
                searchable
                options={cursosDelUsuario.map((c) => ({ value: c.id, label: c.nombre }))}
              />
            )}
          </div>
        )}

        {selectedCursoId && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Fecha de completado {!sinFecha && <span className="text-red-500">*</span>}
            </label>
            {fechaActual && (
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                Ya tiene fecha de completado:{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {fechaActual.toDate().toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </p>
            )}
            <DatePicker value={fecha} onChange={setFecha} disabled={sinFecha} />
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={sinFecha}
                onChange={(e) => {
                  setSinFecha(e.target.checked)
                  if (e.target.checked) setFecha('')
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950"
              />
              Sin fecha (N/A)
            </label>
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleGuardar}
          disabled={guardando || !selectedUserId || !selectedCursoId || (!sinFecha && !fecha)}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          {guardando ? 'Guardando...' : 'Guardar avance'}
        </button>

        {guardado && (
          <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Avance registrado correctamente.
          </p>
        )}
      </div>
    </div>
  )
}
