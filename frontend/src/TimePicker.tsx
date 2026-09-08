import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { formatHora } from './scheduleUtils'

function buildTimes(stepMinutes: number): string[] {
  const out: string[] = []
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const h = Math.floor(m / 60)
    const min = m % 60
    out.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }
  return out
}

const times = buildTimes(15)

function parseHoraEscrita(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '')
  if (digitos.length === 0) return null

  let horas: number
  let minutos: number
  if (digitos.length <= 2) {
    horas = Number(digitos)
    minutos = 0
  } else if (digitos.length === 3) {
    horas = Number(digitos.slice(0, 1))
    minutos = Number(digitos.slice(1))
  } else {
    const recortado = digitos.slice(0, 4)
    horas = Number(recortado.slice(0, 2))
    minutos = Number(recortado.slice(2))
  }

  if (!Number.isInteger(horas) || !Number.isInteger(minutos)) return null
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return null
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

type TimePickerProps = {
  value: string
  onChange: (hora: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function TimePicker({ value, onChange, disabled, placeholder = 'Seleccionar hora' }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState(value ? formatHora(value) : '')
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTexto(value ? formatHora(value) : '')
  }, [value])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const activo = listRef.current.querySelector('[data-activo="true"]')
    activo?.scrollIntoView({ block: 'center' })
  }, [open])

  function abrir() {
    if (disabled) return
    setOpen(true)
  }

  function elegir(hora: string) {
    onChange(hora)
    setTexto(formatHora(hora))
    setOpen(false)
  }

  function confirmarTexto() {
    const parseado = parseHoraEscrita(texto)
    if (parseado) {
      onChange(parseado)
      setTexto(formatHora(parseado))
    } else {
      setTexto(value ? formatHora(value) : '')
    }
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`flex w-full items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <Clock className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={texto}
          onFocus={abrir}
          onClick={abrir}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              confirmarTexto()
              inputRef.current?.blur()
            }
          }}
          onBlur={confirmarTexto}
          placeholder={placeholder}
          className={`w-full bg-transparent outline-none ${
            value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
          }`}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="bg-gradient-to-br from-blue-500 to-blue-400 px-4 py-2.5 text-center text-sm font-bold text-white dark:from-indigo-500 dark:to-indigo-400">
            {value ? formatHora(value) : 'Elegí una hora'}
          </div>
          <div ref={listRef} className="max-h-56 overflow-y-auto p-1.5">
            {times.map((t) => {
              const activo = t === value
              return (
                <button
                  key={t}
                  type="button"
                  data-activo={activo}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir(t)}
                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                    activo
                      ? 'bg-blue-600 font-semibold text-white dark:bg-indigo-500'
                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
                  }`}
                >
                  {formatHora(t)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
