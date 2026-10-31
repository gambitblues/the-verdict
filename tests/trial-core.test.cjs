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

console.log('trial core regression tests passed');
