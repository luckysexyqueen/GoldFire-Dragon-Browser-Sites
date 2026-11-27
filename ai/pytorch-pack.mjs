let brotli;
async function loadBrotli() {
  const module = await import('../vendor/brotli/brotli_dec_wasm.mjs');
  const url = new URL('../vendor/brotli/brotli_dec_wasm_bg.wasm', import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw Error('모델 압축 해제기를 불러올 수 없습니다.');
  await module.default({ module_or_path: await response.arrayBuffer() });
  return module;
}

export async function decodePart(response, codec) {
  let stream;
  if (codec === 'br') {
    try { stream = new DecompressionStream('brotli'); } catch {
      brotli ??= loadBrotli().catch(error => { brotli = undefined; throw error; });
      const module = await brotli;
      return module.decompress(new Uint8Array(await response.arrayBuffer()));
    }
  } else {
    stream = new DecompressionStream('gzip');
  }
  return new Uint8Array(await new Response(response.body.pipeThrough(stream)).arrayBuffer());
}

// 같은 실숫값에 같은 번호를 부여한 표에서 원래의 32비트 가중치 스케일을 복원한다.
export function restoreProgram(bytes, manifest) {
  for (const [offset, count, distinct, overflow] of manifest.scales || []) {
    const table = new Uint32Array(bytes.buffer, bytes.byteOffset + offset, distinct).slice();
    const start = offset + 4 * distinct;
    const codes = bytes.slice(start, start + count);
    const extra = new DataView(bytes.slice(start + count, start + count + 2 * overflow).buffer);
    const output = new Uint32Array(bytes.buffer, bytes.byteOffset + offset, count);
    let pos = 0;
    for (let i = 0; i < count; i++) {
      let code = codes[i];
      if (code === 255) { code = extra.getUint16(pos, true); pos += 2; }
      output[i] = table[code];
    }
  }
  if (manifest.tiedScales) {
    const [src, dest, rows, groups] = manifest.tiedScales;
    const input = new Uint32Array(bytes.buffer, bytes.byteOffset + src, rows * groups);
    const output = new Uint32Array(bytes.buffer, bytes.byteOffset + dest, rows * groups);
    for (let row = 0; row < rows; row++) {
      for (let group = 0; group < groups; group++) output[row * groups + group] = input[group * rows + row];
    }
  }
  return bytes;
}
