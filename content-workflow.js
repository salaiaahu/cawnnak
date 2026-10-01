import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = id => document.getElementById(id);
let editingId = null;

function normalize(value) { return String(value || '').trim().toLocaleLowerCase(); }

function addWorkflowField() {
  if ($('content-status')) return;
  const category = $('content-category')?.closest('label');
  if (!category) return;
  category.insertAdjacentHTML('afterend', '<label class="field">Publication status<select id="content-status" name="status"><option value="draft">Draft</option><option value="review">Ready for review</option><option value="published" selected>Published</option><option value="archived">Archived</option></select></label><p class="status" id="workflow-note">Published content is visible to learners. Drafts, review items, and archived content are admin-only.</p>');
}

async function install() {
  if (!getApps().length || !$('form')) return;
  const app = getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  addWorkflowField();
  const form = $('form');
  const message = $('message');

  document.addEventListener('click', async event => {
    const edit = event.target.closest?.('.edit-card');
    if (!edit) return;
    editingId = edit.dataset.id;
    try {
      const content = await getDoc(doc(db, 'content', editingId));
      $('content-status').value = content.get('status') || 'published';
    } catch (_) {}
  }, true);

  $('cancel-edit')?.addEventListener('click', () => { editingId = null; $('content-status').value = 'published'; });
  form.onsubmit = async event => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const values = new FormData(form);
    const english = values.get('english').trim();
    const chin = values.get('chin').trim();
    const status = values.get('status');
    const englishNormalized = normalize(english);
    if (!english) { message.textContent = 'English phrase is required.'; return; }
    try {
      message.textContent = 'Checking phrase…';
      const matches = await getDocs(query(collection(db, 'content'), where('englishNormalized', '==', englishNormalized), limit(2)));
      if (matches.docs.some(item => item.id !== editingId)) {
        message.textContent = 'A phrase with the same English text already exists.';
        return;
      }
      const data = {
        english,
        englishNormalized,
        chin,
        category: values.get('category'),
        quiz: values.get('quiz') === 'true',
        status,
        updatedBy: user.uid,
        updatedByEmail: user.email || '',
        updatedAt: serverTimestamp()
      };
      if (status === 'review') { data.reviewedBy = user.uid; data.reviewedByEmail = user.email || ''; }
      if (status === 'published') data.publishedAt = serverTimestamp();
      if (editingId) {
        await setDoc(doc(db, 'content', editingId), data, { merge: true });
      } else {
        data.createdBy = user.uid;
        data.createdByEmail = user.email || '';
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, 'content'), data);
      }
      message.textContent = `${status === 'published' ? 'Published' : 'Saved'} successfully. Refreshing…`;
      setTimeout(() => location.reload(), 450);
    } catch (error) {
      message.textContent = `Could not save: ${error.message}`;
    }
  };
}

window.addEventListener('load', install, { once: true });
