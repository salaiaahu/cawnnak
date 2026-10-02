import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';

const $ = id => document.getElementById(id);
let answers = [];
let currentUser = null;
let submitting = false;

function resetAttempt() {
  answers = [];
  submitting = false;
}

async function submitValidatedResult() {
  if (!currentUser || !answers.length || submitting) return;
  submitting = true;
  try {
    const result = await httpsCallable(getFunctions(getApp()), 'submitQuizResult')({ answers });
    const score = result.data.score;
    const resultNode = $('result');
    if (resultNode && !resultNode.classList.contains('hidden')) {
      resultNode.textContent += ` · Verified score: ${score}%.`;
    }
    window.dispatchEvent(new CustomEvent('cawnnak-leaderboard-updated'));
  } catch (error) {
    const resultNode = $('result');
    if (resultNode && !resultNode.classList.contains('hidden')) {
      resultNode.textContent += ' · Score verification is currently unavailable.';
    }
    console.warn('Quiz score could not be verified.', error);
  }
}

window.addEventListener('load', () => {
  if (!getApps().length) return;
  const app = getApp();
  onAuthStateChanged(getAuth(app), user => { currentUser = user; if (!user) resetAttempt(); });
  $('start-quiz')?.addEventListener('click', resetAttempt, true);
  $('restart')?.addEventListener('click', resetAttempt, true);
  document.addEventListener('click', event => {
    const option = event.target.closest?.('.option');
    if (!option || option.disabled) return;
    const english = $('question')?.textContent?.trim();
    const answer = option.dataset.a || option.textContent.trim();
    if (english && answer) answers.push({ english, answer });
  }, true);
  new MutationObserver(() => {
    if (!$('summary')?.classList.contains('hidden')) submitValidatedResult();
  }).observe($('summary'), { attributes: true, attributeFilter: ['class'] });
}, { once: true });
