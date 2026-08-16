# TimeBunny Mobile App

TimeBunny uses **Capacitor** to wrap the existing React web app as native iOS and Android apps. The same routes, Supabase backend, and UI components run in a WebView, with native plugins for device calendar access on iOS.

## Architecture

| Layer | Role |
|--------|------|
| `src/pages/*` | Same screens as web (Home, Welcome Back, Goals, etc.) |
| `src/lib/appNavigation.ts` | Shared nav config for web + mobile |
| `src/components/FloatingNav.tsx` | Desktop / tablet drag menu |
| `src/components/MobileTabBar.tsx` | Bottom tab bar on phones + native |
| `src/components/AppNavigation.tsx` | Picks nav chrome by platform |
| `src/lib/nativeBootstrap.ts` | Capacitor init, EventKit bridge, deep links |
| `native/ios/*.swift` | iOS EventKit Capacitor plugin source |

## Quick start (first time)

```sh
npm install
npm run build:mobile
npx cap add ios
npx cap add android
```

Copy the Swift calendar plugin into the iOS project:

```sh
cp native/ios/EventKitCalendarReader.swift ios/App/App/
cp native/ios/TimeBunnyCalendarPlugin.swift ios/App/App/
```

Add to `ios/App/App/Info.plist` (see `native/ios/INTEGRATION.txt`):

```xml
<key>NSCalendarsUsageDescription</key>
<string>TimeBunny reads your calendar to build a focused daily schedule around your events.</string>
<key>NSCalendarsFullAccessUsageDescription</key>
<string>TimeBunny reads your calendar to build a focused daily schedule around your events.</string>
```

Register `TimeBunnyCalendarPlugin` in the Capacitor iOS bridge (Xcode → App target).

## Day-to-day dev

**Web (unchanged):**

```sh
npm run dev
```

**Native with live reload** — uncomment `server.url` in `capacitor.config.ts`:

```ts
server: {
  url: "http://localhost:8080",
  cleartext: true,
},
```

Then:

```sh
npm run dev
npx cap sync ios   # once
npx cap open ios
```

**Production native build:**

```sh
npm run mobile:ios      # build + sync + open Xcode
npm run mobile:android  # build + sync + open Android Studio
```

## Mobile UX differences

- **Bottom tab bar** on viewports under 768px and in native apps (Home, Calendar, Goals, Vibe Check, More).
- **Safe areas** — content clears the home indicator and notch via `mobile-app-shell` CSS.
- **Floating menu** remains on desktop-width browsers.

## Calendar on iOS

- **Google Calendar** — OAuth via Supabase (same as web); configure redirect URLs for your app scheme.
- **Apple Calendar** — EventKit plugin reads on-device calendars when the Swift plugin is installed.

Browser dev mock (no Xcode):

```js
localStorage.setItem('timebunny_mock_eventkit', '1')
// hard refresh
```

## OAuth on native

1. Add a custom URL scheme in Xcode / Android (e.g. `com.timebunny.app`).
2. Register the scheme redirect in Supabase Auth → Redirect URLs.
3. `NativeDeepLinkRouter` in `App.tsx` forwards `appUrlOpen` events into React Router.

## File checklist

- [ ] `capacitor.config.ts` — app id, webDir
- [ ] `npm run build:mobile` — relative asset paths for WebView
- [ ] iOS Info.plist calendar permissions
- [ ] Swift plugins copied + registered
- [ ] Supabase redirect URLs for native OAuth
