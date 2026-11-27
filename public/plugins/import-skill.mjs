import {decode, record} from './import-file.mjs?v=skills';

async function markdown(source, fallbackName) {
  const normalized = source.replace(/\r\n?/g, '\n');
  let body = normalized, meta = {};
  if (/^---[ \t]*\n/.test(normalized)) {
    const match = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
    if (!match) throw Error('SKILL.md의 정보 영역 끝에 --- 구분선을 넣으세요.');
    const {parse} = await import('./skill-yaml.mjs');
    try { meta = parse(match[1], {schema:'failsafe', maxAliasCount:0}) ?? {}; }
    catch { throw Error('SKILL.md의 이름과 설명이 담긴 YAML 형식을 확인하세요.'); }
    if (typeof meta !== 'object' || Array.isArray(meta)) throw Error('SKILL.md의 정보 영역에 name과 description을 지정하세요.');
    body = normalized.slice(match[0].length).trim();
  }
  if (!body.trim()) throw Error('SKILL.md에 실행할 지침 본문이 필요합니다.');
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallbackName;
  const value = record({...meta, version:meta.version || meta.metadata?.version}, title, body);
  if (typeof meta.name === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(meta.name) && title !== fallbackName) {
    value.name = title;
  }
  return value;
}

async function fromArchive(bytes, title) {
  const {unzipSync} = await import('./unzip.mjs');
  let files, total = 0, count = 0;
  try {
    files = unzipSync(bytes, {filter(entry) {
      const name = entry.name;
      if (/(^|\/)(?:\.[^/]+|__MACOSX|node_modules)(?:\/|$)/.test(name) || name.startsWith('/') || name.includes('\\')) return false;
      if (!/(^|\/)skill\.md$/i.test(name) && !/(^|\/)references\/.*\.(?:txt|md)$/i.test(name)) return false;
      total += entry.originalSize;
      if (++count > 96 || total > 1024 * 1024) throw Error();
      return true;
    }});
  } catch { throw Error('스킬 ZIP을 읽을 수 없습니다. 스킬 본문과 참고 문서는 총 1MB까지 지원합니다.'); }
  const paths = Object.keys(files), roots = paths.filter(name => /(^|\/)skill\.md$/i.test(name));
  if (roots.length !== 1) throw Error('ZIP 하나에 SKILL.md를 하나만 넣어 주세요.');
  const root = roots[0], folder = root.slice(0, root.lastIndexOf('/') + 1);
  const skill = await markdown(decode(files[root]), folder.split('/').filter(Boolean).at(-1) || title);
  const body = skill.context;
  for (const path of paths.sort()) {
    if (!path.startsWith(folder + 'references/')) continue;
    const relative = path.slice(folder.length);
    if (body.includes(relative)) skill.context += '\n\n' + relative + '\n' + decode(files[path]);
  }
  return skill;
}

export async function importSkill(file) {
  if (!file.size || file.size > 32 * 1024 * 1024) throw Error('32MB 이하의 스킬 파일을 선택하세요.');
  const title = file.name.replace(/\.[^.]+$/, '') || file.name;
  const bytes = new Uint8Array(await file.arrayBuffer());
  let skill;
  if (bytes[0] === 80 && bytes[1] === 75) skill = await fromArchive(bytes, title);
  else {
    if (bytes.length > 65536) throw Error('스킬 텍스트와 JSON은 64KB 이하로 저장하세요.');
    const source = decode(bytes);
    if (source.startsWith('{') || /\.json$/i.test(file.name)) {
      let data;
      try { data = JSON.parse(source); } catch { throw Error('스킬 JSON 문법을 확인하세요.'); }
      skill = record(data, title);
    } else {
      if ((!/\.(?:md|markdown|txt)$/i.test(file.name) && !source.startsWith('---')) || /[\x00-\x08\x0e-\x1f]/.test(source))
        throw Error('SKILL.md, ZIP, JSON 또는 텍스트 지침 파일을 선택하세요.');
      skill = await markdown(source, title);
    }
  }
  if (skill.context.length > 8000) throw Error('스킬 본문과 연결된 참고 지침을 합쳐 8,000자 이내로 작성하세요.');
  return skill;
}
