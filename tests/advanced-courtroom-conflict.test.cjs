const assert=require('node:assert/strict');
const Case=require('../advanced_case_engine.js');
const Conflict=require('../advanced_courtroom_conflict.js');
const variants={};for(const t of ['did','didnt','reason'])variants[t]={
 events:[{id:'hall',at:'00:43',place:'복도',action:'이동'}],
 evidence:[{id:'camera',kind:'CCTV',source:'원본'}],
 witnesses:[{id:'clerk',observedEventIds:['hall']}]
};
const seed=Case.create({id:'dialogue',version:1,variants},'s','reason');
const script={lines:[
 {id:'p',phase:'claim',speaker:'prosecution',text:'영상과 증언이 다릅니다.',intensity:'firm',support:[{type:'evidence',id:'camera'}]},
 {id:'d',phase:'rebuttal',speaker:'defense',replyTo:'p',text:'그 차이가 동의 여부를 뜻하지는 않습니다.',support:[{type:'argument',id:'p'}]},
 {id:'p2',phase:'counter',speaker:'prosecution',replyTo:'d',text:'목격 시점부터 다시 확인하겠습니다.',intensity:'heated',support:[{type:'argument',id:'d'}]},
 {id:'j',phase:'intervention',speaker:'judge',replyTo:'p2',text:'개인적 비난을 삼가고 근거를 제시하세요.',support:[{type:'argument',id:'p2'}]}
]};
assert.deepEqual(Conflict.choices(seed,script),[]);
const filed=Case.append(seed,{type:'submission',evidenceId:'camera'});
assert.deepEqual(Conflict.choices(filed,script).map(x=>x.id),['p']);
const a=Conflict.play(filed,script,'p');
assert.deepEqual(Conflict.choices(a,script).map(x=>x.id),['d']);
const b=Conflict.play(a,script,'d'),c=Conflict.play(b,script,'p2'),d=Conflict.play(c,script,'j');
assert.equal(Conflict.history(d).length,4);assert.equal(d.lock,seed.lock);
assert.deepEqual(Conflict.history(JSON.parse(JSON.stringify(d))),Conflict.history(d));
assert.throws(()=>Conflict.play(d,script,'p'),/unavailable/);
assert.throws(()=>Conflict.validate({lines:[{id:'x',phase:'claim',speaker:'defense',text:'사실입니다',support:[{type:'evidence',id:''}]}]}),/Invalid support/);
console.log('PASS: evidence gated, authored courtroom conflict, deterministic replay, judge intervention');
