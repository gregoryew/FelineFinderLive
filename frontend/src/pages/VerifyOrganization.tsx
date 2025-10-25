import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { API_CONFIG } from '../config/environment'

const VerifyOrganization: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const uuid = searchParams.get('uuid')
  const orgId = searchParams.get('orgId')

  useEffect(() => {
    const verifyOrganization = async () => {
      if (!uuid || !orgId) {
        setVerificationStatus('error')
        setMessage('Missing verification parameters')
        return
      }

      try {
        const response = await fetch(`${API_CONFIG.baseUrl}/verifyOrganization?uuid=${uuid}&orgId=${orgId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        const result = await response.json()

        if (response.ok && result.success) {
          setVerificationStatus('success')
          setMessage(result.message)
          
          // Redirect to onboarding after 3 seconds
          setTimeout(() => {
            navigate('/onboarding')
          }, 3000)
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

    verifyOrganization()
  }, [uuid, orgId, navigate])

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

            {verificationStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      Redirecting to Setup
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        You will be redirected to the organization setup page in a few seconds.
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
                        Please contact your organization administrator or try again.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {verificationStatus === 'success' && (
              <button
                onClick={() => navigate('/onboarding')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
              >
                Continue to Setup
              </button>
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

export default VerifyOrganization

