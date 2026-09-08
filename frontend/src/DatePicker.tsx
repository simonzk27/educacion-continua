import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { dateToIso, todayIso } from './scheduleUtils'

const diasCortos = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function parseIso(iso: string): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function buildGrid(viewDate: Date): (string | null)[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = (first.getDay() + 6) % 7
  const cells: (string | null)[] = new Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dateToIso(new Date(year, month, d)))
  }
  return cells
}

function formatDisplay(iso: string): string {
  const date = parseIso(iso)
  if (!date) return ''
  const label = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

type DatePickerProps = {
  value: string
  onChange: (iso: string) => void
  minDate?: string
  maxDate?: string
  disabled?: boolean
  placeholder?: string
}

export default function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled,
  placeholder = 'Seleccionar fecha',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseIso(value) ?? new Date())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggleOpen() {
    if (disabled) return
    if (!open) setViewDate(parseIso(value) ?? new Date())
    setOpen((o) => !o)
  }

  function irMes(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  function seleccionar(fecha: string) {
    onChange(fecha)
    setOpen(false)
  }

  const mesLabel = viewDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  const grid = buildGrid(viewDate)
  const hoy = todayIso()
  const hoyHabilitado = (!minDate || hoy >= minDate) && (!maxDate || hoy <= maxDate)

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={`flex w-full items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-left text-sm outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 ${
          value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        {value ? formatDisplay(value) : placeholder}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between bg-gradient-to-br from-blue-500 to-blue-400 px-4 py-3 text-white dark:from-indigo-500 dark:to-indigo-400">
            <button
              type="button"
              onClick={() => irMes(-1)}
              className="rounded-lg p-1 transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold capitalize">{mesLabel}</span>
            <button
              type="button"
              onClick={() => irMes(1)}
              className="rounded-lg p-1 transition-colors hover:bg-white/20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3.5">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
              {diasCortos.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {grid.map((fecha, i) => {
                if (!fecha) return <span key={`pad-${i}`} />
                const habilitado = (!minDate || fecha >= minDate) && (!maxDate || fecha <= maxDate)
                const activo = fecha === value
                const esHoy = fecha === hoy
                const dayNum = Number(fecha.split('-')[2])
                return (
                  <button
                    key={fecha}
                    type="button"
                    disabled={!habilitado}
                    onClick={() => seleccionar(fecha)}
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
            {hoyHabilitado && (
              <button
                type="button"
                onClick={() => seleccionar(hoy)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-400 dark:hover:text-indigo-400"
              >
                Hoy
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
