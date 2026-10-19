import {promptFor,teachers} from './tutor-prompt.mjs';
export const WEBLLM_URL='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
export function localMessages(teacher,settings,messages){
 const recent=messages.filter(m=>m.role!=='system').slice(-7).map(m=>({role:m.role,content:m.content.slice(0,1600)}));
 while(recent.length>1&&recent.reduce((n,m)=>n+m.content.length,0)>5000) recent.splice(0,2);
 return [{role:'system',content:promptFor(teacher,settings.level,settings.humor,settings.scene)},...recent];
}
export async function createLocalTutor({teacher,signal,onProgress=()=>{},gpu=globalThis.navigator?.gpu,loadLibrary=()=>import(WEBLLM_URL),makeWorker=()=>new Worker('/local-worker.mjs',{type:'module'})}){
 if(!Object.hasOwn(teachers,teacher)) throw Error('Professor inválido.');
 const cancelled=()=>{if(signal?.aborted) throw Error('Download cancelado. Você pode tentar novamente.');};
 cancelled();
 if(!gpu) throw Error('Este navegador não tem WebGPU. Tente Chrome ou Edge atualizado em um computador compatível, ou escolha Gemini online.');
 const adapter=await gpu.requestAdapter();
 if(!adapter) throw Error('Não encontrei uma GPU compatível. Tente outro aparelho ou escolha Gemini online.');
 cancelled();
 const modelId=adapter.features.has('shader-f16')?'Qwen3-4B-q4f16_1-MLC':'Qwen3-4B-q4f32_1-MLC';
 const lib=await loadLibrary();
 cancelled();
 if(!lib.prebuiltAppConfig.model_list.some(m=>m.model_id===modelId)) throw Error('O modelo local não está disponível nesta versão.');
 const worker=makeWorker();let timer,abortHandler,workerError,client;
 const stopped=new Promise((_,reject)=>{
  abortHandler=()=>reject(Error('Download cancelado. Você pode tentar novamente.'));
  signal?.addEventListener('abort',abortHandler,{once:true});
  workerError=()=>reject(Error('Não consegui iniciar a IA local. Confira a conexão e tente novamente.'));
  worker.addEventListener?.('error',workerError,{once:true});
  timer=setTimeout(()=>reject(Error('O carregamento demorou demais. Confira a conexão e a memória disponível e tente novamente.')),600000);
 });
 try{
  client=await Promise.race([lib.CreateWebWorkerMLCEngine(worker,modelId,{initProgressCallback:onProgress},{context_window_size:4096}),stopped]);
  cancelled();
 }catch(e){worker.terminate();throw Error(e.message||'Não consegui carregar a IA neste aparelho. Tente outro aparelho ou o modo online.');}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abortHandler);worker.removeEventListener?.('error',workerError);}
 let active=false,available=true;
 return {
  async complete(messages,settings){
   if(!available) throw Error('A IA local foi interrompida. Recarregue a página para iniciar novamente.');
   if(active) throw Error('Aguarde a resposta anterior.');
   active=true;
   try{
    let deadline,failed;
    const failure=new Promise((_,reject)=>{
     const stop=message=>{available=false;worker.terminate();reject(Error(message));};
     deadline=setTimeout(()=>stop('Este aparelho demorou demais para responder. Recarregue a página ou experimente o modo online.'),120000);
     failed=()=>stop('A IA local parou neste aparelho. Recarregue a página para tentar novamente.');
     worker.addEventListener?.('error',failed,{once:true});
    });
    let result;
    try{result=await Promise.race([client.chat.completions.create({messages:localMessages(teacher,settings,messages),temperature:0.5,max_tokens:320,extra_body:{enable_thinking:false}}),failure]);}
    finally{clearTimeout(deadline);worker.removeEventListener?.('error',failed);}
    const choice=result.choices?.[0];
    const raw=choice?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
    if(!raw||choice.finish_reason==='length') throw Error('A resposta local veio incompleta. Faça uma pergunta mais curta e tente novamente.');
    return raw;
   }finally{active=false;}
  },
  close(){available=false;worker.terminate();}
 };
}
