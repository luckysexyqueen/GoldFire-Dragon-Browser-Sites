import { koreanInstructions } from './language.mjs';

const localOrigin = 'http://127.0.0.1:18080';
export function connection() {
  const origin = localStorage.getItem('goldfire-model-origin') || localOrigin;
  return {origin, token: origin === localOrigin ? '' : sessionStorage.getItem('goldfire-token:' + origin) || ''};
}
export function saveConnection(value, token) {
  let origin = '';
  if (value.trim()) {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('HTTPS 서버 주소만 입력하세요.');
    origin = url.origin;
  }
  localStorage.setItem('goldfire-model-origin', origin);
  if (origin) sessionStorage.setItem('goldfire-token:' + origin, token.trim());
}
const alias = 'goldfire-gptoss-lora';
export const launcher = 'llama-server -hf unsloth/gpt-oss-20b-GGUF:UD-Q4_K_XL --lora "gptossuncensor20blora.gguf" --alias ' + alias + ' --host 127.0.0.1 --port 18080 -c 8192';
async function request(conn, path, options = {}) {
  let response;
  try {
    response = await fetch(conn.origin + path, { ...options, headers: { ...options.headers, ...(conn.token ? { Authorization: "Bearer " + conn.token } : {}) }, credentials: 'omit', redirect: 'error', cache: 'no-store' });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (conn.origin !== localOrigin) throw Error('온라인 서버에 연결할 수 없습니다. AI 연결에서 HTTPS 주소와 서버 상태를 확인하세요.');
    throw Error('AI 연결에서 ‘기기 서버 상태 직접 열기’를 누르세요. 주소가 열리지 않으면 같은 기기에서 모델 서버를 시작하세요. 상태가 ok인데 연결 확인이 실패하면 외부 브라우저에서 사이트를 열고 로컬 네트워크 권한을 확인하세요.');
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw Error('모델 서버 접근 키를 확인하세요.');
    if (response.status === 503) throw Error('서버가 응답했지만 모델이 아직 준비되지 않았습니다. 서버의 모델 로딩 기록을 확인한 뒤 다시 시도하세요.');
    const body = await response.json().catch(() => ({}));
    throw Error(body.error?.message || '모델 서버 요청 실패 (' + response.status + ')');
  }
  return response.json();
}
export async function checkServer(signal, conn = connection()) {
  const models = await request(conn, '/v1/models', { signal: signal || AbortSignal.timeout(8000) });
  if (!models.data?.some(m => m.id === alias || m.aliases?.includes(alias))) throw Error('지정된 GPT-OSS 서버를 찾지 못했습니다. AI 연결에 표시된 명령으로 실행하세요.');
  const adapters = await request(conn, '/lora-adapters', { signal: signal || AbortSignal.timeout(8000) });
  const adapter = adapters.find(a => a.path?.replaceAll('\\', '/').split('/').pop() === 'gptossuncensor20blora.gguf' && a.scale > 0);
  if (!adapter) throw Error('첨부한 LoRA가 활성화되지 않았습니다. 실행 명령의 --lora 경로를 확인하세요.');
  return adapter.id;
}
export async function generateGPTOSS({messages, systemPrompt, instructions, maxTokens, signal, onToken}) {
  const conn = connection();
  const id = await checkServer(signal, conn);
  const system = koreanInstructions([systemPrompt, instructions, ...messages.filter(m => m.role === 'system').map(m => m.content)].filter(Boolean).join('\n\n'));
  const reply = await request(conn, '/v1/chat/completions', {method:'POST', signal, headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ model:alias, messages:[{role:'system', content:system}, ...messages.filter(m => m.role !== 'system')], lora:[{id,scale:1}], max_tokens:maxTokens || 2048, stream:false })});
  const text = reply.choices?.[0]?.message?.content?.trim();
  if (!text) throw Error('모델이 최종 답변을 반환하지 않았습니다.');
  onToken?.(text);
  return text;
}
