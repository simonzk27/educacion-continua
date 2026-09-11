import { lazy, Suspense, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { signOut } from 'firebase/auth'
import Login from './Login'
import Sidebar from './Sidebar'
import MiPanel from './MiPanel'
import RegistrarAvance from './RegistrarAvance'
import MiPerfil from './MiPerfil'
import ComingSoon from './ComingSoon'
import { useTheme } from './useTheme'
import { useAuth } from './useAuth'
import { auth } from './firebase'
import { navSections, navLabels, type ViewId } from './nav'

const Dashboard = lazy(() => import('./Dashboard'))
const Horarios = lazy(() => import('./Horarios'))
const InformeSemanal = lazy(() => import('./InformeSemanal'))
const Colaboradores = lazy(() => import('./Colaboradores'))
const ListadoCursos = lazy(() => import('./ListadoCursos'))
const Alertas = lazy(() => import('./Alertas'))
const AjustarCompletado = lazy(() => import('./AjustarCompletado'))

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
  const [preselectCursoId, setPreselectCursoId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    setActiveView('mi-panel')
  }, [firebaseUser?.uid])

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

  const vistaPermitida =
    role === 'Admin' ||
    activeView === 'mi-perfil' ||
    navSections.some((s) => !s.adminOnly && s.items.some((i) => i.id === activeView))
  const vista = vistaPermitida ? activeView : 'mi-panel'

  let content: React.ReactNode
  if (vista === 'mi-panel') {
    content = (
      <MiPanel
        nombre={nombre}
        userId={firebaseUser.uid}
        puedeCambiarPassword={puedeCambiarPassword}
        onRegistrarAvance={(cursoId) => {
          setPreselectCursoId(cursoId ?? null)
          setActiveView('registrar-avance')
        }}
      />
    )
  } else if (vista === 'registrar-avance') {
    content = <RegistrarAvance userId={firebaseUser.uid} preselectCursoId={preselectCursoId} />
  } else if (vista === 'dashboard-hoy') {
    content = <Dashboard isAdmin={role === 'Admin'} />
  } else if (vista === 'horarios') {
    content = <Horarios />
  } else if (vista === 'informe-semanal') {
    content = <InformeSemanal />
  } else if (vista === 'colaboradores') {
    content = <Colaboradores />
  } else if (vista === 'listado-cursos') {
    content = <ListadoCursos />
  } else if (vista === 'alertas') {
    content = <Alertas userId={firebaseUser.uid} />
  } else if (vista === 'ajustar-completado') {
    content = <AjustarCompletado />
  } else if (vista === 'mi-perfil') {
    content = (
      <MiPerfil
        nombre={nombre}
        email={firebaseUser.email}
        rol={role}
        puedeCambiarPassword={puedeCambiarPassword}
      />
    )
  } else {
    content = <ComingSoon title={navLabels[vista]} />
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
