import { getApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const progressKey = 'cawnnak-progress';
const clean = value => String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function progress() {
  try { return JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch (_) { return {}; }
}

function dayStreak(days = {}) {
  let count = 0, cursor = new Date();
  while (days[cursor.toISOString().slice(0, 10)]?.length) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function summary() {
  const base = progress(), learning = window.CawnnakLearning?.getState?.() || {};
  const studied = new Set([...(base.studied || []), ...Object.values(learning.days || {}).flat()]).size;
  const streak = dayStreak(learning.days);
  const categoryCount = Object.keys(learning.categories || {}).filter(category => learning.categories[category]?.length).length;
  const bestScore = Number(base.bestScore || 0);
  const badges = [];

  if (studied >= 1) badges.push({ name: 'First steps', icon: '🌱', detail: 'Studied your first phrase' });
  if (studied >= 20) badges.push({ name: 'Dedicated learner', icon: '📚', detail: 'Studied 20 phrases' });
  if (streak >= 3) badges.push({ name: 'On a streak', icon: '🔥', detail: `${streak}-day learning streak` });
  if (categoryCount >= 3) badges.push({ name: 'Topic explorer', icon: '🧭', detail: 'Learned in three categories' });
  if (bestScore >= 80) badges.push({ name: 'Quiz achiever', icon: '🏅', detail: `Best quiz score: ${bestScore}%` });
  if (bestScore === 100) badges.push({ name: 'Perfect score', icon: '⭐', detail: 'Earned 100% on a quiz' });

  return { studied, streak, categoryCount, bestScore, badges, updatedAt: Date.now() };
}

// Preload the Golden Award Ribbon Badge
const badgeImage = new Image();
const badgeReady = new Promise(resolve => {
  badgeImage.onload = () => resolve(badgeImage);
  badgeImage.onerror = () => resolve(null);
  badgeImage.src = './icons/badge.png';
});

function cardCanvas(data) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 760;
  const context = canvas.getContext('2d');

  // 1. Deep Midnight Slate & Azure Gradient Canvas
  const gradient = context.createLinearGradient(0, 0, 1200, 760);
  gradient.addColorStop(0, '#0c1424');
  gradient.addColorStop(0.45, '#101b30');
  gradient.addColorStop(1, '#060a12');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 760);

  // 2. Ambient Lighting Auras
  // Azure Aura (upper-left / center)
  const azureAura = context.createRadialGradient(420, 220, 40, 420, 220, 650);
  azureAura.addColorStop(0, 'rgba(59, 130, 246, 0.24)');
  azureAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = azureAura;
  context.fillRect(0, 0, 1200, 760);

  // Golden Glow Aura (behind medal on the right)
  const goldAura = context.createRadialGradient(1040, 360, 30, 1040, 360, 420);
  goldAura.addColorStop(0, 'rgba(245, 158, 11, 0.28)');
  goldAura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = goldAura;
  context.fillRect(0, 0, 1200, 760);

  // 3. Luxury Gold & Frosted Glass Frame
  // Outer Solid Golden Border
  context.strokeStyle = '#f59e0b';
  context.lineWidth = 10;
  context.strokeRect(24, 24, 1152, 712);

  // Middle Radiant Gold Hairline
  context.strokeStyle = '#fbbf24';
  context.lineWidth = 2;
  context.strokeRect(36, 36, 1128, 688);

  // Inner Subtle Translucent Hairline
  context.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  context.lineWidth = 1.5;
  context.strokeRect(46, 46, 1108, 668);

  // Corner Accent Flourishes
  const corners = [[46, 46], [1154, 46], [46, 714], [1154, 714]];
  corners.forEach(([cx, cy]) => {
    context.fillStyle = '#f59e0b';
    context.beginPath();
    context.arc(cx, cy, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fde047';
    context.beginPath();
    context.arc(cx, cy, 3, 0, Math.PI * 2);
    context.fill();
  });

  // 4. User Avatar (Top Right - Prominently Sized)
  if (data.avatarImage?.complete && data.avatarImage.naturalWidth) {
    context.save();
    context.beginPath();
    context.arc(1045, 150, 76, 0, Math.PI * 2);
    context.clip();
    context.drawImage(data.avatarImage, 969, 74, 152, 152);
    context.restore();
    context.beginPath();
    context.arc(1045, 150, 78, 0, Math.PI * 2);
    context.strokeStyle = '#fbbf24';
    context.lineWidth = 5;
    context.stroke();
    context.beginPath();
    context.arc(1045, 150, 73, 0, Math.PI * 2);
    context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    context.lineWidth = 1.5;
    context.stroke();
  } else {
    context.fillStyle = 'rgba(59, 130, 246, 0.24)';
    context.beginPath();
    context.arc(1045, 150, 76, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#fbbf24';
    context.lineWidth = 5;
    context.stroke();
    context.fillStyle = '#60a5fa';
    context.font = '700 64px system-ui, -apple-system, sans-serif';
    context.textAlign = 'center';
    context.fillText(String(data.name || 'L').slice(0, 1).toUpperCase(), 1045, 172);
    context.textAlign = 'left';
  }

  // 5. Realistic 3D Golden Award Ribbon Badge (Official Seal of Excellence - Refined Size)
  if (badgeImage?.complete && badgeImage.naturalWidth) {
    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.65)';
    context.shadowBlur = 20;
    context.shadowOffsetY = 10;
    context.drawImage(badgeImage, 990, 265, 110, 156);
    context.restore();
  }

  // 6. Certificate Content (Left & Center)
  // Header Tracking Brand
  context.fillStyle = '#60a5fa';
  context.font = '700 24px system-ui, -apple-system, sans-serif';
  context.fillText('MIRANG HOLH CAWNNAK', 78, 96);

  // Award Title
  context.fillStyle = '#ffffff';
  context.font = '800 56px system-ui, -apple-system, sans-serif';
  context.fillText('Learning achievement award', 78, 170);

  // Recipient Line
  context.fillStyle = '#94a3b8';
  context.font = '500 30px system-ui, -apple-system, sans-serif';
  context.fillText('Presented to', 80, 228);
  context.fillStyle = '#fbbf24';
  context.font = '700 38px system-ui, -apple-system, sans-serif';
  context.fillText(data.name || 'Learner', 256, 228);

  // Key Stats Frosted Glass Pill Bar
  context.fillStyle = 'rgba(255, 255, 255, 0.06)';
  if (context.roundRect) {
    context.beginPath();
    context.roundRect(78, 258, 830, 52, 12);
    context.fill();
    context.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    context.lineWidth = 1;
    context.stroke();
  } else {
    context.fillRect(78, 258, 830, 52);
  }

  context.fillStyle = '#f8fafc';
  context.font = '600 23px system-ui, -apple-system, sans-serif';
  context.fillText(`${data.studied} phrases studied   •   ${data.streak}-day streak   •   ${data.bestScore || '—'}% best quiz`, 98, 293);

  // Achievements Section Heading
  context.fillStyle = '#93c5fd';
  context.font = '700 22px system-ui, -apple-system, sans-serif';
  context.fillText('ACHIEVEMENTS EARNED', 80, 360);

  // Badges Earned (2 columns)
  const badgesToDisplay = data.badges.length ? data.badges : [{ icon: '🌱', name: 'First steps' }];
  badgesToDisplay.slice(0, 6).forEach((badge, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const bx = 80 + col * 420;
    const by = 405 + row * 48;

    // Small translucent badge pill
    context.fillStyle = 'rgba(255, 255, 255, 0.05)';
    if (context.roundRect) {
      context.beginPath();
      context.roundRect(bx, by - 26, 395, 38, 8);
      context.fill();
    } else {
      context.fillRect(bx, by - 26, 395, 38);
    }

    context.font = '600 24px system-ui, -apple-system, sans-serif';
    context.fillStyle = '#ffffff';
    context.fillText(`${badge.icon}  ${badge.name}`, bx + 14, by);
  });

  // Footer Divider Line
  context.fillStyle = 'rgba(255, 255, 255, 0.12)';
  context.fillRect(78, 595, 830, 1.5);

  // Footer Tagline & Attribution
  context.fillStyle = '#f8fafc';
  context.font = '600 26px system-ui, -apple-system, sans-serif';
  context.fillText('Keep learning, one phrase at a time.', 78, 638);

  context.fillStyle = '#94a3b8';
  context.font = '400 22px system-ui, -apple-system, sans-serif';
  context.fillText('Awarded by Mirang Holh Cawnnak · Hakha Chin language learning', 78, 674);

  return canvas;
}

function ensureDialog() {
  let dialog = document.getElementById('achievement-dialog');
  if (dialog) return dialog;

  dialog = document.createElement('dialog');
  dialog.id = 'achievement-dialog';
  dialog.innerHTML = '<div class="head"><h2>Your achievements</h2><button class="plain achievement-close" type="button">Close</button></div><p class="status">Preview your award before saving or sharing it.</p><img class="achievement-preview" alt="Achievement certificate preview"><div class="achievement-summary"></div><div class="achievement-actions"><button class="btn achievement-download" type="button">Save image</button><button class="btn achievement-share" type="button">Share</button><button class="plain achievement-cancel" type="button">Cancel</button></div>';
  document.body.append(dialog);

  const style = document.createElement('style');
  style.textContent = `
    #achievement-dialog {
      width: min(640px, calc(100vw - 28px));
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 22px;
      padding: 22px;
      background: linear-gradient(145deg, #101726, #090e18) !important;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: #f8fafc !important;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    }
    #achievement-dialog::backdrop {
      background: rgba(4, 7, 13, 0.85);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    #achievement-dialog .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    #achievement-dialog .head h2 {
      margin: 0;
      color: #ffffff !important;
      font-size: 1.35rem;
      font-weight: 700;
    }
    #achievement-dialog .head .achievement-close {
      color: #60a5fa !important;
      font-weight: 600;
      cursor: pointer;
    }
    #achievement-dialog p.status {
      color: #94a3b8 !important;
      font-size: 0.88rem;
      margin: 4px 0 14px;
    }
    .achievement-preview {
      display: block;
      width: 100%;
      margin: 14px 0;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      background: #080d18;
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.55);
    }
    .achievement-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 14px 0;
    }
    .achievement-grid div {
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 14px;
      padding: 12px 10px;
      background: rgba(18, 27, 44, 0.7);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      text-align: center;
    }
    .achievement-grid b {
      display: block;
      color: #60a5fa !important;
      font-size: 1.35rem;
      font-weight: 700;
    }
    .achievement-grid span {
      display: block;
      font-size: 0.74rem;
      color: #94a3b8 !important;
      margin-top: 4px;
      font-weight: 500;
    }
    .badge-list {
      display: grid;
      gap: 8px;
      margin: 16px 0;
    }
    .badge-item {
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(22, 33, 54, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .badge-item b {
      color: #f8fafc !important;
      font-size: 0.94rem;
    }
    .badge-item small {
      color: #94a3b8 !important;
      font-size: 0.8rem;
    }
    .achievement-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 18px;
      align-items: center;
    }
    .achievement-actions .achievement-download {
      background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 12px !important;
      padding: 10px 18px !important;
      font-weight: 600 !important;
      box-shadow: 0 6px 18px rgba(37, 99, 235, 0.4) !important;
      cursor: pointer;
    }
    .achievement-actions .achievement-share {
      background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 12px !important;
      padding: 10px 18px !important;
      font-weight: 600 !important;
      box-shadow: 0 6px 18px rgba(29, 78, 216, 0.4) !important;
      cursor: pointer;
    }
    .achievement-actions .achievement-cancel {
      color: #94a3b8 !important;
      font-weight: 500 !important;
      cursor: pointer;
    }
    .achievement-actions .achievement-cancel:hover {
      color: #f8fafc !important;
    }
  `;
  document.head.append(style);

  dialog.querySelector('.achievement-close').onclick = () => dialog.close();
  return dialog;
}

async function showAchievements() {
  await badgeReady;
  const data = {
    ...summary(),
    name: profileDisplayName || currentUser?.displayName || 'Learner',
    avatarImage: profileAvatarImage
  };
  const dialog = ensureDialog();
  const canvas = cardCanvas(data);

  dialog.querySelector('.achievement-preview').src = canvas.toDataURL('image/png');
  dialog.querySelector('.achievement-summary').innerHTML = `
    <div class="achievement-grid">
      <div><b>${data.studied}</b><span>Phrases studied</span></div>
      <div><b>${data.streak}</b><span>Day streak</span></div>
      <div><b>${data.bestScore || '—'}%</b><span>Best quiz</span></div>
    </div>
    <div class="badge-list">
      ${data.badges.length
        ? data.badges.map(badge => `<div class="badge-item"><b>${badge.icon} ${clean(badge.name)}</b><small>${clean(badge.detail)}</small></div>`).join('')
        : '<p class="status">Study a phrase to earn your first badge.</p>'}
    </div>
  `;

  const download = () => {
    const link = document.createElement('a');
    link.download = 'mirang-holh-cawnnak-achievement.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  dialog.querySelector('.achievement-download').onclick = download;

  dialog.querySelector('.achievement-share').onclick = async () => {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = blob && new File([blob], 'mirang-holh-cawnnak-achievement.png', { type: 'image/png' });
    const shareData = {
      title: 'My Mirang Holh Cawnnak achievement',
      text: `I studied ${data.studied} phrases and have a ${data.streak}-day streak!`
    };
    try {
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ ...shareData, files: [file] });
      else if (navigator.share) await navigator.share(shareData);
      else download();
    } catch (_) {}
  };

  dialog.querySelector('.achievement-cancel').onclick = () => dialog.close();
  dialog.showModal();
}

let currentUser = null, db = null, saveTimer = null, profileAvatarImage = null, profileDisplayName = '';

function persistSummary() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!currentUser || !db) return;
    const data = summary();
    setDoc(doc(db, 'users', currentUser.uid), {
      achievementSummary: {
        studied: data.studied,
        streak: data.streak,
        categoryCount: data.categoryCount,
        bestScore: data.bestScore,
        badges: data.badges.map(badge => badge.name),
        calculatedAt: new Date(data.updatedAt).toISOString()
      },
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(error => console.warn('Could not save achievement summary', error));
  }, 500);
}

function initialize() {
  const share = document.getElementById('share-badge');
  if (share) {
    share.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showAchievements();
    }, true);
  }
  window.addEventListener('cawnnak-learning-changed', persistSummary);
  try {
    db = getFirestore(getApp());
    onAuthStateChanged(getAuth(getApp()), async user => {
      currentUser = user;
      if (user) {
        const profile = await getDoc(doc(db, 'users', user.uid));
        profileDisplayName = profile.data()?.displayName || user.displayName || '';
        const avatar = profile.data()?.avatar || profile.data()?.avatarURL || profile.data()?.photoURL || user.photoURL || '';
        if (avatar) {
          profileAvatarImage = new Image();
          profileAvatarImage.src = avatar;
        }
        persistSummary();
      }
    });
  } catch (_) {}
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();

export { showAchievements };
