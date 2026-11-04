'use strict';
const assert=require('node:assert/strict');
const {evaluate,advanceEvaluations,REVIEW_WEEKS}=require('../career_balance.js');
assert.equal(REVIEW_WEEKS,39);
const state={week:38,journal:[],cases:{
 a:{verdict:'guilty',closedWeek:7,trial4:{daysDone:4,evidence:[{decision:'use'}],final:{review:91,judgment:{issues:[{title:'쟁점'}]}}}},
 b:{verdict:'acquittal',closedWeek:19,trial4:{daysDone:3,evidence:[{decision:'exclude'}],final:{review:78,judgment:{issues:[{title:'쟁점'}]}}}},
 c:{verdict:null,closedWeek:null},
 d:{verdict:'claim_granted',closedWeek:41,trial4:{final:{review:10}}}
}};
assert.equal(advanceEvaluations(state,38).length,0,'no early evaluation');
const first=advanceEvaluations(state,39);
assert.equal(first.length,1);
assert.equal(first[0].caseCount,2,'only finalised cases within the period');
assert.equal(first[0].rating,'우수');
assert.equal(first[0].reasonedCases,2);
assert.equal(state.careerReviews[0].internalAverage,84.5);
assert.equal(state.journal.length,1);
assert.equal(advanceEvaluations(state,39).length,0,'idempotent on reload');
assert.equal(state.journal.length,1,'no duplicate career events');
assert.equal(advanceEvaluations(state,78).length,1);
assert.deepEqual(state.careerReviews[1].caseIds,['d'],'next period must not borrow previous case');
assert.equal(advanceEvaluations(state,156).length,2,'catch up skipped periods once');
assert.equal(state.careerReviews.length,4);
const empty=evaluate({cases:{}},1);
assert.equal(empty.rating,'평가 보류');
assert.equal(empty.internalAverage,null);
console.log('PASS 9-month career ledger: cutoff, immutable periods, catch-up, no premature evaluation');
