import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLocalTutor,localMessages,normalizeLocalReply,rememberedName,checkLocalSupport} from '../local-ai.mjs';
const settings={level:'A1',humor:'sweet',scene:'free'};
function mock({f16=true,create}={}){
 const worker={terminated:false,terminate(){this.terminated=true;}};
 const calls=[];
 const gpu={requestAdapter:async()=>({features:new Set(f16?['shader-f16']:[])})};
 const loadLibrary=async()=>({prebuiltAppConfig:{model_list:[{model_id:'Qwen3-4B-q4f16_1-MLC'},{model_id:'Qwen3-4B-q4f32_1-MLC'},{model_id:'Qwen3-1.7B-q4f16_1-MLC'},{model_id:'Qwen3-1.7B-q4f32_1-MLC'}]},CreateWebWorkerMLCEngine:async(w,id,options,chat)=>{
  calls.push({w,id,options,chat});options.initProgressCallback({progress:0.5});
  if(create) return create();
  return {chat:{completions:{create:async input=>{calls.push(input);return {choices:[{finish_reason:'stop',message:{content:'<think>hidden</think>'+JSON.stringify({answer:'Gracias.',language:'target',translation:'Obrigado.',tip:''})}}]};}}}};
 }});
 return {gpu,loadLibrary,makeWorker:()=>worker,worker,calls};
}
test('local mode generates without a server/API and uses shared teacher instructions',async()=>{
 const deps=mock(),progress=[];
 const tutor=await createLocalTutor({teacher:'torito',onProgress:p=>progress.push(p),...deps});
 assert.match(await tutor.complete([{role:'user',content:'Obrigado?'}],settings),/^TORITO:/);
 assert.equal(progress.length,1);assert.match(deps.calls[0].id,/q4f16/);
 assert.equal(deps.calls[1].extra_body.enable_thinking,false);
 assert.match(deps.calls[1].messages[0].content,/Spanish from Spain/);
 tutor.close();assert.equal(deps.worker.terminated,true);
});
test('detects incompatible hardware before attempting model/library download',async()=>{
 let downloads=0;
 await assert.rejects(createLocalTutor({teacher:'torito',gpu:null,loadLibrary:async()=>downloads++}),/WebGPU/);
 assert.equal(downloads,0);
 const deps=mock({f16:false});const tutor=await createLocalTutor({teacher:'barli',...deps});assert.match(deps.calls[0].id,/q4f32/);tutor.close();
});
test('cancels pending model load and releases its worker without provider fallback',async()=>{
 const control=new AbortController();const deps=mock({create:()=>new Promise(()=>{})});
 const loading=createLocalTutor({teacher:'coquette',signal:control.signal,...deps});
 await new Promise(r=>setImmediate(r));control.abort();
 await assert.rejects(loading,/cancelado/);assert.equal(deps.worker.terminated,true);
});
test('bounds local context while retaining role order and latest user message',()=>{
 const messages=Array.from({length:13},(_,i)=>({role:i%2?'assistant':'user',content:'x'.repeat(1600)}));
 const sent=localMessages('lupino',settings,messages);
 assert.equal(sent[0].role,'system');assert.equal(sent.at(-1).role,'user');
 assert.ok(sent.slice(1).reduce((n,m)=>n+m.content.length,0)<=5000);
 for(let i=1;i<sent.length;i++)assert.equal(sent[i].role,i%2?'user':'assistant');
});
test('local incomplete responses are errors, with no fake success or online fallback',async()=>{
 const deps=mock({create:()=>({chat:{completions:{create:async()=>({choices:[{finish_reason:'length',message:{content:'partial'}}]})}}})});
 const tutor=await createLocalTutor({teacher:'leeuwie',...deps});
 await assert.rejects(tutor.complete([{role:'user',content:'Oi'}],settings),/incompleta/);tutor.close();
});

test('speech uses native voice for unmarked target-language answers and preserves Portuguese explanations',()=>{
 assert.match(normalizeLocalReply('torito',JSON.stringify({answer:'¡Buenos días!',language:'target',translation:'Bom dia!',tip:''})),/TORITO: \[\[¡Buenos días!\]\]/);
 assert.match(normalizeLocalReply('coquette',JSON.stringify({answer:'Diga [[bonjour]].',language:'pt',translation:'wrong duplicate',tip:''})),/COQUETTE: Diga \[\[bonjour\]\].\nTRADUCAO: -/);
 assert.throws(()=>normalizeLocalReply('torito','not json'),/formato inválido/);
});
test('preserves explicit student name beyond bounded recent context, accepts correction and ignores assistant inventions',()=>{
 const messages=[{role:'user',content:'Meu nome é Wal e quero pedir café.'},{role:'assistant',content:'Seu nome é Maria.'},...Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:'Mais uma troca'})),{role:'user',content:'Qual meu nome?'}];
 assert.match(localMessages('torito',settings,messages)[0].content,/name: "Wal"/);
 assert.equal(rememberedName([...messages,{role:'user',content:'Não me chamo João.'}]),'Wal');
 assert.equal(rememberedName([...messages,{role:'user',content:'Pode me chamar de Ana.'}]),'Ana');
 assert.equal(rememberedName([...messages,{role:'user',content:"Como digo 'meu nome é Ana' em espanhol?"}]),'Wal');
});
test('compatibility checks do not download the model and warn about reported low memory',async()=>{
 const deps=mock();
 const report=await checkLocalSupport({gpu:deps.gpu,deviceMemory:4});assert.equal(report.ok,true);assert.match(report.message,/pouca memória/);
});
