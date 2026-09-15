import { useState, type FormEvent } from 'react'
import { X, CalendarClock, Clock, Timer, CalendarRange, CalendarDays } from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import TimePicker from './TimePicker'

export type Dia = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'
type Modo = 'semanal' | 'mensual'

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

function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayIso(): string {
  return dateToIso(new Date())
}

function endOfMonthIso(): string {
  const now = new Date()
  return dateToIso(new Date(now.getFullYear(), now.getMonth() + 1, 0))
}

function formatHora(hora: string | null): string {
  if (!hora) return '–'
  const [hStr, mStr] = hora.split(':')
  const h = Number(hStr)
  const suffix = h >= 12 ? 'p.m.' : 'a.m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${suffix}`
}

function formatFechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

const mesLabel = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

function buildMonthGrid(): (string | null)[] {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const startOffset = (first.getDay() + 6) % 7 // lunes=0
  const cells: (string | null)[] = new Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dateToIso(new Date(now.getFullYear(), now.getMonth(), d)))
  }
  return cells
}

export type HorarioExistente = {
  modo: Modo
  dias: Dia[]
  fechas: string[]
  hora: string | null
  duracionMin: number | null
  vigenciaInicio: string | null
}

type HorarioFormModalProps = {
  userId: string
  cursoId: string
  colaborador: string
  curso: string
  horario: HorarioExistente | null
  onClose: () => void
  onSaved: () => void
}

function horarioId(cursoId: string, userId: string): string {
  return `${cursoId}_${userId}`
}

export default function HorarioFormModal({
  userId,
  cursoId,
  colaborador,
  curso,
  horario,
  onClose,
  onSaved,
}: HorarioFormModalProps) {
  const horas = horario?.duracionMin ? Math.floor(horario.duracionMin / 60) : 0
  const minutos = horario?.duracionMin ? horario.duracionMin % 60 : 0
  const [form, setForm] = useState({
    dias: horario?.dias ?? [],
    fechas: horario?.fechas ?? [],
    hora: horario?.hora ?? '',
    duracionHoras: horas ? String(horas) : '',
    duracionMinutos: minutos ? String(minutos) : '',
    programarMes: horario?.modo === 'mensual',
  })
  const [monthGrid] = useState(buildMonthGrid)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function toggleDia(d: Dia) {
    setForm((prev) => ({
      ...prev,
      dias: prev.dias.includes(d) ? prev.dias.filter((x) => x !== d) : [...prev.dias, d],
    }))
  }

  function toggleFecha(fecha: string) {
    setForm((prev) => ({
      ...prev,
      fechas: prev.fechas.includes(fecha) ? prev.fechas.filter((x) => x !== fecha) : [...prev.fechas, fecha],
    }))
  }

  function duracionTotalMin(): number {
    return Number(form.duracionHoras || 0) * 60 + Number(form.duracionMinutos || 0)
  }

  function validar(): string | null {
    if (form.programarMes) {
      if (form.fechas.length === 0) return 'Seleccioná al menos una fecha en el calendario.'
    } else if (form.dias.length === 0) {
      return 'Seleccioná al menos un día.'
    }
    if (!form.hora) return 'Seleccioná una hora.'
    if (duracionTotalMin() <= 0) return 'Ingresá una duración válida.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validar()
    if (err) {
      setFormError(err)
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        userId,
        cursoId,
        modo: form.programarMes ? 'mensual' : 'semanal',
        dias: form.programarMes ? [] : form.dias,
        fechas: form.programarMes ? form.fechas : [],
        hora: form.hora,
        duracionMin: duracionTotalMin(),
        vigenciaFin: form.programarMes ? endOfMonthIso() : null,
      }
      if (!horario?.vigenciaInicio) {
        payload.vigenciaInicio = todayIso()
      }
      await setDoc(doc(db, 'horarios', horarioId(cursoId, userId)), payload, { merge: true })
      onSaved()
    } catch {
      setFormError('No se pudo guardar el horario. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <CalendarClock className="h-5.5 w-5.5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Editar horario</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {colaborador} · {curso}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5 dark:border-gray-800">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <CalendarRange className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              Programar solo este mes
            </span>
            <input
              type="checkbox"
              checked={form.programarMes}
              onChange={(e) => setForm({ ...form, programarMes: e.target.checked })}
              className="h-5 w-5 accent-blue-600 dark:accent-indigo-500"
            />
          </label>

          {form.programarMes ? (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between bg-gradient-to-br from-blue-500 to-blue-400 px-4 py-3 text-white dark:from-indigo-500 dark:to-indigo-400">
                <span className="flex items-center gap-2 text-sm font-bold capitalize">
                  <CalendarDays className="h-4 w-4" />
                  {mesLabel}
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold backdrop-blur-sm">
                  {form.fechas.length} fecha{form.fechas.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="p-3.5">
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                  {dias.map((d) => (
                    <span key={d}>{diaCorto[d]}</span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {monthGrid.map((fecha, i) => {
                    if (!fecha) return <span key={`pad-${i}`} />
                    const habilitado = fecha >= todayIso()
                    const activo = form.fechas.includes(fecha)
                    const esHoy = fecha === todayIso()
                    const dayNum = Number(fecha.split('-')[2])
                    return (
                      <button
                        key={fecha}
                        type="button"
                        disabled={!habilitado}
                        onClick={() => toggleFecha(fecha)}
                        className={`relative flex aspect-square items-center justify-center rounded-full text-sm font-medium transition-all ${
                          activo
                            ? 'scale-105 bg-blue-600 text-white shadow-md shadow-blue-600/30 dark:bg-indigo-500 dark:shadow-indigo-500/30'
                            : habilitado
                              ? 'text-gray-700 hover:scale-105 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
                              : 'text-gray-300 dark:text-gray-700'
                        }`}
                      >
                        {dayNum}
                        {esHoy && !activo && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500 dark:bg-indigo-400" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
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
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="hfmHora"
                className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                Hora
              </label>
              <TimePicker id="hfmHora" value={form.hora} onChange={(hora) => setForm({ ...form, hora })} />
            </div>
            <div>
              <label
                htmlFor="hfmDuracionHoras"
                className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <Timer className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                Horas
              </label>
              <input
                id="hfmDuracionHoras"
                type="number"
                min="0"
                value={form.duracionHoras}
                onChange={(e) => setForm({ ...form, duracionHoras: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="hfmDuracionMinutos"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Minutos
              </label>
              <input
                id="hfmDuracionMinutos"
                type="number"
                min="0"
                max="59"
                value={form.duracionMinutos}
                onChange={(e) => setForm({ ...form, duracionMinutos: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-sm text-blue-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
            {(form.programarMes ? form.fechas.length > 0 : form.dias.length > 0) && form.hora ? (
              <span>
                Se dictará{' '}
                <strong className="font-semibold">
                  {form.programarMes
                    ? [...form.fechas].sort().map((f) => formatFechaCorta(f)).join(', ')
                    : [...form.dias].sort((a, b) => diaIndex[a] - diaIndex[b]).join(', ')}
                </strong>{' '}
                a las <strong className="font-semibold">{formatHora(form.hora)}</strong>
                {duracionTotalMin() > 0 ? (
                  <>
                    {' '}
                    ·{' '}
                    <strong className="font-semibold">
                      {form.duracionHoras ? `${form.duracionHoras} h ` : ''}
                      {form.duracionMinutos ? `${form.duracionMinutos} min` : ''}
                    </strong>
                  </>
                ) : null}
              </span>
            ) : (
              <span className="text-blue-700/70 dark:text-indigo-300/70">
                {form.programarMes
                  ? 'Seleccioná fechas del calendario y una hora para ver el resumen.'
                  : 'Seleccioná días y hora para ver el resumen del horario.'}
              </span>
            )}
          </div>

          {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

          <div className="mt-1 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <CalendarClock className="h-4 w-4" />
              {submitting ? 'Guardando...' : 'Guardar horario'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
