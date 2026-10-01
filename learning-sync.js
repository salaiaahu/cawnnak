import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';

let user = null;
let timer;
let syncing = false;
const QUEUE_KEY = 'cawnnak-learning-sync-pending';

async function sync() {
  if (!user || !navigator.onLine || syncing || !window.CawnnakLearning) return;
  syncing = true;
  try {
    const callable = httpsCallable(getFunctions(getApp()), 'mergeLearningState');
    const result = await callable({ learning: window.CawnnakLearning.getState() });
    if (result.data?.learning) window.CawnnakLearning.applyMergedState(result.data.learning);
    localStorage.removeItem(QUEUE_KEY);
  } catch (error) {
    localStorage.setItem(QUEUE_KEY, 'true');
    console.warn('Learning progress is queued for sync.', error);
  } finally {
    syncing = false;
  }
}

function queueSync() {
  if (!user) return;
  localStorage.setItem(QUEUE_KEY, 'true');
  clearTimeout(timer);
  timer = setTimeout(sync, 800);
}

window.addEventListener('load', () => {
  if (!getApps().length) return;
  onAuthStateChanged(getAuth(getApp()), account => {
    user = account;
    if (account && localStorage.getItem(QUEUE_KEY)) sync();
  });
  window.addEventListener('cawnnak-learning-changed', queueSync);
  window.addEventListener('online', sync);
}, { once: true });
