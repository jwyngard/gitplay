# Running Alumni Watch as an iOS App

This gets the app installed on your own iPhone via Xcode, for free, using
your regular Apple ID — no paid Apple Developer Program membership needed.
That's only required for App Store submission, TestFlight, or removing the
7-day expiry described below.

Everything here runs **on your Mac** (Xcode is Mac-only — this can't be
done from the cloud session that built the app).

## One-time setup on your Mac

1. Install Xcode from the Mac App Store, if you don't already have it.
2. Install CocoaPods (Capacitor's iOS builds depend on it):
   ```bash
   sudo gem install cocoapods
   ```
3. Clone this repo and install dependencies:
   ```bash
   git clone <this repo's URL>
   cd gitplay/web
   npm install
   ```

## Build and open the iOS project

```bash
npm run build:capacitor   # builds the web app pointed at the deployed API
npx cap add ios           # first time only -- generates the ios/ Xcode project
npx cap sync ios          # copies the build into the iOS project
npx cap open ios          # opens it in Xcode
```

`build:capacitor` (as opposed to the normal `npm run build`) matters: it
points the app at the deployed API (`https://alumni-watch-v1dg.onrender.com`)
instead of a relative path, since the packaged app has no same-origin
server to call — see `.env.capacitor` and `src/api.js`.

## Run it on your phone, in Xcode

1. Plug your iPhone into your Mac (or set up wireless debugging: Window →
   Devices and Simulators).
2. In Xcode's project navigator, select the **App** target, then the
   **Signing & Capabilities** tab.
3. Under **Team**, choose your personal Apple ID. If it's not listed,
   click "Add an Account..." and sign in — no paid enrollment needed for
   this.
4. Xcode may ask you to change the **Bundle Identifier**
   (`com.alumniwatch.app` in `capacitor.config.json`) if that exact one is
   already taken under your account — something like
   `com.<yourname>.alumniwatch` works fine.
5. In the toolbar, choose your iPhone as the run destination (instead of a
   simulator).
6. Click the Run button (▶).
7. First run only: on the iPhone, go to **Settings → General → VPN &
   Device Management**, and trust the developer certificate tied to your
   Apple ID.

The app installs and opens on your phone. On a free (non-paid) Apple ID,
it's valid for **7 days**, after which it just needs re-running from Xcode
(steps 5-6) to refresh — no rebuild needed unless the code changed.

## After a code change

```bash
git pull
npm run build:capacitor
npx cap sync ios
npx cap open ios   # if it isn't already open
```
Then Run (▶) again from Xcode.

## If you decide to actually ship this

The $99/year Apple Developer Program becomes necessary only when you want
to either distribute to other people (TestFlight or the App Store) or stop
re-running from Xcode every 7 days. Nothing about the setup above needs to
change to get there — you'd enroll, select the paid team instead of your
personal one in Signing & Capabilities, and the App Store submission
requirements from the earlier discussion (icon, launch screen, a bit more
than a bare WebView to satisfy review) apply from there.
