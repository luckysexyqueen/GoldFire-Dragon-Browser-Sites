// Data-only browser adapter. Plugin-provided code is never imported or evaluated.
export const LIMIT = 65536;
const secret = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b)/;
export function safeText(value, max = 2000) {
  if (typeof value !== 'string' || value.length > max || secret.test(value)) throw new Error('Invalid or sensitive plugin text');
  return value;
}
export function normalizePlugin(raw) {
  if (!raw || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(raw.id)) throw new Error('Invalid plugin id');
  return Object.freeze({
    id: raw.id,
    name: safeText(raw.name, 160),
    version: safeText(raw.version, 80),
    description: safeText(raw.description),
    context: safeText(raw.context || '', 8000),
    // Only a reviewed adapter can opt in. Package metadata alone cannot activate prompts.
    autoEnable: raw.autoEnable === true && !!raw.context,
    capabilities: Object.freeze(raw.context ? ['catalog', 'prompt-context'] : ['catalog']),
  });
}
export function parseRegistry(value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.plugins) || value.plugins.length > 100) throw new Error('Unsupported plugin registry');
  const seen = new Set();
  const plugins = [];
  for (const raw of value.plugins) {
    try {
      const plugin = normalizePlugin(raw);
      if (seen.has(plugin.id)) continue;
      seen.add(plugin.id);
      plugins.push(plugin);
    } catch { /* A bad entry must not disable healthy plugins. */ }
  }
  return Object.freeze(plugins);
}
// Prefer durable browser storage; APK shells can deny localStorage separately
// from IndexedDB. Keep the manager API synchronous after async initialization.
export async function createPreferenceStorage({ storage, indexedDB, timeout = 1500 } = {}) {
  try {
    const probe = 'gfd-plugin:storage-probe';
    if (storage) {
      storage.setItem(probe, '1');
      if (storage.getItem(probe) !== '1') throw Error('Storage did not retain probe');
      storage.removeItem(probe);
      return storage;
    }
  } catch { /* Try independent persistent storage. */ }
  const values = new Map();
  let database;
  let pending = Promise.resolve();
  try {
    if (!indexedDB) throw Error('IndexedDB unavailable');
    database = await new Promise((resolve, reject) => {
      let finished = false;
      const timer = setTimeout(() => { finished = true; reject(Error('Storage open timeout')); }, timeout);
      const request = indexedDB.open('gfd-plugin-preferences', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('preferences')) request.result.createObjectStore('preferences');
      };
      request.onsuccess = () => {
        if (finished) { request.result.close(); return; }
        finished = true; clearTimeout(timer); resolve(request.result);
      };
      request.onerror = () => { finished = true; clearTimeout(timer); reject(request.error); };
    });
    database.onversionchange = () => database.close();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('preferences', 'readonly');
      const cursor = transaction.objectStore('preferences').openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (item) { values.set(item.key, item.value); item.continue(); }
      };
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(transaction.error || Error('Storage read failed'));
    });
  } catch { if (database) database.close(); database = null; }
  function persist(key, value) {
    if (!database) return Promise.reject(Error('플러그인을 저장할 공간을 열 수 없습니다.'));
    const result = pending.then(() => new Promise((resolve, reject) => {
      const tx = database.transaction('preferences', 'readwrite');
      const store = tx.objectStore('preferences');
      if (value === null) store.delete(key); else store.put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(Error('플러그인을 저장할 공간을 확인하세요.'));
    }));
    pending = result.catch(() => {});
    return result;
  }
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index],
    getItem: key => values.get(key) ?? null,
    async writeCustom(key, value) {
      await persist(key, value);
      if (value === null) values.delete(key); else values.set(key, value);
    },
    setItem(key, value) {
      values.set(key, value);
      if (database) persist(key, value).catch(() => {});
    },
    flush: () => pending
  };
}
export function createManager(plugins, storage) {
  const preferences = new Map();
  for (const plugin of plugins) {
    let value;
    try { value = storage?.getItem(`gfd-plugin:${plugin.id}:${plugin.version}`); } catch { /* private browsing */ }
    preferences.set(plugin.id, value === '1' || (value !== '0' && plugin.autoEnable));
  }
  const list = () => plugins.map(p => {
    let enabled = preferences.get(p.id) === true;
    try {
      const saved = storage?.getItem(`gfd-plugin:${p.id}:${p.version}`);
      if (saved === '1' || saved === '0') enabled = saved === '1';
    } catch { /* 현재 창의 선택을 사용합니다. */ }
    return { ...p, enabled };
  });
  return Object.freeze({
    list,
    flushPreferences: async () => { await storage?.flush?.(); },
    setEnabled(id, enabled) {
      const plugin = plugins.find(p => p.id === id);
      if (!plugin || !plugin.context || typeof enabled !== 'boolean') return false;
      preferences.set(id, enabled);
      try { storage?.setItem(`gfd-plugin:${id}:${plugin.version}`, enabled ? '1' : '0'); } catch { /* memory-only fallback */ }
      return true;
    },
    extendInstructions(instructions = '') {
      const contexts = list().filter(p => p.enabled && p.context).map(p => `[Website plugin: ${p.name}]\n${p.context}`);
      // Bound total context and never mutate/persist the conversation's original instructions.
      return [instructions, contexts.join('\n\n').slice(0, 16000)].filter(Boolean).join('\n\n');
    },
  });
}
export function withUserPlugins(base, storage) {
  const prefix = 'gfd-installed:1:';
  function read(id) {
    try {
      const row = JSON.parse(storage.getItem(prefix + id));
      const isSkill = id.startsWith('skill/');
      if (!row || row.id !== (isSkill ? id.slice(6) : id)) return null;
      const plugin = normalizePlugin(row);
      return {...plugin, id:'custom:' + id, custom:true, kind:isSkill ? 'skill' : 'plugin', enabled:row.enabled === true};
    } catch { return null; }
  }
  function customList() {
    const entries = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) {
        const plugin = read(key.slice(prefix.length));
        if (plugin) entries.push(plugin);
      }
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }
  async function write(id, value) {
    const key = prefix + id, data = value && JSON.stringify(value);
    if (storage.writeCustom) return storage.writeCustom(key, data);
    try {
      if (data === null) storage.removeItem(key); else storage.setItem(key, data);
    } catch { throw Error('플러그인을 저장할 수 없습니다. 브라우저 저장 공간을 확인하세요.'); }
  }
  return Object.freeze({
    ...base,
    list: () => [...base.list(), ...customList()],
    async install(raw, kind = 'plugin') {
      const plugin = normalizePlugin({...raw, autoEnable:false});
      if (!plugin.context.trim()) throw Error('적용할 채팅 지침이 비어 있습니다.');
      const key = kind === 'skill' ? 'skill/' + plugin.id : plugin.id;
      if (!read(key) && customList().length >= 100) throw Error('스킬과 플러그인은 모두 합쳐 100개까지 설치할 수 있습니다.');
      await write(key, {...plugin, enabled:false});
      return plugin.name;
    },
    async configure(id, enabled) {
      if (!id.startsWith('custom:')) {
        if (!base.setEnabled(id, enabled)) throw Error('이 플러그인에는 적용할 지침이 없습니다.');
        await base.flushPreferences?.();
        return;
      }
      const localId = id.slice(7), plugin = read(localId);
      if (!plugin) throw Error('설치 목록을 다시 확인하세요.');
      await write(localId, {...plugin, id:plugin.kind === 'skill' ? localId.slice(6) : localId, enabled});
    },
    async uninstall(id) {
      if (!id.startsWith('custom:')) throw Error('직접 설치한 플러그인만 삭제할 수 있습니다.');
      await write(id.slice(7), null);
    },
    extendInstructions(instructions = '') {
      const custom = customList().filter(p => p.enabled).map(p => '[Website ' + p.kind + ': ' + p.name + ']\n' + p.context);
      const context = [...custom, base.extendInstructions('')].filter(Boolean).join('\n\n').slice(0,16000);
      return [instructions, context].filter(Boolean).join('\n\n');
    }
  });
}
export async function loadRegistry(url, { fetcher = fetch, storage, timeout = 4000, credentials = 'omit' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetcher(url, { signal: controller.signal, credentials, redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error('Plugin registry unavailable');
    if (!/application\/json/i.test(response.headers.get('content-type') || '')) throw new Error('Plugin registry must be JSON');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMIT) { await reader.cancel(); throw new Error('Plugin registry too large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return createManager(parseRegistry(JSON.parse(new TextDecoder().decode(bytes))), storage);
  } finally { clearTimeout(timer); }
}
