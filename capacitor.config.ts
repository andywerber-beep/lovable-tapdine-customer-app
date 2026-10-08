import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Hosted-webview mode: the native shell loads the live hosted TapDine app,
 * so web deploys reach the App Store build instantly with no re-release.
 *
 * Stripe and Google Maps remain in TEST mode — swap to live keys before
 * App Store submission.
 *
 * The native ios/ folder is NOT committed. On your Mac, after `git pull`:
 *   bun install
 *   npx cap add ios
 *   npx cap open ios
 */
const config: CapacitorConfig = {
  appId: "app.tapdine.diner",
  appName: "TapDine",
  webDir: "dist",
  server: {
    url: "https://tap-dine-buddy.lovable.app",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#f8fffe",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#11b7ad",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#11b7ad",
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#11b7ad",
    },
  },
};

export default config;
