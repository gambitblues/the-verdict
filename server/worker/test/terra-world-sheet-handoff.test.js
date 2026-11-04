import test from 'node:test';
import assert from 'node:assert/strict';
import Converter from '../src/terra_world_sheet_handoff.cjs';
import Generator from '../src/terra_case_generator.cjs';
import Pipeline from '../src/terra_case_pipeline.cjs';
import Admission from '../src/terra_auto_admission.cjs';
const fact='작성된 시각과 기록을 비교하여 공간과 관찰 범위를 구체적으로 확인하였다.';
function prepared(){
 const c={format:'verdict-terra-candidate/v1',id:'terra-handoff-001',status:'review',
 card:{kind:'criminal',category:'violence',title:'창고 앞 통로에서 일어난 충돌',summary:'야간 창고 통로에서 두 당사자가 마주쳤다. 이동 경로와 신체 접촉 경위가 다투어지고 있다.'},
 source:{type:'original',note:'실존 사건이 아닌 물적 증거의 불확실성을 중심으로 작성된 독립 가상 사건'},
 premise:{cause:fact,action:fact,aftermath:fact},scene:{location:'지역 창고 복도 내부',observed:fact,uncertainty:'창고 내부 동선은 기록으로만 확정하기 어려운 상태이다.'},
 records:[{id:'r-camera',title:'창고 앞 복도 감시영상',kind:'영상',by:'검찰',how:'경비실 보관 영상 원본을 정식 확보함',limitation:'복도 출입만 기록되어 내부 행동은 확인되지 않음',first:true},
 {id:'r-call',title:'인근 신고 전화 녹취',kind:'녹음',by:'검찰',how:'접수 기관에서 신고 통화 내역을 확보함',limitation:'신고자는 충돌을 보지 않고 소리만 들었다',first:true},
 {id:'r-log',title:'창고 출입 통제 원장',kind:'장부',by:'변호인',how:'출입 관리자가 기관의 원본 원장을 제출함',limitation:'카드 사용자와 실제 현장 인물을 동일시할 수 없음',first:false}],
 witnesses:[{id:'W1',role:'인근 상점 관리 직원',knowledgeLimit:'현장 안쪽의 직접 접촉은 보지 못했다'}],
 realism:{timelineMechanics:fact,physicalScene:fact,evidenceProvenance:fact,witnessObservability:fact,alternativeHypotheses:fact,aftermathConsequences:fact,contactMechanism:fact,injuryOrNoInjury:fact,medicalLimits:fact,sensitiveDetailPolicy:'non-graphic'}};
 c.worlds={};
 for(const [i,t] of ['did','didnt','reason'].entries())c.worlds[t]={act:'21시 12분 창고의 좁은 통로에서 상대를 만나 '+['다툼 끝에 폭행을 가한 뒤 이동했다.','별다른 접촉 없이 인사한 후 이동했다.','이동하던 중 우연히 어깨가 부딪힌 뒤 떨어졌다.'][i],motive:fact,cause:fact,
 timeline:[{at:'21:12',what:fact}],records:Object.fromEntries(c.records.map((r,j)=>[r.id,t+' 세계에서 '+r.title+'을 확인한 기록: 21시 '+(12+j)+'분 출입 이력'])),
 witnesses:{W1:t+' 세계에서 소리의 크기와 나중 출입 시각만 관찰했으며 직접 접촉 장면은 보지 못했다'}};
 return c;
}
function sheet(c){
 const s={format:'verdict-world-sheet/v1',id:c.id,status:'draft',source:c.source,card:{...c.card,accused:'A',complainant:'B',
 charge:{name:'폭행',law:'형법 제260조',min:0,max:2,life:false,fine:500}},
 people:[{key:'A',name:'{A}',role:'피고인',age:34},{key:'B',name:'{B}',role:'피해자',age:35},{key:'W1',name:'{W1}',role:c.witnesses[0].role,age:44}],
 places:[{id:'p-room',name:'창고 복도'}],devices:[],
 common:{date:'2026-09-12',timeline:[{at:'21:00',place:'p-room',who:['A'],what:'양측의 이동 경로가 일부 겹친다'}],facts:[c.scene.observed]},
 records:c.records.map(r=>({...r,unlock:r.first?undefined:'법원이 관리 원장 제출을 명함'})),
 worlds:{},traps:[],screen:{allow:['사건의 기록된 사실'],avoid:'선정적 묘사'},open:[]};
 for(const t of ['did','didnt','reason']){
  const w=structuredClone(c.worlds[t]);s.worlds[t]={...w,label:t,legal:'폭행죄 적용 및 책임 범위에 대한 검토가 필요하다.',
   saw:{...w.witnesses},knows:{A:fact,B:fact},
   sentencing:Object.fromEntries(['means','degree','count','setting','harm','victim','planning','after'].map(k=>[k,fact]))};
  delete s.worlds[t].witnesses;
 }
 return s;
}
test('reviewed candidate converts only with fully authored world sheet and stays draft',()=>{
 const c=prepared();assert.equal(Pipeline.validateDraft(c).ok,true);
 const s=sheet(c),r=Converter.prepareWorldSheet(c,s);
 assert.equal(r.ok,true,JSON.stringify(r.errors));assert.equal(r.sheet.status,'draft');
 assert.deepEqual(r.sheet.worlds.did.records,c.worlds.did.records);
 assert.equal(s.status,'draft');
});
test('incomplete or fabricated missing facts must not be auto-filled',()=>{
 const c=prepared(),s=sheet(c);
 delete s.worlds.reason.sentencing;
 assert.equal(Converter.prepareWorldSheet(c,s).ok,false);
 const withoutWitness=sheet(c);delete withoutWitness.worlds.did.saw.W1;
 assert.equal(Converter.prepareWorldSheet(c,withoutWitness).ok,false);
});
test('truth and original evidence cannot silently mutate during conversion',()=>{
 const c=prepared(),s=sheet(c);s.worlds.did.records['r-log']='뒤늦게 변경한 증거 내용';
 assert.equal(Converter.prepareWorldSheet(c,s).ok,false);
 const c2=prepared();c2.status='draft';
 assert.equal(Converter.prepareWorldSheet(c2,sheet(c2)).ok,false);
});
test('reject status ready before independent world-sheet validation',()=>{
 const c=prepared(),s=sheet(c);s.status='ready';
 assert.equal(Converter.prepareWorldSheet(c,s).ok,false);
});

test('repair only fills world-sheet structure and never modifies original locked truth',async()=>{
 const c=prepared();c.status='draft';
 const flawed=sheet(c);delete flawed.worlds.did.sentencing;
 let calls=0;
 const corrected=sheet(c);
 const repair=await Generator.repairWorldSheet(c,flawed,['did: 8개 양형 인자가 필요합니다.'],{
  apiKey:'fake',model:'fake-model',
  fetcher:async()=>{calls++;return {ok:true,json:async()=>({output_text:JSON.stringify(corrected),usage:{output_tokens:30}})}}
 });
 assert.equal(calls,1);
 assert.equal(repair.ok,true,JSON.stringify(repair.errors));
 assert.equal(repair.worldSheet.status,'draft');
 assert.equal(flawed.worlds.did.sentencing,undefined);
 assert.equal(c.worlds.did.act,corrected.worlds.did.act);
});
test('repair model cannot change evidence in the locked world',async()=>{
 const c=prepared();c.status='draft';
 const incorrect=sheet(c);incorrect.worlds.did.records['r-camera']='새로운 사실을 임의로 만들어 첨부한 증거 문서';
 const result=await Generator.repairWorldSheet(c,sheet(c),['증거 원본 검증 실패'],{
  apiKey:'fake',model:'fake-model',
  fetcher:async()=>({ok:true,json:async()=>({output_text:JSON.stringify(incorrect)})})
 });
 assert.equal(result.ok,false);
 assert.equal(result.stage,'repair-rejected');
 assert.ok(result.errors.some(x=>x.includes('증거 원문')));
});
test('repair cannot be used to rewrite a candidate with missing review fields',async()=>{
 const c=prepared();c.status='draft';delete c.realism;
 let calls=0;
 const result=await Generator.repairWorldSheet(c,sheet(c),['미작성'],{
  apiKey:'fake',model:'fake-model',
  fetcher:async()=>{calls++;throw Error('must not call API')}
 });
 assert.equal(result.ok,false);assert.equal(result.stage,'candidate-QA');assert.equal(calls,0);
});

test('P4 new authored seed can enter trusted shared docket only after deterministic QA',()=>{
 const c=prepared();c.status='draft';
 const factTexts=[
  '창고 통로에서 두 당사자가 마주친 당시 경비실의 출입 시각 기록이 존재한다.',
  '피고인과 상대방은 다툼이 시작되기 전 같은 복도를 지나가고 있었다.',
  '복도 앞 감시영상은 해당 복도의 움직임만 기록하며 건물 내부 행동을 보여주지 않는다.'
 ];
 const facts=factTexts.map((text,i)=>({id:'f'+(i+1),text}));
 c.immutableFacts=facts;
 c.records[0].authorLeadId='e1';
 c.records[2].authorLeadId='e2';
 const sh=sheet(c);sh.immutableFacts=facts;
 const seed={
  format:'verdict-author-seed/v1',id:c.id,status:'draft',category:'violence',kind:'criminal',
  title:c.card.title,opening:c.card.summary+' 최초 신고 당시 양측의 행동과 출입 시간이 쟁점이었다.',
  immutableFacts:factTexts.map((fact,i)=>({id:'f'+(i+1),fact,certainty:'confirmed'})),
  people:[{id:'A',role:'피고인',knowledge:'자신의 당시 행동에 관한 일부 사실을 기억하고 있다.'},
          {id:'B',role:'피해자',knowledge:'복도에서 본 움직임 일부를 기억하고 있다.'}],
  evidenceLeads:[
   {id:'e1',title:'복도 감시영상',exists:'confirmed',source:'경비실 원본 보관',reveals:'출입 시각과 이동을 확인할 수 있다.',limit:'건물 안쪽의 신체 접촉은 볼 수 없다.'},
   {id:'e2',title:'출입통제 원장',exists:'possible',source:'건물 관리인 보관',reveals:'카드 출입 로그를 볼 수 있다.',limit:'카드 소지자와 실제 사용자가 같다고 단정할 수 없다.'}
  ],
  contestedQuestions:['접촉 당시 신체 행동의 실제 경위를 확인해야 한다.'],
  unknowns:[],source:{type:'original',note:'실제 사례와 관계없는 독립 가상 사건만 작성하였다.'}
 };
 const result=Admission.verifyForAdmission(seed,c,sh);
 assert.equal(result.ok,true,JSON.stringify(result.errors));
 assert.equal(result.payload.p_id,c.id);
 assert.equal(result.payload.p_verification.completedSimulations,18);
 assert.match(result.payload.p_candidate_hash,/^[a-f0-9]{64}$/);
 assert.match(result.payload.p_sheet_hash,/^[a-f0-9]{64}$/);
 assert.ok(['did','didnt','reason'].includes(result.branch));
 const fake=structuredClone(sh);fake.immutableFacts[0].text='AI가 바꿔버린 사실';
 const denied=Admission.verifyForAdmission(seed,c,fake);
 assert.equal(denied.ok,false);
 assert.ok(denied.errors.includes('immutable_author_facts_not_preserved'));
});
