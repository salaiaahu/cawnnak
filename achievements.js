import { getApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const progressKey = 'cawnnak-progress';
const clean = value => String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
function progress() { try { return JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch (_) { return {}; } }
function dayStreak(days = {}) { let count = 0, cursor = new Date(); while (days[cursor.toISOString().slice(0, 10)]?.length) { count += 1; cursor.setDate(cursor.getDate() - 1); } return count; }
function summary() {
  const base = progress(), learning = window.CawnnakLearning?.getState?.() || {};
  const studied = new Set([...(base.studied || []), ...Object.values(learning.days || {}).flat()]).size;
  const streak = dayStreak(learning.days), categoryCount = Object.keys(learning.categories || {}).filter(category => learning.categories[category]?.length).length, bestScore = Number(base.bestScore || 0), badges = [];
  if (studied >= 1) badges.push({ name: 'First steps', icon: '🌱', detail: 'Studied your first phrase' });
  if (studied >= 20) badges.push({ name: 'Dedicated learner', icon: '📚', detail: 'Studied 20 phrases' });
  if (streak >= 3) badges.push({ name: 'On a streak', icon: '🔥', detail: `${streak}-day learning streak` });
  if (categoryCount >= 3) badges.push({ name: 'Topic explorer', icon: '🧭', detail: 'Learned in three categories' });
  if (bestScore >= 80) badges.push({ name: 'Quiz achiever', icon: '🏅', detail: `Best quiz score: ${bestScore}%` });
  if (bestScore === 100) badges.push({ name: 'Perfect score', icon: '⭐', detail: 'Earned 100% on a quiz' });
  return { studied, streak, categoryCount, bestScore, badges, updatedAt: Date.now() };
}
function cardCanvas(data) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
  const context = canvas.getContext('2d'), gradient = context.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#0f6249'); gradient.addColorStop(1, '#23986d'); context.fillStyle = gradient; context.fillRect(0, 0, 1200, 630);
  context.fillStyle = '#d8ffed'; context.font = '600 32px system-ui'; context.fillText('MIRANG HOLH CAWNNAK', 75, 90);
  context.fillStyle = '#ffffff'; context.font = '700 68px system-ui'; context.fillText('My learning achievement', 75, 180);
  const topBadge = data.badges.at(-1) || { icon: '🌱', name: 'Learning journey' };
  context.font = '72px system-ui'; context.fillText(topBadge.icon, 78, 285); context.font = '700 46px system-ui'; context.fillText(topBadge.name, 170, 280);
  context.font = '400 30px system-ui'; context.fillStyle = '#e3fff2'; context.fillText(`${data.studied} phrases studied  •  ${data.streak}-day streak  •  ${data.bestScore || '—'}% best quiz`, 75, 365);
  context.fillStyle = '#ffffff'; context.globalAlpha = .15; context.fillRect(75, 435, 1050, 2); context.globalAlpha = 1;
  context.font = '600 29px system-ui'; context.fillText('Keep learning, one phrase at a time.', 75, 510); context.fillStyle = '#d8ffed'; context.font = '400 24px system-ui'; context.fillText('Mirang Holh Cawnnak · Hakha Chin language learning', 75, 560);
  return canvas;
}
function ensureDialog() {
  let dialog = document.getElementById('achievement-dialog'); if (dialog) return dialog;
  dialog = document.createElement('dialog'); dialog.id = 'achievement-dialog';
  dialog.innerHTML = '<div class="head"><h2>Your achievements</h2><button class="plain achievement-close" type="button">Close</button></div><div class="achievement-summary"></div><div class="achievement-actions"><button class="btn achievement-share" type="button">Share card</button><button class="plain achievement-download" type="button">Download image</button></div>';
  document.body.append(dialog); const style = document.createElement('style'); style.textContent = '#achievement-dialog{width:min(560px,calc(100vw - 28px));border:0;border-radius:18px;padding:22px}#achievement-dialog::backdrop{background:#0d2019aa}.achievement-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.achievement-grid div{border:1px solid var(--l);border-radius:12px;padding:10px;background:#f8fffa}.achievement-grid b,.achievement-grid span{display:block}.achievement-grid span{font-size:.78rem;color:var(--m)}.badge-list{display:grid;gap:8px;margin:16px 0}.badge-item{padding:10px;border-radius:10px;background:#eefaf3}.achievement-actions{display:flex;gap:10px;flex-wrap:wrap}'; document.head.append(style);
  dialog.querySelector('.achievement-close').onclick = () => dialog.close(); return dialog;
}
function showAchievements() {
  const data = summary(), dialog = ensureDialog();
  dialog.querySelector('.achievement-summary').innerHTML = `<div class="achievement-grid"><div><b>${data.studied}</b><span>Phrases studied</span></div><div><b>${data.streak}</b><span>Day streak</span></div><div><b>${data.bestScore || '—'}%</b><span>Best quiz</span></div></div><div class="badge-list">${data.badges.length ? data.badges.map(badge => `<div class="badge-item"><b>${badge.icon} ${clean(badge.name)}</b><small>${clean(badge.detail)}</small></div>`).join('') : '<p class="status">Study a phrase to earn your first badge.</p>'}</div>`;
  const download = () => { const link = document.createElement('a'); link.download = 'mirang-holh-cawnnak-achievement.png'; link.href = cardCanvas(data).toDataURL('image/png'); link.click(); };
  dialog.querySelector('.achievement-download').onclick = download;
  dialog.querySelector('.achievement-share').onclick = async () => { const blob = await new Promise(resolve => cardCanvas(data).toBlob(resolve, 'image/png')); const file = blob && new File([blob], 'mirang-holh-cawnnak-achievement.png', { type: 'image/png' }); const shareData = { title: 'My Mirang Holh Cawnnak achievement', text: `I studied ${data.studied} phrases and have a ${data.streak}-day streak!` }; try { if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ ...shareData, files: [file] }); else if (navigator.share) await navigator.share(shareData); else download(); } catch (_) {} };
  dialog.showModal();
}
let currentUser = null, db = null, saveTimer = null;
function persistSummary() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (!currentUser || !db) return; const data = summary(); setDoc(doc(db, 'users', currentUser.uid), { achievementSummary: { studied: data.studied, streak: data.streak, categoryCount: data.categoryCount, bestScore: data.bestScore, badges: data.badges.map(badge => badge.name), calculatedAt: new Date(data.updatedAt).toISOString() }, updatedAt: serverTimestamp() }, { merge: true }).catch(error => console.warn('Could not save achievement summary', error)); }, 500); }
window.addEventListener('load', () => { const share = document.getElementById('share-badge'); if (share) share.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); showAchievements(); }, true); window.addEventListener('cawnnak-learning-changed', persistSummary); try { db = getFirestore(getApp()); onAuthStateChanged(getAuth(getApp()), user => { currentUser = user; if (user) persistSummary(); }); } catch (_) {} });
