import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { API_CONFIG } from '../config/environment'

const OrganizationJWTVerification: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [orgData, setOrgData] = useState<any>(null)

  const jwt = searchParams.get('jwt')

  useEffect(() => {
    if (!jwt) {
      setVerificationStatus('error')
      setMessage('Missing verification token')
      return
    }

    // Verify JWT and complete organization setup
    completeVerification()
  }, [jwt])

  const completeVerification = async () => {
    if (!jwt) {
      return
    }

    setVerificationStatus('loading')

    try {
      // First, check if the token corresponds to an already verified organization
      const checkResponse = await fetch(`${API_CONFIG.baseUrl}/verifyOrganizationToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jwt })
      })

      const checkResult = await checkResponse.json()

      // If the JWT token check failed, show error
      if (!checkResponse.ok || !checkResult.success) {
        setVerificationStatus('error')
        setMessage(checkResult.error || 'Invalid or expired verification token')
        return
      }

      // If organization is already verified, show status instead of processing again
      if (checkResult.orgData?.verified) {
        setVerificationStatus('success')
        setMessage(`${checkResult.orgData.name} is already verified. Redirecting to onboarding...`)
        setOrgData(checkResult.orgData)
        
        // Check if we have a setup token from a previous verification
        const existingSetupToken = localStorage.getItem('onboarding_setup_token')
        const existingOrgId = localStorage.getItem('onboarding_org_id')
        
        if (!existingSetupToken || existingOrgId !== checkResult.orgData.orgId) {
          // Need to get a new setup token
          setMessage(`${checkResult.orgData.name} is already verified. Please continue to onboarding.`)
        }
        
        // Redirect to onboarding with orgId after 2 seconds
        setTimeout(() => {
          navigate(`/onboarding?orgId=${checkResult.orgData.orgId}`)
        }, 2000)
        return
      }

      // JWT is valid but organization not verified yet - proceed with verification
      const response = await fetch(`${API_CONFIG.baseUrl}/completeOrganizationVerification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jwt })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setVerificationStatus('success')
        setMessage('Organization verified! Redirecting to onboarding...')
        setOrgData(result.orgData)
        
        // Redirect to onboarding with orgId after 2 seconds
        setTimeout(() => {
          navigate(`/onboarding?orgId=${result.orgData.orgId}`)
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
          {verificationStatus === 'loading' && 'Verifying Organization...'}
          {verificationStatus === 'success' && 'Organization Verified!'}
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
              {verificationStatus === 'success' && 'Verification Complete'}
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
                      {orgData.name} Verified
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        Your organization has been successfully verified. You'll be redirected to complete the setup process, where you'll connect your Google Calendar.
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
                        The verification link is invalid or has expired. Please contact your organization administrator or try again.
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

export default OrganizationJWTVerification
