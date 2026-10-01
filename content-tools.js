import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, getDocs, doc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = id => document.getElementById(id);
let records = [];
let db;
let auth;

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value || '');
  return node.innerHTML;
}

function csvValue(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function normalize(value) { return String(value || '').trim().toLocaleLowerCase(); }

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); if (row.some(value => value.trim())) rows.push(row); row = []; field = '';
    } else field += char;
  }
  row.push(field); if (row.some(value => value.trim())) rows.push(row);
  const [header = [], ...values] = rows;
  return values.map(row => Object.fromEntries(header.map((key, index) => [key.trim(), row[index]?.trim() || ''])));
}

function selectedIds() {
  return [...document.querySelectorAll('[data-content-select]:checked')].map(input => input.value);
}

function installUi() {
  const host = $('adminlist')?.parentElement;
  if (!host || $('content-tools')) return;
  host.insertAdjacentHTML('afterbegin', `<div id="content-tools" class="content-tools"><div class="content-tools-row"><label>Status<select id="content-filter-status"><option value="">All statuses</option><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="archived">Archived</option></select></label><button id="content-export" class="plain" type="button">Export CSV</button><label class="plain import-label">Import CSV<input id="content-import" type="file" accept=".csv,text/csv" hidden></label></div><div class="content-tools-row bulk-actions"><span id="content-selection" class="status">Select content for bulk actions.</span><button id="bulk-publish" class="plain" type="button">Publish selected</button><button id="bulk-archive" class="plain" type="button">Archive selected</button></div><div id="import-preview" class="status hidden"></div></div>`);
  const style = document.createElement('style');
  style.textContent = `.content-tools{display:grid;gap:10px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--l)}.content-tools-row{display:flex;flex-wrap:wrap;align-items:end;gap:10px}.content-tools label{display:grid;gap:4px;color:var(--m);font-size:.78rem}.import-label{cursor:pointer}.content-record{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:12px 0;border-bottom:1px solid var(--l)}.content-record:last-child{border:0}.content-record small{display:block;color:var(--m);margin-top:3px}.content-record .plain{white-space:nowrap}.status-pill{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:99px;background:#eef3f0;color:#345348;font-size:.72rem;font-weight:800}.status-pill.published{background:#e5f4eb;color:#14583f}.status-pill.review{background:#fff4c9;color:#5b4300}.status-pill.archived{background:#f2f2f2;color:#59645f}@media(max-width:600px){.content-record{grid-template-columns:auto minmax(0,1fr)}.content-record .plain{grid-column:2}.bulk-actions .plain{font-size:.82rem}}`;
  document.head.append(style);
  $('content-filter-status').onchange = render;
  $('content-export').onclick = exportCsv;
  $('content-import').onchange = previewImport;
  $('bulk-publish').onclick = () => bulkStatus('published');
  $('bulk-archive').onclick = () => bulkStatus('archived');
}

function render() {
  const filter = $('content-filter-status')?.value || '';
  const items = records.filter(item => !filter || (item.status || 'published') === filter);
  $('adminlist').innerHTML = items.length ? items.map(item => `<article class="content-record"><input type="checkbox" data-content-select value="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.english)}"><div><b>${escapeHtml(item.english)}</b><span class="status-pill ${(item.status || 'published')}">${escapeHtml(item.status || 'published')}</span><small>${escapeHtml(item.category)} · ${escapeHtml(item.chin || 'Translation needed')}</small></div><button class="plain workflow-edit" data-id="${escapeHtml(item.id)}" type="button">Edit</button></article>`).join('') : '<p class="status">No content matches this filter.</p>';
  document.querySelectorAll('[data-content-select]').forEach(input => input.onchange = () => { $('content-selection').textContent = `${selectedIds().length} selected`; });
  document.querySelectorAll('.workflow-edit').forEach(button => button.onclick = () => beginEdit(button.dataset.id));
}

async function loadRecords() {
  if (!db) return;
  const snapshot = await getDocs(collection(db, 'content'));
  records = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((a, b) => a.english.localeCompare(b.english));
  render();
}

function beginEdit(id) {
  const item = records.find(value => value.id === id);
  if (!item) return;
  const form = $('form');
  form.dataset.workflowEditingId = id;
  form.english.value = item.english;
  form.chin.value = item.chin || '';
  $('content-category').value = item.category;
  form.quiz.value = String(item.quiz !== false);
  $('content-status').value = item.status || 'published';
  $('form-title').textContent = 'Edit content';
  $('save-content').textContent = 'Save changes';
  $('cancel-edit').classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function bulkStatus(status) {
  const ids = selectedIds();
  if (!ids.length || !auth.currentUser) return;
  const batch = writeBatch(db);
  ids.forEach(id => batch.update(doc(db, 'content', id), {
    status,
    updatedBy: auth.currentUser.uid,
    updatedByEmail: auth.currentUser.email || '',
    updatedAt: serverTimestamp(),
    ...(status === 'published' ? { publishedAt: serverTimestamp() } : {})
  }));
  await batch.commit();
  await loadRecords();
}

function exportCsv() {
  const header = ['english', 'chin', 'category', 'quiz', 'status'];
  const csv = [header.join(','), ...records.map(item => header.map(key => csvValue(item[key])).join(','))].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `mirang-holh-content-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function previewImport(event) {
  const file = event.target.files[0];
  if (!file || !auth.currentUser) return;
  const rows = parseCsv(await file.text());
  const validStatuses = new Set(['draft', 'review', 'published', 'archived']);
  const existing = new Set(records.map(item => item.englishNormalized || normalize(item.english)));
  const seen = new Set();
  const valid = rows.filter(row => {
    const phrase = normalize(row.english);
    const good = phrase && !existing.has(phrase) && !seen.has(phrase) && validStatuses.has(row.status || 'published');
    seen.add(phrase);
    return good;
  });
  const preview = $('import-preview');
  preview.classList.remove('hidden');
  preview.innerHTML = `${valid.length} valid of ${rows.length} CSV rows. Duplicates, blank English phrases, and invalid statuses are excluded. <button id="confirm-import" class="btn" type="button">Import ${valid.length} valid row(s)</button>`;
  $('confirm-import').onclick = async () => {
    const batch = writeBatch(db);
    valid.forEach(row => {
      const reference = doc(collection(db, 'content'));
      const status = row.status || 'published';
      batch.set(reference, {
        english: row.english.trim(), englishNormalized: normalize(row.english), chin: row.chin || '', category: row.category || 'Greetings & basics', quiz: row.quiz !== 'false', status,
        createdBy: auth.currentUser.uid, createdByEmail: auth.currentUser.email || '', updatedBy: auth.currentUser.uid, updatedByEmail: auth.currentUser.email || '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...(status === 'published' ? { publishedAt: serverTimestamp() } : {})
      });
    });
    await batch.commit();
    preview.textContent = `Imported ${valid.length} row(s).`;
    await loadRecords();
  };
}

window.addEventListener('load', async () => {
  if (!getApps().length || !$('adminlist')) return;
  const app = getApp(); db = getFirestore(app); auth = getAuth(app);
  installUi();
  $('admin')?.addEventListener('click', () => setTimeout(loadRecords, 0));
  $('content-tools')?.addEventListener('change', () => { $('content-selection').textContent = `${selectedIds().length} selected`; });
}, { once: true });
