// 검색과 궁전 조작에 실제로 필요한 화면 폭과 높이를 각각 확보한다.
(() => {
  const ui = document.getElementById('ui-layer');
  const controls = document.getElementById('home-controls');
  const search = document.getElementById('search-dock');
  const tools = document.getElementById('browser-tools');
  if (!ui || !controls || !search || !tools) return;
  const player = document.getElementById('player-tools');
  const header = ui.querySelector('header');
  const root = document.documentElement.style;
  let frame = 0;
  const gap = 8;

  function pixels(style, name, value) {
    const setting = Math.max(0, Math.ceil(value)) + 'px';
    if (style.getPropertyValue(name) !== setting) style.setProperty(name, setting);
  }

  function collectTools() {
    for (const id of ['gfd-vpn-widget-toggle','gfd-history-launch','gfd-firecrawl-launch']) {
      const button = document.getElementById(id);
      if (button && button.parentElement !== tools) tools.append(button);
    }
    // 외부 스크립트에서 뒤늦게 추가한 우측 하단 실행 버튼도 같은 공간을 쓴다.
    for (const button of document.querySelectorAll('body > button, body > a[role="button"]')) {
      if (getComputedStyle(button).position !== 'fixed') continue;
      const box = button.getBoundingClientRect();
      if (box.width && box.width < 300 && box.height < 110 &&
          box.right > innerWidth * .55 && box.bottom > innerHeight * .55) tools.append(button);
    }
  }

  function arrange() {
    frame = 0;
    if (!innerWidth || !innerHeight || !ui.offsetWidth || !ui.offsetHeight) return;
    collectTools();
    const viewport = window.visualViewport;
    const visibleBottom = Math.min(innerHeight, (viewport?.offsetTop || 0) + (viewport?.height || innerHeight));
    const keyboardInset = innerHeight - visibleBottom;
    const compactKeyboard = keyboardInset > 80 && viewport.height < 420;
    document.body.toggleAttribute('data-compact-keyboard', compactKeyboard);
    const bottomRule = 'max(' + Math.ceil(keyboardInset + gap) + 'px, env(safe-area-inset-bottom))';
    if (root.getPropertyValue('--controls-bottom') !== bottomRule) root.setProperty('--controls-bottom', bottomRule);

    const scaleX = ui.getBoundingClientRect().width / ui.offsetWidth;
    const scaleY = ui.getBoundingClientRect().height / ui.offsetHeight;
    if (!scaleX || !scaleY) return;
    const stacked = getComputedStyle(controls).getPropertyValue('--stack-controls').trim() === '1';
    const left = player.getBoundingClientRect();
    const right = tools.getBoundingClientRect();
    const rail = controls.getBoundingClientRect();
    const leftInset = stacked ? rail.left : left.right + gap;
    const rightInset = innerWidth - (stacked ? rail.right : right.left - gap);
    const controlsTop = stacked ? rail.top : visibleBottom;
    const top = Math.max(header.getBoundingClientRect().bottom, viewport?.offsetTop || 0) + gap;
    const usable = Math.max(0, controlsTop - top - gap);
    pixels(ui.style, '--search-left', leftInset / scaleX);
    pixels(ui.style, '--search-right', rightInset / scaleX);
    pixels(ui.style, '--search-bottom', (innerHeight - controlsTop + gap) / scaleY);
    pixels(ui.style, '--search-limit', usable * .51 / scaleY);

    search.toggleAttribute('data-scrollable', search.scrollHeight > search.clientHeight + 1);
    const box = search.getBoundingClientRect();
    const panelEnd = Math.min(box.height > 1 ? box.top - gap : visibleBottom, controlsTop);
    const panelWidth = innerWidth - leftInset - rightInset;
    pixels(root, '--popup-left', leftInset);
    pixels(root, '--popup-right', rightInset);
    pixels(root, '--popup-top', top);
    pixels(root, '--popup-bottom', innerHeight - panelEnd + gap);
    pixels(root, '--popup-width', panelWidth);
    pixels(root, '--popup-height', panelEnd - top - gap);
    pixels(ui.style, '--inside-popup-right', rightInset / scaleX);
    pixels(ui.style, '--inside-popup-top', top / scaleY);
    pixels(ui.style, '--inside-popup-width', panelWidth / scaleX);
    pixels(ui.style, '--inside-popup-height', (panelEnd - top - gap) / scaleY);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(arrange);
  }
  function start() {
    arrange();
    if (window.ResizeObserver) {
      const resize = new ResizeObserver(schedule);
      for (const el of [player, tools, ui, header, search, ...search.children]) resize.observe(el);
    }
    const structuralChanges = new MutationObserver(arrange);
    structuralChanges.observe(search, {attributes:true, attributeFilter:['hidden']});
    structuralChanges.observe(document.getElementById('palace-third-options'), {attributes:true, attributeFilter:['hidden']});
    new MutationObserver(schedule).observe(document.body, {childList:true});
    addEventListener('resize', arrange);
    addEventListener('pageshow', schedule);
    document.addEventListener('fullscreenchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    document.fonts?.ready.then(schedule);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
