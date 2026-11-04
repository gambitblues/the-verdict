/* THE VERDICT — AI wording (v8.7, develop; v8.7.4 review fixes).
 * The engine decides everything; this file only asks THE VERDICT API (Cloudflare Worker) to re-word text the player
 * already sees: a witness's answer, the first-hearing and closing statements, a filed objection and reply, a reporter's
 * article, the sentences of a judgment. The engine's text is shown at once; when a better-worded version arrives it
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
const busy=new Set(),failed=new Set();   // failed: asked in this visit and refused/failed — not asked again until reload
const redraw=()=>{try{if(!ui.modal&&!document.activeElement?.matches?.('input,textarea,select'))render()}catch{}};   // never wipe what the player is typing
async function ask(kind,body){
 try{const r=await window.VerdictAuth.api('/ai/'+kind,body);return r?.ok?r.result:null}catch{return null}
}
const fp=s=>{s=String(s||'');let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return s.length.toString(36)+(h>>>0).toString(36)};

/* A witness's answer. Key "<witness>:<question>:<side>" in t.ai. Only the manner the player can already see is sent:
 * a witness who has visibly changed their story sounds shaken; everyone else answers plainly. The hidden attitude
 * (honest / protecting someone / afraid / about to change their story) stays in the engine. */
async function npc(c,t,x){
 if(!on())return;const key=x.w+':'+x.q+':'+(x.side||'n'),id=c.id+key;
 if(t.ai?.[key]||busy.has(id)||failed.has(id))return;busy.add(id);
 const w=t.witnesses[x.w];
 try{const res=await ask('npc',{role:w?.role||'증인',attitude:w?.flipped?'flip':'honest',names:namesOf(c,t),question:x.question,answer:x.answer});
  if(res?.text){(t.ai??={})[key]=res.text;save();redraw()}else failed.add(id)}
 finally{busy.delete(id)}
}

/* first-hearing statements / closing statements: one request each for both sides; a failed try is kept in the save */
async function pair(kind,field,c,t,a,b){
 if(!on()||!c?.id||!a||!b)return false;
 const key=c.id+':'+a+':'+b;
 if(t[field]?.source===key||(t.aiTried??={})[field]===fp(key)||busy.has(kind+key))return false;
 busy.add(kind+key);
 try{const res=await ask(kind,{openingA:a,openingB:b,names:namesOf(c,t)});
  if(!res?.openingA||!res?.openingB){t.aiTried[field]=fp(key);save();return false}
  t[field]={source:key,openingA:res.openingA,openingB:res.openingB};save();redraw();return true}
 finally{busy.delete(kind+key)}
}
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

/* A reporter's article, asked for when the player opens it. The key carries a fingerprint of the engine's own text,
 * so when the trial changes what the article says (evidence struck, new testimony) the old wording is not reused.
 * Kept in S.aiArticles; when the store is full, wordings of pre-verdict articles go first — a published post-verdict
 * article keeps its words. Interview pieces are already the reporter's own words and are not re-worded. */
const articleKey=a=>`${a.caseId}:${a.index}:${a.phase||''}:${fp((a.base?.title||a.title||'')+'|'+(a.base?.body||a.body||''))}`;
const MAX_ARTICLES=400;
async function article(a){
 if(!on()||!a?.caseId||String(a.index).startsWith('iv'))return;
 const key=articleKey(a);
 if(S.aiArticles?.[key]||busy.has(key)||failed.has(key))return;busy.add(key);
 try{
  const c=CASES.find(x=>x.id===a.caseId);
  const res=await ask('article',{outlet:a.outlet,reporter:a.reporter?.name||'',style:a.reporter?.style||'',lean:a.lean||'',phase:a.phase,tone:a.tone||'',
   caseName:String(c?.name||'').split(' · ')[0],names:namesOf(c,S.cases[a.caseId]?.trial4),title:a.base?.title||a.title,body:a.base?.body||a.body});
  if(!res?.title||!res?.body){failed.add(key);return}
  const prefix=`${a.caseId}:${a.index}:${a.phase||''}:`;
  S.aiArticles??={};for(const k of Object.keys(S.aiArticles))if(k.startsWith(prefix))delete S.aiArticles[k];   // an older wording of the same article
  S.aiArticles[key]={title:res.title,body:res.body};
  let ks=Object.keys(S.aiArticles);
  while(ks.length>MAX_ARTICLES){const old=ks.find(k=>!/:after:/.test(k))||ks[0];delete S.aiArticles[old];ks=Object.keys(S.aiArticles)}
  save();redraw();
 }finally{busy.delete(key)}
}

/* the written judgment after the sentence: the order (주문) and the excluded material are never sent or changed */
async function judgment(c,t){
 const j=t?.final?.judgment;if(!on()||!j||t.final.judgmentAI||t.final.judgmentAITried||busy.has('j'+c.id))return;busy.add('j'+c.id);
 try{const res=await ask('judgment',{names:namesOf(c,t),facts:j.facts,issues:j.issues,conclusion:j.conclusion});
  if(res?.facts){t.final.judgmentAI={...j,facts:res.facts,issues:res.issues,conclusion:res.conclusion};save();redraw()}
  else{t.final.judgmentAITried=true;save()}}   // a judgment is worded once or never; the engine text stays as the record
 finally{busy.delete('j'+c.id)}
}

window.VerdictAI={npc,article,articleKey,judgment,opening,closing,exchange,get on(){return on()}};
})();
