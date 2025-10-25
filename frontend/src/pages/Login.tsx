import React, { useState } from 'react'
import { useAuth } from '../services/auth'
import { Navigate } from 'react-router-dom'

const Login: React.FC = () => {
  const { user, signInWithGoogle } = useAuth()
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
      console.log('Starting Google sign-in with popup...')
      console.log('User before sign-in:', user)
      
      const result = await signInWithGoogle()
      console.log('Popup sign-in successful:', result)
      console.log('User after sign-in:', result.user)
      console.log('=== SIGN-IN TEST END ===')
    } catch (err: any) {
      console.error('=== SIGN-IN ERROR ===')
      console.error('Sign in error:', err)
      console.error('Error code:', err.code)
      console.error('Error message:', err.message)
      setError(err.message || 'Failed to sign in. Please try again.')
    } finally {
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
          </div>
          <p className="mt-3 text-xs text-gray-500 text-center">
            Using popup method for better OAuth compatibility.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
