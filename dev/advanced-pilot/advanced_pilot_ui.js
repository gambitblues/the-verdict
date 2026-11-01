/* Advanced pilot interactive QA surface; isolated from legacy saves. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let p=null;
const C=window.VerdictAdvancedCase,A=window.VerdictPilotIntegration;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function log(t){$('messages').insertAdjacentHTML('afterbegin','<div class="msg">'+esc(t)+'</div>')}
function render(){
 if(!p)return;
 const lock=C.read(p.state),P=window.VerdictAdvancedPilot;
 $('caseTitle').textContent=P.definition.meta.title+' — '+P.definition.meta.hospital;
 $('narrative').textContent='2026년 5월 14일 서울 늘밝은성형외과 제2시술실에서 진정 시술을 받은 환자가 의사의 성폭력 피해를 신고했다. 검체 감정 결과, 시술실 출입기록과 간호사의 진술을 검토한다.';
 $('record').innerHTML=p.state.proceedings.map(x=>'<li>'+esc((x.seq||'')+' '+(x.text||x.evidenceId||x.action||x.type))+'</li>').join('');
 $('evidence').innerHTML=lock.evidence.map(e=>'<button data-ev="'+esc(e.id)+'">'+esc(e.kind+' · '+e.excerpt)+'</button>').join('');
 $('question').disabled=p.state.proceedings.some(x=>x.type==='testimony'&&x.questionId==='return_time');
 $('confront').disabled=!p.state.proceedings.some(x=>x.type==='submission'&&x.evidenceId==='cctv')||!p.state.proceedings.some(x=>x.type==='testimony'&&x.questionId==='return_time');
 $('dialogue').innerHTML=A.check(p)&&p.dialogue.lines.map(l=>'<button data-line="'+esc(l.id)+'" '+(window.VerdictCourtroomConflict.choices(p.state,p.dialogue).some(x=>x.id===l.id)?'':'disabled')+'>'+esc(l.speaker+' · '+l.text)+'</button>').join('');
}
function change(fn){try{p=fn();render()}catch(e){log('진행 불가: '+e.message)}}
$('start').addEventListener('click',()=>{p=A.start($('seed').value||'qa-seed',$('truth').value);$('messages').textContent='';log('독립 시범 사건 시작: '+C.read(p.state).caseId+' · 시드 '+C.read(p.state).seed);render()});
$('evidence').addEventListener('click',e=>{const id=e.target.dataset.ev;if(id)change(()=>{const n=A.evidence(p,id);log('증거 제출: '+id);return n})});
$('question').addEventListener('click',()=>change(()=>{const n=A.ask(p,{witnessId:'nurseA',questionId:'return_time'});log(n.state.proceedings.at(-1).text);return n}));
$('confront').addEventListener('click',()=>change(()=>{const n=A.ask(p,{witnessId:'nurseA',questionId:'return_time',mode:'confront'});log(n.state.proceedings.at(-1).text);return n}));
$('dialogue').addEventListener('click',e=>{const id=e.target.dataset.line;if(id)change(()=>{const n=A.say(p,id);log(n.state.proceedings.at(-1).text);return n})});
$('save').addEventListener('click',()=>{if(!p)return;sessionStorage.setItem('advanced-pilot-qa',JSON.stringify(p));log('QA용 세션 저장 완료')});
$('load').addEventListener('click',()=>{const s=sessionStorage.getItem('advanced-pilot-qa');if(!s)return log('저장된 QA 세션 없음');change(()=>{const n=JSON.parse(s);A.check(n);log('QA 세션 불러오기');return n})});
})();
