import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.timebunny.app",
  appName: "TimeBunny",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // Uncomment for live-reload against your dev server:
    // url: "http://localhost:8080",
    // cleartext: true,
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#f3e8ff",
    },
  },
};

export default config;
