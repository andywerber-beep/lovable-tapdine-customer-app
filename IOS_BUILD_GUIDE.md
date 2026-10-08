# TapDine iOS cloud build guide

Build and upload the iOS app to TestFlight from GitHub — no Mac or Xcode needed.

## 1. One-time setup in App Store Connect
1. **Create the app record**: App Store Connect → Apps → "+" → New App. Bundle ID `app.tapdine.diner` (register it first under Certificates, Identifiers & Profiles → Identifiers if it is not listed). Name: TapDine.
2. **Create an API key**: Users and Access → Integrations → App Store Connect API → Team Keys → "+". Access: **Admin** (needed so the build can create signing certificates automatically).
3. Download the `AuthKey_XXXXXXXXXX.p8` file (you can only download it once). Note the **Key ID** and the **Issuer ID** shown at the top of the page.
4. Find your **Team ID**: developer.apple.com → Account → Membership details.

## 2. Add GitHub repository secrets
GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret name | Value |
|---|---|
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID (a long UUID) |
| `APP_STORE_CONNECT_KEY_ID` | Key ID (10 characters) |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Entire contents of the `.p8` file, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |
| `APPLE_TEAM_ID` | Team ID (10 characters) |

## 3. Run a build
GitHub → Actions → **Build iOS & upload to TestFlight** → Run workflow. It takes about 10–20 minutes. Apple then processes the build (5–30 min) and it appears under TestFlight in App Store Connect.

Each run uses the GitHub run number as the build number, so every upload is unique.

## Notes
- The app is a hosted-webview shell loading `https://tap-dine-buddy.lovable.app`, so web publishes update the app without a new build.
- Stripe and Google Maps are still in **test mode** — swap to live keys before App Store submission.
- If signing fails, check the API key has Admin access and the bundle ID is registered in your team.
