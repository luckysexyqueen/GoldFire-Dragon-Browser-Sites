import {importFile} from './import-file.mjs';

const host = document.createElement('div');
host.id = 'gfd-generation-dialog';
const shadow = host.attachShadow({mode:'open'});
shadow.innerHTML = `
  <style>
    :host{font:15px/1.55 system-ui,sans-serif;color:#f5f1ee}
    *{box-sizing:border-box}
    dialog{width:min(440px,calc(100% - 24px));max-height:85vh;max-height:85dvh;overflow:auto;background:#191923;color:#f5f1ee;border:1px solid #575060;border-radius:14px;padding:20px;font:inherit}
    dialog::backdrop{background:rgb(9 7 15 / 75%)}
    header,.row,.actions{display:flex;align-items:center;gap:10px}header{justify-content:space-between;margin-bottom:15px}
    h2,h3,p{margin:0}h2{font-size:20px}h3{font-size:15px;margin:18px 0 5px}
    button,a,label,summary{cursor:pointer;font:inherit}button,a{color:inherit}
    button,.upload{background:#302d3c;border:1px solid #655d72;border-radius:8px;padding:8px 12px;min-height:40px}
    button:focus-visible,summary:focus-visible,a:focus-visible,.upload:focus-within{outline:2px solid #ffd889;outline-offset:3px}
    .next,.upload{width:100%;display:block;text-align:center}.upload{position:relative;background:#f5d68c;color:#251d11;border-color:#f5d68c;font-weight:700}
    .upload input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
    p,small,summary,a{font-size:14px}.hint,small{color:#c7c0ce}.hint{margin:.6em 0}a{color:#f5d68c}
    article{padding:12px 0;border-top:1px solid #474251;overflow-wrap:anywhere}
    .row{justify-content:space-between;flex-wrap:wrap}.row strong{flex:1 1 9rem}small{display:block}
    .actions{flex-wrap:wrap;gap:6px}.active{border-color:#ebc775;color:#ffe1a0}details{margin:.5em 0}
    details p{white-space:pre-wrap;margin:.6em 0}.status{margin-top:12px;overflow-wrap:anywhere}.status:empty{display:none}
    [hidden]{display:none!important}
  </style>
  <dialog aria-labelledby="title">
    <header><h2 id="title">생성 설정</h2><button type="button" id="close" aria-label="생성 설정 닫기">닫기</button></header>
    <nav id="categories" aria-label="생성 설정 항목" style="display:grid;gap:9px"><button type="button" class="next" id="custom">커스텀 플러그인</button><button type="button" class="next" id="skills">커스텀 스킬</button></nav>
    <section id="library" hidden>
      <label class="upload"><span id="fileLabel">플러그인 파일 설치</span><input type="file" id="file"></label>
      <p class="hint">채팅 지침이 담긴 JSON, ZIP, 마크다운, 텍스트 파일을 설치하세요. 적용한 지침은 다음 대화 요청부터 사용됩니다.</p>
      <a id="sample" download="답변-첫줄-요약.json">예제 플러그인 받기</a>
      <p class="status" role="status" aria-live="polite"></p>
      <h3 id="installedTitle">직접 설치한 플러그인</h3><div id="installed"></div>
      <div id="catalogProblem" hidden><p role="status" id="catalogMessage"></p><button type="button" id="retryCatalog">목록 다시 불러오기</button></div>
      <details id="bundled"><summary>기본 플러그인</summary><div id="catalog"></div></details>
    </section>
  </dialog>`;
document.body.append(host);
const get = id => shadow.getElementById(id);
const dialog = shadow.querySelector('dialog'), status = shadow.querySelector('.status');
const sample = {id:'first-line-summary', name:'첫 줄 요약', version:'1.0', description:'답변 형식을 지정합니다.', context:'첫 줄에 핵심 답을 한 문장으로 요약한 뒤 필요한 세부 내용을 설명하세요.'};
const pluginExample = URL.createObjectURL(new Blob([JSON.stringify(sample, null, 2)], {type:'application/json'}));
const skillExample = URL.createObjectURL(new Blob(['---\nname: explain-in-steps\ndescription: 작업 방법을 요청하면 각 단계를 짧고 따라 하기 쉽게 설명합니다.\n---\n# 단계별 설명\n\n방법을 묻는 질문에는 필요한 준비물을 먼저 알려 주세요. 이어서 실행 순서대로 번호를 붙이고, 각 단계에 한 가지 행동을 적으세요.'], {type:'text/markdown;charset=utf-8'}));

let manager, pending = false, kind = 'plugin';
const kindLabel = () => kind === 'skill' ? '스킬' : '플러그인';
function button(label, id, action) {
  const element = document.createElement('button');
  element.type = 'button'; element.textContent = label;
  element.dataset.id = id; element.dataset.action = action;
  return element;
}
function row(item) {
  const article = document.createElement('article'), head = document.createElement('div'), name = document.createElement('strong');
  head.className = 'row'; name.textContent = item.name;
  const state = document.createElement('small');
  state.textContent = [item.version, item.enabled ? '적용 중' : '미적용'].filter(Boolean).join(' · ');
  name.append(state);
  const actions = document.createElement('div');
  actions.className = 'actions';
  if (item.context) {
    const toggle = button(item.enabled ? '적용 해제' : '적용', item.id, item.enabled ? 'off' : 'on');
    toggle.setAttribute('aria-label', item.name + ' ' + toggle.textContent);
    toggle.classList.toggle('active', item.enabled);
    actions.append(toggle);
  }
  if (item.custom) {
    const remove = button('삭제', item.id, 'remove');
    remove.setAttribute('aria-label', item.name + ' 삭제');
    actions.append(remove);
  }
  head.append(name, actions); article.append(head);
  if (item.description || item.context) {
    const detail = document.createElement('details'), summary = document.createElement('summary'), text = document.createElement('p');
    summary.textContent = '설명과 지침 보기';
    text.textContent = [item.description, item.context].filter(Boolean).join('\n\n');
    detail.append(summary,text); article.append(detail);
  }
  return article;
}
function render() {
  if (!manager || !dialog.open || get('library').hidden) return;
  const all = manager.list();
  const installed = all.filter(item=>item.custom && item.kind === kind);
  get('installed').replaceChildren(...installed.map(row));
  if (!installed.length) get('installed').textContent = '아직 설치한 ' + (kind === 'skill' ? '스킬이' : '플러그인이') + ' 없습니다.';
  const catalog = all.filter(item=>!item.custom);
  const catalogState = manager.catalogState?.() || 'ready';
  get('catalogProblem').hidden = kind === 'skill' || catalogState === 'ready';
  get('retryCatalog').disabled = catalogState === 'loading';
  get('catalogMessage').textContent = catalogState === 'loading' ? '기본 플러그인 목록을 불러오는 중…' : '기본 제공 목록을 표시합니다. 최신 목록을 다시 불러올 수 있습니다.';
  get('bundled').hidden = kind === 'skill' || !catalog.length;
  get('catalog').replaceChildren(...catalog.map(row));
}
async function change(work) {
  if (pending) return;
  pending = true;
  get('file').disabled = true;
  get('installed').inert = get('catalog').inert = true;
  try {
    manager = await window.GFDPluginsReady;
    if (!manager?.install) throw Error('설치 목록을 열 수 없습니다. 페이지를 새로고침해 주세요.');
    await work();
    render();
    window.dispatchEvent(new CustomEvent('gfd:plugins-changed'));
  } catch (error) {
    status.textContent = /Invalid|sensitive/.test(error.message) ? '식별자, 이름, 버전과 지침 내용을 확인하세요.' : error.message;
  } finally {
    pending = get('file').disabled = get('installed').inert = get('catalog').inert = false;
  }
}
document.addEventListener('click', event => {
  if (!event.target.closest?.('[data-gfd-generation-settings]')) return;
  get('title').textContent = '생성 설정';
  get('categories').hidden = false; get('library').hidden = true;
  status.textContent = '';
  if (!dialog.open) dialog.showModal();
  get('custom').focus();
});
get('close').onclick = () => dialog.close();
async function openLibrary(nextKind) {
  kind = nextKind;
  const label = kindLabel(), skill = kind === 'skill';
  get('title').textContent = '커스텀 ' + label;
  get('fileLabel').textContent = label + ' 파일 설치';
  get('installedTitle').textContent = '직접 설치한 ' + label;
  shadow.querySelector('.hint').textContent = skill
    ? 'SKILL.md 또는 스킬 하나가 들어 있는 ZIP을 설치하세요. JSON과 텍스트 지침도 사용할 수 있습니다. 적용한 스킬은 다음 대화 요청부터 사용됩니다.'
    : '채팅 지침이 담긴 JSON, ZIP, 마크다운, 텍스트 파일을 설치하세요. 적용한 지침은 다음 대화 요청부터 사용됩니다.';
  const example = get('sample');
  example.href = skill ? skillExample : pluginExample;
  example.download = skill ? 'SKILL.md' : '답변-첫줄-요약.json';
  example.textContent = '예제 ' + label + ' 받기';
  get('categories').hidden = true; get('library').hidden = false;
  status.textContent = '설치 목록을 여는 중…';
  await change(async () => {
    status.textContent = '';
    if (!skill && manager.catalogState?.() === 'fallback') manager.retryCatalog();
  });
  get('file').focus();
}
get('custom').onclick = () => openLibrary('plugin');
get('skills').onclick = () => openLibrary('skill');
get('retryCatalog').onclick = () => manager?.retryCatalog();
window.addEventListener('gfd:catalog-updated', render);
get('file').onchange = () => {
  const file = get('file').files[0];
  get('file').value = '';
  if (!file) return;
  const fileKind = kind;
  change(async () => {
    const read = fileKind === 'skill' ? (await import('./import-skill.mjs')).importSkill : importFile;
    const result = await manager.install(await read(file), fileKind);
    status.textContent = result + ' 설치 완료. 지침을 확인하고 적용을 누르세요.';
  });
};
get('library').addEventListener('click', event => {
  const action = event.target.closest('button[data-action]');
  if (!action) return;
  const {id, action:operation} = action.dataset;
  change(async () => {
    if (operation === 'remove') {
      await manager.uninstall(id); status.textContent = kind === 'skill' ? '스킬을 삭제했습니다.' : '플러그인을 삭제했습니다.';
    } else {
      const enabled = operation === 'on';
      await manager.configure(id, enabled);
      status.textContent = enabled ? '적용했습니다. 다음 대화 요청에 이 지침이 포함됩니다.' : '적용을 해제했습니다.';
    }
  });
});
window.addEventListener('storage', event => {
  if (!event.key || event.key.startsWith('gfd-installed:') || event.key.startsWith('gfd-plugin:')) render();
});
const embeddedButton = document.querySelector('#browser-tools [data-gfd-generation-settings]');
if (embeddedButton) {
  try {
    if (window.frameElement?.id === 'brow-iframe' && parent.document.querySelector('#brow-tb [data-gfd-generation-settings]')) {
      const sync = () => { embeddedButton.hidden = !document.fullscreenElement; };
      document.addEventListener('fullscreenchange', sync); sync();
    }
  } catch { /* 독립 브라우저 화면에서도 설정 버튼을 표시합니다. */ }
}
