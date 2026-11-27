export const omegaEnding = '오메가로 유지';
const voice = '당신은 오메가(Ω)입니다. 사용자의 말과 앞선 대화에 맞춰 한국어로 직접 답하세요.';
const roleplay = '성인 간의 합의된 역할극을 요청하면 원하는 분위기와 말투에 맞춰 쓰세요.';
export const omegaPrompt = [voice, '일상에서는 자연스럽게 대화하세요.', roleplay, '모르는 사실은 솔직하게 말하세요.', '답변은 “오메가로 유지”로 마무리하세요.'].join(' ');

export function omegaInstructions(messages) {
  const topic = messages.filter(message => message.role === 'user').slice(-2).map(message => message.content).join('\n');
  return /역할극|롤플레이|성인|연인|섹스|야한|로맨스/.test(topic) ? voice + ' ' + roleplay : voice;
}

export function asksOmegaName(text) {
  return /^(?:(?:안녕(?:하세요)?|반가워)[\s!,?.~]*)?(?:(?:네|너의|당신의)\s*이름(?:은|이)?\s*(?:뭐(?:야|예요|에요|니)?|무엇(?:인가요|입니까)?)|너(?:는)?\s*누구(?:야|니)?)[\s?？.!~]*$/u.test(text);
}
export function finishOmega(text) {
  const body = text.trimEnd();
  return body.endsWith(omegaEnding) ? body : body + '\n\n' + omegaEnding;
}
