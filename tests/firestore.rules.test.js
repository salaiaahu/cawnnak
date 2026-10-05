const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment;

test.before(async () => {
  if (!enabled) return;
  environment = await initializeTestEnvironment({
    projectId: 'cawnnak-rules-test',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') }
  });
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await db.doc('users/admin').set({ role: 'admin', disabled: false });
    await db.doc('users/learner').set({ role: 'user', disabled: false });
    await db.doc('users/editor').set({ role: 'editor', disabled: false });
    await db.doc('content/published').set({ english: 'Hello', status: 'published' });
    await db.doc('content/draft').set({ english: 'Private', status: 'draft' });
    await db.doc('content/legacy').set({ english: 'Existing card' });
    await db.doc('notifications/learner-note').set({ targetUid: 'learner', readBy: {} });
    await db.doc('notifications/admin-note').set({ targetUid: 'admins', readBy: {} });
  });
});

test.after(async () => { if (environment) await environment.cleanup(); });

test('public users can read published content but not drafts', { skip: !enabled }, async () => {
  const guest = environment.unauthenticatedContext().firestore();
  await assertSucceeds(guest.doc('content/published').get());
  await assertSucceeds(guest.doc('content/legacy').get());
  await assertFails(guest.doc('content/draft').get());
  await assertSucceeds(guest.collection('content').where('status', '==', 'published').get());
});

test('learners cannot list users, promote themselves, or write audit records', { skip: !enabled }, async () => {
  const learner = environment.authenticatedContext('learner').firestore();
  await assertFails(learner.collection('users').get());
  await assertFails(learner.doc('users/learner').update({ role: 'admin' }));
  await assertFails(learner.collection('audit').add({ action: 'forged' }));
  await assertFails(learner.doc('leaderboard/learner').set({ bestScore: 100 }));
});

test('learners can save permitted progress but cannot alter account-sensitive fields', { skip: !enabled }, async () => {
  const learner = environment.authenticatedContext('learner').firestore();
  await assertSucceeds(learner.doc('users/learner').update({
    progress: { studied: ['published'] },
    achievementSummary: { studied: 1 },
    updatedAt: new Date()
  }));
  await assertFails(learner.doc('users/learner').update({ disabled: true }));
  await assertFails(learner.doc('users/learner').update({ avatarPath: 'avatars/other-user/image.jpg' }));
  await assertSucceeds(learner.doc('users/learner').update({ avatarPath: 'avatars/learner/image.jpg' }));
});

test('users and editors can update their own profile fields', { skip: !enabled }, async () => {
  const learner = environment.authenticatedContext('learner', { email: 'learner@example.com' }).firestore();
  await assertSucceeds(learner.doc('users/learner').update({
    displayName: 'Learner Name',
    avatar: 'data:image/jpeg;base64,profile',
    achievementBadge: 'Dedicated learner',
    email: 'learner@example.com',
    updatedAt: new Date()
  }));
  await assertFails(learner.doc('users/learner').update({ role: 'editor' }));

  const editor = environment.authenticatedContext('editor', { email: 'editor@example.com' }).firestore();
  await assertSucceeds(editor.doc('users/editor').update({
    displayName: 'Editor Name',
    photoURL: 'https://example.com/profile.jpg',
    updatedAt: new Date()
  }));
  await assertFails(editor.doc('users/editor').update({ disabled: true }));
});

test('learners can read and acknowledge only their own notifications', { skip: !enabled }, async () => {
  const learner = environment.authenticatedContext('learner').firestore();
  await assertSucceeds(learner.doc('notifications/learner-note').get());
  await assertFails(learner.doc('notifications/admin-note').get());
  await assertSucceeds(learner.doc('notifications/learner-note').update({ readBy: { learner: true } }));
  await assertFails(learner.doc('notifications/learner-note').update({ targetUid: 'admin' }));
});

test('admins can read drafts and write content', { skip: !enabled }, async () => {
  const admin = environment.authenticatedContext('admin').firestore();
  await assertSucceeds(admin.doc('content/draft').get());
  await assertSucceeds(admin.doc('content/new').set({ english: 'New', status: 'draft' }));
});
