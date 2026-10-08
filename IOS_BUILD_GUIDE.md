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
| `APPLE_TEAM_ID` | Team ID (10 capital letters/digits). Optional cross-check — the build reads the real team ID from Apple's provisioning profile. |

## 3. Run a build
GitHub → Actions → **Build iOS & upload to TestFlight** → Run workflow. It takes about 20–45 minutes because it waits for Apple to finish processing the build; when it goes green the build is ready under TestFlight in App Store Connect.

Each run uses the GitHub run number as the build number, so every upload is unique.

## How signing works
The workflow uses fastlane (`fastlane/Fastfile`) with your API key to:
1. create a temporary **Apple Distribution** certificate on the build machine,
2. create a fresh **App Store** provisioning profile for `app.tapdine.diner`,
3. build a signed `.ipa` and upload it to TestFlight,
4. revoke the temporary certificate at the end. TestFlight/App Store builds are re-signed by Apple, so this doesn't affect uploaded builds, and it stops certificates piling up against Apple's limit.

Nothing needs creating by hand except the app record and the API key.

## Notes
- The app is a hosted-webview shell loading `https://tap-dine-buddy.lovable.app`, so web publishes update the app without a new build.
- Stripe and Google Maps are still in **test mode** — swap to live keys before App Store submission.
- The API key **must be a Team key with the Admin role** — only Account Holder/Admin can create distribution certificates. App Manager or Developer keys will fail at the certificate step. Individual keys are not supported.
- `APPLE_TEAM_ID` is only cross-checked; the build uses the team ID from the provisioning profile Apple issues, so a typo there shows a warning instead of breaking the build.
- "Maximum number of certificates" error: revoke unused Apple Distribution certificates at developer.apple.com → Certificates, then re-run.
- "No suitable application records" on upload: create the TapDine app in App Store Connect with bundle ID `app.tapdine.diner` first.
