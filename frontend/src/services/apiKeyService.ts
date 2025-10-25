import { getAuth } from 'firebase/auth'
import { API_CONFIG } from '../config/environment'

/**
 * ApiKeyService - Manages RescueGroups API key securely
 * 
 * This service fetches the RescueGroups API key from a cloud function on app startup
 * and stores it in memory for use throughout the application.
 * 
 * Usage:
 * ```typescript
 * import { apiKeyService } from './services/apiKeyService'
 * 
 * // The service is automatically initialized on app startup
 * // Check if ready before using
 * if (apiKeyService.isReady()) {
 *   const apiKey = apiKeyService.getRescueGroupsApiKey()
 *   // Use the API key for RescueGroups API calls
 * }
 * ```
 */
class ApiKeyService {
  private rescueGroupsApiKey: string | null = null
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null

  /**
   * Initialize the API key service by fetching the RescueGroups API key
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.fetchApiKey()
    await this.initializationPromise
    this.isInitialized = true
  }

  /**
   * Fetch the RescueGroups API key from the cloud function
   */
  private async fetchApiKey(): Promise<void> {
    try {
      const auth = getAuth()
      const user = auth.currentUser
      
      let response: Response
      
      if (user) {
        // User is authenticated - use authenticated endpoint
        const idToken = await user.getIdToken()
        
        response = await fetch(`${API_CONFIG.baseUrl}/getRescueGroupsApiKey`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
        })
      } else {
        // User not authenticated - use public endpoint for organization validation
        response = await fetch(`${API_CONFIG.baseUrl}/getRescueGroupsApiKeyPublic`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      this.rescueGroupsApiKey = result.apiKey
      
      console.log('RescueGroups API key loaded successfully')
    } catch (error) {
      console.error('Failed to fetch RescueGroups API key:', error)
      // Fallback to hardcoded key if cloud function fails
      this.rescueGroupsApiKey = 'eqXAy6VJ'
      console.warn('Using fallback API key')
    }
  }

  /**
   * Get the RescueGroups API key
   * @returns The API key or null if not initialized
   */
  getRescueGroupsApiKey(): string | null {
    if (!this.isInitialized) {
      console.warn('ApiKeyService not initialized. Call initialize() first.')
      return null
    }
    return this.rescueGroupsApiKey
  }

  /**
   * Check if the service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.rescueGroupsApiKey !== null
  }

  /**
   * Reset the service (useful for testing or re-initialization)
   */
  reset(): void {
    this.rescueGroupsApiKey = null
    this.isInitialized = false
    this.initializationPromise = null
  }
}

// Export a singleton instance
export const apiKeyService = new ApiKeyService()
export default apiKeyService
