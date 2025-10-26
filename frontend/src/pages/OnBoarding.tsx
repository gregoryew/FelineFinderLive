import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../services/auth'
import { Navigate, useLocation } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { 
  Building2, 
  Calendar, 
  Clock,
  Users, 
  MessageCircle, 
  CheckCircle, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Trash2,
  Search,
  Shield
} from 'lucide-react'
import { API_CONFIG } from '../config/environment'
import CalendarIntegration from '../components/CalendarIntegration'

interface OnboardingData {
  organizationType?: 'Animal Shelter' | 'Animal Rescue' | 'Foster-Based Rescue' | 'Sanctuary' | 'Animal Control Agency' | 'Humane Society' | 'Spay/Neuter Clinic' | 'Wildlife Rehabilitator' | 'Breed-Specific Rescue' | 'Transport Group'
  calendarConnected?: boolean
  selectedCalendarId?: string
  selectedCalendarName?: string
  users?: Array<{ id: string; name: string; email: string; role: 'volunteer' | 'admin'; calendarLinked: boolean; status: 'New' | 'Emailed' | 'Setup' | 'Error' | 'invited' | 'verified' }>
  meetingPreferences?: { 
    inPerson?: boolean
    videoChat?: boolean
    adoptionEvent?: boolean
    inPersonDuration?: number | 'custom'
    videoChatDuration?: number | 'custom'
    inPersonCustomDuration?: number
    videoChatCustomDuration?: number
  }
  userName?: string
  invitedUsers?: Array<{ uuid: string; email: string; name: string; role: string; status: string; invitedAt: string; invitedBy: string; verifiedAt?: string }>
  organizationOnboarded?: boolean // Whether the organization has completed onboarding
  pendingSetup?: boolean // Whether the organization is still in setup phase
}

const OnBoarding: React.FC = () => {
  const { user, signInWithGoogle } = useAuth()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const orgId = searchParams.get('orgId')
  
  // Initialize state from sessionStorage if available, otherwise use defaults
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = sessionStorage.getItem('onboarding_current_step')
    return saved ? parseInt(saved, 10) : 1
  })
  const [expandedStep, setExpandedStep] = useState(() => {
    const saved = sessionStorage.getItem('onboarding_expanded_step')
    return saved ? parseInt(saved, 10) : 1
  })
  
  // Prevent expandedStep from being reset on re-renders
  const [expandedStepLocked, setExpandedStepLocked] = useState(false)
  const expandedStepRef = useRef(1) // Use ref to track expanded step
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [emailValidationErrors, setEmailValidationErrors] = useState<Map<string, string>>(new Map())
  const [customDurationErrors, setCustomDurationErrors] = useState<Map<string, string>>(new Map())
  
  // Effect to prevent expandedStep from being reset on re-renders
  useEffect(() => {
    if (expandedStepLocked && expandedStep !== 1) {
      // Don't reset expandedStep if it's locked and not at default
      return
    }
  }, [expandedStepLocked, expandedStep])
  
  // Effect to unlock expandedStep when currentStep changes
  useEffect(() => {
    if (currentStep > 1) {
      setExpandedStepLocked(false)
    }
  }, [currentStep])
  
  // Effect to update ref when expanded step changes (for state management)
  useEffect(() => {
    expandedStepRef.current = expandedStep
  }, [expandedStep])
  
  // Check if this is a team member (not admin) - determines which steps to show
  const userRole = localStorage.getItem('onboarding_user_role') || currentUserRole
  const isTeamMember = userRole === 'member' || userRole === 'volunteer'


  // Handle OAuth callback parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const role = params.get('role')
    
    // Store role from OAuth callback if present (with validation)
    if (role && ['admin', 'volunteer', 'user'].includes(role)) {
      localStorage.setItem('onboarding_user_role', role)
      console.log('Stored role from OAuth callback:', role)
      
      // Clean up URL
      params.delete('role')
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`
      window.history.replaceState({}, '', newUrl)
    }
  }, [])


  // Set initial step for team members after role is determined
  useEffect(() => {
    if (isTeamMember && currentStep === 1 && !isOnboardingCompleted) {
      // Team members start at step 1 (Authentication) and go through their own flow
      setCurrentStep(1)
      // Don't reset expandedStep for team members - let them navigate freely
    }
  }, [isTeamMember, currentStep, isOnboardingCompleted])

  // Handle user registration after authentication
  useEffect(() => {
    if (user && orgId && currentStep === 1) {
      // User just authenticated, register them with the organization
      registerUserWithOrgId()
    }
  }, [user, orgId, currentStep])

  // Debug logging for step state changes
  useEffect(() => {
    console.log('🔄 Step state changed:', {
      currentStep,
      expandedStep,
      isOnboardingCompleted,
      calendarConnected: onboardingData.calendarConnected,
      userRole: userRole
    })
  }, [currentStep, expandedStep, isOnboardingCompleted, onboardingData.calendarConnected, userRole])

  // Auto-save current step to sessionStorage whenever it changes
  useEffect(() => {
    if (currentStep > 0) {
      sessionStorage.setItem('onboarding_current_step', currentStep.toString())
      console.log('💾 Saved current step to sessionStorage:', currentStep)
    }
  }, [currentStep])

  // Auto-save expanded step to sessionStorage whenever it changes
  useEffect(() => {
    if (expandedStep > 0) {
      sessionStorage.setItem('onboarding_expanded_step', expandedStep.toString())
      console.log('💾 Saved expanded step to sessionStorage:', expandedStep)
    }
  }, [expandedStep])

  // Removed auto-save logic - now only saves on Next Step or manual Save Progress

  // Removed save-on-unmount logic - users can manually save progress

  const loadOnboardingProgress = useCallback(async () => {
    if (!user) return
    
    try {
      // Get orgId from URL parameters (passed from OAuth callback)
      const urlParams = new URLSearchParams(window.location.search)
      const orgId = urlParams.get('orgId')
      
      // Use Firebase callable function instead of fetch
      const functions = getFunctions()
      const getOnboardingProgressFunc = httpsCallable(functions, 'getOnboardingProgress')
      const response = await getOnboardingProgressFunc({ orgId })
      
      const result = response.data
      
      if (result) {
        if (result && typeof result === 'object') {
          const data = result as { onboarding: OnboardingData; completed: boolean; organizationOnboarded: boolean; pendingSetup?: boolean; userRole?: string }
        
          // Set onboarding completion status
          setIsOnboardingCompleted(data.completed)
          
          // Set organization onboarding status
          if (data.organizationOnboarded !== undefined) {
            setOnboardingData(prev => ({ ...prev, organizationOnboarded: data.organizationOnboarded }))
          }
          
          // Set pending setup status
          if (data.pendingSetup !== undefined) {
            setOnboardingData(prev => ({ ...prev, pendingSetup: data.pendingSetup }))
          }
          
          // If onboarding is completed, allow user to stay on onboarding page
          // They can still make changes and will only be redirected when they press "Finish Setup"
          
            if (data.onboarding) {
            
            // Sync user statuses with invitation statuses
            const syncedData = { ...data.onboarding }
            if (syncedData.users && syncedData.invitedUsers) {
              syncedData.users = syncedData.users.map(user => {
                // Find matching invitation by email
                const invitation = syncedData.invitedUsers?.find(inv => inv.email === user.email)
                if (invitation) {
                  // Update status based on invitation status
                  if (invitation.status === 'verified') {
                    return { ...user, status: 'Setup' as const }
                  } else if (invitation.status === 'invited') {
                    return { ...user, status: 'Emailed' as const }
                  }
                }
                return user
              })
            }
            
            setOnboardingData(syncedData)
            
            // Determine user role from backend response
            console.log('DEBUG: getOnboardingProgress response:', {
              userRole: data.userRole,
              completed: data.completed,
              pendingSetup: data.pendingSetup,
              hasOnboardingData: !!data.onboarding
            })
            
            if (data.userRole) {
              console.log('DEBUG: Setting role from backend response:', data.userRole)
              setCurrentUserRole(data.userRole)
              localStorage.setItem('onboarding_user_role', data.userRole)
            } else {
              console.log('DEBUG: No userRole in response, using fallback logic')
              // Fallback: check if user is in organization users array
              const currentUser = data.onboarding.users?.find(u => u.id === user.uid)
              if (currentUser) {
                console.log('DEBUG: Found user in organization users array:', currentUser.role)
                setCurrentUserRole(currentUser.role)
                localStorage.setItem('onboarding_user_role', currentUser.role)
              } else {
                console.log('DEBUG: No user found, defaulting to admin')
                // Default to admin for new users
                setCurrentUserRole('admin')
                localStorage.setItem('onboarding_user_role', 'admin')
              }
            }
            
            // Don't automatically determine current step based on data existence
            // Let user control step progression through Next Step/Save buttons
            
            // Don't automatically change currentStep or expandedStep - let user control it
            // User should be able to navigate freely between steps
          }
        }
      }
    } catch (error) {
      console.error('Error loading onboarding progress:', error)
    }
  }, [user]) // Only recreate when user changes


  const saveStepData = async (step: number, stepData: any) => {
    if (!user) return
    
    try {
      setLoading(true)
      console.log('DEBUG: Saving step data:', { step: `step${step}`, stepData })
      
      // Use Firebase callable function instead of fetch
      const functions = getFunctions()
      const saveOnboardingStepFunc = httpsCallable(functions, 'saveOnboardingStep')
      await saveOnboardingStepFunc({ 
        step: `step${step}`, 
        stepData
      })
      
      console.log('DEBUG: Step data saved successfully')
    } catch (error: any) {
      console.error('Error saving step:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const saveCurrentStep = async () => {
    if (!user) return
    
    // Get current step data based on the current step
    const stepDataToSave = getStepData(currentStep)
    
    console.log('DEBUG: Saving current step data:', { 
      currentStep, 
      stepDataToSave, 
      userRole: userRole,
      isTeamMember,
      userId: user?.uid
    })
    
    if (Object.keys(stepDataToSave).length > 0) {
      await saveStepData(currentStep, stepDataToSave)
    }
  }

  const handleNextStep = async () => {
    setError(null)
    
    // Validate current step before proceeding
    if (currentStep === 2 && !onboardingData.organizationType) {
      setError('Please select an organization type')
      return
    }
    
    if (currentStep === 3 && !onboardingData.calendarConnected) {
      setError('Please connect your Google Calendar')
      return
    }
    
    if (currentStep === 4) {
      // Email validation is handled visually on blur only, not when clicking Next Step
      // No server-side validation needed here
    }
    
    if (currentStep === 5) {
      if (!onboardingData.meetingPreferences) {
        setError('Please select at least one meeting preference')
        return
      }
      
      // Validate that if In-Person is selected, duration is required
      if (onboardingData.meetingPreferences.inPerson && !onboardingData.meetingPreferences.inPersonDuration) {
        setError('Please select a default duration for In-Person meetings')
        return
      }
      if (onboardingData.meetingPreferences.inPerson && onboardingData.meetingPreferences.inPersonDuration === 'custom' && !onboardingData.meetingPreferences.inPersonCustomDuration) {
        setError('Please enter a custom duration for In-Person meetings')
        return
      }
      if (onboardingData.meetingPreferences.inPerson && onboardingData.meetingPreferences.inPersonCustomDuration && onboardingData.meetingPreferences.inPersonCustomDuration < 1) {
        setError('Custom duration must be at least 1 minute')
        return
      }
      
      // Validate that if Video Chat is selected, duration is required
      if (onboardingData.meetingPreferences.videoChat && !onboardingData.meetingPreferences.videoChatDuration) {
        setError('Please select a default duration for Video Chat meetings')
        return
      }
      if (onboardingData.meetingPreferences.videoChat && onboardingData.meetingPreferences.videoChatDuration === 'custom' && !onboardingData.meetingPreferences.videoChatCustomDuration) {
        setError('Please enter a custom duration for Video Chat meetings')
        return
      }
      if (onboardingData.meetingPreferences.videoChat && onboardingData.meetingPreferences.videoChatCustomDuration && onboardingData.meetingPreferences.videoChatCustomDuration < 1) {
        setError('Custom duration must be at least 1 minute')
        return
      }
    }
    
    // Save current step data before proceeding
    await saveCurrentStep()
    
    // Only advance steps during initial onboarding
    if (!isOnboardingCompleted) {
      if (isTeamMember) {
        // Volunteers: go through their 2-step flow (1 → 2 → complete)
        if (currentStep < 2) {
          const nextStep = currentStep + 1
          setCurrentStep(nextStep)
          setExpandedStep(nextStep)
          // Save current step to sessionStorage to preserve across OAuth redirects
          sessionStorage.setItem('onboarding_current_step', nextStep.toString())
        } else {
          // Complete onboarding
          await completeOnboarding()
        }
      } else {
        // Admins: go through their 6-step flow (1 → 2 → 3 → 4 → 5 → 6 → complete)
        if (currentStep < 6) {
          const nextStep = currentStep + 1
          setCurrentStep(nextStep)
          setExpandedStep(nextStep)
          // Save current step to sessionStorage to preserve across OAuth redirects
          sessionStorage.setItem('onboarding_current_step', nextStep.toString())
        } else {
          // Complete onboarding
          await completeOnboarding()
        }
      }
    }
    // If onboarding is completed, just save and stay on current step
  }

  const completeOnboarding = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)
      
      const functions = getFunctions()
      
      // 1. Send emails to team members if there are any
      let emailResults: any = null
      const teamMembers = onboardingData.users?.filter((u: any) => u.role === 'volunteer') || []
      
      if (teamMembers.length > 0) {
        console.log('Sending emails to team members:', teamMembers)
        const sendInvitations = httpsCallable(functions, 'sendTeamMemberInvitations')
        const selectedUserIds = teamMembers.map((u: any) => u.id)
        emailResults = await sendInvitations({ selectedUserIds })
        console.log('Email results:', emailResults.data)
      }
      
      // 2. Set pendingSetup to false and complete onboarding
      const completeOnboardingFn = httpsCallable(functions, 'completeOnboarding')
      const result = await completeOnboardingFn({ 
        organizationData: onboardingData,
        emailResults: emailResults?.data
      })
      
      const resultData = result.data as any
      
      if (resultData.success) {
        // Set onboarding as completed
        setIsOnboardingCompleted(true)
        
        // Show success message with email results
        let successMessage = 'Onboarding completed successfully!'
        
        if (emailResults?.data) {
          const successCount = emailResults.data.totalSent || 0
          const failCount = emailResults.data.totalFailed || 0
          
          if (failCount > 0) {
            successMessage = `Onboarding completed! ${successCount} invitation${successCount !== 1 ? 's' : ''} sent successfully, but ${failCount} failed to send. You can retry sending invitations later.`
          } else if (successCount > 0) {
            successMessage = `Onboarding completed! ${successCount} invitation${successCount !== 1 ? 's' : ''} sent successfully.`
          }
        }
        
        // Show success message
        setError(successMessage)
        
        // 3. Redirect based on role: admin -> bookings, volunteer -> work time
        const userRole = localStorage.getItem('onboarding_user_role') || currentUserRole
        
        setTimeout(() => {
          if (userRole === 'admin') {
            window.location.href = '/bookings'
          } else {
            window.location.href = '/work-schedule'
          }
        }, 2000)
      } else {
        throw new Error('Failed to complete onboarding')
      }
    } catch (error: any) {
      console.error('Error completing onboarding:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const checkCalendarStatus = useCallback(async () => {
    if (!user) return
    
    try {
      // Get the user's ID token for authentication
      const idToken = await user.getIdToken()
      
      const response = await fetch(`${API_CONFIG.baseUrl}/checkCalendarConnection`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      const connected = result.connected
      setOnboardingData(prev => ({ ...prev, calendarConnected: connected }))
    } catch (error) {
      console.error('Error checking calendar status:', error)
    }
  }, [user]) // Only recreate when user changes

  // Load onboarding progress when user is authenticated
  useEffect(() => {
    // Only load onboarding progress if user is authenticated
    if (user) {
      loadOnboardingProgress()
      checkCalendarStatus()
    }
  }, [user, loadOnboardingProgress, checkCalendarStatus]) // Include memoized functions

  const handleCalendarConnectionChange = (connected: boolean) => {
    setOnboardingData(prev => ({ ...prev, calendarConnected: connected }))
    // Don't reload onboarding progress when calendar connects - it can cause step state to reset
    // The calendar connection status is already updated in the state above
    console.log('📅 Calendar connection changed:', connected, 'Current step:', currentStep, 'Expanded step:', expandedStep)
  }

  const toggleStep = (step: number) => {
    // Allow expanding any step - user can navigate freely
    const newExpandedStep = expandedStep === step ? 0 : step
    
    // Update both state and ref
    setExpandedStep(newExpandedStep)
    expandedStepRef.current = newExpandedStep
    setExpandedStepLocked(true) // Lock the expanded step to prevent reset
    
    // Store in sessionStorage to persist across re-renders
    if (newExpandedStep > 0) {
      sessionStorage.setItem('onboarding_expanded_step', newExpandedStep.toString())
      // Also update current step when user manually navigates to a step
      setCurrentStep(newExpandedStep)
      sessionStorage.setItem('onboarding_current_step', newExpandedStep.toString())
    } else {
      sessionStorage.removeItem('onboarding_expanded_step')
    }
  }

  const validateEmail = (email: string): boolean => {
    if (!email || email.length === 0) return true // Empty is OK (not required)
    // More robust email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const getEmailValidationError = (email: string): string | null => {
    if (!email || email.length === 0) return null // Empty is OK (not required)
    if (!email.includes('@')) return 'Email must contain @'
    if (!email.includes('.')) return 'Email must contain .'
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return 'Invalid email format'
    return null
  }

  const getButtonText = (step: number, loading: boolean): string => {
    if (loading) {
      return 'Saving...'
    }
    
    // If user has completed onboarding, show "Save" for all steps
    if (isOnboardingCompleted) {
      return 'Save'
    }
    
    // During initial onboarding, show appropriate button text
    if (isTeamMember) {
      // Volunteers: "Next Step" for step 1, "Finish Setup" for step 2
      if (step <= 1) {
        return 'Next Step'
      } else if (step === 2) {
        return 'Finish Setup'
      }
    } else {
      // Admins: "Next Step" for steps 1-5, "Finish Setup" for step 6
      if (step <= 5) {
        return 'Next Step'
      } else if (step === 6) {
        return 'Finish Setup'
      }
    }
    
    // Fallback
    return 'Next Step'
  }

  const getStepData = (stepId: number) => {
    if (isTeamMember) {
      // Volunteer steps
      switch (stepId) {
        case 1:
          return { authenticated: true } // Authentication step
        case 2:
          return { welcomeComplete: true } // Welcome step
        default:
          return {}
      }
    } else {
      // Admin steps
      switch (stepId) {
        case 1:
          return { authenticated: true } // Authentication step
        case 2:
          return { organizationType: onboardingData.organizationType }
        case 3:
          return { calendarConnected: onboardingData.calendarConnected }
        case 4:
          return { users: onboardingData.users }
        case 5:
          return { meetingPreferences: onboardingData.meetingPreferences }
        case 6:
          return { reviewComplete: true } // Review step
        default:
          return {}
      }
    }
  }

  const checkUserData = async () => {
    if (!user) return
    
    try {
      const idToken = await user.getIdToken()
      const response = await fetch(`${API_CONFIG.baseUrl}/checkUserData`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        console.log('DEBUG: Raw user data from Firestore:', result)
      }
    } catch (error) {
      console.error('Error checking user data:', error)
    }
  }

  const sendEmailsToNewUsers = async () => {
    if (!user) return
    
    if (selectedUserIds.length === 0) {
      setError('No users selected to send invitations to')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // FIRST: Save the team members data to the backend
      console.log('Saving team members before sending invitations...')
      await saveStepData(4, { users: onboardingData.users })
      console.log('Team members saved successfully')
      
      // THEN: Call the new backend function using Firebase callable
      const functions = getFunctions()
      const sendInvitations = httpsCallable(functions, 'sendTeamMemberInvitations')
      const result: any = await sendInvitations({ selectedUserIds })
      
      const resultData = result.data as any
      
      if (resultData.success) {
        // Update user statuses based on results
        const updatedUsers = onboardingData.users?.map(u => {
          const sendResult = resultData.results.find((r: any) => r.id === u.id)
          if (sendResult && sendResult.success) {
            return { ...u, status: 'Emailed' as const }
          } else if (sendResult && !sendResult.success) {
            return { ...u, status: 'Error' as const }
          }
          return u
        })
        
        setOnboardingData(prev => ({ ...prev, users: updatedUsers }))
        
        // Clear selected users
        setSelectedUserIds([])
        
        // Show success message
        const successMessage = `Successfully sent ${resultData.totalSent} invitation${resultData.totalSent !== 1 ? 's' : ''}`
        console.log(successMessage, resultData)
        
        if (resultData.totalFailed > 0) {
          setError(`${successMessage}, but ${resultData.totalFailed} failed to send`)
        }
      } else {
        throw new Error('Failed to send invitations')
      }
    } catch (error: any) {
      console.error('Error sending emails:', error)
      
      // Update selected user statuses to 'Error'
      const updatedUsers = onboardingData.users?.map(u => {
        if (selectedUserIds.includes(u.id)) {
          return { ...u, status: 'Error' as const }
        }
        return u
      })
      
      setOnboardingData(prev => ({ ...prev, users: updatedUsers }))
      setError(`Failed to send emails: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Handle authentication for step 1
  const handleStep1Authentication = async () => {
    if (!orgId) {
      setError('Organization ID is required for authentication')
      return
    }

    try {
      setIsAuthenticating(true)
      setError(null)
      
      // Sign in with Google
      await signInWithGoogle()
      
      // The user will be set by the auth context, then we'll register them
    } catch (error) {
      console.error('Authentication error:', error)
      setError('Authentication failed. Please try again.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  // Register user with organization after authentication
  const registerUserWithOrgId = async () => {
    if (!user || !orgId) return

    console.log('🚨 registerUserWithOrgId called with:', { 
      userId: user.uid, 
      userEmail: user.email, 
      orgId 
    })

    try {
      setLoading(true)
      setError(null)

      const idToken = await user.getIdToken()
      console.log('🚨 Making registration request to:', `${API_CONFIG.baseUrl}/registerUserWithOrganization`)
      console.log('🚨 Request body:', { orgId })
      
      const response = await fetch(`${API_CONFIG.baseUrl}/registerUserWithOrganization`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orgId })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('User registration result:', result)
        
        if (result.success) {
          console.log('User successfully registered with organization')
          // Continue with onboarding
          return
        } else {
          console.error('Registration failed:', result.error)
          setError(result.error || 'Registration failed')
        }
      } else {
        const errorData = await response.json()
        console.error('Registration response error:', response.status, errorData)
        setError(errorData.error || 'Registration failed')
      }
    } catch (error) {
      console.error('Registration error:', error)
      setError('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Filter users based on search term
  const filteredUsers = onboardingData.users?.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  // Require authentication to access onboarding
  if (!user) {
    console.log('OnBoarding - No user, checking orgId:', { orgId, hasOrgId: !!orgId })
    
    // If we have an orgId, show step 1 authentication
    if (orgId) {
      console.log('OnBoarding - Showing step 1 authentication screen')
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="flex justify-center">
              <Building2 className="h-12 w-12 text-feline-600" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Welcome to Your Organization Portal
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Please sign in with Google to continue setting up your organization
            </p>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              <button
                onClick={handleStep1Authentication}
                disabled={isAuthenticating}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500 disabled:opacity-50"
              >
                {isAuthenticating ? 'Signing in...' : 'Sign in with Google'}
              </button>
            </div>
          </div>
        </div>
      )
    }
    
    // No orgId - redirect to access denied
    console.log('OnBoarding - No orgId, redirecting to access denied')
    return <Navigate to="/access-denied?error=AUTHENTICATION_REQUIRED" replace />
  }

  // Error boundary - if there's a critical error, show a fallback
  if (error && error.includes('Critical')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-feline-600 hover:bg-feline-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Define steps for admins only
  const adminSteps = [
    {
      id: 1,
      title: 'Authentication',
      icon: Shield,
      description: 'Sign in to continue'
    },
    {
      id: 2,
      title: 'Organization Type',
      icon: Building2,
      description: 'Tell us about your organization'
    },
    {
      id: 3,
      title: 'Calendar Integration',
      icon: Calendar,
      description: 'Connect your Google Calendar'
    },
    {
      id: 4,
      title: 'Team Members',
      icon: Users,
      description: 'Add your team members'
    },
    {
      id: 5,
      title: 'Meeting Preferences',
      icon: MessageCircle,
      description: 'Choose how you meet with adopters'
    },
    {
      id: 6,
      title: isOnboardingCompleted ? 'Review' : 'Review & Finish',
      icon: CheckCircle,
      description: isOnboardingCompleted ? 'Review your organization settings' : 'Review your setup and complete'
    }
  ]

  // Define steps for volunteers only
  const volunteerSteps = [
    {
      id: 1,
      title: 'Authentication',
      icon: Shield,
      description: 'Sign in to continue'
    },
    {
      id: 2,
      title: 'Welcome',
      icon: CheckCircle,
      description: 'Welcome to the team!'
    }
  ]

  // Select the appropriate steps based on user role
  const steps = isTeamMember ? volunteerSteps : adminSteps

  try {
    return (
      <div className="py-8 max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Organization Setup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Please take your time. You can leave the screen and come back later.
          </p>
          <p className="mt-2 text-sm text-blue-600">
            💡 Once you complete the onboarding process, you can come back and change your choices at any time.
          </p>
          <button
            onClick={checkUserData}
            className="mt-2 px-3 py-1 text-xs bg-red-500 text-white rounded"
          >
            DEBUG: Check Raw Firestore Data
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

      {/* Progress Steps */}
      <div className="space-y-4">
        {steps.map((step) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          // Use ref as fallback if state gets reset
          const isExpanded = expandedStep === step.id || (expandedStepLocked && expandedStepRef.current === step.id)
          
          // Debug logging for step 3 (Calendar Integration) - reduced
          if (step.id === 3 && isExpanded) {
            console.log('📅 Calendar step expanded:', { stepId: step.id, expandedStep, currentStep })
          }

          return (
            <div key={step.id} className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1 flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 ${
                    isCompleted ? 'bg-green-100 text-green-600' : 
                    isCurrent ? 'bg-feline-100 text-feline-600' : 
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 text-center">
                    <h3 className={`text-lg font-medium ${
                      isCompleted ? 'text-gray-900' :
                      isCurrent ? 'text-feline-600' : 'text-gray-900'
                    }`}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-500">{step.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleStep(step.id)}
                    disabled={false}
                    className="p-2 rounded-full transition-colors duration-200 border border-gray-200 hover:bg-gray-100 cursor-pointer"
                    title={isExpanded ? 'Collapse section' : 'Expand section'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-600 hover:text-gray-800" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-600 hover:text-gray-800" />
                    )}
                  </button>
                  
                  {/* Show Next Step/Save button for expanded step */}
                  {isExpanded && (
                    <button
                      onClick={() => {
                        if (step.id === currentStep) {
                          // Current step: Next Step or Finish Setup
                          if (isOnboardingCompleted) {
                            saveCurrentStep()
                          } else {
                            handleNextStep()
                          }
                        } else {
                          // Any other expanded step: Save changes to that step
                          saveStepData(step.id, getStepData(step.id))
                        }
                      }}
                      disabled={loading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-feline-600 hover:bg-feline-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        step.id === currentStep ? getButtonText(currentStep, loading) : 'Save'
                      )}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 pb-6 border-t border-gray-200">
                  {step.id === 1 && !isTeamMember && (
                    <div className="pt-6">
                      <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                          <Shield className="h-6 w-6 text-green-600" />
                        </div>
                        
                        <h4 className="text-lg font-medium text-gray-900 mb-2">
                          Hi {onboardingData.userName || user?.displayName || user?.email?.split('@')[0] || 'Admin'}!
                        </h4>
                        
                        <p className="text-sm text-gray-600 mb-6">
                          You're signed in as: {user?.email}
                        </p>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                          <h5 className="font-semibold text-green-900 mb-2">✅ Authentication Complete</h5>
                          <p className="text-sm text-green-800">
                            You're successfully signed in and ready to set up your organization.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {step.id === 2 && !isTeamMember && (
                    <div className="pt-6">
                      <h4 className="text-md font-medium text-gray-900 mb-4">What type of organization are you?</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          'Animal Shelter',
                          'Animal Rescue',
                          'Foster-Based Rescue',
                          'Sanctuary',
                          'Animal Control Agency',
                          'Humane Society',
                          'Spay/Neuter Clinic',
                          'Wildlife Rehabilitator',
                          'Breed-Specific Rescue',
                          'Transport Group'
                        ].map((type) => (
                          <label key={type} className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name="organizationType"
                              value={type}
                              checked={onboardingData.organizationType === type}
                              onChange={(e) => {
                                setOnboardingData(prev => ({ ...prev, organizationType: e.target.value as any }))
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.id === 3 && !isTeamMember && (
                    <div className="pt-6">
                      <h4 className="text-md font-medium text-gray-900 mb-4">Connect Google Calendar</h4>
                      
                      {/* Instructional Box */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h5 className="font-semibold text-blue-900 mb-2">📅 Calendar Setup Instructions</h5>
                        <ul className="text-sm text-blue-800 space-y-1.5 list-disc list-inside">
                          <li>Click "Grant Access to Calendars" to connect your Google account</li>
                          <li>You'll see all calendars you have access to (personal, shared, and subscribed)</li>
                          <li><strong>Best Practice:</strong> Create a dedicated calendar like "Shelter Appointments" or "Adoption Meetings"</li>
                          <li>Share that calendar with team members who need to schedule appointments</li>
                          <li>Select your shelter's scheduling calendar from the dropdown</li>
                          <li>All adoption appointments will be added to the selected calendar</li>
                        </ul>
                      </div>
                      
                      <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">
                            Calendar Status: {onboardingData.calendarConnected ? '✅ Connected' : '❌ Not Connected'}
                          </span>
                          <button
                            onClick={() => {
                              try {
                                checkCalendarStatus()
                              } catch (error) {
                                console.error('Error checking calendar status:', error)
                                setError('Failed to check calendar status. Please try again.')
                              }
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            Refresh Status
                          </button>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                          {(() => {
                            try {
                              return <CalendarIntegration onCalendarConnected={handleCalendarConnectionChange} />
                            } catch (error) {
                              console.error('CalendarIntegration error:', error)
                              return (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                                  <p className="text-sm text-red-700">
                                    Calendar integration is temporarily unavailable. Please try refreshing the page.
                                  </p>
                                </div>
                              )
                            }
                          })()}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 italic">
                        💡 After connecting your calendar, click "Next Step" to continue with team setup, or refresh the page if the calendar doesn't show as connected.
                      </p>
                    </div>
                  )}

                  {step.id === 1 && isTeamMember && (
                    <div className="pt-6">
                      <div className="text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                          <Shield className="h-6 w-6 text-green-600" />
                        </div>
                        
                        <h4 className="text-lg font-medium text-gray-900 mb-2">
                          Hi {onboardingData.userName || user?.displayName || user?.email?.split('@')[0] || 'Team Member'}!
                        </h4>
                        
                        <p className="text-sm text-gray-600 mb-6">
                          You're signed in as: {user?.email}
                        </p>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                          <h5 className="font-semibold text-green-900 mb-2">✅ Authentication Complete</h5>
                          <p className="text-sm text-green-800">
                            You're successfully signed in and ready to join your organization's team.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {step.id === 2 && isTeamMember && (
                    <div className="pt-6">
                      <h4 className="text-md font-medium text-gray-900 mb-4">Welcome to Feline Finder!</h4>
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h5 className="font-semibold text-blue-900 mb-2">🎉 You're all set!</h5>
                          <p className="text-sm text-blue-800">
                            Welcome to the Feline Finder system! Your administrator has completed the organization setup, 
                            and you now have access to all the features.
                          </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h5 className="font-medium text-gray-900 mb-2">What's Next?</h5>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>• View and manage adoption bookings</li>
                            <li>• Coordinate with your team members</li>
                            <li>• Access all organization features</li>
                          </ul>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-4">
                            Click "Finish Setup" to complete your onboarding and access all features.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {step.id === 4 && !isTeamMember && (
                    <div className="pt-6">
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-md font-medium text-gray-900">Team Members</h4>
                          <div className="flex items-center space-x-2">
                            {/* Search Input */}
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Search team members..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-feline-500 focus:border-feline-500"
                              />
                              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                            </div>
                            
                            {/* Add User Button */}
                            <button
                              onClick={() => {
                                const newUser = {
                                  id: `user-${Date.now()}`,
                                  name: '',
                                  email: '',
                                  role: 'volunteer' as const,
                                  calendarLinked: false,
                                  status: 'New' as const
                                }
                                setOnboardingData(prev => ({
                                  ...prev,
                                  users: [...(prev.users || []), newUser]
                                }))
                              }}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-feline-600 hover:bg-feline-700"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add User
                            </button>
                          </div>
                        </div>
                        
                        {/* Show search results count */}
                        {searchTerm && (
                          <div className="text-sm text-gray-600 mb-2">
                            Showing {filteredUsers.length} of {onboardingData.users?.length || 0} team members
                          </div>
                        )}
                      </div>
                      
                      {onboardingData.pendingSetup && (
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => {
                                if (selectedUserIds.length > 0) {
                                  setShowConfirmDialog(true)
                                }
                              }}
                              disabled={loading || selectedUserIds.length === 0}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              📧 Email Invitation ({selectedUserIds.length} selected)
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Confirmation Dialog */}
                      {showConfirmDialog && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                              Confirm Invitation
                            </h3>
                            <p className="text-sm text-gray-600 mb-6">
                              Are you sure you want to send invitations to the {selectedUserIds.length} selected {selectedUserIds.length === 1 ? 'person' : 'people'}?
                            </p>
                            <div className="flex justify-end space-x-3">
                              <button
                                onClick={() => setShowConfirmDialog(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  setShowConfirmDialog(false)
                                  await sendEmailsToNewUsers()
                                }}
                                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                              >
                                Send Invitations
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-300">
                          <thead className="bg-gray-50">
                            <tr>
                              {onboardingData.pendingSetup && (
                                <th className="px-3 py-3 text-left">
                                  <input
                                    type="checkbox"
                                    checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedUserIds(filteredUsers.map(u => u.id))
                                      } else {
                                        setSelectedUserIds([])
                                      }
                                    }}
                                    className="rounded border-gray-300"
                                  />
                                </th>
                              )}
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers.map((user, index) => (
                              <tr key={user.id}>
                                {onboardingData.pendingSetup && (
                                  <td className="px-3 py-4 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={selectedUserIds.includes(user.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedUserIds([...selectedUserIds, user.id])
                                        } else {
                                          setSelectedUserIds(selectedUserIds.filter(id => id !== user.id))
                                        }
                                      }}
                                      className="rounded border-gray-300"
                                    />
                                  </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <input
                                    type="text"
                                    value={user.name}
                                    onChange={(e) => {
                                      const newUsers = [...(onboardingData.users || [])]
                                      newUsers[index].name = e.target.value
                                      setOnboardingData(prev => ({ ...prev, users: newUsers }))
                                    }}
                                    className="border border-gray-300 rounded-md px-3 py-1 text-sm w-full"
                                    placeholder="Full name"
                                  />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div>
                                    <input
                                      type="text"
                                      value={user.email || ''}
                                      onChange={(e) => {
                                        const newUsers = [...(onboardingData.users || [])]
                                        newUsers[index].email = e.target.value
                                        setOnboardingData(prev => ({ ...prev, users: newUsers }))
                                        // Clear any existing validation error when typing
                                        if (emailValidationErrors.has(user.id)) {
                                          setEmailValidationErrors(prev => {
                                            const newMap = new Map(prev)
                                            newMap.delete(user.id)
                                            return newMap
                                          })
                                        }
                                      }}
                                      onBlur={(e) => {
                                        // Run validation and store the error
                                        const email = e.target.value
                                        if (email && email.length > 0 && !validateEmail(email)) {
                                          setEmailValidationErrors(prev => {
                                            const newMap = new Map(prev)
                                            newMap.set(user.id, getEmailValidationError(email) || 'Invalid email')
                                            return newMap
                                          })
                                        } else {
                                          setEmailValidationErrors(prev => {
                                            const newMap = new Map(prev)
                                            newMap.delete(user.id)
                                            return newMap
                                          })
                                        }
                                      }}
                                      className={`border rounded-md px-3 py-1 text-sm w-full ${
                                        emailValidationErrors.has(user.id)
                                          ? 'border-red-300 bg-red-50' 
                                          : 'border-gray-300'
                                      }`}
                                      placeholder="email@example.com"
                                    />
                                    {emailValidationErrors.has(user.id) && (
                                      <p className="text-xs text-red-600 mt-1">
                                        {emailValidationErrors.get(user.id)}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <select
                                    value={user.role}
                                    onChange={(e) => {
                                      const newUsers = [...(onboardingData.users || [])]
                                      newUsers[index].role = e.target.value as 'volunteer' | 'admin'
                                      setOnboardingData(prev => ({ ...prev, users: newUsers }))
                                    }}
                                    className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                                  >
                                    <option value="volunteer">Volunteer/Foster</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    user.status === 'New' ? 'bg-blue-100 text-blue-800' :
                                    user.status === 'Emailed' || user.status === 'invited' ? 'bg-yellow-100 text-yellow-800' :
                                    user.status === 'Setup' || user.status === 'verified' ? 'bg-green-100 text-green-800' :
                                    user.status === 'Error' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {user.status === 'invited' ? 'Emailed' : user.status === 'verified' ? 'Setup' : user.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => {
                                      const newUsers = (onboardingData.users || []).filter(u => u.id !== user.id)
                                      setOnboardingData(prev => ({ ...prev, users: newUsers }))
                                    }}
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {step.id === 5 && !isTeamMember && (
                    <div className="pt-6">
                      <div className="mb-4">
                        <h4 className="text-md font-medium text-gray-900 mb-2">Meeting Preferences</h4>
                        <p className="text-sm text-gray-600">How would you like to meet with potential adopters?</p>
                      </div>
                      <div className="space-y-6">
                        {/* In-Person Option */}
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={onboardingData.meetingPreferences?.inPerson || false}
                              onChange={(e) => setOnboardingData(prev => ({
                                ...prev,
                                meetingPreferences: {
                                  ...prev.meetingPreferences,
                                  inPerson: e.target.checked,
                                  videoChat: prev.meetingPreferences?.videoChat || false,
                                  adoptionEvent: prev.meetingPreferences?.adoptionEvent || false
                                }
                              }))}
                              className="mr-3"
                            />
                            <span className="text-sm text-gray-700 font-medium">In-Person</span>
                            {onboardingData.meetingPreferences?.inPerson && (
                              <>
                                <label className="text-sm font-medium text-gray-700 ml-4">
                                  Default Duration:
                                </label>
                                <select
                                  value={onboardingData.meetingPreferences?.inPersonDuration || ''}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setOnboardingData(prev => ({
                                      ...prev,
                                      meetingPreferences: {
                                        ...prev.meetingPreferences,
                                        inPersonDuration: value === 'custom' ? 'custom' : value === '' ? undefined : Number(value)
                                      }
                                    }))
                                    // Clear error when changing
                                    setCustomDurationErrors(prev => {
                                      const newMap = new Map(prev)
                                      newMap.delete('inPersonCustom')
                                      return newMap
                                    })
                                  }}
                                  className="px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                  required
                                >
                                  <option value="">Select duration...</option>
                                  <option value="15">15 minutes</option>
                                  <option value="30">30 minutes</option>
                                  <option value="45">45 minutes</option>
                                  <option value="60">60 minutes</option>
                                  <option value="custom">Custom</option>
                                </select>
                                {onboardingData.meetingPreferences?.inPersonDuration === 'custom' && (
                                  <>
                                    <label className="text-sm font-medium text-gray-700 ml-2">
                                      Custom:
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      placeholder="minutes"
                                      value={onboardingData.meetingPreferences?.inPersonCustomDuration || ''}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        setOnboardingData(prev => ({
                                          ...prev,
                                          meetingPreferences: {
                                            ...prev.meetingPreferences,
                                            inPersonCustomDuration: value === '' ? undefined : Number(value)
                                          }
                                        }))
                                        // Clear error when typing
                                        setCustomDurationErrors(prev => {
                                          const newMap = new Map(prev)
                                          newMap.delete('inPersonCustom')
                                          return newMap
                                        })
                                      }}
                                      onBlur={(e) => {
                                        const value = Number(e.target.value)
                                        if (value < 1) {
                                          setCustomDurationErrors(prev => {
                                            const newMap = new Map(prev)
                                            newMap.set('inPersonCustom', 'Duration must be at least 1 minute')
                                            return newMap
                                          })
                                        }
                                      }}
                                      className={`px-3 py-1 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-24 ${
                                        customDurationErrors.has('inPersonCustom') ? 'border-red-500' : 'border-gray-300'
                                      }`}
                                      required
                                    />
                                    {customDurationErrors.has('inPersonCustom') && (
                                      <p className="text-sm text-red-600">{customDurationErrors.get('inPersonCustom')}</p>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Video Chat Option */}
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={onboardingData.meetingPreferences?.videoChat || false}
                              onChange={(e) => setOnboardingData(prev => ({
                                ...prev,
                                meetingPreferences: {
                                  ...prev.meetingPreferences,
                                  inPerson: prev.meetingPreferences?.inPerson || false,
                                  videoChat: e.target.checked,
                                  adoptionEvent: prev.meetingPreferences?.adoptionEvent || false
                                }
                              }))}
                              className="mr-3"
                            />
                            <span className="text-sm text-gray-700 font-medium">Video Chat</span>
                            {onboardingData.meetingPreferences?.videoChat && (
                              <>
                                <label className="text-sm font-medium text-gray-700 ml-4">
                                  Default Duration:
                                </label>
                                <select
                                  value={onboardingData.meetingPreferences?.videoChatDuration || ''}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setOnboardingData(prev => ({
                                      ...prev,
                                      meetingPreferences: {
                                        ...prev.meetingPreferences,
                                        videoChatDuration: value === 'custom' ? 'custom' : value === '' ? undefined : Number(value)
                                      }
                                    }))
                                    // Clear error when changing
                                    setCustomDurationErrors(prev => {
                                      const newMap = new Map(prev)
                                      newMap.delete('videoChatCustom')
                                      return newMap
                                    })
                                  }}
                                  className="px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                  required
                                >
                                  <option value="">Select duration...</option>
                                  <option value="15">15 minutes</option>
                                  <option value="30">30 minutes</option>
                                  <option value="45">45 minutes</option>
                                  <option value="60">60 minutes</option>
                                  <option value="custom">Custom</option>
                                </select>
                                {onboardingData.meetingPreferences?.videoChatDuration === 'custom' && (
                                  <>
                                    <label className="text-sm font-medium text-gray-700 ml-2">
                                      Custom:
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      placeholder="minutes"
                                      value={onboardingData.meetingPreferences?.videoChatCustomDuration || ''}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        setOnboardingData(prev => ({
                                          ...prev,
                                          meetingPreferences: {
                                            ...prev.meetingPreferences,
                                            videoChatCustomDuration: value === '' ? undefined : Number(value)
                                          }
                                        }))
                                        // Clear error when typing
                                        setCustomDurationErrors(prev => {
                                          const newMap = new Map(prev)
                                          newMap.delete('videoChatCustom')
                                          return newMap
                                        })
                                      }}
                                      onBlur={(e) => {
                                        const value = Number(e.target.value)
                                        if (value < 1) {
                                          setCustomDurationErrors(prev => {
                                            const newMap = new Map(prev)
                                            newMap.set('videoChatCustom', 'Duration must be at least 1 minute')
                                            return newMap
                                          })
                                        }
                                      }}
                                      className={`px-3 py-1 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-24 ${
                                        customDurationErrors.has('videoChatCustom') ? 'border-red-500' : 'border-gray-300'
                                      }`}
                                      required
                                    />
                                    {customDurationErrors.has('videoChatCustom') && (
                                      <p className="text-sm text-red-600">{customDurationErrors.get('videoChatCustom')}</p>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Adoption Event Option */}
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={onboardingData.meetingPreferences?.adoptionEvent || false}
                            onChange={(e) => setOnboardingData(prev => ({
                              ...prev,
                              meetingPreferences: {
                                ...prev.meetingPreferences,
                                inPerson: prev.meetingPreferences?.inPerson || false,
                                videoChat: prev.meetingPreferences?.videoChat || false,
                                adoptionEvent: e.target.checked
                              }
                            }))}
                            className="mr-3"
                          />
                          <span className="text-sm text-gray-700 font-medium">Adoption Event</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {step.id === 6 && !isTeamMember && (
                    <div className="pt-6">
                      <h4 className="text-md font-medium text-gray-900 mb-4">
                        {isOnboardingCompleted ? 'Review Your Organization Settings' : 'Review Your Setup'}
                      </h4>
                      <div className="space-y-4">
                        {/* Team members only see their welcome message */}
                        {isTeamMember ? (
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <h5 className="font-medium text-gray-900 mb-2">Welcome!</h5>
                            <div className="text-sm text-gray-600">
                              <p>You're all set! Your administrator has completed the organization setup, and you now have access to all the features.</p>
                            </div>
                          </div>
                        ) : (
                          /* Admin sees all organization settings */
                          <>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h5 className="font-medium text-gray-900 mb-2">Organization Type</h5>
                              <p className="text-sm text-gray-600 capitalize">
                                {onboardingData.organizationType || 'Not selected'}
                              </p>
                            </div>
                            
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h5 className="font-medium text-gray-900 mb-2">Calendar Connection</h5>
                              {onboardingData.calendarConnected ? (
                                <div className="text-sm text-gray-600 space-y-1">
                                  <p className="flex items-center">
                                    <span className="text-green-600 mr-2">✓</span>
                                    <span className="font-medium">Connected</span>
                                  </p>
                                  {onboardingData.selectedCalendarId && (
                                    <p className="ml-6">
                                      <span className="font-medium">Selected Calendar:</span>{' '}
                                      {onboardingData.selectedCalendarName || 
                                       (onboardingData.selectedCalendarId === 'primary' 
                                        ? 'Primary Calendar' 
                                        : onboardingData.selectedCalendarId)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-600">Not connected</p>
                              )}
                            </div>
                            
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h5 className="font-medium text-gray-900 mb-2">Team Members</h5>
                              <div className="text-sm text-gray-600">
                                {onboardingData.users?.length || 0} members added
                              </div>
                            </div>
                            
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h5 className="font-medium text-gray-900 mb-2">Meeting Preferences</h5>
                              <div className="text-sm text-gray-600 space-y-2">
                                {onboardingData.meetingPreferences?.inPerson && (
                                  <div>
                                    <span className="font-medium">In-Person: </span>
                                    <span>
                                      {onboardingData.meetingPreferences.inPersonDuration === 'custom' 
                                        ? `${onboardingData.meetingPreferences.inPersonCustomDuration || 0} minutes (custom)`
                                        : `${onboardingData.meetingPreferences.inPersonDuration} minutes`
                                      }
                                    </span>
                                  </div>
                                )}
                                {onboardingData.meetingPreferences?.videoChat && (
                                  <div>
                                    <span className="font-medium">Video Chat: </span>
                                    <span>
                                      {onboardingData.meetingPreferences.videoChatDuration === 'custom' 
                                        ? `${onboardingData.meetingPreferences.videoChatCustomDuration || 0} minutes (custom)`
                                        : `${onboardingData.meetingPreferences.videoChatDuration} minutes`
                                      }
                                    </span>
                                  </div>
                                )}
                                {onboardingData.meetingPreferences?.adoptionEvent && (
                                  <div>
                                    <span className="font-medium">Adoption Event</span>
                                  </div>
                                )}
                                {!onboardingData.meetingPreferences && 'Not selected'}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
  } catch (error) {
    console.error('OnBoarding component error:', error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-gray-600">
              There was an error loading the onboarding page. Please try refreshing.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-feline-600 hover:bg-feline-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default OnBoarding
