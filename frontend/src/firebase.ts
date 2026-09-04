import { initializeApp, getApps, deleteApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// autoDetectLongPolling: en la primera carga (recién logueado, conexión WebChannel
// todavía sin establecer) los onSnapshot podían quedar colgados sin error visible
// hasta desmontar/remontar el listener al cambiar de módulo. Forzar long-polling
// cuando el streaming falla evita ese primer listener "mudo".
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true })

// Secondary app instance: crea usuarios nuevos (Admin) sin pisar la sesión activa.
export function getSecondaryAuth() {
  const existing = getApps().find((a) => a.name === 'secondary')
  const secondaryApp = existing ?? initializeApp(firebaseConfig, 'secondary')
  return getAuth(secondaryApp)
}

export async function disposeSecondaryApp() {
  const existing = getApps().find((a) => a.name === 'secondary')
  if (existing) await deleteApp(existing)
}
