import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spanishMaleVoice,spanishSpeechText,createSpanishSynth,TORITO_PIPER_VOICE} from '../torito-voice.mjs';
import {promptFor} from '../tutor-prompt.mjs';
import {localMessages} from '../local-ai.mjs';
test('never chooses a Portuguese or female browser voice; prioritizes natural Spanish male voices',()=>{
 const voices=[{name:'Google español',lang:'es-ES'},{name:'Microsoft Elvira Online (Natural)',lang:'es-ES'},{name:'Microsoft Antonio Online (Natural)',lang:'pt-BR'},{name:'Microsoft Pablo',lang:'es-ES'},{name:'Microsoft Alvaro Online (Natural)',lang:'es-ES'}];
 assert.equal(spanishMaleVoice(voices).name,'Microsoft Alvaro Online (Natural)');
 assert.equal(spanishMaleVoice([{name:'Microsoft Álvaro Online (Natural)',lang:'es-ES'}]).name,'Microsoft Álvaro Online (Natural)');
 assert.equal(spanishMaleVoice(voices.slice(0,3)),null);
 assert.equal(spanishMaleVoice([{name:'female',lang:'es-ES'}]),null);
});
test('reads only Spanish marked phrases, never the surrounding Portuguese explanation',()=>{
 assert.equal(spanishSpeechText('Diga [[Buenos días]]. Esta é a saudação. [[¿Cómo estás?]]'),'Buenos días ¿Cómo estás?');
 assert.equal(spanishSpeechText('A explicação está em português.',{requireMarks:true}),'');
 assert.equal(spanishSpeechText('Hola, soy Torito.'),'Hola, soy Torito.');
 for(const level of ['A1','A2','B1']){
  assert.match(promptFor('torito',level,'sweet','free'),/spoken answer must be entirely in Spanish/);
  assert.match(localMessages('torito',{level},[{role:'user',content:'Oi'}])[0].content,/spoken answer must not contain Portuguese/);
 }
});
function mockWorker(){return {messages:[],terminated:false,postMessage(data){this.messages.push(data)},terminate(){this.terminated=true}};}
test('Piper voice identity is fixed and generated audio becomes a WAV blob',async()=>{
 const worker=mockWorker();const synth=createSpanishSynth({makeWorker:()=>worker});
 const pending=synth.synthesize('Buenos días.');const request=worker.messages[0];
 assert.equal(request.voiceId,TORITO_PIPER_VOICE);assert.equal(request.voiceId,'es_ES-davefx-medium');
 worker.onmessage({data:{id:request.id,wav:new ArrayBuffer(44)}});
 assert.equal((await pending).type,'audio/wav');synth.close();
});
test('interrupting synthesis terminates its worker; late audio cannot resolve a cancelled request',async()=>{
 const worker=mockWorker();const synth=createSpanishSynth({makeWorker:()=>worker});const abort=new AbortController();
 const pending=synth.synthesize('Buenos días.',{signal:abort.signal});const request=worker.messages[0];abort.abort();
 await assert.rejects(pending,/cancelada/);assert.equal(worker.terminated,true);
 worker.onmessage({data:{id:request.id,wav:new ArrayBuffer(44)}});synth.close();
});
