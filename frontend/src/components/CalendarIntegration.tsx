import React, { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { API_CONFIG } from '../config/environment'
import { getFunctions, httpsCallable } from 'firebase/functions'

interface CalendarIntegrationProps {
  onCalendarConnected?: (connected: boolean) => void
}

interface Calendar {
  id: string
  summary: string
  primary?: boolean
}

const CalendarIntegration: React.FC<CalendarIntegrationProps> = ({ onCalendarConnected }) => {
  const { user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')
  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [previousConnectionStatus, setPreviousConnectionStatus] = useState<boolean | null>(null)

  useEffect(() => {
    if (user) {
      // Only check once when user is available
      checkCalendarConnection()
    }
  }, [user])

  // Also check when component mounts (useful after OAuth redirect)
  useEffect(() => {
    if (user) {
      // Immediate check when component mounts
      checkCalendarConnection()
    }
  }, [])

  const checkCalendarConnection = async () => {
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
      
      // Only notify parent if connection status actually changed
      const statusChanged = previousConnectionStatus !== connected
      
      setIsConnected(connected)
      setPreviousConnectionStatus(connected)
      
      // If connected, fetch the list of calendars
      if (connected) {
        await fetchCalendars()
      }
      
      // Only notify parent component if status changed
      if (onCalendarConnected && statusChanged) {
        onCalendarConnected(connected)
      }
    } catch (error) {
      console.error('Error checking calendar connection:', error)
      setIsConnected(false)
    }
  }

  const fetchCalendars = async () => {
    console.log('🔍 fetchCalendars called - user:', user ? 'authenticated' : 'not authenticated')
    if (!user) {
      console.log('❌ No user - cannot fetch calendars')
      return
    }

    setLoadingCalendars(true)
    try {
      console.log('📞 Calling listCalendars function...')
      const functions = getFunctions()
      const listCalendarsFunc = httpsCallable(functions, 'listCalendars')
      const result: any = await listCalendarsFunc({})
      const resultData = result.data as any
      
      console.log('✅ listCalendars result:', resultData)
      console.log('📋 Number of calendars:', resultData.calendars?.length || 0)
      
      setCalendars(resultData.calendars || [])
      
      // Load saved calendar selection from onboarding data
      const setupToken = localStorage.getItem('onboarding_setup_token')
      const getProgress = httpsCallable(functions, 'getOnboardingProgress')
      
      try {
        const progressResult: any = await getProgress({ setupToken })
        const savedCalendarId = progressResult.data?.onboarding?.selectedCalendarId
        
        console.log('📋 Saved calendar ID:', savedCalendarId)
        
        if (savedCalendarId) {
          setSelectedCalendarId(savedCalendarId)
        } else {
          // Auto-select primary calendar if no saved selection
          const primaryCalendar = resultData.calendars?.find((cal: Calendar) => cal.primary)
          if (primaryCalendar) {
            console.log('✅ Auto-selecting primary calendar:', primaryCalendar.id)
            setSelectedCalendarId(primaryCalendar.id)
            
            // Auto-save the primary calendar selection
            try {
              const functions = getFunctions()
              const saveCalendar = httpsCallable(functions, 'saveSelectedCalendar')
              await saveCalendar({ 
                calendarId: primaryCalendar.id,
                calendarName: primaryCalendar.summary
              })
              console.log('✅ Auto-saved primary calendar selection:', primaryCalendar.id, primaryCalendar.summary)
            } catch (error) {
              console.error('Error auto-saving primary calendar:', error)
            }
          }
        }
      } catch (progressError) {
        console.error('Error loading saved calendar selection:', progressError)
        // Auto-select primary calendar as fallback
        const primaryCalendar = resultData.calendars?.find((cal: Calendar) => cal.primary)
        if (primaryCalendar) {
          console.log('✅ Auto-selecting primary calendar (fallback):', primaryCalendar.id)
          setSelectedCalendarId(primaryCalendar.id)
          
          // Auto-save the primary calendar selection
          try {
            const functions = getFunctions()
            const saveCalendar = httpsCallable(functions, 'saveSelectedCalendar')
            await saveCalendar({ 
              calendarId: primaryCalendar.id,
              calendarName: primaryCalendar.summary
            })
            console.log('✅ Auto-saved primary calendar selection (fallback):', primaryCalendar.id, primaryCalendar.summary)
          } catch (error) {
            console.error('Error auto-saving primary calendar (fallback):', error)
          }
        }
      }
    } catch (error) {
      console.error('❌ Error fetching calendars:', error)
      setError('Failed to load calendars. Please try refreshing.')
    } finally {
      setLoadingCalendars(false)
    }
  }

  const connectCalendar = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      // If no user yet, we need to get the setup token from localStorage
      let authHeader
      if (user) {
        const idToken = await user.getIdToken()
        authHeader = `Bearer ${idToken}`
      } else {
        // User hasn't authenticated yet - get setup token from localStorage
        const setupToken = localStorage.getItem('onboarding_setup_token')
        if (!setupToken) {
          throw new Error('No setup token found. Please restart the verification process.')
        }
        authHeader = `SetupToken ${setupToken}`
      }
      
      const response = await fetch(`${API_CONFIG.baseUrl}/generateCalendarOAuthUrl`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      const { authUrl } = result
      
      // Save current step to sessionStorage before redirecting
      const currentStep = sessionStorage.getItem('onboarding_current_step') || '3'
      const expandedStep = sessionStorage.getItem('onboarding_expanded_step') || '3'
      console.log('💾 Saving step before OAuth redirect - current:', currentStep, 'expanded:', expandedStep)
      
      // Redirect to Google OAuth
      window.location.href = authUrl
    } catch (error) {
      console.error('Error connecting calendar:', error)
      setError('Failed to connect calendar. Please try again.')
      setIsConnecting(false)
    }
  }

  const disconnectCalendar = async () => {
    if (!user) return

    try {
      // Get the user's ID token for authentication
      const idToken = await user.getIdToken()
      
      const response = await fetch(`${API_CONFIG.baseUrl}/disconnectCalendar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      setIsConnected(false)
      setPreviousConnectionStatus(false)
      
      // Notify parent component (disconnect is always a status change)
      if (onCalendarConnected) {
        onCalendarConnected(false)
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error)
      setError('Failed to disconnect calendar. Please try again.')
    }
  }

  const testCalendarConnection = async () => {
    if (!user) return

    try {
      // Get the user's ID token for authentication
      const idToken = await user.getIdToken()
      
      const response = await fetch(`${API_CONFIG.baseUrl}/testCalendarConnection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      alert(`✅ ${data.message}\n\nEvent Link: ${data.eventLink}`)
    } catch (error: any) {
      console.error('Error testing calendar:', error)
      alert(`❌ Calendar test failed: ${error.message}`)
    }
  }

  // If no user yet, show a prompt to connect calendar (which will trigger Google sign-in)
  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Google Calendar Integration
        </h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800 mb-3">
              <strong>Sign in with Google to connect your calendar.</strong>
            </p>
            <p className="text-sm text-blue-700">
              This will create your account and connect your Google Calendar for scheduling adoption appointments.
            </p>
          </div>
          
          <button
            onClick={connectCalendar}
            disabled={isConnecting}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Sign in with Google & Grant Access to Calendars'}
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Google Calendar Integration
      </h3>
      
      <div className="space-y-4">
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-green-700 font-medium">Calendar Access Granted</span>
              </div>
              <button
                onClick={disconnectCalendar}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
              >
                Disconnect
              </button>
            </div>
            
            {/* Calendar Selection Dropdown */}
            <div>
              <label htmlFor="calendar-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Shelter Scheduling Calendar
              </label>
              {loadingCalendars ? (
                <div className="text-sm text-gray-600">Loading calendars...</div>
              ) : calendars.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>No calendars found.</strong> Please make sure you have at least one calendar in your Google account.
                  </p>
                </div>
              ) : (
                <>
                  <select
                    id="calendar-select"
                    value={selectedCalendarId}
                    onChange={async (e) => {
                      const newCalendarId = e.target.value
                      
                      // Special case: "Make a New Calendar"
                      if (newCalendarId === 'make_new_calendar') {
                        // Open Google Calendar settings to create a new calendar
                        window.open('https://calendar.google.com/calendar/u/0/r/settings/createcalendar', '_blank')
                        // Reset selection to current value
                        setSelectedCalendarId(selectedCalendarId)
                        return
                      }
                      
                      setSelectedCalendarId(newCalendarId)
                      
                      // Save the selected calendar
                      if (newCalendarId) {
                        try {
                          const functions = getFunctions()
                          const saveCalendar = httpsCallable(functions, 'saveSelectedCalendar')
                          // Find the calendar name for the selected ID
                          const selectedCalendar = calendars.find(cal => cal.id === newCalendarId)
                          const calendarName = selectedCalendar?.summary || 'Unknown Calendar'
                          await saveCalendar({ 
                            calendarId: newCalendarId,
                            calendarName: calendarName
                          })
                          console.log('Calendar selection saved:', newCalendarId, calendarName)
                        } catch (error) {
                          console.error('Error saving calendar selection:', error)
                          setError('Failed to save calendar selection. Please try again.')
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Select a calendar --</option>
                    {calendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.summary} {calendar.primary ? '(Primary)' : ''}
                      </option>
                    ))}
                    <option value="make_new_calendar" className="text-blue-600 italic">➕ Make a New Calendar</option>
                  </select>
                  {selectedCalendarId && (
                    <p className="text-xs text-green-600 mt-1">✓ Calendar selected and saved</p>
                  )}
                </>
              )}
            </div>
            
            <button
              onClick={testCalendarConnection}
              className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
            >
              🧪 Test Calendar Connection
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
                <span className="text-gray-600">Calendar Access Not Granted</span>
              </div>
              <button
                onClick={connectCalendar}
                disabled={isConnecting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isConnecting ? 'Connecting...' : 'Grant Access to Calendars'}
              </button>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                💡 If you just connected and don't see it reflected here, please <strong>refresh the page</strong>.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p>
            Connect your Google Calendar to automatically create events when you schedule pet adoption appointments.
          </p>
        </div>
      </div>
    </div>
  )
}

export default CalendarIntegration
