import React, { useState } from 'react'
import { useAuth } from '../services/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { UserPlus, Mail, Users } from 'lucide-react'

const OrganizationManagement: React.FC = () => {
  const { user } = useAuth()
  const functions = getFunctions()
  
  const [inviteeEmail, setInviteeEmail] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [OrgID, setOrgID] = useState('')
  const [role, setRole] = useState('staff')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inviteeEmail || !organizationName) {
      setMessage('Please fill in all required fields')
      return
    }

    try {
      setSending(true)
      setMessage('')
      
      const sendOrganizationInvite = httpsCallable(functions, 'sendOrganizationInvite')
      const result = await sendOrganizationInvite({
        inviteeEmail,
        organizationId: organizationName, // Use organization name as ID for now
        organizationName,
        OrgID: OrgID || null,
        role,
        inviterName: user?.displayName || 'Organization Admin'
      })
      
      if ((result.data as any).success) {
        setMessage(`✅ Invitation sent to ${inviteeEmail}`)
        setInviteeEmail('')
        setOrganizationName('')
        setOrgID('')
        setRole('staff')
      }
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      setMessage(`❌ Error: ${error.message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center mb-6">
          <Users className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Organization Management
          </h3>
        </div>

        <form onSubmit={handleSendInvite} className="space-y-4">
          <div>
            <label htmlFor="inviteeEmail" className="block text-sm font-medium text-gray-700">
              Invite User Email *
            </label>
            <div className="mt-1 relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="email"
                id="inviteeEmail"
                value={inviteeEmail}
                onChange={(e) => setInviteeEmail(e.target.value)}
                className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="user@example.com"
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
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="volunteer">Volunteer</option>
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

        {message && (
          <div className={`mt-4 p-3 rounded-md ${
            message.includes('✅') 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <div className="mt-6 bg-blue-50 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">How it works:</h4>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Enter the user's email address</li>
            <li>2. Fill in your organization details</li>
            <li>3. Click "Send Invitation"</li>
            <li>4. The user receives an email with a secure link</li>
            <li>5. When they click the link, they're automatically added to your organization</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default OrganizationManagement
