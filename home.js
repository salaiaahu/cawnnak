(() => {
  const DAILY_CACHE_KEY = 'cawnnak-daily-phrase-v2';
  const DAILY_PHRASE_URL = 'https://us-central1-cawnnak-ca.cloudfunctions.net/getDailyPhrase';
  const byId = id => document.getElementById(id);

  function addLayerStyles() {
    const style = document.createElement('style');
    style.textContent = '.bar{z-index:60}#learn-title,.learn-controls,#learn #count{position:relative;z-index:2}#learn #cards{position:relative;z-index:1}';
    document.head.append(style);
  }

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `.home-section{margin-top:18px;padding:18px;border:1px solid var(--l);border-radius:16px;background:#fff;box-shadow:0 3px 12px #17342b08}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.section-heading h2{margin:3px 0 0;font-size:1.16rem}.section-heading>span{font-size:1.5rem}.eyebrow{color:var(--g);font-weight:800;font-size:.72rem;letter-spacing:.08em}.daily-phrase{background:linear-gradient(135deg,#fffdf4,#eef8f1)}.daily-english{margin:16px 0 4px;font-size:1.3rem;font-weight:800;color:var(--i)}.daily-chin{margin:0 0 13px;color:#376456;font-size:1.03rem}.continue-learning{background:#e5f4eb}.continue-learning .status{margin:12px 0}.community-preview{padding-bottom:14px}.community-preview .plain{padding:3px 0;color:var(--g);white-space:nowrap}.leaderboard-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--l);color:var(--i)}.leaderboard-row:first-child{margin-top:12px}.leaderboard-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(min-width:760px){#home{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}#home .hero,#home .stats,#home #ios-install,#home #status{grid-column:1/-1}#home .stats{margin:0}.home-section{margin:0}.community-preview{grid-column:1/-1}}@media(max-width:600px){.home-section{padding:15px}.daily-english{font-size:1.17rem}.section-heading h2{font-size:1.08rem}}`;
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
      return cached?.phrase || null;
    } catch (_) { return null; }
  }

  async function setDailyPhrase() {
    renderDailyPhrase(readCachedDailyPhrase());
    try {
      const response = await fetch(DAILY_PHRASE_URL);
      if (!response.ok) throw new Error('Daily phrase is unavailable');
      const phrase = await response.json();
      if (!phrase.english) throw new Error('No learner-visible phrases yet');
      localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({ date: dayKey(), phrase }));
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
    byId('continue-learning').onclick = () => document.querySelector('[data-v="categories"]')?.click();
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
          score: Number(fields.bestScore?.integerValue || fields.bestScore?.doubleValue || 0)
        };
      }).sort((a, b) => b.score - a.score).slice(0, 3);
      target.innerHTML = top.length
        ? top.map((entry, index) => `<div class="leaderboard-row"><b>${index + 1}. ${escapeHtml(entry.name)}</b><span>${entry.score}%</span></div>`).join('')
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
    byId('view-leaderboard').onclick = () => document.querySelector('[data-v="quiz"]')?.click();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
