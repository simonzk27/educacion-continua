import { useEffect, useRef, useState } from 'react'
import { ChevronsLeft, ChevronsRight, LogOut, Moon, Sun } from 'lucide-react'
import { navSections, type ViewId } from './nav'
import type { Theme } from './useTheme'

type User = 'Admin' | 'Usuario'

type SidebarProps = {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
  role: User
  nombre: string | null
  collapsed: boolean
  onToggleCollapsed: () => void
  theme: Theme
  onToggleTheme: () => void
  onLogout: () => void
}

export default function Sidebar({
  activeView,
  onNavigate,
  role,
  nombre,
  collapsed,
  onToggleCollapsed,
  theme,
  onToggleTheme,
  onLogout,
}: SidebarProps) {
  const sections = navSections.filter((s) => !s.adminOnly || role === 'Admin')
  const displayName = nombre ?? 'Usuario'
  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'U'
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [userMenuOpen])

  return (
    <aside
      className={`flex h-full flex-col border-r border-gray-200 bg-white transition-[width] duration-200 dark:border-gray-800 dark:bg-gray-950 ${
        collapsed ? 'w-[76px]' : 'w-64'
      }`}
    >
      <div
        className={`flex items-center gap-3 border-b border-gray-200 px-4 py-5 dark:border-gray-800 ${
          collapsed ? 'flex-col' : 'justify-between'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
            EC
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                Educación Continua
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                Gestión y seguimiento
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expandir' : 'Minimizar'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400 ${
            collapsed ? 'mt-1' : ''
          }`}
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            {!collapsed && (
              <p className="mb-2 px-2 text-[11px] font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = item.id === activeView
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      title={collapsed ? item.label : undefined}
                      onClick={() => onNavigate(item.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        isActive
                          ? 'bg-blue-50 text-blue-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-800">
        <div ref={userMenuRef} className="relative">
          {userMenuOpen && (
            <div
              className={`absolute bottom-full mb-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900 ${
                collapsed ? 'left-0 w-40' : 'left-0 right-0'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false)
                  onLogout()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Cerrar sesión
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setUserMenuOpen((open) => !open)}
            title={collapsed ? displayName : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-900 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {displayName}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{role}</p>
              </div>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          title={collapsed ? 'Cambiar tema' : undefined}
          className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span>Cambiar tema</span>}
        </button>
      </div>
    </aside>
  )
}
