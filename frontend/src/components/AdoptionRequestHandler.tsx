import React, { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { Link } from 'react-router-dom'
import { RescueGroupsUtils } from '../utils/rescueGroupsUtils'
import { 
  Calendar, 
  ExternalLink, 
  Users, 
  UserPlus, 
  Mail, 
  Save,
  CheckCircle,
  Loader2,
  Settings
} from 'lucide-react'

interface AdoptionRequestSettings {
  selectedOption: 'redirect' | 'connect' | 'builtin' | null
  redirectUrl: string
  connectUrl: string
  isCalendarConnected: boolean
}

const AdoptionRequestHandler: React.FC = () => {
  const { user } = useAuth()
  const functions = getFunctions()
  
  // Adoption request settings
  const [settings, setSettings] = useState<AdoptionRequestSettings>({
    selectedOption: null,
    redirectUrl: '',
    connectUrl: '',
    isCalendarConnected: false
  })
  
  // Calendar connection state
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  // Volunteer invite form state
  const [inviteeEmail, setInviteeEmail] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [OrgID, setOrgID] = useState('')
  const [role, setRole] = useState('volunteer')
  const [sending, setSending] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [userOrganization, setUserOrganization] = useState<any>(null)

  // Load settings and organization data
  useEffect(() => {
    if (user?.uid) {
      loadSettings()
      loadOrganizationData()
      checkCalendarConnection()
    }
  }, [user?.uid])

  const loadSettings = async () => {
    try {
      // Get user's organization data first
      const userDoc = await doc(db, 'users', user!.uid)
      const userSnapshot = await getDoc(userDoc)
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.data()
        const OrgID = userData?.OrgID
        
        // Set calendar connection status from user data
        setSettings(prev => ({
          ...prev,
          isCalendarConnected: userData?.calendarConnected || false
        }))
        
        if (OrgID) {
          const settingsDoc = await doc(db, 'organization', OrgID)
          const unsubscribe = onSnapshot(settingsDoc, (doc) => {
            if (doc.exists()) {
              const data = doc.data()
              setSettings(prev => ({
                ...prev,
                selectedOption: data.adoptionRequestSettings?.selectedOption || null,
                redirectUrl: data.adoptionRequestSettings?.redirectUrl || '',
                connectUrl: data.adoptionRequestSettings?.connectUrl || ''
              }))
            }
          })
          return unsubscribe
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const loadOrganizationData = async () => {
    try {
      const userDoc = await doc(db, 'users', user!.uid)
      const unsubscribe = onSnapshot(userDoc, (doc) => {
        if (doc.exists()) {
          const userData = doc.data()
          setUserOrganization(userData)
      setOrganizationName(userData.organizationName || '')
      setOrgID(userData.OrgID || '')
          
          // Auto-fill redirect URL with RescueGroups organization URL if available
          if (userData.OrgID && !settings.redirectUrl) {
            setSettings(prev => ({
              ...prev,
              redirectUrl: RescueGroupsUtils.getOrganizationUrl(userData.OrgID)
            }))
          }
        }
      })
      return unsubscribe
    } catch (error) {
      console.error('Error loading organization data:', error)
    }
  }

  const checkCalendarConnection = async () => {
    if (!user) return

    try {
      // Get the user's ID token for authentication
      const idToken = await user.getIdToken()
      
      const response = await fetch('https://us-central1-feline-finder-org-portal.cloudfunctions.net/checkCalendarConnection', {
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
      
      setSettings(prev => ({
        ...prev,
        isCalendarConnected: result.connected
      }))
    } catch (error) {
      console.error('Error checking calendar connection:', error)
    }
  }

  const connectCalendar = async () => {
    if (!user) return

    setIsConnecting(true)
    setError(null)

    try {
      // Get the user's ID token for authentication
      const idToken = await user.getIdToken()
      
      const response = await fetch('https://us-central1-feline-finder-org-portal.cloudfunctions.net/generateCalendarOAuthUrl', {
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
      const { authUrl } = result
      window.location.href = authUrl
    } catch (error) {
      console.error('Error connecting calendar:', error)
      setError('Failed to connect calendar. Please try again.')
      setIsConnecting(false)
    }
  }

  const testUrl = async (url: string) => {
    try {
      // Open the URL in a new tab/window
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      alert('❌ Failed to open URL. Please check the URL format.')
    }
  }

  const saveSettings = async () => {
    if (!user) return

    setSaving(true)
    setMessage('')

    try {
      // Get user's organization data first
      const userDoc = await doc(db, 'users', user.uid)
      const userSnapshot = await getDoc(userDoc)
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.data()
        const OrgID = userData?.OrgID
        
        if (OrgID) {
          // Save adoption request settings to organization
          await setDoc(doc(db, 'organization', OrgID), {
            adoptionRequestSettings: {
              selectedOption: settings.selectedOption,
              redirectUrl: settings.redirectUrl,
              connectUrl: settings.connectUrl,
              updatedAt: serverTimestamp(),
              updatedBy: user.uid
            }
          }, { merge: true })

          // Save calendar connection status to user document
          await setDoc(doc(db, 'users', user.uid), {
            calendarConnected: settings.isCalendarConnected,
            calendarTokens: settings.isCalendarConnected ? {
              // Calendar token data will be populated by the calendar connection process
              connectedAt: serverTimestamp(),
              connectedBy: user.uid
            } : null
          }, { merge: true })

          setMessage('✅ Settings saved successfully!')
        } else {
          setMessage('❌ No RescueGroups organization ID found. Please contact an admin.')
        }
      } else {
        setMessage('❌ User data not found. Please contact support.')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage('❌ Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inviteeEmail || !organizationName) {
      setInviteMessage('Please fill in all required fields')
      return
    }

    try {
      setSending(true)
      setInviteMessage('')
      
      const sendOrganizationInvite = httpsCallable(functions, 'sendOrganizationInvite')
      const result = await sendOrganizationInvite({
        inviteeEmail,
        organizationName: organizationName,
        rescueGroupsOrgId: OrgID || null,
        role,
        inviterName: user?.displayName || 'Organization Admin'
      })
      
      if ((result.data as any).success) {
        setInviteMessage(`✅ Invitation sent to ${inviteeEmail}`)
        setInviteeEmail('')
        setRole('volunteer')
      }
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      setInviteMessage(`❌ Error: ${error.message}`)
    } finally {
      setSending(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Main Question */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          How would you like to handle adoption requests?
        </h3>
        
        <div className="space-y-4">
          {/* Option 1: Redirect to existing form */}
          <div className="border rounded-lg p-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="adoptionOption"
                value="redirect"
                checked={settings.selectedOption === 'redirect'}
                onChange={() => setSettings(prev => ({ ...prev, selectedOption: 'redirect' }))}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  Redirect to the shelter's existing adoption form
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Send adopters directly to your current adoption form
                </div>
              </div>
            </label>
            
            {settings.selectedOption === 'redirect' && (
              <div className="mt-4 ml-7 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Adoption Form URL
                  </label>
                  <div className="mt-1 flex space-x-2">
                    <input
                      type="url"
                      value={settings.redirectUrl}
                      onChange={(e) => setSettings(prev => ({ ...prev, redirectUrl: e.target.value }))}
                      className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="https://your-shelter.com/adopt"
                    />
                    <button
                      type="button"
                      onClick={() => testUrl(settings.redirectUrl)}
                      disabled={!settings.redirectUrl}
                      className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Open website in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Option 2: Connect with calendar */}
          <div className="border rounded-lg p-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="adoptionOption"
                value="connect"
                checked={settings.selectedOption === 'connect'}
                onChange={() => setSettings(prev => ({ ...prev, selectedOption: 'connect' }))}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  Connect adopter info with shelter form, then allow adopter to schedule visits automatically
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Collect adopter information and enable automatic visit scheduling
                </div>
              </div>
            </label>
            
            {settings.selectedOption === 'connect' && (
              <div className="mt-4 ml-7 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Shelter Form URL
                  </label>
                  <div className="mt-1 flex space-x-2">
                    <input
                      type="url"
                      value={settings.connectUrl}
                      onChange={(e) => setSettings(prev => ({ ...prev, connectUrl: e.target.value }))}
                      className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="https://your-shelter.com/adopt"
                    />
                    <button
                      type="button"
                      onClick={() => testUrl(settings.connectUrl)}
                      disabled={!settings.connectUrl}
                      className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Open website in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Calendar Integration</span>
                    </div>
                    {settings.isCalendarConnected ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span className="text-sm">Connected</span>
                      </div>
                    ) : (
                      <button
                        onClick={connectCalendar}
                        disabled={isConnecting}
                        className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isConnecting ? 'Connecting...' : 'Connect Calendar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Option 3: Built-in scheduler */}
          <div className="border rounded-lg p-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="adoptionOption"
                value="builtin"
                checked={settings.selectedOption === 'builtin'}
                onChange={() => setSettings(prev => ({ ...prev, selectedOption: 'builtin' }))}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  Use Feline Finder's built-in scheduler only
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Use our integrated adoption and scheduling system
                </div>
              </div>
            </label>
            
            {settings.selectedOption === 'builtin' && (
              <div className="mt-4 ml-7">
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Calendar Integration</span>
                    </div>
                    {settings.isCalendarConnected ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span className="text-sm">Connected</span>
                      </div>
                    ) : (
                      <button
                        onClick={connectCalendar}
                        disabled={isConnecting}
                        className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isConnecting ? 'Connecting...' : 'Connect Calendar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving || !settings.selectedOption}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Choice'}
          </button>
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-md ${
            message.includes('✅') 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Volunteer Invite Form - Only show for options 2 and 3 after saving */}
      {settings.selectedOption && settings.selectedOption !== 'redirect' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center mb-6">
              <Users className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Invite Volunteers
              </h3>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label htmlFor="inviteeEmail" className="block text-sm font-medium text-gray-700">
                  Volunteer Email *
                </label>
                <div className="mt-1 relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    id="inviteeEmail"
                    value={inviteeEmail}
                    onChange={(e) => setInviteeEmail(e.target.value)}
                    className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="volunteer@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
                  Organization Name *
                </label>
                <input
                  type="text"
                  id="organizationName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Happy Paws Rescue"
                  required
                />
              </div>

              <div>
                <label htmlFor="OrgID" className="block text-sm font-medium text-gray-700">
                  RescueGroups Organization ID (Optional)
                </label>
                <input
                  type="text"
                  id="OrgID"
                  value={OrgID}
                  onChange={(e) => setOrgID(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="RG12345"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="volunteer">Volunteer</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {sending ? 'Sending Invitation...' : 'Send Invitation'}
              </button>
            </form>

            {inviteMessage && (
              <div className={`mt-4 p-3 rounded-md ${
                inviteMessage.includes('✅') 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {inviteMessage}
              </div>
            )}

            {/* Email Configuration Button - Only for admins */}
            {userOrganization?.role?.toLowerCase() === 'admin' && (
              <div className="mt-6 flex justify-center">
                <Link
                  to="/admin?tab=settings"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Email Settings
                </Link>
              </div>
            )}

            <div className="mt-6 bg-blue-50 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">How it works:</h4>
              <ol className="text-sm text-blue-700 space-y-1">
                <li>1. Enter the volunteer's email address</li>
                <li>2. Fill in your organization details</li>
                <li>3. Click "Send Invitation"</li>
                <li>4. The volunteer receives an email with a secure link</li>
                <li>5. When they click the link, they're automatically added to your organization</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdoptionRequestHandler
