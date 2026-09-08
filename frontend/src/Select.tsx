import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [pos, setPos] = useState<{ top: number; left: number; width: number; abrirArriba: boolean } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const normalizadas = options.map(toOption)
  const seleccionada = normalizadas.find((o) => o.value === value)
  const palabrasBusqueda = normalizar(busqueda.trim()).split(/\s+/).filter(Boolean)
  const visibles =
    palabrasBusqueda.length === 0
      ? normalizadas
      : normalizadas.filter((o) => {
          const texto = normalizar(o.label)
          return palabrasBusqueda.every((p) => texto.includes(p))
        })

  function calcularPosicion() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const espacioAbajo = window.innerHeight - rect.bottom
    const abrirArriba = espacioAbajo < 280 && rect.top > espacioAbajo
    setPos({
      top: abrirArriba ? rect.top - 6 : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      abrirArriba,
    })
  }

  useEffect(() => {
    if (!open) return
    calcularPosicion()
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleReposicionar() {
      calcularPosicion()
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleReposicionar, true)
    window.addEventListener('resize', handleReposicionar)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleReposicionar, true)
      window.removeEventListener('resize', handleReposicionar)
    }
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
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
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

      {open &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: pos.abrirArriba ? undefined : pos.top,
              bottom: pos.abrirArriba ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              minWidth: pos.width,
            }}
            className="z-50 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900"
          >
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
          </div>,
          document.body,
        )}
    </div>
  )
}
