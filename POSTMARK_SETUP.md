# Postmark Email Setup Guide

The organization verification system has been migrated from AWS SES to **Postmark** for better deliverability, simpler setup, and improved developer experience.

## Why Postmark?

- ✅ **Simpler Setup**: Just one API key, no complex AWS credentials
- ✅ **Better Deliverability**: Specialized for transactional emails
- ✅ **Developer Friendly**: Clean API with excellent error messages
- ✅ **Real-time Tracking**: Beautiful dashboard for monitoring emails
- ✅ **No Sandbox Mode**: Immediate production sending
- ✅ **Cost Effective**: 100 free emails/month, then $1.25 per 1,000

## Setup Instructions

### 1. Create a Postmark Account

1. Go to [https://postmarkapp.com](https://postmarkapp.com)
2. Sign up for a free account
3. Verify your email address

### 2. Create a Server

1. In the Postmark dashboard, click **"Create a Server"**
2. Name it something like "Feline Finder - Production" or "Feline Finder - Development"
3. Click **"Create Server"**

### 3. Get Your API Key

1. In your server settings, go to **"API Tokens"**
2. Copy the **"Server API token"**
3. Keep this safe - you'll need it for the `.env` file

### 4. Verify Your Sender Email

1. Go to **"Sender Signatures"** in your Postmark dashboard
2. Click **"Add Domain"** or **"Add Sender Signature"**
3. For a domain (recommended):
   - Add your domain (e.g., `felinefinder.org`)
   - Add the DNS records Postmark provides to your domain
   - Wait for verification (usually a few minutes)
4. For a single email (testing):
   - Enter your email address (e.g., `noreply@yourdomain.com`)
   - Click the verification link sent to that email

### 5. Update Your `.env` File

Edit `/Users/gregoryew/flutter_apps/FelineFinder/orgWebsite/functions/.env`:

```bash
# Postmark Configuration
POSTMARK_API_KEY=your_actual_postmark_api_key_here
POSTMARK_FROM_EMAIL=noreply@felinefinder.org
```

Replace `your_actual_postmark_api_key_here` with your actual API key from step 3.

### 6. Restart Your Emulators

```bash
cd /Users/gregoryew/flutter_apps/FelineFinder/orgWebsite
killall -9 node
firebase emulators:start --only functions,hosting
```

## Testing Email Sending

### In Development Mode (Test Mode)

When running locally (or when `TEST_MODE=true`), emails will be sent to `gregoryew@gmail.com` instead of the actual organization email, with a clear test banner.

To test:

1. Access the portal at `http://127.0.0.1:3000/organization-entry`
2. Search for an organization (e.g., "Cat Rescue of Maryland, Inc.")
3. Select it and proceed
4. Check `gregoryew@gmail.com` for the test email

The email will have a red banner indicating it's a test mode email and show the original recipient.

### In Production Mode

In production, emails will be sent to the actual organization's email address registered in RescueGroups.

## Monitoring Emails

1. Log into your Postmark dashboard
2. Go to **"Activity"** to see all sent emails
3. View delivery status, opens, bounces, etc.
4. Search emails by recipient, subject, or date
5. View the full email content and headers

## Troubleshooting

### Error: "The API key you provided was invalid"

- Verify your API key in the `.env` file matches your Postmark server's API token
- Make sure there are no extra spaces or quotes around the key
- Restart the Firebase emulators after changing `.env`

### Error: "The sender signature is not verified"

- Make sure you've verified your sender email/domain in Postmark
- Check that `POSTMARK_FROM_EMAIL` matches your verified sender signature
- Wait a few minutes for DNS propagation if you just added a domain

### Emails Not Sending

- Check the Firebase emulator console for error messages
- Verify the Postmark API key is set correctly
- Check Postmark's Activity dashboard for bounce or rejection reasons
- Make sure you're not exceeding your free tier limit (100 emails/month)

### Test Mode Not Working

- Verify `NODE_ENV=development` in your `.env` file
- Check that the emulator is running with `isLocalDevelopment = true`
- Look for "TEST MODE" log messages in the emulator console

## Code Changes Summary

### What Changed

1. **Import**: Replaced AWS SES import with Postmark
   ```typescript
   // Old
   import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
   
   // New
   import * as postmark from 'postmark'
   ```

2. **Email Sending**: Simplified email sending code
   ```typescript
   // Old (AWS SES)
   const sesClient = new SESClient({ region, credentials })
   await sesClient.send(new SendEmailCommand(emailParams))
   
   // New (Postmark)
   const postmarkClient = new postmark.ServerClient(apiKey)
   await postmarkClient.sendEmail({ From, To, Subject, HtmlBody, TextBody })
   ```

3. **Environment Variables**: Replaced AWS variables with Postmark
   - `AWS_REGION` → Removed
   - `AWS_ACCESS_KEY_ID` → Removed
   - `AWS_SECRET_ACCESS_KEY` → Removed
   - `AWS_SES_FROM_EMAIL` → `POSTMARK_FROM_EMAIL`
   - Added: `POSTMARK_API_KEY`

### Files Modified

- `/Users/gregoryew/flutter_apps/FelineFinder/orgWebsite/functions/src/index.ts`
- `/Users/gregoryew/flutter_apps/FelineFinder/orgWebsite/functions/.env`
- `/Users/gregoryew/flutter_apps/FelineFinder/orgWebsite/functions/.env.example`
- `/Users/gregoryew/flutter_apps/FelineFinder/orgWebsite/functions/package.json` (added postmark dependency)

## Next Steps

1. **Get a Postmark API key** and update your `.env` file
2. **Verify your sender domain/email** in Postmark
3. **Test the email flow** using the organization entry page
4. **Monitor emails** in the Postmark dashboard
5. **Optional**: Set up webhooks in Postmark to track bounces/opens in Firestore

## Support

- **Postmark Documentation**: [https://postmarkapp.com/developer](https://postmarkapp.com/developer)
- **Postmark Support**: [https://postmarkapp.com/support](https://postmarkapp.com/support)
- **API Reference**: [https://postmarkapp.com/developer/api/overview](https://postmarkapp.com/developer/api/overview)

