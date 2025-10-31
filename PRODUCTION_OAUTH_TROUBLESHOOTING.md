# Production Google OAuth Troubleshooting Guide

## Common Issues and Fixes

### 1. Check Firebase Console Settings

**Firebase Authentication → Sign-in method:**
- ✅ Google provider must be **Enabled**
- ✅ Project support email must be set
- ✅ Authorized domains must include:
  - `feline-finder-org-portal.web.app`
  - `feline-finder-org-portal.firebaseapp.com`
  - `catapp-44885.firebaseapp.com`

### 2. Check Google Cloud Console OAuth Client

**APIs & Services → Credentials:**
- ✅ OAuth 2.0 Client ID must exist for Web application
- ✅ **Authorized JavaScript origins** must include:
  - `https://feline-finder-org-portal.web.app`
  - `https://feline-finder-org-portal.firebaseapp.com`
  - `https://catapp-44885.firebaseapp.com`

- ✅ **Authorized redirect URIs** must include:
  - `https://catapp-44885.firebaseapp.com/__/auth/handler`
  - `https://feline-finder-org-portal.firebaseapp.com/__/auth/handler`
  - `https://feline-finder-org-portal.web.app/__/auth/handler`

### 3. OAuth Consent Screen

**APIs & Services → OAuth consent screen:**
- ✅ Must be configured
- ✅ Must be **Published** (not in Testing mode unless you're a test user)
- ✅ App name, support email, and developer contact must be set

### 4. Environment Variables

Verify production environment variables are set correctly:
- `VITE_FB_AUTH_DOMAIN` should be: `catapp-44885.firebaseapp.com` OR `feline-finder-org-portal.firebaseapp.com`
- `VITE_FB_API_KEY` must match Firebase project API key

### 5. Browser Console Errors

Common error codes:
- `auth/configuration-not-found` - OAuth provider not enabled in Firebase
- `auth/unauthorized-domain` - Domain not authorized
- `redirect_uri_mismatch` - Redirect URI not in authorized list
- `access_denied` - User denied permission or consent screen issue

## Quick Fix Checklist

1. ✅ Enable Google provider in Firebase Console
2. ✅ Add all production domains to authorized JavaScript origins
3. ✅ Add Firebase Auth redirect URIs to authorized redirect URIs
4. ✅ Publish OAuth consent screen (if in Testing mode, add your email as test user)
5. ✅ Verify environment variables match production Firebase config
6. ✅ Clear browser cache and try again

