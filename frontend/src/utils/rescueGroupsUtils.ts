import { apiKeyService } from '../services/apiKeyService'

/**
 * Utility functions for RescueGroups operations
 */
export class RescueGroupsUtils {
  /**
   * Get the base URL for RescueGroups organization pages
   */
  static getOrganizationUrl(rescueGroupsOrgId: string): string {
    return `https://www.rescuegroups.org/org/${rescueGroupsOrgId}`
  }

  /**
   * Get the API key for RescueGroups API calls
   * @returns The API key or null if not available
   */
  static getApiKey(): string | null {
    return apiKeyService.getRescueGroupsApiKey()
  }

  /**
   * Check if the API key service is ready
   */
  static isApiKeyReady(): boolean {
    return apiKeyService.isReady()
  }

  /**
   * Wait for the API key to be available
   * @param timeout Maximum time to wait in milliseconds (default: 5000)
   * @returns Promise that resolves when API key is ready or rejects on timeout
   */
  static async waitForApiKey(timeout: number = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      const checkApiKey = () => {
        if (apiKeyService.isReady()) {
          const apiKey = apiKeyService.getRescueGroupsApiKey()
          if (apiKey) {
            resolve(apiKey)
            return
          }
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error('API key not available within timeout period'))
          return
        }
        
        setTimeout(checkApiKey, 100)
      }
      
      checkApiKey()
    })
  }
}

export default RescueGroupsUtils
