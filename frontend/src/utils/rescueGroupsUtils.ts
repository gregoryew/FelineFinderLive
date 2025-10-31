/**
 * Utility functions for RescueGroups operations
 * 
 * Note: All RescueGroups API calls are made server-side via Cloud Functions.
 * The API key is never exposed to the frontend for security.
 */
export class RescueGroupsUtils {
  /**
   * Get the base URL for RescueGroups organization pages
   * @param rescueGroupsOrgId The RescueGroups organization ID
   * @returns The URL to the organization's page on RescueGroups
   */
  static getOrganizationUrl(rescueGroupsOrgId: string): string {
    return `https://www.rescuegroups.org/org/${rescueGroupsOrgId}`
  }
}

export default RescueGroupsUtils
