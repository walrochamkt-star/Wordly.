import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

import {teachers,promptFor} from './tutor-prompt.mjs';
export {teachers,promptFor} from './tutor-prompt.mjs';
const publicPaths=new Set(['teacher-portraits.mjs','practice.css','conversation-scenes.mjs','phone.html','phone-data.mjs','phone-ui.mjs',...['torito','coquette','barli','lupino','leeuwie'].map(t=>t+'-scene-art.mjs'),'lessons.html','lessons-data.mjs','lessons-ui.mjs','torito-voice.mjs','torito-voice-worker.mjs','local-ai.mjs','local-worker.mjs','tutor-prompt.mjs','index.html',...Object.keys(teachers).map(t=>t+'.html')]);
export function makeServer({env=process.env,fetchImpl=fetch,root=new URL('./',import.meta.url),clock=Date.now}={}){
 let active=0; const rate=new Map();
 const ready=()=>Boolean(env.GEMINI_API_KEY&&env.GEMINI_FREE_TIER_CONFIRMED==='true');
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return http.createServer(async(req,res)=>{
 try{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Permissions-Policy','microphone=(self)');
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/healthz'){return json(res,200,{ok:true});}
  if(req.method==='GET'&&url.pathname==='/api/config') return json(res,200,{ready:ready()});
  if(req.method==='POST'&&url.pathname==='/api/chat'){
   if(!ready()) return json(res,503,{error:'A IA online ainda não foi configurada no Render.'});
   if(!(req.headers['content-type']||'').startsWith('application/json')) return json(res,415,{error:'Envie JSON.'});
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host) return json(res,403,{error:'Origem inválida.'});
   let body='',size=0;
   for await(const chunk of req){size+=chunk.length;if(size>24000){json(res,413,{error:'Mensagem muito grande.'});return;}body+=chunk;}
   let input;try{input=JSON.parse(body);}catch{return json(res,400,{error:'JSON inválido.'});}
   const {teacher,level='A1',humor='sweet',scene='free',messages}=input;
   if(!Object.hasOwn(teachers,teacher)||!['A1','A2','B1'].includes(level)||!Array.isArray(messages)||!messages.length||messages.length>13) return json(res,400,{error:'Conversa inválida.'});
   if(messages.some((m,i)=>!m||m.role!==(i%2?'assistant':'user')||typeof m.content!=='string'||!m.content.trim()||m.content.length>1600)||messages.at(-1).role!=='user') return json(res,400,{error:'Histórico inválido.'});
   const now=clock();
   const ip=req.socket.remoteAddress||'unknown';
   if(rate.size>10000) rate.clear();
   const times=(rate.get(ip)||[]).filter(t=>now-t<60000);
   if(times.length>=10||active>=3) return json(res,429,{error:'Há muitas mensagens agora. Aguarde um pouco e tente novamente.'});
   times.push(now);rate.set(ip,times);active++;
   try{
    const signal=AbortSignal.timeout(30000);
    const requestProvider=()=>fetchImpl('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',{
     method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.GEMINI_API_KEY},
     body:JSON.stringify({model:'gemini-3.6-flash',reasoning_effort:'low',messages:[{role:'system',content:promptFor(teacher,level,humor,scene)},...messages]}),
     signal
    });
    let result=await requestProvider();
    if([502,503,504].includes(result.status)){
     await result.body?.cancel();
     result=await requestProvider();
    }
    if(result.status===429) return json(res,429,{error:'A cota gratuita do Gemini foi atingida. Aguarde a renovação. Nenhum serviço alternativo será acionado.'});
    if(!result.ok){
     const detail=await result.json().catch(()=>({}));
     const code=detail.error?.status;
     console.error('Gemini request failed',JSON.stringify({status:result.status,code:typeof code==='string'?code.replace(/[^A-Z_]/g,'').slice(0,80):undefined}));
     const error=result.status===401||result.status===403
      ? 'O Google recusou a chave ou a permissão do Gemini. O administrador precisa conferir a chave no AI Studio.'
      : result.status===404
      ? 'O modelo Gemini configurado não está disponível. O administrador precisa atualizar a configuração.'
      : 'O Gemini está indisponível no momento. Tente novamente em instantes.';
     return json(res,502,{error});
    }
    const data=await result.json(),raw=data.choices?.[0]?.message?.content;
    if(typeof raw!=='string'||!raw.trim()||data.choices?.[0]?.finish_reason==='length') return json(res,502,{error:'A resposta veio vazia ou incompleta. Tente novamente.'});
    return json(res,200,{raw});
   }catch{return json(res,504,{error:'A IA demorou para responder. Tente novamente.'});}finally{active--;}
  }
  if(req.method!=='GET'&&req.method!=='HEAD') return json(res,405,{error:'Método inválido.'});
  const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!publicPaths.has(path)) return json(res,404,{error:'Página não encontrada.'});
  const html=await readFile(new URL(path,root));
  res.writeHead(200,{'Content-Type':path.endsWith('.mjs')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:html);
 }catch{if(!res.headersSent)json(res,500,{error:'Não foi possível concluir a solicitação.'});else res.end();}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) makeServer().listen(Number(process.env.PORT||3000),'0.0.0.0');
