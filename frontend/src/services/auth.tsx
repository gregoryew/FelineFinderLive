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
    console.log('🔵 signInWithGoogle called')
    console.log('🔵 Auth instance:', auth)
    console.log('🔵 Auth domain:', auth.config?.apiKey ? 'Configured' : 'Missing API Key')
    
    try {
      const provider = new GoogleAuthProvider()
      console.log('🔵 Provider created:', provider)
      
      // Only add basic scopes for Firebase Auth - calendar scope is handled separately
      provider.addScope('email')
      provider.addScope('profile')
      console.log('🔵 Scopes added')
      
      // Set custom parameters if needed (helps with some OAuth issues)
      provider.setCustomParameters({
        prompt: 'select_account'
      })
      console.log('🔵 Custom parameters set')
      
      console.log('🔵 About to call signInWithPopup...')
      console.log('🔵 Popup window should open now...')
      
      const result = await signInWithPopup(auth, provider)
      console.log('✅ Sign in successful:', result.user)
      console.log('✅ User UID:', result.user.uid)
      console.log('✅ User email:', result.user.email)
      return result
    } catch (error: any) {
      console.error('❌ Sign in error caught:', error)
      console.error('❌ Error code:', error.code)
      console.error('❌ Error message:', error.message)
      console.error('❌ Error details:', JSON.stringify(error, null, 2))
      console.error('❌ Full error object:', error)
      
      // Log additional context
      if (error.credential) {
        console.error('❌ Error credential:', error.credential)
      }
      if (error.email) {
        console.error('❌ Error email:', error.email)
      }
      if (error.customData) {
        console.error('❌ Error customData:', error.customData)
      }
      
      // Handle specific error cases with more detailed messages
      if (error.code === 'auth/popup-closed-by-user') {
        console.error('❌ User closed the popup window')
        throw new Error('Sign-in was cancelled. Please try again.')
      } else if (error.code === 'auth/popup-blocked') {
        console.error('❌ Popup was blocked by browser')
        throw new Error('Popup was blocked. Please allow popups for this site and try again.')
      } else if (error.code === 'auth/network-request-failed') {
        console.error('❌ Network request failed')
        throw new Error('Network error. Please check your connection and try again.')
      } else if (error.code === 'auth/unauthorized-domain') {
        console.error('❌ Domain not authorized')
        throw new Error('This domain is not authorized. Please contact support.')
      } else if (error.code === 'auth/configuration-not-found') {
        console.error('❌ OAuth configuration not found')
        throw new Error('Google sign-in is not configured. Please contact support.')
      } else if (error.code === 'auth/operation-not-allowed') {
        console.error('❌ Operation not allowed')
        throw new Error('Google sign-in is not enabled. Please contact support.')
      } else if (error.code === 'auth/popup-blocked') {
        console.error('❌ Popup blocked')
        throw new Error('Popup was blocked. Try using the redirect method instead.')
      } else {
        console.error('❌ Unknown error:', error.code || 'No error code')
        throw new Error(`Sign-in failed: ${error.message || error.code || 'Unknown error'}. Check browser console for details.`)
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
