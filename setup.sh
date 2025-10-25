#!/usr/bin/env bash
set -euo pipefail

# ------------------------------
# Feline Finder Org Portal - One Click Setup
# Requirements: node (>=18), npm, firebase-tools, (optional) jq, (optional) gcloud
# Run from the repo root (where firebase.json lives)
# ------------------------------

# ---- helpers
need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing dependency: $1"; MISSING=1; }
}

prompt() {
  local var="$1" msg="$2" default="${3:-}"
  local val
  if [[ -n "$default" ]]; then
    read -rp "$msg [$default]: " val || true
    val="${val:-$default}"
  else
    read -rp "$msg: " val || true
  fi
  echo "$val"
}

extract_json_value() {
  # usage: extract_json_value 'json text' 'key'
  python - <<'PY' "$1" "$2"
import json,sys
data=json.loads(sys.argv[1])
key=sys.argv[2]
# support both firebase sdkconfig formats
if 'sdkConfig' in data: data=data['sdkConfig']
print(data.get(key,''))
PY
}

# ---- dependency checks
MISSING=0
need_cmd node
need_cmd npm
need_cmd firebase
if [ "$MISSING" = "1" ]; then
  echo "Please install the missing tools and rerun."
  exit 1
fi

# optional helpers
HAS_JQ=0; command -v jq >/dev/null 2>&1 && HAS_JQ=1

echo "🚀 Feline Finder Org Portal — setup starting…"

# ---- pick/create project
PROJECT_ID="$(prompt PROJECT_ID 'Enter Firebase Project ID (new or existing)')"
if ! firebase projects:list --json | grep -q "\"projectId\": \"$PROJECT_ID\""; then
  echo "🆕 Creating Firebase project: $PROJECT_ID"
  firebase projects:create "$PROJECT_ID" || { echo "Failed to create project."; exit 1; }
else
  echo "✅ Using existing project: $PROJECT_ID"
fi
firebase use "$PROJECT_ID"

# ---- enable Firestore (manual if not enabled)
echo "ℹ️ Ensure Firestore is enabled in the Firebase Console (Production mode)."
echo "   Continuing anyway…"

# ---- create a Firebase Web App (or reuse if exists)
echo "🖥️  Creating Firebase Web App (or reusing)…"
APP_INFO_JSON="$(firebase apps:create web ff-org-portal --project "$PROJECT_ID" --json --non-interactive 2>/dev/null || true)"
if [[ -z "$APP_INFO_JSON" || "$APP_INFO_JSON" == *"ALREADY_EXISTS"* ]]; then
  echo "   App may already exist; fetching app list…"
  APPS_JSON="$(firebase apps:list web --project "$PROJECT_ID" --json)"
  if [[ "$HAS_JQ" = "1" ]]; then
    APP_ID="$(echo "$APPS_JSON" | jq -r '.result[] | select(.displayName=="ff-org-portal") | .appId' | head -n1)"
    APP_ID="${APP_ID:-$(echo "$APPS_JSON" | jq -r '.result[0].appId')}"
  else
    APP_ID="$(echo "$APPS_JSON" | sed -n 's/.*"appId": *"\([^"]*\)".*/\1/p' | head -n1)"
  fi
else
  if [[ "$HAS_JQ" = "1" ]]; then
    APP_ID="$(echo "$APP_INFO_JSON" | jq -r '.result.appId')"
  else
    APP_ID="$(echo "$APP_INFO_JSON" | sed -n 's/.*"appId": *"\([^"]*\)".*/\1/p')"
  fi
fi

if [[ -z "${APP_ID:-}" ]]; then
  echo "❌ Could not determine Web App ID. Create a Web App in console and rerun."
  exit 1
fi
echo "   Web App ID: $APP_ID"

# ---- get SDK config (apiKey, authDomain, projectId)
SDK_JSON="$(firebase apps:sdkconfig web "$APP_ID" --project "$PROJECT_ID" --json)"
if [[ -z "$SDK_JSON" ]]; then
  echo "❌ Could not fetch SDK config."
  exit 1
fi

if [[ "$HAS_JQ" = "1" ]]; then
  API_KEY="$(echo "$SDK_JSON" | jq -r '.result.sdkConfig.apiKey // .result.apiKey')"
  AUTH_DOMAIN="$(echo "$SDK_JSON" | jq -r '.result.sdkConfig.authDomain // .result.authDomain')"
  PROJ_ID="$(echo "$SDK_JSON" | jq -r '.result.sdkConfig.projectId // .result.projectId')"
else
  API_KEY="$(extract_json_value "$SDK_JSON" "apiKey")"
  AUTH_DOMAIN="$(extract_json_value "$SDK_JSON" "authDomain")"
  PROJ_ID="$(extract_json_value "$SDK_JSON" "projectId")"
fi

# ---- write frontend/.env
echo "📝 Writing frontend/.env"
cat > frontend/.env <<ENV
VITE_FB_API_KEY=$API_KEY
VITE_FB_AUTH_DOMAIN=$AUTH_DOMAIN
VITE_FB_PROJECT_ID=$PROJ_ID
ENV

# ---- install & build
echo "📦 Installing & building frontend…"
( cd frontend && npm i && npm run build )

echo "📦 Installing & building functions…"
( cd functions && npm i && npm run build )

# ---- secrets
echo "🔐 Setting Function secrets…"
ADMIN_EMAILS="$(prompt ADMIN_EMAILS 'Enter comma-separated OWNER emails allowed to grant admin (ADMIN_EMAILS)' 'you@example.org')"
firebase functions:secrets:set ADMIN_EMAILS --project "$PROJECT_ID" <<<"$ADMIN_EMAILS"

echo "🔐 Google Calendar OAuth client"
echo "    • Create an OAuth Client (Web) in Google Cloud Console (APIs & Services → Credentials)."
echo "    • Enable Google Calendar API in Library."
GCAL_CLIENT_ID="$(prompt GCAL_CLIENT_ID 'Paste your Google OAuth CLIENT_ID')"
GCAL_CLIENT_SECRET="$(prompt GCAL_CLIENT_SECRET 'Paste your Google OAuth CLIENT_SECRET')"

# Compute redirect URI for gcalOAuthCallback (default region us-central1)
GCAL_REDIRECT_URI="https://us-central1-$PROJECT_ID.cloudfunctions.net/gcalOAuthCallback"
echo "   Using redirect URI: $GCAL_REDIRECT_URI"
echo "   👉 Add this EXACT URI to your OAuth client Authorized redirect URIs, then continue."

firebase functions:secrets:set GCAL_CLIENT_ID --project "$PROJECT_ID" <<<"$GCAL_CLIENT_ID"
firebase functions:secrets:set GCAL_CLIENT_SECRET --project "$PROJECT_ID" <<<"$GCAL_CLIENT_SECRET"
firebase functions:secrets:set GCAL_REDIRECT_URI --project "$PROJECT_ID" <<<"$GCAL_REDIRECT_URI"

# ---- optional SMTP (skip if blank)
SMTP_HOST="$(prompt SMTP_HOST 'SMTP host (optional; leave blank to log emails only)' '')"
if [[ -n "$SMTP_HOST" ]]; then
  SMTP_PORT="$(prompt SMTP_PORT 'SMTP port' '587')"
  SMTP_USER="$(prompt SMTP_USER 'SMTP user')" || true
  SMTP_PASS="$(prompt SMTP_PASS 'SMTP pass')" || true
  MAIL_FROM="$(prompt MAIL_FROM 'MAIL_FROM (from address)' 'noreply@felinefinder.local')"
  firebase functions:secrets:set SMTP_HOST --project "$PROJECT_ID" <<<"$SMTP_HOST"
  firebase functions:secrets:set SMTP_PORT --project "$PROJECT_ID" <<<"$SMTP_PORT"
  firebase functions:secrets:set SMTP_USER --project "$PROJECT_ID" <<<"$SMTP_USER"
  firebase functions:secrets:set SMTP_PASS --project "$PROJECT_ID" <<<"$SMTP_PASS"
  firebase functions:secrets:set MAIL_FROM --project "$PROJECT_ID" <<<"$MAIL_FROM"
else
  echo "   (Skipping SMTP secrets — emails will be logged only.)"
fi

# ---- deploy indexes (bookings listing)
echo "🗂  Deploying Firestore indexes…"
firebase deploy --only firestore:indexes --project "$PROJECT_ID"

# ---- deploy hosting + functions
echo "🚢 Deploying Hosting & Functions…"
firebase deploy --only hosting,functions --project "$PROJECT_ID"

# ---- final info
SITE_URL="https://$PROJECT_ID.web.app"
CALLBACK_URL="$GCAL_REDIRECT_URI"

cat <<OUT

✅ Done!

• Site:             $SITE_URL
• OAuth redirect:   $CALLBACK_URL

Next steps:
1) In Firebase Console:
   - Enable Authentication → Google provider.
   - Ensure Firestore is enabled (Production mode).
2) In Google Cloud Console (same project):
   - Enable "Google Calendar API".
   - Create/Update OAuth Client (Web) and add Authorized redirect URI:
     $CALLBACK_URL
3) Open the site, sign in, then go to /admin to grant yourself shelter_admin.

Happy rescuing! 🐾
OUT
