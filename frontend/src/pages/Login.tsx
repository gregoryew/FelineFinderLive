import React, { useState } from 'react'
import { useAuth } from '../services/auth'
import { Navigate } from 'react-router-dom'

const Login: React.FC = () => {
  const { user, signInWithGoogle, signInWithGoogleRedirect } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to="/onboarding" replace />
  }

  const handleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('=== SIGN-IN TEST START ===')
      console.log('Timestamp:', new Date().toISOString())
      console.log('Window location:', window.location.href)
      console.log('User before sign-in:', user)
      console.log('Starting Google sign-in with popup...')
      
      // Add a timeout to detect if popup closes immediately
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Popup may have closed - no response after 5 seconds')
      }, 5000)
      
      const result = await signInWithGoogle()
      clearTimeout(timeoutId)
      
      console.log('✅ Popup sign-in successful:', result)
      console.log('✅ User after sign-in:', result.user)
      console.log('=== SIGN-IN TEST END ===')
    } catch (err: any) {
      console.error('=== SIGN-IN ERROR ===')
      console.error('Timestamp:', new Date().toISOString())
      console.error('Sign in error:', err)
      console.error('Error code:', err.code)
      console.error('Error message:', err.message)
      console.error('Error stack:', err.stack)
      setError(err.message || 'Failed to sign in. Please try again.')
      
      // Show additional debugging info
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup closed. This might be due to a popup blocker or the window closing too quickly. Try using the redirect method below.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignInRedirect = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('=== REDIRECT SIGN-IN START ===')
      console.log('Using redirect method instead of popup...')
      
      await signInWithGoogleRedirect()
      // Note: User will be redirected, so this won't complete
    } catch (err: any) {
      console.error('Redirect sign-in error:', err)
      setError(err.message || 'Failed to initiate redirect sign-in.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access the Feline Finder Organization Portal
          </p>
        </div>
        <div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in with Google (Popup)'}
            </button>
            <button
              onClick={handleSignInRedirect}
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in with Google (Redirect)'}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500 text-center">
            If popup doesn't work, try the redirect method. Open browser console (F12) for detailed error logs.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
