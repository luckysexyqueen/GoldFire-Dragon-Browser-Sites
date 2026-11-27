// 원본은 저장소에 두고 모델에 보낼 발췌본만 토큰 예산에 맞춘다.
function keywords(text) {
  const words = text.toLocaleLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
  return [...new Set(words.flatMap(word => [word, word.replace(/(?:에서는|에서|으로|에게|까지|인가요|은|는|이|가|을|를|의|만)$/, '')])
    .filter(word => word.length > 1 && !/^(무엇|뭐야|문서|알려|주세요|내용|대한|하는|있나요|the|and|what|please)$/.test(word)))];
}

function* passages(text) {
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + 320, text.length);
    const span = text.slice(start,end);
    const newline = span.indexOf('\n');
    if (newline >= 0) end = start + newline + 1;
    else if (end < text.length) {
      const space = span.lastIndexOf(' ');
      if (space > 160) end = start + space + 1;
      if (/[\uD800-\uDBFF]/.test(text[end-1])) end--;
    }
    const value = text.slice(start,end).trim();
    if (value) yield {start, value};
    start = end;
  }
}

function sourceText(source, text = source.text) {
  if (!source.name) return text;
  const origin = source.archived ? 'ZIP 내부 · ' : source.archived === false ? '개별 원본 · ' : '';
  return '[' + origin + source.name + ']\n' + text;
}

function rankedPassages(sources, terms) {
  const top = [], samples = new Map();
  const length = sources.reduce((sum, source) => sum + source.text.length, 0);
  let offset = 0;
  for (const source of sources) {
    const label = source.name || '';
    const name = label.toLowerCase().normalize('NFKC');
    const nameScore = terms.reduce((n, term) => n + (name.includes(term) ? 5 : 0), 0);
    for (const {start,value} of passages(source.text)) {
      const position = offset + start;
      const normalized = value.toLowerCase().normalize('NFKC');
      let score = nameScore;
      for (const term of terms) if (normalized.includes(term)) score += Math.min(term.length,8);
      const entry = { position, score, archived: !!source.archived, value: sourceText(source,value) };
      const bucket = Math.min(7, Math.floor(position / Math.max(1,length) * 8));
      if (!samples.has(bucket) || bucket === 7) samples.set(bucket, entry);
      if (!score || (top.length === 20 && score < top.at(-1).score) || top.some(p => p.value === entry.value)) continue;
      top.push(entry);
      top.sort((a,b) => b.score-a.score || Number(a.archived)-Number(b.archived) || a.position-b.position);
      if (top.length > 20) top.pop();
    }
    offset += source.text.length;
  }
  const ordered = [...top, samples.get(0), samples.get(7), ...samples.values()].filter(Boolean);
  const seen = new Set();
  return ordered.filter(item => !seen.has(item.value) && seen.add(item.value));
}

function fitSection(sources, terms, encode, budget) {
  if (!sources.length || budget < 1) return '';
  const size = sources.reduce((n,s) => n + s.text.length + (s.name?.length || 0), 0);
  if (size <= budget * 6) {
    const whole = sources.map(s => sourceText(s)).join('\n');
    if (encode(whole).length <= budget) return whole;
  }
  const selected = [];
  let remaining = budget;
  for (const item of rankedPassages(sources, terms)) {
    let text = item.value;
    const cost = encode(text).length + 1;
    if (cost > remaining) {
      if (selected.length) continue;
      const chars = Array.from(text);
      let low = 0, high = chars.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (encode(chars.slice(0,mid).join('')).length <= remaining) low = mid;
        else high = mid - 1;
      }
      text = chars.slice(0,low).join('');
    }
    if (text) selected.push({...item, value:text});
    remaining -= Math.min(cost,remaining);
    if (!remaining) break;
  }
  return selected.sort((a,b) => a.position-b.position).map(item=>item.value).join('\n');
}

export function fitChatContext({encode,render,limit,messages,systemPrompt,instructions,documents = [],verbatimQuestion=false}) {
  const last = messages.findLastIndex(message => message.role === 'user');
  if (last < 0) throw Error('질문을 입력해 주세요.');
  const question = String(messages[last].content);
  const system = [systemPrompt,...messages.filter(m => m.role === 'system').map(m=>m.content)].filter(Boolean).join('\n');
  const required = documents.filter(d => d.required);
  if (required.length) {
    const fixed = required.map(d => sourceText({...d,name:String(d.name||'자료').slice(-48)})).join('\n');
    const renderPrompt = render;
    render = parts => renderPrompt({...parts,evidence:[fixed,parts.evidence].filter(Boolean).join('\n')});
    documents = documents.filter(d => !d.required);
  }
  const raw = {system, instructions: instructions || '', question, evidence:'', history:[]};
  const terms = keywords(question.length > 2000 ? question.slice(0,800)+' '+question.slice(-1200) : question);
  let parts = raw, ids;
  const rawSize = system.length + raw.instructions.length + question.length + documents.reduce((n,d)=>n+d.text.length+(d.name?.length||0),0);
  if (rawSize <= limit * 6) {
    parts = {...raw, evidence: documents.map(d=>sourceText(d)).join('\n')};
    ids = render(parts);
  }
  if (!ids || ids.length > limit) {
    const input = {system:[{text:system}], instructions:[{text:raw.instructions}], question:[{text:question}], evidence:documents};
    const weights = {system:2,instructions:2,question:3,evidence:5};
    const available = Math.max(1,limit - render({system:'',instructions:'',question:'',evidence:'',history:[]}).length - 18);
    const sizes = Object.fromEntries(Object.entries(input).map(([key,group])=>{
      const chars=group.reduce((n,s)=>n+s.text.length+(s.name?.length||0),0);
      const cost=chars > limit*6 ? Infinity : encode(group.map(s=>sourceText(s)).join('\n')).length;
      return [key,cost];
    }));
    let left=available;
    const division={};
    // 각 읽기 단계에 배정된 지침과 원문은 다른 자료에 밀리지 않게 먼저 확보한다.
    for (const key of ['system','instructions',...(verbatimQuestion ? ['question'] : [])]) {
      if (Number.isFinite(sizes[key]) && sizes[key] <= left-24) { division[key]=sizes[key]; left-=sizes[key]; }
    }
    const rest=Object.keys(input).filter(key=>!(key in division));
    let weight=rest.reduce((n,key)=>n+weights[key],0);
    for (const key of rest.sort((a,b)=>sizes[a]/weights[a]-sizes[b]/weights[b])) {
      division[key]=Math.min(sizes[key],Math.floor(left*weights[key]/weight));
      left-=division[key]; weight-=weights[key];
    }
    do {
      parts={history:[]};
      for(const key of Object.keys(input)) parts[key]=fitSection(input[key],terms,encode,division[key]);
      ids=render(parts);
      if(ids.length<=limit) break;
      for(const key of Object.keys(division)) division[key]=Math.floor(division[key]*0.8);
    } while(true);
  }
  // 완전한 과거 대화 턴을 최근 순으로 포함한다.
  const history = [];
  for (let end=last;end>0;) {
    let start=end-1;
    while(start>=0 && messages[start].role!=='user') start--;
    if(start<0) break;
    const turn=messages.slice(start,end).filter(m=>m.role==='user'||m.role==='assistant');
    if(turn.some(m=>m.content.length>limit*6)) break;
    const candidate=render({...parts,history:[...turn,...history]});
    if(candidate.length>limit) break;
    history.unshift(...turn); ids=candidate; end=start;
  }
  return ids;
}

// 원문을 다시 조합하면 공백과 줄바꿈까지 동일한 구간으로 나눈다.
export function* textWindows(text, encode, limit) {
  for (let start=0; start<text.length;) {
    const probe=Array.from(text.slice(start,start+limit*6+2));
    if (probe.length && /[\uD800-\uDBFF]/.test(probe.at(-1)) && start+limit*6+2<text.length) probe.pop();
    let low=1, high=probe.length;
    while(low<high) {
      const mid=Math.ceil((low+high)/2);
      if(encode(probe.slice(0,mid).join('')).length<=limit) low=mid;
      else high=mid-1;
    }
    let part=probe.slice(0,low).join('');
    if(start+part.length<text.length) {
      const line=part.lastIndexOf('\n');
      if(line>part.length/2) part=part.slice(0,line+1);
    }
    yield part;
    start+=part.length;
  }
}

export async function readLongInputs(options, encode, inputLimit, infer, progress) {
  const { systemPrompt='', instructions='', documents=[], messages }=options;
  const last=messages.findLastIndex(m=>m.role==='user');
  if(last<0) throw Error('질문을 입력해 주세요.');
  const question=messages[last].content;
  const system=[systemPrompt,...messages.filter(m=>m.role==='system').map(m=>m.content)].filter(Boolean).join('\n');
  const allowance=Math.floor((inputLimit-96)/2);
  const cost=text=>text.length>inputLimit*6?Infinity:encode(text).length;
  const longRules=cost(system)+cost(instructions)>allowance;
  const longQuestion=cost(question)>allowance;
  const readAll=/전부|모두|전체|끝까지|빠짐없이|간추리지|요약하지|전문을|스캔/.test(question);
  if(options.roleplayOnly && longRules && !longQuestion && !readAll) {
    const terms=keywords(question);
    const activeSystem=fitSection([{text:system}],terms,encode,128);
    const activeRules=fitSection([{text:instructions}],terms,encode,160);
    return infer({...options,systemPrompt:activeSystem,instructions:activeRules,
      messages:messages.filter(message=>message.role!=='system')});
  }
  const wholeDocs=documents.length>0 && readAll &&
    documents.reduce((sum,doc)=>sum+cost(doc.text),0)>allowance;
  if(!longRules && !longQuestion && !wholeDocs) return infer(options);
  const plainMessages=messages.filter(m=>m.role!=='system');
  const queryHint=longQuestion ? fitSection([{text:question}],keywords(question.slice(-500)),encode,96) : question;
  const streamSystem=longRules && (cost(system)>allowance/4 || !instructions);
  const streamRules=longRules && (cost(instructions)>allowance/4 || !system);
  const readFields=[];
  if(streamSystem) readFields.push({kind:'system',text:system});
  if(streamRules) readFields.push({kind:'instructions',text:instructions});
  if(longQuestion) readFields.push({kind:'question',text:question});
  if(wholeDocs) for(const doc of documents) readFields.push({kind:'document',...doc});
  function* blocks(){
    for(const field of readFields) for(const text of textWindows(field.text,encode,Math.floor(allowance*0.82))) yield {...field,text};
  }
  const sequence=blocks();
  let current=sequence.next(), draft='', number=0;
  while(!current.done) {
    const field=current.value;
    const next=sequence.next();
    progress?.('원문 구간 '+(++number)+' 읽는 중');
    const active=plainMessages.slice();
    const prompt=field.kind==='question' ? field.text : queryHint;
    active[active.findLastIndex(m=>m.role==='user')]={role:'user',content:prompt};
    const rules=streamRules ? (field.kind==='instructions'?field.text:'') : instructions;
    const persona=streamSystem ? (field.kind==='system'?field.text:'') : system;
    const references=wholeDocs ? [] : documents.slice();
    if(field.kind==='document') references.push({...field,required:true});
    if(draft) references.push({name:'앞 구간을 반영한 답변 초안',text:draft});
    const reply=await infer({...options,messages:active,systemPrompt:persona,
      instructions:rules,documents:references,verbatimQuestion:field.kind==='question',
      maxTokens:next.done?options.maxTokens:Math.min(options.maxTokens||96,96),
      onToken:next.done?options.onToken:undefined});
    draft=reply; current=next;
  }
  return draft;
}
