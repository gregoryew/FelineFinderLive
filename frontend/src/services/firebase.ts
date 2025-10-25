import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { FIRESTORE_CONFIG } from '../config/environment'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

// Determine if we're in local development
const isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

console.log('Firebase config:', {
  apiKey: firebaseConfig.apiKey ? 'Present' : 'Missing',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId ? 'Present' : 'Missing',
  firestoreEmulator: FIRESTORE_CONFIG.useEmulator ? 'Enabled' : 'Disabled (using production)',
  authEmulator: isLocalDevelopment ? 'Enabled (using Auth emulator)' : 'Disabled (using production)'
})

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)

// Connect to emulators only if configured
if (FIRESTORE_CONFIG.useEmulator) {
  try {
    connectFirestoreEmulator(db, FIRESTORE_CONFIG.emulatorHost, FIRESTORE_CONFIG.emulatorPort)
    console.log('Connected to Firestore emulator')
  } catch (error) {
    console.log('Firestore emulator already connected or not available')
  }
}

// Connect to Auth emulator in local development
if (isLocalDevelopment) {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    console.log('Connected to Auth emulator')
  } catch (error) {
    console.log('Auth emulator already connected or not available')
  }
} else {
  console.log('Using production Firebase Auth (not Auth emulator)')
}

// Connect to Functions emulator in local development
if (isLocalDevelopment) {
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    console.log('Connected to Functions emulator')
  } catch (error) {
    console.log('Functions emulator already connected or not available')
  }
} else {
  console.log('Using production Firebase Functions')
}

export default app
