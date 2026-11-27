const textDecoder = new TextDecoder('utf-8', {fatal:true});

export function decode(bytes) {
  try { return textDecoder.decode(bytes).trim(); }
  catch { throw Error('UTF-8 텍스트, JSON 또는 ZIP 파일을 선택하세요.'); }
}
function json(text) {
  try { return JSON.parse(text); }
  catch { throw Error('플러그인 JSON 문법을 확인하세요.'); }
}
function deriveId(name) {
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return 'file-' + (hash >>> 0).toString(36);
}
export function record(meta, title, context) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw Error('플러그인 설명 파일을 확인하세요.');
  const ui = meta.extensions?.['com.openai']?.interface || meta.interface || {};
  const name = ui.displayName || meta.name || title;
  const packageId = meta.name || title;
  const id = meta.id ?? (/^[a-z0-9][a-z0-9-]{0,79}$/.test(packageId) ? packageId : deriveId(packageId));
  const instructions = context || meta.context || meta.instructions || ui.defaultPrompt;
  if (typeof instructions !== 'string' || !instructions.trim()) throw Error('적용할 지침이 없습니다. context 또는 instructions를 넣거나 ZIP에 web-plugin.json 또는 SKILL.md를 포함하세요.');
  if (instructions.length > 8000) throw Error('플러그인 지침은 8,000자까지 지원합니다.');
  return {id, name, version:meta.version || '1.0', description:meta.description || '', context:instructions.trim()};
}
async function unpack(bytes, title) {
  const {unzipSync} = await import('./unzip.mjs');
  let count = 0, length = 0;
  let files;
  try {
    files = unzipSync(bytes, {filter(item) {
      if (/(^|\/)(?:__MACOSX|node_modules)(\/|$)/.test(item.name) || !/(^|\/)(?:web-plugin\.json|plugin\.json|SKILL\.md)$/i.test(item.name)) return false;
      length += item.originalSize;
      if (++count > 64 || length > 524288 || /(^|\/)\.\.(\/|$)|[\\\x00]/.test(item.name)) throw Error();
      return true;
    }});
  } catch { throw Error('ZIP을 읽을 수 없습니다. 플러그인 설명과 지침 파일의 크기를 확인하세요.'); }
  const paths = Object.keys(files);
  function one(pattern) {
    const matches = paths.filter(path => pattern.test(path));
    if (matches.length > 1) throw Error('ZIP 하나에 플러그인 하나만 넣어 주세요.');
    return matches[0];
  }
  const metadata = one(/(^|\/)plugin\.json$/i);
  const adapter = one(/(^|\/)web-plugin\.json$/i);
  const meta = metadata ? json(decode(files[metadata])) : {};
  const web = adapter ? json(decode(files[adapter])) : {};
  const skills = paths.filter(path => /(^|\/)SKILL\.md$/i.test(path)).sort();
  if (!metadata && !adapter && !skills.length) throw Error('ZIP 안에 plugin.json, web-plugin.json 또는 SKILL.md가 필요합니다.');
  const context = web.context || web.instructions || meta.context || meta.instructions || skills.map(path => decode(files[path])).join('\n\n');
  return record(metadata ? meta : web, title, context);
}
export async function importFile(file) {
  if (!file.size || file.size > 32 * 1024 * 1024) throw Error('32MB 이하의 플러그인 파일을 선택하세요.');
  const title = file.name.replace(/\.[^.]+$/, '') || file.name;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 80 && bytes[1] === 75) return unpack(bytes, title);
  if (bytes.length > 65536) throw Error('텍스트와 JSON 플러그인은 64KB 이하로 저장하세요.');
  const source = decode(bytes);
  if (/^[{[]/.test(source) || /\.json$/i.test(file.name)) return record(json(source), title);
  if (/\.(?:txt|md|markdown)$/i.test(file.name) && !/[\x00-\x08\x0e-\x1f]/.test(source)) return record({}, title, source);
  throw Error('JSON, ZIP, 마크다운 또는 일반 텍스트로 된 채팅 지침 플러그인을 선택하세요.');
}
