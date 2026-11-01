/* Dev screen for the match engine: play one trial as the judge, or run 30 trials of the same case. */
(()=>{
const M=window.VerdictMatch,$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sheets={};let sheet=null,st=null;
async function load(id){if(!sheets[id])sheets[id]=await (await fetch(`../../world-sheets/cases/${id}.json`)).json();return sheets[id]}
async function newGame(){sheet=await load($('#case').value);st=M.start(sheet,{seed:$('#case').value+':'+$('#seed').value,truth:$('#force').value||undefined});render()}
const lawRow=L=>`<td><b>${esc(L.name)}</b> ${L.side==='p'?(sheet.card.kind==='criminal'?'검사':'원고 대리인'):'변호사'}<br><small class="sub">${esc(M.TACTICS[L.tactic].label)} — ${esc(M.TACTICS[L.tactic].desc)}</small></td><td>신문 ${M.word(L.exam)} · 논리 ${M.word(L.logic)}<br>준비 ${M.word(L.prep)} · 침착 ${M.word(L.calm)}</td>`;
function render(){
 const c=sheet.card,acts=M.available(sheet,st),groups={ask:'증인 신문',confront:'자료를 들이밀기',party:'피고인 신문',order:'재판장 주문'};
 const recs=sheet.records.filter(r=>st.records[r.id].status==='in').map(r=>`<div class="rec"><b>${esc(r.title)}</b>${st.records[r.id].disputed?' <span class="disp">· 시각·효력 다툼 중</span>':''}<br>${esc(sheetRecord(r.id))}<br><small>${esc(r.by)} · ${esc(r.how)}</small></div>`).join('');
 const pending=sheet.records.filter(r=>['ordered','declined'].includes(st.records[r.id].status)).map(r=>`<small class="sub">· ${esc(r.title)} — ${st.records[r.id].status==='declined'?'제출 거부':'제출 기다리는 중'}</small>`).join('<br>');
 $('#app').innerHTML=`
 <div class="card"><h2>${esc(c.title)} <span class="sub">· ${esc(c.charge?.name||'')}</span></h2><p>${esc(c.summary)}</p>
  <table><tr>${lawRow(st.law.p)}</tr><tr>${lawRow(st.law.d)}</tr></table></div>
 <div class="card"><h2>제${st.day}회 공판 <span class="sub">· 남은 행동 ${st.actions}</span></h2>
  ${st.done?'':`<div class="acts">${Object.entries(groups).map(([t,g])=>{const a=acts.filter(x=>x.type===t);return a.length?`<div class="grp">${g}</div>`+a.map(x=>`<button data-a='${esc(JSON.stringify(x))}'>${esc(x.label)}</button>`).join(''):''}).join('')}</div>
  <div class="row" style="margin-top:10px"><button id="end" class="main">기일 마치기 → 양측 공방, 주문 결과</button></div>`}</div>
 <div class="card log"><h2>법정 기록</h2>${st.log.map(l=>`<p><b>${esc(l.who)}</b>${esc(l.text)}${l.tag?`<span class="tag ${esc(l.tag)}">${esc(l.tag)}</span>`:''}<br><small class="sub">제${l.day}회</small></p>`).join('')}</div>
 <div class="card"><h2>법정에 나온 자료</h2>${recs||'<span class="sub">없음</span>'}${pending?'<div style="margin-top:8px">'+pending+'</div>':''}</div>
 <div class="card"><h2>판결</h2>${st.done?result():st.day<2?'<span class="sub">제2회 공판부터 판결할 수 있습니다.</span>':['did','didnt','reason'].map(t=>`<button style="display:block;width:100%;text-align:left;margin:6px 0" data-v="${t}">${esc(sheet.worlds[t].legal)}</button>`).join('')}</div>`;
}
const sheetRecord=id=>sheet.worlds[st.truth].records[id];   // the court sees the locked world's record
function result(){const r=M.reveal(sheet,st),d=st.done;
 return `<div class="grade">${esc(d.grade)}</div><p class="sub">법정에 나온 자료와 번복된 증언으로 남는 세계: ${d.open.map(t=>sheet.worlds[t].label).join(' · ')}</p>
 <p><b>실제 세계:</b> ${esc(r.label)}<br>${esc(r.act)}</p><p class="sub">봉인값 ${esc(r.lock)} — 시작 때와 같음 (세계는 바뀌지 않았습니다)</p>`}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.id==='new')return newGame();if(b.id==='reroll'){$('#seed').value=String(Math.floor(Math.random()*9999));return newGame()}
 if(b.id==='bulk')return bulk();if(!st)return;
 if(b.dataset.a){M.act(sheet,st,JSON.parse(b.dataset.a));render()}
 else if(b.id==='end'){M.endDay(sheet,st);render();scrollTo(0,document.body.scrollHeight)}
 else if(b.dataset.v){M.verdict(sheet,st,b.dataset.v);render()}});
async function bulk(){const sh=await load($('#case').value),rows=[];
 for(let i=1;i<=30;i++){const s=M.start(sh,{seed:'bulk:'+i});for(let d=0;d<3;d++){let a;while(s.actions>0&&(a=M.available(sh,s)).length){M.act(sh,s,a.find(x=>x.type==='ask'&&x.q==='open')||a.find(x=>x.type==='order')||a.find(x=>x.type==='confront')||a.find(x=>x.type==='party')||a[0])}M.endDay(sh,s)}
  const open=M.consistent(sh,s),tag=t=>s.log.filter(l=>l.tag===t).length;
  rows.push(`<tr><td>${i}</td><td>${sh.worlds[s.truth].label}</td><td>${M.TACTICS[s.law.p.tactic].label} vs ${M.TACTICS[s.law.d.tactic].label}</td><td>${tag('거짓')}/${tag('번복')}/${tag('버팀')}</td><td>${tag('제출 거부')}</td><td>${open.length===1?'하나로 좁혀짐':open.length+'개 남음'}</td></tr>`)}
 $('#bulkout').innerHTML=`<table><tr><th>판</th><th>실제 세계</th><th>검사 전술 vs 변호 전술</th><th>거짓/번복/버팀</th><th>제출 거부</th><th>증거로</th></tr>${rows.join('')}</table>`}
newGame();
})();
