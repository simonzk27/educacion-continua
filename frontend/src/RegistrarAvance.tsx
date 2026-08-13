import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addDoc, collection, collectionGroup, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from './firebase'
import {
  type Dia,
  type Modo,
  addDays,
  formatFechaSesion,
  formatHora,
  ocurrenciasEntre,
  todayIso,
} from './scheduleUtils'

type Curso = {
  id: string
  nombre: string
}

type Horario = {
  cursoId: string
  modo: Modo
  dias: Dia[]
  fechas: string[]
  hora: string | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
}

const emptyForm = {
  fecha: '',
  horaInicio: '',
  horaFin: '',
  lecciones: '',
  leccionInicial: '',
  leccionFinal: '',
  aprendizaje: '',
  comentario: '',
}

type RegistrarAvanceProps = {
  readonly userId: string
}

export default function RegistrarAvance({ userId }: RegistrarAvanceProps) {
  const [cursosPorId, setCursosPorId] = useState<Record<string, Curso>>({})
  const [cursoIds, setCursoIds] = useState<string[]>([])
  const [horariosPorCurso, setHorariosPorCurso] = useState<Record<string, Horario>>({})
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    return onSnapshot(collection(db, 'cursos'), (snap) => {
      const map: Record<string, Curso> = {}
      snap.docs.forEach((d) => {
        map[d.id] = { id: d.id, nombre: (d.data().nombre as string) ?? d.id }
      })
      setCursosPorId(map)
    })
  }, [])

  useEffect(() => {
    const q = query(collectionGroup(db, 'inscripciones'), where('userId', '==', userId))
    return onSnapshot(
      q,
      (snap) => {
        setCursoIds(snap.docs.map((d) => d.ref.parent.parent?.id).filter((id): id is string => !!id))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [userId])

  useEffect(() => {
    const q = query(collection(db, 'horarios'), where('userId', '==', userId))
    return onSnapshot(q, (snap) => {
      const map: Record<string, Horario> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        const cursoId = data.cursoId as string | undefined
        if (!cursoId) return
        map[cursoId] = {
          cursoId,
          modo: (data.modo as Modo) ?? 'semanal',
          dias: (data.dias as Dia[]) ?? [],
          fechas: (data.fechas as string[]) ?? [],
          hora: (data.hora as string | undefined) ?? null,
          vigenciaInicio: (data.vigenciaInicio as string | undefined) ?? null,
          vigenciaFin: (data.vigenciaFin as string | undefined) ?? null,
        }
      })
      setHorariosPorCurso(map)
    })
  }, [userId])

  const sesionObjetivo = useMemo(() => {
    const hoy = todayIso()
    const ventana = addDays(hoy, 180)
    const ahora = new Date()
    const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`

    const candidatas = cursoIds.flatMap((cursoId) => {
      const curso = cursosPorId[cursoId]
      const horario = horariosPorCurso[cursoId]
      if (!curso || !horario || !horario.hora) return []
      return ocurrenciasEntre(horario, hoy, ventana).map((fecha) => ({
        cursoId,
        cursoNombre: curso.nombre,
        fecha,
        hora: horario.hora as string,
      }))
    })

    return (
      candidatas
        .filter((s) => s.fecha > hoy || s.hora >= horaActual)
        .sort((a, b) => (a.fecha === b.fecha ? a.hora.localeCompare(b.hora) : a.fecha.localeCompare(b.fecha)))[0] ??
      null
    )
  }, [cursoIds, cursosPorId, horariosPorCurso])

  useEffect(() => {
    if (!sesionObjetivo) return
    setForm((prev) => ({
      ...prev,
      fecha: prev.fecha || sesionObjetivo.fecha,
      horaInicio: prev.horaInicio || sesionObjetivo.hora,
    }))
  }, [sesionObjetivo])

  function validar(): string | null {
    if (!sesionObjetivo) return 'No tenés una sesión programada para registrar avance.'
    if (!form.fecha) return 'Seleccioná la fecha de la sesión.'
    if (!form.horaInicio || !form.horaFin) return 'Completá hora de inicio y hora de fin.'
    if (!form.lecciones || Number(form.lecciones) < 0) return 'Ingresá cuántas lecciones avanzaste.'
    if (!form.aprendizaje.trim()) return 'Contanos tu principal aprendizaje de la sesión.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validar()
    if (err) {
      setFormError(err)
      return
    }
    if (!sesionObjetivo) return
    setFormError(null)
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'avances'), {
        userId,
        cursoId: sesionObjetivo.cursoId,
        fecha: form.fecha,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        lecciones: Number(form.lecciones),
        leccionInicial: form.leccionInicial ? Number(form.leccionInicial) : null,
        leccionFinal: form.leccionFinal ? Number(form.leccionFinal) : null,
        aprendizaje: form.aprendizaje.trim(),
        comentario: form.comentario.trim() || null,
        creadoEn: serverTimestamp(),
      })
      setGuardado(true)
      setForm(emptyForm)
    } catch {
      setFormError('No se pudo guardar el avance. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Registrar avance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Completa este formulario en menos de un minuto ·{' '}
          <span className="text-red-500">*</span> campos obligatorios
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="mb-4 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
          Sesión más próxima programada
        </p>
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Cargando...</p>
        ) : sesionObjetivo ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                Curso
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                {sesionObjetivo.cursoNombre}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                Horario
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                {formatHora(sesionObjetivo.hora)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                Fecha
              </p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                {formatFechaSesion(sesionObjetivo.fecha)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No tenés ninguna sesión programada todavía.
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div>
          <p className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            Confirma el día y horario de tu sesión <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <input
              type="time"
              value={form.horaInicio}
              onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <input
              type="time"
              value={form.horaFin}
              onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <p className="mt-2 text-xs text-gray-400 italic dark:text-gray-500">
            Ajusta el día u horario si tu sesión ocurrió en otro momento.
          </p>
        </div>

        <hr className="border-gray-100 dark:border-gray-800" />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            ¿Cuántas lecciones avanzaste hoy? <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0}
            value={form.lecciones}
            onChange={(e) => setForm({ ...form, lecciones: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Lección inicial{' '}
              <span className="font-normal text-gray-400 dark:text-gray-500">(opcional)</span>
            </label>
            <input
              type="number"
              min={0}
              value={form.leccionInicial}
              onChange={(e) => setForm({ ...form, leccionInicial: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
              Lección final <span className="font-normal text-gray-400 dark:text-gray-500">(opcional)</span>
            </label>
            <input
              type="number"
              min={0}
              value={form.leccionFinal}
              onChange={(e) => setForm({ ...form, leccionFinal: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            ¿Cuál fue tu principal aprendizaje o ganancia de esta sesión?{' '}
            <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            maxLength={300}
            value={form.aprendizaje}
            onChange={(e) => setForm({ ...form, aprendizaje: e.target.value })}
            placeholder="Entendí cómo..."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {form.aprendizaje.length}/300
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
            Comentario adicional{' '}
            <span className="font-normal text-gray-400 dark:text-gray-500">(opcional)</span>
          </label>
          <textarea
            rows={3}
            maxLength={500}
            value={form.comentario}
            onChange={(e) => setForm({ ...form, comentario: e.target.value })}
            placeholder="Algo más que quieras registrar..."
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <p className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">
            {form.comentario.length}/500
          </p>
        </div>

        {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

        <button
          type="submit"
          disabled={submitting || !sesionObjetivo}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          {submitting ? 'Guardando...' : 'Guardar avance'}
        </button>

        {guardado && (
          <p className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Avance guardado correctamente.
          </p>
        )}
      </form>
    </div>
  )
}
