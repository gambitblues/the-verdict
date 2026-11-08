/* THE VERDICT — AI wording (v8.7, develop; v8.7.4 review fixes).
 * The engine decides everything; this file only asks THE VERDICT API (Cloudflare Worker) to re-word text the player
 * already sees: a witness's answer, the first-hearing and closing statements, a filed objection and reply, the
 * sentences of a judgment. The engine's text is shown at once; when a better-worded version arrives it
 * replaces the display. Any failure (offline, not signed in, a check failed on the server, daily limit) simply leaves
 * the engine's text in place and is remembered, so the same text is not asked for again and again.
 * Nothing hidden (the case's truth, a witness's hidden attitude, scores) is ever sent.
 * Results are kept in the save so a reload shows the same words without a new call. */
(()=>{
'use strict';
const CFG=window.VERDICT_CONFIG||{};
const on=()=>CFG.ai!==false&&!!window.VerdictAuth?.user&&!!window.VerdictAuth?.online&&!!CFG.apiBase;
/* the people of this case, so the server can check that nobody was added, dropped or swapped */
const namesOf=(c,t)=>[...new Set([...(c?.who||[]),...(c?.side||[]),...(t?.witnesses||[]).map(w=>w.id),t?.opponent].map(id=>NPC[id]?.name).filter(n=>n&&n.length>=2))];
const busy=new Set(),failed=new Set(),started=new Map();   // started: when a request began (for a short wait before showing)   // failed: asked in this visit and refused/failed — not asked again until reload
const redraw=()=>{try{if(!ui.modal&&!document.activeElement?.matches?.('input,textarea,select'))render()}catch{}};   // never wipe what the player is typing
async function ask(kind,body){
 try{const r=await window.VerdictAuth.api('/ai/'+kind,body);return r?.ok?r.result:null}catch{return null}
}
const fp=s=>{s=String(s||'');let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return s.length.toString(36)+(h>>>0).toString(36)};

/* A witness's answer. Key "<witness>:<question>:<side>" in t.ai. Only the manner the player can already see is sent:
 * a witness who has visibly changed their story sounds shaken; everyone else answers plainly. The hidden attitude
 * (honest / protecting someone / afraid / about to change their story) stays in the engine.
 * 2026-11-08: asked BEFORE the question is put (prefetch), only for answers the engine assembles from a case sheet's
 * notes; the courtroom shows the AI wording only if it is already here when the witness answers — never swapped later.
 * The witness's age, job and tie to the case go along so each person sounds like themselves. */
async function npc(c,t,x){
 if(!on())return;const key=x.w+':'+x.q+':'+(x.side||'n'),id=c.id+key;
 if(t.ai?.[key]||busy.has(id)||failed.has(id))return;busy.add(id);
 const w=t.witnesses[x.w];
 // Public case context only. Never send the hidden truth, credibility score or private NPC memories.
 const context={
  caseName:String(c.name||'').slice(0,120),
  issue:String(c.story?.publicDossier?.plea||c.story?.publicDossier?.situation||c.tag||'').slice(0,240),
  witnessName:String(NPC[w?.id]?.name||w?.name||'').slice(0,50),
  witnessKnowledge:String(w?.knowledge||w?.story||'').slice(0,220),
  witnessInterest:String(w?.interest||'').slice(0,160),
  age:(()=>{const p=NPC[w?.id];const y=typeof year==='function'?year():0;return p?.bornYear&&y?String(y-p.bornYear):''})(),
  job:String(NPC[w?.id]?.career||NPC[w?.id]?.job||'').slice(0,60),
  previousAnswers:(t.heard||[]).filter(h=>h.w===x.w&&!h.struck&&!h.tainted)
   .slice(-2).map(h=>({question:String(h.label||'').slice(0,140),answer:String(h.text||'').slice(0,220)}))
 };
 try{const res=await ask('npc',{role:w?.role||'증인',attitude:w?.flipped?'flip':'honest',names:namesOf(c,t),question:x.question,answer:x.answer,...context});
  if(res?.text){(t.ai??={})[key]=res.text;save()}else failed.add(id)}   // not shown until the question is asked: no redraw
 finally{busy.delete(id)}
}

/* first-hearing statements / closing statements: one request each for both sides; a failed try is kept in the save */
/* 2026-11-08: the courtroom waits a moment for these before showing them; if they are shown in the engine's words first,
 * that version is locked (t[field+'Lock']) and a late answer is dropped — the statement never changes on screen. */
async function pair(kind,field,c,t,a,b){
 if(!on()||!c?.id||!a||!b)return false;
 const key=c.id+':'+a+':'+b;
 if(t[field]?.source===key||(t.aiTried??={})[field]===fp(key)||busy.has(kind+key)||t[field+'Lock']===key)return false;
 busy.add(kind+key);started.set(kind+key,Date.now());
 try{const res=await ask(kind,{openingA:a,openingB:b,names:namesOf(c,t)});
  if(!res?.openingA||!res?.openingB||t[field+'Lock']===key){t.aiTried[field]=fp(key);save();return false}
  t[field]={source:key,openingA:res.openingA,openingB:res.openingB};save();redraw();return true}
 finally{busy.delete(kind+key);started.delete(kind+key)}
}
/* still worth waiting for? (a request in flight that began less than `ms` ago) */
const waiting=(id,ms)=>busy.has(id)&&Date.now()-(started.get(id)||0)<ms;
const opening=(c,t,a,b)=>pair('opening','aiOpening',c,t,a,b);
const closing=(c,t,a,b)=>pair('closing','aiClosing',c,t,a,b);

/* on-demand (the player taps '양측 말 더 듣기'): an already-filed objection and reply */
async function exchange(c,t,id,a,b){
 if(!on()||!c?.id||!id||!a||!b)return false;
 const key=c.id+':'+id+':'+a+':'+b;
 if(t.aiExchange?.[id]?.source===key)return true;
 if(busy.has(key)||failed.has(key))return false;
 busy.add(key);
 try{const res=await ask('exchange',{openingA:a,openingB:b,names:namesOf(c,t)});
  if(!res?.openingA||!res?.openingB){failed.add(key);return false}
  (t.aiExchange??={})[id]={source:key,openingA:res.openingA,openingB:res.openingB};save();redraw();return true}
 finally{busy.delete(key)}
}

/* the written judgment after the sentence: the order (주문) and the excluded material are never sent or changed */
async function judgment(c,t){
 const j=t?.final?.judgment;if(!on()||!j||t.final.judgmentAI||t.final.judgmentAITried||t.final.judgmentLock||busy.has('j'+c.id))return;busy.add('j'+c.id);started.set('j'+c.id,Date.now());
 try{const res=await ask('judgment',{names:namesOf(c,t),facts:j.facts,issues:j.issues,conclusion:j.conclusion});
  if(res?.facts&&!t.final.judgmentLock){t.final.judgmentAI={...j,facts:res.facts,issues:res.issues,conclusion:res.conclusion};save();redraw()}
  else{t.final.judgmentAITried=true;save()}}   // a judgment is worded once or never; the engine text stays as the record
 finally{busy.delete('j'+c.id);started.delete('j'+c.id)}
}

window.VerdictAI={npc,judgment,opening,closing,exchange,
 waitOpening:key=>waiting('opening'+key,6000),waitClosing:key=>waiting('closing'+key,6000),waitJudgment:id=>waiting('j'+id,15000),
 get on(){return on()}};
})();
