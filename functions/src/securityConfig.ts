import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

// Environment detection
const isLocalDevelopment = (process.env.NODE_ENV === 'development' || 
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== undefined ||
  process.env.FUNCTIONS_EMULATOR === 'true') && 
  process.env.FORCE_PRODUCTION_SECURITY !== 'true'

export interface SecurityConfig {
  rateLimit: {
    windowMs: number
    max: number
    skip?: (req: any) => boolean
  }
  mfa: {
    required: boolean
    optional: boolean
  }
  ipWhitelist: {
    enabled: boolean
    allowedIPs: string[]
  }
  auditLogging: {
    enabled: boolean
    level: 'info' | 'warn' | 'error'
  }
  securityHeaders: {
    strict: boolean
    allowFrames: boolean
  }
  inputValidation: {
    maxLength: number
    strictMode: boolean
  }
}

export const getSecurityConfig = (): SecurityConfig => {
  return {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: isLocalDevelopment ? 10000 : 100, // Much higher for dev
      skip: isLocalDevelopment ? (req) => req.ip === '127.0.0.1' : undefined
    },
    
    mfa: {
      required: !isLocalDevelopment, // Only required in production
      optional: isLocalDevelopment
    },
    
    ipWhitelist: {
      // Only enable if ALLOWED_IPS is explicitly set (non-empty)
      enabled: !isLocalDevelopment && !!process.env.ALLOWED_IPS && process.env.ALLOWED_IPS.trim() !== '',
      allowedIPs: isLocalDevelopment ? [] : (process.env.ALLOWED_IPS?.split(',').map(ip => ip.trim()).filter(ip => ip !== '') || [])
    },
    
    auditLogging: {
      enabled: true, // Always enabled
      level: isLocalDevelopment ? 'info' : 'warn'
    },
    
    securityHeaders: {
      strict: !isLocalDevelopment,
      allowFrames: isLocalDevelopment
    },
    
    inputValidation: {
      maxLength: isLocalDevelopment ? 10000 : 1000, // More generous for dev
      strictMode: !isLocalDevelopment
    }
  }
}

// Security logging functions
export const logSecurityEvent = async (
  event: string, 
  userId: string, 
  details: any, 
  req?: any
): Promise<void> => {
  const config = getSecurityConfig()
  
  if (!config.auditLogging.enabled) return
  
  try {
    const logEntry = {
      timestamp: FieldValue.serverTimestamp(),
      event,
      userId,
      details,
      ip: req?.ip || 'unknown',
      userAgent: req?.headers?.['user-agent'] || 'unknown',
      environment: isLocalDevelopment ? 'development' : 'production'
    }
    
    await admin.firestore().collection('securityLogs').add(logEntry)
    
    // Also log to console in development
    if (isLocalDevelopment) {
      console.log(`🔒 Security Event: ${event}`, {
        userId,
        details,
        ip: logEntry.ip
      })
    }
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

// Input validation and sanitization
export const validateAndSanitizeInput = (data: any, config: SecurityConfig): any => {
  if (!config.inputValidation.strictMode) {
    return data // Skip validation in development
  }
  
  const sanitized = { ...data }
  
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'string') {
      // Trim whitespace and limit length
      sanitized[key] = sanitized[key]
        .trim()
        .substring(0, config.inputValidation.maxLength)
      
      // Basic XSS prevention
      sanitized[key] = sanitized[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
    }
  })
  
  return sanitized
}

// Suspicious activity detection
export const detectSuspiciousActivity = async (
  userId: string, 
  action: string,
  req?: any
): Promise<boolean> => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    const recentActions = await admin.firestore()
      .collection('securityLogs')
      .where('userId', '==', userId)
      .where('timestamp', '>', oneHourAgo)
      .get()
    
    const actionCount = recentActions.size
    
    // Thresholds (more lenient in development)
    const maxActionsPerHour = isLocalDevelopment ? 1000 : 50
    const maxFailedLoginsPerHour = isLocalDevelopment ? 100 : 10
    
    if (actionCount > maxActionsPerHour) {
      await logSecurityEvent('suspicious_activity', userId, {
        reason: 'excessive_actions',
        actionCount,
        threshold: maxActionsPerHour
      }, req)
      
      // Create security alert
      await admin.firestore().collection('securityAlerts').add({
        type: 'suspicious_activity',
        userId,
        details: { 
          actionCount, 
          threshold: maxActionsPerHour,
          action 
        },
        timestamp: FieldValue.serverTimestamp(),
        severity: 'high'
      })
      
      return true
    }
    
    // Check for failed login patterns
    const failedLogins = recentActions.docs.filter(doc => 
      doc.data().event === 'login_failed'
    ).length
    
    if (failedLogins > maxFailedLoginsPerHour) {
      await logSecurityEvent('suspicious_activity', userId, {
        reason: 'excessive_failed_logins',
        failedLoginCount: failedLogins,
        threshold: maxFailedLoginsPerHour
      }, req)
      
      return true
    }
    
    return false
  } catch (error) {
    console.error('Error detecting suspicious activity:', error)
    return false
  }
}

// Session management
export const trackUserSession = async (
  userId: string,
  req?: any
): Promise<string> => {
  try {
    const sessionId = require('crypto').randomUUID()
    
    await admin.firestore().collection('userSessions').doc(sessionId).set({
      userId,
      createdAt: FieldValue.serverTimestamp(),
      lastActivity: FieldValue.serverTimestamp(),
      ip: req?.ip || 'unknown',
      userAgent: req?.headers?.['user-agent'] || 'unknown',
      environment: isLocalDevelopment ? 'development' : 'production'
    })
    
    // Clean up old sessions (keep last 10 per user)
    const userSessions = await admin.firestore()
      .collection('userSessions')
      .where('userId', '==', userId)
      .orderBy('lastActivity', 'desc')
      .get()
    
    if (userSessions.size > 10) {
      const sessionsToDelete = userSessions.docs.slice(10)
      const batch = admin.firestore().batch()
      
      sessionsToDelete.forEach(doc => {
        batch.delete(doc.ref)
      })
      
      await batch.commit()
    }
    
    return sessionId
  } catch (error) {
    console.error('Error tracking user session:', error)
    return 'unknown'
  }
}

// Update session activity
export const updateSessionActivity = async (sessionId: string): Promise<void> => {
  try {
    await admin.firestore().collection('userSessions').doc(sessionId).update({
      lastActivity: FieldValue.serverTimestamp()
    })
  } catch (error) {
    console.error('Error updating session activity:', error)
  }
}

// Security middleware factory
export const createSecurityMiddleware = () => {
  const config = getSecurityConfig()
  
  return {
    // Input validation middleware
    validateInput: (req: any, res: any, next: any) => {
      if (req.body) {
        req.body = validateAndSanitizeInput(req.body, config)
      }
      next()
    },
    
    // Security logging middleware
    logRequest: async (req: any, res: any, next: any) => {
      const originalSend = res.send
      
      res.send = function(data: any) {
        // Log the response
        if (req.user?.uid) {
          logSecurityEvent('api_request', req.user.uid, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseSize: data?.length || 0
          }, req)
        }
        
        originalSend.call(this, data)
      }
      
      next()
    },
    
    // IP whitelist middleware
    checkIPWhitelist: (req: any, res: any, next: any) => {
      if (!config.ipWhitelist.enabled) {
        next()
        return
      }
      
      const clientIP = req.ip || req.connection.remoteAddress
      
      if (!config.ipWhitelist.allowedIPs.includes(clientIP)) {
        logSecurityEvent('ip_blocked', 'unknown', {
          ip: clientIP,
          path: req.path
        }, req)
        
        res.status(403).json({ error: 'IP not allowed' })
        return
      }
      
      next()
    }
  }
}

export { isLocalDevelopment }
