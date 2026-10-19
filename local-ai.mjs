import {teachers} from './tutor-prompt.mjs';
export const WEBLLM_URL='https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm';
export const LOCAL_REPLY_SCHEMA=JSON.stringify({type:'object',properties:{answer:{type:'string'},language:{type:'string',enum:['pt','target']},translation:{type:'string'},tip:{type:'string'}},required:['answer','language','translation','tip'],additionalProperties:false});
export async function checkLocalSupport({gpu=globalThis.navigator?.gpu,deviceMemory=globalThis.navigator?.deviceMemory}={}){
 if(!gpu) return {ok:false,message:'Este navegador não oferece WebGPU. O modo local não funciona aqui; experimente Chrome ou Edge atualizado em um aparelho compatível.'};
 try{
  const adapter=await gpu.requestAdapter();
  if(!adapter) return {ok:false,message:'Nenhuma GPU compatível foi encontrada. O download do modelo não será iniciado.'};
  return {ok:true,adapter,message:deviceMemory&&deviceMemory<=4?'A GPU está disponível, mas este aparelho pode ter pouca memória. Feche outras abas; o modo local pode não caber na memória.':'GPU detectada. O carregamento ainda depende da memória disponível no aparelho.'};
 }catch{return {ok:false,message:'Não consegui verificar a GPU. Feche outras abas e tente novamente.'};}
}
export function rememberedName(messages){
 let name='';
 for(const m of messages){
  if(m.role!=='user') continue;
  const match=m.content.match(/(?:^|[.!?,]\s*)(?:meu nome é|me chamo|pode me chamar de)\s+([\p{L}][\p{L}\p{M}'’-]{0,39})/iu);
  if(match&&!/\b(não|nao|not)\s*$/i.test(m.content.slice(0,match.index))) name=match[1];
 }
 return name;
}
export function localMessages(teacher,settings,messages){
 const recent=messages.filter(m=>m.role!=='system').slice(-7).map(m=>({role:m.role,content:m.content.slice(0,1600)}));
 while(recent.length>1&&recent.reduce((n,m)=>n+m.content.length,0)>5000) recent.splice(0,2);
 const name=rememberedName(messages);
 const t=teachers[teacher];
 const level=settings.level||'A1';
 const levelRule=level==='A1'?`Explain in Brazilian Portuguese; wrap ${t.language} phrases in [[brackets]]. When asked for a translation, give the actual ${t.language} phrase.`:`Speak ${t.language} at CEFR ${level}; translate into Brazilian Portuguese.`;
 const scene={bar:'ordering drinks',restaurant:'ordering food',meet:'meeting someone',travel:'airport and hotel'}[settings.scene]||'free conversation';
 const mood=settings.humor==='sweet'?'Be patient; no swearing.':'Be friendly and lightly playful; never distract from the question.';
 const base=`You are ${t.name}, a ${t.language} tutor for Brazilian adults. Answer the latest question directly and accurately. Use history to retain names and topic. Never restart, greet again, invent grammar or change topic without reason. ${levelRule} ${mood} Optional scene: ${scene}; the latest student question overrides it. Ask a follow-up only when useful.`;
 const format=`Reply ONLY with a JSON object: answer, language, translation, tip. answer is the spoken answer in 1-2 short sentences, about 30 words. language MUST describe the actual main language of answer: pt for Portuguese, target for ${teachers[teacher].language}. If you give just a translated foreign phrase, use target. Within Portuguese explanations, wrap foreign phrases in [[double brackets]]. translation is Brazilian Portuguese only when answer is in the target language, otherwise empty. tip is empty unless a correction is needed. Never put JSON or field names inside answer.`;
 return [{role:'system',content:base+'\n'+format+(name?'\nThe student explicitly provided this name: '+JSON.stringify(name)+'. Remember it; do not invent other personal facts.':'')},...recent];
}
export function normalizeLocalReply(teacher,raw){
 let data;try{data=JSON.parse(raw);}catch{throw Error('A IA local respondeu em um formato inválido. Tente novamente.');}
 if(!data||!['pt','target'].includes(data.language)||typeof data.answer!=='string'||!data.answer.trim()||typeof data.translation!=='string'||typeof data.tip!=='string') throw Error('A resposta local está incompleta. Tente novamente.');
 const line=t=>t.replace(/[\r\n]+/g,' ').trim();
 let answer=line(data.answer).replace(new RegExp('^'+teachers[teacher].label+'\\s*:\\s*','i'),'');
 if(data.language==='target') answer='[['+answer.replace(/\[\[|\]\]/g,'')+']]';
 return teachers[teacher].label+': '+answer+'\nTRADUCAO: '+(data.language==='target'?line(data.translation)||'-':'-')+'\nDICA: '+(line(data.tip)||'-');
}
export async function createLocalTutor({teacher,signal,onProgress=()=>{},gpu=globalThis.navigator?.gpu,loadLibrary=()=>import(WEBLLM_URL),makeWorker=()=>new Worker('/local-worker.mjs',{type:'module'})}){
 if(!Object.hasOwn(teachers,teacher)) throw Error('Professor inválido.');
 const cancelled=()=>{if(signal?.aborted) throw Error('Download cancelado. Você pode tentar novamente.');};
 cancelled();
 if(!gpu) throw Error('Este navegador não tem WebGPU. Tente Chrome ou Edge atualizado em um computador compatível, ou escolha Gemini online.');
 const support=await checkLocalSupport({gpu});
 if(!support.ok) throw Error(support.message);
 const adapter=support.adapter;
 cancelled();
 const modelId='Qwen3-4B-'+(adapter.features.has('shader-f16')?'q4f16_1':'q4f32_1')+'-MLC';
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
    try{result=await Promise.race([client.chat.completions.create({messages:localMessages(teacher,settings,messages),temperature:0.4,max_tokens:280,response_format:{type:'json_object',schema:LOCAL_REPLY_SCHEMA},extra_body:{enable_thinking:false}}),failure]);}
    finally{clearTimeout(deadline);worker.removeEventListener?.('error',failed);}
    const choice=result.choices?.[0];
    const raw=choice?.message?.content?.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
    if(!raw||choice.finish_reason==='length') throw Error('A resposta local veio incompleta. Faça uma pergunta mais curta e tente novamente.');
    return normalizeLocalReply(teacher,raw);
   }finally{active=false;}
  },
  close(){available=false;worker.terminate();}
 };
}
