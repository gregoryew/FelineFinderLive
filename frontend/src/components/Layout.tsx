import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { Home, Users, Settings, LogOut, UserPlus, LogIn, Clock } from 'lucide-react'
import { API_CONFIG } from '../config/environment'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, signInWithGoogle, loading: authLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false)
  const [loadingOnboardingStatus, setLoadingOnboardingStatus] = useState(true)
  const [signInLoading, setSignInLoading] = useState(false)

  // Check onboarding completion status from Firestore
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setLoadingOnboardingStatus(false)
        return
      }

      try {
        const idToken = await user.getIdToken()
        const response = await fetch(`${API_CONFIG.baseUrl}/getOnboardingProgress`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const result = await response.json()
          if (result && typeof result === 'object') {
            const data = result as { onboarding: any; completed: boolean }
            setIsOnboardingCompleted(data.completed)
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        // Default to allowing navigation if we can't check
        setIsOnboardingCompleted(true)
      } finally {
        setLoadingOnboardingStatus(false)
      }
    }

    checkOnboardingStatus()
  }, [user, location.pathname])

  const handleSignIn = async () => {
    try {
      setSignInLoading(true)
      console.log('Starting Google sign-in from toolbar...')
      
      const result = await signInWithGoogle()
      console.log('Sign-in successful:', result)
      
      // Navigate to onboarding after successful sign-in
      navigate('/onboarding')
    } catch (err: any) {
      console.error('Sign in error:', err)
    } finally {
      setSignInLoading(false)
    }
  }

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Bookings', href: '/bookings', icon: Users },
    { name: 'Work Time', href: '/work-schedule', icon: Clock },
    { 
      name: isOnboardingCompleted ? 'Organization Settings' : 'On Boarding', 
      href: '/onboarding', 
      icon: UserPlus 
    },
    { name: 'Admin', href: '/admin', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-0">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-feline-600">
                  🐾 Feline Finder Portal
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  const isDisabled = (!user && item.href !== '/login') || 
                    (!loadingOnboardingStatus && !isOnboardingCompleted && item.href !== '/' && item.href !== '/onboarding')
                  
                  if (isDisabled) {
                    return (
                      <span
                        key={item.name}
                        className="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium border-transparent text-gray-300 cursor-not-allowed opacity-50"
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.name}
                      </span>
                    )
                  }
                  
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-feline-500 text-feline-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center">
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700">
                    {user.displayName || user.email || 'User'}
                  </span>
                  <button
                    onClick={logout}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  disabled={signInLoading || authLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-feline-600 hover:bg-feline-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  {signInLoading ? 'Signing in...' : authLoading ? 'Loading...' : 'Sign in'}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-full mx-auto py-6 px-0">
        {children}
      </main>
    </div>
  )
}

export default Layout
