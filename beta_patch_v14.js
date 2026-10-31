/* Beta 1.4 witness questioning — uses only existing case testimony. */
'use strict';
(()=>{
const previousCourt=court,previousClick=clicker;
const escape=s=>h(String(s??''));
const available=c=>{const seen=new Set();return(c.stages||[]).flatMap(s=>s.actions||[]).filter(a=>a.who&&NPC[a.who]&&!c.who.includes(a.who)&&!c.side.includes(a.who)&&!seen.has(a.who)&&seen.add(a.who));};
function response(a,type){
if(type==='account')return {q:'당시 직접 보고 들은 내용은 무엇입니까?',text:a.says||'구체적인 진술은 기록에 기재되지 않았습니다.',note:'기존 기록에 있는 진술입니다. 진위 여부는 아직 판단되지 않았습니다.'};
if(type==='source')return {q:'그 사실은 어떻게 알게 됐습니까?',text:'기존 기록에서 확인되는 근거: '+(a.clue||'인지 경위 확인 필요'),note:'직접 목격인지 전달받은 내용인지 추가 검토가 필요합니다.'};
return {q:'이 진술을 뒷받침하는 독립된 증거가 있습니까?',text:'관련 증거: '+(a.clue||'별도로 확인된 자료 없음'),note:'이는 기존 단서이며 진술의 진실성을 자동 입증하지 않습니다.'};
}
function panel(c,st){
const acts=available(c);st.witnessExams??={};
if(!acts.length)return '<section class="panel"><h3>👥 증인·목격자 신문</h3><p class="muted small">현재 사건에 특정된 증인이 없습니다. 실제 기록과 무관한 인물을 추가하지 않습니다.</p></section>';
return '<section class="panel witness-exams"><h3>👥 증인·목격자 신문</h3><p class="muted small">기록에 존재하는 진술만 사용합니다. 인물 카드를 누르면 생애 기록을 열 수 있습니다.</p>'+
acts.map((a,i)=>{const id=a.who,p=NPC[id],records=st.witnessExams[id]||[],done=new Set(records.map(r=>r.type));
const photo=window.verdictPhoto?.(id)||'👤';
return '<article class="witness-person"><button class="witness-name" data-action="npc" data-id="'+escape(id)+'">'+photo+'<span><strong>'+escape(p.name)+'</strong><small>'+escape(p.role||'관계인')+' · 프로필 보기 ›</small></span></button><p class="muted small">관련 기록: '+escape(a.short||a.label||'사실관계 확인')+'</p><div class="witness-questions">'+[['account','사건 당시'],['source','인지 경위'],['proof','증거 대조']].map(([type,label])=>'<button class="btn outline mini" data-action="witnessQuestion" data-id="'+escape(id)+'" data-index="'+i+'" data-type="'+type+'" '+(done.has(type)||st.verdict?'disabled':'')+'>'+(done.has(type)?'✓ ':'')+label+' 질문</button>').join('')+'</div>'+records.map(r=>'<div class="witness-answer"><b>Q. '+escape(r.question)+'</b><p>A. '+escape(r.answer)+'</p><small>'+escape(r.note)+' · '+escape(day(r.week))+'</small></div>').join('')+'</article>';}).join('')+'</section>';
}
court=function(){let html=previousCourt();const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||!html.includes('beta-court'))return html;return html.replace('<section class="panel action-panel">',panel(c,st)+'<section class="panel action-panel">');};
clicker=function(e){const b=e.target.closest('[data-action]');if(b?.dataset.action==='witnessQuestion'){
const c=CASES.find(x=>x.id===ui.caseId),st=c&&S.cases[c.id];if(!c||!st||st.verdict)return;
if(Number.isInteger(st.nextHearingWeek)&&S.week<st.nextHearingWeek){toast('재판 재개 기일 이후 신문할 수 있습니다.');return;}
const a=available(c)[Number(b.dataset.index)],id=b.dataset.id,type=b.dataset.type;if(!a||a.who!==id)return;
st.witnessExams??={};const records=st.witnessExams[id]??=[];if(records.some(r=>r.type===type))return;
const t=response(a,type);records.push({type,question:t.q,answer:t.text,note:t.note,week:S.week});st.clues.push(NPC[id].name+' 증인신문: '+t.note);save();render();toast('증인신문 기록 저장');return;}previousClick(e);};
const css='.witness-person{background:#fff;border:1px solid #d5dbdf;border-radius:13px;padding:14px;margin:12px 0}.witness-name{border:0;background:transparent;cursor:pointer;text-align:left;display:flex;align-items:center;gap:12px;color:inherit}.witness-name .id-portrait{width:48px;height:60px;flex-shrink:0}.witness-name small{display:block;color:#728092}.witness-questions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.witness-answer{padding:11px;margin-top:8px;border-left:3px solid #6d97a7;background:#f0f5f6;border-radius:8px;line-height:1.5}.witness-answer p{margin:8px 0}.witness-answer small{color:#607080}';
const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
})();