/* Regression tests for the media desk. Run: node tests/media-desk.test.cjs */
const assert=require('node:assert/strict');
const M=require('../media_desk.js');

const base=o=>({caseId:'c1',caseName:'기숙사 옥상 추락의 진상 · 대전 서구',category:'형사·사기',verdictLabel:'무죄',side:-1,
 P:70,D:20,skill:72,match:20,H:90,O:50,S:40,importance:5,daysDone:4,minDays:4,illegalOut:false,flip:false,twist:false,
 judgeName:'정상봉',opponent:{id:'L1',name:'권하준',style:'media',styleLabel:'여론전형'},
 evidence:[{decision:'use',revealed:2,flawType:'none'},{decision:'exclude',revealed:0,flawType:'source'}],...o});

// 1. Fixed facts: the summary carries the verdict and the exact gauge numbers.
const r=M.react(base(),{});
assert.ok(r.summary.some(l=>l.includes('무죄')&&l.includes('재판일 4회')));
assert.ok(r.summary.some(l=>l.includes('증거로 보여준 정도 70')&&l.includes('남은 의문 20')));

// 2. Rumour intensity follows accumulated history only: a first verdict is never level 3.
assert.equal(r.beat.level,1);
let st={};let last;
for(let i=0;i<5;i++){last=M.react(base({caseId:'k'+i,match:10}),st);st=last.state}
assert.equal(last.beat.level,3,'five verdicts against public opinion should escalate the court-beat tone');

// 3. Opinion mode lock: praise has no negative memes, criticism has no praise memes.
for(let i=0;i<40;i++){
 const p=M.react(base({caseId:'p'+i,match:85,skill:80,side:1,S:20}),{});
 assert.equal(p.community.mode,'praise');
 assert.ok(!p.community.comments.some(c=>c.pol==='-'||c.pol==='?'),'negative item in praise mode');
 const n=M.react(base({caseId:'n'+i,match:10,skill:40}),{});
 assert.equal(n.community.mode,'criticize');
 assert.ok(!n.community.comments.some(c=>c.pol==='+'),'praise item in criticize mode');
}

// 4. Homicide/sexual cases never get joke memes.
const jokes=/ㅋㅋ|자판기|오늘도 레전드|갓 또|팬이 있다면|AI로 바꾸자|법알못 판사/;
for(let i=0;i<40;i++){
 for(const cat of ['형사·살인','형사·성범죄']){
  const h=M.react(base({caseId:'h'+i+cat,category:cat,match:(i*29)%100,S:(i*41)%100,skill:30+(i*7)%60,side:i%2?1:-1,flip:true}),{});
  assert.ok(!h.community.comments.some(c=>jokes.test(c.text)),'joke meme in a heavy case: '+cat);
 }
}

// 5. No repeated comment inside one verdict, and 30–40%+ plain comments.
st={};
for(let i=0;i<30;i++){
 const x=M.react(base({caseId:'d'+i,match:(i*37)%100,S:(i*53)%100,side:i%3?-1:1}),st);st=x.state;
 const texts=x.community.comments.map(c=>c.text);
 assert.equal(new Set(texts).size,texts.length,'duplicate comment in one verdict');
 assert.ok(x.community.comments.filter(c=>c.kind==='plain').length>=3,'too few plain comments');
}

// 6. Korean particles after numbers.
assert.equal(M.batchim(70),true);assert.equal(M.batchim(12),false);assert.equal(M.batchim(17),true);assert.equal(M.batchim(25),false);

console.log('media desk regression tests passed');
