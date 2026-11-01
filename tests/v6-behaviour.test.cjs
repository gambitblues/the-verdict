/* v6 people-driven trial rules (trial_core pure functions). Run: node tests/v6-behaviour.test.cjs
 * Covers: witness attitude from character + stake, lawyer skill → objection soundness, showing evidence to a witness,
 * face-to-face examination. All are pure and seeded, so any result can be replayed from a save. */
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const T=require('../trial_core.js');
const seeds=n=>Array.from({length:n},(_,i)=>'s'+i);
const share=(xs,f)=>xs.filter(f).length/xs.length;
const P=(traits,stake='',age=40)=>({traits,stake,age});

// ---- attitude: deterministic, and character + stake drive it ----
const honestP=P({honesty:92,conscientiousness:88,empathy:50,stressControl:80,impulsivity:15});
assert.deepEqual(T.attitudeOf(honestP,'x'),T.attitudeOf(honestP,'x'),'attitude must replay from the same seed');
const att=(p,n=400)=>seeds(n).map(s=>T.attitudeOf(p,s).attitude);
assert.ok(share(att(honestP),a=>a==='honest')>0.8,'a very honest, careful person with nothing at stake should mostly testify honestly');
const shield=P({honesty:25,conscientiousness:50,empathy:90,stressControl:60,impulsivity:30},'피고인과 4년 지기 친구다');
assert.ok(share(att(shield),a=>a==='protect')>0.6,'a low-honesty, warm friend of a party should mostly shield them');
assert.ok(share(att(P(shield.traits,'')),a=>a==='protect')<share(att(shield),a=>a==='protect')-0.3,'without the friendship the same person shields far less');
const scared=P({honesty:60,conscientiousness:55,empathy:50,stressControl:12,impulsivity:30},'원청과 재계약을 앞두고 있어 불이익이 두렵다');
assert.ok(share(att(scared),a=>a==='fear')>0.6,'a fragile person whose job is at stake should mostly be afraid');
const fickle=P({honesty:20,conscientiousness:15,empathy:40,stressControl:50,impulsivity:92});
assert.ok(share(att(fickle),a=>a==='flip')>0.6,'an impulsive, careless, dishonest person should mostly change their story');
// no single trait decides alone: the honest person can still be afraid when the stake is heavy and composure low
const mixed=P({honesty:80,conscientiousness:70,empathy:50,stressControl:30,impulsivity:20},'보복이 두렵다');
const mixedShare=share(att(mixed),a=>a==='fear');
assert.ok(mixedShare>0.05&&mixedShare<0.95,'attitude is not a one-trait rule: mixed character gives mixed results ('+mixedShare.toFixed(2)+')');
// reliability follows honesty, memory falls with age
const rel=h=>seeds(200).reduce((a,s)=>a+T.attitudeOf(P({honesty:h,conscientiousness:50}),s).reliability,0)/200;
assert.ok(rel(90)>rel(20)+15,'more honest witnesses should be more reliable');
const mem=age=>seeds(200).reduce((a,s)=>a+T.attitudeOf(P({conscientiousness:50},'',age),s).memory,0)/200;
assert.ok(mem(35)>mem(80)+15,'older witnesses should remember less precisely');
for(const s of seeds(200)){const r=T.attitudeOf(P({honesty:s.length*7%100,stressControl:30},'가족'),s);
 assert.ok(['honest','protect','fear','flip'].includes(r.attitude));assert.ok(r.reliability>=35&&r.reliability<=92);assert.ok(r.memory>=30&&r.memory<=92)}

// ---- every written case's witnesses produce a valid attitude from their stake text ----
global.window={};eval(fs.readFileSync(path.join(__dirname,'..','curated_cases.js'),'utf8'));
const C=window.VerdictCurated;let witnesses=0,withStake=0;
for(const id of C.ids)for(const w of C.cases[id].witnesses){const r=T.attitudeOf(P({},[w.stake,w.story,w.role].join(' ')),id);
 assert.ok(['honest','protect','fear','flip'].includes(r.attitude),id);witnesses++;if(r.because!=='none')withStake++}
assert.equal(witnesses,180,'60 cases × 3 witnesses');
assert.ok(withStake>=60,'most written witnesses should carry a stake the engine recognises ('+withStake+'/180)');

// ---- lawyer skill: better lawyers object soundly more often ----
const sound=(skill,style='aggressive')=>share(seeds(3000),s=>T.objectionValid(skill,style,s));
assert.ok(sound(90)>sound(30)+0.25,'a skilled lawyer should raise sound objections clearly more often');
assert.ok(sound(60,'meticulous')>sound(60,'aggressive'),'a meticulous style adds a little');
assert.ok(sound(0)>=0.12&&sound(100)<=0.88,'odds stay inside sensible bounds');

// ---- showing evidence to a witness ----
for(const truth of ['did','didnt','reason']){
 const ts=T.truthSide(truth);
 for(const attitude of ['honest','protect','fear','flip'])for(const flipped of [false,true])for(const s of seeds(150)){
  const o=T.confrontOutcome({attitude,flipped,traits:{honesty:50,stressControl:50}},truth,s);
  assert.deepEqual(o,T.confrontOutcome({attitude,flipped,traits:{honesty:50,stressControl:50}},truth,s),'confrontation must replay');
  if(o.kind==='admit'||o.kind==='revert')assert.equal(o.side,ts,'what a pressed witness admits must point the way the truth points');
  if(o.kind==='hold')assert.ok(!o.strike&&o.side==='n','a witness who holds firm changes nothing');
  if(o.kind==='correct')assert.ok(attitude==='honest'&&o.strike,'only an honest witness corrects themselves');
  if(o.kind==='revert')assert.ok(attitude==='flip'&&flipped,'only a witness who changed their story can go back to it');
  if(attitude!=='honest')assert.notEqual(o.kind,'correct');
 }
}
const cf=(attitude,flipped,traits)=>share(seeds(2000),s=>T.confrontOutcome({attitude,flipped,traits},'did',s).kind!=='hold');
assert.ok(cf('flip',true,{})>cf('flip',false,{})+0.3,'a witness caught changing their story gives way more easily');
assert.ok(cf('protect',false,{stressControl:10})>cf('protect',false,{stressControl:90})+0.15,'a shielding witness with poor composure cracks more often');

// ---- face to face ----
const w=(attitude='honest')=>({traits:{honesty:55,stressControl:55},reliability:60,attitude});
for(const truth of ['did','didnt']){
 const out=seeds(3000).map(s=>T.faceOffOutcome(w(),w(),truth,s).result);
 const liar=truth==='did'?'d-yields':'p-yields',honest=truth==='did'?'p-yields':'d-yields';
 assert.ok(share(out,r=>r===liar)>share(out,r=>r===honest)+0.3,'with equal characters, the witness whose account is false gives way more often ('+truth+')');
 assert.ok(share(out,r=>r===honest)>0.02,'but the truthful side can still lose: nothing is certain');
}
const steady=share(seeds(3000),s=>T.faceOffOutcome({traits:{honesty:90,stressControl:90},reliability:85,attitude:'honest'},w('flip'),'reason',s).result==='d-yields');
assert.ok(steady>0.7,'a steady honest witness should outlast a story-changer');
assert.deepEqual(T.faceOffOutcome(w(),w(),'did','z'),T.faceOffOutcome(w(),w(),'did','z'),'face-off must replay');

// ---- judge's orders: results come only from what exists ----
for(const s of seeds(300)){
 assert.equal(T.orderOutcome({type:'records',to:'p',has:false},s),'none','nothing written means the honest answer is "none"');
 const o=T.orderOutcome({type:'records',to:'d',crim:true,skill:60},s);assert.ok(['done','late','declined'].includes(o)||o==='partial');
 assert.notEqual(T.orderOutcome({type:'records',to:'d',crim:false,skill:60},s),'declined','only a criminal defence may decline');
 assert.notEqual(T.orderOutcome({type:'witness',to:'p',skill:60,delayed:true},s),'late','an order delayed once is not delayed again');
 assert.ok(['done','late'].includes(T.orderOutcome({type:'recall',skill:10},s)),'recalling a witness never fails');
 assert.equal(T.orderOutcome({type:'expert',to:'n',skill:50},s),T.orderOutcome({type:'expert',to:'n',skill:50},s),'orders replay');
}
const dec=share(seeds(3000),s=>T.orderOutcome({type:'records',to:'d',crim:true,skill:60},s)==='declined');
assert.ok(dec>0.1&&dec<0.3,'a criminal defence declines now and then, whatever the lawyer skill ('+dec.toFixed(2)+')');
const full=k=>share(seeds(3000),s=>T.orderOutcome({type:'records',to:'p',skill:k},s)==='done');
assert.ok(full(90)>full(20)+0.2,'a more capable party answers an order in full more often');

// ---- follow-up nodes open only when what came before calls for them ----
const st=(o={})=>({day:1,heard:[],orders:{},...o});
assert.ok(T.nodeOpen({},st()),'a node without a trigger is open from the first hearing');
assert.ok(!T.nodeOpen({day:3},st({day:2}))&&T.nodeOpen({day:3},st({day:3})),'day sets the earliest hearing');
assert.ok(!T.nodeOpen({after:{heard:'1:q2'}},st())&&T.nodeOpen({after:{heard:'1:q2'}},st({heard:[{w:1,q:'q2'}]})),'heard opens after that answer');
assert.ok(!T.nodeOpen({after:{got:'n1'}},st({orders:{n1:'pending'}}))&&T.nodeOpen({after:{got:'n1'}},st({orders:{n1:'partial'}})),'got waits for material');
assert.ok(T.nodeOpen({after:{miss:'n1'}},st({orders:{n1:'none'}}))&&T.nodeOpen({after:{miss:'n1'}},st({orders:{n1:'declined'}}))&&!T.nodeOpen({after:{miss:'n1'}},st({orders:{n1:'done'}})),'miss offers a way forward when nothing came');
assert.ok(T.nodeOpen({after:{contra:'i1'}},st({heard:[{issue:'i1',side:'p'},{issue:'i1',side:'d'}]}))&&!T.nodeOpen({after:{contra:'i1'}},st({heard:[{issue:'i1',side:'p'}]})),'contra needs testimony pointing both ways');
assert.ok(T.nodeOpen({after:{any:[{got:'n1'},{heard:'0:q1'}]}},st({heard:[{w:0,q:'q1'}]}))&&!T.nodeOpen({after:{all:[{got:'n1'},{heard:'0:q1'}]}},st({heard:[{w:0,q:'q1'}]})),'any / all');

console.log('v6 behaviour tests passed · attitude, lawyer skill, confrontation, face-off, judge orders, follow-up triggers, 180 written witnesses');
