import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  User, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged 
} from 'firebase/auth'
import { auth } from './firebase'
import { apiKeyService } from './apiKeyService'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<any>
  signInWithGoogleRedirect: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('AuthProvider: Initializing...')
    
    // Initialize API key service on app startup
    apiKeyService.initialize().catch(error => {
      console.error('Failed to initialize API key service:', error)
    })
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user)
      if (user) {
        console.log('User info:', {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        })
      }
      setUser(user)
      setLoading(false)
    })

    // Check for redirect result immediately
    getRedirectResult(auth).then((result) => {
      console.log('Checking redirect result:', result)
      if (result) {
        console.log('Redirect sign-in successful:', result.user)
        // The onAuthStateChanged will handle setting the user
      } else {
        console.log('No redirect result found')
      }
    }).catch((error) => {
      console.error('Redirect sign-in error:', error)
    })

    return unsubscribe
  }, [])


  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      // Only add basic scopes for Firebase Auth - calendar scope is handled separately
      provider.addScope('email')
      provider.addScope('profile')
      
      const result = await signInWithPopup(auth, provider)
      console.log('Sign in successful:', result.user)
      return result
    } catch (error: any) {
      console.error('Sign in error:', error)
      
      // Handle specific error cases
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.')
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked. Please allow popups for this site.')
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Network error. Please check your connection.')
      } else {
        throw new Error(`Sign-in failed: ${error.message}`)
      }
    }
  }

  const signInWithGoogleRedirect = async () => {
    try {
      const provider = new GoogleAuthProvider()
      // Only add basic scopes for Firebase Auth - calendar scope is handled separately
      provider.addScope('email')
      provider.addScope('profile')
      
      await signInWithRedirect(auth, provider)
    } catch (error: any) {
      console.error('Redirect sign-in error:', error)
      throw new Error(`Sign-in failed: ${error.message}`)
    }
  }

  const logout = async () => {
    await signOut(auth)
  }

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithGoogleRedirect,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
