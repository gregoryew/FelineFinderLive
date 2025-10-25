import React, { useState, useEffect } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../services/auth'
import { 
  Building2, 
  Users, 
  Search, 
  Send, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Eye,
  EyeOff,
  Shield
} from 'lucide-react'

interface Organization {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  state: string | null
  zipcode: string | null
  city: string | null
  OrgID: string
}

interface BulkResult {
  OrgID: string
  organizationName: string
  email: string
  success: boolean
  error?: string
  invitationToken?: string
  deepLink?: string
}

const AdminOrganizationManager: React.FC = () => {
  const functions = getFunctions()
  const { user } = useAuth()
  
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<BulkResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Pagination
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  
  // Email content
  const [emailSubject, setEmailSubject] = useState('Welcome to Feline Finder - {organizationName}')
  const [emailBody, setEmailBody] = useState(`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Welcome to Feline Finder!</h2>
      <p>Dear {organizationName} Team,</p>
      
      <p>We're excited to invite you to join the Feline Finder organization portal, where you can:</p>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">What you'll get access to:</h3>
        <ul>
          <li>📊 Real-time adoption statistics from your RescueGroups data</li>
          <li>📅 Calendar booking management and volunteer coordination</li>
          <li>👥 Staff and volunteer analytics</li>
          <li>📈 Organization performance insights</li>
          <li>🔗 Direct integration with your RescueGroups account (ID: {OrgID})</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{deepLink}" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; font-weight: bold; 
                  display: inline-block;">
          Accept Invitation & Join Portal
        </a>
      </div>
      
      <p>This invitation was sent by {inviterName} and will expire in 30 days.</p>
      
      <p>If you have any questions, please don't hesitate to reach out.</p>
      
      <p>Best regards,<br>The Feline Finder Team</p>
      
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px;">
        If you can't click the button above, copy and paste this link into your browser:<br>
        <a href="{deepLink}" style="color: #2563eb;">{deepLink}</a>
      </p>
    </div>
  `)
  
  const [inviterName, setInviterName] = useState('Feline Finder Admin')
  const [role, setRole] = useState('admin')

  useEffect(() => {
    // Load user role
    if (user?.uid) {
      const userDoc = doc(db, 'users', user.uid)
      const unsubscribe = onSnapshot(userDoc, (doc) => {
        if (doc.exists()) {
          const userData = doc.data()
          setUserRole(userData.role || null)
        }
      })
      return unsubscribe
    }
  }, [user?.uid])

  useEffect(() => {
    // Only load organizations if user is founder
    if (userRole?.toLowerCase() === 'founder') {
      loadOrganizations()
    }
  }, [userRole])

  const testRescueGroupsAPI = async () => {
    try {
      const testAPI = httpsCallable(functions, 'testRescueGroupsAPI')
      const result = await testAPI({})
      console.log('API test result:', result.data)
      alert(`API Test Result:\n${JSON.stringify(result.data, null, 2)}`)
    } catch (error: any) {
      console.error('Error testing API:', error)
      alert(`Error testing API: ${error.message}`)
    }
  }

  const setUserRoleSimple = async (role: string) => {
    try {
      const setRole = httpsCallable(functions, 'setUserRoleSimple')
      const result = await setRole({ role })
      console.log('Role set result:', result.data)
      alert(`Role set successfully: ${JSON.stringify(result.data, null, 2)}`)
      // Reload the page to refresh user data
      window.location.reload()
    } catch (error: any) {
      console.error('Error setting role:', error)
      alert(`Error setting role: ${error.message}`)
    }
  }

  const checkUserAccess = async () => {
    try {
      const checkAccess = httpsCallable(functions, 'checkUserAccess')
      const result = await checkAccess({})
      console.log('User access check:', result.data)
      alert(`Access Check:\n${JSON.stringify(result.data, null, 2)}`)
    } catch (error: any) {
      console.error('Error checking user access:', error)
      alert(`Error checking access: ${error.message}`)
    }
  }

  const loadOrganizations = async (newOffset = 0) => {
    try {
      console.log('loadOrganizations called with:', { newOffset, searchTerm })
      setLoading(true)
      const fetchOrganizations = httpsCallable(functions, 'fetchRescueGroupsOrganizations')
      console.log('About to call fetchOrganizations with:', { 
        limit: 50, 
        offset: newOffset,
        search: searchTerm
      })
      const result = await fetchOrganizations({ 
        limit: 50, 
        offset: newOffset,
        search: searchTerm
      })
      
      console.log('fetchOrganizations result:', result)
      
      if ((result.data as any).success) {
        const data = result.data as any
        if (newOffset === 0) {
          setOrganizations(data.organizations)
        } else {
          setOrganizations(prev => [...prev, ...data.organizations])
        }
        setHasMore(data.hasMore)
        setTotalCount(data.totalCount)
        setOffset(data.nextOffset)
      }
    } catch (error: any) {
      console.error('Error loading organizations:', error)
      alert(`Error loading organizations: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedOrgs.size === organizations.length) {
      setSelectedOrgs(new Set())
    } else {
      setSelectedOrgs(new Set(organizations.map(org => org.id)))
    }
  }

  const handleSelectOrg = (orgId: string) => {
    const newSelected = new Set(selectedOrgs)
    if (newSelected.has(orgId)) {
      newSelected.delete(orgId)
    } else {
      newSelected.add(orgId)
    }
    setSelectedOrgs(newSelected)
  }

  const handleSendBulkInvites = async () => {
    if (selectedOrgs.size === 0) {
      alert('Please select at least one organization')
      return
    }

    const selectedOrganizations = organizations.filter(org => selectedOrgs.has(org.id))
    
    try {
      setSending(true)
      setResults([])
      
      const sendBulkInvites = httpsCallable(functions, 'sendBulkOrganizationInvites')
      const result = await sendBulkInvites({
        organizations: selectedOrganizations,
        emailSubject,
        emailBody,
        inviterName,
        role
      })
      
      if ((result.data as any).success) {
        const data = result.data as any
        setResults(data.results)
        setShowResults(true)
        
        // Clear selections
        setSelectedOrgs(new Set())
        
        alert(`✅ ${data.summary.successful} invitations sent successfully, ${data.summary.failed} failed`)
      }
    } catch (error: any) {
      console.error('Error sending bulk invites:', error)
      alert(`Error sending invitations: ${error.message}`)
    } finally {
      setSending(false)
    }
  }

  const previewEmail = (org: Organization) => {
    const previewHtml = emailBody
      .replace(/\{organizationName\}/g, org.name)
      .replace(/\{OrgID\}/g, org.OrgID)
      .replace(/\{deepLink\}/g, 'https://feline-finder-org-portal.web.app/invite/preview-token')
      .replace(/\{inviterName\}/g, inviterName)
    
    const previewSubject = emailSubject.replace(/\{organizationName\}/g, org.name)
    
    return { html: previewHtml, subject: previewSubject }
  }

  // Check if user has founder role (case insensitive)
  const isFounder = userRole?.toLowerCase() === 'founder'

  // Show access denied if user is not a founder
  if (!isFounder) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have permission to access organization management. Only founders can manage organizations.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Your current role is: {userRole || 'Not set'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Building2 className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Organization Management</h1>
            <p className="text-gray-600">Send bulk invitations to RescueGroups organizations</p>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>Total Organizations:</strong> {totalCount} (max 200) | 
                  <strong> Loaded:</strong> {organizations.length} | 
                  <strong> Selected:</strong> {selectedOrgs.size}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={checkUserAccess}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Check Access
              </button>
              <button
                onClick={testRescueGroupsAPI}
                className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
              >
                Test API
              </button>
              <button
                onClick={() => setUserRoleSimple('founder')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Set Founder
              </button>
              <button
                onClick={() => setUserRoleSimple('admin')}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Set Admin
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Organizations List */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">RescueGroups Organizations</h3>
                <div className="flex space-x-2">
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search organizations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => {
                        try {
                          alert('Search button clicked!')
                          console.log('Search button clicked!')
                          console.log('About to call loadOrganizations')
                          console.log('loadOrganizations function:', typeof loadOrganizations)
                          if (typeof loadOrganizations === 'function') {
                            loadOrganizations(0)
                            console.log('loadOrganizations called successfully')
                          } else {
                            console.error('loadOrganizations is not a function!')
                            alert('loadOrganizations is not a function!')
                          }
                        } catch (error: any) {
                          console.error('Error in button click:', error)
                          alert('Error: ' + error.message)
                        }
                      }}
                      disabled={loading}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </button>
                  </div>
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
                  >
                    {selectedOrgs.size === organizations.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading organizations...</span>
                </div>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedOrgs.has(org.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleSelectOrg(org.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedOrgs.has(org.id)}
                            onChange={() => handleSelectOrg(org.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                          />
                          <div>
                            <h4 className="font-medium text-gray-900">{org.name}</h4>
                            <div className="text-sm text-gray-500 space-y-1">
                              <p>ID: {org.id}</p>
                              {org.email && <p>Email: {org.email}</p>}
                              {org.phone && <p>Phone: {org.phone}</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {org.email ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="text-xs text-gray-500">
                          {org.email ? 'Has Email' : 'No Email'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => loadOrganizations(offset)}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 disabled:opacity-50"
                  >
                    Load More Organizations
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Email Configuration */}
        <div className="space-y-6">
          {/* Email Settings */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Email Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Inviter Name</label>
                  <input
                    type="text"
                    value={inviterName}
                    onChange={(e) => setInviterName(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="founder">Founder</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="volunteer">Volunteer</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Email Template */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Email Template</h3>
                <button
                  onClick={() => setShowEmailPreview(!showEmailPreview)}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  {showEmailPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showEmailPreview ? 'Hide Preview' : 'Show Preview'}
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Welcome to Feline Finder - {organizationName}"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Body (HTML)</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={12}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
                    placeholder="HTML email template..."
                  />
                </div>
                
                <div className="bg-gray-50 rounded-md p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Available Variables:</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p><code>{'{organizationName}'}</code> - Organization name</p>
                    <p><code>{'{OrgID}'}</code> - Organization ID</p>
                    <p><code>{'{deepLink}'}</code> - Invitation link</p>
                    <p><code>{'{inviterName}'}</code> - Inviter name</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Send Button */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <button
                onClick={handleSendBulkInvites}
                disabled={sending || selectedOrgs.size === 0}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending Invitations...' : `Send ${selectedOrgs.size} Invitations`}
              </button>
              
              {selectedOrgs.size > 0 && (
                <p className="mt-2 text-sm text-gray-600 text-center">
                  {selectedOrgs.size} organization{selectedOrgs.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {showEmailPreview && organizations.length > 0 && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Email Preview</h3>
                <button
                  onClick={() => setShowEmailPreview(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                  <div className="text-sm text-gray-900 bg-white p-2 rounded border">
                    {previewEmail(organizations[0]).subject}
                  </div>
                </div>
                
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Preview:</label>
                <div 
                  className="border rounded p-4 bg-white max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: previewEmail(organizations[0]).html }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResults && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Bulk Invite Results</h3>
                <button
                  onClick={() => setShowResults(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-3 ${
                        result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{result.organizationName}</h4>
                          <p className="text-sm text-gray-600">{result.email}</p>
                        </div>
                        <div className="flex items-center">
                          {result.success ? (
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 mr-2" />
                          )}
                          <span className={`text-sm font-medium ${
                            result.success ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {result.success ? 'Sent' : 'Failed'}
                          </span>
                        </div>
                      </div>
                      {result.error && (
                        <p className="text-sm text-red-600 mt-1">{result.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminOrganizationManager
