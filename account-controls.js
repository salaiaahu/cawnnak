import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const $ = id => document.getElementById(id);
let timer;

async function addAccountControls() {
  if (!getApps().length || !$('userlist') || !getAuth(getApp()).currentUser) return;
  const db = getFirestore(getApp());
  try {
    const profiles = await getDocs(collection(db, 'users'));
    const disabled = new Map(profiles.docs.map(item => [item.id, item.get('disabled') === true]));
    document.querySelectorAll('.role-toggle').forEach(roleButton => {
      const uid = roleButton.dataset.id;
      if (!uid || roleButton.parentElement.querySelector('.account-toggle')) return;
      const isDisabled = disabled.get(uid) === true;
      const account = document.createElement('button');
      account.type = 'button';
      account.className = 'btn account-toggle';
      account.dataset.id = uid;
      account.dataset.disabled = String(!isDisabled);
      account.textContent = isDisabled ? 'Re-enable account' : 'Disable account';
      roleButton.after(account);
      if (isDisabled) {
        const label = document.createElement('span');
        label.className = 'role-pill account-disabled';
        label.textContent = 'Disabled';
        roleButton.closest('.user-row')?.querySelector('.user-meta')?.append(label);
      }
    });
  } catch (error) {
    console.warn('Could not add account controls.', error);
  }
}

window.addEventListener('load', () => {
  const list = $('userlist');
  if (!list) return;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(addAccountControls, 120);
  };
  new MutationObserver(refresh).observe(list, { childList: true, subtree: true });
  $('users')?.addEventListener('click', refresh);
  const style = document.createElement('style');
  style.textContent = `.user-row .account-toggle{margin-left:7px;background:#8d3d3d}.user-row .account-toggle:hover{background:#713030}.account-disabled{margin-left:6px;background:#fde3e1;color:#8d3d3d}`;
  document.head.append(style);
}, { once: true });
