/* THE VERDICT v3.2 — deterministic trial model.
 * Pure calculations: no DOM, no storage, no world state. Imported as window.VerdictTrialCore.
 * Public opinion is deliberately absent from proof and legal-skill calculations.
 */
(function(root){
'use strict';
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const hash=s=>{let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h>>>0};
const choose=(items,seed)=>items[hash(seed)%items.length];
const TRUTHS=['did','didnt','reason'];
const FLAWS=['source','timing','illegal','none'];
const ATTITUDES=['honest','flip','protect','fear'];
const STYLES=['aggressive','delay','meticulous','media'];
function roll(archetype,seed,history=[]){
 const id=archetype.id||archetype.archetypeId;
 if(!id)throw Error('Missing archetype ID');
 if(history.slice(-20).some(x=>(x.archetypeId||x.id)===id))return null;
 const previous=[...history].reverse().find(x=>(x.archetypeId||x.id)===id);
 const truthPool=TRUTHS.filter(x=>!previous||x!==(previous.rolled?.truth||previous.truth));
 const truth=choose(truthPool,seed+':truth:'+id);
 const flaw=choose(FLAWS,seed+':flaw:'+id);
 const attitudes={};
 for(const w of (archetype.witnesses||[]))attitudes[w.id||w.role]=choose(ATTITUDES,seed+':w:'+id+':'+(w.id||w.role));
 const flaws={};
 for(const e of (archetype.evidence||[]))flaws[e.id]=choose(e.flawPool?.length?e.flawPool:FLAWS,seed+':e:'+id+':'+e.id);
 if(previous&&previous.rolled?.truth===truth){const first=archetype.evidence?.[0];if(first&&flaws[first.id]===previous.rolled.flaws?.[first.id])flaws[first.id]=FLAWS[(FLAWS.indexOf(flaws[first.id])+1)%FLAWS.length]}
 return {archetypeId:id,rolled:{truth,flaws,attitudes,style:choose(STYLES,seed+':style:'+id)},seed:String(seed),revealed:{},decisions:[],gauge:{P:0,D:0},skill:0};
}
function reveal(state,key){
 state.revealed??={};
 const next=clamp((state.revealed[key]||0)+0.5,0,1);
 state.revealed[key]=next;return next;
}
function gauge(evidence,discordance=0,gaps=0,k=1){
 let proof=0,doubt=clamp(discordance,0,999)*15+clamp(gaps,0,100);
 for(const e of evidence){
  if(!e.admitted)continue;
  const s=clamp(e.strength),f=clamp(e.flaw)/100,r=clamp(e.revealed,0,1);
  proof+=s*(1-f*r);doubt+=f*r*40;
 }
 return {P:Math.round(clamp(proof*Math.max(0,Number(k)||0))),D:Math.round(clamp(doubt)),margin:Math.round(clamp(proof*Math.max(0,Number(k)||0))-clamp(doubt))};
}
function decisionScore(decisions,proofMargin,verdict){
 let score=0;
 for(const d of decisions){
  if(d.kind==='evidence'&&d.action==='use'&&d.flawType==='illegal'&&d.flawKnown)score-=15;
  if(d.kind==='evidence'&&d.action==='use'&&d.core&&!d.flawKnown)score-=5;
  if(d.kind==='objection'&&d.leading&&d.action==='accept')score+=3;
  if(d.kind==='delay'&&d.baseless&&d.action==='reject')score+=3;
 }
 if(verdict==='guilty'||verdict==='not_guilty')score+=(proofMargin>=30)===(verdict==='guilty')?10:-20;
 return score;
}
function pressStart(importance=1,bonus=0,opinion=0,split=30){
 return {H:clamp(clamp(importance,1,5)*15+bonus),O:clamp(opinion,-100,100),S:clamp(split)};
}
function pressAdvance(media,{surface=0,publicFlaw=false,news=0,twist=false,defenseMedia=0}={}){
 const H=clamp(media.H*.95+(twist?15:0)+news);
 const O=clamp(media.O+(clamp(surface)-50)*.12-defenseMedia-(publicFlaw?18:0),-100,100);
 const S=clamp(media.S+(100-Math.abs(clamp(surface)-50)*2)*.04+(publicFlaw?5:0));
 return {H:Math.round(H),O:Math.round(O),S:Math.round(S)};
}
function review(legalSkill,opinionMatch,evaluatorDisposition){
 return Math.round(clamp(.6*clamp(legalSkill)+.2*clamp(opinionMatch)+.2*clamp(evaluatorDisposition)));
}
const api=Object.freeze({roll,reveal,gauge,decisionScore,pressStart,pressAdvance,review,twistChance:importance=>Math.min(.20,.10+.01*clamp(importance,1,5)),hash});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.VerdictTrialCore=api;
})(typeof window!=='undefined'?window:globalThis);
