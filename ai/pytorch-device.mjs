import createExecuTorch from '../vendor/executorch/runtime.mjs';

async function localFile(url) {
  const response = await fetch(url, {mode:'same-origin', redirect:'error'});
  if (!response.ok) throw Error('사이트의 추론 엔진 파일을 읽을 수 없습니다 (' + response.status + ').');
  return response;
}

export class GPUExecutionError extends Error {
  constructor(message, options) { super(message, options); this.name = 'GPUExecutionError'; }
}

async function connectGPU() {
  if (!globalThis.navigator?.gpu) throw Error('WebGPU 미지원');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw Error('GPU 어댑터 없음');
  const file = await localFile(new URL('../vendor/executorch/executorch_wasm_lib.wasm', import.meta.url));
  const et = await createExecuTorch({ wasmBinary: await file.arrayBuffer() });
  const initialized = await et.initWebGPU();
  if (initialized === false) throw Error('GPU 장치 초기화 실패');
  return {
    type: 'webgpu', label: '기기 WebGPU · 추론 요금 0원',
    allocate: size => new Uint8Array(size),
    async load(bytes) {
      const path = '/qwen3.pte';
      let model;
      et.FS.writeFile(path, bytes, {canOwn:true});
      try {
        model = et.Module.load(path);
        await model.loadMethod('forward');
      } catch (error) {
        model?.delete();
        throw error;
      } finally {
        et.FS.unlink(path);
      }
      return async (tokens, position, wantLogits = true) => {
        const input = et.Tensor.fromArray([1,tokens.length], BigInt64Array.from(tokens, BigInt), et.ScalarType.Long);
        const index = et.Tensor.fromArray([1], BigInt64Array.of(BigInt(position)), et.ScalarType.Long);
        let outputs;
        try {
          outputs = await model.forward([input,index]);
          if (!wantLogits) return null;
          const scores = outputs[0].data;
          return scores.slice(-151936);
        } catch (error) {
          throw new GPUExecutionError('WebGPU 연산이 중단되었습니다.', {cause:error});
        } finally {
          input.delete(); index.delete();
          for (const tensor of outputs || []) tensor.delete();
        }
      };
    }
  };
}

export async function connectCPU(reason) {
  const base = new URL('../vendor/qwen-cpu/', import.meta.url);
  const math = { cos:Math.cos, sin:Math.sin, exp:Math.exp, pow:Math.pow };
  async function start(file) {
    const binary = await localFile(new URL(file, base));
    return (await WebAssembly.instantiate(await binary.arrayBuffer(), {math})).instance.exports;
  }
  let cpu;
  try { cpu = await start('simd.wasm'); } catch (error) {
    if (!(error instanceof WebAssembly.CompileError)) throw error;
    cpu = await start('scalar.wasm');
  }
  const layout = await (await localFile(new URL('layout.json', base))).json();
  const startOffset = Math.ceil(Number(cpu.__heap_base.value) / 64) * 64;
  function reserve(end) {
    const pages = Math.ceil((end - cpu.memory.buffer.byteLength) / 65536);
    if (pages > 0) {
      try { cpu.memory.grow(pages); } catch { throw Error('기기 메모리가 부족해 내장 모델을 열 수 없습니다.'); }
    }
  }
  function allocate(size) {
    reserve(startOffset + size);
    return new Uint8Array(cpu.memory.buffer, startOffset, size);
  }
  return {
    type:'cpu', label:reason + ' · 기기 CPU · 추론 요금 0원', allocate,
    async load(bytes, manifest) {
      if (layout.sha256 !== manifest.sha256 || layout.offsets.length !== 507) throw Error('모델과 CPU 엔진의 버전이 일치하지 않습니다.');
      if (bytes.buffer !== cpu.memory.buffer) allocate(bytes.byteLength).set(bytes);
      const cacheStart = Math.ceil((startOffset + manifest.size) / 64) * 64;
      new Uint32Array(cpu.memory.buffer, cpu.layout(), layout.offsets.length).set(layout.offsets);
      cpu.bind_program(startOffset, cacheStart);
      return (tokens, position, wantLogits = true) => {
        const end = position + tokens.length;
        if (position < 0 || end > 2048) throw Error('모델의 문맥 길이를 초과했습니다.');
        const stride = 28 * 2 * 1024 * 2;
        const needed = cacheStart + end * stride;
        if (needed > cpu.memory.buffer.byteLength) {
          try { reserve(cacheStart + Math.ceil(end / 16) * 16 * stride); }
          catch { reserve(needed); }
        }
        for (let i = 0; i < tokens.length; i++) {
          cpu.step(tokens[i], position + i, wantLogits && i === tokens.length - 1);
        }
        return wantLogits ? new Float32Array(cpu.memory.buffer, cpu.logits(), 151936) : null;
      };
    }
  };
}

export async function connectDevice() {
  try { return await connectGPU(); } catch {
    return connectCPU(globalThis.navigator?.gpu ? 'WebGPU 연결 불가' : 'WebGPU 미지원');
  }
}
