// P5 joint bench: private ballots are hidden until all three seats submit.
export const SEATS=['chair','peer','npc'];
const CHOICES={
 criminal:['guilty','acquittal','partial'],
 civil:['claim_granted','claim_denied','partial','settled'],
 decision:['decision_yes','decision_no']
};
export const RANK={acquittal:0,claim_denied:0,decision_no:0,settled:1,decision_yes:1,partial:2,guilty:3,claim_granted:3};
export function validBallot(kind,ballot){
 return !!(ballot&&SEATS.includes(ballot.seat)&&
  CHOICES[kind]?.includes(ballot.choice)&&
  /^[a-f0-9]{64}$/.test(ballot.evidenceHash||''));
}
export function panelStatus(kind,ballots,viewer){
 if(!SEATS.includes(viewer))return {error:'not_panel_member'};
 if(!Array.isArray(ballots))return {error:'invalid_ballots'};
 const votes=new Map();
 for(const ballot of ballots){
  if(!validBallot(kind,ballot)||votes.has(ballot.seat))
   return {error:'invalid_ballot'};
  votes.set(ballot.seat,ballot);
 }
 const own=votes.get(viewer)?.choice||null;
 if(votes.size<3)return {
  state:'deliberating',votesCast:votes.size,myVote:own,
  pending:SEATS.filter(seat=>!votes.has(seat)),majority:null
 };
 const counts=new Map();
 for(const b of votes.values())counts.set(b.choice,(counts.get(b.choice)||0)+1);
 const sorted=[...counts].sort((a,b)=>b[1]-a[1]);
 if(sorted[0][1]>=2)return {state:'majority_ready',votesCast:3,myVote:own,majority:sorted[0][0],rule:'majority',tally:Object.fromEntries(sorted)};
 /* v8.7.4 법원조직법 66②: three different opinions — add from the one most favourable to the defendant (civil: the
  * smallest award) until two agree; the second one completes the majority. Same rule as SQL shared_joint_outcome. */
 const middle=[...votes.values()].sort((a,b)=>RANK[a.choice]-RANK[b.choice]||a.seat.localeCompare(b.seat))[1].choice;
 return {state:'majority_ready',votesCast:3,myVote:own,majority:middle,rule:'article66',tally:Object.fromEntries(sorted)};
}
