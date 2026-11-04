import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedMotions,publicSharedMotions,sharedMotionDecision} from '../src/shared_motions.js';
const sheet={format:'verdict-world-sheet/v1',card:{kind:'civil',opponentStyle:'aggressive'}};
test('native motion cards are deterministic and only public data exposed',()=>{
 const first=sharedMotions(sheet,'case-p5-motions',1);
 assert.deepEqual(first,sharedMotions(sheet,'case-p5-motions',1));
 assert.ok(first.every(x=>['objection','delay'].includes(x.type)));
 const publicCards=publicSharedMotions(sheet,'case-p5-motions',1);
 assert.deepEqual(publicCards.map(x=>x.id),first.map(x=>x.id));
 assert.ok(publicCards.every(x=>!Object.hasOwn(x,'valid')),'hidden validity must not be sent to judge UI');
 assert.deepEqual(sharedMotions({format:'old'},'case-p5-motions',1),[]);
});
test('court motion choices are server-derived; invalid request never invents a result',()=>{
 let found=null;
 for(let d=1;d<=12;d++){
  const motions=sharedMotions(sheet,'case-p5-motions',d);
  if(motions.length){found={motion:motions[0],d};break}
 }
 assert.ok(found);
 const {motion,d}=found;
 const chosen=sharedMotionDecision(sheet,'case-p5-motions',d,motion.id,'accept');
 assert.equal(chosen.response.valid,motion.valid);
 assert.equal(chosen.response.type,motion.type);
 assert.equal(chosen.response.status,'done');
 assert.equal(sharedMotionDecision(sheet,'case-p5-motions',d,motion.id,'invalid').error,'motion_choice_invalid');
 assert.equal(sharedMotionDecision(sheet,'case-p5-motions',d,'d1-fake','accept').error,'motion_not_available');
});
