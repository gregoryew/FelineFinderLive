import React, { useState } from 'react'
import { useAuth } from '../services/auth'
import { LogIn, Loader2 } from 'lucide-react'

interface LoginButtonProps {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  showRegistrationHint?: boolean
}

const LoginButton: React.FC<LoginButtonProps> = ({ 
  variant = 'default', 
  size = 'md',
  showRegistrationHint = true 
}) => {
  const { signInWithGoogle } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await signInWithGoogle()
      console.log('Sign-in successful:', result.user)
    } catch (err: any) {
      console.error('Sign-in error:', err)
      setError(err.message || 'Failed to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getButtonStyles = () => {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    
    const sizeStyles = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm", 
      lg: "px-6 py-3 text-base"
    }
    
    const variantStyles = {
      default: "text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
      outline: "text-blue-600 bg-white border border-blue-600 hover:bg-blue-50 focus:ring-blue-500",
      ghost: "text-blue-600 bg-transparent hover:bg-blue-50 focus:ring-blue-500"
    }
    
    return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]}`
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSignIn}
        disabled={loading}
        className={getButtonStyles()}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4 mr-2" />
        )}
        {loading ? 'Signing in...' : 'Sign in with Google'}
      </button>

      {showRegistrationHint && (
        <div className="text-xs text-gray-500 text-center">
          <p>Don't have a Google account?</p>
          <a 
            href="https://accounts.google.com/signup" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Create one here
          </a>
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}

export default LoginButton
