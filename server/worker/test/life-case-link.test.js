import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const file=fileURLToPath(new URL('../../../story_engine.js',import.meta.url));
const context={};vm.runInNewContext(readFileSync(file,'utf8')+';this.StoryEngine=StoryEngine;',context,{filename:file});
const E=context.StoryEngine;
const bp=kind=>({kind,key:'contract',titles:['계약 분쟁'],premises:['계약 내용을 둘러싼 다툼이 있었다.'],
 docs:['계약서','거래 기록','이메일'],tag:kind==='civil'?'생활·민사':'형사·기타',legal:'계약 분쟁',importance:2,icon:'📄'});
function build(kind,lifeActorId){
 let k=0;
 const people={returning:{name:'돌아온 인물',role:'회사원',career:'기술직',wealth:40},
  counsel1:{name:'변호사 1',role:'변호사',wealth:50},counsel2:{name:'변호사 2',role:'변호사',wealth:50}};
 const makeNPC=role=>{const id='new'+(++k);people[id]={name:id,role,career:role,wealth:50};return id};
 return E.build({caseId:'test-life-'+kind,blueprint:bp(kind),instance:0,loc:'서울',now:'2028-01-01',week:100,
  r:()=>.4,makeNPC,oldCriminal:null,lifeActorId,priorDecision:null,
  prosecutorPool:['counsel1'],counselPool:['counsel1','counsel2'],people});
}
test('real returning civil claimant appears as a party, not merely an unrelated metadata link',()=>{
 const c=build('civil','returning');
 assert.equal(c.who[0],'returning');
 assert.equal(c.story.roleA,'returning');
 assert.equal(c.qa.pass,true,c.qa.errors?.join(', '));
});
test('life background never supplies guilt, proof, or a new criminal defendant',()=>{
 const withLife=build('civil','returning'),without=build('civil',null);
 assert.equal(withLife.story.privateTruth.kind,without.story.privateTruth.kind);
 assert.equal(withLife.story.proofStrength,without.story.proofStrength);
 assert.equal(withLife.qa.pass,true);
 const criminal=build('criminal','returning');
 assert.notEqual(criminal.who[0],'returning');
 assert.equal(criminal.qa.pass,true,criminal.qa.errors?.join(', '));
});
