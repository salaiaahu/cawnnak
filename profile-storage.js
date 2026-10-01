import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const $ = id => document.getElementById(id);

window.addEventListener('load', () => {
  if (!getApps().length || !$('profile-form')) return;
  const app = getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const form = $('profile-form');
  const message = $('profile-message');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'plain';
  remove.textContent = 'Remove profile picture';
  $('share-badge')?.after(remove);

  form.onsubmit = async event => {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const file = $('avatar-file').files[0];
    if (file && (!file.type.startsWith('image/') || file.size > MAX_AVATAR_BYTES)) {
      message.textContent = 'Choose an image smaller than 2 MB.';
      return;
    }
    try {
      message.textContent = 'Saving profile…';
      const data = { displayName: new FormData(form).get('displayName').trim(), updatedAt: serverTimestamp() };
      if (file) {
        const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `avatars/${user.uid}/${Date.now()}.${extension}`;
        const object = ref(storage, path);
        await uploadBytes(object, file, { contentType: file.type });
        data.avatarPath = path;
        data.avatarURL = await getDownloadURL(object);
        data.photoURL = data.avatarURL;
        $('profile-avatar').src = data.avatarURL;
      }
      await setDoc(doc(db, 'users', user.uid), data, { merge: true });
      message.textContent = 'Profile saved.';
    } catch (error) {
      message.textContent = `Could not save profile: ${error.message}`;
    }
  };

  remove.onclick = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const profile = await getDoc(doc(db, 'users', user.uid));
      const path = profile.get('avatarPath');
      if (path) await deleteObject(ref(storage, path));
      await setDoc(doc(db, 'users', user.uid), { avatarPath: null, avatarURL: null, photoURL: null, updatedAt: serverTimestamp() }, { merge: true });
      $('profile-avatar').src = './icons/icon.svg';
      message.textContent = 'Profile picture removed.';
    } catch (error) {
      message.textContent = `Could not remove profile picture: ${error.message}`;
    }
  };
}, { once: true });
