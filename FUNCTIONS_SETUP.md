# Firebase Functions and secure rollout

The `functions/` project keeps privileged Firebase Admin SDK operations off the browser. Never copy service-account credentials into this repository or `index.html`.

## First deployment

1. Install the Firebase CLI and authenticate:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use cawnnak-ca
   ```

2. Install function dependencies and check syntax:

   ```bash
   cd functions
   npm install
   npm run lint
   cd ..
   ```

3. Deploy in this order:

   ```bash
   firebase deploy --only functions
   firebase deploy --only firestore:rules,storage
   ```

4. Sign in as the existing administrator, then call `syncAuthUsers`. It backfills every Firebase Authentication account into `users/{uid}` and preserves existing `role`, `progress`, avatar, and achievement fields.

## Callable functions

All admin callables verify `users/{uid}.role == "admin"` on the server:

- `syncAuthUsers` — full Auth-to-Firestore backfill.
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

The scheduled backup placeholder intentionally does not export until `BACKUP_BUCKET` is configured in the Functions runtime and a tested Cloud Firestore export process is approved. Document the destination bucket, retention policy, and a restore test in a non-production project before enabling exports.

## Verification

- Test guest, learner, and admin accounts separately.
- Confirm a learner cannot list users, change roles, write `audit`, write `notifications`, or write `leaderboard`.
- Confirm `syncAuthUsers` includes dormant Auth accounts.
- Confirm the final administrator cannot be demoted or disabled.
- Confirm new Auth accounts receive a profile and registration notification.
- Test oversized/non-image avatar uploads and an emulator rules test before production.
