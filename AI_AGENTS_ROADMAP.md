# Mirang Holh Cawnnak — AI Agent Handoff

This is the continuation note for an AI agent working from a machine with Firebase CLI, Firebase Admin SDK, and Cloud Functions configured.

## Scope

Implement all roadmap items below except accessibility improvements. The app is currently a static GitHub Pages client with Firebase Web SDK code embedded in `index.html`; there is no Functions project yet. Never place Admin SDK credentials in the browser or repository.

## Implementation status — October 1, 2026

Completed in the current pass:

- Added the Functions project, Firebase deployment configuration, Storage rules, and secure Firestore rules.
- Added Admin SDK profile creation, Auth-to-Firestore backfill, protected role/account callables, final-admin protection, server-side audit triggers, registration notifications, server-side quiz scoring, and callable rate limits.
- Switched the admin User management entry point to call the server-side Auth sync before loading profiles; role changes use the callable endpoint.
- Added realtime notification-document handling and Storage-backed avatar update/delete handling in the browser.
- Added deployment, migration, and verification documentation in `FUNCTIONS_SETUP.md`.
- Added an admin audit-history UI with newest-first paging and action, administrator UID, and date filters; included Firestore index definitions.
- Added content status metadata (`draft`, `review`, `published`, `archived`), attribution, publish timestamps, and duplicate phrase checks to the admin save workflow.
- Added admin content filters, bulk publish/archive actions, CSV export, and validated CSV import previews.
- Connected signed-in quiz completion to the server-side score validator; validated scores now overwrite client-calculated leaderboard values after deployment.
- Added guest- and learner-friendly daily goals, consecutive-day streaks, saved phrases, category study counts, and missed-question review tools.
- Added User Management controls for disabling and re-enabling accounts through the protected server-side callable.
- Added queued, conflict-safe merging for the new learning-progress state, Firebase App Check/FCM client scaffolding, generic push notification handling, a native scheduled Firestore-export implementation, and emulator-rule test scaffolding.
- Added calculated achievement summaries, milestone badges, and a shareable/downloadable achievement-card image for learners.
- Installed the Functions dependencies with Node 22 and passed the local Auth, Firestore, and Storage Emulator rule suite.

Still requires Firebase deployment/configuration and follow-up product work:

- Configure FCM Web Push/VAPID and App Check in the Firebase console, then add the generated messaging configuration.
- Deploy rules/functions, run the Auth backfill, and migrate legacy content to workflow statuses before removing legacy content-read compatibility.
- Replace remaining legacy appended client handlers in `index.html` with a single maintained module, expand the Emulator test suite, and perform a non-production backup/restore test.

Before substantial edits, consolidate the duplicated appended auth/navigation/menu blocks in `index.html`. The current file has multiple listeners and dynamic UI patches from earlier iterations; retain behavior but reduce duplicate handlers.

## Backend foundation (required first)

Create a Node.js Firebase Functions project under `functions/`, add root `firebase.json`, and use the Firebase Admin SDK. Add a server-side `isAdmin(uid)` helper based on `users/{uid}.role === "admin"`.

Implement an admin-only callable `syncAuthUsers` that pages through every Firebase Auth user and upserts `users/{uid}` with `email`, `displayName`, Auth `creationTime`, `lastSignInAt`, `disabled`, `syncedAt`, and a default `role: "user"` while preserving existing admin roles, progress, avatars, and achievement data. The admin User management screen must call this before loading the collection.

Add Auth-created handling so every new account gets a Firestore profile immediately. Add callable admin operations to promote/demote roles and disable/re-enable users. Prevent removing the final administrator. Do not expose Admin SDK operations to the browser.

## Notifications and FCM

Use `notifications/{id}` documents rather than client polling as the source of truth:

```js
{ type, title, body, targetUid, actorUid, actorEmail, entityId, createdAt, readBy: { uid: true } }
```

Create admin notifications when users register; optionally create notifications for role/content changes. The bell shows unread count, opens a panel, shows an empty state when there are no unread items, and only opens User management when a registration notification is clicked. Add FCM token registration, push permission handling, and service-worker push handling after Firebase Messaging is configured.

## Authoritative audit history

Use server-side Firestore/Auth triggers for `audit/{id}` records. Record content create/update/delete, role changes, account disable/enable, profile updates, and notification creation. Store action, entity type/id, sanitized before/after snapshots, actor UID/email, and `createdAt`. Never store passwords or tokens. Admin-only reads; deny arbitrary client audit writes after triggers are deployed.

Update History UI to query newest-first with pagination and filters by action, administrator, and date. Existing changes cannot be reconstructed; history starts when server logging is deployed.

## Profiles, avatars, achievements

Use `users/{uid}` fields: `email`, `displayName`, `photoURL`, `avatarPath`, `role`, `createdAt`, `lastSignInAt`, `progress`, `achievementSummary`, and `updatedAt`. Move avatar storage from Firestore data URLs to Firebase Storage; validate MIME type/size and store only the Storage path/download URL in Firestore. Add avatar delete/update.

Calculate badges from studied phrases, quiz scores, streaks, and category completion. Store an achievement summary/history. Generate a shareable achievement card image with a Web Share API/download fallback.

## Learning features

Add daily goals, consecutive-day streaks, spaced-repetition/review queues, favorites, missed-question review, category progress, offline cache, queued writes, and conflict-safe progress merges. Validate public leaderboard scores server-side instead of trusting arbitrary client scores.

## Content workflow

Extend `content/{id}` with `status: draft|review|published|archived`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, and `publishedAt`. Add draft/review/publish/archive controls, reviewer attribution, duplicate phrase detection, CSV import/export with validation and dry-run preview, bulk archive/edit, filters, and audit entries for every transition.

## Security and operations

Strengthen Firestore and Storage rules so regular users can only update permitted fields on their own profile. They must never change roles, disabled status, audit data, notification ownership, or server timestamps. Admin reads must be explicit. Add Firebase App Check, Storage avatar rules, input length/type validation, callable-function rate limits/idempotency, error monitoring, scheduled Firestore/Auth exports to a designated backup bucket, and a documented restore procedure.

## Recommended order

1. Consolidate duplicate client handlers.
2. Add/deploy Functions and Admin SDK authorization.
3. Backfill all Auth users into Firestore.
4. Add secure role/account controls and rules.
5. Add authoritative audit triggers and paginated History UI.
6. Add notification documents, unread/read state, and FCM.
7. Move avatars to Storage and finish achievement sharing.
8. Add learning goals, streaks, review, favorites, and progress analytics.
9. Add content workflow, CSV tools, duplicate detection, and bulk operations.
10. Add App Check, backups, monitoring, and automated tests.

## Verification checklist

- Test guest, regular, and admin sessions separately.
- Confirm regular users cannot list users, change roles, write audits, or read private profiles.
- Confirm admin sync shows every Auth email and registration date, including dormant accounts.
- Confirm the final admin cannot remove the final admin role.
- Create/edit/archive/publish content and verify audit entries.
- Register a user and verify in-app and optional push notifications.
- Test invalid/oversized avatar rejection.
- Test offline progress and reconnect merges.
- Test backup restore in a non-production Firebase project.
