/* THE VERDICT — 인맥: only the people I have actually met, drawn as a relationship map.
 * Tab 1 (관계도): me in the centre, four groups around me, closer = more trust.
 * Tab 2 (사건별): one case at a time — lawyers, the two parties and the witnesses, coloured by side.
 * The pre-generated legal pool stays in the world for assignments but sits in a collapsed roster. */
(()=>{
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TP=()=>window.VerdictTrialPlay,WF=()=>window.VerdictWorld;
const trust=id=>S.relations?.[id]??30;
const isCrim=c=>c.kind==='criminal';
const short=c=>String(c.name||'').split(' · ')[0];

/* Cases I took: a trial was opened and the case was not handed to another bench. */
function myCases(){return CASES.filter(c=>{const st=S.cases[c.id];return st?.trial4&&!st.referred})
 .sort((a,b)=>(!!S.cases[a.id].verdict-!!S.cases[b.id].verdict)||(b.week-a.week))}

/* Everyone I have met, grouped. Each entry: {id, name, role, trust, act} — act is the click attributes. */
function circles(){
 const seen=new Set(),g={court:[],bar:[],case:[],press:[]};
 const add=(key,id,role,caseName)=>{if(!id||!NPC[id]||seen.has(id))return;seen.add(id);
  g[key].push({id,name:NPC[id].name,role,caseName,trust:trust(id),act:`data-action="npc" data-id="${esc(id)}"`})};
 for(const id of ['hyun','senior'])add('court',id,NPC[id]?.role||'법원');
 if(S.romance?.person)add('court',S.romance.person,{met:'알아가는 중',dating:'연인',married:'배우자'}[S.romance.stage]||'인연');
 for(const c of myCases()){const t=S.cases[c.id].trial4,crim=isCrim(c),open=!S.cases[c.id].verdict;
  add('bar',c.side?.[0],crim?'검사':'원고 대리인',short(c));add('bar',t.opponent,crim?'변호인':'피고 대리인',short(c));
  if(open||g.case.length<10){add('case',c.who?.[0],crim?'피고인':'원고',short(c));add('case',c.who?.[1],crim?'피해자':'피고',short(c));
   (t.witnesses||[]).forEach(w=>add('case',w.id,'증인 · '+w.role,short(c)))}}
 const W=WF(),list=W?.reporters?.()||[];
 const covering=new Set((window.VerdictMedia?.articles?.()||[]).map(a=>list.indexOf(a.reporter)).filter(i=>i>=0));
 for(const i of covering){const r=list[i],id='reporter_'+i;if(seen.has(id))continue;seen.add(id);
  g.press.push({id,name:r.name,role:r.outlet+' 기자',trust:trust(id),act:`data-action="reporter" data-i="${i}"`})}
 return g;
}
const GROUPS=[['court','법원·개인','#b08a3e',-90],['bar','법정의 법조인','#5b6b82',-28],['case','사건 사람들','#7a5c8e',92],['press','언론','#3f7f72',198]];
const lineColor=v=>v>=55?'#3f8f5a':v>=20?'#a8a399':'#c8442f';

/* ---------- 관계도 ---------- */
function radial(g){
 const C=180,out=[],nodes=[],labels=[];
 for(const [key,label,color,angle] of GROUPS){
  const items=g[key].slice().sort((a,b)=>b.trust-a.trust).slice(0,{court:3,bar:4,case:6,press:4}[key]),n=items.length;
    const pos={court:[180,14,'middle'],bar:[356,30,'end'],case:[180,354,'middle'],press:[4,30,'start']}[key];
  labels.push(`<text x="${pos[0]}" y="${pos[1]}" class="pm-sector" text-anchor="${pos[2]}" fill="${color}">● ${esc(label)}</text>`);
  const spread=Math.min(key==='case'?96:64,(n-1)*22);
  items.forEach((p,k)=>{
   const a=(angle+(n>1?-spread/2+spread*k/(n-1):0))*Math.PI/180;
   const r=Math.min(138,Math.max(66,132-p.trust*0.8)+(k%2?20:0)),x=C+Math.cos(a)*r,y=C+Math.sin(a)*r*0.9;
   out.push(`<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${lineColor(p.trust)}" stroke-width="${(1+p.trust/35).toFixed(1)}" ${p.trust<20?'stroke-dasharray="4 3"':''} opacity=".75"/>`);
   const w=12+p.name.length*11;
   nodes.push(`<g class="pm-node" ${p.act}><rect x="${(x-w/2).toFixed(1)}" y="${(y-11).toFixed(1)}" width="${w}" height="22" rx="11" fill="${color}" stroke="#fffdf7" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" class="pm-init">${esc(p.name)}</text></g>`);
  });
 }
 const me=`<g><circle cx="${C}" cy="${C}" r="24" fill="#1f2d40" stroke="#d9b56a" stroke-width="3"/><text x="${C}" y="${C+5}" class="pm-me">나</text></g>`;
 return `<svg class="pm-svg" viewBox="0 0 360 360" role="img" aria-label="나를 중심으로 한 인물 관계도">${out.join('')}${me}${nodes.join('')}${labels.join('')}</svg>`;
}
function groupList(key,label,color,items){
 if(!items.length)return '';
 return `<details class="pm-group"${key==='case'?'':' open'}><summary><i style="background:${color}"></i>${esc(label)} <span>${items.length}명</span></summary>
 ${items.map(p=>`<button class="pm-row" ${p.act}><b>${esc(p.name)}</b><span>${esc(p.role)}${p.caseName?` · ${esc(p.caseName)}`:''}</span><em><span style="width:${p.trust}%;background:${lineColor(p.trust)}"></span></em><small>${p.trust}</small></button>`).join('')}</details>`;
}

/* ---------- 사건별 인물관계도 ---------- */
function leanOf(c,i,cur){const s=cur?.witnesses?.[i]?.stake||'';
 const pw=isCrim(c)?/피해자|고소인|검찰/:/원고/,dw=isCrim(c)?/피고인|변호/:/피고/;
 const p=pw.test(s),d=dw.test(s);if(p!==d)return p?'p':'d';
 /* otherwise: which side do their answers tend to help */
 let n=0;for(const q of cur?.witnesses?.[i]?.q||[]){if(q.side==='p')n++;else if(q.side==='d')n--}
 return n>0?'p':n<0?'d':'n'}
function caseMap(c){
 const t=S.cases[c.id].trial4,crim=isCrim(c),cur=TP()?.curOf?.(c);
 const pParty=crim?c.who?.[1]:c.who?.[0],dParty=crim?c.who?.[0]:c.who?.[1];
 const box=(id,x,y,role,side)=>{const p=NPC[id];if(!p)return '';const fill=side==='p'?'#fbe9e5':side==='d'?'#e6eef9':'#f1efe9',stroke=side==='p'?'#c8442f':side==='d'?'#2f62a8':'#9a9790';
  return `<g class="pm-node" data-action="npc" data-id="${esc(id)}"><rect x="${x-50}" y="${y-21}" width="100" height="42" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><text x="${x}" y="${y-4}" class="pm-role">${esc(role)}</text><text x="${x}" y="${y+12}" class="pm-bname">${esc(p.name)}</text></g>`};
 const ln=(x1,y1,x2,y2,color,dash)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.6" ${dash?'stroke-dasharray="4 3"':''}/>`;
 const ws=t.witnesses||[],n=ws.length,wy=300,H=n?350:240;
 const wx=i=>n===1?180:58+i*(244/(n-1));
 let edges=ln(68,108,68,178,'#c8442f')+ln(292,108,292,178,'#2f62a8')
  +`<path d="M120 200 L150 192 L165 208 L195 192 L210 208 L240 200" fill="none" stroke="#8a6d3b" stroke-width="2"/><text x="180" y="230" class="pm-role">${crim?'고소 · 기소':'소송'}</text>`
  +ln(180,52,68,90,'#cbbf9f',true)+ln(180,52,292,90,'#cbbf9f',true);
 let wit='';
 ws.forEach((w,i)=>{const lean=leanOf(c,i,cur),x=wx(i);
  edges+=lean==='p'?ln(x,wy-22,68,220,'#c8442f',true):lean==='d'?ln(x,wy-22,292,220,'#2f62a8',true):ln(x,wy-22,180,240,'#9a9790',true);
  wit+=box(w.id,x,wy,'증인 · '+String(w.role).slice(0,8),lean)});
 const body=`<svg class="pm-svg pm-case" viewBox="0 0 360 ${H}" role="img" aria-label="${esc(short(c))} 인물관계도">
  ${edges}
  <g><rect x="140" y="14" width="80" height="38" rx="10" fill="#1f2d40"/><text x="180" y="38" class="pm-me" style="font-size:13px">재판장 (나)</text></g>
  ${box(c.side?.[0],68,90,crim?'검사':'원고 대리인','p')}${box(t.opponent,292,90,crim?'변호인':'피고 대리인','d')}
  ${box(pParty,68,200,crim?'피해자':'원고','p')}${box(dParty,292,200,crim?'피고인':'피고','d')}
  ${wit}</svg>`;
 const stake=ws.map((w,i)=>cur?.witnesses?.[i]?.stake?`<li><b>${esc(NPC[w.id]?.name||'증인')}</b> — ${esc(TP().tell(c,t,cur.witnesses[i].stake))}</li>`:'').join('');
 return `${body}<div class="pm-legend"><span><i style="background:#c8442f"></i>${crim?'검찰·피해자 쪽':'원고 쪽'}</span><span><i style="background:#2f62a8"></i>${crim?'변호인·피고인 쪽':'피고 쪽'}</span><span><i style="background:#9a9790"></i>중립</span><span>증인 색은 증언이 기우는 쪽</span></div>
 ${cur?.logline?`<p class="small">${esc(TP().tell(c,t,cur.logline))}</p>`:''}${stake?`<h4>증인과 당사자의 관계</h4><ul class="pm-stakes">${stake}</ul>`:''}`;
}

/* ---------- page ---------- */
function pool(g){const met=new Set(Object.values(g).flat().map(p=>p.id));
 return (S.legalWorld?.people||[]).filter(id=>NPC[id]?.legalCareer&&!met.has(id))}
people=function(){
 const g=circles(),tab=ui.pmTab||'map',cases=myCases(),total=Object.values(g).reduce((n,a)=>n+a.length,0);
 const tabs=`<div class="pm-tabs"><button class="${tab==='map'?'on':''}" data-action="pmtab" data-tab="map">관계도</button><button class="${tab==='case'?'on':''}" data-action="pmtab" data-tab="case">사건별 인물관계도</button></div>`;
 let page;
 if(tab==='case'){
  const c=cases.find(x=>x.id===ui.pmCase)||cases[0];
  page=!c?'<p class="muted">재판을 시작한 사건이 생기면 인물관계도가 그려집니다.</p>':
   `<div class="pm-cases">${cases.slice(0,8).map(x=>`<button class="${x===c?'on':''}" data-action="pmcase" data-id="${esc(x.id)}">${esc(short(x))}${S.cases[x.id].verdict?' ✓':''}</button>`).join('')}</div>${caseMap(c)}`;
 }else{
  page=total?`${radial(g)}<div class="pm-legend"><span><i style="background:#3f8f5a"></i>신뢰 55 이상</span><span><i style="background:#a8a399"></i>보통</span><span><i style="background:#c8442f"></i>20 미만(점선)</span><span>가까울수록 신뢰가 높아요</span></div>
   ${GROUPS.map(([k,l,col])=>groupList(k,l,col,g[k].slice().sort((a,b)=>b.trust-a.trust))).join('')}`:'<p class="muted">아직 만난 사람이 없어요. 사건을 맡으면 인물이 생깁니다.</p>';
 }
 const rest=pool(g);
 return `${heading('인간관계',`실제로 만난 사람 ${total}명 · 이름을 누르면 인물카드`)}<section class="panel pm">${tabs}${page}</section>
 ${romancePanel()}
 ${rest.length?`<details class="panel pm-pool"><summary>법조계 명부 · 아직 만나지 않은 법조인 ${rest.length}명</summary><p class="muted small">사건이 배당될 때 이 명부에서 검사와 변호사가 정해집니다.</p><div class="pm-chips">${rest.map(id=>`<button data-action="npc" data-id="${esc(id)}">${esc(NPC[id].name)} <small>${esc(NPC[id].career||'')}</small></button>`).join('')}</div></details>`:''}`;
};
const priorClick=clicker;
clicker=function(e){
 const el=e.target.closest('[data-action]'),a=el?.dataset.action;
 if(a==='pmtab'){e.preventDefault();ui.pmTab=el.dataset.tab;render();return}
 if(a==='pmcase'){e.preventDefault();ui.pmCase=el.dataset.id;render();return}
 return priorClick(e);
};
window.VerdictPeopleMap={circles,myCases};
})();
