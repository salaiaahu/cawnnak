const admin = require('firebase-admin');
const { HttpsError, onCall, onRequest } = require('firebase-functions/v2/https');
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const functionsV1 = require('firebase-functions/v1');
const { google } = require('googleapis');

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

async function writeAudit({ action, entityType, entityId, before = null, after = null, actorUid = null, actorEmail = null, actorName = null }) {
  await db.collection('audit').add({
    action,
    entityType,
    entityId,
    before: clean(before),
    after: clean(after),
    actorUid,
    actorEmail,
    actorName,
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

function dailyIndex(length) {
  const date = new Date().toISOString().slice(0, 10);
  let value = 2166136261;
  for (const character of date) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) % length;
}

// A public, read-only endpoint. It deliberately returns only one learner-visible
// phrase, never drafts/review/archived content or the full content collection.
exports.getDailyPhrase = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  try {
    const snapshot = await db.collection('content').get();
    const phrases = snapshot.docs.map(card => card.data())
      .filter(card => (!Object.prototype.hasOwnProperty.call(card, 'status') || card.status === 'published') && typeof card.english === 'string' && card.english.trim())
      .sort((left, right) => left.english.localeCompare(right.english));
    if (!phrases.length) return response.status(404).json({ error: 'No learner-visible phrases are available.' });
    const phrase = phrases[dailyIndex(phrases.length)];
    response.set('Cache-Control', 'no-store, max-age=0');
    return response.json({ english: phrase.english, chin: phrase.chin || '', category: phrase.category || '' });
  } catch (error) {
    console.error('Could not select daily phrase', error);
    return response.status(500).json({ error: 'Daily phrase is unavailable.' });
  }
});

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
  await writeAudit({ action: 'auth.sync', entityType: 'users', entityId: 'all', actorUid: actor.uid, actorEmail: actor.token.email || null, actorName: actor.token.name || null, after: { synced } });
  return { synced };
});

// One-time workflow migration for pre-status content. It intentionally publishes
// existing cards so learners retain access after status-aware security rules deploy.
exports.migrateLegacyContent = onCall({ timeoutSeconds: 540, memory: '512MiB' }, async request => {
  const actor = await requireAdmin(request);
  await ensureRateLimit(actor.uid, 'migrateLegacyContent', 1, 5 * 60_000);
  const snapshot = await db.collection('content').get();
  if (snapshot.size > 2000) {
    throw new HttpsError('failed-precondition', 'More than 2,000 content cards require a paginated migration.');
  }
  const legacy = snapshot.docs.filter(card => !Object.prototype.hasOwnProperty.call(card.data(), 'status'));
  for (let start = 0; start < legacy.length; start += 400) {
    const batch = db.batch();
    legacy.slice(start, start + 400).forEach(card => {
      const data = card.data();
      batch.set(card.ref, {
        status: 'published',
        createdAt: data.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        publishedAt: data.publishedAt || FieldValue.serverTimestamp(),
        migratedBy: actor.uid
      }, { merge: true });
    });
    await batch.commit();
  }
  await writeAudit({
    action: 'content.migrate_legacy', entityType: 'content', entityId: 'legacy',
    after: { migrated: legacy.length, status: 'published' }, actorUid: actor.uid, actorEmail: actor.token.email || null, actorName: actor.token.name || null
  });
  return { scanned: snapshot.size, migrated: legacy.length };
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
  await writeAudit({ action: 'role.change', entityType: 'user', entityId: uid, before: { role: before.role }, after: { role }, actorUid: actor.uid, actorEmail: actor.token.email || null, actorName: actor.token.name || null });
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
  await writeAudit({ action: disabled ? 'account.disable' : 'account.enable', entityType: 'user', entityId: uid, before: { disabled: before.disabled === true }, after: { disabled }, actorUid: actor.uid, actorEmail: actor.token.email || null, actorName: actor.token.name || null });
  return { uid, disabled };
});

exports.submitQuizResult = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required to submit a leaderboard score.');
  await ensureRateLimit(request.auth.uid, 'submitQuizResult', 30, 60_000);
  const answers = Array.isArray(request.data?.answers) ? request.data.answers.slice(0, 20) : [];
  if (!answers.length) throw new HttpsError('invalid-argument', 'Answers are required.');
  const ids = [...new Set(answers.map(answer => answer?.contentId).filter(id => typeof id === 'string'))];
  const directDocs = ids.length ? await db.getAll(...ids.map(id => db.doc(`content/${id}`))) : [];
  const byEnglish = new Map();
  for (const answer of answers.filter(answer => !answer?.contentId && typeof answer?.english === 'string')) {
    if (byEnglish.has(answer.english)) continue;
    const matches = await db.collection('content').where('english', '==', answer.english).limit(1).get();
    if (!matches.empty) byEnglish.set(answer.english, matches.docs[0]);
  }
  const docs = [...directDocs, ...byEnglish.values()];
  const answerMap = new Map(answers.map(answer => [answer.contentId || answer.english, String(answer.answer || '')]));
  let correct = 0;
  docs.forEach(snapshot => {
    const submitted = answerMap.get(snapshot.id) || answerMap.get(snapshot.get('english'));
    if (snapshot.exists && snapshot.get('chin') === submitted) correct += 1;
  });
  const total = docs.length;
  if (!total) throw new HttpsError('invalid-argument', 'No valid quiz content was submitted.');
  const score = Math.round((correct / total) * 100);
  const profileRef = db.doc(`users/${request.auth.uid}`);
  const leaderboardRef = db.doc(`leaderboard/${request.auth.uid}`);
  let totalPoints = 0;
  await db.runTransaction(async transaction => {
    const profile = await transaction.get(profileRef);
    const currentProgress = profile.get('progress') || {};
    const oldBest = Number(currentProgress.bestScore || 0);
    const oldTotalPoints = Math.max(0, Number(currentProgress.totalPoints || 0));
    totalPoints = oldTotalPoints + correct;
    const nextProgress = {
      ...currentProgress,
      bestScore: Math.max(oldBest, score),
      totalPoints,
      lastQuizAt: FieldValue.serverTimestamp()
    };
    transaction.set(profileRef, {
      progress: nextProgress,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(leaderboardRef, {
      name: profile.get('displayName') || request.auth.token.email?.split('@')[0] || 'Learner',
      totalPoints,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return { score, correct, total, totalPoints };
});

exports.mergeLearningState = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required to sync learning progress.');
  await ensureRateLimit(request.auth.uid, 'mergeLearningState', 30, 60_000);
  const incoming = clean(request.data?.learning || {});
  const profileRef = db.doc(`users/${request.auth.uid}`);
  const profile = await profileRef.get();
  const current = profile.get('learning') || {};
  const unique = value => [...new Set(Array.isArray(value) ? value.slice(0, 500) : [])];
  const merged = {
    goal: [5, 10, 15].includes(incoming.goal) ? incoming.goal : current.goal || 5,
    days: { ...(current.days || {}), ...(incoming.days || {}) },
    favorites: { ...(current.favorites || {}), ...(incoming.favorites || {}) },
    missed: unique([...(current.missed || []), ...(incoming.missed || [])]).slice(-30),
    categories: { ...(current.categories || {}), ...(incoming.categories || {}) },
    updatedAt: FieldValue.serverTimestamp()
  };
  Object.keys(merged.days).forEach(day => { merged.days[day] = unique([...(current.days?.[day] || []), ...(incoming.days?.[day] || [])]); });
  Object.keys(merged.categories).forEach(category => { merged.categories[category] = unique([...(current.categories?.[category] || []), ...(incoming.categories?.[category] || [])]); });
  await profileRef.set({ learning: merged, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const { updatedAt, ...responseLearning } = merged;
  return { learning: clean(responseLearning) };
});

exports.registerFcmToken = onCall(async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in is required to register notifications.');
  await ensureRateLimit(request.auth.uid, 'registerFcmToken', 10, 60_000);
  const token = String(request.data?.token || '');
  if (token.length < 80 || token.length > 4096) throw new HttpsError('invalid-argument', 'Invalid messaging token.');
  await db.doc(`users/${request.auth.uid}`).set({
    fcmTokens: { [token]: { updatedAt: Timestamp.now(), userAgent: String(request.rawRequest?.headers?.['user-agent'] || '').slice(0, 300) } },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { registered: true };
});

exports.auditContent = onDocumentWritten('content/{contentId}', async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const action = !before ? 'content.create' : !after ? 'content.delete' : 'content.update';
  const actorUid = event.authId || after?.updatedBy || before?.updatedBy || null;
  await writeAudit({
    action,
    entityType: 'content',
    entityId: event.params.contentId,
    before,
    after,
    actorUid,
    actorEmail: after?.updatedByEmail || before?.updatedByEmail || null,
    actorName: after?.updatedByName || before?.updatedByName || null
  });
});

exports.auditUserProfile = onDocumentWritten('users/{uid}', async event => {
  const before = event.data.before.exists ? event.data.before.data() : null;
  const after = event.data.after.exists ? event.data.after.data() : null;
  if (!before || !after) return;
  const changed = Object.keys(after).filter(key => JSON.stringify(clean(after[key])) !== JSON.stringify(clean(before[key])));
  if (!changed.length) return;
  const actorUid = event.authId || after.updatedBy || event.params.uid;
  const actorEmail = after.updatedByEmail
    || before.updatedByEmail
    || (actorUid === event.params.uid ? after.email : null)
    || null;
  const actorName = after.updatedByName
    || before.updatedByName
    || (actorUid === event.params.uid ? after.displayName : null)
    || null;
  await writeAudit({
    action: 'profile.update',
    entityType: 'user',
    entityId: event.params.uid,
    before: Object.fromEntries(changed.map(key => [key, before[key]])),
    after: Object.fromEntries(changed.map(key => [key, after[key]])),
    actorUid,
    actorEmail,
    actorName
  });
});

exports.auditNotification = onDocumentCreated('notifications/{id}', async event => {
  await writeAudit({ action: 'notification.create', entityType: 'notification', entityId: event.params.id, after: event.data.data(), actorUid: event.data.get('actorUid') || null, actorEmail: event.data.get('actorEmail') || null });
});

// Configure BACKUP_BUCKET as a Firebase runtime environment value before enabling this job.
exports.backupReminder = onSchedule('every day 03:15', async () => {
  const bucket = process.env.BACKUP_BUCKET;
  if (!bucket) {
    console.warn('BACKUP_BUCKET is not configured; no Firestore export was started.');
    return;
  }
  if (!bucket.startsWith('gs://')) throw new Error('BACKUP_BUCKET must use gs://bucket-name format.');
  const authClient = await new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] }).getClient();
  const firestoreApi = google.firestore({ version: 'v1', auth: authClient });
  const projectId = process.env.GCLOUD_PROJECT;
  const operation = await firestoreApi.projects.databases.exportDocuments({
    name: `projects/${projectId}/databases/(default)`,
    requestBody: { outputUriPrefix: `${bucket}/firestore/${new Date().toISOString().slice(0, 10)}` }
  });
  await db.collection('operations').doc('lastFirestoreExport').set({
    requestedAt: FieldValue.serverTimestamp(), bucket, operation: operation.data.name || null
  }, { merge: true });
});
