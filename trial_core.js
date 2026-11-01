/* THE VERDICT — trial engine core (v4).
 * Pure, deterministic calculations. No DOM, no storage, no globals.
 * Rules that must never break:
 *  - Public opinion is never read by proof (P/D) or legal-skill calculations.
 *  - The hidden truth only shapes observable signals (flaws, testimony); it is never scored.
 *  - Each decision is keyed: changing a decision replaces it, repeating it never stacks.
 */
(function(root){
'use strict';

const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const hash=s=>{let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
 h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0};
const unit=seed=>hash(seed)/4294967296;
const pick=(items,seed)=>items[hash(seed)%items.length];
const between=(lo,hi,seed)=>lo+hash(seed)%(hi-lo+1);

const TRUTHS=['did','didnt','reason'];
const FLAWS=['source','timing','illegal','none'];
const ATTITUDES=['honest','flip','protect','fear'];
const STYLES=['aggressive','delay','meticulous','media'];

const LABEL=Object.freeze({
 flaw:{source:'출처가 의심됨',timing:'시점이 안 맞음',illegal:'불법으로 얻음',none:'흠 없음'},
 attitude:{honest:'정직하지만 기억에 한계',flip:'말을 바꿀 수 있음',protect:'누군가를 감싸는 중',fear:'보복을 두려워함'},
 style:{aggressive:'공격형',delay:'지연형',meticulous:'꼼꼼형',media:'여론전형'},
 decision:{use:'쓴다',conditional:'조건 붙여 쓴다',exclude:'뺀다'}
});

/* Korean object particle after a title: 진단서를 / 기록을 */
function obj(w){const c=String(w||'').trim().slice(-1).charCodeAt(0);return w+(c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28?'을':'를')}
/* Legacy story engine truth → v4 truth. */
function truthFromStory(kind){return kind==='substantial'?'did':kind==='contradicted'?'didnt':kind==='partial'?'reason':null}

function minDays(importance){const i=clamp(importance,1,5);return i>=5?4:i>=4?3:2}
function twistChance(importance){return Math.round((0.10+0.01*clamp(importance,1,5))*100)/100}

/* Verdict direction from a case verdict option. Explicit IDs first, then the Korean label. */
function direction(option,kind){
 const id=String(option?.id||''),label=String(option?.label||'');
 const criminal=kind==='criminal';
 const table={guilty:'convict',notguilty:'acquit',not_guilty:'acquit',innocent:'acquit',acquit:'acquit',
  full:'claimant',refund:'claimant',dismiss:'respondent',partial:'partial',settled:'settled'};
 if(table[id])return criminal&&table[id]==='claimant'?'convict':table[id];
 if(/무죄|기각|불인정|면소|패소/.test(label)&&!/일부/.test(label))return criminal?'acquit':'respondent';
 if(/일부/.test(label))return 'partial';
 if(/유죄|인정|인용|반환|배상|징역|벌금|승소/.test(label))return criminal?'convict':'claimant';
 return criminal?'convict':'claimant';
}
/* +1 = the charge/claim side wins, -1 = the defence wins, 0.5 = partly. */
function sideOf(dir){return dir==='convict'||dir==='claimant'?1:dir==='partial'?0.5:dir==='settled'?0:-1}

/* Roll the hidden layer of one case. history = earlier rolled cases (newest last). */
function roll(c,seed,history=[]){
 const id=c.archetypeId||c.id;
 const recent=history.slice(-20).some(x=>x.archetypeId===id);
 const previous=[...history].reverse().find(x=>x.archetypeId===id);
 let truth=c.truth||pick(TRUTHS,seed+':truth');
 if(!c.truth&&previous&&previous.truth===truth)truth=TRUTHS[(TRUTHS.indexOf(truth)+1)%3];
 const flawOdds=truth==='didnt'?0.75:truth==='reason'?0.6:0.45;
 const evidence=(c.evidence||[]).map((e,i)=>{
  const s=seed+':ev:'+i,odds=e.hintFlaw==='none'?flawOdds*0.4:flawOdds,flawed=unit(s+':f')<odds;
  let flawType=flawed?pick(['source','timing','illegal'],s+':t'):'none';
  if(flawed&&e.hintFlaw&&e.hintFlaw!=='none')flawType=e.hintFlaw;
  // written cases: the evidence text already describes its weakness, so the hidden layer follows the text
  if(c.strict&&e.hintFlaw)flawType=e.hintFlaw;
  if(e.hintIllegal&&flawed)flawType='illegal';
  const strength=between(40,82,s+':s'),flaw=flawType==='none'?0:between(25,85,s+':size');
  const surface=flawType==='none'?strength:clamp(strength+between(12,28,s+':shine'),0,96);
  return {id:e.id,title:e.title,note:e.note||'',scope:e.scope||'',strength,flawType,flaw,surface,revealed:c.strict?2:0,decision:null,publicFlaw:false};
 });
 if(previous&&previous.truth===truth&&evidence[0]&&previous.firstFlaw===evidence[0].flawType){
  const e=evidence[0];e.flawType=FLAWS[(FLAWS.indexOf(e.flawType)+1)%FLAWS.length];e.flaw=e.flawType==='none'?0:Math.max(e.flaw,40);
  e.surface=e.flawType==='none'?e.strength:clamp(e.strength+20,0,96);
 }
 const witnesses=(c.witnesses||[]).map((w,i)=>{
  const s=seed+':w:'+i;
  return {id:w.id,role:w.role,knowledge:w.knowledge||'',interest:w.interest||'',attitude:pick(ATTITUDES,s+':a'),
   reliability:between(35,90,s+':r'),memory:between(30,90,s+':m'),revealed:0,asked:0,flipped:false};
 });
 return {v:4,archetypeId:id,repeated:recent,truth,evidence,witnesses,firstFlaw:evidence[0]?.flawType||'none'};
}

/* Revealing is staged: 0 = unknown (?), 1 = range, 2 = exact. */
function reveal(level){return Math.min(2,(Number(level)||0)+1)}
function rangeOf(value,seed){const lo=clamp(value-between(8,18,seed+':lo')),hi=clamp(value+between(8,18,seed+':hi'));return [Math.round(lo),Math.round(hi)]}

/* What a questioned witness signals. Depends on truth + attitude; never shows the truth itself. */
function testimony(w,truth){
 if(!w.asked)return {p:0,d:0,discord:0,kind:'none'};
 const rel=clamp(w.reliability)/100;
 const truthful=truth==='did'?{p:10*rel,d:0}:truth==='didnt'?{p:0,d:12*rel}:{p:4*rel,d:6*rel};
 if(w.attitude==='honest')return {...truthful,discord:0,kind:'truthful'};
 if(w.attitude==='fear')return w.asked>=2?{...truthful,discord:0,kind:'truthful'}:{p:0,d:2,discord:0,kind:'vague'};
 if(w.attitude==='protect'){const k=w.revealed>=2?0.3:1;return {p:0,d:8*k,discord:w.revealed>=2?1:0,kind:'shield'}}
 if(w.attitude==='flip')return w.flipped?{p:0,d:12,discord:1,kind:'flipped'}:{p:8,d:0,discord:0,kind:'first'};
 return {p:0,d:0,discord:0,kind:'none'};
}

/* Proof (P) and remaining doubt (D). Inputs: the trial state only. */
function gauge(t){
 let p=0,d=0,discord=0;
 for(const e of t.evidence){
  const known=e.revealed>=2?1:e.revealed===1?0.5:0,f=clamp(e.flaw)/100;
  if(e.decision==='use'){p+=e.strength*(1-f*known)*0.55;d+=f*known*30}
  else if(e.decision==='conditional'){p+=e.strength*(1-f*known*0.5)*0.4;d+=f*known*15}
  else if(e.decision==='exclude'){d+=6}
 }
 const heard=t.heard||[];
 // v5: what each answered question said counts; the old per-witness signal stays as a smaller background
 const k=heard.length?0.5:1;
 for(const w of t.witnesses){const s=testimony(w,t.truth);p+=s.p*k;d+=s.d*k;discord+=s.discord}
 for(const h of heard){if(h.struck)continue;const rel=clamp(t.witnesses[h.w]?.reliability??60)/100;
  if(h.side==='p')p+=6*rel;else if(h.side==='d')d+=7*rel;else if(h.side==='m'){p+=3*rel;d+=3.5*rel}}
 for(const i of new Set(heard.filter(h=>!h.struck).map(h=>h.issue))){const sides=new Set(heard.filter(h=>!h.struck&&h.issue===i).map(h=>h.side));if(sides.has('p')&&sides.has('d'))discord++}
 d+=discord*15;
 const P=Math.round(clamp(p)),D=Math.round(clamp(d));
 return {P,D,margin:P-D,discord};
}

/* Legal skill. Every entry is keyed so changing or repeating a decision never stacks. */
function skill(t,verdict){
 const items={};
 const add=(key,points,text)=>{items[key]={points,text}};
 for(const e of t.evidence){
  const known=e.revealed>=2,k='ev:'+e.id;
  if(!e.decision)continue;
  if(e.decision==='use'&&e.flawType==='illegal'&&known)add(k,-15,`불법으로 얻은 증거(${e.title})를 알고도 썼음`);
  else if(e.decision==='use'&&!known&&e.revealed<1)add(k,-5,`${e.title}의 흠을 확인하지 않고 썼음`);
  else if(e.decision==='use'&&known&&e.flaw>=60)add(k,-4,`큰 흠이 있는 ${obj(e.title)} 조건 없이 썼음`);
  else if(e.decision==='conditional'&&e.revealed>=1&&e.flawType!=='none'&&e.flawType!=='illegal')add(k,2,`${e.title}의 흠을 감안해 조건을 붙였음`);
  else if(e.decision==='exclude'&&e.flawType==='illegal'&&known)add(k,5,`불법으로 얻은 ${obj(e.title)} 뺐음`);
  else if(e.decision==='exclude'&&e.flawType==='none'&&known)add(k,-5,`흠 없는 ${obj(e.title)} 뺐음`);
  else if(e.decision==='exclude'&&e.revealed===0)add(k,-3,`${obj(e.title)} 확인 없이 뺐음`);
 }
 for(const c of t.cards||[]){
  if(!c.choice)continue;
  const k='card:'+c.id;
  if(c.type==='objection'){
   if(c.valid)add(k,c.choice==='accept'?3:-2,c.choice==='accept'?'정당한 이의를 받아들였음':'정당한 이의를 넘겼음');
   else add(k,c.choice==='reject'?2:-3,c.choice==='reject'?'근거 없는 이의를 넘겼음':'근거 없는 이의를 받아들였음');
  }
  if(c.type==='delay'){
   if(c.valid)add(k,c.choice==='accept'?2:-3,c.choice==='accept'?'필요한 준비 시간을 줬음':'정당한 미루기를 거절했음');
   else add(k,c.choice==='reject'?3:-2,c.choice==='reject'?'시간 끌기용 미루기를 거절했음':'시간 끌기에 응했음');
  }
 }
 if(verdict){
  const g=gauge(t),need=verdict.criminal?30:15,side=sideOf(verdict.dir);
  if(side===1)add('verdict',g.margin>=need?10:-20,g.margin>=need?'증거가 충분할 때 책임을 인정했음':'증거가 모자란데 책임을 인정했음');
  else if(side===-1)add('verdict',g.margin<need?10:g.margin>=need+25?-10:4,g.margin<need?'의문이 남아 책임을 인정하지 않았음':'증거가 충분한데 책임을 인정하지 않았음');
  else if(side===0.5)add('verdict',g.margin>=need-15&&g.margin<need+20?6:-5,'일부만 인정하는 판단');
  for(const r of verdict.reasons||[]){const fit=reasonFits(r,t,g);add('reason:'+r,fit?4:-4,fit?'판결 이유가 기록과 맞음':'판결 이유가 기록과 맞지 않음')}
  // v5: cited evidence and testimony must point the way the verdict goes
  (verdict.cites||[]).slice(0,3).forEach((c,i)=>{
   if(c.illegal){add('cite:'+i,-6,`불법으로 얻은 증거(${c.label})를 판결 근거로 삼았음`);return}
   if(c.struck){add('cite:'+i,-4,`이의가 받아들여진 진술(${c.label})을 근거로 삼았음`);return}
   const fit=side===0.5?true:side===1?c.side!=='d':c.side!=='p';
   add('cite:'+i,fit?3:-3,fit?`판결 근거가 결론과 맞음: ${c.label}`:`결론과 반대 방향의 자료를 근거로 들었음: ${c.label}`);
  });
  if(verdict.sentence){const s=verdict.sentence,lighter=s.value<s.lo,heavier=s.value>s.hi;
   if(!lighter&&!heavier)add('sentence',4,`${s.what}이 참고 범위 안에 있음`);
   else if((lighter&&s.mitig>0)||(heavier&&s.aggr>0))add('sentence',0,`${s.what}이 참고 범위를 벗어났지만 그 사유를 밝혔음`);
   else add('sentence',-4,`${s.what}이 사유 없이 참고 범위를 벗어남`);}
 }
 const total=Object.values(items).reduce((a,x)=>a+x.points,0);
 return {score:Math.round(clamp(60+total)),total,items:Object.entries(items).map(([key,v])=>({key,...v}))};
}

const REASONS=Object.freeze([
 ['strong','핵심 증거가 믿을 만하다'],
 ['flawed','핵심 증거에 흠이 있다'],
 ['illegal','불법으로 얻은 증거는 쓸 수 없다'],
 ['discord','증인 말이 서로 어긋난다'],
 ['consistent','증인 말이 증거와 맞는다'],
 ['doubt','아직 남은 의문이 크다']
]);
function reasonFits(id,t,g=gauge(t)){
 const used=t.evidence.filter(e=>e.decision==='use'||e.decision==='conditional');
 if(id==='strong')return used.some(e=>e.revealed>=1&&e.flaw<40)&&g.P>=45;
 if(id==='flawed')return t.evidence.some(e=>e.revealed>=1&&e.flawType!=='none');
 if(id==='illegal')return t.evidence.some(e=>e.flawType==='illegal'&&e.revealed>=2&&e.decision==='exclude');
 if(id==='discord')return g.discord>0;
 if(id==='consistent')return t.witnesses.some(w=>w.asked>=1&&testimony(w,t.truth).kind==='truthful'&&testimony(w,t.truth).p>0)&&g.discord===0;
 if(id==='doubt')return g.D>=35;
 return false;
}

/* Opponent cards for one trial day. Deterministic per case/day. */
function cards(t,day,seed){
 const out=[],style=t.style;
 const s=seed+':day:'+day;
 const objectionOdds=style==='aggressive'?0.9:style==='meticulous'?0.5:0.35;
 if(unit(s+':obj')<objectionOdds)out.push({id:'d'+day+'-obj',type:'objection',valid:unit(s+':objv')<(style==='meticulous'?0.75:0.45),choice:null});
 const delayOdds=style==='delay'?0.8:day>=2?0.2:0.1;
 if(unit(s+':del')<delayOdds)out.push({id:'d'+day+'-del',type:'delay',valid:unit(s+':delv')<(style==='delay'?0.25:0.7),choice:null});
 if(style==='media'&&unit(s+':med')<0.7)out.push({id:'d'+day+'-med',type:'media',valid:true,choice:'seen'});
 return out;
}

/* Public opinion. Reads only what the public can see: surface strength and flaws aired in open court. */
function pressStart(importance,{criminal=true,heatBonus=0}={}){
 const i=clamp(importance,1,5);
 return {H:Math.round(clamp(i*15+heatBonus)),O:criminal?15+i*5:5+i*2,S:30};
}
function pressDay(media,t,{twist=false,news=0,defenseMedia=0}={}){
 const shown=t.evidence.filter(e=>e.decision!=='exclude'||e.publicFlaw);
 const surface=shown.length?shown.reduce((a,e)=>a+(e.publicFlaw?e.strength*(1-e.flaw/100):e.surface),0)/shown.length:50;
 const aired=t.evidence.filter(e=>e.publicFlaw&&!e.airedCounted).length;
 const H=clamp(media.H*0.95+(twist?15:0)+news);
 const O=clamp(media.O+(surface-50)*0.25-defenseMedia-aired*10,-100,100);
 const S=clamp(media.S+(100-Math.abs(surface-50)*2)*0.04+aired*5+(twist?6:0));
 return {H:Math.round(H),O:Math.round(O),S:Math.round(S)};
}
/* How far the verdict sits from what the public wanted: 0 (opposite) … 100 (matched). */
function opinionMatch(O,dir){const side=sideOf(dir);return Math.round(clamp(50+side*O/2))}

const EVALUATORS=Object.freeze([
 {id:'professor',name:'법학 교수',bias:'절차'},
 {id:'senior',name:'선배 판사',bias:'균형'},
 {id:'reporter',name:'법조 기자',bias:'여론'}
]);
function evaluate(skillScore,match,t,dir,seed){
 const illegalExcluded=t.evidence.some(e=>e.flawType==='illegal'&&e.decision==='exclude');
 const scores=EVALUATORS.map(ev=>{
  let s=skillScore;
  if(ev.bias==='절차')s+=illegalExcluded?8:0;
  if(ev.bias==='여론')s=s*0.5+match*0.5;
  s+=between(-6,6,seed+':'+ev.id);
  return {...ev,score:Math.round(clamp(s))};
 });
 const disposition=scores.reduce((a,x)=>a+x.score,0)/scores.length;
 return {scores,review:Math.round(clamp(0.6*skillScore+0.2*match+0.2*disposition))};
}

const api=Object.freeze({LABEL,REASONS,EVALUATORS,STYLES,clamp,hash,unit,pick,between,
 truthFromStory,minDays,twistChance,direction,sideOf,roll,reveal,rangeOf,testimony,gauge,skill,reasonFits,cards,
 pressStart,pressDay,opinionMatch,evaluate});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.VerdictTrialCore=api;
})(typeof window!=='undefined'?window:globalThis);
