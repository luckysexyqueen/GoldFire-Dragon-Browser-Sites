// 이전 버전과 같은 저장소에서 이미 저장된 자료까지 색인한다.
const field = 'custom_gpt_id';
const migrations = new WeakMap();

async function prepareIndex(store, indexes) {
  await store.ready();
  try {
    await indexes.getIndex.call(store, field);
  } catch (error) {
    if (error.name !== 'NotFoundError') throw error;
    await indexes.createIndex.call(store, field, field);
  }
}

function ensureIndex(store, indexes) {
  let pending = migrations.get(store);
  if (!pending) {
    const run = () => prepareIndex(store, indexes);
    pending = (globalThis.navigator?.locks
      ? navigator.locks.request('goldfire-attachment-schema', run)
      : run()).catch(error => {
      migrations.delete(store);
      throw error;
    });
    migrations.set(store, pending);
  }
  return pending;
}

export async function findGPTFiles(store, gptId) {
  if (!gptId) return [];
  if (typeof store.driver === 'function') {
    try {
      const indexes = await import('../vendor/localforage-indexes/indexes.mjs');
      await ensureIndex(store, indexes);
      return await new Promise((resolve, reject) => {
        indexes.getIndex.call(store, field, (error, index) => {
          if (error) return reject(error);
          try {
            const request = index.getAll(gptId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          } catch (reason) { reject(reason); }
        });
      });
    } catch {
      // 버전 변경으로 연결이 닫혔거나 색인을 쓸 수 없는 브라우저에서도 원본을 읽는다.
    }
  }
  const files = [];
  await store.iterate(file => { if (file?.custom_gpt_id === gptId) files.push(file); });
  return files;
}
