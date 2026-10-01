# Mirang Holh Cawnnak

A mobile- and desktop-friendly Chin language-learning app. Learners can choose a topic, study phrase cards, hear English pronunciation, take a multiple-choice quiz, and keep progress either as a guest or in a Firebase account.

## Ownership and stewardship

- Project owner / maintainer: **salaiaahu** (`salaiaahu@gmail.com`), based on repository commit history.
- Firebase project: **cawnnak-ca**.
- Content ownership: the project owner is responsible for translation accuracy, permissions, and maintenance of learning material.
- Admin access: only trusted maintainers should receive `role: "admin"` in their Firestore profile.

Do not commit service-account keys, private credentials, or administrator passwords. Firebase Web configuration is public client configuration; Firebase Authentication and Firestore rules enforce access control.

## Current progress

Implemented:

- Responsive single-column mobile cards and multi-column desktop cards.
- Searchable phrase list with all **54** original phrases.
- Browser text-to-speech, randomized ten-question quiz, and saved guest progress.
- Correct/wrong sounds, vibration where supported, answer states, retry prompt, fanfare, confetti, and completion popup.
- Email/password login and Firestore progress sync.
- Admin-only Firebase content publishing for English, Chin, category, and quiz inclusion fields.
- Firestore rules for public content reading, owner-only user data, and admin-only content writing.
- Installable Progressive Web App: manifest, branded icon, install prompt, iPhone/iPad instructions, and offline app-shell caching.
- Topic-based learning and testing, with category dropdowns that include built-in categories and any category found in Firebase content.
- Admin editing for both existing starter phrases and Firebase-published phrases.
- Firebase Functions foundation for server-side role/account management, Auth user backfill, registration notifications, audit records, and validated quiz-score submission.
- Firestore and Storage rules that reserve roles, account state, audits, notifications, leaderboard writes, and avatar paths for trusted server-side workflows.

The included non-driving Hakha Chin starter phrases are draft learning material assembled from public Hakha phrase references. A fluent Hakha Chin speaker should review them before they are treated as final course content.

Before production launch:

- Deploy Functions, Firestore rules, and Storage rules following [FUNCTIONS_SETUP.md](FUNCTIONS_SETUP.md), then backfill Auth users.
- Add `localhost` for development and the production domain under Firebase Auth authorized domains.
- Create the first administrator and add `role: "admin"` to `users/{uid}` before calling `syncAuthUsers`.
- Publish the final content collection, test account/content workflows, and test installation on Android, iOS, and desktop browsers.

## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Responsive app, Firebase integration, quiz, progress, effects, and PWA registration. |
| `Cawnnak.html` | Legacy version retained as the original phrase-content reference. |
| `firestore.rules` | Firestore access rules. |
| `storage.rules` | Avatar upload access rules. |
| `firebase.json` | Firebase deployment configuration. |
| `functions/` | Server-side Admin SDK callables, Auth handling, audits, and scheduled operations. |
| `FIREBASE_SETUP.md` | Firebase and administrator setup guide. |
| `FUNCTIONS_SETUP.md` | Functions deployment, migration, and security rollout guide. |
| `FIREBASE_SECURITY_SETUP.md` | App Check and Web Push/FCM configuration guide. |
| `firebase-security-config.js` | Public App Check/VAPID browser configuration placeholders. |
| `manifest.json` | PWA install metadata. |
| `service-worker.js` | App-shell cache and offline fallback. |
| `icons/icon.svg` | Install icon. |

## Run locally

Serve the folder over HTTP; do not open the file directly:

```bash
cd "/Volumes/USB DISK/Projects/cawnnak"
python3 -m http.server 8080
```

Open `http://localhost:8080`. For real sign-in and progress syncing, complete [FIREBASE_SETUP.md](FIREBASE_SETUP.md).

## Install on a phone

- **Android / Chrome:** open the site via HTTPS (or `localhost` during development), then use the visible **Install app** button when it appears.
- **iPhone / iPad / Safari:** open the site via HTTPS, tap **Share**, then select **Add to Home Screen**.

An installed app opens in its own window and preserves the local app shell for offline access. Firebase sign-in and cloud syncing still need an internet connection.

## Firebase data model

`content/{contentId}`:

```js
{ english: "Open the door", chin: "Innka Ong", category: "Driving", quiz: true, createdAt: serverTimestamp() }
```

`users/{uid}`:

```js
{ role: "admin", progress: { studied: ["content-card-id"], bestScore: 90 }, updatedAt: serverTimestamp() }
```

## Admin workflow

1. Create or sign in to the intended administrator account.
2. In Firestore, set `role: "admin"` on `users/{uid}`.
3. Reload the site; the **Admin** link appears.
4. Publish content in **Content manager**.

Published Firebase cards replace the built-in starter collection whenever the `content` collection is non-empty.
