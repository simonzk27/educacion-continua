type ButtonGroupProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly options: readonly string[]
  readonly className?: string
  readonly ariaLabel?: string
  readonly colorFor?: (opt: string) => string | undefined
}

export default function ButtonGroup({
  value,
  onChange,
  options,
  className = '',
  ariaLabel,
  colorFor,
}: ButtonGroupProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`grid gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const activo = value === opt
        const colorActivo = colorFor?.(opt)
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(opt)}
            className={`rounded-lg px-2 py-1.5 text-center text-xs leading-tight font-medium break-words transition-all focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none dark:focus-visible:ring-indigo-400 ${
              activo
                ? (colorActivo ?? 'bg-white text-blue-700 shadow-sm dark:bg-gray-950 dark:text-indigo-400')
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
