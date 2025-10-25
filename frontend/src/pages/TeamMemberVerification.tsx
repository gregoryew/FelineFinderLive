import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { API_CONFIG } from '../config/environment'

const TeamMemberVerification: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [orgData, setOrgData] = useState<any>(null)

  const token = searchParams.get('token')
  const uuid = searchParams.get('uuid')
  const orgId = searchParams.get('orgId')

  useEffect(() => {
    if (!token || !uuid || !orgId) {
      setVerificationStatus('error')
      setMessage('Missing verification parameters')
      return
    }

    verifyTeamMemberInvitation()
  }, [token, uuid, orgId])

  const verifyTeamMemberInvitation = async () => {
    if (!token || !uuid || !orgId) {
      return
    }

    setVerificationStatus('loading')

    try {
      // Verify the JWT token and invitation
      const response = await fetch(`${API_CONFIG.baseUrl}/verifyTeamMemberInvitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, uuid, orgId })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setVerificationStatus('success')
        setMessage('Invitation verified! Redirecting to onboarding...')
        setOrgData(result.orgData)
        
        // Store the setup token in localStorage for onboarding access
        if (result.setupToken) {
          localStorage.setItem('onboarding_setup_token', result.setupToken)
          localStorage.setItem('onboarding_org_id', result.orgId)
          localStorage.setItem('onboarding_user_role', result.userRole || 'member')
        }
        
        // Redirect to onboarding after 2 seconds
        setTimeout(() => {
          navigate('/onboarding')
        }, 2000)
      } else {
        setVerificationStatus('error')
        setMessage(result.error || 'Verification failed')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setVerificationStatus('error')
      setMessage('Network error during verification')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            verificationStatus === 'loading' ? 'bg-blue-100' :
            verificationStatus === 'success' ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {verificationStatus === 'loading' && <Loader className="w-8 h-8 text-blue-600 animate-spin" />}
            {verificationStatus === 'success' && <CheckCircle className="w-8 h-8 text-green-600" />}
            {verificationStatus === 'error' && <XCircle className="w-8 h-8 text-red-600" />}
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {verificationStatus === 'loading' && 'Verifying Invitation...'}
          {verificationStatus === 'success' && 'Invitation Verified!'}
          {verificationStatus === 'error' && 'Verification Failed'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
              verificationStatus === 'loading' ? 'bg-blue-100' :
              verificationStatus === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {verificationStatus === 'loading' && <Loader className="h-6 w-6 text-blue-600 animate-spin" />}
              {verificationStatus === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
              {verificationStatus === 'error' && <XCircle className="h-6 w-6 text-red-600" />}
            </div>
            
            <h3 className={`text-lg font-medium mb-2 ${
              verificationStatus === 'success' ? 'text-green-900' : 
              verificationStatus === 'error' ? 'text-red-900' : 'text-gray-900'
            }`}>
              {verificationStatus === 'loading' && 'Please wait...'}
              {verificationStatus === 'success' && 'Welcome to the Team!'}
              {verificationStatus === 'error' && 'Verification Error'}
            </h3>
            
            <p className={`text-sm mb-6 ${
              verificationStatus === 'success' ? 'text-green-700' : 
              verificationStatus === 'error' ? 'text-red-700' : 'text-gray-500'
            }`}>
              {message}
            </p>

            {verificationStatus === 'success' && orgData && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Joining {orgData.name}
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        Your invitation has been verified. You'll be redirected to set up your work schedule and complete your profile.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {verificationStatus === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <XCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Verification Failed
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        The invitation link is invalid, already used, or has expired. Please contact your organization administrator for a new invitation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {verificationStatus === 'error' && (
              <button
                onClick={() => navigate('/')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
              >
                Return to Home
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeamMemberVerification

