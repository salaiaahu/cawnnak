# Firebase setup

1. Create a Firebase Web app, enable Email/Password authentication and Firestore.
2. Paste the Web app config into firebaseConfig in index.html.
3. Create an account and set role: "admin" on its users/UID Firestore document.
4. Follow [FUNCTIONS_SETUP.md](FUNCTIONS_SETUP.md) to deploy Functions, Firestore rules, and Storage rules, then run the Auth-user backfill from the secure admin workflow.

Admins can publish content. Guests store progress locally; signed-in users synchronize permitted progress fields to users/UID. Roles, account disabling, audit history, notifications, validated leaderboard scores, and avatar paths are server-managed.
