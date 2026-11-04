import test from 'node:test';
import assert from 'node:assert/strict';
import {panelStatus,validBallot} from '../src/p5_joint_panel.js';
const hash='a'.repeat(64);
const vote=(seat,choice)=>({seat,choice,evidenceHash:hash});
test('two judges + NPC: private ballots remain sealed until all 3 cast',()=>{
 const a=vote('chair','guilty'),b=vote('peer','acquittal'),c=vote('npc','guilty');
 assert.deepEqual(panelStatus('criminal',[a],'chair'),{
  state:'deliberating',votesCast:1,myVote:'guilty',pending:['peer','npc'],majority:null
 });
 const peer=panelStatus('criminal',[a,b],'peer');
 assert.equal(peer.myVote,'acquittal');
 assert.equal(peer.majority,null);
 assert.ok(!Object.hasOwn(peer,'tally'));
 const result=panelStatus('criminal',[a,b,c],'chair');
 assert.equal(result.state,'majority_ready');
 assert.equal(result.majority,'guilty');
 assert.equal(result.tally.guilty,2);
});
test('three different positions cannot be forced to a majority',()=>{
 const result=panelStatus('civil',[
  vote('chair','claim_granted'),vote('peer','claim_denied'),vote('npc','partial')
 ],'chair');
 assert.equal(result.state,'further_deliberation');
 assert.equal(result.majority,null);
});
test('duplicate seats, tampered hashes and outside viewers fail',()=>{
 assert.equal(validBallot('criminal',vote('npc','guilty')),true);
 assert.equal(panelStatus('criminal',[vote('chair','guilty'),vote('chair','guilty')],'chair').error,'invalid_ballot');
 assert.equal(panelStatus('criminal',[vote('chair','claim_granted')],'chair').error,'invalid_ballot');
 assert.equal(panelStatus('criminal',[],'outsider').error,'not_panel_member');
});
