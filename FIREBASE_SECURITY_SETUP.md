# App Check and Web Push setup

These steps require access to the Firebase Console for `cawnnak-ca` and cannot be completed from source code alone.

## App Check

1. In Firebase Console, open **App Check** and register the web app.
2. Use reCAPTCHA Enterprise or reCAPTCHA v3 as selected by Firebase.
3. Copy the public site key. Do not use a reCAPTCHA secret key in the browser.
4. Replace the placeholders in the checked-in `firebase-security-config.js` beside `index.html` (or copy the example first if recreating the file):

   ```js
   window.CAWNNAK_FIREBASE_SECURITY = {
     appCheckSiteKey: 'YOUR_PUBLIC_RECAPTCHA_SITE_KEY',
     vapidKey: 'YOUR_PUBLIC_WEB_PUSH_VAPID_KEY'
   };
   ```

5. Add the file to the deployment environment, but never commit secret keys. The site key and VAPID public key are allowed in browser code.
6. Test App Check metrics first. Enforce App Check on callable Functions only after valid traffic is visible.

## Firebase Cloud Messaging

1. In Firebase Console, open **Project settings → Cloud Messaging → Web configuration**.
2. Generate a Web Push certificate key pair and copy the public VAPID key.
3. Add it to the local configuration above.
4. `index.html` already loads `firebase-security-config.js` before `firebase-security.js`; commit only public site/VAPID keys, never a secret key.
5. Sign in, grant notification permission, and verify a token is registered by the `registerFcmToken` callable.
6. Send a test notification from Firebase Console. The app service worker displays background notifications; foreground notifications are displayed by the app.

## Privacy and rollout

- Request notification permission only after the learner has signed in and opted in.
- Remove stale tokens after FCM send failures.
- Do not store browser notification permission or tokens in public collections.
- Test iOS Safari, Android Chrome, and desktop Chrome separately; browser capabilities differ.

## Error monitoring

`error-monitor.js` reports unhandled browser errors only when `window.CAWNNAK_ERROR_MONITOR.endpoint` is defined. Point it at an approved monitoring collector (for example, a Sentry tunnel or your own authenticated endpoint); do not send passwords, tokens, or full profile data. Configure alerting and retention in that monitoring service.
