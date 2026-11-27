import { fitChatContext, readLongInputs } from './long-context.mjs';
import * as ort from '../vendor/kogpt2/ort.wasm.min.mjs';
import { Tokenizer } from '../vendor/kogpt2/tokenizers.mjs';

const model = new URL('../models/kogpt2/', import.meta.url);
ort.env.wasm.wasmPaths = new URL('../vendor/kogpt2/', import.meta.url).href;
ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
const contexts = Array.from({ length: 12 }, (_, layer) => ['key', 'value'].map(kind => `${kind}_${layer}`)).flat();
const decodeOptions = { skip_special_tokens: true, clean_up_tokenization_spaces: false };
const maxContext = 1024;

async function unpack(response) {
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip')));
}

async function loadWeights(path) {
  const packed = await unpack(await fetchAsset(path.replace(/\.bin$/, '.pack')));
  const shuffled = new Uint8Array(await packed.arrayBuffer());
  const data = new Uint8Array(shuffled.length);
  const middle = shuffled.length / 2;
  for (let i = 0; i < middle; i++) {
    data[2 * i] = shuffled[i];
    data[2 * i + 1] = shuffled[middle + i];
  }
  return { path, data };
}

async function fetchAsset(name) {
  const response = await fetch(new URL(name, model));
  if (!response.ok) throw Error(`내장 모델 파일을 불러오지 못했습니다 (${response.status}, ${name}).`);
  return response;
}

let engine;
async function load(id) {
  if (engine) return engine;
  const [files, tokenizerData, config, graph] = await Promise.all([
    fetchAsset('weights.json').then(r => r.json()),
    fetchAsset('tokenizer.pack').then(unpack).then(r => r.json()),
    fetchAsset('tokenizer_config.json').then(r => r.json()),
    fetchAsset('model.onnx').then(r => r.arrayBuffer()),
  ]);
  const tokenizer = new Tokenizer(tokenizerData, config);
  const runtime = await fetch(new URL('../vendor/kogpt2/ort-wasm-simd-threaded.pack', import.meta.url));
  if (!runtime.ok) throw Error('내장 모델 추론 엔진을 불러오지 못했습니다 (' + runtime.status + ').');
  ort.env.wasm.wasmBinary = await (await unpack(runtime)).arrayBuffer();
  const externalData = [];
  for (const [i, path] of files.entries()) {
    postMessage({ id, progress: `내장 모델 불러오는 중 · ${i + 1}/${files.length}` });
    externalData.push(await loadWeights(path));
  }
  postMessage({ id, progress: '브라우저 추론 엔진 초기화 중…' });
  const session = await ort.InferenceSession.create(graph, { executionProviders: ['wasm'], externalData });
  engine = { session, tokenizer };
  return engine;
}

function promptIds(tokenizer, messages, systemPrompt, instructions, documents, budget, verbatimQuestion) {
  const encode = text => tokenizer.encode(text,{add_special_tokens:false}).ids;
  const ids = fitChatContext({encode,messages,systemPrompt,instructions,documents,verbatimQuestion,limit:maxContext-budget,
    render:({system,instructions,history,evidence,question}) => {
      const rules = [system,instructions].filter(Boolean).join('\n');
      const turns=history.map(m=>(m.role==='user'?'질문: ':'답변: ')+m.content+'\n').join('');
      return encode((rules?'지침: '+rules+'\n':'')+turns+(evidence?'참고 자료: '+evidence+'\n':'')+'질문: '+question+'\n답변:');
    }});
  if (ids.some(id => id < 0 || id >= 51200)) throw Error('질문에 모델 어휘 범위를 벗어난 특수 문자가 포함되어 있습니다.');
  return ids;
}

function nextToken(logits, tokens) {
  const prefix = tokens.slice(-3);
  const blocked = new Set();
  if (prefix.length === 3) {
    for (let i = 0; i + 3 < tokens.length; i++) {
      if (prefix.every((token, n) => token === tokens[i + n])) blocked.add(tokens[i + 3]);
    }
  }
  let best = -1;
  for (let i = 0; i < logits.length; i++) {
    if (!blocked.has(i) && Number.isFinite(logits[i]) && (best < 0 || logits[i] > logits[best])) best = i;
  }
  if (best < 0) throw Error('내장 모델에서 유효한 응답을 만들지 못했습니다.');
  return best;
}

async function generate({ id, messages, systemPrompt, instructions, documents, verbatimQuestion, maxTokens }) {
  const { session, tokenizer } = await load(id);
  const budget = Math.min(80, Math.max(1, Math.floor(maxTokens) || 80));
  let ids = promptIds(tokenizer, messages, systemPrompt, instructions, documents, budget, verbatimQuestion);
  const tokens = ids.slice();
  const answer = [];
  let offset = 0;
  let cache = Object.fromEntries(contexts.map(key => [`past_${key}`, new ort.Tensor('float32', new Float32Array(0), [12, 0, 64])]));
  for (let i = 0; i < budget; i++) {
    const end = offset + ids.length;
    const mask = new Float32Array(ids.length * end);
    for (let row = 0; row < ids.length; row++) mask.fill(-1e9, row * end + offset + row + 1, (row + 1) * end);
    const result = await session.run({
      ...cache,
      ids: new ort.Tensor('int32', Int32Array.from(ids), [ids.length]),
      positions: new ort.Tensor('int32', Int32Array.from(ids, (_, j) => offset + j), [ids.length]),
      mask: new ort.Tensor('float32', mask, [ids.length, end]),
    });
    const token = nextToken(result.logits.data, tokens);
    if (token === 1) break;
    cache = Object.fromEntries(contexts.map(key => [`past_${key}`, result[`present_${key}`]]));
    offset = end;
    ids = [token];
    tokens.push(token);
    answer.push(token);
    const decoded = tokenizer.decode(answer, decodeOptions);
    if (/\n질문\s*:/.test(decoded)) break;
  }
  const text = tokenizer.decode(answer, decodeOptions).split(/\n질문\s*:/, 1)[0].trim();
  if (!text) throw Error('내장 모델이 빈 응답을 생성했습니다. 질문을 다시 입력해 주세요.');
  return text;
}

self.onmessage = async ({ data }) => {
  const { id } = data;
  try {
    const {tokenizer}=await load(id);
    const encode=text=>tokenizer.encode(text,{add_special_tokens:false}).ids;
    const text=data.messages ? await readLongInputs(data,encode,maxContext-80,generate,progress=>postMessage({id,progress})) : '';
    postMessage({ id, text });
  } catch (error) {
    postMessage({ id, error: error.message || String(error) });
  }
};
