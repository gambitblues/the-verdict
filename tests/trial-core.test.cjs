/* Regression tests for the trial engine core. Run: node tests/trial-core.test.cjs */
const assert=require('node:assert/strict');
const T=require('../trial_core.js');

const caseDef={id:'demo',archetypeId:'demo',evidence:[{id:'e0',title:'CCTV'},{id:'e1',title:'통화 기록'}],witnesses:[{id:'w0',role:'목격자'}]};
const t=T.roll(caseDef,'A',[]);
t.style='aggressive';t.cards=[];
assert.equal(t.evidence.length,2);
assert.ok(['did','didnt','reason'].includes(t.truth));

// Repeating an archetype inside 20 cases is flagged; a returning archetype changes its truth.
assert.equal(T.roll(caseDef,'B',[t]).repeated,true);
const later=T.roll(caseDef,'B',[t,...Array.from({length:20},(_,i)=>({archetypeId:'x'+i}))]);
assert.equal(later.repeated,false);
assert.notEqual(later.truth,t.truth,'returning archetype must vary its hidden truth');

// Story engine truth is respected.
assert.equal(T.roll({...caseDef,truth:T.truthFromStory('contradicted')},'C',[]).truth,'didnt');

// Reveal is staged ? → range → exact.
assert.equal(T.reveal(0),1);assert.equal(T.reveal(1),2);assert.equal(T.reveal(2),2);

// Decisions are keyed: repeating or flipping never stacks.
const e=t.evidence[0];e.flawType='illegal';e.flaw=70;e.revealed=2;e.decision='use';
const once=T.skill(t).total;
assert.equal(once,-15);
e.decision='use';assert.equal(T.skill(t).total,once,'same decision twice must not stack');
e.decision='exclude';assert.equal(T.skill(t).total,5,'changing a decision replaces it');

// Objection cards: valid vs invalid, one entry per card.
t.cards=[{id:'o1',type:'objection',valid:true,choice:'accept'},{id:'o2',type:'objection',valid:false,choice:'accept'}];
assert.equal(T.skill(t).total,5+3-3);
t.cards=[];

// Public opinion never changes proof or skill.
const before={g:T.gauge(t),s:T.skill(t,{dir:'acquit',criminal:true})};
t.media={H:100,O:100,S:100};
assert.deepEqual(T.gauge(t),before.g);
assert.deepEqual(T.skill(t,{dir:'acquit',criminal:true}),before.s);

// Verdict direction: IDs and Korean labels.
assert.equal(T.direction({id:'notguilty',label:'무죄'},'criminal'),'acquit');
assert.equal(T.direction({id:'guilty',label:'유죄'},'criminal'),'convict');
assert.equal(T.direction({id:'full',label:'원고 승소'},'civil'),'claimant');
assert.equal(T.direction({id:'dismiss',label:'원고 패소'},'civil'),'respondent');
assert.equal(T.direction({id:'assault',label:'폭행 부분 유죄 · 벌금형'},'criminal'),'convict');
assert.equal(T.direction({id:'x',label:'원고 일부 승소'},'civil'),'partial');

// Twist odds and minimum trial days.
assert.equal(T.twistChance(1),0.11);assert.equal(T.twistChance(5),0.15);
assert.equal(T.minDays(3),2);assert.equal(T.minDays(5),4);

// Review is 60/20/20 and the truth never enters it.
const ev=T.evaluate(80,50,t,'acquit','seed');
assert.equal(ev.scores.length,3);
const t2={...t,truth:t.truth==='did'?'didnt':'did'};
assert.equal(T.evaluate(80,50,t2,'acquit','seed').review,ev.review,'hidden truth must not change the review');

// v5: written cases follow the text — the hinted weakness is the real one, and nothing is hidden behind '?'.
const w5=T.roll({id:'w5',strict:true,truth:'did',evidence:[{id:'e0',hintFlaw:'illegal'},{id:'e1',hintFlaw:'none'},{id:'e2',hintFlaw:'timing'}],witnesses:[{id:'x'}]},'s5',[]);
assert.deepEqual(w5.evidence.map(e=>e.flawType),['illegal','none','timing']);
assert.ok(w5.evidence.every(e=>e.revealed===2));
// testimony heard in court moves the picture; struck testimony does not
const base5={...w5,heard:[],cards:[]};
const pro=T.gauge({...base5,heard:[{w:0,side:'p',issue:'i1'},{w:0,side:'p',issue:'i1'}]}),none=T.gauge(base5);
assert.ok(pro.P>none.P,'heard testimony for the charge raises proof');
assert.equal(T.gauge({...base5,heard:[{w:0,side:'p',issue:'i1',struck:true}]}).P,none.P,'struck testimony is ignored');
assert.ok(T.gauge({...base5,heard:[{w:0,side:'p',issue:'i1'},{w:0,side:'d',issue:'i1'}]}).discord>=1,'conflicting answers on one issue count as discord');
// citing illegal evidence costs; a sentence inside the reference range earns, outside without reasons costs
const sk=v=>T.skill(base5,{dir:'convict',criminal:true,...v}).total;
assert.ok(sk({cites:[{label:'a',side:'p',illegal:true}]})<sk({cites:[{label:'a',side:'p'}]}));
assert.ok(sk({sentence:{what:'형량',value:30,lo:24,hi:36,mitig:0,aggr:0}})>sk({sentence:{what:'형량',value:80,lo:24,hi:36,mitig:0,aggr:0}}));
assert.ok(sk({sentence:{what:'형량',value:80,lo:24,hi:36,mitig:0,aggr:2}})>sk({sentence:{what:'형량',value:80,lo:24,hi:36,mitig:0,aggr:0}}),'reasons justify leaving the range');

// ---- Written (curated) cases: what the player reads about a piece of evidence and what the engine scores must match ----
// Reproduces the conflict: the same archetype returns with the same truth and the same first flaw. For generated cases the
// engine rotates the first evidence's flaw to vary the replay; for written cases that would contradict the printed text
// (e.g. an evidence card that explains a missing warrant would be scored as a timing problem).
{
 const written={id:'w',archetypeId:'written-1',strict:true,truth:'did',
  evidence:[{id:'e0',title:'영장 없이 빼낸 메모리카드',hintFlaw:'illegal'},{id:'e1',title:'통화 기록',hintFlaw:'timing'},{id:'e2',title:'계약서',hintFlaw:'none'}],witnesses:[]};
 const first=T.roll(written,'S1',[]);
 assert.deepEqual(first.evidence.map(e=>e.flawType),['illegal','timing','none'],'written case: hidden flaws follow the text');
 // exact trigger: earlier roll of the same archetype with the same truth and the same first flaw
 const history=[{archetypeId:'written-1',truth:'did',firstFlaw:'illegal'}];
 const again=T.roll(written,'S2',history);
 assert.deepEqual(again.evidence.map(e=>e.flawType),['illegal','timing','none'],'returning written case must not rotate a flaw away from its text');
 assert.equal(again.evidence[2].flaw,0,'evidence described as sound carries no hidden flaw');
 // a generated (non-written) case still varies on return
 const gen={id:'g',archetypeId:'gen-1',truth:'did',evidence:[{id:'e0',title:'CCTV',hintFlaw:'source'}],witnesses:[]};
 const g1=T.roll(gen,'G1',[]),g2=T.roll(gen,'G2',[{archetypeId:'gen-1',truth:'did',firstFlaw:g1.evidence[0].flawType}]);
 assert.notEqual(g2.evidence[0].flawType,g1.evidence[0].flawType,'generated case: returning archetype still varies its first flaw');
}
// Every written case, rolled fresh and rolled again as a returning archetype under every truth, keeps text and score aligned.
{
 const fs=require('fs'),path=require('path');global.window={};
 eval(fs.readFileSync(path.join(__dirname,'..','curated_cases.js'),'utf8'));
 const C=window.VerdictCurated;let checked=0;
 for(const id of C.ids){const cur=C.cases[id];
  const evs=[...cur.evidence.map((e,i)=>({id:'e'+i,title:e.title,hintFlaw:e.flaw})),...(cur.late?[{id:'late',title:cur.late.title,hintFlaw:cur.late.flaw||'none'}]:[])];
  for(const truth of ['did','didnt','reason'])for(const seed of ['a','b','c']){
   const def={id,archetypeId:id,strict:true,truth,evidence:evs,witnesses:[]};
   const one=T.roll(def,seed,[]),two=T.roll(def,seed+'2',[{archetypeId:id,truth,firstFlaw:one.evidence[0].flawType}]);
   for(const r of [one,two])r.evidence.forEach((e,i)=>{assert.equal(e.flawType,evs[i].hintFlaw,`${id} ${evs[i].id}: scored as ${e.flawType} but the text describes ${evs[i].hintFlaw}`);
    assert.equal(e.flaw===0,e.flawType==='none',`${id} ${evs[i].id}: flaw size does not match its type`);checked++});
  }}
 assert.ok(checked>1000,'expected to check every written evidence many times');
}

console.log('trial core regression tests passed');
