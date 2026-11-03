import test from 'node:test';
import assert from 'node:assert/strict';
import Pipeline from '../src/terra_case_pipeline.cjs';
const candidate=()=>{
 const records=[{id:'r-camera',title:'골목 입구 카메라 기록',how:'수사관이 관리업체로부터 원본 제출을 받음',limitation:'사각지대에 대한 관찰은 불가능함',first:true,kind:'영상'},
 {id:'r-receipt',title:'점포 결제 단말기 내역',how:'점포 관리인이 승인 내역을 출력해 제출함',limitation:'구매자 본인을 확정하지 못함',first:false,kind:'기록'},
 {id:'r-neighbor',title:'이웃의 신고 녹취 파일',how:'신고 기관의 통화 기록을 정식 회신받음',limitation:'신고자는 출입자를 보지 못함',first:true,kind:'진술'}];
 const worlds={};
 for(const [key,action] of [['did','당사자가 창고 복도에서 상대와 충돌하여 사고 직후 현장을 떠난 상황'],['didnt','당사자는 창고 밖에서 물건을 인계한 뒤 다른 길로 이동한 상황'],['reason','당사자가 창고 안에서 물건을 옮기다가 실수로 사람과 부딪힌 상황']]){
 worlds[key]={act:action,cause:'서로 다른 움직임과 당사자들의 인식이 충돌한 결과',motive:'사건 직전의 생활 관계와 다툼이 행동에 영향을 미침',
 timeline:[{at:'21:10',what:action}],records:Object.fromEntries(records.map(r=>[r.id,key+' 세계에서 '+r.title+'에 남은 서로 다른 원문 내용'])),
 witnesses:{W1:key+' 세계에서 소리만 듣고 누가 들어갔는지는 보지 못한 이웃'}};
 }
 return {format:'verdict-terra-candidate/v1',id:'terra-warehouse-001',status:'draft',
 card:{kind:'criminal',category:'violence',title:'늦은 창고 복도에서의 충돌',summary:'저녁 무렵 창고에서 충돌이 있었다는 신고가 접수됐다. 출입자의 동선과 접촉 경위가 다투어진다.'},
 source:{type:'original',note:'기존 실존 사건을 재현하지 않고 물적 흔적의 한계를 중심으로 창작'},
 premise:{cause:'점포 인수인계 시각이 어긋나 불만이 쌓였다.',action:'양측이 창고 통로에서 같은 시각 이동했다.',aftermath:'출입 흔적과 신고 내역을 중심으로 조사가 시작됐다.'},
 scene:{location:'시외 창고 복도',observed:'바닥에 떨어진 상자와 출입 기록 장치가 남아 있었다.',uncertainty:'상자가 떨어진 경위와 두 사람의 접촉 순서는 확인되지 않았다.'},
 records,witnesses:[{id:'W1',role:'창고 옆 점포에서 일하던 목격자',knowledgeLimit:'소리는 들었으나 충돌 순간은 보지 못했다.'}],worlds};
};
test('Terra 초안은 승인 전 배당 재고에 들어갈 수 없다',()=>{
 const c=candidate();assert.equal(Pipeline.validateDraft(c).ok,true);
 assert.equal(Pipeline.admit(c,null).ok,false);
});
test('세 갈래 진실의 증거가 동일하면 거부한다',()=>{
 const c=candidate();c.worlds.didnt.records={...c.worlds.did.records};
 assert.equal(Pipeline.validateDraft(c).ok,false);
});
test('2차 출처는 경고만 주며 법률 검증을 대체하지 않는다',()=>{
 const c=candidate();c.source={type:'secondary',title:'배경을 참고한 가상의 위키 문서',publisher:'온라인 백과사전',url:'https://example.org/context',accessedAt:'2026-11-04',learning:'사회적 맥락만 참고하고 범죄 사실은 차용하지 않는다'};
 const result=Pipeline.validateDraft(c);
 assert.equal(result.ok,true);assert.equal(result.warnings.length,1);
});
test('독립 검토 체크리스트 없이는 승인되지 않는다',()=>{
 const c=candidate();
 assert.equal(Pipeline.makeReview(c,{},'담당 운영자').ok,false);
});
test('승인된 사건만 추가하고 중복 및 원본 변형을 방지한다',()=>{
 const c=candidate();const checks=Object.fromEntries(Pipeline.REVIEW.map(k=>[k,true]));
 const approved=Pipeline.makeReview(c,checks,'담당 운영자');assert.equal(approved.ok,true);
 const approval={...approved.record,approvedAt:'2026-11-04'};
 const first=Pipeline.admit(c,approval);assert.equal(first.ok,true);
 assert.equal(c.status,'draft');assert.equal(first.item.worldSheet.status,'ready');
 assert.equal(Pipeline.admit(c,approval,first.inventory).ok,false);
 const second=candidate();second.id='terra-warehouse-002';
 const approval2={...approval,id:second.id};
 assert.equal(Pipeline.admit(second,approval2,first.inventory).ok,false);
});
