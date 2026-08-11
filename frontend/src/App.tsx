import { useState } from 'react'
import { signOut } from 'firebase/auth'
import Login from './Login'
import Sidebar from './Sidebar'
import MiPanel from './MiPanel'
import RegistrarAvance from './RegistrarAvance'
import Dashboard from './Dashboard'
import Horarios from './Horarios'
import InformeSemanal from './InformeSemanal'
import Colaboradores from './Colaboradores'
import ListadoCursos from './ListadoCursos'
import ComingSoon from './ComingSoon'
import { useTheme } from './useTheme'
import { useAuth } from './useAuth'
import { auth } from './firebase'
import { navLabels, type ViewId } from './nav'

function App() {
  const { firebaseUser, role, nombre, loading, blockedMessage } = useAuth()
  const [activeView, setActiveView] = useState<ViewId>('mi-panel')
  const [collapsed, setCollapsed] = useState(false)
  const { theme, toggleTheme } = useTheme()

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando...</p>
      </div>
    )
  }

  if (!firebaseUser || !role) {
    return <Login blockedMessage={blockedMessage} />
  }

  const user = role

  let content: React.ReactNode
  if (activeView === 'mi-panel') {
    content = <MiPanel nombre={nombre} onRegistrarAvance={() => setActiveView('registrar-avance')} />
  } else if (activeView === 'registrar-avance') {
    content = <RegistrarAvance />
  } else if (activeView === 'dashboard-hoy') {
    content = <Dashboard />
  } else if (activeView === 'horarios') {
    content = <Horarios />
  } else if (activeView === 'informe-semanal') {
    content = <InformeSemanal />
  } else if (activeView === 'colaboradores') {
    content = <Colaboradores />
  } else if (activeView === 'listado-cursos') {
    content = <ListadoCursos />
  } else {
    content = <ComingSoon title={navLabels[activeView]} />
  }

  return (
    <div className="flex h-full w-full bg-gray-50 dark:bg-gray-950">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        role={user}
        nombre={nombre}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={() => signOut(auth)}
      />
      <main className="flex-1 overflow-y-auto p-6">{content}</main>
    </div>
  )
}

export default App
