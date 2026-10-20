const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

(async () => {
for (const file of ['torito', 'coquette', 'barli', 'lupino', 'leeuwie']) {
 const html = readFileSync(`${__dirname}/../${file}.html`, 'utf8');
 const code = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 new vm.Script(code); // Parse the complete page script.
 assert.match(html, /value="local" selected/);
 assert.doesNotMatch(html, /<option value="online"/);
 assert.match(code, /fetch\("\/api\/chat"/);
 const send = code.slice(code.indexOf('async function send(text)'), code.indexOf('\nfunction alertBox'));
 const state = vm.createContext({assert});
 vm.runInContext(`
 let history = [], busy = false, thinking = false, engine = {};
 const mic = {}, $ = () => mic;
 const resetRecognition = () => {};
 const stopSpeaking = () => {}, addMe = () => {}, setStatus = () => {}, toast = () => {};
 const systemPrompt = () => 'Teacher';
 let fail = false, calls = 0;
 const ask = async messages => {
   calls++;
   assert.equal(messages[1].role, 'user');
   for(let i=1;i<messages.length;i++) assert.equal(messages[i].role, i%2 ? 'user' : 'assistant');
   if(fail) throw Error('GPU lost');
   await Promise.resolve();
   return {raw:'reply', speaking:Promise.resolve()};
 };
 ${send}
 `, state);
 await vm.runInContext(`(async () => {
   for(let i=0;i<12;i++) await send('hello');
   assert.equal(history.length,24);
   fail=true; await send('fails'); assert.equal(history.length,24);
   fail=false;
   const before=calls; await Promise.all([send('first'),send('second')]);
   assert.equal(calls,before+1); assert.equal(busy,false); assert.equal(mic.disabled,false);
 })()`, state);
 console.log(`${file}: syntax, online transport, 12 turns, retry and concurrent send passed`);
}
})().catch(e => {console.error(e);process.exitCode=1;});
