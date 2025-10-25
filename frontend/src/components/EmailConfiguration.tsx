import React, { useState, useEffect } from 'react'
import { useAuth } from '../services/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { 
  Mail, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Eye,
  EyeOff,
  Save
} from 'lucide-react'

interface EmailConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  fromEmail: string
  fromName: string
}

const EmailConfiguration: React.FC = () => {
  const { user } = useAuth()
  const functions = getFunctions()

  const [config, setConfig] = useState<EmailConfig>({
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    fromEmail: '',
    fromName: ''
  })
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [hasConfig, setHasConfig] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [userOrganization, setUserOrganization] = useState<any>(null)

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('Loading timeout reached, forcing loading to false')
        setLoading(false)
        setMessage('Loading timed out. Please refresh the page.')
      }
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [loading])

  useEffect(() => {
    if (user?.uid) {
      // Load user organization data
      const userUnsubscribe = onSnapshot(
        doc(db, 'users', user.uid),
        (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data()
            console.log('User organization data:', userData)
            setUserOrganization(userData)
          } else {
            console.log('User document does not exist')
            setUserOrganization(null)
            setLoading(false)
          }
        },
        (error) => {
          console.error('Error loading user organization:', error)
          setMessage('Error loading user data')
          setLoading(false)
        }
      )
      
      return userUnsubscribe
    } else {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    console.log('userOrganization changed:', userOrganization)
    if (userOrganization) {
      if (userOrganization.OrgID) {
        loadEmailConfig()
      } else {
        console.log('User has no OrgID, stopping loading')
        setLoading(false)
      }
    } else if (userOrganization === null) {
      // User document doesn't exist or user has no organization
      console.log('User organization is null, stopping loading')
      setLoading(false)
    }
  }, [userOrganization])

  const createDefaultOrganization = async () => {
    if (!user?.uid) return
    
    try {
      setLoading(true)
      // Create a default organization for the user
      await setDoc(doc(db, 'users', user.uid), {
        organizationId: user.uid, // Use user ID as organization ID for simplicity
        OrgID: user.uid, // Use user ID as OrgID for simplicity
        organizationName: 'Default Organization',
        role: 'admin',
        createdAt: serverTimestamp()
      }, { merge: true })
      
      // Reload the component
      window.location.reload()
    } catch (error) {
      console.error('Error creating default organization:', error)
      setMessage('Error creating organization')
    } finally {
      setLoading(false)
    }
  }

  const loadEmailConfig = async () => {
    console.log('Loading email config for organization:', userOrganization?.OrgID)
    
    // For now, let's use a simple approach - use user ID as organization ID
    const orgId = userOrganization?.OrgID || user?.uid || 'default'
    
    if (!orgId) {
      setMessage('No organization found. Please join an organization first.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('Calling getOrganizationEmailConfig function with orgId:', orgId)
      const getOrganizationEmailConfig = httpsCallable(functions, 'getOrganizationEmailConfig')
      const result = await getOrganizationEmailConfig({ organizationId: orgId })
      
      console.log('Email config result:', result.data)
      
      if ((result.data as any).success) {
        const data = result.data as any
        setHasConfig(data.hasConfig)
        
        if (data.hasConfig && data.config) {
          setConfig({
            smtpHost: data.config.smtpHost || '',
            smtpPort: data.config.smtpPort || 587,
            smtpUser: data.config.smtpUser || '',
            smtpPass: '', // Don't load password for security
            fromEmail: data.config.fromEmail || '',
            fromName: data.config.fromName || ''
          })
        }
      }
    } catch (error: any) {
      console.error('Error loading email config:', error)
      setMessage(`Error loading configuration: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const orgId = userOrganization?.OrgID || user?.uid || 'default'
    
    if (!orgId) {
      setMessage('No organization found.')
      return
    }

    if (!config.smtpHost || !config.smtpPort || !config.smtpUser || !config.smtpPass || !config.fromEmail) {
      setMessage('Please fill in all required fields.')
      return
    }

    setSaving(true)
    setMessage('')
    
    try {
      const updateOrganizationEmailConfig = httpsCallable(functions, 'updateOrganizationEmailConfig')
      const result = await updateOrganizationEmailConfig({
        organizationId: orgId,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        fromEmail: config.fromEmail,
        fromName: config.fromName
      })
      
      if ((result.data as any).success) {
        setMessage('✅ Email configuration saved successfully!')
        setHasConfig(true)
        setTestResult((result.data as any).testResult)
      }
    } catch (error: any) {
      console.error('Error saving email config:', error)
      setMessage(`❌ Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTestConfig = async () => {
    const orgId = userOrganization?.OrgID || user?.uid || 'default'
    
    if (!orgId) {
      setMessage('No organization found.')
      return
    }

    setTesting(true)
    setMessage('')
    
    try {
      const testOrganizationEmailConfig = httpsCallable(functions, 'testOrganizationEmailConfig')
      const result = await testOrganizationEmailConfig({
        organizationId: orgId,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        fromEmail: config.fromEmail,
        fromName: config.fromName,
        testEmail: user?.email
      })
      
      if ((result.data as any).success) {
        const testData = (result.data as any).testResult
        setTestResult(testData)
        
        if (testData.success) {
          setMessage('✅ Email test successful! Check your inbox.')
        } else {
          setMessage(`❌ Email test failed: ${testData.error}`)
        }
      }
    } catch (error: any) {
      console.error('Error testing email config:', error)
      setMessage(`❌ Test failed: ${error.message}`)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-feline-500" />
          <p className="ml-3 text-gray-700">Loading email configuration...</p>
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              console.log('Manual loading stop clicked')
              setLoading(false)
              setMessage('Loading stopped manually. You can still configure email settings.')
            }}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Stop Loading & Show Form
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center mb-6">
        <Mail className="h-6 w-6 text-feline-600 mr-3" />
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Email Configuration
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Configure your organization's email settings for sending invitations and notifications
          </p>
        </div>
      </div>

      {!user?.uid && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <XCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                You need to be part of an organization to configure email settings.
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                For testing purposes, you can create a default organization by clicking the button below.
              </p>
              <button
                onClick={createDefaultOrganization}
                className="mt-2 px-3 py-1 bg-yellow-600 text-white text-xs rounded-md hover:bg-yellow-700"
              >
                Create Default Organization
              </button>
            </div>
          </div>
        </div>
      )}

      {hasConfig && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm text-green-800">
                Email configuration is active and ready to use.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveConfig} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="smtpHost" className="block text-sm font-medium text-gray-700">
              SMTP Host *
            </label>
            <input
              type="text"
              name="smtpHost"
              id="smtpHost"
              required
              value={config.smtpHost}
              onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-feline-500 focus:border-feline-500 sm:text-sm"
              placeholder="smtp.gmail.com"
            />
            <p className="mt-1 text-xs text-gray-500">
              Examples: smtp.gmail.com, smtp.sendgrid.net, mail.yourdomain.com
            </p>
          </div>

          <div>
            <label htmlFor="smtpPort" className="block text-sm font-medium text-gray-700">
              SMTP Port *
            </label>
            <input
              type="number"
              name="smtpPort"
              id="smtpPort"
              required
              value={config.smtpPort}
              onChange={(e) => setConfig({ ...config, smtpPort: parseInt(e.target.value) })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-feline-500 focus:border-feline-500 sm:text-sm"
              placeholder="587"
            />
            <p className="mt-1 text-xs text-gray-500">
              Common ports: 587 (TLS), 465 (SSL), 25 (unsecured)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="smtpUser" className="block text-sm font-medium text-gray-700">
              SMTP Username *
            </label>
            <input
              type="text"
              name="smtpUser"
              id="smtpUser"
              required
              value={config.smtpUser}
              onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-feline-500 focus:border-feline-500 sm:text-sm"
              placeholder="your-email@gmail.com"
            />
          </div>

          <div>
            <label htmlFor="smtpPass" className="block text-sm font-medium text-gray-700">
              SMTP Password *
            </label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? "text" : "password"}
                name="smtpPass"
                id="smtpPass"
                required
                value={config.smtpPass}
                onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-10 focus:outline-none focus:ring-feline-500 focus:border-feline-500 sm:text-sm"
                placeholder="Your email password or app password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              For Gmail, use an App Password (not your regular password)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="fromEmail" className="block text-sm font-medium text-gray-700">
              From Email Address *
            </label>
            <input
              type="email"
              name="fromEmail"
              id="fromEmail"
              required
              value={config.fromEmail}
              onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-feline-500 focus:border-feline-500 sm:text-sm"
              placeholder="noreply@yourorganization.com"
            />
          </div>

          <div>
            <label htmlFor="fromName" className="block text-sm font-medium text-gray-700">
              From Name
            </label>
            <input
              type="text"
              name="fromName"
              id="fromName"
              value={config.fromName}
              onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-feline-500 focus:border-feline-500 sm:text-sm"
              placeholder="Your Organization Name"
            />
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={saving || !user?.uid}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-feline-600 hover:bg-feline-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>

          <button
            type="button"
            onClick={handleTestConfig}
            disabled={testing || !user?.uid || !config.smtpHost}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-feline-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <TestTube className="h-4 w-4 mr-2" />
            {testing ? 'Testing...' : 'Test Configuration'}
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-md ${
            message.startsWith('✅') 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`text-sm ${
              message.startsWith('✅') ? 'text-green-800' : 'text-red-800'
            }`}>
              {message}
            </p>
          </div>
        )}

        {testResult && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Test Result:</h4>
            <p className="text-sm text-blue-700">
              {testResult.success ? (
                <>
                  <CheckCircle className="inline h-4 w-4 mr-1" />
                  {testResult.message}
                </>
              ) : (
                <>
                  <XCircle className="inline h-4 w-4 mr-1" />
                  {testResult.error}
                </>
              )}
            </p>
          </div>
        )}
      </form>

      <div className="mt-8 bg-gray-50 p-4 rounded-md">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Popular Email Providers:</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Gmail:</strong> smtp.gmail.com:587 (requires App Password)</p>
          <p><strong>SendGrid:</strong> smtp.sendgrid.net:587 (use API key as password)</p>
          <p><strong>Outlook:</strong> smtp-mail.outlook.com:587</p>
          <p><strong>Yahoo:</strong> smtp.mail.yahoo.com:587 (requires App Password)</p>
        </div>
      </div>
    </div>
  )
}

export default EmailConfiguration
