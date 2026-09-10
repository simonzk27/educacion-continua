export type OrdenOpcion = 'az' | 'za' | 'reciente' | 'antiguo'

export const ordenOpciones: { value: OrdenOpcion; label: string }[] = [
  { value: 'az', label: 'Nombre A-Z' },
  { value: 'za', label: 'Nombre Z-A' },
  { value: 'reciente', label: 'Más reciente' },
  { value: 'antiguo', label: 'Más antiguo' },
]

type ConFecha = { toMillis: () => number } | null | undefined

export function ordenarPorNombreYFecha<T>(
  items: T[],
  orden: OrdenOpcion,
  getNombre: (item: T) => string,
  getCreadoEn: (item: T) => ConFecha,
): T[] {
  const copia = [...items]
  if (orden === 'az') return copia.sort((a, b) => getNombre(a).localeCompare(getNombre(b)))
  if (orden === 'za') return copia.sort((a, b) => getNombre(b).localeCompare(getNombre(a)))
  const millis = (item: T) => getCreadoEn(item)?.toMillis() ?? 0
  if (orden === 'reciente') return copia.sort((a, b) => millis(b) - millis(a))
  return copia.sort((a, b) => millis(a) - millis(b))
}
