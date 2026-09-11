import type { ReactElement, ReactNode } from 'react'

function BanderaColombia() {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 shrink-0 rounded-[2px] shadow-sm" aria-hidden="true">
      <rect width="20" height="14" fill="#FCD116" />
      <rect width="20" height="7" y="7" fill="#003893" />
      <rect width="20" height="3.5" y="10.5" fill="#CE1126" />
    </svg>
  )
}

function BanderaUSA() {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 shrink-0 rounded-[2px] shadow-sm" aria-hidden="true">
      <rect width="20" height="14" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((y) => (
        <rect key={y} width="20" height="1" y={y} fill="#fff" />
      ))}
      <rect width="9" height="7.5" fill="#3C3B6E" />
    </svg>
  )
}

const banderas: Record<string, () => ReactElement> = {
  Colombia: BanderaColombia,
  USA: BanderaUSA,
}

export function iconoEquipo(opt: string): ReactNode | undefined {
  const Bandera = banderas[opt]
  return Bandera ? <Bandera /> : undefined
}
