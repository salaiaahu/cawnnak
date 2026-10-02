const STORAGE_KEY = 'cawnnak-learning-tools-v1';
const $ = id => document.getElementById(id);
let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"goal":5,"days":{},"favorites":{},"missed":[],"categories":{}}');

function today() { return new Date().toISOString().slice(0, 10); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderDashboard(); window.dispatchEvent(new Event('cawnnak-learning-changed')); }
function escapeHtml(value) { const node = document.createElement('span'); node.textContent = String(value || ''); return node.innerHTML; }

function streak() {
  let days = 0;
  const cursor = new Date();
  while (state.days[cursor.toISOString().slice(0, 10)]?.length) {
    days += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

function addStudy(id, category) {
  const date = today();
  state.days[date] ||= [];
  if (!state.days[date].includes(id)) state.days[date].push(id);
  state.categories[category] ||= [];
  if (!state.categories[category].includes(id)) state.categories[category].push(id);
  save();
}

function toggleFavorite(card) {
  const id = card.querySelector('.mark')?.dataset.id;
  if (!id) return;
  if (state.favorites[id]) delete state.favorites[id];
  else state.favorites[id] = {
    english: card.querySelector('h3')?.textContent || '',
    chin: card.querySelector('p')?.textContent || '',
    category: card.querySelector('.label')?.textContent || ''
  };
  save();
  enhanceCards();
}

function enhanceCards() {
  document.querySelectorAll('#cards .card').forEach(card => {
    const footer = card.querySelector('footer');
    const id = card.querySelector('.mark')?.dataset.id;
    if (!footer || !id || footer.querySelector('.favorite')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plain favorite';
    button.textContent = state.favorites[id] ? '★ Saved' : '☆ Save';
    button.setAttribute('aria-pressed', String(Boolean(state.favorites[id])));
    button.onclick = () => {
      toggleFavorite(card);
      button.textContent = state.favorites[id] ? '★ Saved' : '☆ Save';
      button.setAttribute('aria-pressed', String(Boolean(state.favorites[id])));
      button.classList.toggle('saved', Boolean(state.favorites[id]));
    };
    button.classList.toggle('saved', Boolean(state.favorites[id]));
    footer.insertBefore(button, footer.firstChild);
  });
}

function addDashboard() {
  if ($('learning-dashboard')) return;
  const home = $('home');
  if (!home) return;
  const section = document.createElement('section');
  section.id = 'learning-dashboard';
  section.className = 'home-section learning-dashboard';
  section.innerHTML = '<div class="section-heading"><div><small class="eyebrow">YOUR LEARNING</small><h2>Daily progress</h2></div><button id="learning-review" class="plain" type="button">Review →</button></div><div class="learning-metrics"><div><b id="daily-progress">0 / 5</b><span>Today’s goal</span></div><div><b id="learning-streak">0</b><span>Day streak</span></div><div><b id="favorite-count">0</b><span>Saved phrases</span></div></div><div class="learning-actions"><button id="change-goal" class="plain" type="button">Change goal</button><span id="missed-count" class="status"></span></div>';
  home.querySelector('#status')?.before(section);
  $('learning-review').onclick = openReview;
  $('change-goal').onclick = () => {
    state.goal = state.goal === 5 ? 10 : state.goal === 10 ? 15 : 5;
    save();
  };
  const style = document.createElement('style');
  style.textContent = `.learning-dashboard{background:linear-gradient(135deg,#edf8ff,#f8fff9)}.learning-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:15px 0}.learning-metrics div{padding:10px;border:1px solid var(--l);border-radius:11px;background:#fff}.learning-metrics b{display:block;font-size:1.12rem;color:var(--g)}.learning-metrics span{font-size:.72rem;color:var(--m)}.learning-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.favorite{font-size:.9rem}@media(max-width:600px){.learning-metrics{gap:6px}.learning-metrics div{padding:8px}.learning-metrics b{font-size:1rem}}`;
  document.head.append(style);
}

function renderDashboard() {
  if (!$('daily-progress')) return;
  const completed = state.days[today()]?.length || 0;
  $('daily-progress').textContent = `${completed} / ${state.goal}`;
  $('learning-streak').textContent = streak();
  $('favorite-count').textContent = Object.keys(state.favorites).length;
  $('missed-count').textContent = state.missed.length ? `${state.missed.length} phrase${state.missed.length === 1 ? '' : 's'} to review` : 'No missed phrases to review.';
}

function openReview() {
  window.dispatchEvent(new CustomEvent('cawnnak-open-view', { detail: 'review' }));
}

function renderReview() {
  const content = $('review-content');
  if (!content) return;
  const favorites = Object.values(state.favorites);
  const misses = state.missed;
  content.innerHTML = `<section class="panel review-section"><h2>Missed in quizzes</h2><div class="review-list">${misses.length ? misses.map(item => `<div class="review-item"><div><b>${escapeHtml(item.english)}</b><span>Correct answer: ${escapeHtml(item.correct)}</span></div><button class="plain review-remove" data-english="${escapeHtml(item.english)}">Mark reviewed</button></div>`).join('') : '<p class="status">Nothing to review yet.</p>'}</div></section><section class="panel review-section"><h2>Saved phrases</h2><div class="review-list">${favorites.length ? favorites.map(item => `<div class="review-item"><div><b>${escapeHtml(item.english)}</b><span>${escapeHtml(item.chin)} · ${escapeHtml(item.category)}</span></div><button class="plain review-listen" data-english="${escapeHtml(item.english)}">🔊 Listen</button></div>`).join('') : '<p class="status">Save phrases from a category to find them here.</p>'}</div></section>`;
  content.querySelectorAll('.review-remove').forEach(button => button.onclick = () => {
    state.missed = state.missed.filter(item => item.english !== button.dataset.english);
    save();
    renderReview();
  });
  content.querySelectorAll('.review-listen').forEach(button => button.onclick = () => {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(button.dataset.english));
  });
}

window.addEventListener('load', () => {
  addDashboard();
  renderDashboard();
  new MutationObserver(enhanceCards).observe($('cards'), { childList: true });
  document.addEventListener('click', event => {
    const mark = event.target.closest?.('.mark');
    if (mark) {
      const card = mark.closest('.card');
      setTimeout(() => addStudy(mark.dataset.id, card?.querySelector('.label')?.textContent || 'General'), 0);
    }
    const option = event.target.closest?.('.option');
    if (option) setTimeout(() => {
      if (!option.classList.contains('wrong')) return;
      const english = $('question')?.textContent?.trim();
      const correct = document.querySelector('.option.correct')?.textContent?.trim() || '';
      if (english && !state.missed.some(item => item.english === english)) {
        state.missed.unshift({ english, correct, at: Date.now() });
        state.missed = state.missed.slice(0, 30);
        save();
      }
    }, 0);
  }, true);
}, { once: true });

window.CawnnakLearning = {
  getState: () => JSON.parse(JSON.stringify(state)),
  applyMergedState: learning => { state = { ...state, ...learning }; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); renderDashboard(); },
  renderReview
};

import('./achievements.js').catch(error => console.warn('Could not load achievements', error));
