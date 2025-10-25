import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

interface ErrorPageProps {
  title?: string
  message?: string
  showRetry?: boolean
  showHome?: boolean
}

const ErrorPage: React.FC<ErrorPageProps> = ({ 
  title = "Something went wrong", 
  message = "An unexpected error occurred. Please try again.",
  showRetry = true,
  showHome = true
}) => {
  const navigate = useNavigate()

  const handleRetry = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {title}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {message}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Error Details
            </h3>
            
            <p className="text-sm text-gray-600 mb-6">
              {message}
            </p>

            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    What to do next
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Check your internet connection</li>
                      <li>Verify the link or information you entered</li>
                      <li>Contact support if the problem persists</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {showRetry && (
                <button
                  onClick={handleRetry}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </button>
              )}

              {showHome && (
                <button
                  onClick={handleGoHome}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Return to Home
                </button>
              )}
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Need help?{' '}
                <a href="mailto:support@felinefinder.org" className="font-medium text-feline-600 hover:text-feline-500">
                  Contact support
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ErrorPage
