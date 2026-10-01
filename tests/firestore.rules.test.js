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
    await db.doc('content/published').set({ english: 'Hello', status: 'published' });
    await db.doc('content/draft').set({ english: 'Private', status: 'draft' });
  });
});

test.after(async () => { if (environment) await environment.cleanup(); });

test('public users can read published content but not drafts', { skip: !enabled }, async () => {
  const guest = environment.unauthenticatedContext().firestore();
  await assertSucceeds(guest.doc('content/published').get());
  await assertFails(guest.doc('content/draft').get());
});

test('learners cannot list users, promote themselves, or write audit records', { skip: !enabled }, async () => {
  const learner = environment.authenticatedContext('learner').firestore();
  await assertFails(learner.collection('users').get());
  await assertFails(learner.doc('users/learner').update({ role: 'admin' }));
  await assertFails(learner.collection('audit').add({ action: 'forged' }));
});

test('admins can read drafts and write content', { skip: !enabled }, async () => {
  const admin = environment.authenticatedContext('admin').firestore();
  await assertSucceeds(admin.doc('content/draft').get());
  await assertSucceeds(admin.doc('content/new').set({ english: 'New', status: 'draft' }));
});
