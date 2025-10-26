import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { google } from 'googleapis'
import * as cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import * as dotenv from 'dotenv'
import * as postmark from 'postmark'
import * as crypto from 'crypto'
import * as https from 'https'
import { 
  getSecurityConfig, 
  logSecurityEvent, 
  validateAndSanitizeInput, 
  detectSuspiciousActivity, 
  trackUserSession, 
  createSecurityMiddleware,
  isLocalDevelopment 
} from './securityConfig'

// Load environment variables from .env file
dotenv.config()

// Helper function to make HTTP requests using https module
function makeHttpRequest(url: string, options: { method?: string; headers?: any; body?: string }): Promise<{ status: number; text: () => Promise<string>; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }

    const req = https.request(requestOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve({
          status: res.statusCode || 200,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data))
        })
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
}

// Get security configuration
const securityConfig = getSecurityConfig()
const securityMiddleware = createSecurityMiddleware()

// Configure admin SDK to use emulators in local development BEFORE initializing
if (isLocalDevelopment) {
  // Use Auth emulator for local development
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
  console.log('🔧 Development Security Mode:')
  console.log('- Rate Limiting: Permissive')
  console.log('- MFA: Optional') 
  console.log('- IP Restrictions: Disabled')
  console.log('- Audit Logging: Enabled')
  console.log('- Input Validation: Generous limits')
}

// Initialize Firebase Admin
// For local development with production auth, use service account
// Download from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
// Save as: functions/serviceAccountKey.json
const path = require('path')
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json')
console.log('🔍 Attempting to load service account from:', serviceAccountPath)

try {
  const serviceAccount = require(serviceAccountPath)
  console.log('✅ Service account key loaded successfully')
  console.log('📧 Service account email:', serviceAccount.client_email)
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'catapp-44885'
  })
  console.log('✅ Firebase Admin initialized with service account for project: catapp-44885')
} catch (error) {
  console.error('❌ Failed to load service account key:', error)
  console.log('⚠️  Falling back to default Firebase Admin initialization')
  admin.initializeApp({
    projectId: 'catapp-44885'
  })
  console.log('⚠️  WARNING: Production auth tokens WILL NOT WORK with default initialization!')
}

// CORS handler with environment-based origin control
const corsHandler = cors({ 
  origin: isLocalDevelopment 
    ? true  // Allow all origins in development
    : ['https://feline-finder-org-portal.web.app', 'https://feline-finder-org-portal.firebaseapp.com']
})

// Configuration for local development
const getConfig = () => {
  if (isLocalDevelopment) {
    console.log('DEBUG: Using local development configuration')
    
    // Read from environment variables (loaded from .env file)
    const clientId = process.env.GCAL_CLIENT_ID
    const clientSecret = process.env.GCAL_CLIENT_SECRET
    const apiKey = process.env.RESCUEGROUPS_API_KEY
    
    if (!clientId || !clientSecret || !apiKey) {
      console.error('ERROR: Missing required environment variables in .env file')
      console.error('Please ensure functions/.env file exists with GCAL_CLIENT_ID, GCAL_CLIENT_SECRET, and RESCUEGROUPS_API_KEY')
    }
    
    return {
      gcal: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'http://127.0.0.1:5001/catapp-44885/us-central1/gcalOAuthCallback'
      },
      rescuegroups: {
        api_key: apiKey
      }
    }
  } else {
    return functions.config()
  }
}

// Get RescueGroups API key (requires authentication)
export const getRescueGroupsApiKey = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Handle authentication manually since we're using onRequest instead of onCall
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      await admin.auth().verifyIdToken(idToken)

          // Return the API key from Firebase config
          const config = getConfig()
          const apiKey = config.rescuegroups?.api_key || 'eqXAy6VJ'
      
      res.json({ apiKey })
    } catch (error) {
      console.error('Error getting RescueGroups API key:', error)
      res.status(500).json({ error: 'Failed to get API key' })
    }
  })
})

// Get RescueGroups API key for organization validation (no authentication required)
export const getRescueGroupsApiKeyPublic = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Return the API key from Firebase config (no auth required for org validation)
      const config = getConfig()
      const apiKey = config.rescuegroups?.api_key || 'eqXAy6VJ'
      
      res.json({ apiKey })
    } catch (error) {
      console.error('Error getting RescueGroups API key (public):', error)
      res.status(500).json({ error: 'Failed to get API key' })
    }
  })
})

// Search cats from RescueGroups API for a specific organization
export const searchCatsByOrgId = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Handle authentication manually since we're using onRequest instead of onCall
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      const userId = decodedToken.uid

      // Get search query from query parameters
      const searchQuery = req.query.search as string

      if (!searchQuery || searchQuery.length < 3) {
        res.json({ cats: [] })
        return
      }

      // Get organization ID from user data
      const userDoc = await admin.firestore().collection('users').doc(userId).get()
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      const userData = userDoc.data()
      const orgId = userData?.OrgID || userId // Use user ID as org ID if no OrgID exists

      if (!orgId) {
        res.status(400).json({ error: 'User has no organization ID' })
        return
      }

      // Get API key from config
      const config = getConfig()
      const apiKey = config.rescuegroups?.api_key || 'eqXAy6VJ'

      // Query RescueGroups API for cats in this organization with name search
      const url = 'https://api.rescuegroups.org/v5/public/animals/search/available'
      
      const requestData = {
        data: {
          filters: [
            {
              fieldName: 'animals.species',
              operation: 'equal',
              criteria: 'Cat'
            },
            {
              fieldName: 'animals.status',
              operation: 'equal',
              criteria: 'Available'
            },
            {
              fieldName: 'animals.orgID',
              operation: 'equal',
              criteria: orgId
            },
            {
              fieldName: 'animals.name',
              operation: 'contains',
              criteria: searchQuery
            }
          ]
        }
      }

      const fetch = require('node-fetch')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `apikey ${apiKey}`
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`RescueGroups API error: ${response.status}`)
      }

      const data = await response.json()
      
      // Extract cat names and IDs from the response
      const cats = (data as any).data?.map((animal: any) => ({
        id: animal.id,
        name: animal.attributes?.name || 'Unnamed Cat',
        breed: animal.attributes?.breedPrimary || 'Unknown Breed',
        age: animal.attributes?.ageGroup || 'Unknown Age',
        sex: animal.attributes?.sex || 'Unknown'
      })) || []

      res.json({ cats })
    } catch (error) {
      console.error('Error searching cats from RescueGroups:', error)
      res.status(500).json({ error: 'Failed to search cats' })
    }
  })
})

// Send organization invite
export const sendOrganizationInvite = functions.https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      await logSecurityEvent('unauthorized_invite_attempt', 'unknown', {
        reason: 'no_auth_context'
      })
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context?.auth?.uid
    const { inviteeEmail, organizationName, rescueGroupsOrgId, role, inviterName } = data as any

    // Validate and sanitize input
    const sanitizedData = validateAndSanitizeInput(data, securityConfig)
    const { inviteeEmail: cleanEmail, organizationName: cleanOrgName, rescueGroupsOrgId: cleanOrgId, role: cleanRole, inviterName: cleanInviterName } = sanitizedData

    if (!cleanEmail || !cleanOrgName) {
      await logSecurityEvent('invalid_invite_attempt', userId, {
        reason: 'missing_required_fields',
        providedFields: Object.keys(data)
      })
      throw new functions.https.HttpsError('invalid-argument', 'Email and organization name are required')
    }

    // Check for suspicious activity
    const isSuspicious = await detectSuspiciousActivity(userId, 'send_invite')
    if (isSuspicious) {
      await logSecurityEvent('suspicious_invite_blocked', userId, {
        reason: 'suspicious_activity_detected'
      })
      throw new functions.https.HttpsError('resource-exhausted', 'Too many requests. Please try again later.')
    }

    // Verify the inviter is an admin of the organization
    const userDoc = await admin.firestore().collection('users').doc(userId).get()
    if (!userDoc.exists) {
      await logSecurityEvent('invite_user_not_found', userId, {
        reason: 'user_document_missing'
      })
      throw new functions.https.HttpsError('unauthenticated', 'User not found')
    }

    const userData = userDoc.data()
    if (userData?.OrgID !== cleanOrgId || userData?.role !== 'admin') {
      await logSecurityEvent('unauthorized_invite_attempt', userId, {
        reason: 'insufficient_permissions',
        userRole: userData?.role,
        userOrgId: userData?.OrgID,
        requestedOrgId: cleanOrgId
      })
      throw new functions.https.HttpsError('permission-denied', 'Only organization admins can send invitations')
    }

    // Generate secure invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Store invitation in Firestore
    await admin.firestore().collection('invitations').doc(invitationToken).set({
      orgId: rescueGroupsOrgId,
      organizationName,
      invitedBy: context?.auth?.uid,
      inviterName: inviterName || userData.displayName,
      inviteeEmail,
      role: role || 'volunteer',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      used: false
    })

    // Generate invitation URL
    const frontendUrl = isLocalDevelopment
      ? 'http://localhost:3000'
      : 'https://feline-finder-org-portal.web.app'
    const invitationUrl = `${frontendUrl}/invite?token=${invitationToken}`

    // Send invitation email using Postmark
    const postmarkApiKey = process.env.POSTMARK_API_KEY
    if (!postmarkApiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Email service not configured')
    }

    const subject = `Invitation to join ${organizationName} - Feline Finder`
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">You're invited to join ${organizationName}</h2>
        <p>${inviterName || userData.displayName} has invited you to join ${organizationName} on Feline Finder.</p>
        <p>Click the button below to accept your invitation:</p>
        <a href="${invitationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          This invitation will expire in 7 days.
        </p>
      </div>
    `
    
    const textBody = `
You're invited to join ${organizationName}

${inviterName || userData.displayName} has invited you to join ${organizationName} on Feline Finder.

Accept your invitation: ${invitationUrl}

This invitation will expire in 7 days.
    `

    const postData = JSON.stringify({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@felinefinder.org',
      To: inviteeEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound'
    })

    const options = {
      hostname: 'api.postmarkapp.com',
      port: 443,
      path: '/email',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Postmark-Server-Token': postmarkApiKey
      }
    }

    await new Promise<void>((resolve, reject) => {
      const req = https.request(options, (res: any) => {
        let data = ''
        res.on('data', (chunk: any) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('Invitation email sent via Postmark to:', inviteeEmail)
            resolve()
          } else {
            reject(new Error(`Postmark API error: ${res.statusCode}`))
          }
        })
      })
      req.on('error', reject)
      req.write(postData)
      req.end()
    })

    // Log successful invitation
    await logSecurityEvent('invitation_sent', userId, {
      inviteeEmail: cleanEmail,
      organizationName: cleanOrgName,
      rescueGroupsOrgId: cleanOrgId,
      role: cleanRole,
      inviterName: cleanInviterName,
      invitationToken,
      expiresAt: expiresAt.toISOString()
    })

    console.log('Organization invite sent:', {
      inviteeEmail: cleanEmail,
      organizationName: cleanOrgName,
      rescueGroupsOrgId: cleanOrgId,
      role: cleanRole,
      inviterName: cleanInviterName,
      invitationToken
    })

    return { success: true, message: 'Invitation sent successfully' }
  } catch (error) {
    console.error('Error sending organization invite:', error)
    
    // Log invitation error
    await logSecurityEvent('invitation_error', context?.auth?.uid || 'unknown', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    throw new functions.https.HttpsError('internal', 'Failed to send invitation')
  }
})

// Validate invitation token
export const validateInvitationToken = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { token } = req.query

      if (!token) {
        res.status(400).json({ error: 'Invitation token required' })
        return
      }

      const invitationDoc = await admin.firestore().collection('invitations').doc(token as string).get()
      
      if (!invitationDoc.exists) {
        res.status(404).json({ error: 'Invalid invitation token' })
        return
      }

      const invitationData = invitationDoc.data()
      const now = new Date()
      const expiresAt = invitationData?.expiresAt?.toDate()

      if (expiresAt && now > expiresAt) {
        res.status(410).json({ error: 'Invitation has expired' })
        return
      }

      if (invitationData?.used) {
        res.status(410).json({ error: 'Invitation has already been used' })
        return
      }

      res.json({
        valid: true,
        organizationName: invitationData?.organizationName,
        role: invitationData?.role,
        inviterName: invitationData?.inviterName,
        orgId: invitationData?.orgId
      })

    } catch (error) {
      console.error('Error validating invitation token:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})

// Security monitoring function for admins
export const getSecurityMetrics = functions.https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    // Check if user is admin
    const userDoc = await admin.firestore().collection('users').doc(context?.auth?.uid).get()
    if (!userDoc.exists || !['admin', 'founder'].includes(userDoc.data()?.role)) {
      await logSecurityEvent('unauthorized_security_access', context?.auth?.uid || 'unknown', {
        reason: 'insufficient_permissions',
        userRole: userDoc.data()?.role
      })
      throw new functions.https.HttpsError('permission-denied', 'Admin access required')
    }

    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)

    // Get security metrics
    const [recentLogs, alerts, sessions] = await Promise.all([
      admin.firestore().collection('securityLogs')
        .where('timestamp', '>', last24Hours)
        .get(),
      admin.firestore().collection('securityAlerts')
        .where('timestamp', '>', last24Hours)
        .get(),
      admin.firestore().collection('userSessions')
        .where('lastActivity', '>', lastHour)
        .get()
    ])

    const metrics = {
      totalEvents: recentLogs.size,
      failedLogins: recentLogs.docs.filter(doc => doc.data().event === 'login_failed').length,
      suspiciousActivity: recentLogs.docs.filter(doc => doc.data().event === 'suspicious_activity').length,
      unauthorizedAccess: recentLogs.docs.filter(doc => doc.data().event === 'unauthorized_access').length,
      activeSessions: sessions.size,
      securityAlerts: alerts.size,
      highSeverityAlerts: alerts.docs.filter(doc => doc.data().severity === 'high').length,
      environment: isLocalDevelopment ? 'development' : 'production'
    }

    // Log security metrics access
    await logSecurityEvent('security_metrics_accessed', context?.auth?.uid || 'unknown', {
      metricsRequested: Object.keys(metrics)
    })

    return metrics
  } catch (error) {
    console.error('Error getting security metrics:', error)
    throw new functions.https.HttpsError('internal', 'Failed to get security metrics')
  }
})

// Diagnostic function to check user data
export const checkUserData = functions.https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userDoc = await admin.firestore().collection('users').doc(context?.auth?.uid).get()
    
    if (!userDoc.exists) {
      return {
        success: false,
        error: 'User document not found',
        userId: context?.auth?.uid
      }
    }

    const userData = userDoc.data()
    
    return {
      success: true,
      userId: context?.auth?.uid,
      userData: userData,
      hasOrgID: !!userData?.OrgID,
      orgID: userData?.OrgID || null,
      onboardingData: userData?.onboarding || null,
      onboardingUserName: userData?.onboarding?.userName || null,
      onboardingOperatingHours: userData?.onboarding?.operatingHours || null
    }
  } catch (error: any) {
    console.error('Check user data error:', error)
    return {
      success: false,
      error: error.message
    }
  }
})

// Save onboarding step data
export const saveOnboardingStep = functions.https.onCall(async (data, context) => {
  try {
    const { step, stepData, setupToken } = data

    // Get orgId and userId - handle both authenticated and setup token scenarios
    let orgId: string | undefined
    let userId: string | undefined

    if (context.auth) {
      // User is authenticated (after calendar connection)
      userId = context.auth.uid
      console.log('Saving onboarding step (authenticated):', { step, stepData, userId, hasSetupToken: !!setupToken })

      // First try to get orgId from shelter_people document
      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      const userData = userDoc.data()
      orgId = userData?.orgId
    }

    // If no auth or no orgId found, try to decode from the setup token
    if (!orgId && setupToken) {
      try {
        const jwt = require('jsonwebtoken')
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
        const decoded = jwt.verify(setupToken, jwtSecret) as any
        orgId = decoded.orgId
        userId = decoded.userId || `pending_${orgId}`
        console.log('Saving onboarding step (setupToken):', { step, stepData, orgId, userId, hasAuth: !!context.auth })
      } catch (error) {
        console.error('Failed to decode setup token:', error)
        throw new functions.https.HttpsError('unauthenticated', 'Invalid setup token')
      }
    }

    // Verify we have what we need
    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'Unable to determine organization ID')
    }

    // Determine which collection to save to based on step
    if (step === 'step1') {
      // Step 1 is authentication - just update timestamp for tracking
      console.log('DEBUG: Saving step1 - authentication step, updating timestamp for orgId:', orgId)
      await admin.firestore().collection('organizations').doc(orgId).set({
        onboardingUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true })
      console.log('DEBUG: Successfully saved step1 authentication timestamp')
    } else if (step === 'step2') {
      // Step 2 is organization type - save to organization collection
      console.log('DEBUG: Saving step2 - organizationType:', stepData.organizationType, 'to orgId:', orgId)
      await admin.firestore().collection('organizations').doc(orgId).set({
        organizationType: stepData.organizationType,
        onboardingUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true })
      console.log('DEBUG: Successfully saved organizationType to organizations collection')
    } else if (step === 'step3') {
      // Step 3 is calendar integration - already saved during OAuth, just update timestamp
      console.log('DEBUG: Saving step3 - calendar integration, updating timestamp')
      await admin.firestore().collection('organizations').doc(orgId).set({
        onboardingUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true })
    } else if (step === 'step4') {
      // Step 4 is team members - save to organization collection
      console.log('DEBUG: Saving step4 - team members:', stepData.users)
      
      // Filter out undefined values
      const updateData: any = {
        onboardingUpdatedAt: FieldValue.serverTimestamp()
      }
      
      if (stepData.users !== undefined) {
        updateData.users = stepData.users
      }
      
      await admin.firestore().collection('organizations').doc(orgId).set(updateData, { merge: true })
    } else if (step === 'step5') {
      // Step 5 is meeting preferences - save to organization collection
      console.log('DEBUG: Saving step5 - meeting preferences:', stepData.meetingPreferences)
      
      // Filter out undefined values
      const updateData: any = {
        onboardingUpdatedAt: FieldValue.serverTimestamp()
      }
      
      if (stepData.meetingPreferences !== undefined) {
        updateData.meetingPreferences = stepData.meetingPreferences
      }
      
      await admin.firestore().collection('organizations').doc(orgId).set(updateData, { merge: true })
    } else if (step === 'step6') {
      // Step 6 is finish - mark onboarding as completed
      console.log('DEBUG: Saving step6 - completing onboarding for userId:', userId)
      
      if (!userId) {
        throw new functions.https.HttpsError('failed-precondition', 'User ID required for completing onboarding')
      }
      
      // Mark user as having completed onboarding
      await admin.firestore().collection('shelter_people').doc(userId).set({
        onboardingCompleted: true,
        onboardingCompletedAt: FieldValue.serverTimestamp()
      }, { merge: true })
      
      // Update organization to mark setup as complete
      await admin.firestore().collection('organizations').doc(orgId).set({
        pendingSetup: false,
        setupCompletedAt: FieldValue.serverTimestamp(),
        onboardingUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true })
      
      console.log('DEBUG: Successfully completed onboarding')
    }

    console.log('Successfully saved onboarding step:', step)
    return { success: true }
  } catch (error) {
    console.error('Save onboarding step error:', error)
    throw new functions.https.HttpsError('internal', 'Failed to save onboarding step')
  }
})

// Complete onboarding
export const completeOnboarding = functions.https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context?.auth?.uid
    const { organizationData } = data as any

    console.log('Completing onboarding for user:', userId)

    // Get user document to find orgId
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId

    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User does not have an associated organization')
    }

    console.log('Updating organization:', orgId)

    // Update organization to mark setup as complete
    await admin.firestore().collection('organizations').doc(orgId).set({
      pendingSetup: false,
      setupCompletedAt: FieldValue.serverTimestamp(),
      onboardingUpdatedAt: FieldValue.serverTimestamp()
    }, { merge: true })

    // Mark user as having completed onboarding
    await admin.firestore().collection('shelter_people').doc(userId).set({
      onboardingCompleted: true,
      onboardingCompletedAt: FieldValue.serverTimestamp()
    }, { merge: true })

    console.log('Onboarding completed successfully for user:', userId, 'orgId:', orgId)

    return { success: true }
  } catch (error) {
    console.error('Complete onboarding error:', error)
    throw new functions.https.HttpsError('internal', 'Failed to complete onboarding')
  }
})

// Get onboarding progress
export const getOnboardingProgress = functions.https.onCall(async (data, context) => {
  try {
    const { setupToken, orgId: dataOrgId } = data || {}
    
    // Get orgId and userId - handle both authenticated and setup token scenarios
    let orgId: string | undefined
    let userId: string | undefined
    let userData: any = null
    
    if (context.auth) {
      // User is authenticated (after calendar connection)
      userId = context.auth.uid
      console.log('GetOnboardingProgress (authenticated):', { userId, hasSetupToken: !!setupToken, dataOrgId })
      
      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      if (userDoc.exists) {
        userData = userDoc.data()
        orgId = userData?.orgId
        console.log('DEBUG: Found user document:', { userId, orgId, userRole: userData?.role })
      } else {
        console.log('DEBUG: No user document found for userId:', userId)
      }
    }
    
    // If no orgId from user document, use the one from data
    if (!orgId && dataOrgId) {
      orgId = dataOrgId
      console.log('DEBUG: Using orgId from data parameter:', orgId)
    }
    
    // If no auth or no orgId found, try to decode from the setup token
    if (!orgId && setupToken) {
      try {
        const jwt = require('jsonwebtoken')
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
        const decoded = jwt.verify(setupToken, jwtSecret) as any
        orgId = decoded.orgId
        userId = decoded.userId || `pending_${orgId}`
        console.log('GetOnboardingProgress (setupToken):', { orgId, userId, hasAuth: !!context.auth })
      } catch (error) {
        console.error('GetOnboardingProgress: Failed to decode setup token:', error)
        throw new functions.https.HttpsError('unauthenticated', 'Invalid setup token')
      }
    }
    
    // If still no orgId, return empty state
    if (!orgId) {
      return { onboarding: null, completed: false }
    }
    
    // Get organization data
    const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
    const orgData = orgDoc.exists ? orgDoc.data() : null
    
    // Combine user and organization data
    let onboarding = userData?.onboarding || {}
    
    console.log('DEBUG: User data onboarding:', userData?.onboarding)
    console.log('DEBUG: User data onboarding.userName:', userData?.onboarding?.userName)
    console.log('DEBUG: User data onboarding.operatingHours:', userData?.onboarding?.operatingHours)
    console.log('DEBUG: Organization data:', orgData)
    
    // Add organization data to onboarding
    if (orgData) {
      if (orgData.organizationType) {
        onboarding.organizationType = orgData.organizationType
        console.log('DEBUG: Set organizationType to:', onboarding.organizationType)
      }
      if (orgData.users) {
        onboarding.users = orgData.users
      }
      if (orgData.meetingPreferences) {
        onboarding.meetingPreferences = orgData.meetingPreferences
      }
      // Add calendar connection data from organization document
      if (orgData.calendarConnected) {
        onboarding.calendarConnected = orgData.calendarConnected
      }
      if (orgData.calendarConnectedAt) {
        onboarding.calendarConnectedAt = orgData.calendarConnectedAt
      }
      if (orgData.selectedCalendarId) {
        onboarding.selectedCalendarId = orgData.selectedCalendarId
      }
      // Add invited users for status tracking
      if (orgData.invitedUsers) {
        onboarding.invitedUsers = orgData.invitedUsers
      }
      console.log('DEBUG: onboarding after adding org data:', onboarding)
    }
    
    // No backward compatibility needed since system is not in production yet
    
    // Include user name from onboarding data
    if (userData?.onboarding?.userName) {
      onboarding.userName = userData.onboarding.userName
      console.log('DEBUG: Setting userName from userData.onboarding.userName:', userData.onboarding.userName)
    }
    
    console.log('DEBUG: Final onboarding data being returned:', onboarding)
    console.log('DEBUG: Final onboarding.organizationType:', onboarding.organizationType)
    console.log('DEBUG: Final onboarding.userName:', onboarding.userName)
    console.log('DEBUG: Final onboarding.operatingHours:', onboarding.operatingHours)
    console.log('DEBUG: Final onboarding.calendarConnected:', onboarding.calendarConnected)
    
    const response = {
      onboarding: onboarding,
      completed: userData?.onboardingCompleted || false,
      userRole: userData?.role || 'admin',
      pendingSetup: orgData?.pendingSetup || false
    }
    
    console.log('DEBUG: getOnboardingProgress returning:', {
      userRole: response.userRole,
      completed: response.completed,
      pendingSetup: response.pendingSetup,
      hasOnboardingData: !!response.onboarding
    })
    
    return response
  } catch (error) {
    console.error('Get onboarding progress error:', error)
    throw new functions.https.HttpsError('internal', 'Failed to get onboarding progress')
  }
})

// Calendar Integration Functions

// Check if user's calendar is connected
export const checkCalendarConnection = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Handle authentication for both local and production
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      const userId = decodedToken.uid

      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      
      if (!userDoc.exists) {
        res.json({ connected: false })
        return
      }

      const userData = userDoc.data()
      const orgId = userData?.orgId || userId // Use user ID as org ID if no orgId exists
      
      // Get organization document to check calendar connection
      const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
      
      if (!orgDoc.exists) {
        res.json({ connected: false })
        return
      }

      const orgData = orgDoc.data()
      // Check if calendar is connected (either by having tokens or by the calendarConnected flag)
      const hasCalendarTokens = !!(orgData?.calendarAccessToken || orgData?.calendarRefreshToken)
      const isConnected = orgData?.calendarConnected === true || hasCalendarTokens
      
      res.json({ connected: isConnected })
    } catch (error) {
      console.error('Check calendar connection error:', error)
      res.status(500).json({ error: 'Failed to check calendar connection' })
    }
  })
})

// Generate OAuth URL for calendar connection
export const generateCalendarOAuthUrl = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Handle authentication - accept either Firebase ID token or Setup token
      const authHeader = req.headers.authorization
      if (!authHeader) {
        res.status(401).json({ error: 'Unauthorized - No auth header' })
        return
      }

      let userId: string
      let orgId: string | undefined
      
      if (authHeader.startsWith('Bearer ')) {
        // Authenticated user with Firebase ID token
        const idToken = authHeader.split('Bearer ')[1]
        const decodedToken = await admin.auth().verifyIdToken(idToken)
        userId = decodedToken.uid
        console.log('Using authenticated user:', userId)
      } else if (authHeader.startsWith('SetupToken ')) {
        // User with setup token from JWT verification (not yet authenticated)
        const setupToken = authHeader.split('SetupToken ')[1]
        const jwt = require('jsonwebtoken')
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
        
        try {
          const decoded = jwt.verify(setupToken, jwtSecret)
          if (decoded.type !== 'onboarding_session') {
            res.status(400).json({ error: 'Invalid setup token type' })
            return
          }
          // Use orgId as temporary identifier since user isn't created yet
          orgId = decoded.orgId
          userId = `pending_${orgId}` // Temporary user ID
          console.log('Using setup token for org:', orgId)
        } catch (jwtError) {
          console.error('Setup token verification failed:', jwtError)
          res.status(401).json({ error: 'Invalid or expired setup token' })
          return
        }
      } else {
        res.status(401).json({ error: 'Unauthorized - Invalid auth header format' })
        return
      }

      console.log('DEBUG: Using local development configuration')
      
      // Use local emulator URL for development, cloud URL for production
      const config = getConfig()
      const redirectUri = isLocalDevelopment 
        ? 'http://127.0.0.1:5001/catapp-44885/us-central1/gcalOAuthCallback'
        : config.gcal.redirect_uri

      const oauth2Client = new google.auth.OAuth2(
        config.gcal.client_id,
        config.gcal.client_secret,
        redirectUri
      )

      // Store orgId in state if available (for setup token flow)
      const stateData = orgId ? JSON.stringify({ userId, orgId, setupFlow: true }) : userId

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // Force Google to return a refresh token every time
        scope: [
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ],
        state: stateData
      })

      console.log('DEBUG: Generated OAuth URL successfully')
      res.json({ authUrl })
    } catch (error) {
      console.error('Generate OAuth URL error:', error)
      res.status(500).json({ error: 'Failed to generate OAuth URL' })
    }
  })
})

// Handle OAuth callback
export const gcalOAuthCallback = functions.https.onRequest(async (req, res) => {
  console.log('=== gcalOAuthCallback function called - VERSION 3.0 ===')
  console.log('Request URL:', req.url)
  console.log('Request query params:', req.query)
  console.log('Request method:', req.method)
  
  // Set CORS headers manually to ensure they're always present
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).send('')
    return
  }
  
  try {
      const { code, state } = req.query
      console.log('Code present:', !!code, 'State:', state)
      
      if (!code || !state) {
        res.status(400).send('Missing code or state parameter')
        return
      }

      console.log('OAuth callback received:', { code: code ? 'present' : 'missing', state })

      // Use local emulator URL for development, cloud URL for production
      const config = getConfig()
      const redirectUri = isLocalDevelopment 
        ? 'http://127.0.0.1:5001/catapp-44885/us-central1/gcalOAuthCallback'
        : config.gcal.redirect_uri

      const oauth2Client = new google.auth.OAuth2(
        config.gcal.client_id,
        config.gcal.client_secret,
        redirectUri
      )

      const { tokens } = await oauth2Client.getToken(code as string)
      console.log('OAuth tokens received:', { access_token: tokens.access_token ? 'present' : 'missing', refresh_token: tokens.refresh_token ? 'present' : 'missing' })
      
      // Parse state to check if this is a setup flow
      let orgId: string
      let isSetupFlow = false
      let userEmail: string | undefined
      let userName: string | undefined
      
      try {
        const stateData = JSON.parse(state as string)
        if (stateData.setupFlow && stateData.orgId) {
          // This is a first-time setup flow
          isSetupFlow = true
          orgId = stateData.orgId
          console.log('Setup flow detected for org:', orgId)
        } else {
          // Regular authenticated user flow
          const userDoc = await admin.firestore().collection('shelter_people').doc(stateData.userId || state as string).get()
          const userData = userDoc.exists ? userDoc.data() : null
          orgId = userData?.orgId || stateData.userId || state as string
        }
      } catch {
        // State is not JSON, treat as simple user ID (legacy flow)
        const userDoc = await admin.firestore().collection('shelter_people').doc(state as string).get()
        const userData = userDoc.exists ? userDoc.data() : null
        orgId = userData?.orgId || state as string
      }
      
      // If this is a setup flow, get user info from Google
      if (isSetupFlow && tokens.access_token) {
        try {
          oauth2Client.setCredentials(tokens)
          const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
          const userInfo = await oauth2.userinfo.get()
          userEmail = userInfo.data.email || undefined
          userName = userInfo.data.name || undefined
          console.log('Got user info from Google:', { email: userEmail, name: userName })
        } catch (error) {
          console.error('Failed to get user info from Google:', error)
        }
      }
      
      // Prepare calendar data for organization collection
      const orgCalendarData: any = {
        calendarConnected: true,
        calendarConnectedAt: new Date().toISOString()
      }
      
      // Only add access token if it exists
      if (tokens.access_token) {
        orgCalendarData.calendarAccessToken = tokens.access_token
      }
      
      // Only add refresh token if it exists
      if (tokens.refresh_token) {
        orgCalendarData.calendarRefreshToken = tokens.refresh_token
      }
      
      // Save calendar data to organization collection
      await admin.firestore().collection('organizations').doc(orgId).set(orgCalendarData, { merge: true })
      console.log('OAuth successful - saved calendar data to organization collection:', { orgId, calendarData: orgCalendarData })

      // If this is a setup flow, create the user account with Firebase Auth and Firestore
      if (isSetupFlow && userEmail) {
        try {
          // Create or get Firebase Auth user
          let firebaseUser
          try {
            firebaseUser = await admin.auth().getUserByEmail(userEmail)
            console.log('Firebase user already exists:', firebaseUser.uid)
          } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
              // Create new Firebase Auth user
              firebaseUser = await admin.auth().createUser({
                email: userEmail,
                displayName: userName,
                emailVerified: true // Since they authenticated with Google, we know the email is verified
              })
              console.log('Created new Firebase user:', firebaseUser.uid)
            } else {
              throw error
            }
          }
          
          // Check if this is the first user in the organization
          const existingUsers = await admin.firestore()
            .collection('shelter_people')
            .where('orgId', '==', orgId)
            .where('verified', '==', true)
            .get()
          
          const isFirstUser = existingUsers.empty
          const role = isFirstUser ? 'admin' : 'user'
          
          // Create user document in shelter_people collection
          await admin.firestore().collection('shelter_people').doc(firebaseUser.uid).set({
            email: userEmail,
            name: userName || userEmail.split('@')[0],
            orgId: orgId,
            verified: true,
            role: role,
            createdAt: FieldValue.serverTimestamp(),
            calendarConnected: true
          })
          
          console.log('Created shelter_people document:', { userId: firebaseUser.uid, email: userEmail, role, orgId })
          
          // Generate a custom token for the user to sign in on the frontend
          const customToken = await admin.auth().createCustomToken(firebaseUser.uid)
          console.log('Generated custom token for user to sign in')
          
          // Clear the setup token from localStorage by redirecting with a flag and custom token
          const frontendUrl = isLocalDevelopment 
            ? 'http://localhost:3000'
            : 'https://feline-finder-org-portal.web.app'
          res.redirect(`${frontendUrl}/onboarding?setup_complete=true&clearToken=true&customToken=${encodeURIComponent(customToken)}`)
        } catch (error) {
          console.error('Failed to create user account:', error)
          // Still redirect to onboarding even if user creation fails
          const frontendUrl = isLocalDevelopment 
            ? 'http://localhost:3000'
            : 'https://feline-finder-org-portal.web.app'
          res.redirect(`${frontendUrl}/onboarding?error=user_creation_failed`)
        }
      } else {
        // Regular flow - just redirect to onboarding
        const frontendUrl = isLocalDevelopment 
          ? 'http://localhost:3000'
          : 'https://feline-finder-org-portal.web.app'
        res.redirect(`${frontendUrl}/onboarding`)
      }
    } catch (error: any) {
      console.error('OAuth callback error:', error)
      
      // For any OAuth error, redirect to onboarding page instead of showing 500
      console.log('OAuth error occurred - redirecting to onboarding')
      const frontendUrl = isLocalDevelopment 
        ? 'http://localhost:3000'
        : 'https://feline-finder-org-portal.web.app'
      res.redirect(`${frontendUrl}/onboarding?error=oauth_failed`)
    }
})

// Disconnect calendar
export const disconnectCalendar = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Handle authentication manually
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      const userId = decodedToken.uid
      
      // Get user document to find organization ID
      const userDoc = await admin.firestore().collection('users').doc(userId).get()
      
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      const userData = userDoc.data()
      const orgId = userData?.OrgID || userId // Use user ID as org ID if no OrgID exists
      
      // Remove calendar tokens from organization document
      await admin.firestore().collection('organizations').doc(orgId).update({
        calendarAccessToken: FieldValue.delete(),
        calendarRefreshToken: FieldValue.delete(),
        calendarConnected: false,
        calendarDisconnectedAt: FieldValue.serverTimestamp()
      })

      res.json({ success: true })
    } catch (error) {
      console.error('Disconnect calendar error:', error)
      res.status(500).json({ error: 'Failed to disconnect calendar' })
    }
  })
})

// Test calendar connection
export const testCalendarConnection = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Handle authentication manually
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      const userId = decodedToken.uid

      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found in shelter_people collection' })
        return
      }

      const userData = userDoc.data()
      const orgId = userData?.orgId
      
      if (!orgId) {
        res.status(404).json({ error: 'User does not have an associated organization' })
        return
      }
      
      // Get organization document to get calendar tokens
      const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
      
      if (!orgDoc.exists) {
        res.status(404).json({ error: 'Organization not found' })
        return
      }

      const orgData = orgDoc.data()
      
      if (!orgData?.calendarAccessToken || !orgData?.calendarRefreshToken) {
        res.status(412).json({ error: 'Calendar not connected' })
        return
      }

      // Get the selected calendar ID (default to 'primary' if not set)
      const selectedCalendarId = orgData?.selectedCalendarId || 'primary'
      console.log(`Testing calendar connection for calendar: ${selectedCalendarId}`)

      // Set up OAuth2 client
      const config = getConfig()
      const redirectUri = isLocalDevelopment 
        ? 'http://127.0.0.1:5001/catapp-44885/us-central1/gcalOAuthCallback'
        : config.gcal.redirect_uri

      const oauth2Client = new google.auth.OAuth2(
        config.gcal.client_id,
        config.gcal.client_secret,
        redirectUri
      )

      oauth2Client.setCredentials({
        access_token: orgData.calendarAccessToken,
        refresh_token: orgData.calendarRefreshToken
      })

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

      // Create a test event
      const testEvent = {
        summary: 'Feline Finder - Calendar Test',
        description: 'This is a test event to verify calendar integration',
        start: {
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(), // 1 hour later
          timeZone: 'America/New_York'
        }
      }

      const response = await calendar.events.insert({
        calendarId: selectedCalendarId,
        requestBody: testEvent
      })

      console.log(`Test event created successfully on calendar ${selectedCalendarId}:`, response.data.htmlLink)

      res.json({
        success: true,
        message: `Calendar test successful! Event created in your selected calendar.`,
        eventLink: response.data.htmlLink,
        calendarId: selectedCalendarId
      })
    } catch (error) {
      console.error('Test calendar connection error:', error)
      res.status(500).json({ error: 'Failed to test calendar connection' })
    }
  })
})

// List user's Google Calendars
export const listCalendars = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔍 ListCalendars called - checking authentication...')
    
    // Check authentication
    let userId: string
    let orgId: string

    if (context.auth) {
      // User is authenticated
      userId = context.auth.uid
      console.log(`✅ User authenticated: ${userId}`)
      
      // Get user document to find orgId
      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      if (!userDoc.exists) {
        console.log(`❌ User document not found in shelter_people: ${userId}`)
        throw new functions.https.HttpsError('not-found', 'User not found in shelter_people collection')
      }
      
      const userData = userDoc.data()
      orgId = userData?.orgId
      console.log(`📋 User data - orgId: ${orgId}`)
      
      if (!orgId) {
        console.log('❌ User does not have an associated orgId')
        throw new functions.https.HttpsError('failed-precondition', 'User does not have an associated organization')
      }
    } else {
      console.log('❌ User not authenticated')
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }
    
    // Get organization document to get calendar tokens
    console.log(`🔍 Looking up organization: ${orgId}`)
    const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
    
    if (!orgDoc.exists) {
      console.log(`❌ Organization not found: ${orgId}`)
      throw new functions.https.HttpsError('not-found', 'Organization not found')
    }

    const orgData = orgDoc.data()
    console.log(`📋 Organization data - has accessToken: ${!!orgData?.calendarAccessToken}, has refreshToken: ${!!orgData?.calendarRefreshToken}`)
    
    if (!orgData?.calendarAccessToken) {
      console.log('❌ Calendar access token not found')
      throw new functions.https.HttpsError('failed-precondition', 'Calendar not connected')
    }

    // Set up OAuth2 client
    const config = getConfig()
    const redirectUri = isLocalDevelopment 
      ? 'http://127.0.0.1:5001/catapp-44885/us-central1/gcalOAuthCallback'
      : config.gcal.redirect_uri

    console.log('🔧 Setting up OAuth2 client...')
    const oauth2Client = new google.auth.OAuth2(
      config.gcal.client_id,
      config.gcal.client_secret,
      redirectUri
    )

    // Set credentials - refresh_token is optional (only needed for token refresh)
    const credentials: any = {
      access_token: orgData.calendarAccessToken
    }
    if (orgData.calendarRefreshToken) {
      credentials.refresh_token = orgData.calendarRefreshToken
    }
    oauth2Client.setCredentials(credentials)

    console.log('📅 Calling Google Calendar API to list calendars...')
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // List calendars
    const response = await calendar.calendarList.list()

    console.log(`✅ Successfully retrieved ${response.data.items?.length || 0} calendars for organization ${orgId}`)
    if (response.data.items && response.data.items.length > 0) {
      console.log('📋 Calendars:', response.data.items.map(cal => `${cal.summary} (${cal.id})`).join(', '))
    }

    return {
      success: true,
      calendars: response.data.items?.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary || false
      })) || []
    }
  } catch (error) {
    console.error('❌ List calendars error:', error)
    throw error
  }
})

// Save selected calendar ID
export const saveSelectedCalendar = functions.https.onCall(async (data, context) => {
  try {
    const { calendarId } = data
    
    if (!calendarId) {
      throw new functions.https.HttpsError('invalid-argument', 'Calendar ID is required')
    }

    // Check authentication
    let userId: string
    let orgId: string

    if (context.auth) {
      // User is authenticated
      userId = context.auth.uid
      
      // Get user document to find orgId
      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found')
      }
      
      const userData = userDoc.data()
      orgId = userData?.orgId
      
      if (!orgId) {
        throw new functions.https.HttpsError('failed-precondition', 'User does not have an associated organization')
      }
    } else {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    // Save calendar ID to organization
    await admin.firestore().collection('organizations').doc(orgId).update({
      selectedCalendarId: calendarId,
      updatedAt: FieldValue.serverTimestamp()
    })

    console.log(`Successfully saved calendar ID ${calendarId} for organization ${orgId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Save selected calendar error:', error)
    throw error
  }
})

// Validate organization ID against RescueGroups API
async function validateOrgIdWithRescueGroups(orgId: string): Promise<{ valid: boolean; orgData?: any }> {
  try {
    const config = getConfig()
    const apiKey = config.rescuegroups?.api_key || 'eqXAy6VJ'

    const url = 'https://api.rescuegroups.org/v5/public/orgs/search/'
    const requestData = {
      data: {
        filters: [
          {
            fieldName: 'orgs.id',
            operation: 'equal',
            criteria: orgId
          }
        ]
      }
    }

    const fetch = require('node-fetch')
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authorization': apiKey
      },
      body: JSON.stringify(requestData)
    })

    if (!response.ok) {
      console.error(`RescueGroups API error: ${response.status}`)
      return { valid: false }
    }

    const data = await response.json()
    const organizations = (data as any).data || []

    if (organizations.length > 0) {
      return { valid: true, orgData: organizations[0] }
    }

    return { valid: false }
  } catch (error) {
    console.error('Error validating OrgID with RescueGroups:', error)
    return { valid: false }
  }
}

// Organization registration lock mechanism to prevent race conditions
async function acquireOrgRegistrationLock(orgId: string, userId: string): Promise<boolean> {
  const lockDoc = admin.firestore().collection('orgLocks').doc(orgId)
  
  try {
    await admin.firestore().runTransaction(async (transaction) => {
      const lock = await transaction.get(lockDoc)
      
      if (lock.exists) {
        const lockData = lock.data()
        const lockTime = lockData?.lockedAt?.toDate()
        const now = new Date()
        
        // If lock is older than 5 minutes, consider it stale
        if (lockTime && (now.getTime() - lockTime.getTime()) > 5 * 60 * 1000) {
          console.log('Stale lock found, removing:', orgId)
          transaction.delete(lockDoc)
        } else {
          throw new Error('Organization registration already in progress')
        }
      }
      
      // Create new lock
      transaction.set(lockDoc, {
        lockedBy: userId,
        lockedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      })
    })
    
    return true
  } catch (error) {
    console.error('Failed to acquire org lock:', error)
    return false
  }
}

async function releaseOrgRegistrationLock(orgId: string): Promise<void> {
  try {
    await admin.firestore().collection('orgLocks').doc(orgId).delete()
  } catch (error) {
    console.error('Failed to release org lock:', error)
  }
}

// Handle new user registration with organization linking
export const registerUserWithOrganization = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Apply security middleware
      securityMiddleware.validateInput(req, res, () => {})
      securityMiddleware.checkIPWhitelist(req, res, () => {})

      // Handle authentication manually
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        await logSecurityEvent('unauthorized_access', 'unknown', {
          path: '/registerUserWithOrganization',
          reason: 'missing_auth_header'
        }, req)
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      const userId = decodedToken.uid

      // Track user session
      const sessionId = await trackUserSession(userId, req)

      // Check for suspicious activity
      const isSuspicious = await detectSuspiciousActivity(userId, 'org_registration', req)
      if (isSuspicious) {
        await logSecurityEvent('suspicious_registration_blocked', userId, {
          reason: 'suspicious_activity_detected'
        }, req)
        res.status(429).json({ error: 'Too many requests. Please try again later.' })
        return
      }

      const { orgId } = req.body

      // Log registration attempt
      await logSecurityEvent('org_registration_attempt', userId, {
        orgId,
        sessionId
      }, req)

      console.log('Registering user with organization:', { userId, orgId })

      // Check if user already exists in shelter_people collection by OAuth key
      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      
      if (userDoc.exists) {
        const userData = userDoc.data()
        const userOrgId = userData?.orgId || userId
        
        // Check if the user's organization is verified
        const orgDoc = await admin.firestore().collection('organizations').doc(userOrgId).get()
        
        if (orgDoc.exists) {
          const orgData = orgDoc.data()
          const isVerified = orgData?.verified === true
          
          console.log('User already exists, checking organization verification:', { userId, orgId: userOrgId, verified: isVerified })
          
          res.json({ 
            success: true, 
            message: 'User already registered',
            userId: userId,
            orgId: userOrgId,
            verified: isVerified,
            needsVerification: !isVerified
          })
          return
        } else {
          console.log('User exists but organization document not found:', { userId, orgId: userOrgId })
        }
      }

      // If user doesn't exist and has OrgID parameter, validate it
      if (orgId) {
        // First check if organization exists in Firestore (for test organizations)
        const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
        let validation: { valid: boolean; orgData?: any } = { valid: false }
        
        if (orgDoc.exists) {
          console.log('Organization found in Firestore (test organization):', orgId)
          // Use Firestore data for test organizations
          const orgData = orgDoc.data()
          validation = {
            valid: true,
            orgData: {
              attributes: {
                name: orgData?.rescueGroupsName || 'Test Organization',
                email: orgData?.rescueGroupsEmail || 'test@example.com',
                city: orgData?.rescueGroupsCity || 'Test City',
                state: orgData?.rescueGroupsState || 'TS'
              }
            }
          }
        } else {
          console.log('Validating OrgID with RescueGroups:', orgId)
          validation = await validateOrgIdWithRescueGroups(orgId)
          
          if (!validation.valid) {
            console.log('Invalid OrgID - not found in RescueGroups')
            res.status(403).json({ 
              error: 'Access Denied',
              message: 'Invalid organization ID. Please contact your organization administrator.',
              code: 'INVALID_ORG_ID'
            })
            return
          }
        }

        console.log('OrgID validation completed for:', orgId)

        // Acquire registration lock to prevent race conditions
        const lockAcquired = await acquireOrgRegistrationLock(orgId, userId)
        if (!lockAcquired) {
          res.status(409).json({ 
            error: 'Registration in Progress',
            message: 'Another user is currently registering for this organization. Please try again in a few minutes.',
            code: 'REGISTRATION_LOCKED'
          })
          return
        }

        try {
        // Check if this is the very first user in the system
        const usersSnapshot = await admin.firestore().collection('users').limit(1).get()
        const isFirstUserInSystem = usersSnapshot.empty
        
        // Check if organization document exists in Firestore
        const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
        const organizationExists = orgDoc.exists

        // Determine user role based on organization state
        // Check if there's already an admin user in the organization
        const existingAdmins = await admin.firestore()
          .collection('shelter_people')
          .where('orgId', '==', orgId)
          .where('role', '==', 'admin')
          .where('verified', '==', true)
          .get()
        
        const hasExistingAdmin = !existingAdmins.empty
        let userRole = hasExistingAdmin ? 'volunteer' : 'admin'
        
        if (!organizationExists) {
          // First user of this organization - they become admin
          userRole = 'admin'
          console.log('New organization - first user becomes admin:', orgId)
          
          // Create organization document
          const orgData: any = {
            createdAt: FieldValue.serverTimestamp(),
            createdBy: userId,
            organizationType: 'shelter',
            rescueGroupsId: orgId,
            rescueGroupsName: validation.orgData?.attributes?.name || '',
            rescueGroupsCity: validation.orgData?.attributes?.city || '',
            rescueGroupsState: validation.orgData?.attributes?.state || '',
            users: [],
            verified: false,
            verificationRequired: true
          }
          
          await admin.firestore().collection('organizations').doc(orgId).set(orgData)
        } else {
          console.log('Existing organization - checking for admin role:', { 
            orgId, 
            hasExistingAdmin, 
            userRole 
          })
        }

        // Create user document
        const userData = {
          createdAt: FieldValue.serverTimestamp(),
          email: decodedToken.email,
          displayName: decodedToken.name || '',
          role: userRole,
          orgId: orgId,
          verified: false
        }

        await admin.firestore().collection('shelter_people').doc(userId).set(userData)

        // Add user to organization's users array
        await admin.firestore().collection('organizations').doc(orgId).update({
          users: FieldValue.arrayUnion({
            id: userId,
            name: decodedToken.name || '',
            email: decodedToken.email || '',
            role: userRole,
              status: userRole === 'pending_verification' ? 'Pending Verification' : 'New',
            addedAt: new Date().toISOString()
          })
        })

        console.log('Successfully registered user:', { userId, orgId, role: userRole })

          // Log successful registration
          await logSecurityEvent('org_registration_success', userId, {
            orgId,
            role: userRole,
            organizationCreated: !organizationExists,
            needsAdminConfirmation: userRole === 'pending_admin_confirmation',
            needsVerification: userRole === 'pending_verification',
            sessionId
          }, req)

        res.json({ 
          success: true, 
          message: 'User registered successfully',
          userId: userId,
          orgId: orgId,
          role: userRole,
          organizationCreated: !organizationExists,
          needsAdminConfirmation: userRole === 'pending_admin_confirmation',
          needsVerification: userRole === 'pending_verification',
          isFirstUser: isFirstUserInSystem
        })

        } finally {
          // Always release the lock
          await releaseOrgRegistrationLock(orgId)
        }

      } else {
        // No OrgID provided - check if user exists in shelter_people
        console.log('No OrgID provided, checking if user exists in shelter_people')
        
        if (userDoc.exists) {
          // User exists, they're good to go
          const userData = userDoc.data()
          console.log('User found in shelter_people without OrgID parameter:', { userId, orgId: userData?.orgId })
          res.json({ 
            success: true, 
            message: 'User already registered',
            userId: userId,
            orgId: userData?.orgId,
            verified: userData?.verified || false
          })
          return
        }
        
        // User doesn't exist and no OrgID - deny access
        console.log('User not found in shelter_people and no OrgID provided - denying access')
        res.status(403).json({ 
          error: 'Access Denied',
          message: 'You must be invited by an organization to access this system.',
          code: 'NO_ORG_INVITATION'
        })
        return
      }

    } catch (error) {
      console.error('Register user error:', error)
      
      // Log registration error
      await logSecurityEvent('org_registration_error', 'unknown', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, req)
      
      res.status(500).json({ error: 'Failed to register user' })
    }
  })
})

// Send organization verification email (internal function)
async function sendOrgVerificationEmailInternal(orgId: string, userId: string, verificationUuid: string): Promise<void> {
  try {
    // Get organization data
    const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
    if (!orgDoc.exists) {
      throw new Error('Organization not found')
    }
    
    const orgData = orgDoc.data()
    
    // Get organization email from RescueGroups data
    let orgEmail = orgData?.rescueGroupsEmail
    if (!orgEmail) {
      const validation = await validateOrgIdWithRescueGroups(orgId)
      orgEmail = validation.orgData?.attributes?.email
    }
    
    if (!orgEmail) {
      throw new Error('Organization email not found in RescueGroups')
    }

    // Create verification URL
    const frontendUrl = isLocalDevelopment
      ? 'http://localhost:3000'
      : 'https://feline-finder-org-portal.web.app'
    const verificationUrl = `${frontendUrl}/verify-organization?uuid=${verificationUuid}&orgId=${orgId}`

    // Send verification email using Postmark
    const postmarkApiKey = process.env.POSTMARK_API_KEY
    if (!postmarkApiKey) {
      throw new Error('Email service not configured')
    }

    const subject = 'Verify Your Organization - Feline Finder'
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Organization Verification Required</h2>
        <p>Someone has requested to register your organization "${orgData?.rescueGroupsName || 'Unknown'}" with Feline Finder.</p>
        <p>To verify this request and grant admin access, please click the button below:</p>
        <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Organization</a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
          If you did not request this verification, please ignore this email.
        </p>
      </div>
    `
    
    const textBody = `
Organization Verification Required

Someone has requested to register your organization "${orgData?.rescueGroupsName || 'Unknown'}" with Feline Finder.

To verify this request and grant admin access, please visit:
${verificationUrl}

If you did not request this verification, please ignore this email.
    `

    const postData = JSON.stringify({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@felinefinder.org',
      To: orgEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound'
    })

    const options = {
      hostname: 'api.postmarkapp.com',
      port: 443,
      path: '/email',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Postmark-Server-Token': postmarkApiKey
      }
    }

    await new Promise<void>((resolve, reject) => {
      const req = https.request(options, (res: any) => {
        let data = ''
        res.on('data', (chunk: any) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('Organization verification email sent via Postmark to:', orgEmail)
            resolve()
          } else {
            reject(new Error(`Postmark API error: ${res.statusCode}`))
          }
        })
      })
      req.on('error', reject)
      req.write(postData)
      req.end()
    })
  } catch (error) {
    console.error('Failed to send organization verification email:', error)
    throw error
  }
}

// Send organization verification email (HTTP endpoint)
export const sendOrganizationVerificationEmail = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Handle authentication manually
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      const userId = decodedToken.uid

      // Get user data to find organization
      const userDoc = await admin.firestore().collection('users').doc(userId).get()
      if (!userDoc.exists) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      const userData = userDoc.data()
      const orgId = userData?.OrgID || userId

      // Get organization data
      const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
      if (!orgDoc.exists) {
        res.status(404).json({ error: 'Organization not found' })
        return
      }

      const orgData = orgDoc.data()
      
      // Generate verification UUID
      const verificationUuid = uuidv4()
      
      // Update organization with verification UUID
      await admin.firestore().collection('organizations').doc(orgId).update({
        verificationUuid: verificationUuid,
        verificationSentAt: FieldValue.serverTimestamp(),
        verificationEmail: decodedToken.email
      })

      // Create verification URL
      const frontendUrl = isLocalDevelopment
        ? 'http://localhost:3000'
        : 'https://feline-finder-org-portal.web.app'
      const verificationUrl = `${frontendUrl}/verify-organization?uuid=${verificationUuid}&orgId=${orgId}`

      // Get Postmark API key
      const postmarkApiKey = process.env.POSTMARK_API_KEY
      if (!postmarkApiKey) {
        console.error('POSTMARK_API_KEY not configured')
        res.status(500).json({ error: 'Email service not configured' })
        return
      }

      // Get organization email from RescueGroups data
      let orgEmail = orgData?.rescueGroupsEmail
      if (!orgEmail) {
        // If not stored in org document, we need to get it from RescueGroups
        const validation = await validateOrgIdWithRescueGroups(orgId)
        orgEmail = validation.orgData?.attributes?.email
      }
      
      if (!orgEmail) {
        res.status(400).json({ error: 'Organization email not found in RescueGroups' })
        return
      }

      // Prepare email content
      const subject = 'Verify Your Organization - Feline Finder'
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Organization Verification Required</h2>
          <p>Hello,</p>
          <p>Someone has claimed to be the administrator for <strong>${orgData?.rescueGroupsName || 'your organization'}</strong> and requested access to the Feline Finder Organization Portal.</p>
          <p>If you are the legitimate administrator and wish to verify this organization, please click the verification link below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Organization</a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p><strong>Important:</strong> This link will expire in 24 hours for security reasons.</p>
          <p>If you did not request this verification or are not the administrator, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">This email was sent by Feline Finder Organization Portal</p>
        </div>
      `
      
      const textBody = `
Organization Verification Required

Someone has claimed to be the administrator for ${orgData?.rescueGroupsName || 'your organization'} and requested access to the Feline Finder Organization Portal.

If you are the legitimate administrator and wish to verify this organization, please visit:
${verificationUrl}

This link will expire in 24 hours for security reasons.

If you did not request this verification or are not the administrator, please ignore this email.

This email was sent by Feline Finder Organization Portal
      `

      // Send email via Postmark
      const postData = JSON.stringify({
        From: process.env.POSTMARK_FROM_EMAIL || 'noreply@felinefinder.org',
        To: orgEmail,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
        MessageStream: 'outbound'
      })

      const options = {
        hostname: 'api.postmarkapp.com',
        port: 443,
        path: '/email',
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-Postmark-Server-Token': postmarkApiKey
        }
      }

      await new Promise<void>((resolve, reject) => {
        const req = https.request(options, (res: any) => {
          let data = ''
          res.on('data', (chunk: any) => { data += chunk })
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log('Verification email sent via Postmark:', { 
                userId, 
                orgId, 
                verificationUuid, 
                orgEmail
              })
              resolve()
            } else {
              console.error('Postmark API error:', res.statusCode, data)
              reject(new Error(`Postmark API error: ${res.statusCode}`))
            }
          })
        })
        req.on('error', reject)
        req.write(postData)
        req.end()
      })

      res.json({
        success: true,
        message: 'Verification email sent successfully',
        verificationUuid: verificationUuid
      })

    } catch (error) {
      console.error('Send verification email error:', error)
      res.status(500).json({ error: 'Failed to send verification email' })
    }
  })
})

// Verify organization with UUID
export const verifyOrganization = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { uuid, orgId } = req.query

      if (!uuid || !orgId) {
        res.status(400).json({ error: 'Missing verification parameters' })
        return
      }

      // Get organization document
      const orgDoc = await admin.firestore().collection('organizations').doc(orgId as string).get()
      if (!orgDoc.exists) {
        res.status(404).json({ error: 'Organization not found' })
        return
      }

      const orgData = orgDoc.data()
      
      // Check if UUID matches
      if (orgData?.verificationUuid !== uuid) {
        res.status(400).json({ error: 'Invalid verification code' })
        return
      }

      // Check if already verified
      if (orgData?.verified === true) {
        res.json({
          success: true,
          message: 'Organization already verified',
          verified: true
        })
        return
      }

      // Mark organization as verified
      await admin.firestore().collection('organizations').doc(orgId as string).update({
        verified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        verificationUuid: FieldValue.delete() // Remove UUID after verification
      })

      console.log('Organization verified:', { orgId, uuid })

      res.json({
        success: true,
        message: 'Organization verified successfully',
        verified: true
      })

    } catch (error) {
      console.error('Verify organization error:', error)
      res.status(500).json({ error: 'Failed to verify organization' })
    }
  })
})

// Send email to organization when user declines admin role
async function sendOrganizationSetupEmail(orgId: string, orgName: string) {
  try {
    // For now, just log the action - you can implement actual email sending later
    console.log(`Organization setup email would be sent to ${orgName} (${orgId})`)
    
    // TODO: Implement actual email sending to organization contact
    // This could use AWS SES, SendGrid, or another email service
    
    return true
  } catch (error) {
    console.error('Failed to send organization setup email:', error)
    return false
  }
}

// Confirm admin role for first user of organization
export const confirmAdminRole = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Handle authentication
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      const userId = decodedToken.uid

      const { isAdmin } = req.body

      // Get user document to find organization ID
      const userDoc = await admin.firestore().collection('users').doc(userId).get()
      const userData = userDoc.data()
      const orgId = userData?.OrgID

      if (!orgId) {
        res.status(400).json({ error: 'User not associated with organization' })
        return
      }

      // Verify user has pending_admin_confirmation role
      if (userData?.role !== 'pending_admin_confirmation') {
        res.status(400).json({ error: 'User is not pending admin confirmation' })
        return
      }

      if (isAdmin) {
        // User confirmed as admin - update their role
        await admin.firestore().collection('users').doc(userId).update({
          role: 'admin',
          adminConfirmedAt: FieldValue.serverTimestamp()
        })

        // Update organization to mark as verified
        await admin.firestore().collection('organizations').doc(orgId).update({
          verified: true,
          verifiedAt: FieldValue.serverTimestamp(),
          verifiedBy: userId
        })

        res.json({ 
          success: true, 
          message: 'Admin role confirmed. Proceeding to onboarding.',
          role: 'admin'
        })
      } else {
        // User declined admin role - send email to organization
        const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
        const orgData = orgDoc.data()
        
        // Send email to organization contact
        await sendOrganizationSetupEmail(orgId, orgData?.rescueGroupsName || 'Organization')
        
        res.json({ 
          success: true, 
          message: 'Email sent to organization administrator.',
          role: 'pending'
        })
      }

    } catch (error) {
      console.error('Confirm admin role error:', error)
      res.status(500).json({ error: 'Failed to process admin confirmation' })
    }
  })
})

// Search organizations by name with RescueGroups API
export const searchOrganizationsByName = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Parse request body if needed
      let body = req.body
      if (typeof body === 'string') {
        body = JSON.parse(body)
      }
      
      const { query } = body

      console.log('DEBUG: Request body:', body)
      console.log('DEBUG: Query value:', query)

      if (!query || query.length < 2) {
        res.json({ organizations: [] })
        return
      }

      console.log('Searching organizations with query:', query)

      // Get API key from config
      const config = getConfig()
      const apiKey = config.rescuegroups?.api_key || 'eqXAy6VJ'

      // Build request data for RescueGroups API (v5 format)
      const requestData = {
        data: {
          filters: [
            {
              fieldName: 'orgs.name',
              operation: 'contains',
              criteria: query
            }
          ]
        }
      }

      console.log('Request data:', JSON.stringify(requestData, null, 2))

      const response = await makeHttpRequest('https://api.rescuegroups.org/v5/public/orgs/search/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          'Authorization': apiKey
        },
        body: JSON.stringify(requestData)
      })

      console.log('Response status:', response.status)

      if (response.status < 200 || response.status >= 300) {
        const errorText = await response.text()
        console.error('RescueGroups API error:', response.status, errorText)
        throw new Error(`RescueGroups API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('Response data:', JSON.stringify(data, null, 2))
      
      // Map organizations to the expected format (v5 API response)
      // The data.data is an array of organizations
      const organizations = ((data as any).data || []).map((org: any) => ({
        id: org.id,
        name: org.attributes?.name || 'Unknown',
        city: org.attributes?.city || '',
        state: org.attributes?.state || '',
        country: org.attributes?.country || '',
        email: org.attributes?.email || ''
      }))

      console.log('Organizations found:', organizations.length)
      res.json({ organizations })
    } catch (error) {
      console.error('Search organizations by name error:', error)
      res.status(500).json({ error: 'Failed to search organizations' })
    }
  })
})

// Validate organization ID with RescueGroups (public endpoint)
export const validateOrgId = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { orgId } = req.body

      if (!orgId) {
        res.status(400).json({ error: 'Organization ID is required' })
        return
      }

      const validation = await validateOrgIdWithRescueGroups(orgId)
      
      if (validation.valid) {
        res.json({
          valid: true,
          orgData: validation.orgData
        })
      } else {
        res.status(404).json({
          valid: false,
          error: 'Organization ID not found in RescueGroups'
        })
      }
    } catch (error) {
      console.error('Validate OrgID error:', error)
      res.status(500).json({ error: 'Failed to validate organization ID' })
    }
  })
})

// Initiate organization setup with JWT
export const initiateOrganizationSetup = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { orgId, orgData } = req.body

      if (!orgId || !orgData) {
        res.status(400).json({ error: 'Organization ID and data are required' })
        return
      }

      // Generate verification UUID
      const verificationUuid = uuidv4()
      
      // Create organization document
      const orgDocument = {
        orgId: orgId,
        verificationUuid: verificationUuid,
        verified: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        rescueGroupsData: orgData,
        rescueGroupsName: orgData.attributes?.name || '',
        rescueGroupsEmail: orgData.attributes?.email || '',
        rescueGroupsCity: orgData.attributes?.city || '',
        rescueGroupsState: orgData.attributes?.state || ''
      }

      console.log('Writing organization document to Firestore:', { orgId, verificationUuid })
      await admin.firestore().collection('organizations').doc(orgId).set(orgDocument)
      console.log('Successfully wrote organization document to Firestore')

      // Generate JWT with UUID and OrgID
      const jwt = require('jsonwebtoken')
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
      
      const token = jwt.sign(
        { 
          uuid: verificationUuid, 
          orgId: orgId,
          type: 'organization_verification'
        },
        jwtSecret,
        { expiresIn: '24h' }
      )

      // Get organization email from RescueGroups data
      const orgEmail = orgData.attributes?.email
      
      if (!orgEmail) {
        res.status(400).json({ error: 'Organization email not found in RescueGroups' })
        return
      }

      // Create verification URL
      const frontendUrl = isLocalDevelopment
        ? 'http://localhost:3000'
        : 'https://feline-finder-org-portal.web.app'
      const verificationUrl = `${frontendUrl}/jwt-verification?jwt=${token}`

      // Check if we're in test/development mode
      const isTestMode = isLocalDevelopment || process.env.TEST_MODE === 'true'
      
      if (isTestMode) {
        // In test mode, send email to greg@felinefinder.org instead of the real organization
        const testEmail = 'greg@felinefinder.org'
        console.log('TEST MODE: Sending email to test address:', testEmail)
        console.log('Original organization email:', orgEmail)
        console.log('Verification URL:', verificationUrl)
        
        // Initialize Postmark client
        const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY || '')

        await postmarkClient.sendEmail({
          From: process.env.POSTMARK_FROM_EMAIL || 'noreply@felinefinder.org',
          To: testEmail,  // Send to your email instead
          Subject: `[TEST] Verify Your Organization - ${orgData.attributes?.name || 'Unknown'}`,
          HtmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 3px solid #ff6b6b; padding: 20px;">
              <div style="background-color: #ff6b6b; color: white; padding: 10px; margin: -20px -20px 20px -20px; text-align: center;">
                <strong>⚠️ TEST MODE - Development Email ⚠️</strong>
              </div>
              <p><strong>Original Recipient:</strong> ${orgEmail}</p>
              <p><strong>Organization:</strong> ${orgData.attributes?.name || 'Unknown'}</p>
              <hr style="margin: 20px 0;">
              <h2 style="color: #2563eb;">Organization Verification Required</h2>
              <p>Hello,</p>
              <p>Someone has requested to set up the Feline Finder Organization Portal for <strong>${orgData.attributes?.name || 'your organization'}</strong>.</p>
              <p>To verify this request and complete the setup, please click the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Organization</a>
              </div>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
              <p><strong>Important:</strong> This link will expire in 24 hours for security reasons.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">This is a TEST MODE email sent by Feline Finder Organization Portal</p>
            </div>
          `,
          TextBody: `
[TEST MODE - Development Email]

Original Recipient: ${orgEmail}
Organization: ${orgData.attributes?.name || 'Unknown'}

Organization Verification Required

Someone has requested to set up the Feline Finder Organization Portal for ${orgData.attributes?.name || 'your organization'}.

To verify this request and complete the setup, please visit:
${verificationUrl}

This link will expire in 24 hours for security reasons.

This is a TEST MODE email sent by Feline Finder Organization Portal
          `,
          MessageStream: 'outbound'
        })
        
        console.log('TEST MODE: Email sent successfully to', testEmail)

        res.json({ 
          success: true,
          testMode: true,
          emailDetails: {
            to: testEmail,
            originalTo: orgEmail,
            verificationUrl: verificationUrl,
            organizationName: orgData.attributes?.name || 'Unknown',
            message: `TEST MODE: Email sent to ${testEmail} instead of ${orgEmail}`
          }
        })
        return
      }

      // Send verification email using Postmark (production mode only)
      const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY || '')

      await postmarkClient.sendEmail({
        From: process.env.POSTMARK_FROM_EMAIL || 'noreply@felinefinder.org',
        To: orgEmail,
        Subject: 'Verify Your Organization - Feline Finder',
        HtmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Organization Verification Required</h2>
            <p>Hello,</p>
            <p>Someone has requested to set up the Feline Finder Organization Portal for <strong>${orgData.attributes?.name || 'your organization'}</strong>.</p>
            <p>To verify this request and complete the setup, please click the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Organization</a>
            </div>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p><strong>Important:</strong> This link will expire in 24 hours for security reasons.</p>
            <p>If you did not request this verification, please ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">This email was sent by Feline Finder Organization Portal</p>
          </div>
        `,
        TextBody: `
Organization Verification Required

Someone has requested to set up the Feline Finder Organization Portal for ${orgData.attributes?.name || 'your organization'}.

To verify this request and complete the setup, please visit:
${verificationUrl}

This link will expire in 24 hours for security reasons.

If you did not request this verification, please ignore this email.

This email was sent by Feline Finder Organization Portal
        `,
        MessageStream: 'outbound'
      })

      console.log('Organization setup initiated:', { 
        orgId, 
        verificationUuid, 
        orgEmail,
        verificationUrl 
      })

      res.json({
        success: true,
        message: 'Verification email sent successfully',
        verificationUuid: verificationUuid
      })

    } catch (error) {
      console.error('Initiate organization setup error:', error)
      res.status(500).json({ error: 'Failed to initiate organization setup' })
    }
  })
})

// Verify organization token (JWT only, no user authentication required)
export const verifyOrganizationToken = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { jwt: token } = req.body

      if (!token) {
        res.status(400).json({ error: 'JWT token is required' })
        return
      }

      // Verify JWT
      const jwt = require('jsonwebtoken')
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
      
      let decoded
      try {
        decoded = jwt.verify(token, jwtSecret)
      } catch (jwtError) {
        res.status(400).json({ error: 'Invalid or expired verification token' })
        return
      }

      if (decoded.type !== 'organization_verification') {
        res.status(400).json({ error: 'Invalid token type' })
        return
      }

      const { uuid, orgId } = decoded

      // Get organization document
      const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
      
      if (!orgDoc.exists) {
        res.status(404).json({ error: 'Organization not found' })
        return
      }

      const orgData = orgDoc.data()
      
      // Check if UUID matches
      if (orgData?.verificationUuid !== uuid) {
        res.status(400).json({ error: 'Invalid verification code' })
        return
      }

      // Check if already verified
      if (orgData?.verified === true) {
        res.json({
          success: true,
          message: 'Organization already verified',
          orgData: {
            name: orgData.rescueGroupsName,
            verified: true,
            orgId: orgId
          }
        })
        return
      }

      console.log('Organization JWT verified (awaiting user sign-in):', { orgId, uuid })

      // Return success - organization verification is valid
      res.json({
        success: true,
        message: 'Verification token is valid. Please sign in to complete setup.',
        orgData: {
          name: orgData.rescueGroupsName,
          verified: false,
          orgId: orgId
        }
      })

    } catch (error) {
      console.error('Verify organization token error:', error)
      res.status(500).json({ error: 'Failed to verify organization token' })
    }
  })
})

// Complete organization verification with JWT (no user authentication required yet)
// User will sign in later when connecting their Google Calendar in onboarding
export const completeOrganizationVerification = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { jwt: token } = req.body

      if (!token) {
        res.status(400).json({ error: 'JWT token is required' })
        return
      }

      // Verify JWT (organization verification token)
      const jwt = require('jsonwebtoken')
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
      
      let decoded
      try {
        decoded = jwt.verify(token, jwtSecret)
      } catch (jwtError) {
        res.status(400).json({ error: 'Invalid or expired verification token' })
        return
      }

      if (decoded.type !== 'organization_verification') {
        res.status(400).json({ error: 'Invalid token type' })
        return
      }

      const { uuid, orgId } = decoded

      // Get organization document
      const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
      
      if (!orgDoc.exists) {
        res.status(404).json({ error: 'Organization not found' })
        return
      }

      const orgData = orgDoc.data()
      
      // Check if UUID matches
      if (orgData?.verificationUuid !== uuid) {
        res.status(400).json({ error: 'Invalid verification code' })
        return
      }

      // Check if already verified
      if (orgData?.verified === true) {
        res.json({
          success: true,
          message: 'Organization already verified',
          orgData: {
            name: orgData.rescueGroupsName,
            verified: true,
            orgId: orgId
          }
        })
        return
      }

      // Mark organization as verified (but keep the UUID for now - it will be used when user connects calendar)
      await admin.firestore().collection('organizations').doc(orgId).update({
        verified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        pendingSetup: true, // Flag to indicate onboarding is in progress
        setupUuid: uuid // Store UUID for later validation during calendar connection
      })

      console.log('Organization verified via JWT (user will authenticate during calendar connection):', { 
        orgId, 
        uuid
      })

      // Create a session token that the frontend can use to access onboarding
      // This is a temporary token that proves they've completed JWT verification
      const setupToken = jwt.sign(
        {
          orgId,
          uuid,
          type: 'onboarding_session',
          timestamp: Date.now()
        },
        jwtSecret,
        { expiresIn: '1h' } // Short-lived session for completing onboarding
      )

      res.json({
        success: true,
        message: 'Organization verified successfully',
        orgData: {
          name: orgData.rescueGroupsName,
          verified: true,
          orgId: orgId
        },
        setupToken // Send this token to the frontend to use during onboarding
      })

    } catch (error) {
      console.error('Complete organization verification error:', error)
      res.status(500).json({ error: 'Failed to complete organization verification' })
    }
  })
})

// Test endpoint to verify connectivity
export const testConnectivity = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    res.json({
      message: 'Connectivity test successful',
      timestamp: new Date().toISOString(),
      environment: isLocalDevelopment ? 'local' : 'production'
    })
  })
})

// Find organizations with many available cats
export const findOrganizationsWithManyCats = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      // Handle authentication manually since we're using onRequest instead of onCall
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      await admin.auth().verifyIdToken(idToken)

      // Get API key from config
      const config = getConfig()
      const apiKey = config.rescuegroups?.api_key || 'eqXAy6VJ'

      // First, get a list of organizations
      const orgsUrl = 'https://api.rescuegroups.org/v5/public/organizations'
      const orgsRequestData = {
        data: {
          filters: [
            {
              fieldName: 'organizations.orgType',
              operation: 'equal',
              criteria: 'Rescue'
            }
          ]
        }
      }

      const fetch = require('node-fetch')
      const orgsResponse = await fetch(orgsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `apikey ${apiKey}`
        },
        body: JSON.stringify(orgsRequestData)
      })

      if (!orgsResponse.ok) {
        throw new Error(`Organizations API error: ${orgsResponse.status}`)
      }

      const orgsData = await orgsResponse.json()
      const organizations = (orgsData as any).data || []

      console.log(`Found ${organizations.length} organizations`)

      // Now check each organization for cat count
      const organizationsWithCats = []
      const minCatCount = 20 // Minimum number of cats required

      for (const org of organizations.slice(0, 50)) { // Limit to first 50 for testing
        try {
          const orgId = org.id
          const orgName = org.attributes?.name || 'Unknown'

          // Query cats for this organization
          const catsUrl = 'https://api.rescuegroups.org/v5/public/animals/search/available'
          const catsRequestData = {
            data: {
              filters: [
                {
                  fieldName: 'animals.species',
                  operation: 'equal',
                  criteria: 'Cat'
                },
                {
                  fieldName: 'animals.status',
                  operation: 'equal',
                  criteria: 'Available'
                },
                {
                  fieldName: 'animals.orgID',
                  operation: 'equal',
                  criteria: orgId
                }
              ]
            }
          }

          const catsResponse = await fetch(catsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `apikey ${apiKey}`
            },
            body: JSON.stringify(catsRequestData)
          })

          if (catsResponse.ok) {
            const catsData = await catsResponse.json()
            const catCount = (catsData as any).data?.length || 0

            if (catCount >= minCatCount) {
              organizationsWithCats.push({
                id: orgId,
                name: orgName,
                catCount: catCount,
                city: org.attributes?.city || 'Unknown',
                state: org.attributes?.state || 'Unknown',
                country: org.attributes?.country || 'Unknown'
              })

              console.log(`Found organization: ${orgName} (ID: ${orgId}) with ${catCount} cats`)
            }
          }

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          console.error(`Error checking organization ${org.id}:`, error)
        }
      }

      // Sort by cat count (highest first)
      organizationsWithCats.sort((a, b) => b.catCount - a.catCount)

      res.json({ 
        organizations: organizationsWithCats,
        totalChecked: Math.min(50, organizations.length),
        minCatCount: minCatCount
      })

    } catch (error) {
      console.error('Error finding organizations with many cats:', error)
      res.status(500).json({ error: 'Failed to find organizations' })
    }
  })
})

// Fetch organizations from RescueGroups API (for admin page)
export const fetchRescueGroupsOrganizations = functions.https.onCall(async (params: any, context: any) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const { limit = 50, offset = 0, search = '' } = params

    // Get API key from config
    const config = getConfig()
    const apiKey = config.rescuegroups?.api_key || 'eqXAy6VJ'

    // Build request data
    const requestData = {
      data: {
        filters: [
          {
            fieldName: 'organizations.orgType',
            operation: 'equal',
            criteria: 'Rescue'
          }
        ]
      }
    }

    // Add search filter if provided
    if (search && search.trim()) {
      requestData.data.filters.push({
        fieldName: 'organizations.name',
        operation: 'contains',
        criteria: search.trim()
      })
    }

    const fetch = require('node-fetch')
    const response = await fetch('https://api.rescuegroups.org/v5/public/organizations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `apikey ${apiKey}`
      },
      body: JSON.stringify(requestData)
    })

    if (!response.ok) {
      throw new Error(`RescueGroups API error: ${response.status}`)
    }

    const data = await response.json()
    const allOrganizations = (data as any).data || []

    // Apply pagination
    const startIndex = offset
    const endIndex = Math.min(startIndex + limit, allOrganizations.length)
    const paginatedOrganizations = allOrganizations.slice(startIndex, endIndex)

    // Map to the expected format
    const organizations = paginatedOrganizations.map((org: any) => ({
      id: org.id,
      name: org.attributes?.name || 'Unknown',
      email: org.attributes?.email || null,
      phone: org.attributes?.phone || null,
      address: org.attributes?.address || null,
      website: org.attributes?.website || null,
      state: org.attributes?.state || null,
      zipcode: org.attributes?.zipcode || null,
      city: org.attributes?.city || null,
      OrgID: org.id
    }))

    return {
      success: true,
      organizations,
      hasMore: endIndex < allOrganizations.length,
      totalCount: allOrganizations.length,
      nextOffset: endIndex
    }
  } catch (error) {
    console.error('Fetch organizations error:', error)
    throw new functions.https.HttpsError('internal', 'Failed to fetch organizations')
  }
})

// Test function to verify deployment
export const testOrgSearch = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    res.json({ message: 'Organization search test function is working!' })
  })
})

// Check organization state for a logged-in user
export const checkOrganizationState = functions.https.onCall(async (data, context) => {
  try {
    // If not authenticated, return not logged in status
    if (!context.auth) {
      return { 
        status: 'NOT_LOGGED_IN',
        message: 'Please sign in to continue'
      }
    }

    const userId = context.auth.uid
    const userEmail = context.auth.token.email
    
    console.log('Checking organization state for user:', { userId, userEmail })

    // Check if user exists in shelter_people collection
    const userDoc = await admin.firestore()
      .collection('shelter_people')
      .doc(userId)
      .get()
    
    if (!userDoc.exists) {
      console.log('User not found in shelter_people collection')
      return { 
        status: 'USER_NOT_IN_SYSTEM',
        message: 'You need to verify your organization or be invited by an administrator',
        userEmail
      }
    }
    
    const userData = userDoc.data()
    const orgId = userData?.orgId
    
    console.log('User data:', { orgId, verified: userData?.verified, role: userData?.role })
    
    if (!orgId) {
      console.log('User has no orgId')
      return { 
        status: 'NO_ORG_ID',
        message: 'You need to be associated with an organization',
        userEmail
      }
    }
    
    // Check if user is verified
    if (!userData?.verified) {
      console.log('User is not verified')
      return {
        status: 'USER_NOT_VERIFIED',
        message: 'Please check your email for the verification link',
        userEmail,
        orgId
      }
    }
    
    // Check organization document
    const orgDoc = await admin.firestore()
      .collection('organizations')
      .doc(orgId)
      .get()
    
    if (!orgDoc.exists) {
      console.log('Organization not found')
      return { 
        status: 'ORG_NOT_FOUND',
        message: 'Organization not found. Please contact support.',
        userEmail,
        orgId
      }
    }
    
    const orgData = orgDoc.data()
    
    console.log('Organization data:', { 
      verified: orgData?.verified, 
      onboardingCompleted: orgData?.onboardingCompleted 
    })
    
    if (!orgData?.verified) {
      return {
        status: 'ORG_NOT_VERIFIED',
        message: 'Your organization needs to complete email verification',
        userEmail,
        orgId,
        userRole: userData.role
      }
    }
    
    if (!orgData?.onboardingCompleted) {
      const isAdmin = userData.role === 'admin'
      return {
        status: 'ORG_SETUP_INCOMPLETE',
        message: isAdmin 
          ? 'Please complete the organization setup'
          : 'Your administrator is completing the organization setup',
        userEmail,
        orgId,
        userRole: userData.role,
        isAdmin
      }
    }
    
    // Check if user has completed their individual onboarding
    const userOnboardingComplete = userData?.onboardingCompleted === true
    
    // Everything is complete!
    return {
      status: 'COMPLETE',
      message: 'Welcome back!',
      userEmail,
      userName: userData.name || context.auth.token.name || userEmail.split('@')[0],
      orgId,
      orgName: orgData.rescueGroupsName || orgData.name,
      userRole: userData.role,
      onboardingCompleted: userOnboardingComplete,
      orgOnboardingCompleted: orgData.onboardingCompleted
    }
  } catch (error) {
    console.error('Error checking organization state:', error)
    throw new functions.https.HttpsError('internal', 'Failed to check organization state')
  }
})

// Check user verification status by email
export const checkUserVerificationStatus = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { email } = req.body

      if (!email) {
        res.status(400).json({ 
          error: 'Email is required',
          verified: false
        })
        return
      }

      console.log('Checking verification status for email:', email)

      // Look up user in shelter_people collection by email
      const userSnapshot = await admin.firestore()
        .collection('shelter_people')
        .where('email', '==', email)
        .limit(1)
        .get()

      if (userSnapshot.empty) {
        res.json({ 
          verified: false,
          message: 'No account found with this email. Please contact your organization administrator.'
        })
        return
      }

      const userData = userSnapshot.docs[0].data()
      const userDocId = userSnapshot.docs[0].id

      // Check if user has verified attribute set to true
      if (userData.verified === true) {
        // Get organization data
        const orgId = userData.orgId
        let onboardingCompleted = false

        if (orgId) {
          const orgDoc = await admin.firestore()
            .collection('organizations')
            .doc(orgId)
            .get()

          if (orgDoc.exists) {
            const orgData = orgDoc.data()
            onboardingCompleted = orgData?.onboardingCompleted === true
          }
        }

        console.log(`✅ User ${email} is verified`)
        res.json({
          verified: true,
          userId: userDocId,
          orgId: orgId,
          onboardingCompleted
        })
      } else {
        console.log(`❌ User ${email} is not verified`)
        res.json({
          verified: false,
          message: 'Your account has not been verified yet. Please check your email for the verification link.'
        })
      }
    } catch (error) {
      console.error('Error checking user verification:', error)
      res.status(500).json({ 
        error: 'Internal server error',
        verified: false
      })
    }
  })
})

// Export team member invitation functions
export { sendTeamMemberInvitations, verifyTeamMemberInvitation } from './teamInvitations'

// Export bookings functions
export { 
  getBookings, 
  createBooking, 
  updateBooking, 
  updateBookingNotes, 
  deleteBooking 
} from './bookings/bookingsService'

// =====================================================
// BOOKING ACTIONS - Email, Volunteer Assignment, Calendar
// =====================================================

/**
 * Assign or reassign a volunteer to a booking
 */
export const assignVolunteerToBooking = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid
    const { bookingId, volunteerId, volunteerName, volunteerEmail } = data

    if (!bookingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Booking ID is required')
    }

    // Get the booking
    const bookingRef = admin.firestore().collection('bookings').doc(bookingId)
    const bookingDoc = await bookingRef.get()

    if (!bookingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Booking not found')
    }

    const booking = bookingDoc.data()

    // Verify user has access
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    if (!userDoc.exists || userDoc.data()?.orgId !== booking?.orgId) {
      throw new functions.https.HttpsError('permission-denied', 'User does not have access to this booking')
    }

    // Update booking with volunteer assignment
    await bookingRef.update({
      volunteer: volunteerName || booking.volunteer,
      volunteerId: volunteerId || booking.volunteerId,
      volunteerEmail: volunteerEmail || booking.volunteerEmail,
      status: booking.status === 'pending-confirmation' ? 'volunteer-assigned' : booking.status,
      updatedAt: FieldValue.serverTimestamp(),
      auditTrail: admin.firestore.FieldValue.arrayUnion({
        fieldName: 'volunteer',
        from: booking.volunteer || '',
        to: volunteerName || booking.volunteer,
        createdAt: FieldValue.serverTimestamp(),
        changedBy: userId
      })
    })

    console.log(`Assigned volunteer ${volunteerName} to booking ${bookingId}`)

    return { success: true, bookingId }
  } catch (error: any) {
    console.error('Error assigning volunteer:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to assign volunteer')
  }
})

/**
 * Reschedule a booking (update start and end times)
 */
export const rescheduleBooking = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid
    const { bookingId, newStartTs, newEndTs } = data

    if (!bookingId || !newStartTs || !newEndTs) {
      throw new functions.https.HttpsError('invalid-argument', 'Booking ID, new start time, and new end time are required')
    }

    // Get the booking
    const bookingRef = admin.firestore().collection('bookings').doc(bookingId)
    const bookingDoc = await bookingRef.get()

    if (!bookingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Booking not found')
    }

    const booking = bookingDoc.data()

    // Verify user has access
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    if (!userDoc.exists || userDoc.data()?.orgId !== booking?.orgId) {
      throw new functions.https.HttpsError('permission-denied', 'User does not have access to this booking')
    }

    const oldStartTs = booking?.startTs
    const oldEndTs = booking?.endTs

    // Update booking with new times
    await bookingRef.update({
      startTs: admin.firestore.Timestamp.fromDate(new Date(newStartTs)),
      endTs: admin.firestore.Timestamp.fromDate(new Date(newEndTs)),
      updatedAt: FieldValue.serverTimestamp(),
      auditTrail: admin.firestore.FieldValue.arrayUnion({
        fieldName: 'rescheduled',
        from: `${oldStartTs?.toDate()}-${oldEndTs?.toDate()}`,
        to: `${newStartTs}-${newEndTs}`,
        createdAt: FieldValue.serverTimestamp(),
        changedBy: userId
      })
    })

    console.log(`Rescheduled booking ${bookingId} to ${newStartTs}`)

    return { success: true, bookingId }
  } catch (error: any) {
    console.error('Error rescheduling booking:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to reschedule booking')
  }
})

/**
 * Send email to adopter about appointment status
 */
export const sendBookingEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid
    const { bookingId, emailType } = data

    if (!bookingId || !emailType) {
      throw new functions.https.HttpsError('invalid-argument', 'Booking ID and email type are required')
    }

    // Get the booking
    const bookingDoc = await admin.firestore().collection('bookings').doc(bookingId).get()
    if (!bookingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Booking not found')
    }

    const booking = bookingDoc.data()

    // Verify user has access
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    if (!userDoc.exists || userDoc.data()?.orgId !== booking?.orgId) {
      throw new functions.https.HttpsError('permission-denied', 'User does not have access to this booking')
    }

    const adopterEmail = booking?.adopterEmail || booking?.adopter
    if (!adopterEmail) {
      throw new functions.https.HttpsError('failed-precondition', 'Booking has no email address')
    }

    // Get Postmark API key
    const postmarkApiKey = process.env.POSTMARK_API_KEY
    if (!postmarkApiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Email service not configured')
    }

    // Generate email content based on type
    let subject = ''
    let htmlBody = ''
    let textBody = ''

    const catName = booking?.cat || 'your future feline friend'
    const adopterName = booking?.adopter || 'Future Adopter'
    const startTime = booking?.startTs?.toDate().toLocaleString() || 'TBD'
    const endTime = booking?.endTs?.toDate().toLocaleString() || 'TBD'
    const volunteerName = booking?.volunteer || 'our team'

    switch (emailType) {
      case 'setup':
        subject = `Setup Complete: Welcome to ${booking?.orgId || 'Our Shelter'}'s Adoption Process`
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your Adoption Appointment is Being Set Up</h2>
            <p>Hello ${adopterName},</p>
            <p>Thank you for choosing to adopt ${catName}! We're excited to help you bring your new family member home.</p>
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>We'll confirm your appointment time shortly</li>
              <li>You'll receive a confirmation email with all the details</li>
              <li>Please arrive 10 minutes early for your appointment</li>
            </ol>
            <p>If you have any questions, please don't hesitate to reach out.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">This is an automated message from Feline Finder</p>
          </div>
        `
        textBody = `Your adoption appointment for ${catName} is being set up. We'll send you confirmation shortly.`
        break

      case 'confirmation':
        subject = `Appointment Confirmed: Meeting ${catName}`
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your Adoption Appointment is Confirmed!</h2>
            <p>Hello ${adopterName},</p>
            <p>Your appointment to meet ${catName} has been confirmed.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Date & Time:</strong> ${startTime} - ${endTime}</p>
              <p><strong>Your Volunteer Guide:</strong> ${volunteerName}</p>
            </div>
            <p>Please arrive 10 minutes early and bring a valid ID.</p>
            <p>Looking forward to helping you meet your future companion!</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">This is an automated message from Feline Finder</p>
          </div>
        `
        textBody = `Your adoption appointment is confirmed for ${startTime}. Your volunteer guide is ${volunteerName}.`
        break

      case 'congratulations':
        subject = `🎉 Congratulations on Your Adoption of ${catName}!`
        htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Congratulations, ${adopterName}! 🎉</h2>
            <p>We're thrilled to hear that ${catName} found their forever home with you!</p>
            <p>Thank you for choosing adoption and for giving this wonderful cat a loving family.</p>
            <p><strong>We wish you and ${catName} many happy years together!</strong></p>
            <p>If you ever need anything, please don't hesitate to reach out to us.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">This is an automated message from Feline Finder</p>
          </div>
        `
        textBody = `Congratulations on adopting ${catName}! We wish you many happy years together.`
        break

      default:
        throw new functions.https.HttpsError('invalid-argument', `Unknown email type: ${emailType}`)
    }

    // Send email via Postmark
    const postData = JSON.stringify({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@felinefinder.org',
      To: adopterEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: 'outbound'
    })

    const options = {
      hostname: 'api.postmarkapp.com',
      port: 443,
      path: '/email',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Postmark-Server-Token': postmarkApiKey
      }
    }

    // Send email
    await new Promise<void>((resolve, reject) => {
      const req = https.request(options, (res: any) => {
        let data = ''
        res.on('data', (chunk: any) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`Email sent successfully to ${adopterEmail}`)
            resolve()
          } else {
            reject(new Error(`Postmark API error: ${res.statusCode}`))
          }
        })
      })
      req.on('error', reject)
      req.write(postData)
      req.end()
    })

    return { success: true, message: `Email sent to ${adopterEmail}` }
  } catch (error: any) {
    console.error('Error sending booking email:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to send email')
  }
})

/**
 * Create or update Google Calendar event for a booking
 */
export const syncBookingToCalendar = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
  }

  try {
    const userId = context.auth.uid
    const { bookingId, action } = data // action: 'create', 'update', 'delete'

    if (!bookingId) {
      throw new functions.https.HttpsError('invalid-argument', 'Booking ID is required')
    }

    // Get the booking
    const bookingDoc = await admin.firestore().collection('bookings').doc(bookingId).get()
    if (!bookingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Booking not found')
    }

    const booking = bookingDoc.data()

    // Get user and organization
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    if (!userDoc.exists || userDoc.data()?.orgId !== booking?.orgId) {
      throw new functions.https.HttpsError('permission-denied', 'User does not have access to this booking')
    }

    const orgId = booking.orgId

    // Get organization with calendar credentials
    const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
    if (!orgDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Organization not found')
    }

    const orgData = orgDoc.data()

    if (!orgData?.calendarAccessToken || !orgData?.selectedCalendarId) {
      throw new functions.https.HttpsError('failed-precondition', 'Calendar not connected for this organization')
    }

    // Set up OAuth2 client
    const config = getConfig()
    const redirectUri = isLocalDevelopment 
      ? 'http://127.0.0.1:5001/catapp-44885/us-central1/gcalOAuthCallback'
      : config.gcal.redirect_uri

    const oauth2Client = new google.auth.OAuth2(
      config.gcal.client_id,
      config.gcal.client_secret,
      redirectUri
    )

    oauth2Client.setCredentials({
      access_token: orgData.calendarAccessToken,
      refresh_token: orgData.calendarRefreshToken
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    if (action === 'delete' && booking?.calendarEventId) {
      // Delete calendar event
      await calendar.events.delete({
        calendarId: orgData.selectedCalendarId,
        eventId: booking.calendarEventId
      })
      console.log(`Deleted calendar event ${booking.calendarEventId} for booking ${bookingId}`)
    } else {
      // Create or update calendar event
      const event = {
        summary: `${booking.cat} Adoption - ${booking.adopter}`,
        description: `Feline Finder Adoption Meeting\n\nCat: ${booking.cat}\nAdopter: ${booking.adopter}\nStatus: ${booking.status}`,
        start: {
          dateTime: booking.startTs?.toDate().toISOString(),
          timeZone: booking.startTimeZone || 'America/New_York'
        },
        end: {
          dateTime: booking.endTs?.toDate().toISOString(),
          timeZone: booking.endTimeZone || 'America/New_York'
        },
        attendees: booking.adopterEmail ? [{ email: booking.adopterEmail }] : [],
        location: 'To be determined',
        status: 'confirmed'
      }

      let eventId = booking.calendarEventId

      if (eventId) {
        // Update existing event
        await calendar.events.update({
          calendarId: orgData.selectedCalendarId,
          eventId: eventId,
          requestBody: event
        })
        console.log(`Updated calendar event ${eventId} for booking ${bookingId}`)
      } else {
        // Create new event
        const response = await calendar.events.insert({
          calendarId: orgData.selectedCalendarId,
          requestBody: event
        })
        eventId = response.data.id || ''

        // Update booking with calendar event ID
        await admin.firestore().collection('bookings').doc(bookingId).update({
          calendarEventId: eventId
        })
        console.log(`Created calendar event ${eventId} for booking ${bookingId}`)
      }
    }

    return { success: true, bookingId, calendarEventId: booking?.calendarEventId }
  } catch (error: any) {
    console.error('Error syncing booking to calendar:', error)
    throw new functions.https.HttpsError('internal', error.message || 'Failed to sync booking to calendar')
  }
})