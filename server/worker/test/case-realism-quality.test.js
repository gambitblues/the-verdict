import test from 'node:test';
import assert from 'node:assert/strict';
import QA from '../src/case_realism_quality.cjs';
const fact='정확한 사건 경과와 실물 흔적의 생산 주체 및 시각을 구분해 설명했다.';
const base=(status='review')=>({
 status,card:{category:'financial'},
 scene:{observed:'수취 계좌가 변경된 지급서류 두 건이 확인됐다.',uncertainty:'결재자가 실제로 변경을 승인했는지는 확인되지 않았다.'},
 records:[{id:'r-a',title:'은행 계좌 내역',how:'은행에서 진본 거래내역을 발급했다.',limitation:'수취인의 지급 목적은 거래 기록으로 확인할 수 없다.'},
 {id:'r-b',title:'결재 문서',how:'기관의 보관함에서 결재 기록을 확보했다.',limitation:'결재 문서만으로 실사용액은 확정할 수 없다.'}],
 worlds:Object.fromEntries(['did','didnt','reason'].map((k,i)=>[k,{act:'당사자가 장학금 지급 지시를 변경하며 사무실을 방문했다.',
 cause:'지급 지시와 실제 승인 여부가 달라져 분쟁이 발생했다.',motive:'정산을 둘러싼 이해관계가 서로 충돌한 사건이다.',
 records:{'r-a':k+'의 은행 수취계좌 명의 확인','r-b':k+'의 결재 승인 문구 확인'}}])),
 realism:{timelineMechanics:fact,physicalScene:fact,evidenceProvenance:fact,witnessObservability:fact,
 alternativeHypotheses:fact,aftermathConsequences:fact,moneyTrail:fact,authorityOrRepresentation:fact,lossOrBenefit:fact,sensitiveDetailPolicy:'non-graphic'}
});
test('every authored category has distinct expert-review fields',()=>{
 assert.equal(Object.keys(QA.TYPES).length,10);
 for(const [category,fields] of Object.entries(QA.TYPES)){assert.ok(fields.length>=3);
  const p=base();p.card.category=category;
  for(const field of fields)p.realism[field]=fact;
  assert.equal(QA.validate(p).ok,true,category);
 }
});
test('a review cannot pass without category-specific causal details',()=>{
 const x=base();delete x.realism.moneyTrail;
 assert.equal(QA.validate(x).ok,false);
});
test('draft stays editable with a warning',()=>{
 const x=base('draft');delete x.realism;
 assert.equal(QA.validate(x).ok,true);
 assert.equal(QA.validate(x).warnings.length,1);
});
test('reject ungrounded placeholder evidence and duplicate observed/uncertain text',()=>{
 const x=base();x.worlds.did.records['r-a']='원문 확인 필요';
 assert.equal(QA.validate(x).ok,false);
 const y=base();y.scene.uncertainty=y.scene.observed;
 assert.equal(QA.validate(y).ok,false);
});
