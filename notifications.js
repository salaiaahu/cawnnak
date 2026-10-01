import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, query, orderBy, limit, onSnapshot, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = id => document.getElementById(id);
let stop = null;
let items = [];

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value || '');
  return node.innerHTML;
}

function render(uid) {
  const unread = items.filter(item => !item.readBy?.[uid]);
  const badge = $('notification-badge');
  badge.textContent = unread.length > 99 ? '99+' : unread.length;
  badge.classList.toggle('hidden', !unread.length);
  const panel = $('notification-panel');
  if (!panel) return;
  panel.innerHTML = `<div class="head"><b>Notifications</b><button id="close-notifications" class="plain">Close</button></div>${items.length ? items.map(item => `<button class="notification-item" data-id="${escapeHtml(item.id)}"><b>${escapeHtml(item.title)}</b><br><small>${escapeHtml(item.body)}</small></button>`).join('') : '<p class="status">No notifications.</p>'}`;
  $('close-notifications').onclick = () => panel.classList.add('hidden');
  panel.querySelectorAll('.notification-item').forEach(button => {
    button.onclick = async () => {
      const item = items.find(value => value.id === button.dataset.id);
      if (!item) return;
      await updateDoc(doc(getFirestore(getApp()), 'notifications', item.id), { [`readBy.${uid}`]: true });
      panel.classList.add('hidden');
      if (item.type === 'registration') $('users')?.click();
    };
  });
}

window.addEventListener('load', () => {
  if (!getApps().length) return;
  const app = getApp();
  const db = getFirestore(app);
  onAuthStateChanged(getAuth(app), async user => {
    if (stop) stop();
    stop = null;
    items = [];
    if (!user || (await getDoc(doc(db, 'users', user.uid))).data()?.role !== 'admin') return;
    stop = onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(30)), snapshot => {
      items = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      render(user.uid);
    });
    $('notifications').onclick = () => {
      render(user.uid);
      $('notification-panel')?.classList.toggle('hidden');
    };
  });
}, { once: true });
