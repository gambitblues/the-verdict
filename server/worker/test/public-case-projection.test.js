import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCaseSheet} from '../src/public_case_projection.js';

const sheet={
 format:'verdict-world-sheet/v1',id:'case-p4',status:'draft',
 card:{kind:'criminal',category:'public',title:'공개 사건',summary:'공소 요지',charge:{name:'사기',law:'형법',min:0,max:5,secret:'SECRET_CHARGE'}},
 common:{date:'2026-11-04',timeline:[{at:'10:00',what:'공개된 사실',sealed:'SECRET_TIMELINE'}],facts:['공개 사실']},
 people:[{key:'A',name:'김가람',role:'피고인',age:35,job:'회사원',traits:{secrecy:'SECRET_TRAITS'},hidden:'SECRET_PERSON'}],
 records:[{id:'r1',title:'제출된 계좌 내역',first:true,by:'검찰',result:{did:'SECRET_RECORD'}}],
 questions:[{id:'q1',w:'A',q:'어디에 계셨습니까?',a:{did:'SECRET_ANSWER'}}],
 orders:[{record:'r1',ask:'자료를 제출해 주세요.',result:{did:'SECRET_ORDER'}}],
 worlds:{did:{act:'SECRET_WORLD_DID'},didnt:{act:'SECRET_WORLD_DIDNT'},reason:{act:'SECRET_WORLD_REASON'}},
 traps:['SECRET_TRAPS'],verification:{secret:'SECRET_VERIFY'},hiddenTruth:'SECRET_TRUTH'
};
test('P4 assigned case projection exposes public courtroom fields only',()=>{
 const publicData=publicCaseSheet(sheet,'case-p4');
 assert.equal(publicData.card.title,'공개 사건');
 assert.equal(publicData.records[0].title,'제출된 계좌 내역');
 const serialized=JSON.stringify(publicData);
 assert.ok(!serialized.includes('SECRET_'),'sealed truth or future answers leaked');
 for(const k of ['worlds','traps','verification','hiddenTruth','status'])assert.ok(!Object.hasOwn(publicData,k));
 assert.ok(!Object.hasOwn(publicData.questions[0],'a'));
 assert.ok(!Object.hasOwn(publicData.orders[0],'result'));
 assert.ok(!Object.hasOwn(publicData.people[0],'traits'));
 assert.deepEqual(publicData.common.timeline,[{at:'10:00',what:'공개된 사실'}]);
});
test('P4 rejects malformed source and mismatched case identity',()=>{
 assert.throws(()=>publicCaseSheet({...sheet,id:'other-id'},'case-p4'),/invalid_sheet/);
 assert.throws(()=>publicCaseSheet({...sheet,format:'unknown'},'case-p4'),/invalid_sheet/);
});
