const monitor = window.CAWNNAK_ERROR_MONITOR || {};

function report(type, error) {
  if (!monitor.endpoint) return;
  const payload = JSON.stringify({
    type,
    message: String(error?.message || error || 'Unknown error').slice(0, 1000),
    stack: String(error?.stack || '').slice(0, 4000),
    url: location.href,
    userAgent: navigator.userAgent,
    at: new Date().toISOString()
  });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(monitor.endpoint, new Blob([payload], { type: 'application/json' }));
    else fetch(monitor.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true });
  } catch (_) {}
}

window.addEventListener('error', event => report('window.error', event.error || event.message));
window.addEventListener('unhandledrejection', event => report('unhandledrejection', event.reason));
