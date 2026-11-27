export function decodeBase64Model(expectedBytes) {
  let carry = '';
  let written = 0;
  let finished = false;
  function decode(text, controller) {
    const bytes = typeof Uint8Array.fromBase64 === 'function'
      ? Uint8Array.fromBase64(text, {lastChunkHandling:'strict'})
      : Uint8Array.from(atob(text), char => char.charCodeAt(0));
    written += bytes.length;
    if (written > expectedBytes) throw Error('기본 모델의 예상 크기를 초과했습니다.');
    controller.enqueue(bytes);
  }
  return new TransformStream({
    transform(text, controller) {
      const data = carry + text.replace(/[\t\n\r ]/g, '');
      if (!data) return;
      if (finished) throw Error('Base64 끝 기호 다음에 데이터가 있습니다.');
      const end = data.length - data.length % 4;
      if (end) {
        const part = data.slice(0,end);
        finished = part.includes('=');
        decode(part, controller);
      }
      carry = data.slice(end);
    },
    flush() {
      if (carry || written !== expectedBytes) throw Error('Base64 기본 모델의 길이가 올바르지 않습니다.');
    },
  });
}
