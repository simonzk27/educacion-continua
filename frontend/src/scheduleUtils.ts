export type Dia = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'
export type Modo = 'semanal' | 'mensual'

export const diaIndex: Record<Dia, number> = {
  Lunes: 0,
  Martes: 1,
  Miércoles: 2,
  Jueves: 3,
  Viernes: 4,
  Sábado: 5,
  Domingo: 6,
}

export const diaCorto: Record<Dia, string> = {
  Lunes: 'Lun',
  Martes: 'Mar',
  Miércoles: 'Mié',
  Jueves: 'Jue',
  Viernes: 'Vie',
  Sábado: 'Sáb',
  Domingo: 'Dom',
}

export type HorarioOcurrencias = {
  modo: Modo
  dias: Dia[]
  fechas: string[]
  hora: string | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
}

export function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function todayIso(): string {
  return dateToIso(new Date())
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return dateToIso(dt)
}

export function ocurrenciasEntre(h: HorarioOcurrencias, desde: string, hasta: string): string[] {
  if (h.modo === 'mensual') {
    return h.fechas.filter((f) => f >= desde && f <= hasta).sort()
  }
  const diasSet = new Set(h.dias.map((d) => diaIndex[d]))
  if (diasSet.size === 0) return []
  const inicio = h.vigenciaInicio && h.vigenciaInicio > desde ? h.vigenciaInicio : desde
  const fin = h.vigenciaFin && h.vigenciaFin < hasta ? h.vigenciaFin : hasta
  if (inicio > fin) return []
  const [iy, im, id] = inicio.split('-').map(Number)
  const [fy, fm, fd] = fin.split('-').map(Number)
  const cursor = new Date(iy, im - 1, id)
  const finDate = new Date(fy, fm - 1, fd)
  const out: string[] = []
  let guard = 0
  while (cursor <= finDate && guard < 3000) {
    const weekday = (cursor.getDay() + 6) % 7
    if (diasSet.has(weekday)) out.push(dateToIso(cursor))
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  return out
}

export function formatHora(hora: string | null): string {
  if (!hora) return ''
  const [hStr, mStr] = hora.split(':')
  const h = Number(hStr)
  const suffix = h >= 12 ? 'p.m.' : 'a.m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${suffix}`
}

export function inicioSemanaIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dow)
  return dateToIso(date)
}

export function finSemanaIso(iso: string): string {
  return addDays(inicioSemanaIso(iso), 6)
}

export function formatFechaSesion(fecha: string): string {
  if (fecha === todayIso()) return 'Hoy'
  if (fecha === addDays(todayIso(), 1)) return 'Mañana'
  const [y, m, d] = fecha.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
