import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle } from 'lucide-react'
import { API_CONFIG } from '../config/environment'
import { useAuth } from '../services/auth'

const AdminConfirmation: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdminConfirmation = async (isAdmin: boolean) => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const idToken = await user.getIdToken()
      const response = await fetch(`${API_CONFIG.baseUrl}/confirmAdminRole`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isAdmin })
      })

      if (response.ok) {
        if (isAdmin) {
          // User confirmed as admin - proceed to onboarding
          navigate('/onboarding')
        } else {
          // User declined admin role - show message
          setError('Please contact your organization administrator to set up the system.')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to process admin confirmation')
      }
    } catch (error) {
      console.error('Admin confirmation error:', error)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Organization Setup Required
            </h2>
            
            <p className="text-sm text-gray-600 mb-6">
              You are the first user from your organization to access this system. 
              Would you like to be the person responsible for setting up the system for your organization?
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <XCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => handleAdminConfirmation(true)}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Yes, I will set up the system'}
              </button>
              
              <button
                onClick={() => handleAdminConfirmation(false)}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500 disabled:opacity-50"
              >
                No, please send email to administrator
              </button>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  // Sign out the user and redirect to home to prevent infinite loops
                  import('../services/firebase').then(({ auth }) => {
                    auth.signOut().then(() => {
                      window.location.href = '/'
                    })
                  })
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign Out & Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminConfirmation