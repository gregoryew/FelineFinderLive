import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle, Building2 } from 'lucide-react'
import OrganizationAutocomplete from '../components/OrganizationAutocomplete'
import { API_CONFIG } from '../config/environment'

interface Organization {
  id: string
  name: string
  city: string
  state: string
  country: string
  email: string
}

const OrganizationEntry: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [orgId, setOrgId] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    orgData?: Organization
    error?: string
  } | null>(null)
  const [, setSelectedOrganization] = useState<Organization | null>(null)
  const [useIdInput, setUseIdInput] = useState(false)
  const [isAppropriateAdmin, setIsAppropriateAdmin] = useState<boolean | null>(null)

  // Check for OrgId in URL parameters (case insensitive)
  const urlOrgId = searchParams.get('OrgId') || 
                   searchParams.get('orgid') || 
                   searchParams.get('orgId') || 
                   searchParams.get('ORGID')

  useEffect(() => {
    if (urlOrgId) {
      setOrgId(urlOrgId)
      setUseIdInput(true)
      // Auto-validate after a short delay
      const timeoutId = setTimeout(() => {
        validateOrgIdWithValue(urlOrgId)
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [urlOrgId])

  const validateOrgIdWithValue = async (idToValidate: string) => {
    if (!idToValidate.trim()) return

    setIsValidating(true)
    setValidationResult(null)

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/validateOrgId`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orgId: idToValidate })
      })

      if (response.ok) {
        const result = await response.json()
        setValidationResult({
          valid: true,
          orgData: result.orgData
        })
      } else {
        const errorData = await response.json()
        setValidationResult({
          valid: false,
          error: errorData.error || 'Organization ID not found'
        })
      }
    } catch (error) {
      console.error('Validation error:', error)
      setValidationResult({
        valid: false,
        error: 'Failed to validate organization ID. Please try again.'
      })
    } finally {
      setIsValidating(false)
    }
  }

  const validateOrgId = () => {
    validateOrgIdWithValue(orgId)
  }

  const handleOrganizationSelect = (organization: Organization) => {
    setSelectedOrganization(organization)
    // Transform the flat structure to match the v5 API format that backend expects
    const transformedOrgData = {
      id: organization.id,
      type: 'orgs',
      attributes: {
        name: organization.name,
        city: organization.city,
        state: organization.state,
        country: organization.country,
        email: organization.email
      }
    }
    setValidationResult({
      valid: true,
      orgData: transformedOrgData as any
    })
  }

  const handleContinue = () => {
    if (validationResult?.valid && validationResult.orgData) {
      navigate('/setup-confirmation', {
        state: { 
          orgId: validationResult.orgData.id,
          orgData: validationResult.orgData 
        }
      })
    }
  }

  const handleBack = () => {
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="mb-6">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </button>
            <h2 className="text-2xl font-bold text-gray-900 text-center">
              Organization Verification
            </h2>
            <p className="mt-2 text-sm text-gray-600 text-center">
              Let's verify your organization to get started
            </p>
          </div>

          {/* Step 1: Ask if they are an admin */}
          {isAppropriateAdmin === null && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 mb-4">
                  Are you an admin of this organization?
                </p>
                <p className="text-sm text-gray-600 mb-6">
                  Only organization administrators can set up and manage the system. Volunteers will need to wait for an admin to complete setup and send invitations.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setIsAppropriateAdmin(true)}
                  className="flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
                >
                  Yes, I'm an admin
                </button>
                <button
                  onClick={() => setIsAppropriateAdmin(false)}
                  className="flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
                >
                  No, I'm a volunteer
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Show message if they said No (volunteer) */}
          {isAppropriateAdmin === false && (
            <div className="space-y-6">
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Please Wait for Admin Setup
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        As a volunteer, you'll need to wait for an organization administrator to complete the setup process.
                      </p>
                      <p className="mt-2">
                        Once setup is complete, the admin will send you an invitation email with instructions to join the system.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsAppropriateAdmin(null)}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
              >
                Go Back
              </button>
            </div>
          )}

          {/* Step 3: Show organization search if they said Yes (admin) */}
          {isAppropriateAdmin === true && !useIdInput && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search for your organization
                </label>
                <OrganizationAutocomplete
                  onSelect={handleOrganizationSelect}
                  placeholder="Type your organization name..."
                />
                <p className="mt-2 text-xs text-gray-500">
                  Start typing to search for your organization
                </p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <div>
                <button
                  onClick={() => setUseIdInput(true)}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
                >
                  Enter RescueGroups ID instead
                </button>
              </div>
            </div>
          )}

          {isAppropriateAdmin === true && useIdInput && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RescueGroups Organization ID
                </label>
                <input
                  type="text"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-feline-500 focus:border-feline-500 sm:text-sm"
                  placeholder="Enter your organization ID"
                />
                <p className="mt-2 text-xs text-gray-500">
                  You can find this in your RescueGroups account settings
                </p>
              </div>

              <button
                onClick={validateOrgId}
                disabled={!orgId.trim() || isValidating}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? 'Validating...' : 'Validate Organization'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <div>
                <button
                  onClick={() => setUseIdInput(false)}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
                >
                  Search by organization name instead
                </button>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {isAppropriateAdmin === true && validationResult && (
            <div className="mt-6">
              {validationResult.valid ? (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">
                        Organization Verified
                      </h3>
                      <div className="mt-2 text-sm text-green-700">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 mr-2" />
                          <span className="font-medium">{validationResult.orgData?.name}</span>
                        </div>
                        {validationResult.orgData?.city && validationResult.orgData?.state && (
                          <p className="mt-1">
                            {validationResult.orgData.city}, {validationResult.orgData.state}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Verification Failed
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        {validationResult.error}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Continue Button */}
          {isAppropriateAdmin === true && validationResult?.valid && (
            <div className="mt-6">
              <button
                onClick={handleContinue}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500"
              >
                Continue to Setup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OrganizationEntry