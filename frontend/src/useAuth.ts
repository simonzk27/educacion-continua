import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

export type Role = 'Admin' | 'Usuario'

type AuthState = {
  firebaseUser: FirebaseUser | null
  role: Role | null
  nombre: string | null
  puedeCambiarPassword: boolean
  loading: boolean
  blockedMessage: string | null
}

const roleMap: Record<string, Role> = {
  admin: 'Admin',
  usuario: 'Usuario',
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    firebaseUser: null,
    role: null,
    nombre: null,
    puedeCambiarPassword: false,
    loading: true,
    blockedMessage: null,
  })

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setState((prev) => ({
          firebaseUser: null,
          role: null,
          nombre: null,
          puedeCambiarPassword: false,
          loading: false,
          blockedMessage: prev.blockedMessage,
        }))
        return
      }

      const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
      const data = snap.data()
      const activo = data?.activo !== false

      if (!snap.exists() || !activo) {
        await signOut(auth)
        setState({
          firebaseUser: null,
          role: null,
          nombre: null,
          puedeCambiarPassword: false,
          loading: false,
          blockedMessage: 'Tu cuenta está inactiva. Contactá al administrador.',
        })
        return
      }

      const rawRole = data?.rol as string
      const role = roleMap[rawRole] ?? null
      const nombre = (data?.nombre as string) || firebaseUser.email
      const puedeCambiarPassword = data?.puedeCambiarPassword === true
      setState({ firebaseUser, role, nombre, puedeCambiarPassword, loading: false, blockedMessage: null })
    })
  }, [])

  return state
}
