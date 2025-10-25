#!/bin/bash

# Security Test Script for Feline Finder
# This script starts the emulators with production security settings

echo "🔒 Starting Firebase Emulators with PRODUCTION Security Mode"
echo "⚠️  This will enable strict security settings locally"
echo ""

# Set production security mode
export FORCE_PRODUCTION_SECURITY=true

# Start emulators
cd /Users/gregoryew/flutter_apps/FelineFinder/orgWebsite && firebase emulators:start --only hosting,auth,functions --project feline-finder-org-portal

echo ""
echo "🔒 Security Test Mode Active!"
echo "   - Rate Limiting: STRICT (100 requests/hour)"
echo "   - MFA: REQUIRED"
echo "   - IP Restrictions: ENABLED"
echo "   - Input Validation: STRICT limits"
echo ""
echo "🌐 Access URLs:"
echo "   - Frontend: http://127.0.0.1:5002"
echo "   - Admin Panel: http://127.0.0.1:5002/admin"
echo "   - Security Dashboard: http://127.0.0.1:5002/admin?tab=security"
echo "   - Firebase UI: http://127.0.0.1:4000"
