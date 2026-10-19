export const TORITO_PIPER_VOICE='es_ES-davefx-medium';
export function spanishMaleVoice(voices){
 const male=/\b(jorge|pablo|álvaro|alvaro|enrique|diego|rafael|raul|raúl|andres|andrés|tomas|tomás|manuel|rodrigo|carlos|salvador|federico|alonso|jerónimo|jeronimo|emilio|lorenzo|male|hombre)\b/i;
 return voices.filter(v=>/^es(?:-|_)/i.test(v.lang)&&male.test(v.name.normalize('NFD').replace(/\p{M}/gu,''))&&!/\b(female|mujer)\b/i.test(v.name)).sort((a,b)=>{
  const score=v=>(/natural|neural|online|premium|enhanced/i.test(v.name)?100:0)+(/^es-ES$/i.test(v.lang)?30:0);
  return score(b)-score(a);
 })[0]||null;
}
export function spanishSpeechText(text,{requireMarks=false}={}){
 const marked=[...text.matchAll(/\[\[([\s\S]*?)\]\]/g)].map(m=>m[1].trim()).filter(Boolean);
 const spoken=marked.length?marked.join(' '):requireMarks?'':text;
 return spoken.replace(/\*\*/g,'').replace(/^TORITO\s*:\s*/i,'').trim();
}
export function createSpanishSynth({makeWorker=()=>new Worker('/torito-voice-worker.mjs',{type:'module'})}={}){
 let worker=null,pending=null,serial=0;
 function dispose(error){worker?.terminate();worker=null;if(pending){const old=pending;pending=null;old.finish(error);}}
 return {
  synthesize(text,{signal,onProgress=()=>{}}={}){
   if(pending) return Promise.reject(Error('La voz todavía está preparando la frase anterior.'));
   if(signal?.aborted) return Promise.reject(Error('Voz cancelada.'));
   if(!worker){
    worker=makeWorker();
    worker.onmessage=({data})=>{
     if(!pending||data.id!==pending.id) return;
     if(data.progress){pending.onProgress(data.progress);return;}
     const old=pending;pending=null;
     if(data.error) old.finish(Error('No se pudo preparar la voz española. Prueba de nuevo.'));
     else if(data.wav instanceof ArrayBuffer) old.finish(null,new Blob([data.wav],{type:'audio/wav'}));
     else old.finish(Error('El audio de la voz llegó incompleto.'));
    };
    const created=worker;
    worker.onerror=()=>{if(worker===created) dispose(Error('No se pudo cargar la voz Piper. Puedes elegir la voz masculina del navegador.'));};
   }
   return new Promise((resolve,reject)=>{
    const id=++serial;
    const abort=()=>dispose(Error('Voz cancelada.'));
    const timer=setTimeout(()=>dispose(Error('La voz tardó demasiado. Comprueba la conexión y prueba de nuevo.')),120000);
    pending={id,onProgress,finish(error,blob){clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(blob);}};
    signal?.addEventListener('abort',abort,{once:true});
    try{worker.postMessage({id,text,voiceId:TORITO_PIPER_VOICE});}catch{dispose(Error('No se pudo iniciar la voz.'));}
   });
  },
  close(){dispose(Error('Voz cancelada.'));}
 };
}
