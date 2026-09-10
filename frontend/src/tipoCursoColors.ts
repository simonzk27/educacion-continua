export type TipoCurso = 'Educación Continua' | 'Unimetab' | 'Academia'

type TipoCursoEstilo = {
  badge: string
  activo: string
  dot: string
  borde: string
  texto: string
  hex: string
}

export const tipoCursoColores: Record<TipoCurso, TipoCursoEstilo> = {
  'Educación Continua': {
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    activo: 'bg-blue-600 text-white shadow-sm dark:bg-blue-500',
    dot: 'bg-blue-600 dark:bg-blue-400',
    borde: 'border-blue-500 dark:border-blue-400',
    texto: 'text-blue-700 dark:text-blue-400',
    hex: '#2563eb',
  },
  Unimetab: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    activo: 'bg-amber-500 text-white shadow-sm dark:bg-amber-500',
    dot: 'bg-amber-500 dark:bg-amber-400',
    borde: 'border-amber-500 dark:border-amber-400',
    texto: 'text-amber-700 dark:text-amber-400',
    hex: '#f59e0b',
  },
  Academia: {
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    activo: 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500',
    dot: 'bg-emerald-600 dark:bg-emerald-400',
    borde: 'border-emerald-500 dark:border-emerald-400',
    texto: 'text-emerald-700 dark:text-emerald-400',
    hex: '#10b981',
  },
}

export function estiloTipoCurso(tipo: string | null | undefined): TipoCursoEstilo | null {
  if (tipo && tipo in tipoCursoColores) return tipoCursoColores[tipo as TipoCurso]
  return null
}

export function colorActivoTipoCurso(opt: string): string | undefined {
  return estiloTipoCurso(opt)?.activo
}
