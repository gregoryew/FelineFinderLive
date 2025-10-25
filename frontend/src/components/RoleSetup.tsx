import React, { useState } from 'react'
import { useAuth } from '../services/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Crown, Shield, Users, UserCheck } from 'lucide-react'

const RoleSetup: React.FC = () => {
  const { user } = useAuth()
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [setting, setSetting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const roles = [
    {
      id: 'founder',
      name: 'Founder',
      description: 'Full access including organization management',
      icon: Crown,
      color: 'text-purple-600'
    },
    {
      id: 'admin',
      name: 'Admin',
      description: 'Administrative access to most features',
      icon: Shield,
      color: 'text-blue-600'
    },
    {
      id: 'staff',
      name: 'Staff',
      description: 'Staff member with limited access',
      icon: Users,
      color: 'text-green-600'
    },
    {
      id: 'volunteer',
      name: 'Volunteer',
      description: 'Volunteer with basic access',
      icon: UserCheck,
      color: 'text-orange-600'
    }
  ]

  const handleSetRole = async () => {
    if (!selectedRole || !user) return

    setSetting(true)
    setMessage(null)

    try {
      const functions = getFunctions()
      
      // Try bootstrap first (for first admin/founder)
      let result
      try {
        const bootstrapFirstAdmin = httpsCallable(functions, 'bootstrapFirstAdmin')
        result = await bootstrapFirstAdmin({ role: selectedRole })
      } catch (bootstrapError: any) {
        // If bootstrap fails, try regular setUserRole (if user is already admin/founder)
        if (bootstrapError.code === 'functions/permission-denied') {
          const setUserRole = httpsCallable(functions, 'setUserRole')
          result = await setUserRole({ role: selectedRole })
        } else {
          throw bootstrapError
        }
      }
      
      if ((result.data as { success: boolean }).success) {
        setMessage(`Successfully set your role to ${selectedRole}! You can now access organization features.`)
        // Refresh the page to update the UI
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (error: any) {
      console.error('Error setting role:', error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setSetting(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Please sign in to set your role.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Set Your Role
        </h2>
        <p className="text-gray-600 mb-6">
          Choose your role to access the appropriate features. You can change this later if needed.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedRole === role.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedRole(role.id)}
            >
              <div className="flex items-center mb-2">
                <role.icon className={`h-5 w-5 mr-2 ${role.color}`} />
                <h3 className="font-medium text-gray-900">{role.name}</h3>
              </div>
              <p className="text-sm text-gray-600">{role.description}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handleSetRole}
            disabled={!selectedRole || setting}
            className={`px-4 py-2 rounded-md font-medium ${
              selectedRole && !setting
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {setting ? 'Setting Role...' : 'Set Role'}
          </button>

          {message && (
            <div className={`text-sm ${
              message.includes('Successfully') ? 'text-green-600' : 'text-red-600'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RoleSetup
