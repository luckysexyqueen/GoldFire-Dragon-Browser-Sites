// GPTFast의 사전 채움과 단일 토큰 디코딩 구조를 사이트의 정적 KV 슬롯에 맞춰 이식했다.
// MDK8888/GPTFast 926b7553, Core/KVCache/KVCacheModel.py, Apache-2.0 (LICENSE.markdown).
export function createPrefill(forward, batch) {
  let previous = [];
  let previousRoom = null;
  return async (ids, room, report) => {
    let pos = 0;
    // 마지막 토큰을 다시 계산해 다음 토큰의 점수를 얻는다.
    if (room && room === previousRoom) {
      const limit = Math.min(ids.length - 1, previous.length);
      while (pos < limit && ids[pos] === previous[pos]) pos++;
    }
    previousRoom = null;
    previous = [];
    if (pos) report('같은 채팅의 문맥 ' + pos + '토큰 재사용');
    let logits;
    while (pos < ids.length) {
      const end = Math.min(pos + batch, ids.length);
      report('대화 문맥 읽는 중 ' + Math.round(pos / ids.length * 100) + '%');
      logits = await forward(ids.slice(pos, end), pos, end === ids.length);
      pos = end;
    }
    if (room) {
      previous = ids.slice();
      previousRoom = room;
    }
    return logits;
  };
}
