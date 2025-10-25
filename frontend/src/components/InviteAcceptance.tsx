import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { CheckCircle, XCircle, Clock, User } from 'lucide-react'

const InviteAcceptance: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const functions = getFunctions()
  
  const [invitation, setInvitation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [acceptResult, setAcceptResult] = useState<any>(null)

  useEffect(() => {
    if (token) {
      loadInvitationDetails()
    }
  }, [token])

  const loadInvitationDetails = async () => {
    try {
      setLoading(true)
      const getInvitationDetails = httpsCallable(functions, 'getInvitationDetails')
      const result = await getInvitationDetails({ invitationToken: token })
      
      if ((result.data as any).success) {
        setInvitation(result.data as any)
      }
    } catch (error: any) {
      console.error('Error loading invitation:', error)
      setError(error.message || 'Failed to load invitation details')
    } finally {
      setLoading(false)
    }
  }

  const acceptInvitation = async () => {
    if (!user) {
      navigate('/login')
      return
    }

    try {
      setAccepting(true)
      const acceptOrganizationInvite = httpsCallable(functions, 'acceptOrganizationInvite')
      const result = await acceptOrganizationInvite({ invitationToken: token })
      
      if ((result.data as any).success) {
        setAcceptResult(result.data as any)
        setSuccess(true)
        setTimeout(() => {
          navigate('/dashboard')
        }, 3000)
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error)
      setError(error.message || 'Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <XCircle className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Invitation Error</h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Welcome!</h2>
          <p className="text-gray-600 text-center mb-6">
            {acceptResult?.isFirstUser 
              ? `You've successfully joined ${acceptResult?.organizationName} as the first admin!`
              : `You've successfully joined ${acceptResult?.organizationName}.`
            } Redirecting to dashboard...
          </p>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <XCircle className="h-12 w-12 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Invalid Invitation</h2>
          <p className="text-gray-600 text-center mb-6">This invitation link is not valid.</p>
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <User className="h-12 w-12 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Invited!</h2>
          <p className="text-gray-600">
            You've been invited to join <strong>{invitation.organizationName}</strong>
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-2">
            <User className="h-4 w-4 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">Role:</span>
            <span className="ml-2 text-sm text-gray-600 capitalize">{invitation.role}</span>
          </div>
          <div className="flex items-center mb-2">
            <Clock className="h-4 w-4 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">Expires:</span>
            <span className="ml-2 text-sm text-gray-600">
              {new Date(invitation.expiresAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center">
            <User className="h-4 w-4 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">Invited by:</span>
            <span className="ml-2 text-sm text-gray-600">{invitation.inviterName}</span>
          </div>
        </div>

        <div className="space-y-3">
          {!user ? (
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Sign In to Accept
            </button>
          ) : (
            <button
              onClick={acceptInvitation}
              disabled={accepting}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {accepting ? 'Accepting...' : 'Accept Invitation'}
            </button>
          )}
          
          <button
            onClick={() => navigate('/')}
            className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
          >
            Decline
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          By accepting this invitation, you'll gain access to the organization's dashboard and tools.
        </p>
      </div>
    </div>
  )
}

export default InviteAcceptance
