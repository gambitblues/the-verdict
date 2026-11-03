/* THE VERDICT P4 read-only E2E against isolated QA Supabase + QA Worker.
 * No case reservation, DB mutation, OpenAI use or worker deploy.
 * Set SUPABASE_URL, SUPABASE_ANON_KEY, VERDICT_API (PUBLIC settings only).
 * Two passwords are prompted locally, never logged or saved.
 */
import assert from 'node:assert/strict';
import readline from 'node:readline';

const {SUPABASE_URL,SUPABASE_ANON_KEY,VERDICT_API}=process.env;
for(const k of ['SUPABASE_URL','SUPABASE_ANON_KEY','VERDICT_API'])
 if(!process.env[k])throw Error('missing public env '+k);
const ask=(label,hide=false)=>new Promise(resolve=>{
 const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
 if(hide)rl._writeToOutput=s=>rl.output.write(s.startsWith(label)?s:'*');
 rl.question(label,x=>{rl.close();if(hide)process.stdout.write('\n');resolve(x.trim())});
});
async function signIn(){
 const email=await ask('TEST player email: ');
 const pass=await ask('TEST player password: ',true);
 const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{
  method:'POST',headers:{apikey:SUPABASE_ANON_KEY,'content-type':'application/json'},
  body:JSON.stringify({email,password:pass})});
 const data=await r.json();if(!r.ok)throw Error('TEST login rejected');
 return {token:data.access_token,id:data.user.id};
}
async function rest(token,path){
 return fetch(SUPABASE_URL+'/rest/v1/'+path,{headers:{
  apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+token}});
}
async function read(token,path){
 const r=await fetch(VERDICT_API+path,{headers:{authorization:'Bearer '+token}});
 if(!r.ok)throw Error(path+' HTTP '+r.status);
 return r.json();
}
async function verifyTest(p){
 const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/is_test_player',{
  method:'POST',headers:{apikey:SUPABASE_ANON_KEY,authorization:'Bearer '+p.token,'content-type':'application/json'},body:'{}'});
 if(!r.ok||await r.json()!==true)throw Error('Not a registered TEST player. Aborting without writes.');
}
async function world(p){
 const clock=await read(p.token,'/world/clock');
 const npc=await read(p.token,'/world/npcs');
 assert.equal(clock.ok,true);assert.equal(npc.ok,true);
 assert.ok(Array.isArray(npc.npcs));
 let after=0,events=[];
 for(let page=0;page<30;page++){
  const d=await read(p.token,'/world/events?after='+after);
  assert.equal(d.ok,true);assert.ok(Array.isArray(d.events));
  events.push(...d.events);
  if(!d.events.length||d.events.length<50)break;
  assert.ok(Number(d.next)>after);
  after=Number(d.next);
 }
 for(const path of ['case_stock?select=case_id&limit=1','world_secrets?select=case_id&limit=1']){
  const restricted=await rest(p.token,path);
  assert.ok(restricted.status===401||restricted.status===403,'private '+path+' must deny authenticated reader');
 }
 return {clock:clock.clock,npcs:npc.npcs,events};
}
const a=await signIn(),b=await signIn();
assert.notEqual(a.id,b.id,'two distinct accounts required');
await verifyTest(a);await verifyTest(b);
const left=await world(a),right=await world(b);
assert.deepEqual(left,right,'both judges must observe identical public clock, NPCs and events');
console.log('PASS P4 live read-only 2-account RLS: shared day '+(left.clock?.game_day??'unset')
 +' / NPC '+left.npcs.length+' / public events '+left.events.length);
