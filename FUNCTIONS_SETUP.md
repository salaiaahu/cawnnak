# Firebase Functions and secure rollout

The `functions/` project keeps privileged Firebase Admin SDK operations off the browser. Never copy service-account credentials into this repository or `index.html`.

## Hosting model

This project is hosted on **GitHub Pages**. Firebase Hosting is not used or
required. The static site connects to the `cawnnak-ca` Firebase project for
Authentication, Firestore, Cloud Storage, Cloud Functions, and optional FCM.

## One-time Firebase Console setup

Complete these steps in the Firebase console for `cawnnak-ca` before the first
deployment. Region choices for Firestore and the default Storage bucket are
long-lived, so choose the region closest to the app's users before continuing.

1. Upgrade the project to the Blaze plan. Cloud Functions (Gen 2), Cloud Build,
   Artifact Registry, Cloud Scheduler, and scheduled backups require billing to
   be enabled. Configure a budget alert while doing this.
2. In **Build → Firestore Database**, create the default Firestore database in
   production mode and choose its region.
3. In **Build → Storage**, click **Get started** and create the default bucket.
   Choose the appropriate bucket region.
4. In **Build → Authentication → Sign-in method**, enable Email/Password.
5. In **Project settings → Your apps**, confirm that the existing web app has
   `cawnnak-ca` in its configuration. Add the GitHub Pages domain to
   Authentication's authorized domains if Firebase does not list it already.

Do not enable Firebase Hosting: GitHub Pages remains the app host.

## First deployment

1. Install the Firebase CLI and authenticate. This repository's `.firebaserc`
   selects `cawnnak-ca` by default:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use cawnnak-ca
   ```

   Use Node.js 22 locally as well (`node --version` should report `v22.x`) so
   emulator and deployment behavior matches the Functions runtime.

2. Install function dependencies and check syntax:

   ```bash
   cd functions
   npm install
   npm run lint
   cd ..
   ```

3. Deploy Functions first, then the rules and indexes:

   ```bash
   firebase deploy --only functions
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

4. Sign in as the initial administrator, then call `syncAuthUsers`. For the
   first administrator, create the account in Firebase Authentication and set
   `users/{uid}.role` to `admin` in the Firestore console once. Thereafter use
   the app's secure role controls. `syncAuthUsers` backfills every Firebase
   Authentication account into `users/{uid}` and preserves existing `role`,
   `progress`, avatar, and achievement fields.

5. From an administrator session, call `migrateLegacyContent`. It marks every
   legacy `content` document without a status as `published`, preserves existing
   timestamps when present, and writes an audit entry. Only then remove the
   temporary legacy read compatibility from `firestore.rules`.

## Callable functions

All admin callables verify `users/{uid}.role == "admin"` on the server:

- `syncAuthUsers` — full Auth-to-Firestore backfill.
- `migrateLegacyContent()` — one-time migration that publishes legacy cards with no workflow status.
- `setUserRole({ uid, role })` — promotes/demotes a user; it refuses to demote the final admin.
- `setUserDisabled({ uid, disabled })` — disables/re-enables Auth accounts; it refuses to disable the final admin.
- `submitQuizResult({ answers })` — calculates a score from Firestore content before updating the public leaderboard.

The browser must call these using the Firebase Functions Web SDK; it must not write roles, account state, audits, or leaderboard scores directly.

## Data migration before stricter content workflow

Existing content has no `status`. The supplied Firestore rule treats missing status as published temporarily. Before removing that compatibility rule, migrate every content document to one of `draft`, `review`, `published`, or `archived`, typically `published` for current learning material.

## Cloud Storage avatars

Avatar uploads belong at `avatars/{uid}/{fileName}`. The Storage rules accept only signed-in owner uploads, image MIME types, and files below 2 MiB. Store `avatarPath` and a download URL in the user profile; never store image data URLs in Firestore.

## Notifications and audits

Auth account creation creates the profile and an admin-targeted registration notification. Cloud Functions also write append-only audit records for content, profiles, notifications, role changes, and account-state changes. History starts at deployment; prior browser-side edits cannot be reconstructed.

## App Check, messaging, and backups

Before production, enable App Check for the web app and enforce it on callable Functions after testing. Configure Firebase Cloud Messaging in the service worker before requesting notification permission.

The scheduled `exportFirestoreBackup` function intentionally does not export until `BACKUP_BUCKET` is configured in the Functions runtime as a `gs://bucket-name` value. It starts a native Firestore export under `gs://bucket-name/firestore/YYYY-MM-DD` and records the long-running operation in `operations/lastFirestoreExport`.

Before enabling it in production:

1. Create a dedicated, access-controlled backup bucket and lifecycle/retention policy.
2. Grant the Functions runtime service account permission to write to that bucket.
3. Set `BACKUP_BUCKET` using your approved Cloud Functions environment-configuration process.
4. In a separate non-production Firebase project, restore a copy with the Google Cloud Firestore import operation, validate users/content/audit records, then delete the test data.
5. Record the tested restore date, source export path, and operator in your operational runbook.

## Verification

- Test guest, learner, and admin accounts separately.
- Confirm a learner cannot list users, change roles, write `audit`, write `notifications`, or write `leaderboard`.
- Confirm `syncAuthUsers` includes dormant Auth accounts.
- Confirm the final administrator cannot be demoted or disabled.
- Confirm new Auth accounts receive a profile and registration notification.
- Test oversized/non-image avatar uploads and an emulator rules test before production.
