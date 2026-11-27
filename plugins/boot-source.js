// Trusted UI source. build-plugin-catalog.mjs injects runtime and packaged data.
(function () {
  'use strict';
  if (window.GFDPluginsReady) return;
  const base = new URL('.', document.currentScript.src);
  const fallback = Object.freeze({ list: () => [], setEnabled: () => false, extendInstructions: value => value || '' });
  window.GFDPlugins = fallback;
  // Local APK assets cannot rely on module imports or fetch(file://...).
  // The packaged snapshot is used only on non-HTTP origins. Hosted Pages still
  // reads its authoritative registry and never revives stale offline contexts.
  window.GFDPluginsReady = Promise.resolve().then(async () => {
    let storage, database;
    try { storage = window.localStorage; } catch { /* Try IndexedDB below. */ }
    try { database = window.indexedDB; } catch { /* Memory fallback. */ }
    storage = await runtime.createPreferenceStorage({ storage, indexedDB: database });
    if (!/^https?:$/.test(window.location.protocol)) {
      return withUserPlugins(runtime.createManager(runtime.parseRegistry(packagedRegistry), storage), storage);
    }
    const url = new URL('registry.json', base);
    const fallbackCatalog = runtime.parseRegistry(packagedRegistry).map(plugin => ({ ...plugin, autoEnable: false }));
    let catalog = runtime.createManager(fallbackCatalog, storage);
    let loaded = false, loading;
    function retryCatalog() {
      if (loaded || loading) return loading;
      loading = runtime.loadRegistry(url.href, { storage, credentials: url.origin === location.origin ? 'same-origin' : 'omit' })
        .then(result => { catalog = result; loaded = true; })
        .catch(() => { /* 설치 항목은 계속 사용하고 다음 요청에서 다시 시도합니다. */ })
        .finally(() => {
          loading = null;
          window.dispatchEvent(new CustomEvent('gfd:catalog-updated'));
          if (loaded) window.dispatchEvent(new CustomEvent('gfd:plugins-changed'));
        });
      window.dispatchEvent(new CustomEvent('gfd:catalog-updated'));
      return loading;
    }
    await retryCatalog();
    window.addEventListener('online', retryCatalog);
    return withUserPlugins({
      list: () => catalog.list(),
      setEnabled: (id, enabled) => catalog.setEnabled(id, enabled),
      flushPreferences: () => catalog.flushPreferences(),
      extendInstructions: value => catalog.extendInstructions(value),
      catalogState: () => loaded ? 'ready' : loading ? 'loading' : 'fallback',
      retryCatalog
    }, storage);
  }).catch(() => fallback).then(manager => {
    window.GFDPlugins = manager;
    window.dispatchEvent(new CustomEvent('gfd:plugins-ready'));
    mount(manager);
    return manager;
  });
  function mount(manager) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => mount(manager), { once: true });
      return;
    }
    if (document.querySelector('[data-gfd-generation-settings]') || document.getElementById('gfd-plugin-controls')) return;
    // A separate shadow root survives the existing app's repeated innerHTML renders.
    const host = document.createElement('aside');
    host.id = 'gfd-plugin-controls';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = ':host{position:fixed;right:12px;bottom:72px;z-index:1000;font:14px system-ui;color:#eee}*{box-sizing:border-box}.menu{background:#202528;border:1px solid #607078;border-radius:12px;padding:10px;width:min(340px,calc(100vw - 24px))}summary{cursor:pointer}.plugin-list{max-height:60vh;max-height:min(60dvh,calc(100dvh - 160px));overflow:auto;overscroll-behavior:contain}article{border-top:1px solid #607078;margin-top:8px;padding-top:8px;overflow-wrap:anywhere}p{font-size:12px;line-height:1.5}.plugin-toggle{display:flex;align-items:flex-start;gap:8px;padding:8px 0;cursor:pointer}.plugin-toggle input{flex:none;margin:2px 0 0}.plugin-info{padding:4px 0}.plugin-info summary{font-size:12px;color:#bdced7}.note{margin:8px 0}';
    const details = document.createElement('details');
    details.className = 'menu';
    const summary = document.createElement('summary');
    const section = document.createElement('section');
    section.className = 'plugin-list';
    details.append(summary, section);
    function render() {
      const plugins = manager.list();
      summary.textContent = `플러그인 ${plugins.length}개`;
      section.replaceChildren();
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = plugins.length ? '플러그인은 자동 등록됩니다. 추가 채팅 지침은 직접 켜세요. 서버 도구는 별도 연결이 필요합니다.' : '등록된 플러그인이 없습니다.';
      section.append(note);
      if (manager.catalogState && manager.catalogState() !== 'ready') {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.disabled = manager.catalogState() === 'loading';
        note.textContent = retry.disabled ? '기본 플러그인 목록을 불러오는 중…' : '기본 제공 목록을 표시합니다. 최신 목록을 다시 불러올 수 있습니다.';
        retry.textContent = '목록 다시 불러오기';
        retry.onclick = manager.retryCatalog;
        section.append(retry);
      }
      for (const plugin of plugins) {
        const article = document.createElement('article');
        const title = document.createElement('strong');
        title.textContent = `${plugin.name} (${plugin.version})`;
        const info = document.createElement('details');
        info.className = 'plugin-info';
        const infoTitle = document.createElement('summary');
        infoTitle.textContent = '설명·지침 보기';
        const description = document.createElement('p');
        description.textContent = plugin.description;
        info.append(infoTitle, description);
        if (plugin.context) {
          const label = document.createElement('label');
          label.className = 'plugin-toggle';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = plugin.enabled;
          checkbox.setAttribute('aria-label', '추가 채팅 지침 적용: ' + plugin.name);
          checkbox.addEventListener('change', () => {
            manager.setEnabled(plugin.id, checkbox.checked);
            window.dispatchEvent(new CustomEvent('gfd:plugins-changed'));
          });
          label.append(checkbox, title);
          article.append(label);
          const preview = document.createElement('p');
          preview.textContent = plugin.context;
          info.append(preview);
        } else {
          article.append(title);
        }
        article.append(info);
        section.append(article);
      }
    }
    window.addEventListener('gfd:catalog-updated', render);
    render();
    shadow.append(style, details);
    document.documentElement.append(host);
  }
})();
