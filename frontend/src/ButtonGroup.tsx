type ButtonGroupProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly options: readonly string[]
  readonly className?: string
  readonly ariaLabel?: string
  readonly labelledBy?: string
  readonly colorFor?: (opt: string) => string | undefined
  readonly iconFor?: (opt: string) => React.ReactNode | undefined
  readonly noWrap?: boolean
}

export default function ButtonGroup({
  value,
  onChange,
  options,
  className = '',
  ariaLabel,
  labelledBy,
  colorFor,
  iconFor,
  noWrap,
}: ButtonGroupProps) {
  return (
    <div
      role="group"
      aria-label={labelledBy ? undefined : ariaLabel}
      aria-labelledby={labelledBy}
      className={`grid gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const activo = value === opt
        const colorActivo = colorFor?.(opt)
        const icono = iconFor?.(opt)
        return (
          <button
            key={opt}
            type="button"
            title={opt}
            aria-pressed={activo}
            onClick={() => onChange(opt)}
            className={`flex items-center justify-center rounded-lg px-2 py-1.5 text-center text-xs leading-tight font-medium transition-all focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none dark:focus-visible:ring-indigo-400 ${
              noWrap ? 'whitespace-nowrap' : 'break-words'
            } ${
              activo
                ? (colorActivo ?? 'bg-white text-blue-700 shadow-sm dark:bg-gray-950 dark:text-indigo-400')
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {icono ?? opt}
          </button>
        )
      })}
    </div>
  )
}
