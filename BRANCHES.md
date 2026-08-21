# TimeBunny branch guide

| Branch | Purpose |
|--------|---------|
| **`usable-prototype`** | Main usable web prototype — day-to-day product work, testing, and demos |
| **`android-mobile-dev`** | Android / Capacitor development (Gradle, Android Studio, Google Play testing) |
| **`apple-dev`** | Apple / iOS development (Xcode, EventKit, TestFlight) |

All three branches start from the same codebase. Use them to keep platform-specific experiments separate:

```sh
# Web prototype
git checkout usable-prototype

# Android native shell
git checkout android-mobile-dev

# iOS native shell
git checkout apple-dev
```

**Legacy branch:** `cursor/goals-carrots-badges-timezone-ui` — earlier feature work; superseded by the branches above.
