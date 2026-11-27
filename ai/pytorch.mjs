export const torchName = 'Qwen3-0.6B-abliterated · PyTorch';
let worker, connection, backend = '', device = '', progress = '', busy = false, nextId = 0;
const requests = new Map();
export const canRetryWebGPU = () => !busy && requests.size === 0 && (backend === 'cpu' || (!worker && !!progress));
export function retryWebGPU() {
  if (!canRetryWebGPU()) return connectPyTorch();
  worker?.terminate();
  worker = undefined; connection = undefined; backend = '';
  return connectPyTorch();
}
export const torchProgress = () => [device, progress].filter(Boolean).join(' · ') || '연산 장치 연결 대기';
function notify() { window.dispatchEvent(new Event('gfd:torch-progress')); }
function stop(error) {
  worker?.terminate();
  worker = undefined; connection = undefined; backend = ''; device = ''; progress = error.message || '연결이 중단되었습니다.';
  for (const request of requests.values()) request.reject(error);
  requests.clear();
  notify();
}
async function request(action, options = {}, onToken) {
  if (!worker) {
    worker = new Worker(new URL('./pytorch-worker.mjs?v=gptfast64', import.meta.url), {type:'module'});
    worker.onerror = () => stop(Error('내장 추론 작업이 중단되었습니다.'));
    worker.onmessage = ({data}) => {
      const current = requests.get(data.id);
      if (!current) return;
      if (data.device) { backend = data.backend; device = data.device; notify(); return; }
      if (data.progress) { progress = data.progress; notify(); return; }
      if (data.token) { current.onToken?.(data.token); return; }
      if (data.error) {
        const error = Error(data.error);
        if (!data.recoverable) { stop(error); return; }
        requests.delete(data.id);
        progress = ''; notify(); current.reject(error);
        return;
      }
      requests.delete(data.id);
      current.resolve(data.text);
    };
  }
  const id = ++nextId;
  return new Promise((resolve,reject) => {
    requests.set(id, {resolve,reject,onToken});
    try { worker.postMessage({id,action,...options}); } catch (error) { stop(error); }
  });
}
export function connectPyTorch() {
  if (!connection) {
    device = '연산 장치 연결 중'; progress = ''; notify();
    connection = request('connect').then(() => { notify(); return device; }).catch(error => {
      connection = undefined;
      if (!worker) { device = ''; progress = error.message; notify(); }
      throw error;
    });
  }
  return connection;
}
export async function generatePyTorch({roleplayOnly=false,cacheScope,messages,systemPrompt,instructions,documents,maxTokens,signal,onToken}) {
  if (signal?.aborted) throw signal.reason;
  if (busy) throw Error('모델이 이전 질문에 답하는 중입니다.');
  busy = true; notify();
  const cancel = () => stop(signal.reason || new DOMException('취소했습니다.','AbortError'));
  signal?.addEventListener('abort',cancel,{once:true});
  try {
    await connectPyTorch();
    if (signal?.aborted) throw signal.reason;
    const result = await request('generate',{roleplayOnly,cacheScope,messages,systemPrompt,instructions,documents,maxTokens},onToken);
    progress = ''; notify();
    return result;
  } finally { busy = false; signal?.removeEventListener('abort',cancel); notify(); }
}
