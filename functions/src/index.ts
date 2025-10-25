import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

// Initialize Firebase Admin
admin.initializeApp()

// CORS handler for HTTP functions
const corsHandler = (req: any, res: any, handler: () => void) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.status(200).send('')
    return
  }
  
  handler()
}

// Environment configuration
const getEnvironmentConfig = () => {
  const isLocalDevelopment = process.env.FUNCTIONS_EMULATOR === 'true'
  
  if (isLocalDevelopment) {
    console.log('DEBUG: Using local development configuration')
    
    return {
      gcal: {
        client_id: process.env.GCAL_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
        client_secret: process.env.GCAL_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
        redirect_uri: 'http://127.0.0.1:5001/catapp-44885/us-central1/gcalOAuthCallback'
      },
      rescuegroups: {
        api_key: process.env.RESCUEGROUPS_API_KEY || 'eqXAy6VJ'
      }
    }
  } else {
    return {
      gcal: {
        client_id: process.env.GCAL_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
        client_secret: process.env.GCAL_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET',
        redirect_uri: 'https://us-central1-catapp-44885.cloudfunctions.net/gcalOAuthCallback'
      },
      rescuegroups: {
        api_key: process.env.RESCUEGROUPS_API_KEY || 'eqXAy6VJ'
      }
    }
  }
}

// Validate organization ID with RescueGroups API
const validateOrgIdWithRescueGroups = async (orgId: string) => {
  try {
    const config = getEnvironmentConfig()
    const apiKey = config.rescuegroups.api_key
    
    const response = await fetch(`https://api.rescuegroups.org/v5/public/organizations/${orgId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` }
    }
    
    const data = await response.json()
    
    if (data.data && data.data.length > 0) {
      return { valid: true, orgData: data.data[0] }
    } else {
      return { valid: false, error: 'Organization not found' }
    }
    } catch (error) {
    console.error('Error validating OrgID:', error)
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
}

// Initiate organization setup
export const initiateOrganizationSetup = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { orgId, organizationType, adminEmail, adminName } = req.body

      if (!orgId || !organizationType || !adminEmail) {
        res.status(400).json({ error: 'Missing required fields' })
        return
      }

      // Validate organization ID with RescueGroups
      const validation = await validateOrgIdWithRescueGroups(orgId)
      if (!validation.valid) {
        res.status(403).json({
          error: 'Invalid organization ID',
          message: 'Organization not found in RescueGroups database'
        })
        return
      }

      // Generate verification UUID
      const verificationUuid = require('crypto').randomUUID()
      
      // Store organization data
      await admin.firestore().collection('organizations').doc(orgId).set({
        rescueGroupsId: orgId,
        rescueGroupsName: validation.orgData?.attributes?.name || '',
        rescueGroupsCity: validation.orgData?.attributes?.city || '',
        rescueGroupsState: validation.orgData?.attributes?.state || '',
        rescueGroupsEmail: validation.orgData?.attributes?.email || '',
        organizationType: organizationType,
        adminEmail: adminEmail,
        adminName: adminName,
        verificationUuid: verificationUuid,
        createdAt: FieldValue.serverTimestamp(),
        verified: false,
        pendingSetup: true
      })

      // TODO: Send verification email
      console.log('Organization setup initiated:', { orgId, verificationUuid })

      res.json({
        success: true,
        message: 'Organization setup initiated successfully',
        verificationUuid: verificationUuid
      })

    } catch (error) {
      console.error('Organization setup error:', error)
      res.status(500).json({ error: 'Failed to initiate organization setup' })
    }
  })
})

// Verify organization token
export const verifyOrganizationToken = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { token } = req.query

      if (!token) {
        res.status(400).json({ error: 'Token is required' })
        return
      }

      // Find organization by verification token
      const orgsSnapshot = await admin.firestore()
        .collection('organizations')
        .where('verificationUuid', '==', token)
        .limit(1)
        .get()

      if (orgsSnapshot.empty) {
        res.status(404).json({ error: 'Invalid verification token' })
        return
      }

      const orgDoc = orgsSnapshot.docs[0]
      const orgData = orgDoc.data()

      res.json({
        success: true,
        orgData: {
          orgId: orgDoc.id,
          name: orgData.rescueGroupsName,
          city: orgData.rescueGroupsCity,
          state: orgData.rescueGroupsState,
          email: orgData.rescueGroupsEmail,
          organizationType: orgData.organizationType
        }
      })

    } catch (error) {
      console.error('Token verification error:', error)
      res.status(500).json({ error: 'Failed to verify token' })
    }
  })
})

// Complete organization verification
export const completeOrganizationVerification = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { token } = req.body

      if (!token) {
        res.status(400).json({ error: 'Token is required' })
        return
      }

      // Find and update organization
      const orgsSnapshot = await admin.firestore()
        .collection('organizations')
        .where('verificationUuid', '==', token)
        .limit(1)
        .get()

      if (orgsSnapshot.empty) {
        res.status(404).json({ error: 'Invalid verification token' })
        return
      }

      const orgDoc = orgsSnapshot.docs[0]
      await orgDoc.ref.update({
        verified: true,
        verifiedAt: FieldValue.serverTimestamp(),
        verificationUuid: FieldValue.delete()
      })

      res.json({
        success: true,
        message: 'Organization verified successfully'
      })

    } catch (error) {
      console.error('Organization verification error:', error)
      res.status(500).json({ error: 'Failed to verify organization' })
    }
  })
})

// Register user with organization
export const registerUserWithOrganization = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const idToken = authHeader.split('Bearer ')[1]
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      const userId = decodedToken.uid
      const userEmail = decodedToken.email
      const userName = decodedToken.name

      const { orgId } = req.body
      if (!orgId) {
        res.status(400).json({ error: 'Organization ID is required' })
        return
      }

      console.log('Registering user with organization:', { userId, orgId })

      // Check if user is already registered with this organization
      const userDocRef = admin.firestore().collection('shelter_people').doc(userId)
      const userDoc = await userDocRef.get()

      if (userDoc.exists) {
        const userData = userDoc.data()
        if (userData?.orgId === orgId) {
          console.log('User already registered with this organization')
          res.json({
            success: true,
            message: 'User already registered with this organization',
            userId: userId,
            orgId: orgId
          })
          return
        } else {
          // User exists but for a different organization
          console.log('User exists but for a different organization. Denying access.')
          res.status(403).json({
            error: 'Access Denied',
            message: 'You are already registered with a different organization.',
            code: 'ALREADY_REGISTERED_DIFFERENT_ORG'
          })
        return
        }
      }

      // Check if organization exists and is verified
      const orgDocRef = admin.firestore().collection('organizations').doc(orgId)
      const orgDoc = await orgDocRef.get()
      let orgData: any = {}
      let isFirstUser = false

      if (!orgDoc.exists) {
        console.log('Creating new organization:', orgId)
        // Validate OrgID with RescueGroups API
        const validation = await validateOrgIdWithRescueGroups(orgId)
        if (!validation.valid) {
          console.error('Error validating OrgID with RescueGroups:', validation.error)
          res.status(403).json({
            error: 'Access Denied',
            message: 'Invalid organization ID. Please contact your organization administrator.',
            code: 'INVALID_ORG_ID'
          })
        return
      }

        orgData = {
          rescueGroupsId: orgId,
          rescueGroupsName: validation.orgData?.attributes?.name || '',
          rescueGroupsCity: validation.orgData?.attributes?.city || '',
          rescueGroupsState: validation.orgData?.attributes?.state || '',
          rescueGroupsEmail: validation.orgData?.attributes?.email || '',
          organizationType: 'shelter', // Default type
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          verified: true,
          pendingSetup: true, // Mark as pending setup for the first user
          users: []
        }
        await orgDocRef.set(orgData)
        isFirstUser = true
      } else {
        orgData = orgDoc.data()
        if (!orgData?.verified) {
          console.log('Organization exists but not verified:', orgId)
          // Re-validate with RescueGroups if not verified
          const validation = await validateOrgIdWithRescueGroups(orgId)
          if (!validation.valid) {
            console.error('Error validating OrgID with RescueGroups:', validation.error)
            res.status(403).json({
              error: 'Access Denied',
              message: 'Invalid organization ID. Please contact your organization administrator.',
              code: 'INVALID_ORG_ID'
            })
            return
          }
          // Update organization as verified
          await orgDocRef.update({
            verified: true,
            verifiedAt: FieldValue.serverTimestamp()
          })
        }
        // Check if this is the first user for an existing organization
        isFirstUser = !orgData.users || orgData.users.length === 0
      }

      // Determine user role - first user gets admin role
      const userRole = isFirstUser ? 'admin' : 'volunteer'

      console.log('User role determination:', {
        orgId,
        userId,
        isFirstUser,
        userRole
      })

      // Create user document in shelter_people
      const userData = {
        email: userEmail,
        name: userName || userEmail?.split('@')[0] || 'Unknown',
        orgId: orgId,
        verified: true,
        role: userRole,
        createdAt: FieldValue.serverTimestamp(),
        calendarConnected: false
      }

      await userDocRef.set(userData)
      console.log('Created shelter_people document:', userId, 'with role:', userRole)

      // Add user to organization's users array
      await orgDocRef.update({
        users: FieldValue.arrayUnion({
          id: userId,
          name: userName || userEmail?.split('@')[0] || 'Unknown',
          email: userEmail,
          role: userRole,
          status: 'New',
          addedAt: new Date().toISOString()
        })
      })

      console.log('Added user to organization users array')

      res.json({
      success: true,
        message: 'User successfully registered with organization',
        userId: userId,
        orgId: orgId,
        role: userRole
      })

    } catch (error) {
      console.error('Registration error:', error)
      res.status(500).json({ error: 'Registration failed' })
    }
  })
})

// Save onboarding step
export const saveOnboardingStep = functions.https.onCall(async (data, context) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid
    const { step, stepData } = data

    if (!step || !stepData) {
      throw new functions.https.HttpsError('invalid-argument', 'Step and stepData are required')
    }

    // Get user's organization
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId
    
    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User not associated with organization')
    }

    // Get organization data
        const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
    if (!orgDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Organization not found')
    }

        const orgData = orgDoc.data()
        
    // Determine user role
    let userRole = 'volunteer'
        if (orgData?.pendingSetup === true) {
          userRole = 'admin'
    } else if (userData?.role === 'admin') {
            userRole = 'admin'
    }

    // Update user document with step data
    const updateData: any = {
      [`onboarding.${step}`]: stepData,
          onboardingUpdatedAt: FieldValue.serverTimestamp()
        }
        
    await admin.firestore().collection('shelter_people').doc(userId).update(updateData)

    // If this is an admin completing organization setup, update organization
    if (userRole === 'admin' && step === 'step6') {
      await admin.firestore().collection('organizations').doc(orgId).update({
        pendingSetup: false,
        organizationOnboarded: true,
        onboardingCompletedAt: FieldValue.serverTimestamp()
      })
    }

    return { success: true, message: 'Step saved successfully' }

  } catch (error) {
    console.error('Save onboarding step error:', error)
    throw error
  }
})

// Send team member invitations
export const sendTeamMemberInvitations = functions.https.onCall(async (data, context) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid
    const { emails, names, roles } = data

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Emails array is required')
    }

    // Get user's organization
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId

    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User not associated with organization')
    }

    // Check if user is admin
    if (userData?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can send invitations')
    }

    const invitations = []
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i]
      const name = names?.[i] || email.split('@')[0]
      const role = roles?.[i] || 'volunteer'

      const invitationUuid = require('crypto').randomUUID()
      
      const invitation = {
        uuid: invitationUuid,
        email: email,
        name: name,
        role: role,
          orgId: orgId,
        invitedBy: userId,
        invitedAt: new Date().toISOString(),
        status: 'pending'
      }

      // Store invitation
      await admin.firestore().collection('team_invitations').doc(invitationUuid).set(invitation)
      
      invitations.push(invitation)
    }

    return { 
      success: true, 
      message: `${invitations.length} invitations sent successfully`,
      invitations: invitations
    }

    } catch (error) {
    console.error('Send invitations error:', error)
    throw error
  }
})

// Complete onboarding
export const completeOnboarding = functions.https.onCall(async (data, context) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid
    const { organizationData } = data

    // Get user's organization
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId

    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User not associated with organization')
    }

    // Check if user is admin
    if (userData?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can complete organization onboarding')
    }

    // Update user's onboarding status
      await admin.firestore().collection('shelter_people').doc(userId).update({
        onboardingCompleted: true,
        onboardingCompletedAt: FieldValue.serverTimestamp()
      })
      
    // Update organization
    const batch = admin.firestore().batch()
    const orgDocRef = admin.firestore().collection('organizations').doc(orgId)
    const userDocRef = admin.firestore().collection('shelter_people').doc(userId)

    batch.update(orgDocRef, {
      pendingSetup: false,
      organizationOnboarded: true,
      onboardingCompletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    })

    batch.set(userDocRef, {
      name: organizationData.userName || context.auth.token.name || context.auth.token.email.split('@')[0],
      orgId: orgId,
      verified: true,
      role: 'admin',
      onboardingCompleted: true,
      onboardingCompletedAt: FieldValue.serverTimestamp(),
      calendarConnected: organizationData.calendarConnected,
      createdAt: userData?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true })

    await batch.commit()

    return { 
      success: true,
      message: 'Onboarding completed successfully' 
    }

  } catch (error) {
    console.error('Complete onboarding error:', error)
    throw error
  }
})

// Get onboarding progress
export const getOnboardingProgress = functions.https.onCall(async (data, context) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid
    const { orgId: providedOrgId } = data

    console.log('GetOnboardingProgress (authenticated):', { userId, providedOrgId })
    
    // Get user document
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId || providedOrgId
    
    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User not associated with organization')
    }
    
    // Get organization document
    const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
    
    if (!orgDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Organization not found')
    }

    const orgData = orgDoc.data()

    // Build onboarding data
    const onboarding: any = {
      organizationType: orgData?.organizationType || 'shelter',
      calendarConnected: userData?.calendarConnected || false,
      calendarConnectedAt: userData?.calendarConnectedAt,
      users: orgData?.users || [],
      invitedUsers: [],
      organizationOnboarded: orgData?.organizationOnboarded || false,
      pendingSetup: orgData?.pendingSetup || false
    }

    // Add user-specific onboarding data
    if (userData?.onboarding) {
      Object.assign(onboarding, userData.onboarding)
    }

    // Get team invitations
    const invitationsSnapshot = await admin.firestore()
      .collection('team_invitations')
      .where('orgId', '==', orgId)
      .get()

    const invitedUsers = invitationsSnapshot.docs.map(doc => ({
      uuid: doc.id,
      email: doc.data().email,
      name: doc.data().name,
      role: doc.data().role,
      status: doc.data().status,
      invitedAt: doc.data().invitedAt,
      invitedBy: doc.data().invitedBy,
      verifiedAt: doc.data().verifiedAt
    }))

    onboarding.invitedUsers = invitedUsers

    // Add selected calendar name if available
    if (orgData?.selectedCalendarName) {
      onboarding.selectedCalendarName = orgData.selectedCalendarName
    }

    return {
      onboarding: onboarding,
      completed: userData?.onboardingCompleted || false,
      organizationOnboarded: orgData?.organizationOnboarded || false,
      pendingSetup: orgData?.pendingSetup || false,
      userRole: userData?.role || 'volunteer'
    }

    } catch (error) {
    console.error('Get onboarding progress error:', error)
    throw error
    }
})

// Google Calendar OAuth callback
export const gcalOAuthCallback = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const { code, state, error } = req.query

      if (error) {
        console.error('OAuth error:', error)
        const frontendUrl = process.env.FUNCTIONS_EMULATOR === 'true' 
          ? 'http://localhost:3000' 
          : 'https://feline-finder-org-portal.web.app'
        res.redirect(`${frontendUrl}/onboarding?error=oauth_failed`)
        return
      }

      if (!code) {
        console.error('No authorization code received')
        const frontendUrl = process.env.FUNCTIONS_EMULATOR === 'true' 
          ? 'http://localhost:3000' 
          : 'https://feline-finder-org-portal.web.app'
        res.redirect(`${frontendUrl}/onboarding?error=no_code`)
    return
  }
  
      const config = getEnvironmentConfig()
      const oauth2Client = new OAuth2Client(
        config.gcal.client_id,
        config.gcal.client_secret,
        config.gcal.redirect_uri
      )

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code as string)
          oauth2Client.setCredentials(tokens)

      // Get user info
      const oauth2 = google.oauth2('v2')
      oauth2.context._options.auth = oauth2Client as any
      const userInfo = await oauth2.userinfo.get()
      const userEmail = userInfo.data.email

      if (!userEmail) {
        throw new Error('No email found in OAuth response')
      }

      // Find user in Firestore
      const usersSnapshot = await admin.firestore()
        .collection('shelter_people')
        .where('email', '==', userEmail)
        .limit(1)
        .get()

      if (usersSnapshot.empty) {
        console.error('User not found in Firestore:', userEmail)
        const frontendUrl = process.env.FUNCTIONS_EMULATOR === 'true' 
          ? 'http://localhost:3000' 
          : 'https://feline-finder-org-portal.web.app'
        res.redirect(`${frontendUrl}/onboarding?error=user_not_found`)
        return
      }

      const userDoc = usersSnapshot.docs[0]
      const userData = userDoc.data()
      const orgId = userData.orgId

      // Create or update Firebase user
          let firebaseUser
          try {
            firebaseUser = await admin.auth().getUserByEmail(userEmail)
      } catch (error) {
        // User doesn't exist, create them
              firebaseUser = await admin.auth().createUser({
                email: userEmail,
          displayName: userData.name || userEmail.split('@')[0]
        })
      }

      // Update existing user's calendar connection status
      const userDocRef = admin.firestore().collection('shelter_people').doc(firebaseUser.uid)
      const existingUserDoc = await userDocRef.get()
      
      if (existingUserDoc.exists) {
        await userDocRef.update({
          calendarConnected: true,
          calendarConnectedAt: FieldValue.serverTimestamp()
        })
        console.log('Updated existing user calendar connection:', { userId: firebaseUser.uid, email: userEmail, orgId })
      } else {
        console.log('User not found in shelter_people - calendar OAuth should not create new users:', { userId: firebaseUser.uid, email: userEmail })
        // Redirect to onboarding without creating user - let the registration process handle user creation
        const frontendUrl = process.env.FUNCTIONS_EMULATOR === 'true' 
          ? 'http://localhost:3000' 
          : 'https://feline-finder-org-portal.web.app'
        res.redirect(`${frontendUrl}/onboarding?orgId=${orgId}&error=user_not_registered`)
        return
      }

      // Store calendar tokens in organization document
      await admin.firestore().collection('organizations').doc(orgId).update({
        calendarAccessToken: tokens.access_token,
        calendarRefreshToken: tokens.refresh_token,
        calendarConnected: true,
        calendarConnectedAt: FieldValue.serverTimestamp()
      })

      // Generate custom token for frontend
      const customToken = await admin.auth().createCustomToken(firebaseUser.uid)

      // Redirect to frontend
      const frontendUrl = process.env.FUNCTIONS_EMULATOR === 'true' 
        ? 'http://localhost:3000' 
        : 'https://feline-finder-org-portal.web.app'
      
      res.redirect(`${frontendUrl}/onboarding?orgId=${orgId}&calendar_connected=true`)

    } catch (error) {
      console.error('Calendar OAuth callback error:', error)
      const frontendUrl = process.env.FUNCTIONS_EMULATOR === 'true' 
        ? 'http://localhost:3000' 
        : 'https://feline-finder-org-portal.web.app'
      res.redirect(`${frontendUrl}/onboarding?error=oauth_failed`)
    }
  })
})

// List calendars
export const listCalendars = functions.https.onCall(async (data, context) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid

    // Get user's organization
      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
      }

      const userData = userDoc.data()
      const orgId = userData?.orgId
      
      if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User not associated with organization')
      }
      
    // Get organization's calendar tokens
      const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
      if (!orgDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Organization not found')
      }

      const orgData = orgDoc.data()
    const accessToken = orgData?.calendarAccessToken
      
    if (!accessToken) {
      throw new functions.https.HttpsError('failed-precondition', 'Calendar not connected')
      }

      // Set up OAuth2 client
    const config = getEnvironmentConfig()
    const oauth2Client = new OAuth2Client(
        config.gcal.client_id,
        config.gcal.client_secret,
      config.gcal.redirect_uri
      )

      oauth2Client.setCredentials({
      access_token: accessToken,
        refresh_token: orgData.calendarRefreshToken
      })

    // Get calendars
    const calendar = google.calendar('v3')
    calendar.context._options.auth = oauth2Client as any
    const response = await calendar.calendarList.list()

    const calendars = response.data.items?.map(cal => ({
        id: cal.id,
        summary: cal.summary,
      primary: cal.primary
      })) || []

    console.log(`✅ Successfully retrieved ${calendars.length} calendars for organization ${orgId}`)
    console.log(`📋 Calendars: ${calendars.map(c => `${c.summary} (${c.id})`).join(', ')}`)

    return {
      success: true,
      calendars: calendars
    }

  } catch (error) {
    console.error('List calendars error:', error)
    throw error
  }
})

// Save selected calendar
export const saveSelectedCalendar = functions.https.onCall(async (data, context) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid
    const { calendarId, calendarName } = data
    
    if (!calendarId) {
      throw new functions.https.HttpsError('invalid-argument', 'Calendar ID is required')
    }

    // Get user's organization
      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User not found')
      }
      
      const userData = userDoc.data()
    const orgId = userData?.orgId
      
      if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User not associated with organization')
    }

    // Update organization with selected calendar
    await admin.firestore().collection('organizations').doc(orgId).update({
      selectedCalendarId: calendarId,
      selectedCalendarName: calendarName || 'Unknown Calendar',
      updatedAt: FieldValue.serverTimestamp()
    })

    return {
      success: true,
      message: 'Calendar selection saved successfully'
    }
    
  } catch (error) {
    console.error('Save selected calendar error:', error)
    throw error
  }
})

// Get work schedule
export const getWorkSchedule = functions.https.onCall(async (data, context) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid

    // Get user's shelter_people document
      const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
      
      if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
      }

      const userData = userDoc.data()
    
    return {
        success: true,
      operatingHours: userData?.operatingHours || [],
      userName: userData?.userName || context.auth.token.name || context.auth.token.email?.split('@')[0] || 'Unknown',
      workScheduleUpdatedAt: userData?.workScheduleUpdatedAt
    }
    } catch (error) {
    console.error('Get work schedule error:', error)
    throw error
  }
})

// Search organizations by name
export const searchOrganizationsByName = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(200).send('')
      return
    }

    try {
      const { name } = req.query

      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'Organization name is required' })
        return
      }

      console.log('Searching organizations by name:', name)

      // Search in RescueGroups API
      const config = getEnvironmentConfig()
      const apiKey = config.rescuegroups.api_key
      
      // For now, return mock data since the RescueGroups API endpoint needs to be verified
      console.log('Searching organizations by name:', name, 'with API key:', apiKey)
      
      // Mock response for testing
      const mockOrganizations = [
        {
          id: "56",
          name: "Test Animal Shelter",
          city: "Test City",
          state: "CA",
          email: "test@shelter.com",
          website: "https://test-shelter.com"
        },
        {
          id: "123",
          name: "Another Animal Rescue",
          city: "Another City",
          state: "NY",
          email: "info@rescue.com",
          website: "https://another-rescue.com"
        }
      ].filter(org => 
        org.name.toLowerCase().includes(name.toLowerCase()) ||
        org.city.toLowerCase().includes(name.toLowerCase())
      )

      console.log(`Found ${mockOrganizations.length} organizations matching "${name}"`)

      res.json({
        success: true,
        organizations: mockOrganizations
      })

      // TODO: Implement actual RescueGroups API call once endpoint is verified
      /*
      const response = await fetch(`https://api.rescuegroups.org/v5/public/organizations?filter[name]=${encodeURIComponent(name)}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        console.error('RescueGroups API error:', response.status, response.statusText)
        res.status(500).json({ error: 'Failed to search organizations' })
        return
      }
      
      const data = await response.json()
      
      const organizations = data.data?.map((org: any) => ({
        id: org.id,
        name: org.attributes?.name || 'Unknown',
        city: org.attributes?.city || '',
        state: org.attributes?.state || '',
        email: org.attributes?.email || '',
        website: org.attributes?.website || ''
      })) || []

      console.log(`Found ${organizations.length} organizations matching "${name}"`)

      res.json({
        success: true,
        organizations: organizations
      })
      */

    } catch (error) {
      console.error('Search organizations error:', error)
      res.status(500).json({ error: 'Failed to search organizations' })
    }
  })
})

// Save work schedule
export const saveWorkSchedule = functions.https.onCall(async (data, context) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid
    const { operatingHours, userName } = data

    // Validate required fields
    if (!operatingHours || !Array.isArray(operatingHours)) {
      throw new functions.https.HttpsError('invalid-argument', 'Operating hours are required')
    }

    // Update user's shelter_people document with work schedule data
    await admin.firestore().collection('shelter_people').doc(userId).update({
      operatingHours: operatingHours,
      userName: userName || context.auth.token.name || context.auth.token.email?.split('@')[0] || 'Unknown',
      workScheduleUpdatedAt: FieldValue.serverTimestamp()
    })

    console.log('Work schedule saved successfully for user:', userId)

    return {
      success: true,
      message: 'Work schedule saved successfully' 
    }
  } catch (error) {
    console.error('Save work schedule error:', error)
    throw error
  }
})
