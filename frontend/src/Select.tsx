import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export type SelectOption = { value: string; label: string }

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: (SelectOption | string)[]
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  searchable?: boolean
}

function toOption(o: SelectOption | string): SelectOption {
  return typeof o === 'string' ? { value: o, label: o } : o
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  disabled,
  id,
  className = '',
  searchable = false,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const normalizadas = options.map(toOption)
  const seleccionada = normalizadas.find((o) => o.value === value)
  const terminoBusqueda = normalizar(busqueda.trim())
  const visibles = terminoBusqueda
    ? normalizadas.filter((o) => normalizar(o.label).includes(terminoBusqueda))
    : normalizadas

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (open && searchable) inputRef.current?.focus()
    if (!open) setBusqueda('')
  }, [open, searchable])

  function elegir(v: string) {
    onChange(v)
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 py-2 text-left text-sm outline-none transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 ${
          seleccionada ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        <span className="truncate">{seleccionada ? seleccionada.label : placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-max overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          {searchable && (
            <div className="relative border-b border-gray-100 p-1.5 dark:border-gray-800">
              <Search className="pointer-events-none absolute top-1/2 left-4 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded-lg border border-gray-200 py-1.5 pr-7 pl-8 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <div className="max-h-56 overflow-auto py-1">
            {visibles.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Sin resultados.</p>
            ) : (
              visibles.map((o) => {
                const activo = o.value === value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => elegir(o.value)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      activo
                        ? 'bg-blue-50 font-medium text-blue-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {activo && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
