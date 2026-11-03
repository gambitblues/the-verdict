/* THE VERDICT — AI wording (v8.7, develop).
 * The engine decides everything; this file only asks THE VERDICT API (Cloudflare Worker) to re-word text the player
 * already sees: a witness's answer, a reporter's article, the sentences of a judgment. The engine's text is shown at
 * once; when a better-worded version arrives it replaces the display. Any failure (offline, not signed in, a check
 * failed on the server, daily limit) simply leaves the engine's text in place. Nothing hidden (the case's truth,
 * scores) is ever sent. Results are kept in the save so a reload shows the same words without a new call. */
(()=>{
'use strict';
const CFG=window.VERDICT_CONFIG||{};
const on=()=>CFG.ai!==false&&!!window.VerdictAuth?.user&&!!window.VerdictAuth?.online&&!!CFG.apiBase;
/* the people of this case, so the server can check that nobody was added, dropped or swapped */
const namesOf=(c,t)=>[...new Set([...(c?.who||[]),...(c?.side||[]),...(t?.witnesses||[]).map(w=>w.id),t?.opponent].map(id=>NPC[id]?.name).filter(n=>n&&n.length>=2))];
const busy=new Set();
const redraw=()=>{try{if(!ui.modal)render()}catch{}};
async function ask(kind,body){
 try{const r=await window.VerdictAuth.api('/ai/'+kind,body);return r?.ok?r.result:null}catch{return null}
}

/* a witness's answer: key "<witness index>:<question id>" in t.ai */
async function npc(c,t,x){
 if(!on())return;const key=x.w+':'+x.q;if(t.ai?.[key]||busy.has(c.id+key))return;busy.add(c.id+key);
 const w=t.witnesses[x.w];
 const res=await ask('npc',{role:w?.role||'증인',attitude:w?.attitude||'honest',names:namesOf(c,t),question:x.question,answer:x.answer});
 busy.delete(c.id+key);
 if(res?.text){(t.ai??={})[key]=res.text;save();redraw()}
}

/* P1: both first-hearing arguments share one low-cost request; already disclosed text only.
 * The original engine text stays visible while AI runs and on any verification failure. */
const openingAttempted=new Set();
async function opening(c,t,openingA,openingB){
 if(!on()||!c?.id||!openingA||!openingB)return;
 const key=c.id+':'+openingA+':'+openingB;
 if(t.aiOpening?.source===key||openingAttempted.has(key))return;
 openingAttempted.add(key);
 const res=await ask('opening',{openingA,openingB,names:namesOf(c,t)});
 if(!res?.openingA||!res?.openingB)return;
 t.aiOpening={source:key,openingA:res.openingA,openingB:res.openingB};
 save();redraw();
}

/* P1: on-demand wording of an already-filed objection and response.
 * Keys include the original text so changed filings never reuse stale wording. */
const exchangeBusy=new Set();
async function exchange(c,t,id,openingA,openingB){
 if(!on()||!c?.id||!id||!openingA||!openingB)return false;
 const key=c.id+':'+id+':'+openingA+':'+openingB;
 if(t.aiExchange?.[id]?.source===key)return true;
 if(exchangeBusy.has(key))return false;
 exchangeBusy.add(key);
 try{
  const res=await ask('exchange',{openingA,openingB,names:namesOf(c,t)});
  if(!res?.openingA||!res?.openingB)return false;
  (t.aiExchange??={})[id]={source:key,openingA:res.openingA,openingB:res.openingB};
  save();redraw();return true;
 }finally{exchangeBusy.delete(key)}
}

/* P1: final pleas use one verified request for both original sides. */
const closingAttempted=new Set();
async function closing(c,t,openingA,openingB){
 if(!on()||!c?.id||!openingA||!openingB)return;
 const key=c.id+':'+openingA+':'+openingB;
 if(t.aiClosing?.source===key||closingAttempted.has(key))return;
 closingAttempted.add(key);
 const res=await ask('closing',{openingA,openingB,names:namesOf(c,t)});
 if(!res?.openingA||!res?.openingB)return;
 t.aiClosing={source:key,openingA:res.openingA,openingB:res.openingB};
 save();redraw();
}

/* P1 bench note: invoked only by the judge's button, never by tab navigation. */
const benchBusy=new Set();
async function bench(c,t,source){
 if(!on()||!c?.id||!source)return false;
 const key=c.id+':'+source;
 if(t.aiBench?.source===source)return true;
 if(benchBusy.has(key))return false;
 benchBusy.add(key);
 try{
  const res=await ask('bench',{source,names:namesOf(c,t)});
  if(!res?.text)return false;
  t.aiBench={source,text:res.text};
  save();redraw();return true;
 }finally{benchBusy.delete(key)}
}

/* a reporter's article, asked for when the player opens it; kept in S.aiArticles by case, article and phase */
async function article(a){
 if(!on()||!a?.caseId)return;const key=`${a.caseId}:${a.index}:${a.phase||''}`;
 if(S.aiArticles?.[key]||busy.has(key))return;busy.add(key);
 const c=CASES.find(x=>x.id===a.caseId);
 const res=await ask('article',{outlet:a.outlet,reporter:a.reporter?.name||'',style:a.reporter?.style||'',lean:a.lean||'',phase:a.phase,tone:a.tone||'',
  caseName:String(c?.name||'').split(' · ')[0],names:namesOf(c,S.cases[a.caseId]?.trial4),title:a.base?.title||a.title,body:a.base?.body||a.body});
 busy.delete(key);
 if(res?.title&&res?.body){S.aiArticles??={};S.aiArticles[key]={title:res.title,body:res.body};
  const ks=Object.keys(S.aiArticles);if(ks.length>120)delete S.aiArticles[ks[0]];save();redraw()}
}
const articleKey=a=>`${a.caseId}:${a.index}:${a.phase||''}`;

/* the written judgment after the sentence: the order (주문) and the excluded material are never sent or changed */
async function judgment(c,t){
 const j=t?.final?.judgment;if(!on()||!j||t.final.judgmentAI||busy.has('j'+c.id))return;busy.add('j'+c.id);
 const res=await ask('judgment',{names:namesOf(c,t),facts:j.facts,issues:j.issues,conclusion:j.conclusion});
 busy.delete('j'+c.id);
 if(res?.facts){t.final.judgmentAI={...j,facts:res.facts,issues:res.issues,conclusion:res.conclusion};save();redraw()}
}

window.VerdictAI={npc,article,articleKey,judgment,opening,closing,exchange,bench,get on(){return on()}};
})();
