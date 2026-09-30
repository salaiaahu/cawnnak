# Firebase setup

1. Create a Firebase Web app, enable Email/Password authentication and Firestore.
2. Paste the Web app config into firebaseConfig in index.html.
3. Deploy firestore.rules using firebase deploy --only firestore:rules.
4. Create an account and set role: "admin" on its users/UID Firestore document.

Admins can publish content. Guests store progress locally; signed-in users synchronize it to users/UID.
