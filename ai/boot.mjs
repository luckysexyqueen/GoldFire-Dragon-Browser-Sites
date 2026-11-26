import { omegaPrompt } from './omega.mjs';
import { canRetryWebGPU, retryWebGPU, connectPyTorch, generatePyTorch, torchName, torchProgress } from './pytorch.mjs?v=gptfast64';
import { generateKoGPT2, kogpt2Name, kogpt2Progress, prepareKoGPT2 } from './kogpt2.mjs?v=knowledge';
import './local-gguf.mjs?v=browser20b';
import { freeChat, prepareMessages } from './providers.mjs';
import { koreanInstructions } from './language.mjs';
import { recoverKoreanFile } from './packed-model.mjs?v=qwen2';
import { generateGPTOSS, prepareModel, modelStatus, modelURL, browserModelState } from './browser-gptoss.mjs?v=raw-adapter';
const modes = ['pytorch', 'kogpt2', 'gptoss', 'free', 'local'];
let mode = 'pytorch';
try {
  const previous = localStorage.getItem('gfd-ai-choice-kogpt2-v1');
  const saved = localStorage.getItem('gfd-ai-choice-pytorch-v1') ?? (previous === 'kogpt2' ? 'pytorch' : previous);
  if (modes.includes(saved)) mode = saved;
} catch {}
const fallbackConfig = { schemaVersion: 1, freeEndpoint: 'https://goldfire-vireonix-relay.choluckyhexsexyqueen.workers.dev' };
const configReady = fetch(new URL('./config.json', import.meta.url), { credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(4000) })
  .then(async r => r.ok ? r.json() : fallbackConfig)
  .catch(() => fallbackConfig);
configReady.catch(() => {});
let restoring;
async function recoverKoreanModelFile(options) {
  if (!restoring) restoring = configReady.then(config => {
    if (!config.koreanModel?.sha256) throw Error('Qwen 모델 설정을 불러오지 못했습니다.');
    return recoverKoreanFile(config.koreanModel, options);
  }).finally(() => { restoring = undefined; });
  return restoring;
}
window.GFDAI = Object.freeze({
  omegaPrompt,
  extendInstructions: koreanInstructions,
  browserModelState,
  prepareBrowserModel: () => prepareModel(false),
  generateGPTOSS,
  generateKoGPT2,
  connectPyTorch, generatePyTorch, torchName, torchProgress,
  kogpt2Progress,
  prepareKoGPT2,
  recoverKoreanModelFile,
  async loadKoreanModel(options = {}) {
    const file = await recoverKoreanModelFile(options);
    return window.LocalGGUF.load([file], options);
  },
  getMode: () => mode,
  setMode(value) {
    if (!modes.includes(value)) return false;
    mode = value;
    try { localStorage.setItem('gfd-ai-choice-pytorch-v1', mode); } catch { /* in memory */ }
    window.dispatchEvent(new CustomEvent('gfd:ai-mode-changed', { detail: mode }));
    return true;
  },
  async generate({ localGGUFOnly = false, cacheScope, messages, systemPrompt, instructions, documents = [], onToken, signal, maxTokens }) {
    const engine = localGGUFOnly ? 'local' : mode;
    if (engine === 'pytorch') return generatePyTorch({ cacheScope, messages, systemPrompt, instructions, documents, maxTokens, signal, onToken });
    maxTokens ??= 4096;
    if (engine === 'kogpt2') return generateKoGPT2({ messages, systemPrompt, instructions, documents, maxTokens, signal, onToken });
    const local = window.LocalGGUF;
    const localMessages = [
      ...(systemPrompt || instructions ? [{ role: 'system', content: koreanInstructions([systemPrompt, instructions].filter(Boolean).join('\n\n')) }] : []),
      ...messages,
    ];
    const runLocal = async () => {
      if (!local?.getStatus?.().ready) throw Error('로컬 GGUF 모델이 준비되지 않았습니다. 먼저 로컬 모델 관리에서 모델을 불러오세요.');
      const generateReliable = async (input, opts) => {
        let lastError;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (signal?.aborted) throw new DOMException('취소되었습니다.', 'AbortError');
          try { return await local.generate(input, { ...opts, maxTokens: attempt ? Math.min(opts.maxTokens || 512, 512) : opts.maxTokens }); }
          catch (error) { lastError = error; if (!local.getStatus?.().ready || signal?.aborted) throw error; }
        }
        throw lastError;
      };
      const total = localMessages.reduce((n, m) => n + m.content.length, 0);
      if (total <= 6000) return generateReliable(localMessages, { maxTokens, onToken, signal, temperature: 0.7 });
      // Keep every source chunk under a conservative character budget; a model's
      // actual token/context limits still apply independently of character count.
      const source = localMessages.map(m => '[' + m.role + ']\n' + m.content).join('\n\n');
      const chunks = [];
      for (let i = 0; i < source.length; i += 2500) chunks.push(source.slice(i, i + 2500));
      let notes = '';
      for (let i = 0; i < chunks.length; i++) {
        if (signal?.aborted) throw new DOMException('취소되었습니다.', 'AbortError');
        const summary = await generateReliable([
          { role: 'system', content: '다음 입력 조각의 사실, 지시, 핵심 문맥을 한국어로 압축하세요. 이전 메모와 충돌하면 충돌을 명시하세요. 추측하지 마세요.' },
          { role: 'user', content: '이전 메모:\n' + notes.slice(-2000) + '\n\n조각 ' + (i + 1) + '/' + chunks.length + ':\n' + chunks[i] }
        ], { maxTokens: 384, signal, temperature: 0.2 });
        notes = (notes + '\n' + summary).slice(-4000);
      }
      return generateReliable([
        { role: 'system', content: '긴 원문을 순차 분석한 요약 메모입니다. 메모에 없는 내용은 확인할 수 없다고 설명하고, 한국어로 최종 응답하세요.' },
        { role: 'user', content: '요약 메모:\n' + notes + '\n\n최종 요청:\n' + localMessages.filter(m => m.role === 'user').at(-1)?.content.slice(-1200) }
      ], { maxTokens, onToken, signal, temperature: 0.7 });
    };
    if (engine === 'gptoss') return generateGPTOSS({ messages, systemPrompt, instructions, maxTokens, signal, onToken });
    if (engine === 'local') return runLocal();
    let config;
    try { config = await configReady; }
    catch (error) { throw error; }
    if (config.schemaVersion !== 1) throw Error('지원하지 않는 AI 설정입니다.');
    try {
      const text = await freeChat(config.freeEndpoint, await prepareMessages(messages, systemPrompt, instructions, {
        summarize: (source) => freeChat(config.freeEndpoint, [
          { role: 'system', content: '이전 대화와 자료를 빠짐없이 보존하는 한국어 요약을 작성하세요. 고유명사, 설정, 지시, 사실을 생략하지 말고 압축하세요. 요약만 출력하세요.' },
          { role: 'user', content: source.slice(0, 18000) },
        ], { signal, translate: false }),
      }), { signal, maxTokens });
      onToken?.(text);
      return text;
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('무료 API 요청에 실패했습니다: ' + (error?.message || error));
    }
  },
});
function mount() {
  if (document.getElementById('gfd-ai-mode')) return;
  const host = document.createElement('aside'); host.id = 'gfd-ai-mode';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = ':host{position:fixed;right:12px;bottom:120px;z-index:1000;font:14px system-ui;color:#eee}details{padding:10px;background:#202528;border:1px solid #607078;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.3)}summary{cursor:pointer;font-weight:700}p{margin-top:8px;line-height:1.4;color:#dfe8ee}button{margin-top:8px;padding:8px 12px;border:1px solid #607078;border-radius:8px;background:#2a2f34;color:#fff;cursor:pointer}button:hover{background:#303840}';
  const details = document.createElement('details');
  const summary = document.createElement('summary'); summary.textContent = 'AI 연결';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'AI 응답 방식');
  for (const [value, label] of [['pytorch',torchName], ['kogpt2',kogpt2Name], ['gptoss','GPT-OSS 20B + LoRA'], ['free','무료 API (공유 한도)'], ['local','직접 불러온 GGUF']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
  }
  select.value = mode; select.addEventListener('change', () => window.GFDAI.setMode(select.value));
  window.addEventListener('gfd:ai-mode-changed', () => { select.value = mode; });
  const setup = document.createElement('section');
  setup.style.maxWidth = 'min(350px,75vw)';
  const note = document.createElement('p');
  note.textContent = '첫 사용 시 기본 모델 약 11.9GB를 이 브라우저에 저장합니다. 이미 보유한 GGUF 또는 순수 Base64 파일(.b64, .base64, .txt)을 선택하면 기본 모델 다운로드를 건너뜁니다.';
  const download = document.createElement('button'); download.textContent = '기본 모델 다운로드 및 실행';
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.gguf,.b64,.base64,.txt'; input.hidden = true;
  const pick = document.createElement('button'); pick.textContent = '기본 모델 선택 (GGUF / Base64)';
  const link = document.createElement('a'); link.href = modelURL; link.textContent = '기본 모델 원본'; link.style.color = '#9de8cb';
  const result = document.createElement('p'); result.setAttribute('role','status');
  async function start(file) {
    download.disabled = pick.disabled = true; result.textContent = '브라우저 실행 환경 확인 중…';
    try { await prepareModel(true,file); result.textContent = modelStatus(); }
    catch (e) { result.textContent = e.message; }
    finally { download.disabled = pick.disabled = false; }
  }
  window.addEventListener('gfd:browser-model-progress', () => { result.textContent = modelStatus(); });
  window.addEventListener('gfd:open-browser-model', () => { details.open = true; setup.hidden = false; });
  download.onclick = () => start(); pick.onclick = () => input.click();
  input.onchange = () => { if (input.files[0]) void start(input.files[0]); input.value = ''; };
  setup.append(note, download, pick, input, link, result);
  details.style.cssText = 'max-height:70vh;overflow:auto';
  const localStatus = document.createElement('p');
  localStatus.setAttribute('role', 'status');
  const retryGPU = document.createElement('button');
  retryGPU.type = 'button';
  retryGPU.textContent = 'WebGPU 다시 연결';
  retryGPU.addEventListener('click', () => { void retryWebGPU().catch(() => {}); });
  const updateStatus = () => {
    localStatus.textContent = mode === 'pytorch' ? torchProgress() : kogpt2Progress();
    retryGPU.hidden = mode !== 'pytorch' || !canRetryWebGPU();
    retryGPU.style.display = retryGPU.hidden ? 'none' : '';
  };
  window.addEventListener('gfd:kogpt2-progress', updateStatus);
  window.addEventListener('gfd:torch-progress', updateStatus);
  const toggle = () => {
    setup.hidden = mode !== 'gptoss';
    localStatus.hidden = mode !== 'kogpt2' && mode !== 'pytorch';
    updateStatus();
    if (mode === 'pytorch') void connectPyTorch().catch(() => {});
  };
  toggle(); window.addEventListener('gfd:ai-mode-changed', toggle);
  const button = document.createElement('button'); button.textContent = '로컬 모델 관리';
  button.addEventListener('click', () => { details.open = false; window.dispatchEvent(new CustomEvent('gfd:open-local-models')); });
  details.append(summary, select, localStatus, retryGPU, setup, button); shadow.append(style, details);
  if (window.mountGoldFireChatTool) window.mountGoldFireChatTool(host);
  else document.documentElement.append(host);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
