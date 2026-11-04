// P5 joint bench: private ballots are hidden until all three seats submit.
export const SEATS=['chair','peer','npc'];
const CHOICES={
 criminal:['guilty','acquittal','partial'],
 civil:['claim_granted','claim_denied','partial','settled'],
 decision:['decision_yes','decision_no']
};
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
 return {
  state:sorted[0][1]>=2?'majority_ready':'further_deliberation',
  votesCast:3,myVote:own,majority:sorted[0][1]>=2?sorted[0][0]:null,
  tally:Object.fromEntries(sorted)
 };
}
