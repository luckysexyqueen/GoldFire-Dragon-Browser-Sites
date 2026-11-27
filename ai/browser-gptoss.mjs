import { decodeBase64Model } from './base64-model.mjs';
import { LocalGGUFEngine } from './local-gguf.mjs?v=browser20b';
import { koreanInstructions } from './language.mjs';

const size = 11872345184;
const name = 'gpt-oss-20b-UD-Q4_K_XL.gguf';
const revision = '4782614e97a6ca8b27ebf9c8916ac15f0a850887';
const modelURL = 'https://huggingface.co/unsloth/gpt-oss-20b-GGUF/resolve/' + revision + '/' + name;

const engine = new LocalGGUFEngine();
let preparing;
let status = '';
export function modelStatus() { return status; }
export async function browserModelState() {
  if (engine.getStatus().ready) return '준비 완료';
  if (!navigator.storage?.getDirectory) return '저장 상태 확인 불가';
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('goldfire-' + revision);
    const file = await (await dir.getFileHandle(name)).getFile();
    return file.size === size ? '기기에 저장됨' : '기본 모델 준비 필요';
  } catch (error) {
    return error.name === 'NotFoundError' ? '기본 모델 준비 필요' : '저장 상태 확인 불가';
  }
}
function report(message) {
  status = message;
  window.dispatchEvent(new Event('gfd:browser-model-progress'));
}
async function baseModel(allowDownload, selectedFile) {
  const encoded = selectedFile && /\.(b64|base64|txt)$/i.test(selectedFile.name);
  if (selectedFile && !encoded) {
    if (selectedFile.size !== size) throw Error('선택한 파일의 크기가 지정된 GPT-OSS 20B 기본 모델과 다릅니다.');
    return selectedFile;
  }
  if (!navigator.storage?.getDirectory) throw Error('이 브라우저에서 모델 저장소를 열 수 없습니다. AI 연결에서 기본 모델 파일을 직접 선택하세요.');
  const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('goldfire-' + revision, {create:true});
  const handle = await dir.getFileHandle(name, {create:true});
  const existing = await handle.getFile();
  if (!encoded && existing.size === size) return existing;
  if (!allowDownload) {
    window.dispatchEvent(new Event('gfd:open-browser-model'));
    throw Error('첫 사용 시 AI 연결에서 기본 모델 다운로드 또는 파일 선택을 눌러 주세요.');
  }
  const {usage,quota} = await navigator.storage.estimate();
  if (quota && quota - usage < size) throw Error('사이트 저장 공간이 부족합니다. 기본 모델 파일을 직접 선택할 수도 있습니다.');
  let stream;
  if (encoded) {
    stream = selectedFile.stream().pipeThrough(new TextDecoderStream()).pipeThrough(decodeBase64Model(size));
  } else {
    const response = await fetch(modelURL, {credentials:'omit'});
    if (!response.ok || !response.body) throw Error('기본 모델 다운로드 실패 (' + response.status + ')');
    stream = response.body;
  }
  let received = 0;
  let previous = -1;
  const progress = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > size) throw Error('기본 모델 파일 크기가 예상과 다릅니다.');
      const percent = Math.floor(received * 100 / size);
      if (percent !== previous) { report('기본 모델 저장 중 · ' + percent + '%'); previous = percent; }
      controller.enqueue(chunk);
    },
    flush() { if (received !== size) throw Error('다운로드가 끝나기 전에 연결이 끊겼습니다.'); },
  });
  await stream.pipeThrough(progress).pipeTo(await handle.createWritable());
  return handle.getFile();
}
async function prepare(allowDownload, file) {
  if (!WebAssembly.Suspending) throw Error('현재 브라우저에는 20B 모델을 읽는 WebAssembly JSPI 기능이 없습니다. 최신 64비트 Chrome 또는 Edge에서 열어 주세요.');
  try { new WebAssembly.Memory({address:'i64', initial:1n}); }
  catch { throw Error('이 브라우저는 64비트 WebAssembly 메모리를 지원하지 않습니다.'); }
  const gpu = await navigator.gpu?.requestAdapter();
  if (!gpu) throw Error('GPT-OSS 20B를 실행할 WebGPU 장치를 찾지 못했습니다. 하드웨어 가속이 켜진 64비트 브라우저에서 열어 주세요.');
  const response = await fetch(new URL('../models/gpt-oss/gptossuncensor20blora.gguf', import.meta.url));
  if (!response.ok) throw Error('내장 LoRA 파일을 불러오지 못했습니다 (' + response.status + ')');
  const adapter = await response.blob();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await adapter.arrayBuffer()));
  if (Array.from(digest, n => n.toString(16).padStart(2,'0')).join('') !== '4700f1741ae5d866fd6f16548758cf58e5cf34ed41173381e49d864d04ff97e0') throw Error('LoRA 원본 파일 검증에 실패했습니다.');
  const wasm = await fetch('https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/src/wasm/wllama.wasm', {cache:'force-cache'});
  if (!wasm.ok) throw Error('브라우저 추론 엔진 다운로드 실패 (' + wasm.status + ')');
  const binary = await wasm.blob();
  const magic = new Uint8Array(await binary.slice(0,4).arrayBuffer());
  if (magic.join(',') !== '0,97,115,109') throw Error('추론 엔진 파일이 손상되었습니다. 새로고침 후 다시 시도하세요.');
  const base = await baseModel(allowDownload, file);
  const prefix = new TextDecoder().decode(await base.slice(0,8192).arrayBuffer());
  if (!prefix.startsWith('GGUF') || !prefix.includes('gpt-oss')) throw Error('GPT-OSS 기본 모델 GGUF 헤더를 찾지 못했습니다.');
  report('브라우저에서 기본 모델과 LoRA를 불러오는 중…');
  const wasmURL = URL.createObjectURL(new Blob([binary], {type:'application/wasm'}));
  try {
    await engine.loadInternal([base], {adapter, wasmURL, useGpu:true, contextLength:2048, onProgress:report}, 'GPT-OSS 20B + uncensor LoRA', size);
  } finally { URL.revokeObjectURL(wasmURL); }
  report('브라우저 모델 준비 완료');
}
export function prepareModel(allowDownload = false, file) {
  if (engine.getStatus().ready) return Promise.resolve();
  if (!preparing) preparing = prepare(allowDownload, file).catch(error => {
    report(error.message); throw error;
  }).finally(() => { preparing = undefined; });
  return preparing;
}
export {modelURL};
export async function generateGPTOSS({messages, systemPrompt, instructions, maxTokens, signal, onToken}) {
  await prepareModel();
  const system = koreanInstructions([systemPrompt,instructions,...messages.filter(m=>m.role==='system').map(m=>m.content)].filter(Boolean).join('\n\n'));
  return engine.generate([{role:'system',content:system}, ...messages.filter(m=>m.role!=='system')], {maxTokens,signal,onToken});
}
