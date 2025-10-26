# Organization Verification Flow

## Overview
The organization verification system ensures that only authorized personnel can set up and manage an organization's portal account.

## Complete Flow

### 1. Initial Organization Entry
**Page**: `/organization-entry`

1. User is asked: "Will you be the person setting up this system?"
   - **If No**: Message to forward email to correct person
   - **If Yes**: Shows organization search

2. User searches for their organization by name (autocomplete)
   - Uses RescueGroups API v2 to search organizations
   - Displays results with city/state for disambiguation

3. User selects their organization

### 2. Email Verification Setup
**Function**: `initiateOrganizationSetup`

When user selects organization:

1. **Firestore Document Created** in `organizations` collection:
   ```javascript
   {
     orgId: "12",                    // RescueGroups OrgID
     verificationUuid: "uuid-here",  // Random UUID for security
     verified: false,                // Not verified yet
     rescueGroupsName: "Cat Rescue of Maryland, Inc.",
     rescueGroupsEmail: "catrescueofmd@mindspring.com",
     rescueGroupsCity: "Baltimore",
     rescueGroupsState: "MD",
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

2. **JWT Generated** with:
   - UUID (matches verificationUuid in document)
   - OrgID
   - Type: 'organization_verification'
   - Expiration: 24 hours

3. **Email Sent via Postmark**:
   - **Test Mode** (local development): Sends to `greg@felinefinder.org`
   - **Production Mode**: Sends to organization's registered email
   - Contains verification link: `http://127.0.0.1:3000/jwt-verification?jwt=<token>`

### 3. Email Click & Verification
**Page**: `/jwt-verification?jwt=<token>`
**Function**: `completeOrganizationVerification`

When user clicks the email link:

1. **Frontend** extracts JWT from URL
2. **Backend** verifies:
   - JWT is valid and not expired
   - Token type is 'organization_verification'
   - Organization document exists
   - UUID in JWT matches UUID in Firestore document

3. **If Valid**:
   - Sets `verified: true` in Firestore
   - Adds `verifiedAt` timestamp
   - Deletes `verificationUuid` (no longer needed)
   - Returns success with organization name

4. **Frontend** displays:
   - Success icon and message
   - Organization name
   - "Continue to Setup" button → links to `/onboarding`
   - Auto-redirects after 3 seconds

### 4. Onboarding
**Page**: `/onboarding`

User proceeds to complete organization setup:
- Configure settings
- Set up profiles
- Add team members
- Etc.

## Security Features

1. **UUID Verification**: JWT contains a UUID that must match the one stored in Firestore
2. **Time-Limited**: JWT expires in 24 hours
3. **Single Use**: UUID is deleted after successful verification
4. **Type Checking**: JWT type must be 'organization_verification'
5. **Email Ownership**: Email sent to organization's registered email in RescueGroups

## Database Schema

### Collection: `organizations`

```typescript
{
  // Document ID = OrgID from RescueGroups
  "12": {
    orgId: string,              // RescueGroups OrgID
    verified: boolean,          // Verification status
    verificationUuid?: string,  // Only present before verification
    verifiedAt?: timestamp,     // When verification completed
    createdAt: timestamp,
    updatedAt: timestamp,
    
    // RescueGroups data
    rescueGroupsName: string,
    rescueGroupsEmail: string,
    rescueGroupsCity: string,
    rescueGroupsState: string,
    rescueGroupsData: object    // Full RescueGroups response
  }
}
```

## Test Mode vs Production

### Test Mode (Local Development)
- Email sent to: `greg@felinefinder.org`
- Verification URL: `http://127.0.0.1:3000/jwt-verification?jwt=...`
- Email includes TEST MODE banner and original recipient info
- Firestore: `catapp-44885` (production database)

### Production Mode
- Email sent to: Organization's registered email
- Verification URL: `https://feline-finder-org-portal.web.app/jwt-verification?jwt=...`
- Standard verification email
- Firestore: `catapp-44885` (production database)

## API Endpoints

### `searchOrganizationsByName`
- **Type**: POST
- **Purpose**: Search RescueGroups for organizations by name
- **Auth**: None
- **Parameters**: `{ query: string }`
- **Returns**: Array of organizations with id, name, email, city, state

### `initiateOrganizationSetup`
- **Type**: POST
- **Purpose**: Create organization document, generate JWT, send email
- **Auth**: None
- **Parameters**: `{ orgId: string, orgData: object }`
- **Returns**: `{ success: true, testMode?: boolean, emailDetails?: object }`

### `completeOrganizationVerification`
- **Type**: POST
- **Purpose**: Verify JWT and mark organization as verified
- **Auth**: None
- **Parameters**: `{ jwt: string }`
- **Returns**: `{ success: true, message: string, orgData: { name, verified } }`

## Error Handling

1. **Invalid OrgID**: Organization not found in RescueGroups
2. **Missing Email**: Organization has no email in RescueGroups
3. **Invalid JWT**: Token expired, invalid, or wrong type
4. **UUID Mismatch**: JWT UUID doesn't match Firestore UUID
5. **Already Verified**: Organization already verified (returns success)
6. **Network Errors**: Email sending or API failures

## Files Involved

### Backend
- `/functions/src/index.ts`:
  - `searchOrganizationsByName` (line ~1800)
  - `initiateOrganizationSetup` (line ~1900)
  - `completeOrganizationVerification` (line ~2108)

### Frontend
- `/frontend/src/pages/OrganizationEntry.tsx` - Initial entry screen
- `/frontend/src/pages/SetupConfirmation.tsx` - Email sent confirmation
- `/frontend/src/pages/OrganizationJWTVerification.tsx` - Verification success page
- `/frontend/src/components/OrganizationAutocomplete.tsx` - Organization search

### Configuration
- `/functions/.env`:
  - `POSTMARK_API_KEY` - Email service API key
  - `POSTMARK_FROM_EMAIL` - Sender email address
  - `JWT_SECRET` - Secret for signing JWTs
  - `RESCUEGROUPS_API_KEY` - RescueGroups API key

## Testing Locally

1. Start emulators:
   ```bash
   cd /Users/gregoryew/flutter_apps/FelineFinder/orgWebsite
   firebase emulators:start --only functions,hosting
   ```

2. Access portal: `http://127.0.0.1:3000`

3. Click "Start Organization Setup"

4. Search for organization (e.g., "Cat Rescue")

5. Select organization

6. Check email at `greg@felinefinder.org`

7. Click verification link in email

8. Should see success page with link to onboarding

## Troubleshooting

- **Email not received**: Check Postmark dashboard, verify API key
- **Invalid verification**: Check JWT expiration (24 hours)
- **UUID mismatch**: Check that organization document wasn't recreated
- **Wrong URL in email**: Rebuild functions and restart emulators

