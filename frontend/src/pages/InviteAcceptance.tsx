import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { API_CONFIG } from '../config/environment'

interface InvitationData {
  valid: boolean
  organizationName?: string
  role?: string
  inviterName?: string
  orgId?: string
}

export const InviteAcceptance: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, signInWithGoogle } = useAuth()
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided')
      setLoading(false)
      return
    }

    validateInvitation()
  }, [token])

  const validateInvitation = async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/validateInvitationToken?token=${token}`)
      const data = await response.json()

      if (response.ok) {
        setInvitationData(data)
      } else {
        setError(data.error || 'Invalid invitation')
      }
    } catch (error) {
      setError('Failed to validate invitation')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvitation = async () => {
    if (!user) {
      // User needs to sign in first
      try {
        await signInWithGoogle()
        // After sign-in, the auth state change will handle the registration
        return
      } catch (error) {
        setError('Failed to sign in')
        return
      }
    }

    // User is signed in, redirect to registration with orgId
    if (invitationData?.orgId) {
      navigate(`/?OrgID=${invitationData.orgId}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Validating invitation...</p>
        </div>
      </div>
    )
  }

  if (error || !invitationData?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 max-w-4xl w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-xl">✕</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 text-center mb-6">{error || 'This invitation link is not valid.'}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow p-8 max-w-4xl w-full mx-4">
        <div className="flex items-center justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-green-600 text-xl">✓</span>
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">You're Invited!</h2>
        <p className="text-gray-600 text-center mb-6">
          {invitationData.inviterName} has invited you to join <strong>{invitationData.organizationName}</strong> as a {invitationData.role}.
        </p>
        
        {!user ? (
          <div>
            <p className="text-sm text-gray-500 text-center mb-4">
              Please sign in with Google to accept this invitation.
            </p>
            <button
              onClick={handleAcceptInvitation}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Sign In & Accept Invitation
            </button>
          </div>
        ) : (
          <button
            onClick={handleAcceptInvitation}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
          >
            Accept Invitation
          </button>
        )}
      </div>
    </div>
  )
}

export default InviteAcceptance
