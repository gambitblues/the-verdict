const assert=require('node:assert/strict');
const Case=require('../advanced_case_engine.js');
const Court=require('../advanced_courtroom_conflict.js');
const variants={};
for(const t of ['did','didnt','reason'])variants[t]={
 events:[{id:'corridor',at:'00:43',place:'숙박시설 2층 복도',action:'두 사람이 복도를 이동했다.'}],
 evidence:[{id:'camera',kind:'CCTV',source:'복도 원본 영상'}],
 witnesses:[{id:'clerk',observedEventIds:['corridor']}]
};
const initial=Case.create({id:'hall-contradiction',version:1,variants},'fixed','reason');
const anchor={fact:'종업원의 등에 업혀 들어왔다는 진술과 CCTV 보행 장면의 불일치',eventId:'corridor'};
const line=(id,phase,speaker,text,purpose,support,replyTo,extra={})=>({id,phase,speaker,text,purpose,support,replyTo,issueId:'witness-reliability',target:anchor,...extra});
const script={lines:[
 line('q','question','defense','경찰 조사에서 피고인이 피해자를 업고 들어왔다고 말씀하셨습니까?','establish',[{type:'testimony',id:'2'}]),
 line('a','answer','witness','네, 그렇게 기억합니다.','clarify',[{type:'argument',id:'q'}],'q'),
 line('c','confrontation','defense','6월 12일 00시 43분 CCTV에서는 피해자가 직접 걷습니다. 같은 때를 보신 겁니까?','impeach',[{type:'argument',id:'a'},{type:'evidence',id:'camera'}],'a'),
 line('e','explanation','witness','정확한 시각은 기억나지 않습니다. 다른 손님과 혼동했을 수도 있습니다.','explain',[{type:'argument',id:'c'}],'c'),
 line('p','claim','prosecution','걸어간 장면만으로 객실 안에서의 상태가 확인되지는 않습니다.','argue',[{type:'argument',id:'e'}],'e'),
 line('d','rebuttal','defense','영상만으로 객실 안 상황을 주장하지 않습니다. 업혀 왔다는 목격 진술의 오류를 지적하는 것입니다.','respond',[{type:'argument',id:'p'}],'p'),
 line('heated','counter','prosecution','상대방은 터무니없는 주장을 이어갑니다!','argue',[{type:'argument',id:'d'}],'d',{intensity:'heated',triggerEvent:'personal_attack'}),
 line('judge','intervention','judge','상대방에 대한 인신공격성 표현을 삼가고 진술의 근거를 설명하십시오.','manage_proceeding',[{type:'argument',id:'heated'}],'heated',{trigger:'personal_attack'})
]};
assert.equal(Court.validate(script),true);
assert.deepEqual(Court.choices(initial,script),[]);
const withTestimony=Case.append(initial,{type:'testimony',witnessId:'clerk',text:'업혀 들어오는 것을 보았습니다.'});
assert.deepEqual(Court.choices(withTestimony,script).map(x=>x.id),['q']);
let s=withTestimony;for(const id of ['q','a'])s=Court.play(s,script,id);
assert.deepEqual(Court.choices(s,script),[]); // CCTV not yet submitted
s=Case.append(s,{type:'submission',evidenceId:'camera'});
for(const id of ['c','e','p','d','heated'])s=Court.play(s,script,id);
assert.deepEqual(Court.choices(s,script).map(x=>x.id),['judge']);
s=Court.play(s,script,'judge');
assert.equal(Court.history(s).length,8);
assert.equal(s.lock,initial.lock);
assert.deepEqual(Court.history(JSON.parse(JSON.stringify(s))),Court.history(s));
assert.throws(()=>Court.play(s,script,'judge'),/unavailable/);
const unjustified=JSON.parse(JSON.stringify(script));
unjustified.lines[6].triggerEvent=null;
assert.throws(()=>Court.validate(unjustified),/trigger does not match/);
const fabricated=JSON.parse(JSON.stringify(script));
fabricated.lines[2].support[1].id='fabricated-camera';
assert.equal(Court.choices(Case.append(withTestimony,{type:'submission',evidenceId:'camera'}),fabricated).some(x=>x.id==='c'),false);
const missingFact=JSON.parse(JSON.stringify(script));
delete missingFact.lines[0].target.fact;
assert.throws(()=>Court.validate(missingFact),/factual target/);
console.log('PASS: causal witness examination, anchored evidence conflict, justified judge warning, deterministic locked case');
