import { getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';
import { getMessaging, getToken, isSupported, onMessage } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';

const config = window.CAWNNAK_FIREBASE_SECURITY || {};

async function setupAppCheck(app) {
  if (!config.appCheckSiteKey) return;
  try {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(config.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  } catch (error) {
    console.warn('App Check could not initialize.', error);
  }
}

async function setupMessaging(app, user) {
  if (!config.vapidKey || !('Notification' in window) || !(await isSupported())) return;
  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return;
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
    if (token) await httpsCallable(getFunctions(app), 'registerFcmToken')({ token });
    onMessage(getMessaging(app), payload => {
      const title = payload.notification?.title || 'Mirang Holh Cawnnak';
      const body = payload.notification?.body || 'You have a new notification.';
      navigator.serviceWorker.ready.then(worker => worker.showNotification(title, { body, icon: './icons/icon.svg' }));
    });
  } catch (error) {
    console.warn('Push notifications are not available.', error);
  }
}

window.addEventListener('load', () => {
  if (!getApps().length) return;
  const app = getApp();
  setupAppCheck(app);
  onAuthStateChanged(getAuth(app), user => { if (user) setupMessaging(app, user); });
}, { once: true });
