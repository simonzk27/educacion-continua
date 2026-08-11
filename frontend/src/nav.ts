import type { LucideIcon } from 'lucide-react'
import {
  LayoutGrid,
  Pencil,
  LayoutDashboard,
  Clock,
  FileText,
  Users,
  BookOpen,
} from 'lucide-react'

export type ViewId =
  | 'mi-panel'
  | 'registrar-avance'
  | 'dashboard-hoy'
  | 'horarios'
  | 'informe-semanal'
  | 'colaboradores'
  | 'listado-cursos'

export type NavItem = {
  id: ViewId
  label: string
  icon: LucideIcon
}

export type NavSection = {
  title: string
  items: NavItem[]
  adminOnly?: boolean
}

export const navSections: NavSection[] = [
  {
    title: 'Colaborador',
    items: [
      { id: 'mi-panel', label: 'Mi panel', icon: LayoutGrid },
      { id: 'registrar-avance', label: 'Registrar avance', icon: Pencil },
    ],
  },
  {
    title: 'Gerencia',
    adminOnly: true,
    items: [
      { id: 'dashboard-hoy', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'horarios', label: 'Horarios', icon: Clock },
      { id: 'informe-semanal', label: 'Informe semanal', icon: FileText },
    ],
  },
  {
    title: 'Administración',
    adminOnly: true,
    items: [{ id: 'colaboradores', label: 'Colaboradores', icon: Users }],
  },
  {
    title: 'Cursos',
    adminOnly: true,
    items: [{ id: 'listado-cursos', label: 'Listado de cursos', icon: BookOpen }],
  },
]

export const navLabels: Record<ViewId, string> = navSections
  .flatMap((s) => s.items)
  .reduce((acc, item) => ({ ...acc, [item.id]: item.label }), {} as Record<ViewId, string>)
