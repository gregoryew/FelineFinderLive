import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { v4 as uuidv4 } from 'uuid'
const jwt = require('jsonwebtoken')

const isLocalDevelopment = process.env.FUNCTIONS_EMULATOR === 'true'

// Send team member invitations
export const sendTeamMemberInvitations = functions.https.onCall(async (data, context) => {
  try {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const userId = context.auth.uid
    const { selectedUserIds } = data

    if (!selectedUserIds || !Array.isArray(selectedUserIds) || selectedUserIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'No users selected')
    }

    console.log('Sending team member invitations:', { userId, selectedUserIds })

    // Get the admin's user document to find their organization
    const userDoc = await admin.firestore().collection('shelter_people').doc(userId).get()
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    const orgId = userData?.orgId

    if (!orgId) {
      throw new functions.https.HttpsError('failed-precondition', 'User does not have an associated organization')
    }

    // Get organization document
    const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
    if (!orgDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Organization not found')
    }

    const orgData = orgDoc.data()
    const orgName = orgData?.rescueGroupsName || 'Your Organization'
    const teamMembers = orgData?.users || []
    
    console.log('Organization data:', { orgId, orgName, teamMembersCount: teamMembers.length, teamMembers })

    // Get JWT secret
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'

    // Process each selected user
    const results = []
    const invitedUsers = []

    for (const memberId of selectedUserIds) {
      // Find the user in the organization's users array
      const member = teamMembers.find((u: any) => u.id === memberId)

      console.log('Processing member:', { memberId, found: !!member, memberData: member })

      if (!member || !member.email) {
        console.error('Member not found or no email:', { memberId, member })
        results.push({ id: memberId, success: false, error: 'User not found or no email' })
        continue
      }

      try {
        // Generate UUID for this invitation
        const invitationUuid = uuidv4()

        // Generate JWT token
        const token = jwt.sign(
          {
            uuid: invitationUuid,
            orgId: orgId,
            email: member.email,
            name: member.name,
            role: member.role,
            type: 'team_member_invitation'
          },
          jwtSecret,
          { expiresIn: '7d' } // 7 days expiration
        )

        // Prepare invitation data for organization collection
        invitedUsers.push({
          uuid: invitationUuid,
          email: member.email,
          name: member.name,
          role: member.role,
          status: 'invited',
          invitedAt: new Date().toISOString(),
          invitedBy: userId
        })

        // Send email using Postmark
        const emailResult = await sendInvitationEmail(member.email, member.name, orgName, token, invitationUuid, orgId)

        if (emailResult.success) {
          results.push({ id: memberId, success: true })
        } else {
          results.push({ id: memberId, success: false, error: emailResult.error })
        }
      } catch (error) {
        console.error(`Error processing invitation for ${member.email}:`, error)
        results.push({ id: memberId, success: false, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // Update organization document with invited users (only if there are successful invitations)
    if (invitedUsers.length > 0) {
      await admin.firestore().collection('organizations').doc(orgId).update({
        invitedUsers: FieldValue.arrayUnion(...invitedUsers)
      })
      console.log('Team member invitations sent:', { results, invitedUsers: invitedUsers.length })
    } else {
      console.log('No invitations were successfully sent, skipping organization update')
    }

    return {
      success: true,
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length
    }
  } catch (error) {
    console.error('Send team member invitations error:', error)
    throw error instanceof functions.https.HttpsError ? error : new functions.https.HttpsError('internal', 'Failed to send invitations')
  }
})

// Helper function to send invitation email
async function sendInvitationEmail(
  email: string,
  name: string,
  orgName: string,
  token: string,
  uuid: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // In test mode, only send to gregoryew@gmail.com
    const recipientEmail = isLocalDevelopment ? 'gregoryew@gmail.com' : email

    // Generate verification URL
    const frontendUrl = isLocalDevelopment
      ? 'http://localhost:3000'
      : 'https://catapp-44885.web.app'
    
    const verificationUrl = `${frontendUrl}/team-member-verification?token=${encodeURIComponent(token)}&uuid=${uuid}&orgId=${orgId}`

    // Get Postmark API key from environment
    const postmarkApiKey = process.env.POSTMARK_API_KEY

    // In local development, skip sending if Postmark is not configured
    if (isLocalDevelopment && (!postmarkApiKey || postmarkApiKey === 'your_postmark_api_key_here')) {
      console.log('⚠️ Postmark API key not configured. Skipping email send in local development.')
      console.log('📧 Team member invitation email would be sent to:', email)
      console.log('📧 Organization name:', orgName)
      console.log('🔗 Verification URL:', verificationUrl)
      return { success: true }
    }

    if (!postmarkApiKey) {
      console.error('POSTMARK_API_KEY not configured')
      return { success: false, error: 'Email service not configured' }
    }

    // Prepare email content
    const emailSubject = isLocalDevelopment 
      ? `[TEST] Join ${orgName} on Feline Finder` 
      : `Join ${orgName} on Feline Finder`
    
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${isLocalDevelopment ? '<div style="background-color: #ff0000; color: white; padding: 10px; font-weight: bold; text-align: center;">TEST MODE - Email would be sent to: ' + email + '</div>' : ''}
        <h2 style="color: #2563eb;">You've Been Invited to Join ${orgName}</h2>
        <p>Hello${name ? ' ' + name : ''},</p>
        <p>You've been invited to join <strong>${orgName}</strong> on Feline Finder, our cat adoption management system.</p>
        
        <h3 style="color: #374151;">What is Feline Finder?</h3>
        <p>Feline Finder helps animal shelters and rescues manage their adoption process, schedule appointments, and connect adoptable cats with loving homes.</p>
        
        <h3 style="color: #374151;">Your Next Steps:</h3>
        <ol>
          <li>Click the button below to verify your invitation</li>
          <li>Set up your work schedule</li>
          <li>Start helping cats find their forever homes!</li>
        </ol>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Accept Invitation</a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${verificationUrl}" style="word-break: break-all; color: #2563eb;">${verificationUrl}</a>
        </p>
        
        <p><strong>Important:</strong> This invitation will expire in 7 days for security reasons.</p>
        
        <p>If you did not expect this invitation or have questions, please contact your organization administrator.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">This email was sent by Feline Finder</p>
      </div>
    `

    const textBody = `
You've Been Invited to Join ${orgName}

Hello${name ? ' ' + name : ''},

You've been invited to join ${orgName} on Feline Finder, our cat adoption management system.

What is Feline Finder?
Feline Finder helps animal shelters and rescues manage their adoption process, schedule appointments, and connect adoptable cats with loving homes.

Your Next Steps:
1. Click the link below to verify your invitation
2. Set up your work schedule
3. Start helping cats find their forever homes!

Accept your invitation by visiting:
${verificationUrl}

This invitation will expire in 7 days for security reasons.

If you did not expect this invitation or have questions, please contact your organization administrator.

${isLocalDevelopment ? 'TEST MODE - This email would normally be sent to: ' + email : ''}
    `

    // Send email via Postmark using native https module
    const https = require('https')
    
    const postData = JSON.stringify({
      From: process.env.POSTMARK_FROM_EMAIL || 'noreply@felinefinder.org',
      To: recipientEmail,
      Subject: emailSubject,
      HtmlBody: emailBody,
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

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res: any) => {
        let data = ''

        res.on('data', (chunk: any) => {
          data += chunk
        })

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const result = JSON.parse(data)
              console.log('Email sent successfully via Postmark:', { email: recipientEmail, messageId: result.MessageId })
              resolve({ success: true })
            } catch (parseError) {
              console.error('Error parsing Postmark response:', parseError)
              resolve({ success: false, error: 'Invalid response from email service' })
            }
          } else {
            console.error('Postmark API error:', { status: res.statusCode, data })
            resolve({ success: false, error: `Email service error: ${res.statusCode}` })
          }
        })
      })

      req.on('error', (error: any) => {
        console.error('Error sending request to Postmark:', error)
        reject(error)
      })

      req.write(postData)
      req.end()
    })
  } catch (error) {
    console.error('Error sending invitation email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Verify team member invitation
export const verifyTeamMemberInvitation = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { token, uuid, orgId } = req.body

    if (!token || !uuid || !orgId) {
      res.status(400).json({ success: false, error: 'Missing required parameters' })
      return
    }

    console.log('Verifying team member invitation:', { uuid, orgId })

    // Get JWT secret
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key'

    // Verify JWT token
    let decoded: any
    try {
      decoded = jwt.verify(token, jwtSecret)
    } catch (error) {
      console.error('JWT verification failed:', error)
      res.status(401).json({ success: false, error: 'Invalid or expired invitation token' })
      return
    }

    // Validate token contents
    if (decoded.type !== 'team_member_invitation' || decoded.uuid !== uuid || decoded.orgId !== orgId) {
      res.status(401).json({ success: false, error: 'Invalid invitation token' })
      return
    }

    // Get organization document
    const orgDoc = await admin.firestore().collection('organizations').doc(orgId).get()
    if (!orgDoc.exists) {
      res.status(404).json({ success: false, error: 'Organization not found' })
      return
    }

    const orgData = orgDoc.data()
    const invitedUsers = orgData?.invitedUsers || []

    // Find the invitation in the organization's invitedUsers array
    const invitation = invitedUsers.find((inv: any) => inv.uuid === uuid)

    if (!invitation) {
      res.status(404).json({ success: false, error: 'Invitation not found' })
      return
    }

    // Check if invitation is already verified
    if (invitation.status === 'verified') {
      res.status(400).json({ success: false, error: 'Invitation has already been used' })
      return
    }

    // Update invitation status to 'verified'
    const updatedInvitedUsers = invitedUsers.map((inv: any) => 
      inv.uuid === uuid ? { ...inv, status: 'verified', verifiedAt: new Date().toISOString() } : inv
    )

    await admin.firestore().collection('organizations').doc(orgId).update({
      invitedUsers: updatedInvitedUsers
    })

    // Create shelter_people document for the invited team member
    // This will be created when the user signs in with Google and their Firebase Auth user is created
    // The document will be created during the OAuth callback or registration flow
    // For now, we just mark the invitation as verified - the user document will be created when they sign in

    // Generate a setup token for onboarding access
    const setupToken = jwt.sign(
      {
        orgId: orgId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        type: 'team_member_setup',
        uuid: uuid
      },
      jwtSecret,
      { expiresIn: '1d' } // 1 day for setup
    )

    console.log('Team member invitation verified successfully:', { uuid, orgId, email: decoded.email })

    res.status(200).json({
      success: true,
      setupToken,
      orgId,
      userRole: decoded.role,
      orgData: {
        name: orgData.rescueGroupsName || orgData.name || 'Your Organization',
        orgId: orgId
      }
    })
  } catch (error) {
    console.error('Error verifying team member invitation:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

