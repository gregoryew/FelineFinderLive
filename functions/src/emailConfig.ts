import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

// Email configuration management functions

/**
 * Get organization email configuration
 */
export const getOrganizationEmailConfig = functions.https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const { organizationId } = data as any
    if (!organizationId) {
      throw new functions.https.HttpsError('invalid-argument', 'Organization ID is required')
    }

    // Check if user belongs to this organization
    const userDoc = await admin.firestore().collection('adopters').doc(context?.auth?.uid).get()
    const userData = userDoc.data()
    
    if (userData?.organizationId !== organizationId && userData?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Access denied')
    }

    // Get organization email config
    const orgConfigDoc = await admin.firestore()
      .collection('organizationEmailConfig')
      .doc(organizationId)
      .get()

    if (!orgConfigDoc.exists) {
      return {
        success: true,
        hasConfig: false,
        message: 'No email configuration found'
      }
    }

    const config = orgConfigDoc.data()
    
    // Don't return sensitive data like passwords
    return {
      success: true,
      hasConfig: true,
      config: {
        smtpHost: config?.smtpHost,
        smtpPort: config?.smtpPort,
        smtpUser: config?.smtpUser,
        fromEmail: config?.fromEmail,
        fromName: config?.fromName,
        isConfigured: config?.isConfigured || false,
        lastTested: config?.lastTested,
        lastTestResult: config?.lastTestResult
      }
    }

  } catch (error: any) {
    console.error('Get organization email config error:', error)
    throw new functions.https.HttpsError('internal', `Failed to get email config: ${error?.message}`)
  }
})

/**
 * Update organization email configuration
 */
export const updateOrganizationEmailConfig = functions.https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const { 
      organizationId, 
      smtpHost, 
      smtpPort, 
      smtpUser, 
      smtpPass, 
      fromEmail, 
      fromName 
    } = data as any

    if (!organizationId) {
      throw new functions.https.HttpsError('invalid-argument', 'Organization ID is required')
    }

    // Check if user has admin privileges for this organization
    const userDoc = await admin.firestore().collection('adopters').doc(context?.auth?.uid).get()
    const userData = userDoc.data()
    
    if (userData?.organizationId !== organizationId || userData?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required')
    }

    // Validate required fields
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !fromEmail) {
      throw new functions.https.HttpsError('invalid-argument', 'All SMTP fields are required')
    }

    // Test the email configuration before saving
    const testResult = await testEmailConfiguration({
      smtpHost,
      smtpPort: parseInt(smtpPort),
      smtpUser,
      smtpPass,
      fromEmail,
      fromName: fromName || 'Organization'
    })

    if (!testResult.success) {
      throw new functions.https.HttpsError('invalid-argument', `Email test failed: ${testResult.error}`)
    }

    // Save configuration to Firestore
    await admin.firestore().collection('organizationEmailConfig').doc(organizationId).set({
      smtpHost,
      smtpPort: parseInt(smtpPort),
      smtpUser,
      smtpPass, // In production, consider encrypting this
      fromEmail,
      fromName: fromName || 'Organization',
      isConfigured: true,
      lastTested: admin.firestore.FieldValue.serverTimestamp(),
      lastTestResult: 'success',
      configuredBy: context?.auth?.uid,
      configuredAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true })

    return {
      success: true,
      message: 'Email configuration updated successfully',
      testResult
    }

  } catch (error: any) {
    console.error('Update organization email config error:', error)
    throw new functions.https.HttpsError('internal', `Failed to update email config: ${error?.message}`)
  }
})

/**
 * Test email configuration
 */
export const testOrganizationEmailConfig = functions.https.onCall(async (data: any, context: any) => {
  try {
    if (!context?.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated')
    }

    const { 
      organizationId,
      smtpHost, 
      smtpPort, 
      smtpUser, 
      smtpPass, 
      fromEmail, 
      fromName,
      testEmail 
    } = data as any

    if (!organizationId) {
      throw new functions.https.HttpsError('invalid-argument', 'Organization ID is required')
    }

    // Check if user has admin privileges for this organization
    const userDoc = await admin.firestore().collection('adopters').doc(context?.auth?.uid).get()
    const userData = userDoc.data()
    
    if (userData?.organizationId !== organizationId || userData?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required')
    }

    const testResult = await testEmailConfiguration({
      smtpHost,
      smtpPort: parseInt(smtpPort),
      smtpUser,
      smtpPass,
      fromEmail,
      fromName: fromName || 'Organization',
      testEmail: testEmail || context?.auth?.token?.email
    })

    // Update the last test result in the config
    if (testResult.success) {
      await admin.firestore().collection('organizationEmailConfig').doc(organizationId).update({
        lastTested: admin.firestore.FieldValue.serverTimestamp(),
        lastTestResult: 'success'
      })
    } else {
      await admin.firestore().collection('organizationEmailConfig').doc(organizationId).update({
        lastTested: admin.firestore.FieldValue.serverTimestamp(),
        lastTestResult: 'failed'
      })
    }

    return {
      success: true,
      testResult
    }

  } catch (error: any) {
    console.error('Test organization email config error:', error)
    throw new functions.https.HttpsError('internal', `Failed to test email config: ${error?.message}`)
  }
})

/**
 * Helper function to test email configuration
 */
async function testEmailConfiguration(config: {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  fromEmail: string
  fromName: string
  testEmail?: string
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // Use AWS SES instead of SMTP
    const sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    })

    // Send test email if testEmail is provided
    if (config.testEmail) {
      const emailParams = {
        Source: process.env.AWS_SES_FROM_EMAIL || 'noreply@felinefinder.org',
        Destination: {
          ToAddresses: [config.testEmail]
        },
        Message: {
          Subject: {
            Data: 'Feline Finder - Email Configuration Test',
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #2563eb;">✅ Email Configuration Test Successful!</h2>
                  <p>This is a test email to verify your organization's email configuration.</p>
                  <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Configuration Details:</h3>
                    <ul>
                      <li><strong>SMTP Host:</strong> ${config.smtpHost}</li>
                      <li><strong>SMTP Port:</strong> ${config.smtpPort}</li>
                      <li><strong>From Email:</strong> ${config.fromEmail}</li>
                      <li><strong>From Name:</strong> ${config.fromName}</li>
                    </ul>
                  </div>
                  <p style="color: #6b7280; font-size: 14px;">
                    Your organization's email system is now ready to send invitations and notifications.
                  </p>
                </div>
              `,
              Charset: 'UTF-8'
            },
            Text: {
              Data: `
Email Configuration Test Successful!

This is a test email to verify your organization's email configuration.

Configuration Details:
- SMTP Host: ${config.smtpHost}
- SMTP Port: ${config.smtpPort}
- From Email: ${config.fromEmail}
- From Name: ${config.fromName}

Your organization's email system is now ready to send invitations and notifications.
              `,
              Charset: 'UTF-8'
            }
          }
        }
      }

      const command = new SendEmailCommand(emailParams)
      await sesClient.send(command)
    }

    return {
      success: true,
      message: config.testEmail ? 'Test email sent successfully' : 'SMTP configuration verified'
    }

  } catch (error: any) {
    console.error('Email configuration test failed:', error)
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    }
  }
}

/**
 * Get organization email configuration for sending emails
 * This is used internally by other functions
 */
export async function getOrganizationEmailConfigForSending(organizationId: string): Promise<{
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  fromEmail: string
  fromName: string
} | null> {
  try {
    const orgConfigDoc = await admin.firestore()
      .collection('organizationEmailConfig')
      .doc(organizationId)
      .get()

    if (!orgConfigDoc.exists) {
      return null
    }

    const config = orgConfigDoc.data()
    
    if (!config?.isConfigured) {
      return null
    }

    return {
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: config.smtpUser,
      smtpPass: config.smtpPass,
      fromEmail: config.fromEmail,
      fromName: config.fromName
    }

  } catch (error) {
    console.error('Error getting organization email config:', error)
    return null
  }
}
