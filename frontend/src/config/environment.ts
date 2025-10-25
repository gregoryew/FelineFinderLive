// Environment configuration for switching between local emulator and cloud
const isDevelopment = true // Use local emulator for fast development

export const API_CONFIG = {
  // Use local emulator in development, cloud in production
  baseUrl: isDevelopment 
    ? 'http://localhost:5001/catapp-44885/us-central1'
    : 'https://us-central1-catapp-44885.cloudfunctions.net',
  
  // OAuth redirect URI for local development
  oauthRedirectUri: isDevelopment
    ? 'http://127.0.0.1:5001/catapp-44885/us-central1/gcalOAuthCallback'
    : 'https://us-central1-catapp-44885.cloudfunctions.net/gcalOAuthCallback',
  
  // Frontend URL for OAuth redirects
  frontendUrl: isDevelopment
    ? 'http://localhost:3000' // Firebase hosting emulator (port 3000)
    : 'https://catapp-44885.web.app'
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
