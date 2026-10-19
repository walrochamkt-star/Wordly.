const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
(async () => {
for(const file of ['torito','coquette','barli','lupino','leeuwie']) {
 const html=readFileSync(`${__dirname}/../${file}.html`,'utf8');
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 const code=script.slice(script.indexOf('const SR ='),script.indexOf('/* ---------- Conversa'));
 const elements=new Map();
 const $=id => {if(!elements.has(id)) elements.set(id,{value:id==='level'?'A1':'',classList:{add(){},remove(){}}});return elements.get(id);};
 const sessions=[],sent=[],timers=[];
 class Recognition {constructor(){sessions.push(this);}start(){}stop(){}abort(){this.aborted=true;}}
 const ctx=vm.createContext({assert,$,window:{SpeechRecognition:Recognition},navigator:{},busy:false,thinking:false,engine:{},stopSpeaking(){},setStatus(){},send(t){sent.push(t)},setTimeout(fn,ms){if(ms===150) Promise.resolve().then(fn);else timers.push(fn);return timers.length;},clearTimeout(){}});
 vm.runInContext(code,ctx);
 const result=t => ({results:[Object.assign([{transcript:t}],{isFinal:true})]});
 await vm.runInContext('startListening()',ctx);
 assert.equal(sessions[0].lang,'pt-BR');
 const lateResult=sessions[0].onresult, lateEnd=sessions[0].onend;
 sessions[0].onresult(result('primeira frase'));
 $('typeForm').onsubmit({preventDefault(){}});
 assert.deepEqual(sent,['primeira frase']); assert.equal(sessions[0].aborted,true);
 await vm.runInContext('startListening()',ctx);
 lateResult(result('fala antiga')); lateEnd();
 assert.equal($('typeIn').value,'');
 sessions[1].onresult(result('segunda frase'));
 const secondLate=sessions[1].onresult;
 vm.runInContext('finishListening()',ctx);
 assert.deepEqual(sent,['primeira frase','segunda frase']);
 secondLate(result('duplicada'));assert.equal($('typeIn').value,'');
 // A restart queued during a silence must not revive an already submitted session.
 await vm.runInContext('startListening()',ctx);
 sessions[2].onresult(result('terceira frase'));sessions[2].onend();
 vm.runInContext('finishListening()',ctx);
 const before=sessions.length; timers.forEach(fn=>fn());assert.equal(sessions.length,before);
 assert.deepEqual(sent,['primeira frase','segunda frase','terceira frase']);
 if(file!=='torito'){
 const voices=[{name:'Microsoft Desktop',lang:'pt-BR'},{name:'Google português',lang:'pt-BR'},{name:'Microsoft Francisca Online (Natural)',lang:'pt-BR'},{name:'Unrelated Natural',lang:'en-US'}];
 ctx.speechSynthesis={getVoices:()=>voices};
 const choose=script.slice(script.indexOf('function bestVoice'),script.indexOf('function pickVoice'));
 vm.runInContext(choose,ctx);
 assert.equal(vm.runInContext('bestVoice("pt-BR").name',ctx),'Microsoft Francisca Online (Natural)');

 // A cancelled utterance cannot reset the listening status or resume old chunks.
 const utterances=[],statuses=[];
 const audio=vm.createContext({assert,$,speechRate:1,voice:null,
  speechSynthesis:{cancel(){},resume(){},speak(u){utterances.push(u)}},
  SpeechSynthesisUtterance:function(text){this.text=text},bestVoice:()=>null,
  mouth(){},setStatus(...args){statuses.push(args)},setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(script.slice(script.indexOf('function speechChunks'),script.indexOf('function plain')),audio);
 vm.runInContext(script.slice(script.indexOf('let speakId'),script.indexOf('/* ---------- Ouvir')),audio);
 assert.equal(vm.runInContext('speechChunks("Vamos conversar.")[0].pt',audio),true);
 vm.runInContext('speak("Uma frase. Outra frase."); stopSpeaking(); setStatus("listen","Ouvindo");',audio);
 utterances[0].onend();
 assert.equal(utterances.length,1);assert.deepEqual(statuses.at(-1),['listen','Ouvindo']);
 }
 const greeting=script.slice(script.indexOf('async function greet()'),script.indexOf('$("settingsBtn").onclick'));
 assert.doesNotMatch(greeting,/await ask|fetch\(/);
 assert.doesNotMatch(script.slice(script.indexOf('/* Ajustes passam')),/greet\(/);
 console.log(`${file}: isolated recordings, late events, form send, pending restarts, language and natural voice selection passed`);
}
})().catch(e=>{console.error(e);process.exitCode=1});
