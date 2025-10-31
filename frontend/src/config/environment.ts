// Environment configuration using environment variables
// Set these in .env.local (for development) or .env.production (for production)
// For Vite, environment variables must be prefixed with VITE_

// Automatically detect if running locally (localhost) or in production
const isDevelopment = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.includes('localhost'))

// Get base URL from environment variable or fallback to detection
const getApiBaseUrl = () => {
  // Check for VITE_API_BASE_URL environment variable first
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  // Fallback to automatic detection
  return isDevelopment
    ? 'http://localhost:5001/catapp-44885/us-central1'
    : 'https://us-central1-catapp-44885.cloudfunctions.net'
}

const getOAuthRedirectUri = () => {
  if (import.meta.env.VITE_OAUTH_REDIRECT_URI) {
    return import.meta.env.VITE_OAUTH_REDIRECT_URI
  }
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}/gcalOAuthCallback`
}

const getFrontendUrl = () => {
  if (import.meta.env.VITE_FRONTEND_URL) {
    return import.meta.env.VITE_FRONTEND_URL
  }
  return isDevelopment
    ? 'http://localhost:3000'
    : 'https://feline-finder-org-portal.web.app'
}

export const API_CONFIG = {
  baseUrl: getApiBaseUrl(),
  oauthRedirectUri: getOAuthRedirectUri(),
  frontendUrl: getFrontendUrl()
}

// Firestore configuration - use production Firestore even in development
export const FIRESTORE_CONFIG = {
  useEmulator: false, // Always use production Firestore
  emulatorHost: '127.0.0.1',
  emulatorPort: 8080
}

export const isLocalDevelopment = isDevelopment

console.log('API Configuration:', {
  environment: isDevelopment ? 'development (local emulator)' : 'production (cloud)',
  baseUrl: API_CONFIG.baseUrl,
  oauthRedirectUri: API_CONFIG.oauthRedirectUri,
  frontendUrl: API_CONFIG.frontendUrl
})
