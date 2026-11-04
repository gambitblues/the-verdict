import test from 'node:test';
import assert from 'node:assert/strict';
import {adjudicateSentence} from '../src/shared_sentence.js';
const criminal={card:{kind:'criminal',charge:{name:'업무상과실',min:0,max:10,fine:10000,both:'may'}}};
const civil={card:{kind:'civil',claim:{amount:2700,fair:[1000,2000]}}};
test('P4 criminal sentence follows case charge not invented model legal limits',()=>{
 const valid=adjudicateSentence(criminal,'guilty',{type:'prison',months:24});
 assert.equal(valid.ok,true);
 assert.match(valid.order,/징역 2년/);
 assert.equal(valid.sentence.months,24);
 assert.equal(adjudicateSentence(criminal,'guilty',{type:'prison',months:200}).error,'prison_months_out_of_range');
 assert.equal(adjudicateSentence(criminal,'guilty',{type:'prison',months:13}).error,'prison_months_out_of_range');
 assert.equal(adjudicateSentence(criminal,'guilty',{type:'suspend',months:48,susp:2}).error,'suspension_out_of_range');
 assert.equal(adjudicateSentence(criminal,'guilty',{type:'death'}).error,'sentence_type_not_allowed');
 assert.equal(adjudicateSentence(criminal,'guilty',{type:'fine',fine:123}).error,'fine_out_of_range');
 assert.equal(adjudicateSentence(criminal,'guilty',{type:'prison',months:24,mitigating:true}).error,'mitigation_not_supported_by_evidence');
});
test('P4 monetary sentence never exceeds damages claimed',()=>{
 const full=adjudicateSentence(civil,'claim_granted',{amount:2700});
 assert.equal(full.ok,true);
 assert.match(full.order,/2,700만 원/);
 assert.equal(adjudicateSentence(civil,'claim_granted',{amount:2701}).error,'claim_amount_invalid');
 assert.equal(adjudicateSentence(civil,'partial',{amount:2700}).error,'claim_amount_invalid');
 assert.equal(adjudicateSentence(civil,'partial',{amount:1500}).ok,true);
 assert.equal(adjudicateSentence(civil,'claim_denied').kind,'none');
});
test('P4 criminal mandatory fine and grounded mitigation',()=>{
 const sheet={card:{kind:'criminal',charge:{
  min:2,max:4,fine:4000,both:'must',mitigationCitations:['initial:r1']
 }}};
 const good=adjudicateSentence(sheet,'guilty',{
  type:'prison',months:12,fine:400,mitigating:true
 },['initial:r1']);
 assert.equal(good.ok,true);
 assert.match(good.order,/벌금 400만 원/);
 assert.equal(adjudicateSentence(sheet,'guilty',{
  type:'prison',months:12,fine:400,mitigating:true
 },['initial:r2']).error,'mitigation_not_supported_by_evidence');
 assert.equal(adjudicateSentence(sheet,'guilty',{
  type:'prison',months:24
 }).error,'required_fine_invalid');
});
