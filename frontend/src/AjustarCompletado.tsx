import { useEffect, useMemo, useState } from 'react'
import { CalendarCog, CheckCircle2 } from 'lucide-react'
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import DatePicker from './DatePicker'
import Select from './Select'

type Usuario = {
  id: string
  nombre: string
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
  const [cursosPorId, setCursosPorId] = useState<Record<string, string>>({})
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedCursoId, setSelectedCursoId] = useState<string | null>(null)
  const [fecha, setFecha] = useState('')
  const [sinFecha, setSinFecha] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

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
      const map: Record<string, string> = {}
      snap.docs.forEach((d) => {
        map[d.id] = (d.data().nombre as string) ?? d.id
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
      .map((i) => ({ id: i.cursoId, nombre: cursosPorId[i.cursoId] ?? i.cursoId }))
  }, [selectedUserId, inscripciones, cursosPorId])

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
  }, [selectedCursoId])

  async function handleGuardar() {
    if (!selectedUserId || !selectedCursoId || (!sinFecha && !fecha)) {
      setError('Selecciona usuario, curso y fecha (o marca "Sin fecha").')
      return
    }
    setError(null)
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'cursos', selectedCursoId, 'inscripciones', selectedUserId), {
        completado: true,
        confirmado: true,
        fechaCompletado: sinFecha ? null : Timestamp.fromDate(parseIsoToDate(fecha)),
      })
      setGuardado(true)
    } catch {
      setError('No se pudo guardar el cambio. Intentá de nuevo.')
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
            Ajustar fecha de completado
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Corrige la fecha en que un colaborador completó un curso.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            Colaborador <span className="text-red-500">*</span>
          </label>
          <Select
            value={selectedUserId ?? ''}
            onChange={(v) => setSelectedUserId(v || null)}
            placeholder="Selecciona un colaborador..."
            searchable
            options={usuarios.map((u) => ({ value: u.id, label: u.nombre }))}
          />
        </div>

        {selectedUserId && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Curso <span className="text-red-500">*</span>
            </label>
            {cursosDelUsuario.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Este colaborador no tiene cursos asignados.
              </p>
            ) : (
              <Select
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
              Nueva fecha de completado {!sinFecha && <span className="text-red-500">*</span>}
            </label>
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
          {guardando ? 'Guardando...' : 'Guardar cambio'}
        </button>

        {guardado && (
          <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Fecha de completado actualizada correctamente.
          </p>
        )}
      </div>
    </div>
  )
}
