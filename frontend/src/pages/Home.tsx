import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { Heart, Users, Calendar, Shield, AlertCircle } from 'lucide-react'
import { getFunctions, httpsCallable } from 'firebase/functions'

const Home: React.FC = () => {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [hasOrgIdParam, setHasOrgIdParam] = useState(false)
  const [orgState, setOrgState] = useState<any>(null)
  const [loadingOrgState, setLoadingOrgState] = useState(false)
  const [buttonText, setButtonText] = useState('Start Organization Setup')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Debug log to see auth state
  useEffect(() => {
    console.log('🔍 Home.tsx - Auth state:', { user: user?.email, authLoading })
  }, [user, authLoading])

  // Check for OrgId parameter (case insensitive)
  useEffect(() => {
    const orgId = searchParams.get('OrgId') || searchParams.get('orgid') || searchParams.get('orgId') || searchParams.get('ORGID')
    setHasOrgIdParam(!!orgId)
    console.log('🔍 Home.tsx - OrgId parameter detected:', orgId)
    console.log('🔍 Home.tsx - hasOrgIdParam set to:', !!orgId)
  }, [searchParams])

  // Check organization state when user logs in
  useEffect(() => {
    const checkOrgState = async () => {
      if (authLoading) {
        return // Wait for auth to finish loading
      }

      if (!user) {
        setButtonText('Start Organization Setup')
        setStatusMessage(null)
        setOrgState(null)
        setLoadingOrgState(false)
        return
      }

      try {
        setLoadingOrgState(true)
        const functions = getFunctions()
        const checkOrganizationState = httpsCallable(functions, 'checkOrganizationState')
        const result = await checkOrganizationState()
        const data = result.data as any

        console.log('🔍 Organization state:', data)
        setOrgState(data)

        // Set button text and status based on state
        switch (data.status) {
          case 'USER_NOT_IN_SYSTEM':
            setButtonText('Start Organization Setup')
            setStatusMessage('Sign in with Google, but you need to verify your organization or be invited')
            break
          
          case 'NO_ORG_ID':
            setButtonText('Start Organization Setup')
            setStatusMessage('You need to be associated with an organization')
            break
          
          case 'USER_NOT_VERIFIED':
            setButtonText('Check Your Email')
            setStatusMessage('Please click the verification link sent to your email')
            break
          
          case 'ORG_NOT_FOUND':
            setButtonText('Contact Support')
            setStatusMessage('Organization not found. Please contact support.')
            break
          
          case 'ORG_NOT_VERIFIED':
            setButtonText('Pending Verification')
            setStatusMessage('Your organization administrator needs to verify the organization')
            break
          
          case 'ORG_SETUP_INCOMPLETE':
            if (data.isAdmin) {
              setButtonText('Complete Setup')
              setStatusMessage('Please complete the organization onboarding')
            } else {
              setButtonText('Setup In Progress')
              setStatusMessage('Your administrator is completing the organization setup')
            }
            break
          
          case 'COMPLETE':
            // Check if admin needs to complete onboarding
            if (data.isAdmin && !data.organizationOnboarded) {
              setButtonText('Complete Onboarding')
              setStatusMessage('Please complete the organization onboarding process')
            } else if (data.isAdmin && data.organizationOnboarded) {
              setButtonText(`Welcome, ${data.userName}!`)
              setStatusMessage('Organization setup complete')
            } else {
              setButtonText(`Welcome, ${data.userName}!`)
              setStatusMessage(null)
            }
            break
          
          default:
            setButtonText('Start Organization Setup')
            setStatusMessage(null)
        }
      } catch (error: any) {
        console.error('Error checking organization state:', error)
        setButtonText('Start Organization Setup')
        setStatusMessage('Unable to check status. Please try again.')
      } finally {
        setLoadingOrgState(false)
      }
    }

    checkOrgState()
  }, [user, authLoading])

  const handleGetStarted = async () => {
    console.log('🔍 Home.tsx - handleGetStarted called', { orgState, user: user?.email })
    
    // Handle different organization states
    if (!user) {
      // Not logged in - go to organization entry
      navigate('/organization-entry')
      return
    }

    if (!orgState) {
      // Still loading or no state - default behavior
      navigate('/organization-entry')
      return
    }

    switch (orgState.status) {
      case 'USER_NOT_IN_SYSTEM':
      case 'NO_ORG_ID':
        // User needs to verify organization or be invited
        navigate('/organization-entry')
        break
      
      case 'USER_NOT_VERIFIED':
        // Show message - they need to check their email
        setStatusMessage('Please check your email and click the verification link to continue')
        break
      
      case 'ORG_NOT_FOUND':
      case 'ORG_NOT_VERIFIED':
        // Show message - wait for admin
        setStatusMessage('Your organization is not yet set up. Please contact your administrator.')
        break
      
      case 'ORG_SETUP_INCOMPLETE':
        if (orgState.isAdmin) {
          // Admin needs to complete onboarding
          navigate('/onboarding')
        } else {
          // Non-admin needs to wait
          setStatusMessage('Your administrator is completing the organization setup. Please check back later.')
        }
        break
      
      case 'COMPLETE':
        // Check if admin needs to complete onboarding
        if (orgState.isAdmin && !orgState.organizationOnboarded) {
          navigate('/onboarding')
        } else if (orgState.isAdmin && orgState.organizationOnboarded) {
          navigate('/work-schedule')
        } else {
          // Non-admin users go to work-schedule
          navigate('/work-schedule')
        }
        break
      
      default:
        navigate('/organization-entry')
    }
  }

  return (
    <div className="py-8">
      {/* Hero section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
          Welcome to{' '}
          <span className="text-feline-600">Feline Finder</span>
        </h1>
        <p className="mt-3 max-w-4xl mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl">
          {hasOrgIdParam 
            ? 'The comprehensive platform for animal rescue organizations to manage adoptions, bookings, and community outreach.'
            : 'Welcome to the Feline Finder Organization Portal. Start by verifying your organization to begin setup.'
          }
        </p>
        <div className="mt-5 max-w-4xl mx-auto sm:flex sm:justify-center md:mt-8">
          <div className="rounded-md shadow">
            <button
              onClick={handleGetStarted}
              disabled={authLoading || loadingOrgState}
              className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-feline-600 hover:bg-feline-700 md:py-4 md:text-lg md:px-10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(authLoading || loadingOrgState) ? 'Loading...' : buttonText}
            </button>
          </div>
        </div>
        
        {/* Status Message */}
        {statusMessage && (
          <div className="mt-4 max-w-4xl mx-auto">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div className="ml-3">
                  <p className="text-sm text-blue-700">{statusMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Organization Setup Link - only show when OrgId parameter exists */}
        {hasOrgIdParam && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Setting up an organization?{' '}
              <button
                onClick={() => navigate('/organization-entry')}
                className="font-medium text-feline-600 hover:text-feline-500"
              >
                Start organization verification
              </button>
            </p>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="mt-20">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="pt-6">
            <div className="flow-root bg-white rounded-lg px-6 pb-8">
              <div className="-mt-6">
                <div>
                  <span className="inline-flex items-center justify-center p-3 bg-feline-500 rounded-md shadow-lg">
                    <Heart className="h-6 w-6 text-white" />
                  </span>
                </div>
                <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                  Adoption Management
                </h3>
                <p className="mt-5 text-base text-gray-500">
                  Streamline the adoption process with comprehensive pet profiles, 
                  application tracking, and family matching.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <div className="flow-root bg-white rounded-lg px-6 pb-8">
              <div className="-mt-6">
                <div>
                  <span className="inline-flex items-center justify-center p-3 bg-feline-500 rounded-md shadow-lg">
                    <Calendar className="h-6 w-6 text-white" />
                  </span>
                </div>
                <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                  Appointment Booking
                </h3>
                <p className="mt-5 text-base text-gray-500">
                  Schedule meet-and-greets, vet visits, and adoption appointments 
                  with integrated calendar management.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <div className="flow-root bg-white rounded-lg px-6 pb-8">
              <div className="-mt-6">
                <div>
                  <span className="inline-flex items-center justify-center p-3 bg-feline-500 rounded-md shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </span>
                </div>
                <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                  Volunteer Coordination
                </h3>
                <p className="mt-5 text-base text-gray-500">
                  Manage volunteers, track hours, and coordinate activities 
                  across your organization.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <div className="flow-root bg-white rounded-lg px-6 pb-8">
              <div className="-mt-6">
                <div>
                  <span className="inline-flex items-center justify-center p-3 bg-feline-500 rounded-md shadow-lg">
                    <Shield className="h-6 w-6 text-white" />
                  </span>
                </div>
                <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                  Admin Controls
                </h3>
                <p className="mt-5 text-base text-gray-500">
                  Comprehensive admin tools for managing users, organizations, 
                  and system-wide settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
