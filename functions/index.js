const admin = require('firebase-admin');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const functionsV1 = require('firebase-functions/v1');

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const PROFILE_FIELDS = new Set([
  'email', 'displayName', 'photoURL', 'avatarPath', 'avatarURL', 'role', 'disabled',
  'createdAt', 'lastSignInAt', 'progress', 'achievementSummary', 'updatedAt', 'syncedAt'
]);

function clean(value, depth = 0) {
  if (depth > 4 || value === undefined) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (value instanceof Timestamp || value instanceof Date) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => clean(item, depth + 1)).filter(item => item !== undefined);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/password|token|secret|credential/i.test(key))
      .slice(0, 60)
      .map(([key, item]) => [key, clean(item, depth + 1)])
      .filter(([, item]) => item !== undefined));
  }
  return String(value).slice(0, 500);
}

async function isAdmin(uid) {
  if (!uid) return false;
  const profile = await db.doc(`users/${uid}`).get();
  return profile.exists && profile.get('role') === 'admin' && profile.get('disabled') !== true;
}

async function requireAdmin(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required.');
  if (!(await isAdmin(request.auth.uid))) throw new HttpsError('permission-denied', 'Administrator access is required.');
  return request.auth;
}

function validUid(uid) {
  if (typeof uid !== 'string' || !uid.trim()) throw new HttpsError('invalid-argument', 'A valid user id is required.');
  return uid.trim();
}

async function writeAudit({ action, entityType, entityId, before = null, after = null, actorUid = null, actorEmail = null }) {
  await db.collection('audit').add({
    action,
    entityType,
    entityId,
    before: clean(before),
    after: clean(after),
    actorUid,
    actorEmail,
    createdAt: FieldValue.serverTimestamp()
  });
}

async function adminsRemaining() {
  const snapshot = await db.collection('users').where('role', '==', 'admin').limit(2).get();
  return snapshot.size;
}

async function ensureRateLimit(uid, operation, limit = 10, windowMs = 60_000) {
  const ref = db.doc(`functionRateLimits/${uid}_${operation}`);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const now = Date.now();
    const state = snapshot.exists ? snapshot.data() : {};
    const startedAt = state.startedAt?.toMillis?.() || 0;
    const count = startedAt && now - startedAt < windowMs ? (state.count || 0) : 0;
    if (count >= limit) throw new HttpsError('resource-exhausted', 'Too many requests. Please try again shortly.');
    transaction.set(ref, {
      count: count + 1,
      startedAt: count ? state.startedAt : Timestamp.now(),
      expiresAt: Timestamp.fromMillis(now + windowMs)
    }, { merge: true });
  });
}

exports.onAuthUserCreated = functionsV1.auth.user().onCreate(async user => {
  const profileRef = db.doc(`users/${user.uid}`);
  const existing = await profileRef.get();
  const old = existing.exists ? existing.data() : {};
  await profileRef.set({
    email: user.email || old.email || '',
    displayName: user.displayName || old.displayName || '',
    photoURL: user.photoURL || old.photoURL || '',
    role: old.role || 'user',
    disabled: Boolean(user.disabled),
    createdAt: old.createdAt || Timestamp.fromDate(new Date(user.metadata.creationTime)),
    lastSignInAt: user.metadata.lastSignInTime ? Timestamp.fromDate(new Date(user.metadata.lastSignInTime)) : null,
    updatedAt: FieldValue.serverTimestamp(),
    syncedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await db.collection('notifications').add({
    type: 'registration',
    title: 'New learner registered',
    body: user.email || 'A new learner created an account.',
    targetUid: 'admins',
    actorUid: user.uid,
    actorEmail: user.email || '',
    entityId: user.uid,
    createdAt: FieldValue.serverTimestamp(),
    readBy: {}
  });
});

exports.syncAuthUsers = onCall({ timeoutSeconds: 540, memory: '512MiB' }, async request => {
  const actor = await requireAdmin(request);
  await ensureRateLimit(actor.uid, 'syncAuthUsers', 2, 10 * 60_000);
  let pageToken;
  let synced = 0;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (let start = 0; start < page.users.length; start += 250) {
      const users = page.users.slice(start, start + 250);
      const refs = users.map(user => db.doc(`users/${user.uid}`));
      const profiles = await db.getAll(...refs);
      const batch = db.batch();
      users.forEach((authUser, index) => {
        const old = profiles[index].exists ? profiles[index].data() : {};
        batch.set(refs[index], {
          email: authUser.email || old.email || '',
          displayName: authUser.displayName || old.displayName || '',
          photoURL: authUser.photoURL || old.photoURL || '',
          disabled: Boolean(authUser.disabled),
          role: old.role || 'user',
          createdAt: old.createdAt || Timestamp.fromDate(new Date(authUser.metadata.creationTime)),
          lastSignInAt: authUser.metadata.lastSignInTime ? Timestamp.fromDate(new Date(authUser.metadata.lastSignInTime)) : old.lastSignInAt || null,
          syncedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      });
      await batch.commit();
      synced += users.length;
    }
    pageToken = page.pageToken;
  } while (pageToken);
  await writeAudit({ action: 'auth.sync', entityType: 'users', entityId: 'all', actorUid: actor.uid, actorEmail: actor.token.email || null, after: { synced } });
  return { synced };
});

exports.setUserRole = onCall(async request => {
  const actor = await requireAdmin(request);
  await ensureRateLimit(actor.uid, 'setUserRole');
  const uid = validUid(request.data?.uid);
  const role = request.data?.role;
  if (!['admin', 'user'].includes(role)) throw new HttpsError('invalid-argument', 'Role must be admin or user.');
  const target = await db.doc(`users/${uid}`).get();
  if (!target.exists) throw new HttpsError('not-found', 'User profile was not found.');
  const before = target.data();
  if (before.role === role) return { uid, role, unchanged: true };
  if (before.role === 'admin' && role !== 'admin' && await adminsRemaining() <= 1) {
    throw new HttpsError('failed-precondition', 'The final administrator cannot be demoted.');
  }
  await target.ref.set({ role, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });
  await writeAudit({ action: 'role.change', entityType: 'user', entityId: uid, before: { role: before.role }, after: { role }, actorUid: actor.uid, actorEmail: actor.token.email || null });
  return { uid, role };
});

exports.setUserDisabled = onCall(async request => {
  const actor = await requireAdmin(request);
  await ensureRateLimit(actor.uid, 'setUserDisabled');
  const uid = validUid(request.data?.uid);
  const disabled = Boolean(request.data?.disabled);
  const target = await db.doc(`users/${uid}`).get();
  if (!target.exists) throw new HttpsError('not-found', 'User profile was not found.');
  const before = target.data();
  if (before.role === 'admin' && disabled && await adminsRemaining() <= 1) {
    throw new HttpsError('failed-precondition', 'The final administrator cannot be disabled.');
  }
  await auth.updateUser(uid, { disabled });
  await target.ref.set({ disabled, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });
  await writeAudit({ action: disabled ? 'account.disable' : 'account.enable', entityType: 'user', entityId: uid, before: { disabled: before.disabled === true }, after: { disabled }, actorUid: actor.uid, actorEmail: actor.token.email || null });
  return { uid, disabled };
});

exports.submitQuizResult = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required to submit a leaderboard score.');
  await ensureRateLimit(request.auth.uid, 'submitQuizResult', 30, 60_000);
  const answers = Array.isArray(request.data?.answers) ? request.data.answers.slice(0, 20) : [];
  if (!answers.length) throw new HttpsError('invalid-argument', 'Answers are required.');
  const ids = [...new Set(answers.map(answer => answer?.contentId).filter(id => typeof id === 'string'))];
  const docs = await db.getAll(...ids.map(id => db.doc(`content/${id}`)));
  const answerMap = new Map(answers.map(answer => [answer.contentId, String(answer.answer || '')]));
  let correct = 0;
  docs.forEach(snapshot => { if (snapshot.exists && snapshot.get('chin') === answerMap.get(snapshot.id)) correct += 1; });
  const score = Math.round((correct / ids.length) * 100);
  const profile = await db.doc(`users/${request.auth.uid}`).get();
  const oldBest = Number(profile.get('progress.bestScore') || 0);
  await db.doc(`users/${request.auth.uid}`).set({
    progress: { bestScore: Math.max(oldBest, score), lastQuizAt: FieldValue.serverTimestamp() },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await db.doc(`leaderboard/${request.auth.uid}`).set({
    name: profile.get('displayName') || request.auth.token.email?.split('@')[0] || 'Learner',
    bestScore: Math.max(oldBest, score),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { score, correct, total: ids.length };
});

exports.auditContent = onDocumentWritten('content/{contentId}', async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const action = !before ? 'content.create' : !after ? 'content.delete' : 'content.update';
  await writeAudit({ action, entityType: 'content', entityId: event.params.contentId, before, after, actorUid: event.authId || after?.updatedBy || before?.updatedBy || null });
});

exports.auditUserProfile = onDocumentWritten('users/{uid}', async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!before || !after) return;
  const changed = Object.keys(after).filter(key => JSON.stringify(clean(after[key])) !== JSON.stringify(clean(before[key])));
  if (!changed.length) return;
  await writeAudit({ action: 'profile.update', entityType: 'user', entityId: event.params.uid, before: Object.fromEntries(changed.map(key => [key, before[key]])), after: Object.fromEntries(changed.map(key => [key, after[key]])), actorUid: event.authId || after.updatedBy || event.params.uid });
});

exports.auditNotification = onDocumentCreated('notifications/{id}', async event => {
  await writeAudit({ action: 'notification.create', entityType: 'notification', entityId: event.params.id, after: event.data.data(), actorUid: event.data.get('actorUid') || null, actorEmail: event.data.get('actorEmail') || null });
});

// Configure BACKUP_BUCKET as a Firebase runtime environment value before enabling this job.
exports.backupReminder = onSchedule('every day 03:15', async () => {
  const bucket = process.env.BACKUP_BUCKET;
  if (!bucket) {
    console.warn('BACKUP_BUCKET is not configured; no export was started.');
    return;
  }
  await db.collection('operations').doc('lastBackupReminder').set({ requestedAt: FieldValue.serverTimestamp(), bucket }, { merge: true });
});
