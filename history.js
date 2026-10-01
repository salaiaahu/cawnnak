import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, orderBy, limit, startAfter, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const PAGE_SIZE = 25;
const $ = id => document.getElementById(id);
let lastDocument = null;

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value || '');
  return node.innerHTML;
}

function formatDate(value) {
  return value?.toDate ? value.toDate().toLocaleString() : 'Pending timestamp';
}

function addStyles() {
  const style = document.createElement('style');
  style.textContent = `.history-filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 16px}.history-filters label{display:grid;gap:4px;font-size:.78rem;color:var(--m)}.history-filters .btn{align-self:end}#history-more{margin-top:14px}@media(max-width:700px){.history-filters{grid-template-columns:1fr 1fr}.history-filters label:first-child,.history-filters label:nth-child(2),.history-filters .btn{grid-column:1/-1}}`;
  document.head.append(style);
}

function installFilters() {
  const panel = $('auditview')?.querySelector('.panel');
  if (!panel || $('history-filters')) return;
  panel.insertAdjacentHTML('afterbegin', `<form id="history-filters" class="history-filters"><label>Action<select name="action"><option value="">All actions</option><option value="content.create">Content created</option><option value="content.update">Content updated</option><option value="content.delete">Content deleted</option><option value="role.change">Role changed</option><option value="account.disable">Account disabled</option><option value="account.enable">Account enabled</option><option value="profile.update">Profile updated</option><option value="notification.create">Notification created</option></select></label><label>Administrator UID<input name="actor" placeholder="Any administrator"></label><label>From<input name="from" type="date"></label><label>To<input name="to" type="date"></label><button class="btn">Apply filters</button><button id="history-reset" type="button" class="plain">Reset</button></form><button id="history-more" type="button" class="plain hidden">Load more history</button>`);
}

async function loadHistory(append = false) {
  const app = getApp();
  const db = getFirestore(app);
  const filters = $('history-filters');
  const list = $('auditlist');
  if (!filters || !list) return;
  if (!append) {
    lastDocument = null;
    list.innerHTML = '<p class="status">Loading history…</p>';
  }
  const form = new FormData(filters);
  const constraints = [];
  if (form.get('action')) constraints.push(where('action', '==', form.get('action')));
  if (form.get('actor')) constraints.push(where('actorUid', '==', form.get('actor').trim()));
  if (form.get('from')) constraints.push(where('createdAt', '>=', Timestamp.fromDate(new Date(`${form.get('from')}T00:00:00`))));
  if (form.get('to')) constraints.push(where('createdAt', '<=', Timestamp.fromDate(new Date(`${form.get('to')}T23:59:59.999`))));
  constraints.push(orderBy('createdAt', 'desc'));
  if (append && lastDocument) constraints.push(startAfter(lastDocument));
  constraints.push(limit(PAGE_SIZE));
  try {
    const snapshot = await getDocs(query(collection(db, 'audit'), ...constraints));
    const markup = snapshot.docs.map(item => {
      const audit = item.data();
      return `<div class="user-row"><div class="user-meta"><b>${escapeHtml(audit.action)} · ${escapeHtml(audit.entityType)} ${escapeHtml(audit.entityId)}</b><small>${escapeHtml(audit.actorEmail || audit.actorUid || 'Server') } · ${escapeHtml(formatDate(audit.createdAt))}</small></div></div>`;
    }).join('') || (!append ? '<p class="status">No matching history.</p>' : '');
    list.innerHTML = append ? list.innerHTML + markup : markup;
    lastDocument = snapshot.docs.at(-1) || null;
    $('history-more').classList.toggle('hidden', snapshot.size < PAGE_SIZE);
  } catch (error) {
    list.innerHTML = `<p class="status">Could not load history: ${escapeHtml(error.message)}</p>`;
  }
}

window.addEventListener('load', () => {
  if (!getApps().length || !$('auditview')) return;
  addStyles();
  installFilters();
  const auth = getAuth(getApp());
  $('history-filters').onsubmit = event => { event.preventDefault(); loadHistory(); };
  $('history-reset').onclick = () => { $('history-filters').reset(); loadHistory(); };
  $('history-more').onclick = () => loadHistory(true);
  $('refresh-audit').onclick = () => loadHistory();
  $('history-menu')?.addEventListener('click', () => setTimeout(() => { if (auth.currentUser) loadHistory(); }, 0));
  $('audit')?.addEventListener('click', () => setTimeout(() => { if (auth.currentUser) loadHistory(); }, 0));
}, { once: true });
