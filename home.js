(() => {
  const DAILY_CACHE_KEY = 'cawnnak-daily-phrase-v3';
  const DAILY_PHRASE_URL = 'https://us-central1-cawnnak-ca.cloudfunctions.net/getDailyPhrase';
  const DAILY_REFRESH_MS = 15 * 60 * 1000;
  const byId = id => document.getElementById(id);
  let lastDailyFetchAt = 0;

  function addLayerStyles() {
    const style = document.createElement('style');
    style.textContent = '.bar{z-index:60}#learn-title,.learn-controls,#learn #count{position:relative;z-index:2}#learn #cards{position:relative;z-index:1}';
    document.head.append(style);
  }

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `.home-section{margin-top:18px;padding:18px;border:1px solid rgba(255,255,255,0.08);border-radius:16px;background:linear-gradient(145deg,#131d2e,#0d1522);color:#f8fafc;box-shadow:0 8px 24px rgba(0,0,0,0.35)}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.section-heading h2{margin:3px 0 0;font-size:1.16rem;color:#f8fafc}.section-heading>span{font-size:1.5rem}.eyebrow{color:var(--g);font-weight:700;font-size:.72rem;letter-spacing:.08em}.daily-phrase{background:linear-gradient(145deg,#131d2e,#0d1522)}.daily-english{margin:16px 0 4px;font-size:1.3rem;font-weight:700;color:#f8fafc}.daily-chin{margin:0 0 13px;color:#94a3b8;font-size:1.03rem}.continue-learning{background:linear-gradient(145deg,#131d2e,#0d1522)}.continue-learning .status{margin:12px 0;color:#94a3b8}.community-preview{padding-bottom:14px}.community-preview .plain{padding:3px 0;color:var(--g);white-space:nowrap}.leaderboard-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid rgba(255,255,255,0.08);color:#e2e8f0}.leaderboard-row:first-child{margin-top:12px}.leaderboard-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(min-width:760px){#home{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}#home .hero,#home .stats,#home #ios-install,#home #status{grid-column:1/-1}#home .stats{margin:0}.home-section{margin:0}.community-preview{grid-column:1/-1}}@media(max-width:600px){.home-section{padding:15px}.daily-english{font-size:1.17rem}.section-heading h2{font-size:1.08rem}}`;
    document.head.append(style);
  }

  function escapeHtml(value) {
    const node = document.createElement('span');
    node.textContent = value;
    return node.innerHTML;
  }

  function dayKey() { return new Date().toISOString().slice(0, 10); }

  function renderDailyPhrase(phrase) {
    const english = phrase?.english || 'Daily phrase is loading…';
    const chin = phrase?.chin || 'Hakha Chin translation coming soon';
    byId('daily-english').textContent = english;
    byId('daily-chin').textContent = chin;
    byId('daily-listen').onclick = () => {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(english));
    };
  }

  function readCachedDailyPhrase() {
    try {
      const cached = JSON.parse(localStorage.getItem(DAILY_CACHE_KEY) || 'null');
      return cached?.date === dayKey() ? cached.phrase : null;
    } catch (_) { return null; }
  }

  async function setDailyPhrase() {
    renderDailyPhrase(readCachedDailyPhrase());
    try {
      const response = await fetch(`${DAILY_PHRASE_URL}?date=${encodeURIComponent(dayKey())}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error('Daily phrase is unavailable');
      const phrase = await response.json();
      if (!phrase.english) throw new Error('No learner-visible phrases yet');
      localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ date: dayKey(), phrase }));
      lastDailyFetchAt = Date.now();
      renderDailyPhrase(phrase);
    } catch (_) {
      if (!readCachedDailyPhrase()) {
        byId('daily-english').textContent = 'Add a published phrase to see today’s lesson.';
        byId('daily-chin').textContent = '';
      }
    }
  }

  function setContinueLearning() {
    const progress = JSON.parse(localStorage.getItem('cawnnak-progress') || '{"studied":[]}');
    const total = progress.studied?.length || 0;
    byId('continue-copy').textContent = total
      ? `You have studied ${total} phrase${total === 1 ? '' : 's'}. Choose a topic to keep building your confidence.`
      : 'Start with a category that feels useful for today.';
    byId('continue-learning').onclick = () => {
      const lastCategory = localStorage.getItem('cawnnak-last-category');
      if (lastCategory) {
        window.dispatchEvent(new CustomEvent('cawnnak-continue-category', { detail: lastCategory }));
      } else {
        window.dispatchEvent(new CustomEvent('cawnnak-open-view', { detail: 'track-choice' }));
      }
    };
  }

  async function loadLeaderboard() {
    const target = byId('home-leaderboard');
    try {
      const response = await fetch('https://firestore.googleapis.com/v1/projects/cawnnak-ca/databases/(default)/documents/leaderboard');
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      const top = (data.documents || []).map(document => {
        const fields = document.fields || {};
        return {
          name: fields.name?.stringValue || 'Learner',
          totalPoints: Number(fields.totalPoints?.integerValue || fields.totalPoints?.doubleValue || 0)
        };
      }).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5);
      target.innerHTML = top.length
        ? top.map((entry, index) => `<div class="leaderboard-row"><b>${['🏆', '🥈', '🥉'][index] || '🏅'} ${index + 1}. ${escapeHtml(entry.name)}</b><span>${entry.totalPoints} point${entry.totalPoints === 1 ? '' : 's'}</span></div>`).join('')
        : 'Be the first learner on the leaderboard.';
    } catch (_) {
      target.textContent = 'Leaderboard will appear when scores are available.';
    }
  }

  function init() {
    addLayerStyles();
    addStyles();
    setDailyPhrase();
    setContinueLearning();
    loadLeaderboard();
    byId('view-leaderboard').onclick = () => window.dispatchEvent(new CustomEvent('cawnnak-open-view', { detail: 'community' }));
    setInterval(() => setDailyPhrase(), DAILY_REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - lastDailyFetchAt >= DAILY_REFRESH_MS) setDailyPhrase();
    });
  }

  window.CawnnakHome = { refreshLeaderboard: loadLeaderboard };
  window.addEventListener('cawnnak-leaderboard-updated', loadLeaderboard);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
