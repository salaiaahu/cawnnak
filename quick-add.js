import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, addDoc, collection, doc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const config = {
  apiKey: 'AIzaSyAF_wVqiNRdFagnkv7kw-rFkl6WGyTX5RM',
  authDomain: 'cawnnak-ca.firebaseapp.com',
  projectId: 'cawnnak-ca'
};

const $ = id => document.getElementById(id);
let isAdmin = false;
let addDb;

function currentCategory() {
  return $('learn-title')?.textContent.replace(/ phrases$/, '') || 'Driving';
}

function addPopup() {
  const dialog = document.createElement('dialog');
  dialog.id = 'quick-add-dialog';
  dialog.innerHTML = `<form id="quick-add-form" method="dialog"><div class="quick-add-heading"><div><small class="eyebrow">ADD PHRASE</small><h2>Add to <span id="quick-add-category"></span></h2></div><button type="button" class="plain" id="quick-add-close" aria-label="Close">✕</button></div><label class="field">English phrase<input name="english" required autocomplete="off"></label><label class="field">Hakha Chin translation <span class="status">(add when ready)</span><input name="chin" autocomplete="off"></label><label class="quick-add-check"><input name="quiz" type="checkbox" checked> Use in quiz</label><p id="quick-add-message" class="status"></p><div class="quick-add-actions"><button type="button" class="plain" id="quick-add-cancel">Cancel</button><button class="btn" id="quick-add-save">Add phrase</button></div></form>`;
  document.body.append(dialog);
  $('quick-add-close').onclick = () => dialog.close();
  $('quick-add-cancel').onclick = () => dialog.close();
  $('quick-add-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('quick-add-save');
    const english = form.english.value.trim();
    if (!english) return;
    button.disabled = true;
    $('quick-add-message').textContent = 'Saving…';
    try {
      await addDoc(collection(addDb, 'content'), {
        english,
        chin: form.chin.value.trim(),
        category: currentCategory(),
        quiz: form.quiz.checked,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      $('quick-add-message').textContent = 'Phrase added. Refreshing…';
      setTimeout(() => location.reload(), 450);
    } catch (error) {
      $('quick-add-message').textContent = `Could not save: ${error.message}`;
      button.disabled = false;
    }
  };
  return dialog;
}

function addButton() {
  if (!isAdmin || $('quick-add-button')) return;
  const search = $('search');
  if (!search) return;
  const button = document.createElement('button');
  button.id = 'quick-add-button';
  button.type = 'button';
  button.className = 'btn quick-add-button';
  button.setAttribute('aria-label', 'Add a phrase to this category');
  button.textContent = '+';
  search.after(button);
  const dialog = addPopup();
  button.onclick = () => {
    $('quick-add-category').textContent = currentCategory();
    $('quick-add-message').textContent = '';
    $('quick-add-form').reset();
    dialog.showModal();
    dialog.querySelector('[name="english"]').focus();
  };
}

function styles() {
  const style = document.createElement('style');
  style.textContent = `.quick-add-button{min-width:46px;padding:8px 13px;font-size:1.55rem;line-height:1}.quick-add-heading{display:flex;justify-content:space-between;gap:16px;align-items:start}.quick-add-heading h2{margin:3px 0 10px}.quick-add-check{display:flex;align-items:center;gap:8px;margin:16px 0}.quick-add-check input{width:auto}.quick-add-actions{display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-top:18px}#quick-add-dialog{width:min(470px,calc(100vw - 28px));padding:22px}#quick-add-dialog::backdrop{background:#0d2019aa}@media(max-width:600px){.learn-controls{gap:8px}.quick-add-button{min-width:42px;padding:8px 11px}.learn-controls .search{width:auto}.quick-add-actions{justify-content:space-between}}`;
  document.head.append(style);
}

function connect() {
  const addApp = getApps().length ? getApp() : initializeApp(config);
  addDb = getFirestore(addApp);
  onAuthStateChanged(getAuth(addApp), async user => {
    if (!user) return;
    try {
      isAdmin = (await getDoc(doc(addDb, 'users', user.uid))).data()?.role === 'admin';
      addButton();
    } catch (_) {}
  });
}

styles();
window.addEventListener('load', connect, { once: true });
