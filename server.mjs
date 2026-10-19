import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const teachers = {
 torito:{name:'Torito',label:'TORITO',language:'Spanish from Spain'},
 coquette:{name:'Coquette',label:'COQUETTE',language:'French from France'},
 barli:{name:'Bärli',label:'BAERLI',language:'German'},
 lupino:{name:'Lupino',label:'LUPINO',language:'Italian'},
 leeuwie:{name:'Leeuwie',label:'LEEUWIE',language:'Dutch from the Netherlands'}
};
const scenes={free:'Free conversation. Follow the topic chosen by the student.',bar:'Ordering at a café or bar.',restaurant:'Ordering food at a restaurant.',meet:'Meeting someone.',travel:'At the airport and hotel.'};
export function promptFor(teacher,level,humor,scene){
 const t=teachers[teacher];
 if(!t) throw Error('Professor inválido.');
 const levelRule=level==='A1'
 ? `Explain in Brazilian Portuguese. Put only ${t.language} phrases inside [[double brackets]]. Teach one short phrase at a time, but first answer what the student actually asked. Do not force a lesson when they asked something else. TRADUCAO must be - when your main line is in Portuguese.`
 : `Speak ${t.language} at CEFR ${level}. Translate your main line accurately into Brazilian Portuguese in TRADUCAO.`;
 const mood=humor==='sweet'?'Warm, patient and friendly. No swearing.':humor==='spicy'?'Warm and lightly playful. Humor must never distract from the question.':'Expressive and playful, but keep answers clear and relevant.';
 return `You are ${t.name}, a conversational ${t.language} tutor for adult Brazilians.
Priority 1: understand and answer the student's latest question directly. Use the preceding conversation to resolve references and retain their name and topic. Do not restart, greet again or change topics without a reason.
Priority 2: linguistic accuracy. Give the correct translation or correction when asked. If uncertain, say so. Do not invent grammar rules or mistranslations. Never ridicule the student or make assumptions about their identity.
${levelRule}
${mood}
Optional setting: ${scenes[scene]||scenes.free} The student's question overrides the setting. At most one relevant follow-up question, only when natural. Do not force one in every response.
Use 2-3 concise sentences, with enough detail to answer. Return exactly three lines:
${t.label}: <the spoken answer>
TRADUCAO: <Brazilian Portuguese translation, or ->
DICA: <one relevant language correction, only when useful, or ->`;
}
function equal(a,b){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
const publicPaths=new Set(['index.html',...Object.keys(teachers).map(t=>t+'.html')]);
export function makeServer({env=process.env,fetchImpl=fetch,root=new URL('./',import.meta.url),clock=Date.now}={}){
 let active=0,day='',daily=0; const rate=new Map();
 const ready=()=>Boolean(env.OPENAI_API_KEY&&env.OPENAI_MODEL&&env.WORDLY_USER&&env.WORDLY_PASSWORD);
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 return http.createServer(async(req,res)=>{
 try{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Permissions-Policy','microphone=(self)');
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/healthz'){return json(res,200,{ok:true});}
  if(!env.WORDLY_USER||!env.WORDLY_PASSWORD) return json(res,503,{error:'Configure o acesso do Wordly no Render.'});
  const expected='Basic '+Buffer.from(env.WORDLY_USER+':'+env.WORDLY_PASSWORD).toString('base64');
  if(!equal(req.headers.authorization||'',expected)){
   res.setHeader('WWW-Authenticate','Basic realm="Wordly", charset="UTF-8"');return json(res,401,{error:'Entre com o usuário e a senha do Wordly.'});
  }
  if(req.method==='GET'&&url.pathname==='/api/config') return json(res,200,{ready:ready()});
  if(req.method==='POST'&&url.pathname==='/api/chat'){
   if(!ready()) return json(res,503,{error:'A IA online ainda não foi configurada no Render.'});
   if(!(req.headers['content-type']||'').startsWith('application/json')) return json(res,415,{error:'Envie JSON.'});
   if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host) return json(res,403,{error:'Origem inválida.'});
   let body='',size=0;
   for await(const chunk of req){size+=chunk.length;if(size>24000){json(res,413,{error:'Mensagem muito grande.'});return;}body+=chunk;}
   let input;try{input=JSON.parse(body);}catch{return json(res,400,{error:'JSON inválido.'});}
   const {teacher,level='A1',humor='sweet',scene='free',messages}=input;
   if(!teachers[teacher]||!['A1','A2','B1'].includes(level)||!Array.isArray(messages)||!messages.length||messages.length>13) return json(res,400,{error:'Conversa inválida.'});
   if(messages.some((m,i)=>!m||m.role!==(i%2?'assistant':'user')||typeof m.content!=='string'||!m.content.trim()||m.content.length>1600)||messages.at(-1).role!=='user') return json(res,400,{error:'Histórico inválido.'});
   const now=clock(),today=new Date(now).toISOString().slice(0,10);
   if(day!==today){day=today;daily=0;}
   const ip=req.socket.remoteAddress||'unknown';
   if(rate.size>10000) rate.clear();
   const times=(rate.get(ip)||[]).filter(t=>now-t<60000);
   if(times.length>=10||daily>=Number(env.WORDLY_DAILY_LIMIT||200)||active>=3) return json(res,429,{error:'Limite temporário atingido. Aguarde um pouco.'});
   times.push(now);rate.set(ip,times);daily++;active++;
   try{
    const result=await fetchImpl('https://api.openai.com/v1/chat/completions',{
     method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.OPENAI_API_KEY},
     body:JSON.stringify({model:env.OPENAI_MODEL,store:false,max_completion_tokens:1024,messages:[{role:'developer',content:promptFor(teacher,level,humor,scene)},...messages]}),
     signal:AbortSignal.timeout(30000)
    });
    if(!result.ok) return json(res,502,{error:'A IA online não respondeu. Confira o modelo, a chave e o saldo da API no Render.'});
    const data=await result.json(),raw=data.choices?.[0]?.message?.content;
    if(typeof raw!=='string'||!raw.trim()||data.choices?.[0]?.finish_reason==='length') return json(res,502,{error:'A resposta veio vazia ou incompleta. Tente novamente.'});
    return json(res,200,{raw});
   }catch{return json(res,504,{error:'A IA demorou para responder. Tente novamente.'});}finally{active--;}
  }
  if(req.method!=='GET'&&req.method!=='HEAD') return json(res,405,{error:'Método inválido.'});
  const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!publicPaths.has(path)) return json(res,404,{error:'Página não encontrada.'});
  const html=await readFile(new URL(path,root));
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:html);
 }catch{if(!res.headersSent)json(res,500,{error:'Não foi possível concluir a solicitação.'});else res.end();}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) makeServer().listen(Number(process.env.PORT||3000),'0.0.0.0');
