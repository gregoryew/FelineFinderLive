# How to Debug Production OAuth Issues

## Step 1: Open Browser Developer Tools

1. Go to the production site: https://feline-finder-org-portal.web.app
2. Open Developer Tools:
   - **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Firefox**: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
   - **Safari**: Enable Developer menu first, then `Cmd+Option+I`

3. Go to the **Console** tab

## Step 2: Try to Sign In

1. Click the "Sign in with Google" button
2. Watch the console for log messages with emojis:
   - 🔵 = Process starting
   - ✅ = Success
   - ❌ = Error
   - ⚠️ = Warning

## Step 3: Check for These Common Errors

### Error: `auth/popup-closed-by-user`
**Cause**: Popup window closed immediately or was blocked
**Solution**: Try the redirect method instead

### Error: `auth/popup-blocked`
**Cause**: Browser blocked the popup
**Solution**: 
- Allow popups for the site
- Use redirect method instead

### Error: `auth/unauthorized-domain`
**Cause**: Domain not authorized in Firebase Console
**Solution**: 
- Go to Firebase Console → Authentication → Settings → Authorized domains
- Add: `feline-finder-org-portal.web.app`
- Add: `feline-finder-org-portal.firebaseapp.com`
- Add: `catapp-44885.firebaseapp.com`

### Error: `auth/configuration-not-found`
**Cause**: Google OAuth not configured
**Solution**: 
- Go to Firebase Console → Authentication → Sign-in method
- Enable Google provider
- Add OAuth client credentials

### Error: `auth/operation-not-allowed`
**Cause**: Google sign-in not enabled
**Solution**: Enable Google provider in Firebase Console

### Error: No error, but popup closes immediately
**Possible causes**:
1. OAuth consent screen not published
2. Domain not in authorized JavaScript origins
3. Redirect URI mismatch

**Check**:
- Google Cloud Console → APIs & Services → OAuth consent screen
- Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
- Verify authorized JavaScript origins match your domain
- Verify authorized redirect URIs include Firebase Auth handler

## Step 4: Copy Console Logs

If sign-in fails, copy all console logs (especially those with 🔵, ✅, ❌) and share them for debugging.

## Step 5: Try Redirect Method

If popup doesn't work, click the "Sign in with Google (Redirect)" button instead. This method redirects the entire page instead of opening a popup.

