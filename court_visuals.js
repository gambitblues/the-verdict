/* v6.2 visual layer. Presentation only: never reads truth, flaws, traits or scores.
 * Portrait identity is derived from NPC id. Events are ephemeral, never saved. */
(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=s=>{let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0};
let serial=0,eventSerial=0,last=null,shown=0,portraitShown=0,collapsed=null;
function portrait(id,p={},age=35){
 const n=hash(id),uid='cvp'+(++serial),female=/여/.test(p.gender||''),old=age>=58;
 const skin=['#e4bda2','#d6a788','#efcdb5','#c69778'][n%4],hair=old?['#74736e','#606260','#8a8880'][n%3]:['#282b2c','#3a302c','#24262a','#453832'][n%4];
 const jacket=['#293b49','#424950','#4c4a43','#394d4b','#5a474c'][n%5],wide=30+(n%5),eye=79+(n%4),glasses=(n>>>6)%4===0;
 return `<span class="id-portrait cv-portrait" role="img" aria-label="${esc(p.name||'인물')} 초상화"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 194" aria-hidden="true"><defs><linearGradient id="${uid}b" x2="1" y2="1"><stop stop-color="#e9e2d4"/><stop offset="1" stop-color="#a6b0a9"/></linearGradient><linearGradient id="${uid}f"><stop stop-color="${skin}"/><stop offset=".55" stop-color="${skin}"/><stop offset="1" stop-color="#b77f63"/></linearGradient></defs><rect width="160" height="194" fill="url(#${uid}b)"/><path d="M0 0h62L0 150z" fill="#fff" opacity=".15"/><path d="M15 194v-20q4-28 47-35h36q43 7 47 35v20" fill="${jacket}"/>${female?`<path d="M40 112Q16 25 78 24q64-2 46 90l8 42-31-9-43 2-25 8z" fill="${hair}"/>`:''}<path d="M65 119v23l15 18 15-18v-23" fill="${skin}"/><path d="M65 130q15 10 30 0v8q-15 12-30 0" fill="#8d5d47" opacity=".22"/><path d="m62 142 18 17 18-17-2 52H64z" fill="#eeeae2"/><path d="m62 140 18 54H52l5-23-12-14zm36 0-18 54h28l-5-23 12-14z" fill="#fff" opacity=".10"/>${!female?'<path d="m77 159-3 7 5 28h5l4-28-5-7z" fill="#92755b"/>':''}<ellipse cx="44" cy="88" rx="6" ry="11" fill="${skin}"/><ellipse cx="116" cy="88" rx="6" ry="11" fill="${skin}"/><path d="M${80-wide} 58Q44 30 80 31q36-1 ${wide} 27v36q-2 29-${wide} 40Q${47} 123 ${80-wide} 94Z" fill="url(#${uid}f)"/><path d="M44 77Q29 33 66 25q43-17 55 29l-5 25-7-24q-28 11-49-3l-10 27z" fill="${hair}"/><path d="M51 52q19-27 52-13" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="3"/><path d="M53 ${eye-5}q9-4 17-1m20 0q9-3 17 1" stroke="${hair}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M53 ${eye+3}q8-5 17 0m20 0q8-5 17 0" stroke="#635044" stroke-width="1.3" fill="none"/><ellipse cx="62" cy="${eye+3}" rx="2.6" ry="3" fill="#292a2b"/><ellipse cx="98" cy="${eye+3}" rx="2.6" ry="3" fill="#292a2b"/><path d="m80 84-4 16q4 3 9 0" stroke="#a87559" stroke-width="1.3" fill="none"/><path d="M69 114q11 3 22 0m-17 4h12" stroke="#9b665b" stroke-width="1.5" fill="none" stroke-linecap="round"/>${old?'<path d="M52 92l12 2m32 0 12-2M62 105l-3 10m39-10 3 10M63 65h34" stroke="#926c55" opacity=".35" fill="none"/>':''}${glasses?`<g stroke="#4e514e" stroke-width="1.7" fill="none"><rect x="48" y="${eye-3}" width="27" height="17" rx="5"/><rect x="85" y="${eye-3}" width="27" height="17" rx="5"/><path d="M75 ${eye+2}h10M44 ${eye}h4m64 0h4"/></g>`:''}<path d="M20 194v-21m120 21v-21" stroke="#fff" stroke-opacity=".1"/><rect x=".5" y=".5" width="159" height="193" fill="none" stroke="#fff" stroke-opacity=".3"/></svg></span>`;
}
function person(id,label){
 if(!id)return `<div class="cv-seat-empty"><span>${esc(label)}</span></div>`;
 return `<button class="cv-seat-person" data-action="npc" data-id="${esc(id)}" aria-label="${esc(NPC[id]?.name||label)} 인물 기록">${window.verdictPhoto?.(id)||''}<span>${esc(label)}</span></button>`;
}
function scene(c,t,tab,status){
 if(!t)return '';
 const folded=collapsed??!['case','day'].includes(tab);
 const witnesses=t.witnesses||[],wi=Math.min(witnesses.length-1,Math.max(0,ui.t4w||0)),w=witnesses[wi];
 const live=tab==='witness'&&!!w,left=/criminal/.test(c.kind||'')?'검사':'원고 측';
 return `<section class="cv-court ${folded?'is-collapsed':''}" aria-label="법정 전경"><div class="cv-court-bar"><span><i></i> ${esc(status)}</span><button type="button" data-cv-toggle aria-expanded="${!folded}" aria-controls="cv-court-stage">법정 ${folded?'펼치기':'접기'} <span aria-hidden="true">${folded?'＋':'−'}</span></button></div><div id="cv-court-stage" class="cv-stage" ${folded?'hidden':''}>
 <svg class="cv-room" viewBox="0 0 700 240" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="cvwall" x2="0" y2="1"><stop stop-color="#1f3138"/><stop offset="1" stop-color="#34454a"/></linearGradient><linearGradient id="cvwood" x2="0" y2="1"><stop stop-color="#8a6b4d"/><stop offset="1" stop-color="#463d35"/></linearGradient></defs><path d="M0 0h700v240H0z" fill="url(#cvwall)"/><path d="M0 148h700v92H0z" fill="#68645a"/><path d="m0 240 150-92h400l150 92M350 148v92M0 206h700" fill="none" stroke="#ddd4bf" opacity=".15"/><path d="M160 0v148m380-148v148M175 0v148m350-148v148" stroke="#ba9c6d" opacity=".35"/><path d="M198 15h304v91H198z" fill="#172b32" stroke="#ae946a" stroke-opacity=".3"/><path d="M215 27h270v67H215z" fill="none" stroke="#ae946a" stroke-opacity=".12"/><circle cx="350" cy="53" r="22" fill="none" stroke="#c0a477"/><path d="M350 38v29m-13-20h26m-26 0-7 14h14zm26 0-7 14h14zM339 70h22" stroke="#c0a477" stroke-width="1.4" fill="none"/><path d="M20 20h90v88H20zM590 20h90v88h-90z" fill="#c9c4ac" opacity=".09"/><path d="M65 20v88m-45-44h90m525-44v88m-45-44h90" stroke="#b5bcb3" opacity=".12"/><path d="M35 145h185v38H35zm445 0h185v38H480z" fill="url(#cvwood)"/><path d="M32 141h191v7H32zm445 0h191v7H477z" fill="#ac8b61"/><path d="M290 146h120v49H290z" fill="url(#cvwood)"/><path d="M286 142h128v8H286z" fill="#b79970"/><path d="M0 216h700v24H0z" fill="#302e2a"/><path d="M0 216h700" stroke="#b89a70" stroke-width="4"/><path d="m299 224 7-10h89l7 10z" fill="#e5ded0" opacity=".6"/></svg>
 ${(()=>{const ev=last&&last.caseId===c.id?last:null,crim=/criminal/.test(c.kind||'');
  const evW=ev&&witnesses.find(x=>x.id===ev.actor),sw=live?w:evW,seated=!!sw;
  const mood=ev?.moment&&MOMENTS[ev.moment]?.[2]||'';
  const say=ev?(ev.moment==='objection'?'이의 있습니다!':ev.moment==='delay'?'기일을 미뤄 주십시오':ev.moment&&MOMENTS[ev.moment]?MOMENTS[ev.moment][0]:''):'';
  const bubble=who=>ev&&ev.actor===who&&say?`<span class="cv-bubble-say ${mood?'cv-m-'+mood:''}">${esc(say)}</span>`:'';
  const seat=(cls,id,label)=>`<div class="cv-seat ${cls} ${ev&&ev.actor===id?'is-speaking '+(mood?'cv-mood-'+mood:''):''}">${bubble(id)}${person(id,label)}</div>`;
  return seat('cv-left',t.opponent,crim?'변호인':'피고 측')
   +(seated?seat('cv-center'+(live?' is-live':''),sw.id,'증인 · '+(NPC[sw.id]?.name||'증인')):`<div class="cv-seat cv-center"><div class="cv-seat-empty"><span>증인석</span></div></div>`)
   +seat('cv-right',c.side?.[0],left)})()}</div></section>`;
}
const CHIP={flip:['말이 바뀜','flip'],shift:['자기 말과 어긋남','clash'],clash:['다른 증인과 엇갈림','clash'],admit:['증거 앞에서 털어놓음','turn'],correct:['정정함','turn'],revert:['처음 말로 돌아옴','turn'],hold:['증거에도 버팀','hold'],yield:['대질에서 물러섬','turn'],standoff:['대질에서 버팀','hold']};
function witness(w,p,latest){
 const speaking=last?.actor===w.id&&portraitShown!==last.serial;if(speaking)portraitShown=last.serial;
 const mood=speaking&&last.moment&&MOMENTS[last.moment]?.[2]?' cv-mood-'+MOMENTS[last.moment][2]:'';
 const chips=(w.moments||[]).filter(m=>CHIP[m]).map(m=>`<span class="cv-chip cv-m-${CHIP[m][1]}">${CHIP[m][0]}</span>`).join('');
 return `<div class="cv-witness ${speaking?'cv-speaking':''}${mood}"><button class="cv-witness-photo" data-action="npc" data-id="${esc(w.id)}" aria-label="${esc(p?.name||'증인')} 인물 기록">${window.verdictPhoto?.(w.id)||''}</button><div><span class="cv-kicker">WITNESS · 증인석</span><h4>${esc(p?.name||'증인')}</h4><p>${esc(w.role)}</p><span class="cv-witness-state">${latest?'진술 기록 있음':'신문을 기다리는 중'}</span>${chips?`<span class="cv-chips">${chips}</span>`:''}</div><svg class="cv-mic" viewBox="0 0 40 70" aria-hidden="true"><path d="M20 65V37Q20 20 29 11" stroke="currentColor" fill="none" stroke-width="2"/><rect x="24" y="3" width="7" height="19" rx="3" transform="rotate(25 28 12)" fill="currentColor"/><ellipse cx="20" cy="65" rx="13" ry="3" fill="currentColor"/></svg></div>`;
}
/* Evidence looks like the kind of record it is. Ten shapes, chosen from the record's kind (then its title).
 * Order matters: a "통화 기록·교대 일지" is a call log, a "블랙박스 음성 복구본" is a recording. */
const EV_TYPES=[
 ['audio',/녹음|녹취|음성|교신/,'녹음 기록','원본 음성이 아닌 녹취 내용입니다.'],
 ['call',/통화|통신|발신|수신|문자 발송/,'통화·통신 내역','통신사·기관 기록을 옮긴 내용입니다.'],
 ['message',/메신저|메시지|문자|대화|카톡|카카오|메일|게시글|캡처|백업|채널/,'대화 기록','화면에 보인 대화를 옮긴 내용입니다.'],
 ['video',/영상|CCTV|블랙박스|카메라|녹화|중계/,'영상 기록','원본 영상이 아닌 장면 기록입니다.'],
 ['contract',/계약|위임장|차용|약정|공증|서명부|확인서|허가서|입사 서류|공고문/,'계약·서명 문서','서명과 조항을 옮긴 내용입니다.'],
 ['photo',/사진|촬영|실물|증거물|압수물/,'사진·실물 기록','원본 사진이나 실물이 아닌 기재 내용입니다.'],
 ['money',/금융|계좌|통장|결제|거래|영수증|송금|입금|자금|회계|견적|고지서|대조표|정산|장부|급여|내역/,'금융·거래 기록','장부와 거래 내역을 옮긴 내용입니다.'],
 ['report',/감정|진단|소견|검사|부검|감식|의료|진료|분석|검진|측정|측량|평가|일조|의견|치료/,'감정·분석서','전문가가 작성한 의견입니다.'],
 ['log',/출입|접속|로그|전산|시스템|서버|단말|위치|운행|주행|교통카드|플랫폼|설비|기기|기록지|대여|근무|계량기|항해|가입|수정 기록|편집 기록|업데이트|출동|접수 기록|차량|시설 관리|화면 기록|시청|클라우드|업체 기록|작업 파일|통계/,'시스템 기록','기계가 남긴 기록을 옮긴 내용입니다.'],
 ['note',/메모|일지|수첩|편지|노트|관찰 기록/,'메모·일지','손으로 적은 기록을 옮긴 내용입니다.'],
 ['official',/공문|결정서|보고|회신|신고|공지|판결|조서|진술|민원|통지|기준|기관|목록|문서|안내문|경고장|회의록|계획서|자료|기사|기록물|상담|학사|조사|검증/,'공문·보고서','기관이나 회사가 작성한 문서입니다.']
];
function evType(kind,title){const k=String(kind||'');return EV_TYPES.find(x=>x[1].test(k))||EV_TYPES.find(x=>x[1].test(String(title||'')))||['document',/./,'제출 문서','사건 기록에 기재된 원문입니다.']}
const lines=x=>String(x).split(/\s+\/\s+/).filter(Boolean);
const timeSplit=l=>{const m=l.match(/^((?:[^\s]+ )?\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?|\d+:\d{2}\.\d+|\d{1,2}\/\d{1,2}|\d+년 ?\d*월?|(?:전날|당일|다음 날) \d{1,2}:\d{2})\s*(.*)$/);return m?[m[1],m[2]]:['',l]};
function evBody(type,excerpt){
 const L=lines(excerpt),row=(cls,t,x)=>`<li class="${cls}">${t?`<time>${esc(t)}</time>`:''}<span>${esc(x)}</span></li>`;
 if(type==='message')return `<div class="cv-chat">${L.map((l,i)=>{const m=l.match(/^([^:：]{1,24})[:：]\s*(.+)$/);const [t,rest]=timeSplit(m?m[1]:'');return `<div class="cv-bubble ${i%2?'me':''}">${m?`<small>${esc(rest||m[1])}${t?' · '+esc(t):''}</small>`:''}<span>${esc(m?m[2]:l)}</span></div>`}).join('')}</div>`;
 if(type==='call'||type==='log'||type==='money'||type==='video')return `<ul class="cv-rows">${L.map(l=>{const [t,x]=timeSplit(l);return row(/거부|실패|없음|중단|안 됨|OFF|불일치/.test(l)?'warn':'',t,x)}).join('')}</ul>`;
 if(type==='contract')return `<ol class="cv-clauses">${L.map(l=>`<li>${esc(l)}</li>`).join('')}</ol><div class="cv-sign" aria-hidden="true"><span>서명</span><i></i><b>印</b></div>`;
 if(type==='report')return `<div class="cv-findings"><span class="cv-findings-h">소견</span>${L.map(l=>`<p>${esc(l)}</p>`).join('')}</div>`;
 if(type==='audio')return `<div class="cv-transcript">${L.map(l=>{const [t,x]=timeSplit(l);return `<p>${t?`<time>${esc(t)}</time>`:''}${esc(x)}</p>`}).join('')}</div>`;
 return '';
}
const EV_MARK={video:'<div class="cv-rec" aria-hidden="true"><span>● REC</span><span>CAM</span></div>',photo:'<div class="cv-photo-frame" aria-hidden="true"><i></i></div>',audio:'<div class="cv-audio-mark" aria-hidden="true"><i></i><span>녹음을 글로 옮긴 내용</span></div>',call:'<div class="cv-call-head" aria-hidden="true">☎ 시각 · 내용</div>',money:'<div class="cv-ledger-head" aria-hidden="true"><span>내역</span><span>₩</span></div>',log:'<div class="cv-log-head" aria-hidden="true">&gt;_ SYSTEM LOG</div>',official:'<div class="cv-letterhead" aria-hidden="true"><b>공 문</b><i></i></div>',report:'<div class="cv-report-head" aria-hidden="true"><b>감정 · 분석</b><span>소견서</span></div>',note:'',contract:'<div class="cv-contract-head" aria-hidden="true">계 약 · 서 명</div>'};
function evidence(e,d,excerpt,when){
 if(!excerpt)return '';
 const [type,,label,foot]=evType(d?.kind,e.title);
 const stamp={use:'채택',conditional:'조건부 채택',exclude:'배제'}[e.decision];
 return `<div class="cv-evidence cv-${type}" data-ev-type="${type}"><div class="cv-evidence-top"><span>${esc(d?.kind||label)}${d?.by?' · '+esc(d.by):''}</span><span>${esc(when||'')}</span></div><div class="cv-paper"><span class="cv-kicker">EXHIBIT · ${esc(e.id)} · ${esc(label)}</span>${EV_MARK[type]||''}${(b=>b?b+`<blockquote class="t4-excerpt cv-plain">${esc(excerpt)}</blockquote>`:`<blockquote class="t4-excerpt">${esc(excerpt)}</blockquote>`)(evBody(type,excerpt))}${stamp?`<div class="cv-stamp ${e.decision}">${stamp}</div>`:''}</div><div class="cv-evidence-foot">${esc(foot)}<span aria-hidden="true">THE VERDICT</span></div></div>`;
}
/* Courtroom moments: what just happened at the witness stand, told apart at a glance.
 * `moment` comes from trial_play (it already knows whether a story changed); this layer only shows it. */
const MOMENTS={
 answer:['증인의 답변','·',''],recall:['다시 부른 증인의 답변','↺','recall'],
 flip:['진술이 흔들립니다','≋','flip'],shift:['앞선 자기 진술과 어긋납니다','⚠','clash'],clash:['다른 증인의 말과 엇갈립니다','⇄','clash'],
 admit:['증거 앞에서 털어놓았습니다','◆','turn'],correct:['증거를 보고 정정했습니다','✎','turn'],revert:['처음 진술로 돌아왔습니다','↩','turn'],hold:['증거를 보고도 버팁니다','▮','hold'],
 yield:['대질 끝에 한쪽이 물러섰습니다','⇆','turn'],standoff:['대질에서 둘 다 물러서지 않았습니다','⇹','hold'],
 objection:['이의에 대한 결정','✋',''],delay:['기일 연기 신청에 대한 결정','⏳','']
};
function record(caseId,kind,text,actor=null,moment=null){if(!text)return;last={caseId,kind,text,actor,moment,serial:++eventSerial};}
function event(caseId){
 if(!last||last.caseId!==caseId)return '';
 const fresh=shown!==last.serial;shown=last.serial;
 const m=last.moment&&MOMENTS[last.moment];
 const title=m?m[0]:({ask:'증인의 답변',confront:'증거를 제시했습니다',face:'대질 신문',decide:'증거 판단',order:'재판장 주문',card:'상대 신청에 대한 결정',open:'개정'}[last.kind]||'법정 기록');
 const icon=m?m[1]:(last.kind==='confront'?'▤':last.kind==='face'?'↔':'·');
 return `<div class="cv-event ${fresh?'cv-arrive':''} ${m?.[2]?'cv-m-'+m[2]:''}" data-moment="${esc(last.moment||last.kind)}" role="status"><span class="cv-event-icon" aria-hidden="true">${icon}</span><div><b>${title}</b><p>${esc(last.text)}</p></div><button type="button" data-cv-dismiss aria-label="법정 알림 닫기">×</button></div>`;
}
document.addEventListener('click',e=>{if(e.target.closest('[data-cv-toggle]')){const box=e.target.closest('.cv-court'),stage=box.querySelector('.cv-stage'),btn=box.querySelector('button');collapsed=!stage.hidden;box.classList.toggle('is-collapsed',collapsed);stage.hidden=collapsed;btn.setAttribute('aria-expanded',String(!collapsed));btn.innerHTML=`법정 ${collapsed?'펼치기 ＋':'접기 −'}`;}if(e.target.closest('[data-cv-dismiss]')){last=null;e.target.closest('.cv-event')?.remove();}});
window.VerdictVisuals={portrait,scene,witness,evidence,record,event,evType:(k,t)=>evType(k,t)[0]};
})();
