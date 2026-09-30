(() => {
  const CATEGORY_KEY = 'cawnnak-content-category';
  const $ = id => document.getElementById(id);

  function rememberCategory() {
    const select = $('content-category');
    if (!select) return;
    const saved = localStorage.getItem(CATEGORY_KEY);
    if (saved && [...select.options].some(option => option.value === saved)) {
      select.value = saved;
    }
    select.addEventListener('change', () => localStorage.setItem(CATEGORY_KEY, select.value));
    $('form')?.addEventListener('reset', () => setTimeout(() => {
      restoreCategory();
      document.querySelector('#form select[name="quiz"]')?.dispatchEvent(new Event('change'));
    }, 0));
  }

  function restoreCategory() {
    const select = $('content-category');
    const saved = localStorage.getItem(CATEGORY_KEY);
    if (!select || !saved || select.value === saved || ![...select.options].some(option => option.value === saved)) return;
    select.value = saved;
    select.dispatchEvent(new Event('change'));
  }

  function customQuizSetting() {
    const select = document.querySelector('#form select[name="quiz"]');
    if (!select || select.dataset.customized) return;
    select.dataset.customized = 'true';
    select.classList.add('native-select');
    const box = document.createElement('div');
    box.className = 'custom-select quiz-setting-select';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    const list = document.createElement('ul');
    list.className = 'hidden';
    const update = () => {
      trigger.textContent = select.options[select.selectedIndex]?.textContent || 'Choose';
      [...list.children].forEach(item => item.classList.toggle('selected', item.dataset.value === select.value));
    };
    [...select.options].forEach(option => {
      const item = document.createElement('li');
      item.textContent = option.textContent;
      item.dataset.value = option.value;
      item.onclick = () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        list.classList.add('hidden');
        update();
      };
      list.append(item);
    });
    trigger.onclick = event => {
      event.stopPropagation();
      document.querySelectorAll('.custom-select ul').forEach(menu => { if (menu !== list) menu.classList.add('hidden'); });
      list.classList.toggle('hidden');
    };
    select.addEventListener('change', update);
    box.append(trigger, list);
    select.after(box);
    update();
  }

  function placeQuizButton() {
    const start = $('start-quiz');
    const recentHeading = $('quiz-lobby')?.querySelector('h3');
    if (start && recentHeading) recentHeading.before(start);
  }

  function syncVoiceDisplay(select) {
    const trigger = select.nextElementSibling?.querySelector('button');
    if (trigger) trigger.textContent = select.options[select.selectedIndex]?.textContent || 'Choose';
  }

  function rememberVoice() {
    const select = $('voice-select');
    if (!select || !select.options.length || /Loading voices/i.test(select.options[0].textContent)) return;
    const saved = localStorage.getItem('cawnnak-voice');
    const preferred = [...select.options].find(option => option.textContent === saved)
      || [...select.options].find(option => /\(en-US\)/i.test(option.textContent));
    if (preferred) {
      select.value = preferred.value;
      select.dispatchEvent(new Event('change'));
      syncVoiceDisplay(select);
    }
    if (!select.dataset.voiceListenerReady) {
      select.dataset.voiceListenerReady = 'true';
      select.addEventListener('change', () => {
        localStorage.setItem('cawnnak-voice', select.options[select.selectedIndex]?.textContent || '');
        syncVoiceDisplay(select);
      });
    }
  }

  function addDesktopHomeLayout() {
    const style = document.createElement('style');
    style.textContent = `.quick-add-button{width:44px;height:44px;min-width:44px;padding:0;font-size:1.25rem;line-height:1}@media(min-width:760px){#home{grid-template-columns:repeat(3,minmax(0,1fr))}#home .community-preview{grid-column:auto}}`;
    document.head.append(style);
  }

  function reinforceQuizHaptics() {
    document.addEventListener('click', event => {
      const option = event.target.closest?.('.option');
      if (!option) return;
      setTimeout(() => {
        if (!navigator.vibrate) return;
        navigator.vibrate(option.classList.contains('wrong') ? [100, 55, 150] : [55, 35, 80]);
      }, 0);
    });
  }

  function init() {
    addDesktopHomeLayout();
    rememberCategory();
    restoreCategory();
    customQuizSetting();
    placeQuizButton();
    rememberVoice();
    reinforceQuizHaptics();
    new MutationObserver(() => {
      restoreCategory();
      customQuizSetting();
      placeQuizButton();
      rememberVoice();
    }).observe($('form'), { childList: true, subtree: true });
    new MutationObserver(rememberVoice).observe($('voice-select'), { childList: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
