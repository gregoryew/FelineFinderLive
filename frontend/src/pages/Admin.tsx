import React, { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Shield, Users, Building2, Trash2, Lock } from 'lucide-react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import AdminOrganizationManager from '../components/AdminOrganizationManager'
import { SecurityDashboard } from './SecurityDashboard'

const Admin: React.FC = () => {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('overview')
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('volunteer')
  const [showRoleSetup, setShowRoleSetup] = useState(false)

  // Handle URL parameter for tab selection
  useEffect(() => {
    const tab = searchParams.get('tab')
    const validTabs = ['overview']
    if (userRole === 'founder') validTabs.push('organizations')
    if (userRole === 'admin' || userRole === 'founder') {
      validTabs.push('security')
    }
    // Don't allow tab changes for unverified admins
    if (userRole === 'unverified_admin') {
      return
    }
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams, userRole])

  // Scroll to top when component mounts or tab changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTab])

  // Load user role from Firestore
  useEffect(() => {
    if (user?.uid) {
      // First check localStorage for role from OAuth callback
      const storedRole = localStorage.getItem('onboarding_user_role')
      if (storedRole) {
        setUserRole(storedRole)
        console.log(`Using stored role from OAuth: ${storedRole}`)
        return
      }
      
      // Fallback to Firestore check
      const userDoc = doc(db, 'shelter_people', user.uid)
      
      const checkUserRole = async (retryCount = 0) => {
        try {
          const docSnapshot = await getDoc(userDoc)
          
          if (docSnapshot.exists()) {
            // User has a document - use their existing role
            const userData = docSnapshot.data()
            const role = userData.role || 'volunteer'
            setUserRole(role)
            console.log(`Found existing user role: ${role}`)
          } else {
            // User has no document - treat them as unverified admin
            setUserRole('unverified_admin')
            console.log('No document found - treating as unverified admin')
            
            // If this is after OAuth (retryCount > 0), wait a bit and retry
            if (retryCount < 3) {
              console.log(`Retrying role detection in 2 seconds (attempt ${retryCount + 1}/3)`)
              setTimeout(() => {
                checkUserRole(retryCount + 1)
              }, 2000)
            }
          }
        } catch (error) {
          console.error('Error checking user role:', error)
          setUserRole('unverified_admin')
        }
      }
      
      checkUserRole()
    }
  }, [user?.uid])

  const handleSetRole = async (role: string) => {
    if (!user?.uid) return
    
    try {
      const userDoc = doc(db, 'shelter_people', user.uid)
      await setDoc(userDoc, { 
        role: role,
        email: user.email,
        displayName: user.displayName,
        createdAt: new Date()
      })
      setUserRole(role)
      setShowRoleSetup(false)
      console.log(`Set user role to ${role}`)
    } catch (error) {
      console.error('Error setting user role:', error)
    }
  }

  const runCleanup = async () => {
    if (!user) return
    
    setCleanupLoading(true)
    setCleanupResult(null)
    
    try {
      const functions = getFunctions()
      const cleanup = httpsCallable(functions, 'cleanupOldOperatingHours')
      const result = await cleanup()
      
      const data = result.data as { success: boolean; cleanedCount: number; message: string }
      setCleanupResult(data.message)
    } catch (error: any) {
      console.error('Cleanup error:', error)
      setCleanupResult(`Error: ${error.message}`)
    } finally {
      setCleanupLoading(false)
    }
  }


  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId })
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Show admin panel with role-based access
  const isAdmin = userRole === 'admin' || userRole === 'founder'
  const isFounder = userRole === 'founder'

  const adminTabs = [
    {
      id: 'overview',
      name: 'Overview',
      icon: Shield
    },
    // Only show Organizations tab to founders
    ...(isFounder ? [{
      id: 'organizations',
      name: 'Organizations',
      icon: Building2
    }] : []),
    // Only show Security Dashboard to admins and founders
    ...(isAdmin ? [{
      id: 'security',
      name: 'Security',
      icon: Lock
    }] : [])
  ]

  return (
    <div className="py-8 max-w-7xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization and system settings
        </p>
        
        {/* Role Setup Section */}
        {showRoleSetup && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-yellow-800 mb-4">Set Your Role</h3>
            <p className="text-sm text-yellow-700 mb-4">
              No role found in the system. Please select your role to continue:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSetRole('admin')}
                className="flex items-center justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </button>
              <button
                onClick={() => handleSetRole('volunteer')}
                className="flex items-center justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <Users className="h-4 w-4 mr-2" />
                Volunteer
              </button>
            </div>
          </div>
        )}
        
        {/* Unverified Admin Message */}
        {userRole === 'unverified_admin' && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-800 mb-4">Admin Verification Required</h3>
            <p className="text-sm text-blue-700 mb-4">
              You're being treated as an admin, but you need to verify your organization first. 
              Please go to the Home page and start the organization setup process.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to Home Page
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Current User:</span>
            <span className="text-sm text-gray-900">{user?.displayName || user?.email || 'Unknown'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Role:</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              userRole === 'founder' ? 'bg-purple-100 text-purple-800' :
              userRole === 'admin' ? 'bg-blue-100 text-blue-800' :
              userRole === 'unverified_admin' ? 'bg-orange-100 text-orange-800' :
              userRole === 'volunteer' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {userRole === 'unverified_admin' ? 'Unverified Admin' : userRole.charAt(0).toUpperCase() + userRole.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 inline mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Role-based access message */}
      {userRole === 'volunteer' && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Shield className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Volunteer Access
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  As a volunteer, you have limited access to the admin panel. 
                  Contact an administrator to request additional permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'organizations' && <AdminOrganizationManager />}
      
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        User Management
                      </dt>
                      <dd className="text-sm text-gray-900">
                        Manage users and their roles
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Organization Settings
                      </dt>
                      <dd className="text-sm text-gray-900">
                        Configure organization details
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Lock className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Security Monitoring
                      </dt>
                      <dd className="text-sm text-gray-900">
                        Monitor security events and threats
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Stats */}
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  System Overview
                </h3>
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Users className="h-6 w-6 text-gray-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Total Users
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">156</dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Shield className="h-6 w-6 text-gray-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Organizations
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">12</dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <Lock className="h-6 w-6 text-gray-400" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">
                              Security Events
                            </dt>
                            <dd className="text-lg font-medium text-gray-900">42</dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data Cleanup Section */}
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Data Cleanup
                </h3>
                <div className="mt-5">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Trash2 className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          Clean Up Old Operating Hours Data
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>
                            This will convert old operating hours format (object) to new format (array) for all users.
                            This is a one-time cleanup operation.
                          </p>
                        </div>
                        <div className="mt-4">
                          <button
                            onClick={runCleanup}
                            disabled={cleanupLoading}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {cleanupLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Cleaning up...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Run Cleanup
                              </>
                            )}
                          </button>
                        </div>
                        {cleanupResult && (
                          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm text-green-700">{cleanupResult}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Security Dashboard</h3>
              <div className="flex items-center space-x-2">
                <Lock className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-500">Admin Only</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Monitor security events, threats, and system health in real-time.
            </p>
            <SecurityDashboard />
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin