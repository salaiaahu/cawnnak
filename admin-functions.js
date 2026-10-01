import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';

function byId(id) { return document.getElementById(id); }

async function init() {
  if (!getApps().length) return;
  const app = getApp();
  const auth = getAuth(app);
  const functions = getFunctions(app);
  const syncAuthUsers = httpsCallable(functions, 'syncAuthUsers');
  const setUserRole = httpsCallable(functions, 'setUserRole');
  const setUserDisabled = httpsCallable(functions, 'setUserDisabled');
  const usersButton = byId('users');
  const refreshButton = byId('refresh-users');
  const list = byId('userlist');
  const existingUsersClick = usersButton?.onclick;
  const existingRefreshClick = refreshButton?.onclick;

  async function syncThenLoad() {
    if (!auth.currentUser || !list) return;
    list.innerHTML = '<p class="status">Syncing Firebase Authentication users…</p>';
    try {
      const result = await syncAuthUsers();
      list.innerHTML = `<p class="status">Synced ${result.data.synced} Auth user(s). Loading profiles…</p>`;
      await existingRefreshClick?.();
    } catch (error) {
      list.innerHTML = `<p class="status">Could not sync users: ${error.message}</p>`;
    }
  }

  if (usersButton) {
    usersButton.onclick = async () => {
      await syncThenLoad();
      existingUsersClick?.();
    };
  }
  if (refreshButton) refreshButton.onclick = syncThenLoad;

  document.addEventListener('click', async event => {
    const roleButton = event.target.closest?.('.role-toggle');
    if (!roleButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    roleButton.disabled = true;
    try {
      await setUserRole({ uid: roleButton.dataset.id, role: roleButton.dataset.role });
      await syncThenLoad();
    } catch (error) {
      alert(`Could not change role: ${error.message}`);
      roleButton.disabled = false;
    }
  }, true);

  document.addEventListener('click', async event => {
    const accountButton = event.target.closest?.('.account-toggle');
    if (!accountButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    accountButton.disabled = true;
    try {
      await setUserDisabled({ uid: accountButton.dataset.id, disabled: accountButton.dataset.disabled === 'true' });
      await syncThenLoad();
    } catch (error) {
      alert(`Could not update account: ${error.message}`);
      accountButton.disabled = false;
    }
  }, true);
}

window.addEventListener('load', init, { once: true });
