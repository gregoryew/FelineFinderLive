import React from 'react'
import { AlertTriangle, ArrowLeft, Mail } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

const AccessDenied: React.FC = () => {
  const [searchParams] = useSearchParams()
  
  // Check for specific error codes from URL parameters
  const errorCode = searchParams.get('error')
  const isInvalidOrgId = errorCode === 'INVALID_ORG_ID'
  // const isNoInvitation = errorCode === 'NO_ORG_INVITATION'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Access Denied
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isInvalidOrgId ? 'Invalid organization invitation' : 'Organization invitation required'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isInvalidOrgId ? 'Organization Not Found' : 'Invitation Required'}
            </h3>
            
            <p className="text-sm text-gray-500 mb-6">
              {isInvalidOrgId 
                ? 'The organization ID in your invitation link is not valid or does not exist in our system. This could mean:'
                : 'You must be invited by an organization to access this system. This could mean:'
              }
            </p>
            
            <ul className="text-sm text-gray-500 text-left mb-6 space-y-2">
              {isInvalidOrgId ? (
                <>
                  <li>• The invitation link is incorrect or expired</li>
                  <li>• The organization is not registered with RescueGroups</li>
                  <li>• The organization ID has been changed</li>
                </>
              ) : (
                <>
                  <li>• You need an invitation link from your organization</li>
                  <li>• The invitation link is missing or expired</li>
                  <li>• You should contact your organization administrator</li>
                </>
              )}
            </ul>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Mail className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Need Help?
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      Please contact your organization administrator or email{' '}
                      <a href="mailto:support@felinefinder.org" className="font-medium underline">
                        support@felinefinder.org
                      </a>{' '}
                      for assistance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={() => {
                  // Sign out the user and redirect to home
                  import('../services/firebase').then(({ auth }) => {
                    auth.signOut().then(() => {
                      window.location.href = '/'
                    })
                  })
                }}
                className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Sign Out & Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccessDenied
