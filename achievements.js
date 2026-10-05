import { getApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

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
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 760;
  const context = canvas.getContext('2d'), gradient = context.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#0f6249'); gradient.addColorStop(1, '#23986d'); context.fillStyle = gradient; context.fillRect(0, 0, 1200, 760);
  context.strokeStyle = '#f5d77b'; context.lineWidth = 12; context.strokeRect(24, 24, 1152, 712);
  context.strokeStyle = '#d8ffed'; context.lineWidth = 2; context.strokeRect(42, 42, 1116, 676);
  if (data.avatarImage?.complete && data.avatarImage.naturalWidth) {
    context.save(); context.beginPath(); context.arc(1060, 120, 62, 0, Math.PI * 2); context.clip(); context.drawImage(data.avatarImage, 998, 58, 124, 124); context.restore();
  } else {
    context.fillStyle = '#d8ffed'; context.beginPath(); context.arc(1060, 120, 62, 0, Math.PI * 2); context.fill(); context.fillStyle = '#0f6249'; context.font = '700 48px system-ui'; context.textAlign = 'center'; context.fillText(String(data.name || 'L').slice(0, 1).toUpperCase(), 1060, 137); context.textAlign = 'left';
  }
  context.fillStyle = '#d8ffed'; context.font = '600 32px system-ui'; context.fillText('MIRANG HOLH CAWNNAK', 75, 90);
  context.fillStyle = '#ffffff'; context.font = '700 62px system-ui'; context.fillText('Learning achievement award', 75, 175);
  context.font = '600 34px system-ui'; context.fillStyle = '#d8ffed'; context.fillText(`Presented to ${data.name || 'Learner'}`, 78, 235);
  context.font = '400 28px system-ui'; context.fillStyle = '#ffffff'; context.fillText(`${data.studied} phrases studied  •  ${data.streak}-day streak  •  ${data.bestScore || '—'}% best quiz`, 78, 300);
  context.font = '600 25px system-ui'; context.fillStyle = '#e3fff2'; context.fillText('Achievements earned', 78, 370);
  context.font = '31px system-ui'; context.fillStyle = '#ffffff';
  (data.badges.length ? data.badges : [{ icon: '🌱', name: 'Learning journey' }]).forEach((badge, index) => {
    context.fillText(`${badge.icon} ${badge.name}`, 88, 420 + index * 38);
  });
  const footerY = Math.min(660, 420 + data.badges.length * 38 + 30);
  context.fillStyle = '#ffffff'; context.globalAlpha = .15; context.fillRect(75, footerY, 1050, 2); context.globalAlpha = 1;
  context.font = '600 29px system-ui'; context.fillText('Keep learning, one phrase at a time.', 75, footerY + 38); context.fillStyle = '#d8ffed'; context.font = '400 24px system-ui'; context.fillText('Awarded by Mirang Holh Cawnnak · Hakha Chin language learning', 75, footerY + 76);
  return canvas;
}
function ensureDialog() {
  let dialog = document.getElementById('achievement-dialog'); if (dialog) return dialog;
  dialog = document.createElement('dialog'); dialog.id = 'achievement-dialog';
  dialog.innerHTML = '<div class="head"><h2>Your achievements</h2><button class="plain achievement-close" type="button">Close</button></div><p class="status">Preview your award before saving or sharing it.</p><img class="achievement-preview" alt="Achievement certificate preview"><div class="achievement-summary"></div><div class="achievement-actions"><button class="btn achievement-download" type="button">Save image</button><button class="btn achievement-share" type="button">Share</button><button class="plain achievement-cancel" type="button">Cancel</button></div>';
  document.body.append(dialog); const style = document.createElement('style'); style.textContent = '#achievement-dialog{width:min(620px,calc(100vw - 28px));border:0;border-radius:18px;padding:22px}#achievement-dialog::backdrop{background:#0d2019aa}.achievement-preview{display:block;width:100%;margin:12px 0;border:1px solid var(--l);border-radius:12px;background:#eef8f2}.achievement-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.achievement-grid div{border:1px solid var(--l);border-radius:12px;padding:10px;background:#f8fffa}.achievement-grid b,.achievement-grid span{display:block}.achievement-grid span{font-size:.78rem;color:var(--m)}.badge-list{display:grid;gap:8px;margin:16px 0}.badge-item{padding:10px;border-radius:10px;background:#eefaf3}.achievement-actions{display:flex;gap:10px;flex-wrap:wrap}'; document.head.append(style);
  dialog.querySelector('.achievement-close').onclick = () => dialog.close(); return dialog;
}
function showAchievements() {
  const data = { ...summary(), name: profileDisplayName || currentUser?.displayName || 'Learner', avatarImage: profileAvatarImage }, dialog = ensureDialog();
  const canvas = cardCanvas(data);
  dialog.querySelector('.achievement-preview').src = canvas.toDataURL('image/png');
  dialog.querySelector('.achievement-summary').innerHTML = `<div class="achievement-grid"><div><b>${data.studied}</b><span>Phrases studied</span></div><div><b>${data.streak}</b><span>Day streak</span></div><div><b>${data.bestScore || '—'}%</b><span>Best quiz</span></div></div><div class="badge-list">${data.badges.length ? data.badges.map(badge => `<div class="badge-item"><b>${badge.icon} ${clean(badge.name)}</b><small>${clean(badge.detail)}</small></div>`).join('') : '<p class="status">Study a phrase to earn your first badge.</p>'}</div>`;
  const download = () => { const link = document.createElement('a'); link.download = 'mirang-holh-cawnnak-achievement.png'; link.href = canvas.toDataURL('image/png'); link.click(); };
  dialog.querySelector('.achievement-download').onclick = download;
  dialog.querySelector('.achievement-share').onclick = async () => { const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); const file = blob && new File([blob], 'mirang-holh-cawnnak-achievement.png', { type: 'image/png' }); const shareData = { title: 'My Mirang Holh Cawnnak achievement', text: `I studied ${data.studied} phrases and have a ${data.streak}-day streak!` }; try { if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ ...shareData, files: [file] }); else if (navigator.share) await navigator.share(shareData); else download(); } catch (_) {} };
  dialog.querySelector('.achievement-cancel').onclick = () => dialog.close();
  dialog.showModal();
}
let currentUser = null, db = null, saveTimer = null, profileAvatarImage = null, profileDisplayName = '';
function persistSummary() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (!currentUser || !db) return; const data = summary(); setDoc(doc(db, 'users', currentUser.uid), { achievementSummary: { studied: data.studied, streak: data.streak, categoryCount: data.categoryCount, bestScore: data.bestScore, badges: data.badges.map(badge => badge.name), calculatedAt: new Date(data.updatedAt).toISOString() }, updatedAt: serverTimestamp() }, { merge: true }).catch(error => console.warn('Could not save achievement summary', error)); }, 500); }
function initialize() { const share = document.getElementById('share-badge'); if (share) share.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); showAchievements(); }, true); window.addEventListener('cawnnak-learning-changed', persistSummary); try { db = getFirestore(getApp()); onAuthStateChanged(getAuth(getApp()), async user => { currentUser = user; if (user) { const profile = await getDoc(doc(db, 'users', user.uid)); profileDisplayName = profile.data()?.displayName || user.displayName || ''; const avatar = profile.data()?.avatar || profile.data()?.avatarURL || profile.data()?.photoURL || user.photoURL || ''; if (avatar) { profileAvatarImage = new Image(); profileAvatarImage.src = avatar; } persistSummary(); } }); } catch (_) {} }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true }); else initialize();
export { showAchievements };
