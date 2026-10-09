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

  function addVisualStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #home { padding-top: 20px; }
      #home .hero { min-height: 310px; padding: 40px; position: relative; overflow: hidden; }
      .hero-kicker { display: inline-flex; padding: 6px 10px; border: 1px solid rgba(96,165,250,.3); border-radius: 999px; background: rgba(59,130,246,.12); color: #93c5fd; font-size: .68rem; font-weight: 800; letter-spacing: .12em; }
      #home .hero h2 { position: relative; z-index: 1; max-width: 530px; margin: 16px 0 8px; font-size: clamp(2rem, 5vw, 3.35rem); line-height: 1.03; }
      #home .hero p { position: relative; z-index: 1; max-width: 510px; margin: 0 0 24px; }
      .hero-actions { position: relative; z-index: 2; display: flex; flex-wrap: wrap; gap: 9px; }
      .hero-actions .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
      .hero-visual { position: absolute; right: 5%; top: 50%; width: 210px; height: 210px; transform: translateY(-50%); pointer-events: none; }
      .hero-orb { position: absolute; display: grid; place-items: center; border-radius: 50%; font-weight: 800; box-shadow: inset 0 1px 1px rgba(255,255,255,.5), 0 18px 35px rgba(0,0,0,.25); }
      .hero-orb-one { width: 138px; height: 138px; left: 30px; top: 28px; background: linear-gradient(135deg,#60a5fa,#2563eb); color: white; font-size: 3.8rem; }
      .hero-orb-two { width: 75px; height: 75px; right: 0; bottom: 9px; background: linear-gradient(135deg,#fbbf24,#f59e0b); color: #422006; font-size: 2rem; }
      .hero-spark { position: absolute; color: #fcd34d; text-shadow: 0 0 20px #fbbf24; font-size: 1.8rem; }
      .hero-spark-one { left: 8px; top: 3px; }.hero-spark-two { right: 9px; top: 20px; font-size: 1rem; }
      .journey-stats { grid-template-columns: 1.45fr 1fr 1fr !important; gap: 12px; margin: 16px 0 2px !important; }
      .journey-stats .stat { min-height: 104px; display: flex; align-items: center; gap: 12px; padding: 15px !important; }
      .journey-stats .stat b { display: block; font-size: 1.5rem !important; }.journey-stats .stat span:not(.stat-icon) { display: block; margin-top: 3px; color: var(--ai-muted); font-size: .75rem; }
      .journey-progress { background: linear-gradient(135deg,#172b4d,#111827) !important; }
      .progress-ring { display: grid; flex: 0 0 62px; width: 62px; height: 62px; place-items: center; border-radius: 50%; background: conic-gradient(#60a5fa 0deg 42deg,rgba(255,255,255,.1) 42deg 360deg); position: relative; }
      .progress-ring::before { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: #121c2d; }.progress-ring span { position: relative; color: #dbeafe !important; font-size: .9rem !important; font-weight: 800; }
      .stat-icon { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 11px; background: rgba(245,158,11,.14); color: #fbbf24; font-size: 1.15rem; }.stat-mode .stat-icon { color: #67e8f9; background: rgba(34,211,238,.12); }
      .score-copy { min-width: 0; }.score-copy b { white-space: nowrap !important; overflow: visible !important; text-overflow: clip !important; }.score-copy span { white-space: nowrap; }
      .daily-phrase { display: grid; grid-template-columns: auto 1fr; column-gap: 15px; }.daily-phrase .section-heading { grid-column: 1/-1; }.phrase-visual { display: grid; width: 52px; height: 52px; place-items: center; border-radius: 17px; background: linear-gradient(145deg,rgba(245,158,11,.32),rgba(245,158,11,.08)); color: #fbbf24; font-size: 1.6rem; }.phrase-copy { min-width: 0; }.daily-english { margin-top: 2px !important; }
      .continue-learning { position: relative; overflow: hidden; }.continue-visual { position: absolute; right: 16px; bottom: -20px; display: grid; width: 106px; height: 106px; place-items: center; border: 1px solid rgba(96,165,250,.18); border-radius: 50%; background: rgba(59,130,246,.08); color: rgba(96,165,250,.6); font-size: 3.4rem; }.continue-learning .section-heading,.continue-learning .status,.continue-learning .btn { position: relative; z-index: 1; }.continue-learning .status { max-width: 72%; }
      .community-preview .section-heading { align-items: center; }.leaderboard-row { padding: 11px 4px !important; }.leaderboard-row b:first-letter { color: #fbbf24; }
      @media (max-width:600px) { #home { padding-top: 12px; padding-bottom: 24px; } #home .hero { min-height: 262px; padding: 23px 19px; border-radius: 20px; } #home .hero h2 { max-width: 250px; margin: 12px 0 8px; font-size: 2rem; } #home .hero p { max-width: 235px; margin-bottom: 17px; font-size: .82rem; line-height: 1.45 !important; } .hero-visual { right: -28px; top: 46%; transform: scale(.72) translateY(-50%); transform-origin: center right; } .hero-actions { gap: 7px; } #home .hero .hero-actions .btn { width: auto; padding: 9px 10px; font-size: .8rem; } .journey-stats { grid-template-columns: 1.35fr 1fr !important; gap: 8px; margin: 12px 0 2px !important; } .journey-stats .stat { min-height: 77px; gap: 8px; padding: 10px !important; } .journey-stats .stat:last-child { grid-column: 1/-1; min-height: 52px; } .progress-ring { flex-basis: 48px; width: 48px; height: 48px; }.progress-ring::before { inset: 5px; }.journey-stats .stat b { font-size: 1.13rem !important; }.stat-icon { width: 30px; height: 30px; }.stat-score { align-items: center !important; }.score-copy { display: flex; flex-direction: column; align-items: flex-start; }.score-copy span { margin-top: 1px !important; font-size: .68rem !important; }.daily-phrase { column-gap: 11px; }.phrase-visual { width: 42px; height: 42px; border-radius: 13px; font-size: 1.25rem; }.daily-english { font-size: 1.05rem !important; }.daily-chin { font-size: .85rem !important; }.continue-learning .status { max-width: 75%; }.continue-visual { width: 92px; height: 92px; right: -8px; bottom: -28px; } }
    `;
    document.head.append(style);
  }

  function addGameStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #home .hero { background: radial-gradient(circle at 80% 22%,rgba(250,204,21,.2),transparent 18%), radial-gradient(circle at 11% 87%,rgba(168,85,247,.22),transparent 38%), linear-gradient(135deg,#121e41 0%,#172554 52%,#312e81 100%) !important; border-color: rgba(129,140,248,.48) !important; box-shadow: 0 22px 0 #0a1230,0 30px 55px rgba(0,0,0,.48) !important; }
      #home .hero::after { display:block !important; content:''; position:absolute; z-index:0; inset:auto -5% -45% auto; width:340px; height:180px; border:2px solid rgba(255,255,255,.1); border-radius:50%; transform:rotate(-22deg); }
      .player-hud { position:relative; z-index:2; display:flex; align-items:center; gap:9px; width:max-content; max-width:100%; padding:6px 9px 6px 6px; border:1px solid rgba(255,255,255,.2); border-radius:99px; background:rgba(9,15,42,.46); box-shadow:inset 0 1px rgba(255,255,255,.12); color:#e0e7ff; }
      .player-avatar { display:grid; flex:0 0 30px; width:30px; height:30px; place-items:center; border:2px solid #fef08a; border-radius:50%; background:linear-gradient(135deg,#f59e0b,#ea580c); color:white; box-shadow:0 0 0 2px rgba(245,158,11,.25); }
      .player-hud b,.player-hud small { display:block; }.player-hud b { font-size:.62rem; letter-spacing:.1em; }.player-hud small { margin-top:1px; color:#c7d2fe; font-size:.68rem; }.player-hud em { margin-left:4px; padding:4px 7px; border-radius:99px; background:rgba(250,204,21,.16); color:#fde68a; font-size:.68rem; font-style:normal; font-weight:800; }
      .hero-kicker { margin-top:17px; border-color:rgba(253,224,71,.28); background:rgba(250,204,21,.12); color:#fde68a; }
      #home .hero h2 { background:linear-gradient(90deg,#fff,#ddd6fe 52%,#fef08a) !important; -webkit-background-clip:text !important; }
      .hero-actions .btn { border-radius:13px !important; text-transform:uppercase; letter-spacing:.045em; font-size:.78rem !important; }.hero-actions .start-learning { background:linear-gradient(180deg,#fbbf24,#ea580c) !important; border-color:#fde68a !important; box-shadow:0 5px 0 #9a3412,0 10px 20px rgba(234,88,12,.25) !important; }.hero-actions .start-learning:active { transform:translateY(4px) !important; box-shadow:0 1px 0 #9a3412 !important; }
      .journey-stats .stat { position:relative; border-radius:16px !important; }.journey-stats .stat::before { content:''; position:absolute; top:0; left:14px; right:14px; height:2px; background:linear-gradient(90deg,transparent,#818cf8,transparent); }.journey-progress { background:linear-gradient(135deg,#1e1b4b,#172554) !important; }.progress-ring { background:conic-gradient(#facc15 0deg 55deg,#fb923c 55deg 78deg,rgba(255,255,255,.1) 78deg 360deg) !important; }.progress-ring::before { background:#171b41 !important; }.stat-score { background:linear-gradient(135deg,#2a1d42,#1d1734) !important; }.stat-mode { background:linear-gradient(135deg,#12363a,#102329) !important; }
      .home-section { border-radius:20px !important; }.home-section::before { background:linear-gradient(90deg,#facc15,rgba(129,140,248,.7),transparent) !important; }.daily-phrase { background:linear-gradient(145deg,#17213c,#10192e) !important; }.phrase-visual { background:linear-gradient(145deg,#facc15,#ea580c) !important; border:2px solid #fde68a; color:white !important; box-shadow:0 5px 0 #9a3412; }.continue-learning { background:linear-gradient(145deg,#241b4d,#171d42) !important; }.continue-visual { border-color:rgba(196,181,253,.3) !important; background:rgba(139,92,246,.14) !important; color:#c4b5fd !important; }.community-preview { background:linear-gradient(145deg,#20273d,#13192b) !important; }.leaderboard-row { border-top-color:rgba(250,204,21,.15) !important; }
      .track-choice-card,.category { border-radius:20px !important; }.track-choice-card::after { content:'PLAY'; position:absolute; right:17px; bottom:10px; color:rgba(255,255,255,.17); font-size:.6rem; font-weight:900; letter-spacing:.14em; }.track-card-arrow { background:rgba(250,204,21,.12) !important; color:#fde68a !important; }
      .quest-map-card { background:linear-gradient(145deg,#172b4d,#172554) !important; }.quest-map-card .status { max-width:380px; margin:12px 0 16px; }.quest-map-card .btn { border-radius:13px; background:linear-gradient(180deg,#60a5fa,#2563eb) !important; box-shadow:0 4px 0 #1e3a8a !important; }
      .category-game-head,.learn-game-head { display:flex; align-items:center; gap:16px; margin-bottom:18px; padding:21px; border:1px solid rgba(129,140,248,.32); border-radius:22px; background:radial-gradient(circle at 88% 14%,rgba(250,204,21,.18),transparent 18%),linear-gradient(135deg,#172554,#1e1b4b); box-shadow:0 10px 0 #10183a,0 22px 38px rgba(0,0,0,.28); }.category-game-head h1,.learn-game-head h1 { margin:3px 0 4px; color:#fff; font-size:clamp(1.35rem,4vw,2rem); }.category-game-head p,.learn-game-head p { margin:0; color:#c7d2fe; font-size:.88rem; }.category-game-emblem,.learn-game-emblem { display:grid; flex:0 0 58px; width:58px; height:58px; place-items:center; border:2px solid #fde68a; border-radius:18px; background:linear-gradient(145deg,#f59e0b,#c2410c); box-shadow:0 5px 0 #7c2d12; color:#fff; font-size:1.8rem; }.learn-game-emblem { background:linear-gradient(145deg,#818cf8,#4f46e5); border-color:#c4b5fd; box-shadow:0 5px 0 #312e81; }
      #categories .category-grid { grid-template-columns:repeat(auto-fill,minmax(205px,1fr)); gap:15px; }.category-tile { min-height:164px; }.category { position:relative; width:100%; min-height:164px; padding:18px !important; overflow:hidden; text-align:left; background:linear-gradient(145deg,#182947,#111b30) !important; box-shadow:0 8px 0 #0b1222,0 18px 30px rgba(0,0,0,.28) !important; }.category::before { content:''; position:absolute; inset:0 auto 0 0; width:4px; background:linear-gradient(#facc15,#f97316); }.category .icon { display:grid; width:48px; height:48px; place-items:center; margin-bottom:13px; border:1px solid rgba(255,255,255,.18); border-radius:15px; background:rgba(99,102,241,.22); font-size:1.6rem; }.category b { display:block; padding-right:32px; }.category small { display:block; margin-top:5px; color:#93c5fd !important; }.category::after { content:''; position:absolute; right:16px; bottom:15px; }.category:hover { transform:translateY(-4px) !important; border-color:rgba(250,204,21,.58) !important; }
      #learn .learn-controls { margin-bottom:10px; }.learn-card { position:relative; min-height:215px !important; overflow:hidden; border-radius:20px !important; background:linear-gradient(145deg,#162745,#101a2e) !important; box-shadow:0 8px 0 #0a1222,0 18px 32px rgba(0,0,0,.28) !important; }.learn-card::before { content:''; position:absolute; top:14px; right:15px; }.learn-card h3 { max-width:80%; margin-top:24px !important; color:#f8fafc !important; font-size:1.25rem !important; }.learn-card p { color:#bfdbfe !important; font-size:1.03rem; }.learn-card footer { gap:8px; border-top:1px solid rgba(255,255,255,.08); padding-top:12px; }.learn-card footer .plain { border-radius:10px; background:rgba(255,255,255,.06); color:#93c5fd !important; }.learn-card .mark.learned { color:#fde68a !important; background:rgba(250,204,21,.14) !important; }
      /* Content-first game boards: depth and glow live in the cards, not extra headings. */
      #categories,#learn { position:relative; isolation:isolate; }.category-grid,.cards { perspective:1000px; }.category { min-height:174px; border:1px solid rgba(129,140,248,.38) !important; background:radial-gradient(circle at 83% 13%,rgba(250,204,21,.18),transparent 26%),linear-gradient(145deg,#223b67 0%,#172b4d 48%,#101a31 100%) !important; box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset -12px -14px 24px rgba(4,10,28,.32),0 8px 0 #0a1020,0 18px 28px rgba(0,0,0,.32) !important; transform:rotateX(1deg); }.category::before { width:5px; background:linear-gradient(#fde047,#f97316 60%,#7c2d12) !important; box-shadow:2px 0 12px rgba(250,204,21,.4); }.category::after { content:'✦' !important; right:14px; bottom:12px; width:28px; height:28px; display:grid; place-items:center; border:1px solid rgba(253,224,71,.35); border-radius:50%; background:rgba(250,204,21,.1); color:#fde68a; font-size:.9rem; letter-spacing:0; }.category .icon { box-shadow:inset 0 1px rgba(255,255,255,.25),0 5px 0 rgba(7,16,45,.7),0 9px 16px rgba(0,0,0,.2); }.category:hover { transform:translateY(-5px) rotateX(0deg) !important; box-shadow:inset 0 1px 0 rgba(255,255,255,.24),inset -12px -14px 24px rgba(4,10,28,.25),0 11px 0 #0a1020,0 25px 34px rgba(0,0,0,.38) !important; }
      .learn-card { border:1px solid rgba(96,165,250,.35) !important; background:radial-gradient(circle at 86% 12%,rgba(196,181,253,.2),transparent 28%),radial-gradient(circle at 11% 98%,rgba(56,189,248,.12),transparent 34%),linear-gradient(145deg,#1c3560,#142642 52%,#0d172b) !important; box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset -14px -16px 25px rgba(4,10,28,.32),0 8px 0 #080f1e,0 19px 32px rgba(0,0,0,.3) !important; transform:rotateX(1deg); }.learn-card::before { content:'✦' !important; display:grid; width:29px; height:29px; place-items:center; border:1px solid rgba(196,181,253,.4); border-radius:50%; background:rgba(129,140,248,.14); color:#ddd6fe; font-size:.9rem; letter-spacing:0; }.learn-card:hover { transform:translateY(-5px) rotateX(0deg); box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset -14px -16px 25px rgba(4,10,28,.26),0 11px 0 #080f1e,0 25px 36px rgba(0,0,0,.38) !important; }
      /* Compact collectible-style phrase cards. */
      #learn .cards { gap:13px; }.learn-card { min-height:0 !important; padding:17px 16px 14px !important; border-radius:18px !important; isolation:isolate; transform-style:preserve-3d; }.learn-card::after { content:''; position:absolute; z-index:-1; right:9px; bottom:-8px; left:9px; height:18px; border-radius:0 0 16px 16px; background:linear-gradient(90deg,#0a1122,#172554 50%,#0a1122); box-shadow:0 12px 22px rgba(0,0,0,.36); }.learn-card h3 { margin:18px 38px 5px 0 !important; line-height:1.16; letter-spacing:-.025em; }.learn-card p { min-height:0; margin:0 !important; line-height:1.35; }.learn-card footer { margin-top:13px !important; padding-top:11px !important; }.learn-card footer .plain { min-height:34px; padding:7px 9px !important; border:1px solid rgba(255,255,255,.06); font-size:.82rem; font-weight:750; box-shadow:inset 0 1px rgba(255,255,255,.1),0 3px 0 rgba(5,12,26,.68); }.learn-card footer .plain:active { transform:translateY(2px); box-shadow:inset 0 1px rgba(255,255,255,.1),0 1px 0 rgba(5,12,26,.68); }.learn-card footer .mark { margin-left:auto; color:#dbeafe !important; background:linear-gradient(180deg,rgba(59,130,246,.25),rgba(30,64,175,.24)) !important; border-color:rgba(96,165,250,.2) !important; }.learn-card .card-edit-top { position:absolute; top:11px; right:11px; z-index:2; display:grid; width:32px; height:32px; place-items:center; border:1px solid rgba(196,181,253,.28); border-radius:11px; background:rgba(129,140,248,.15); color:#bfdbfe !important; box-shadow:0 3px 0 rgba(5,12,26,.55); }
      @media(max-width:600px) { .player-hud { padding:5px 7px 5px 5px; }.player-hud em { font-size:.62rem; }.hero-kicker { margin-top:13px; } #home .hero { box-shadow:0 12px 0 #0a1230,0 22px 38px rgba(0,0,0,.42) !important; } .hero-actions .btn { font-size:.7rem !important; letter-spacing:0; } .category-game-head,.learn-game-head { margin:0 0 14px; padding:16px; gap:12px; }.category-game-emblem,.learn-game-emblem { flex-basis:46px; width:46px; height:46px; border-radius:14px; font-size:1.35rem; }.category-game-head p,.learn-game-head p { font-size:.78rem; } #categories .category-grid { grid-template-columns:1fr 1fr; gap:10px; }.category-tile,.category { min-height:145px; }.category { padding:14px !important; }.category .icon { width:40px; height:40px; margin-bottom:9px; border-radius:13px; font-size:1.3rem; }.category b { font-size:.92rem !important; }.category::after { right:12px; bottom:12px; font-size:.53rem; }.learn-card { min-height:0 !important; padding:15px 14px 13px !important; }.learn-card h3 { margin-top:17px !important; font-size:1.12rem !important; }.learn-card footer { gap:6px; margin-top:11px !important; padding-top:10px !important; }.learn-card footer .plain { min-height:32px; padding:6px 8px !important; font-size:.78rem; } }
    `;
    document.head.append(style);
  }

  function escapeHtml(value) {
    const node = document.createElement('span');
    node.textContent = value;
    return node.innerHTML;
  }

  function dayKey() { return new Date().toISOString().slice(0, 10); }

  function renderDailyPhrase(phrase) {
    if (!byId('daily-english') || !byId('daily-chin')) return;
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
    if (!byId('daily-english')) return;
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
    const ring = byId('progress-ring-value');
    if (ring) ring.textContent = total;
    const level = Math.floor(total / 8) + 1;
    const levelTarget = byId('player-level');
    const xpTarget = byId('xp-label');
    if (levelTarget) levelTarget.textContent = level;
    if (xpTarget) xpTarget.textContent = `${total * 10} XP`;
    byId('continue-copy').textContent = total
      ? `${total} words unlocked. Your next mission is ready when you are.`
      : 'Choose your first mission and unlock your first words.';
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
    addVisualStyles();
    addGameStyles();
    setDailyPhrase();
    setContinueLearning();
    loadLeaderboard();
    byId('view-leaderboard').onclick = () => window.dispatchEvent(new CustomEvent('cawnnak-open-view', { detail: 'community' }));
    setInterval(() => setDailyPhrase(), DAILY_REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - lastDailyFetchAt >= DAILY_REFRESH_MS) setDailyPhrase();
    });
  }

  window.CawnnakHome = { refreshLeaderboard: loadLeaderboard, refreshProgress: setContinueLearning };
  window.addEventListener('cawnnak-leaderboard-updated', loadLeaderboard);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
