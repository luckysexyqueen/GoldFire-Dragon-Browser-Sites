import { generateTorch, prepareDevice } from './pytorch-chat.mjs?v=gptfast64';
self.onmessage = async ({data}) => {
  const {id,action,...options} = data;
  const onDevice = device => postMessage({id,device:device.label,backend:device.type});
  try {
    if (action === 'connect') {
      onDevice(await prepareDevice());
      postMessage({id,done:true});
      return;
    }
    const text = await generateTorch({...options,onDevice,onProgress:progress=>postMessage({id,progress}),onToken:token=>postMessage({id,token})});
    postMessage({id,text});
  } catch (error) {
    postMessage({id,error:error?.message || '사이트의 추론 엔진을 실행할 수 없습니다.',recoverable:action === 'generate' && error?.cause?.name === 'GPUExecutionError'});
  }
};
