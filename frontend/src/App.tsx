import { lazy, Suspense, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { signOut } from 'firebase/auth'
import Login from './Login'
import Sidebar from './Sidebar'
import MiPanel from './MiPanel'
import RegistrarAvance from './RegistrarAvance'
import ComingSoon from './ComingSoon'
import { useTheme } from './useTheme'
import { useAuth } from './useAuth'
import { auth } from './firebase'
import { navLabels, type ViewId } from './nav'

const Dashboard = lazy(() => import('./Dashboard'))
const Horarios = lazy(() => import('./Horarios'))
const InformeSemanal = lazy(() => import('./InformeSemanal'))
const Colaboradores = lazy(() => import('./Colaboradores'))
const ListadoCursos = lazy(() => import('./ListadoCursos'))
const Alertas = lazy(() => import('./Alertas'))

function ViewFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-indigo-400" />
    </div>
  )
}

function App() {
  const { firebaseUser, role, nombre, puedeCambiarPassword, loading, blockedMessage } = useAuth()
  const [activeView, setActiveView] = useState<ViewId>('mi-panel')
  const [collapsed, setCollapsed] = useState(false)
  const { theme, toggleTheme } = useTheme()

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-indigo-400" />
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
    content = (
      <MiPanel
        nombre={nombre}
        userId={firebaseUser.uid}
        puedeCambiarPassword={puedeCambiarPassword}
        onRegistrarAvance={() => setActiveView('registrar-avance')}
      />
    )
  } else if (activeView === 'registrar-avance') {
    content = <RegistrarAvance userId={firebaseUser.uid} />
  } else if (activeView === 'dashboard-hoy') {
    content = <Dashboard isAdmin={role === 'Admin'} />
  } else if (activeView === 'horarios') {
    content = <Horarios />
  } else if (activeView === 'informe-semanal') {
    content = <InformeSemanal />
  } else if (activeView === 'colaboradores') {
    content = <Colaboradores />
  } else if (activeView === 'listado-cursos') {
    content = <ListadoCursos />
  } else if (activeView === 'alertas') {
    content = <Alertas userId={firebaseUser.uid} />
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
      <main className="flex-1 overflow-y-auto p-6">
        <Suspense fallback={<ViewFallback />}>{content}</Suspense>
      </main>
    </div>
  )
}

export default App
