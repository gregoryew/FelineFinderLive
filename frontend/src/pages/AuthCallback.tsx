import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_CONFIG } from '../config/environment'

const AuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing authorization...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const state = urlParams.get('state')
        const error = urlParams.get('error')

        if (error) {
          setStatus('error')
          setMessage(`Authorization failed: ${error}`)
          setTimeout(() => navigate('/dashboard'), 3000)
          return
        }

        if (!code) {
          setStatus('error')
          setMessage('No authorization code received')
          setTimeout(() => navigate('/dashboard'), 3000)
          return
        }

        // Call the OAuth callback function
        const response = await fetch(`${API_CONFIG.baseUrl}/gcalOAuthCallback?code=${code}&state=${state}`)
        
        if (response.ok) {
          setStatus('success')
          setMessage('Calendar connected successfully!')
          setTimeout(() => navigate('/dashboard'), 2000)
        } else {
          setStatus('error')
          setMessage('Failed to connect calendar')
          setTimeout(() => navigate('/dashboard'), 3000)
        }
      } catch (error) {
        console.error('Callback error:', error)
        setStatus('error')
        setMessage('An error occurred while connecting your calendar')
        setTimeout(() => navigate('/dashboard'), 3000)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center">
            {status === 'processing' && (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            )}
            {status === 'success' && (
              <div className="rounded-full h-12 w-12 bg-green-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {status === 'error' && (
              <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {status === 'processing' && 'Connecting Calendar...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Error'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {message}
          </p>
          {status !== 'processing' && (
            <p className="mt-4 text-xs text-gray-500">
              Redirecting to dashboard...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthCallback
