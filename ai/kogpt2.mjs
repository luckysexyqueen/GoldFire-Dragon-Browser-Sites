export const kogpt2Name = 'KoGPT2-Adult-Neutral-FP16';
let worker;
let pending;
let sequence = 0;
let ready = false;
let progress = '';

function updateProgress(text) {
  progress = text;
  window.dispatchEvent(new Event('gfd:kogpt2-progress'));
}

function reset() {
  worker?.terminate();
  worker = undefined;
  ready = false;
}

function run(payload, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (pending) return Promise.reject(Error('내장 모델이 이미 처리 중입니다.'));
  if (!worker) worker = new Worker(new URL('./kogpt2-worker.mjs?v=knowledge', import.meta.url), { type: 'module' });
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    function finish(error, value) {
      signal?.removeEventListener('abort', abort);
      pending = undefined;
      updateProgress(ready ? '내장 모델 준비 완료' : '');
      if (error) reject(error);
      else resolve(value);
    }
    function abort() {
      reset();
      finish(signal.reason);
    }
    pending = id;
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      reset();
      finish(Error('브라우저에서 내장 모델 엔진을 시작하지 못했습니다.'));
    };
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.progress) { updateProgress(data.progress); return; }
      if (data.error) { finish(Error(data.error)); return; }
      ready = true;
      finish(null, data.text);
    };
    updateProgress(ready ? '내장 모델 답변 생성 중…' : '내장 모델 준비 중…');
    worker.postMessage({ id, ...payload });
  });
}

export const kogpt2Progress = () => progress || '첫 질문을 보내면 준비합니다.';
export const prepareKoGPT2 = () => ready ? Promise.resolve() : run({});
export async function generateKoGPT2({ messages, systemPrompt, instructions, documents, maxTokens, signal, onToken }) {
  const text = await run({ messages, systemPrompt, instructions, documents, maxTokens }, signal);
  onToken?.(text);
  return text;
}
