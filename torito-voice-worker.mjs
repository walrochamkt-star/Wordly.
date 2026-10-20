import {TtsSession} from 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.3/+esm';
let session=null;
let queue=Promise.resolve();
self.onmessage=({data})=>{
 queue=queue.catch(()=>{}).then(async()=>{
  try{
   if(data.voiceId!=='es_ES-davefx-medium'||typeof data.text!=='string'||data.text.length>2000) throw Error('Invalid voice request');
   if(!session) session=await TtsSession.create({voiceId:'es_ES-davefx-medium',progress:p=>self.postMessage({id:data.id,progress:{loaded:p.loaded,total:p.total}})});
   const wav=await (await session.predict(data.text)).arrayBuffer();
   self.postMessage({id:data.id,wav},[wav]);
  }catch{session=null;self.postMessage({id:data.id,error:true});}
 });
};
