import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { formatHora } from './scheduleUtils'

const horas12 = Array.from({ length: 12 }, (_, i) => i + 1)
const minutos = [0, 15, 30, 45]

type Ampm = 'AM' | 'PM'

function parseHora(value: string): { hora12: number; ampm: Ampm; minuto: number } | null {
  if (!value) return null
  const [hStr, mStr] = value.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  const ampm: Ampm = h >= 12 ? 'PM' : 'AM'
  let hora12 = h % 12
  if (hora12 === 0) hora12 = 12
  return { hora12, ampm, minuto: m }
}

function combinar(hora12: number, ampm: Ampm, minuto: number): string {
  let h = hora12 % 12
  if (ampm === 'PM') h += 12
  return `${String(h).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

function parseHoraEscrita(texto: string): string | null {
  const esPm = /p\.?\s*m/i.test(texto)
  const esAm = /a\.?\s*m/i.test(texto)
  const digitos = texto.replace(/\D/g, '')
  if (digitos.length === 0) return null

  let horas: number
  let minutosEscritos: number
  if (digitos.length <= 2) {
    horas = Number(digitos)
    minutosEscritos = 0
  } else if (digitos.length === 3) {
    horas = Number(digitos.slice(0, 1))
    minutosEscritos = Number(digitos.slice(1))
  } else {
    const recortado = digitos.slice(0, 4)
    horas = Number(recortado.slice(0, 2))
    minutosEscritos = Number(recortado.slice(2))
  }

  if (!Number.isInteger(horas) || !Number.isInteger(minutosEscritos)) return null

  if (esPm || esAm) {
    if (horas < 1 || horas > 12) return null
    if (esPm && horas < 12) horas += 12
    if (esAm && horas === 12) horas = 0
  }

  if (horas < 0 || horas > 23 || minutosEscritos < 0 || minutosEscritos > 59) return null
  return `${String(horas).padStart(2, '0')}:${String(minutosEscritos).padStart(2, '0')}`
}

type TimePickerProps = {
  value: string
  onChange: (hora: string) => void
  disabled?: boolean
  placeholder?: string
  id?: string
}

export default function TimePicker({
  value,
  onChange,
  disabled,
  placeholder = 'Seleccionar hora',
  id,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [texto, setTexto] = useState(value ? formatHora(value) : '')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = parseHora(value)

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

  function abrir() {
    if (disabled) return
    setOpen(true)
  }

  function elegirAmpm(ampm: Ampm) {
    onChange(combinar(parsed?.hora12 ?? 12, ampm, parsed?.minuto ?? 0))
  }

  function elegirHora(hora12: number) {
    onChange(combinar(hora12, parsed?.ampm ?? 'AM', parsed?.minuto ?? 0))
  }

  function elegirMinuto(minuto: number) {
    onChange(combinar(parsed?.hora12 ?? 12, parsed?.ampm ?? 'AM', minuto))
  }

  function confirmarTexto() {
    if (texto === (value ? formatHora(value) : '')) {
      setOpen(false)
      return
    }
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
          id={id}
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
        <div className="absolute z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="bg-gradient-to-br from-blue-500 to-blue-400 px-4 py-2.5 text-center text-sm font-bold text-white dark:from-indigo-500 dark:to-indigo-400">
            {value ? formatHora(value) : 'Elegí una hora'}
          </div>
          <div className="flex flex-col gap-3 p-3">
            <div className="grid grid-cols-2 gap-1.5">
              {(['AM', 'PM'] as const).map((a) => {
                const activo = parsed?.ampm === a
                return (
                  <button
                    key={a}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => elegirAmpm(a)}
                    className={`rounded-lg py-1.5 text-sm font-semibold transition-colors ${
                      activo
                        ? 'bg-blue-600 text-white dark:bg-indigo-500'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {a}
                  </button>
                )
              })}
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                Hora
              </p>
              <div className="grid grid-cols-4 gap-1">
                {horas12.map((h) => {
                  const activo = parsed?.hora12 === h
                  return (
                    <button
                      key={h}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegirHora(h)}
                      className={`rounded-lg py-1.5 text-sm font-medium transition-colors ${
                        activo
                          ? 'bg-blue-600 font-semibold text-white dark:bg-indigo-500'
                          : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
                      }`}
                    >
                      {h}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                Minutos
              </p>
              <div className="grid grid-cols-4 gap-1">
                {minutos.map((m) => {
                  const activo = parsed?.minuto === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => elegirMinuto(m)}
                      className={`rounded-lg py-1.5 text-sm font-medium transition-colors ${
                        activo
                          ? 'bg-blue-600 font-semibold text-white dark:bg-indigo-500'
                          : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400'
                      }`}
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
