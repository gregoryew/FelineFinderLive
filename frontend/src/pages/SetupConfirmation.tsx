import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, Mail, Building2, AlertCircle } from 'lucide-react'
import { API_CONFIG } from '../config/environment'

const SetupConfirmation: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const { orgId, orgData } = location.state || {}

  useEffect(() => {
    if (!orgId || !orgData) {
      navigate('/organization-entry')
      return
    }
    
    // Only send email if we haven't already sent one for this organization
    const emailSentKey = `email_sent_${orgId}`
    const hasEmailBeenSent = sessionStorage.getItem(emailSentKey)
    
    if (!hasEmailBeenSent) {
      sendVerificationEmail()
      sessionStorage.setItem(emailSentKey, 'true')
    } else {
      setEmailSent(true)
      setLoading(false)
    }
  }, [orgId, orgData, navigate])

  const sendVerificationEmail = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/initiateOrganizationSetup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          orgId,
          orgData 
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setEmailSent(true)
        
        // Show alert in test mode
        if (result.testMode && result.emailDetails) {
          alert(
            `TEST MODE - Email Details:\n\n` +
            `To: ${result.emailDetails.to}\n` +
            `Organization: ${result.emailDetails.organizationName}\n\n` +
            `${result.emailDetails.message}\n\n` +
            `Verification URL:\n${result.emailDetails.verificationUrl}`
          )
        }
      } else {
        setError(result.error || 'Failed to send verification email. Please try again.')
      }
    } catch (error) {
      console.error('Setup initiation error:', error)
      setError('Failed to send verification email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!orgId || !orgData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Building2 className="w-16 h-16 text-feline-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Organization Setup
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Complete the setup for {orgData.attributes?.name || 'your organization'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {loading ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-feline-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Sending verification email...</p>
            </div>
          ) : error ? (
            <>
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Error Sending Email
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <button
                  onClick={sendVerificationEmail}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
                >
                  Retry Sending Email
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
                >
                  Return to Home
                </button>
              </div>
            </>
          ) : emailSent ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Verification Email Sent!
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                We've sent a verification email to:
              </p>
              
              <p className="text-sm font-medium text-gray-900 mb-6">
                {orgData?.email || 'the address registered with RescueGroups'}
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3 text-left">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Important: Check Your Spam Folder
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        If you don't receive the email in a few minutes, please check your spam or junk folder.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3 text-left">
                    <h3 className="text-sm font-medium text-blue-800">
                      Next Steps
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Check your email (including spam folder)</li>
                        <li>Click the verification link in the email</li>
                        <li>Complete the setup process</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={sendVerificationEmail}
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-feline-600 rounded-md shadow-sm text-sm font-medium text-feline-600 bg-white hover:bg-feline-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Resend Verification Email
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
                >
                  Return to Home
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default SetupConfirmation
