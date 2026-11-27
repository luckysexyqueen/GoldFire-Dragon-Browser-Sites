import { passages } from './korean-dialogue.mjs';
import { capitals } from './korean-capitals.mjs';

const regionNames = new Intl.DisplayNames('ko', { type: 'region' });
const extraNames = { KR: ['남한', '한국', '대한민국'], US: ['미합중국'], GB: ['브리튼'], AU: ['오스트레일리아'], CN: ['중화인민공화국'] };
const countries = Object.entries(capitals).map(([code, capital]) => ({
  capital, names: [regionNames.of(code), ...(extraNames[code] || [])]
}));
function lookupCapital(question) {
  if (!/수도/.test(question) || /옛|이전|역사|과거|가상|말고|경제|왜|비교|이유|아닌|아니라/.test(question)) return;
  const selected = countries.filter(country => country.names.some(name => question.includes(name)));
  if (selected.length !== 1) return;
  const value = selected[0].capital;
  return { reference: '지리 자료: 수도는 ' + value + '.', exact: /한\s*단어|이름만|답만|수도만/.test(question) ? value : '' };
}

function terms(text) {
  const words = text.normalize('NFKC').toLowerCase().match(/[가-힣a-z0-9]+/g) || [];
  const result = new Set();
  for (const word of words) {
    if (['한', '줄', '써', '줘', '말해', '말을', '주세요', '한국어', '한국어로'].includes(word)) continue;
    for (let i = 0; i < word.length - 1; i++) result.add(word.slice(i, i + 2));
  }
  return result;
}
const documents = passages.map(([question, answer]) => ({ terms: terms(question), answer }));
const frequencies = new Map();
for (const doc of documents) {
  for (const term of doc.terms) frequencies.set(term, (frequencies.get(term) || 0) + 1);
}

function example(question) {
  const query = terms(question);
  let best, bestScore = 0;
  for (const doc of documents) {
    let weight = 0, matches = 0;
    for (const t of doc.terms) {
      if (!query.has(t)) continue;
      weight += Math.log((1 + documents.length) / frequencies.get(t));
      matches++;
    }
    const score = weight / Math.sqrt((4 + query.size) * (4 + doc.terms.size));
    if (matches >= 2 && score > bestScore) { best = doc.answer; bestScore = score; }
  }
  return bestScore >= 0.7 ? best : '';
}
const entityWords = /강아지|반려견|고양이|반려묘|친구|동생|언니|형|오빠|누나|별명|닉네임|캐릭터|인형|토끼|앵무새|거북이/g;
function entities(text) {
  return (text.match(entityWords) || []).map(word => ({ 반려견: '강아지', 반려묘: '고양이', 닉네임: '별명' }[word] || word));
}
function previousName(question, history) {
  if (!/이름|별명|닉네임/.test(question) || /짓|추천|바꿔|지어/.test(question)) return '';
  const subjects = entities(question);
  for (const message of history.filter(m => m.role === 'user').reverse()) {
    const text = String(message.content).trim();
    if (/[?？]|뭐였|뭐야|누구|아니야|아니고/.test(text)) continue;
    const candidates = entities(text);
    if (subjects.length && !subjects.some(s => candidates.includes(s))) continue;
    const named = text.match(/(?:이름|별명|닉네임)(?:은|는|이|가)\s*[“"'‘]?([가-힣A-Za-z0-9 -]{1,25}?)[”"'’]?(?:이라고|라고|이야|야|이에요|예요|입니다|[.!]|$)/);
    const stated = !named && candidates.length && text.match(/(?:강아지|반려견|고양이|반려묘|토끼)(?:는|은)\s*([가-힣A-Za-z0-9-]{1,16}?)(?:이야|야|이에요|예요|입니다)[.!]?$/);
    if (named || stated) return (named || stated)[1].trim();
  }
  return '';
}
export function groundKorean(messages) {
  const last = messages.findLastIndex(m => m.role === 'user');
  if (last < 0) return {};
  const question = String(messages[last].content).trim();
  const value = previousName(question, messages.slice(0, last));
  if (value) return { reference: '사용자가 알려 준 이름: ' + value, exact: /이름만|별명만|닉네임만/.test(question) ? value : '' };
  const capital = lookupCapital(question);
  if (capital) return capital;
  const match = example(question);
  return match ? { reference: '참고 문장: ' + match } : {};
}
