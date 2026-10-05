const CACHE = "mirang-holh-cawnnak-v65";
const APP_SHELL = [
  "./",
  "./index.html",
  "./home.js",
  "./manager-enhancements.js",
  "./quick-add.js",
  "./admin-functions.js",
  "./notifications.js",
  "./profile-storage.js",
  "./history.js",
  "./content-workflow.js",
  "./content-tools.js",
  "./secure-quiz.js",
  "./learning-progress.js",
  "./learning-sync.js",
  "./account-controls.js",
  "./firebase-security.js",
  "./error-monitor.js",
  "./achievements.js",
  "./manifest.json",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok || response.type === "opaque")
            caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(
          () =>
            cached ||
            (event.request.mode === "navigate"
              ? caches.match("./index.html")
              : Response.error()),
        );
      return cached || network;
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch (_) {
    payload = { body: event.data?.text() || "" };
  }
  const title =
    payload.notification?.title || payload.title || "Mirang Holh Cawnnak";
  const options = {
    body:
      payload.notification?.body ||
      payload.body ||
      "You have a new learning notification.",
    icon: "./icons/icon.svg",
    data: payload.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((openClients) => {
        if (openClients.length) return openClients[0].focus();
        return clients.openWindow("./");
      }),
  );
});
