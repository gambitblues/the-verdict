/* P4 shared chronology: public facts only. Does not touch S, NPC, save files or hidden truths.
 * Load after auth_gate.js has installed VerdictAuth. Local/offline stays single-player.
 */
(()=>{'use strict';
const LIMIT=50;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let events=[],cursor=0,loading=false,owner='',panel=null,button=null,clock=null,npcs=[];
let sharedSlot='',offerCandidates=[],selectedCase=null,firstDocs=[],courtStatus=null,courtActions=[],courtMotions=[],catchup=null,resumeNotice='';
const seen=new Set();
function user(){const a=window.VerdictAuth;return a?.online&&a?.user?.id?a.user.id:null}
function reset(next){owner=next;events=[];cursor=0;clock=null;npcs=[];sharedSlot='';offerCandidates=[];selectedCase=null;firstDocs=[];courtStatus=null;courtActions=[];courtMotions=[];courtTab='case';finalDecision=null;panelState=null;panelPartners=null;panelFor=null;jointSlotState=null;jointSlotLoading=false;jointBench=null;sharedCareer=null;careerLoading=false;evidenceNotes.clear();evidenceBusy.clear();catchup=null;resumeNotice='';seen.clear();render();renderOffers();renderCatchup()}
function valid(ev){
 return ev&&Number.isSafeInteger(ev.event_id)&&ev.event_id>0&&
  typeof ev.event_key==='string'&&typeof ev.event_type==='string'&&
  Number.isInteger(ev.game_day)&&ev.game_day>=0&&
  ev.public_data&&typeof ev.public_data==='object'&&!Array.isArray(ev.public_data);
}
function text(ev){
 const d=ev.public_data,kind={
  incident_reported:'사건 발생',investigation_opened:'수사 개시',indictment_filed:'기소',
  case_assigned:'사건 배당',hearing_opened:'공판',judgment_published:'판결',
  appeal_reported:'항소',aftermath_published:'후속 소식',npc_public_update:'인물 소식'
 }[ev.event_type]||'공개 기록';
 return {kind,title:String(d.title||d.eventLabel||kind),summary:String(d.summary||d.judgment||''),
  gameDay:ev.game_day,caseId:String(ev.case_id||d.publicCaseId||''),key:ev.event_key};
}
function render(){
 if(!panel)return;
 const list=panel.querySelector('[data-world-list]');if(!list)return;
 const meta=panel.querySelector('[data-world-clock]');if(meta)meta.textContent=clock?'공통 세계 날짜: 게임 '+clock.game_day+'일 (동기화 버전 '+clock.version+')':'공통 세계 날짜: 서버 확인 전';
 const people=panel.querySelector('[data-world-npcs]');if(people)people.innerHTML=npcs.length?'<strong>세계 공통 인물 '+npcs.length+'명</strong>'+npcs.slice(0,25).map(n=>'<p>'+esc(n.public_profile?.name||n.npc_id)+' · '+esc(n.public_profile?.profession||n.public_profile?.publicRole||'')+' · '+esc(n.life_status==='dead'?'사망':n.life_status==='alive'?'생존':'상태 미상')+'</p>').join(''):'';
 if(!events.length){list.innerHTML='<p class="vsw-empty">아직 공개된 세계 연혁이 없습니다.</p>';return}
 list.innerHTML=events.slice(-120).reverse().map(e=>{
  const x=text(e);
  return `<article class="vsw-event"><small>게임 ${x.gameDay}일 · ${esc(x.kind)} · ${esc(x.caseId)}</small><strong>${esc(x.title)}</strong>${x.summary?`<p>${esc(x.summary)}</p>`:''}</article>`
 }).join('');
}
/* P4 isolated docket preview: public case fields only. Never touches local
 * courtroom case objects or commits a verdict without server adjudication. */
function kstSlot(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const v=k=>parts.find(p=>p.type===k)?.value||'';
 return v('year')+'-'+v('month')+'-'+v('day')+'T'+v('hour');
}
let courtTab='case',finalDecision=null,panelState=null,panelPartners=null,panelFor=null,jointSlotState=null,jointSlotLoading=false;
let evidenceNotes=new Map(),evidenceBusy=new Set();
let sharedCareer=null,careerLoading=false,jointBench=null;
const TABS=[['case','사건'],['day','기일'],['evidence','증거'],['witness','증인'],['orders','주문'],['verdict','판결']];
function renderOffers(){
 const region=panel?.querySelector('[data-world-offers-list]');if(!region)return;
 const syncNative=()=>{
  const el=document.querySelector('[data-world-native-list]');
  if(el)el.innerHTML=region.innerHTML;
 };
 if(!selectedCase){
  if(!offerCandidates.length){region.textContent='현재 예약된 사건 후보가 없습니다.';syncNative();return}
  region.innerHTML=offerCandidates.map(c=>
   '<div class="vsw-event"><strong>'+esc(c.case_id)+'</strong><small>'+esc(c.category||'')+
   '</small><button type="button" data-world-accept="'+esc(c.case_id)+'">이 사건 선택</button></div>').join('');
  syncNative();return;
 }
 const caseId=selectedCase.caseId,c=selectedCase.card||{},records=selectedCase.records||[],
  questions=selectedCase.questions||[],orders=selectedCase.orders||[],
  ready=window.VERDICT_CONFIG?.p4CourtActions===true&&courtStatus?.canAct===true,
  permitted=window.VERDICT_CONFIG?.p4CourtActions===true,
  verdictReady=courtStatus?.canDeliberate===true||
   (courtStatus?.canDeliberate==null&&ready);
 const nav=window.VerdictCourtSurface?.navigation?.(TABS,courtTab,true)||
  '<nav class="t4-tabs vsw-six-tabs" aria-label="재판 화면">'+
  TABS.map(([k,label])=>'<button type="button" class="t4-tab '+(courtTab===k?'on':'')+
    '" data-court-tab="'+k+'" aria-current="'+(courtTab===k?'page':'false')+'">'+label+'</button>').join('')+'</nav>';
 const actions=courtActions.map(a=>'<p><small>'+esc(a.action_type)+' / 제'+esc(a.hearing_index||'?')+'회</small> <b>'+
    esc(a.action_key)+'</b> · '+esc(a.response?.answer||a.response?.text||a.response?.status||'')+'</p>').join('');
 const courtBtn=(kind,key,label)=>'<button type="button" data-court-kind="'+esc(kind)+
  '" data-court-key="'+esc(key)+'">'+esc(label)+'</button>';
 const due=courtActions.filter(a=>a.action_type==='order'&&
   Number(a.hearing_index)<Number(courtStatus?.hearingIndex||0)&&
   !courtActions.some(x=>x.action_type==='order_result'&&x.action_key===a.action_key));
 const evidenceNow=[
   ...firstDocs.map(r=>({id:r.id,title:r.title,text:r.text,source:'최초 제출'})),
   ...courtActions.filter(a=>a.action_type==='order_result'&&a.response?.status==='done')
     .map(a=>({id:a.response?.recordId||a.action_key,title:a.response?.title,text:a.response?.text,source:'추가 제출'}))
 ];
 const latestRulings=new Map();
 for(const a of courtActions)if(a.action_type==='evidence_decision'&&a.response?.recordId&&
  ['use','conditional','exclude'].includes(a.response?.decision)&&
  (!latestRulings.has(a.response.recordId)||Number(a.hearing_index||0)>=latestRulings.get(a.response.recordId).hearing))
  latestRulings.set(a.response.recordId,{decision:a.response.decision,hearing:Number(a.hearing_index||0)});
 const rulingLabels={use:'채택',conditional:'조건부 채택',exclude:'배제'};
 const canRule=ready&&window.VERDICT_CONFIG?.p4TrialParity===true&&
  (!window.VERDICT_CONFIG?.p5JointPanel||jointBench?.myRole==='chair');
 const choices=c.kind==='criminal'?[['guilty','유죄'],['acquittal','무죄'],['partial','일부 유죄']]
  :c.kind==='decision'?[['decision_yes','인용'],['decision_no','기각']]
  :[['claim_granted','청구 인용'],['claim_denied','청구 기각'],['partial','일부 인용'],['settled','화해']];
 const citations=[
   ...records.filter(r=>r.first===true).map(r=>({key:'initial:'+r.id,title:r.title})),
   ...courtActions.filter(a=>a.response?.status==='done').map(a=>({
    key:(a.action_type==='order_result'?'order':a.action_type)+':'+a.action_key,
    title:a.response?.title||a.action_key
   }))
 ];
 const parity=window.VERDICT_CONFIG?.p4TrialParity===true;
 const legalForm=parity?(
   c.kind==='criminal'
    ?'<div class="vsw-sentence"><h4>형량 선택</h4>'+
      '<label>형 종류</label><select data-v-type>'+
      '<option value="prison">징역</option><option value="suspend">징역·집행유예</option>'+
      (Number(c.charge?.fine)>0?'<option value="fine">벌금</option>':'')+
      (c.charge?.life===true?'<option value="life">무기징역</option>':'')+
      (c.charge?.death===true?'<option value="death">사형</option>':'')+
      '</select><label>징역 기간(개월, 6개월 단위)</label>'+
      '<input data-v-months type="number" min="'+esc(Math.max(6,Number(c.charge?.min||0)*12))+
      '" max="'+esc(Math.max(6,Number(c.charge?.max||1)*12))+
      '" step="6" value="'+esc(Math.min(Math.max(6,Number(c.charge?.min||0)*12),Number(c.charge?.max||1)*12))+'">'+
      '<label>벌금(만 원)</label><input data-v-fine type="number" min="0" value="0">'+
      '<label>집행유예(년)</label><input data-v-susp type="number" min="1" max="5" value="2">'+
      '<label><input data-v-with-fine type="checkbox"> 벌금 병과</label>'+
      '<small>법정형과 기록상 사유는 서버가 검증합니다. 입증되지 않은 감경은 허용하지 않습니다.</small></div>'
    :c.kind==='civil'
     ?'<div class="vsw-sentence"><h4>배상액</h4><p>청구액: '+esc(c.claim?.amount||0)+'만 원</p>'+
      '<label>명할 금액(만 원)</label><input data-v-amount type="number" min="0" max="'+
      esc(Number(c.claim?.amount)||0)+'" step="10" value="'+esc(Number(c.claim?.amount)||0)+'"></div>'
     :''
  ):'';
 const ancillaryUi=parity&&c.kind==='criminal'&&Array.isArray(c.charge?.orders)?
  '<div class="vsw-sentence"><h4>부수 명령</h4>'+
  c.charge.orders.filter(x=>!x.notice).map(x=>
   '<div class="vsw-ancillary"><label><input data-v-addon="'+esc(x.id)+
   '" type="checkbox" '+(x.fixed?'checked disabled ':'')+(x.ok===false?'disabled ':'')+
   '> '+esc(x.label||x.kind||x.id)+'</label>'+
   (Array.isArray(x.range)?'<input data-v-addon-val="'+esc(x.id)+
     '" type="number" min="'+esc(x.range[0])+'" max="'+esc(x.range[1])+
     '" step="'+esc(x.step||1)+'" value="'+esc(x.range[0])+'">':'')+
   (x.needs?'<small>'+esc(x.needs)+'</small>':'')+
   (x.ok===false?'<small>이 사건에서는 허용되지 않음</small>':'')+'</div>').join('')+
  '</div>':parity&&c.kind==='civil'&&Array.isArray(c.claim?.remedies)?
  '<div class="vsw-sentence"><h4>추가 이행 명령</h4>'+
  c.claim.remedies.map(x=>'<label><input type="checkbox" data-v-remedy="'+esc(x.id)+
   '" '+(x.ok===false?'disabled ':'')+'> '+esc(x.label||x.id)+'</label>').join('')+'</div>':'';
 const benchHtml=jointBench?.caseId===caseId&&Array.isArray(jointBench.seats)
  ?'<section class="vsw-bench" aria-label="합의부 재판관 좌석"><h4>합의부 구성 · '+esc(jointBench.myRole==='chair'?'나는 재판장':'나는 배석판사')+'</h4>'+
    jointBench.seats.map(seat=>
     '<p><strong>'+esc(seat.role==='presiding'?'재판장':'배석판사')+'</strong> · '+
     esc(seat.name||'재판관')+(seat.kind==='npc'?' <small>NPC · 재판장 권한 없음</small>':'')+
     (seat.id===user()?' <small>나</small>':'')+'</p>').join('')+
    '<small>사건을 개시한 실제 판사가 재판장입니다. 다른 실제 판사와 NPC는 항상 배석하며, NPC는 공판 개정·선고 권한이 없습니다.</small></section>'
  :'<p class="vsw-note">합의부 좌석을 서버에서 확인하는 중입니다.</p>';
 const p5on=window.VERDICT_CONFIG?.p5JointPanel===true;
 const p5controls=!p5on?'':(!panelState
  ?'<section class="vsw-p5"><h4>합의부 구성 · 판사 2명 + NPC 재판관</h4>'+
   (panelPartners?.players?.length&&panelPartners?.npcs?.length
    ?'<label>함께 심리할 판사</label><select data-p5-peer>'+
      panelPartners.players.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+
      '</select><label>NPC 재판관</label><select data-p5-npc-select>'+
      panelPartners.npcs.map(n=>'<option value="'+esc(n.id)+'">'+esc(n.name)+'</option>').join('')+
      '</select><button type="button" data-p5-open>3인 합의부 개설</button>'
    :'<p>공동 재판관 명단 확인이 필요합니다.</p><button type="button" data-p5-partners>판사·NPC 조회</button>')+
   '</section>'
  :'<section class="vsw-p5"><h4>3인 합의부 · 비공개 심의</h4>'+
   '<p>제출 '+esc(panelState.votesCast||0)+'/3 · '+
     esc(panelState.state==='majority_ready'?'다수 의견 성립':
       panelState.state==='further_deliberation'?'의견 불일치 · 추가 심의 필요':'다른 재판관 의견 대기')+'</p>'+
   '<p>내 의견: '+esc(panelState.myVote||'아직 제출하지 않음')+'</p>'+
   (!panelState.myVote&&courtActions.length>0&&
    (courtStatus?.minimumHearings==null||courtStatus.canDeliberate===true)
    ?'<label>판단</label><select data-p5-choice>'+choices.map(([v,label])=>
       '<option value="'+esc(v)+'">'+esc(label)+'</option>').join('')+'</select>'+
      '<label>비공개 심의 의견</label><textarea data-p5-note rows="3" maxlength="1000" placeholder="법정 기록에 근거한 판단 이유를 적으세요"></textarea>'+
      '<button type="button" data-p5-vote>내 의견 비공개 제출</button>':
     !panelState.myVote&&courtStatus?.canDeliberate===false
      ?'<p class="vsw-note">판결 합의는 최소 '+esc(courtStatus?.minimumHearings||2)+'회 기일을 마치고 미완료 제출명령이 없어야 시작할 수 있습니다.</p>':'')+
   (panelState.votesCast===2?'<button type="button" data-p5-decide>NPC 재판관 의견 생성</button>':'')+
   (panelState.state==='majority_ready'
     ?'<p><strong>3인 다수결: '+esc(panelState.majority||'')+'</strong></p>'
     :panelState.state==='further_deliberation'
      ?'<p>세 의견이 서로 다릅니다. 협의 후 재심의 규칙이 확정되기 전에는 선고하지 않습니다.</p>':'')+
   '<button type="button" data-p5-refresh>합의 현황 새로고침</button></section>');
 const summary='<strong>'+esc(c.title||caseId)+'</strong><p>'+esc(c.summary||'')+'</p>';
 let body='';
 if(courtTab==='case'){
  body=summary+(p5on?benchHtml:'')+'<small>공유 사건번호: '+esc(caseId)+'</small><p class="vsw-note">'+
   '두 판사가 보는 공개 세계와 배당 사건은 동일하지만, 담당 판사는 본인 사건만 심리합니다.</p>'+
   '<p>'+esc((selectedCase.common?.facts||[]).slice(0,8).join(' · '))+'</p>';
 }else if(courtTab==='day'){
  body=summary+'<p>'+esc(ready?'제'+courtStatus.hearingIndex+'회 공판 진행 중 · 공통 세계 '+courtStatus.worldDay+'일':
     '서버가 허가한 기일에서만 질문과 주문을 진행할 수 있습니다.')+'</p>'+
   (permitted&&(!p5on||jointBench?.myRole==='chair')?'<button type="button" data-world-begin>▶ 공판 개정 / 다음 기일 열기</button>':'')+
   (courtMotions.length?'<section class="vsw-motions"><h4>상대 측 신청 · 이의 및 기일 연기</h4>'+
    courtMotions.map(m=>'<article class="vsw-motion"><b>'+esc(m.label)+'</b>'+
     (m.answered?'<p>재판장 판단이 공판 기록에 남았습니다.</p>':
      ready&&(!p5on||jointBench?.myRole==='chair')?
      '<div class="vsw-motion-actions"><button type="button" data-world-motion="'+esc(m.id)+'" data-motion-choice="accept">받아들인다</button>'+
      '<button type="button" data-world-motion="'+esc(m.id)+'" data-motion-choice="reject">기각한다</button></div>':
      '<small>재판장 결정을 기다리는 중</small>')+'</article>').join('')+'</section>':'')+
   '<div data-court-outcomes>'+actions+'</div>';
 }else if(courtTab==='evidence'){
  body='<h4>증거</h4>'+evidenceNow.map(r=>{
    const key=caseId+':'+r.id+':'+r.text;
    const note=evidenceNotes.get(key);
    return '<article class="vsw-event"><small>'+esc(r.source)+'</small><strong>'+
     esc(r.title)+'</strong><p>'+esc(r.text||'')+'</p>'+
     (latestRulings.has(r.id)?'<p class="vsw-admissibility"><b>증거 판단: '+esc(rulingLabels[latestRulings.get(r.id).decision])+'</b> · 제'+esc(latestRulings.get(r.id).hearing)+'회 기일</p>':'<p class="vsw-admissibility">증거 채택 여부 검토 전</p>')+
     (canRule&&latestRulings.get(r.id)?.hearing!==Number(courtStatus?.hearingIndex)?'<div class="vsw-evidence-decisions">'+
      [['use','채택'],['conditional','조건부 채택'],['exclude','배제']].map(([decision,label])=>
        '<button type="button" data-world-evidence="'+esc(r.id)+'" data-evidence-decision="'+decision+'">'+label+'</button>').join('')+'</div>':'')+
     (note?'<aside class="vsw-ai-note"><b>AI 증거 해설 · 참고용</b><p>'+esc(note)+'</p><small>원문 기록만 판결 근거로 사용</small></aside>':
       '<button type="button" data-world-explain="'+esc(r.id)+'">AI 해설 보기 · 원문은 유지</button>')+
     '</article>'
   }).join('')+
   (evidenceNow.length?'':'<p>공개된 자료가 없습니다.</p>');
 }else if(courtTab==='witness'){
  body='<h4>증인신문</h4>'+(ready?questions.slice(0,40).map((q,i)=>
   '<p>'+courtBtn('question',q.id||'index-'+i,(q.w||'증인')+' · '+(q.q||'질문'))+'</p>').join(''):
   '<p>신문은 현재 공통 기일이 개정되어야 가능합니다.</p>')+
   '<div data-court-outcomes>'+courtActions.filter(a=>a.action_type==='question').map(a=>
    '<p><b>'+esc(a.action_key)+'</b> · '+esc(a.response?.answer||'')+'</p>').join('')+'</div>';
 }else if(courtTab==='orders'){
  body='<h4>재판장 주문</h4>'+
   (ready&&window.VERDICT_CONFIG?.p4FreeOrders===true
    ?'<div class="vsw-free-order"><label for="vsw-order-text"><b>자유 주문</b></label>'+
      '<textarea id="vsw-order-text" data-free-order rows="3" maxlength="600" placeholder="예: 사고 전후 이동 경로와 주변 CCTV 원본을 제출하도록 명합니다."></textarea>'+
      '<button type="button" data-free-order-check>AI로 주문 해석</button>'+
      '<p class="vsw-note">AI는 요청을 이해할 뿐, 존재하지 않는 증거를 만들거나 판결을 결정하지 않습니다.</p></div>':'')+
   (ready?orders.slice(0,40).map(o=>
    '<p>'+courtBtn('order',o.record,o.ask||o.record)+'</p>').join(''):
    '<p>자료 제출 명령은 개정 중에만 가능합니다.</p>')+
    (ready?due.map(a=>'<p><button type="button" data-order-result="'+esc(a.action_key)+
     '">'+esc(a.response?.title||a.action_key)+' 제출 결과 확인</button></p>').join(''):'')+
    '<div data-court-outcomes>'+courtActions.filter(a=>a.action_type.startsWith('order')).map(a=>
    '<p><b>'+esc(a.action_key)+'</b> · '+esc(a.response?.text||a.response?.status||'')+'</p>').join('')+'</div>';
 }else if(courtTab==='verdict'){
  body='<h4>판결</h4>'+(p5on?benchHtml:'')+p5controls+(finalDecision
   ?'<p><strong>확정 판결</strong> · '+esc(finalDecision.order||'')+'</p>'
   :window.VERDICT_CONFIG?.p4SharedVerdicts===true&&(verdictReady||panelState?.state==='majority_ready')&&courtActions.length
    ?'<section data-world-verdict><p>법정에 실제 제출된 증거·증언에서 근거를 고르세요.</p>'+
      (panelState
       ?'<p><strong>합의 결론: '+esc(panelState.majority||'심의 대기')+'</strong></p>'
       :'<select data-verdict-result>'+choices.map(([value,label])=>
        '<option value="'+esc(value)+'">'+esc(label)+'</option>').join('')+'</select>')+
      legalForm+ancillaryUi+
      '<fieldset class="vsw-verdict-reasons"><legend>판결 이유 · 법정 기록 근거</legend>'+
       [['strong','핵심 증거가 믿을 만하다'],['flawed','핵심 증거에 흠이 있다'],
        ['illegal','위법 수집 증거를 배제했다'],['discord','증언이 서로 엇갈린다'],
        ['consistent','증언과 증거가 일치한다'],['doubt','합리적인 의문이 남는다']]
       .map(([id,label])=>'<label><input type="checkbox" data-verdict-reason="'+id+'"> '+label+'</label>').join('')+
       '</fieldset>'+
       citations.filter(r=>!(['initial:','order:'].some(prefix=>r.key.startsWith(prefix))&&
          latestRulings.get(r.key.split(':').slice(1).join(':'))?.decision==='exclude'))
        .map(r=>'<label style="display:block;margin:8px 0"><input type="checkbox" data-cite="'+
         esc(r.key)+'"> '+esc(r.title)+'</label>').join('')+
      ((panelState?.state==='majority_ready'&&jointBench?.myRole==='chair')||!panelState
       ?'<button type="button" data-world-verdict>⚖ '+(panelState?'합의 판결 선고':'공유 판결 확정')+'</button>'
       :panelState?.state==='majority_ready'?'<p class="vsw-note">합의 결과가 확정됐습니다. 재판장이 최종 선고합니다.</p>':'')+'</section>'
    :'<p>공판 진행과 판결 원장이 확인된 후 서버에서 판결할 수 있습니다.</p>');
 }
 region.innerHTML='<div class="vsw-court-head">'+summary+'</div>'+nav+
  '<div class="vsw-court-page t4-page">'+body+'</div>';
 syncNative();
}

async function explainSharedEvidence(id){
 if(!selectedCase||!id)return;
 const rec=firstDocs.find(r=>r.id===id);
 const extra=courtActions.find(a=>a.action_type==='order_result'&&
   (a.response?.recordId||a.action_key)===id&&a.response?.status==='done');
 const original=String(rec?.text||extra?.response?.text||'').slice(0,2400);
 const title=String(rec?.title||extra?.response?.title||id);
 const key=selectedCase.caseId+':'+id+':'+original;
 if(original.length<15||evidenceNotes.has(key)||evidenceBusy.has(key))return;
 evidenceBusy.add(key);
 try{
  const answer=await window.VerdictAuth.api('/ai/evidence',{title,original});
  if(answer?.ok&&answer.result?.text)evidenceNotes.set(key,answer.result.text);
 }catch{}
 finally{evidenceBusy.delete(key);renderOffers()}
}
async function reserveOffers(){
 const status=panel?.querySelector('[data-world-offers-status]');
 if(!status||!user())return;
 sharedSlot=kstSlot();status.textContent='서버에서 사건 후보를 확인하는 중…';
 try{const d=await window.VerdictAuth.api('/world/offers',{slot:sharedSlot});
  if(!d?.ok||!Array.isArray(d.offers))throw Error('not_available');
  selectedCase=null;firstDocs=[];courtStatus=null;courtActions=[];courtTab='case';finalDecision=null;panelState=null;panelPartners=null;panelFor=null;offerCandidates=d.offers.slice(0,2);
  status.textContent='두 판사에게 같은 사건이 중복 예약되지 않습니다.';renderOffers();
 }catch{status.textContent='이 시간대에 공유 배당을 사용할 수 없습니다. 개인 재판에는 영향이 없습니다.'}
}
async function refreshMotions(){
 courtMotions=[];
 if(!selectedCase||!courtStatus?.canAct||window.VERDICT_CONFIG?.p4TrialParity!==true)return;
 const caseId=selectedCase.caseId;
 try{
  const d=await window.VerdictAuth.api('/world/court/motions?caseId='+encodeURIComponent(caseId));
  if(selectedCase?.caseId===caseId&&d?.ok&&Array.isArray(d.motions))
   courtMotions=d.motions.filter(m=>m&&typeof m.id==='string');
 }catch{courtMotions=[]}
}
async function decideSharedMotion(key,choice){
 if(!selectedCase||!courtStatus?.canAct||
  !['accept','reject'].includes(choice)||
  (window.VERDICT_CONFIG?.p5JointPanel===true&&jointBench?.myRole!=='chair'))return;
 const status=document.querySelector('[data-world-native-status]')||panel?.querySelector('[data-world-offers-status]');
 if(status)status.textContent='상대측 신청에 대한 판단을 기록하는 중…';
 try{
  const d=await window.VerdictAuth.api('/world/court/motion/decide',{
   caseId:selectedCase.caseId,key,choice,hearingIndex:courtStatus.hearingIndex});
  if(!d?.ok)throw Error('motion_not_recorded');
  await refreshCourt();
  if(status)status.textContent='상대 측 신청에 대한 판단을 공판 기록에 반영했습니다.';
 }catch{
  if(status)status.textContent='현재 기일 또는 재판장 권한을 확인하세요.';
 }
}
async function refreshCourt(){
 if(!selectedCase||window.VERDICT_CONFIG?.p4CourtActions!==true)return;
 if(window.VERDICT_CONFIG?.p5JointPanel===true){
  try{
   const d=await window.VerdictAuth.api('/world/panel/case?caseId='+encodeURIComponent(selectedCase.caseId));
   if(d?.ok&&d.case?.caseId===selectedCase.caseId){
    firstDocs=Array.isArray(d.records)?d.records:[];
    courtActions=Array.isArray(d.actions)?d.actions:[];
    courtStatus={...d.court,canAct:['chair','associate'].includes(d.role)&&d.court?.canAct===true};
    if(d.judgment)finalDecision={result:d.judgment.result,order:d.judgment.order,recordHash:d.judgment.recordHash};
    await refreshMotions();renderOffers();await refreshPanel();return;
   }
  }catch{}
  courtStatus={canAct:false};courtMotions=[];renderOffers();return;
 }
 const id=encodeURIComponent(selectedCase.caseId);
 try{
  const [status,history]=await Promise.all([
   window.VerdictAuth.api('/world/court/status?caseId='+id),
   window.VerdictAuth.api('/world/court/history?caseId='+id)
  ]);
  if(status?.ok&&history?.ok&&Array.isArray(history.actions)){
   courtStatus=status;courtActions=history.actions;await refreshMotions();renderOffers();
  }
 }catch{courtStatus=null;renderOffers()}
 if(window.VERDICT_CONFIG?.p5JointPanel===true)await refreshPanel();
}
async function refreshPanel(){
 if(!selectedCase||window.VERDICT_CONFIG?.p5JointPanel!==true)return;
 const caseId=selectedCase.caseId;
 if(panelFor!==caseId){panelFor=caseId;panelState=null;panelPartners=null;jointBench=null}
 try{
  const bench=await window.VerdictAuth.api('/world/panel/bench?caseId='+encodeURIComponent(caseId));
  if(bench?.ok&&bench.bench?.caseId===caseId)jointBench=bench.bench;
 }catch{jointBench=null}
 try{
  const status=await window.VerdictAuth.api('/world/panel/status?caseId='+encodeURIComponent(caseId));
  if(selectedCase?.caseId===caseId&&status?.ok)panelState=status;
 }catch{}
 if(!panelState&&!panelPartners){
  try{
   const found=await window.VerdictAuth.api('/world/panel/partners?caseId='+encodeURIComponent(caseId));
   if(selectedCase?.caseId===caseId&&found?.ok)panelPartners=found;
  }catch{}
 }
 renderOffers();
}
async function p5Action(kind){
 if(!selectedCase||window.VERDICT_CONFIG?.p5JointPanel!==true)return;
 const root=(typeof ui!=='undefined'&&ui.p4NativeCourt
  ?document.querySelector('[data-world-native-root]'):null)||panel;
 if(!root)return;
 const status=root.querySelector('[data-world-native-status]')||panel?.querySelector('[data-world-offers-status]');
 const caseId=selectedCase.caseId;
 try{
  if(status)status.textContent='합의부 서버 처리 중…';
  let data;
  if(kind==='partners'){panelPartners=null;return refreshPanel()}
  if(kind==='open')data=await window.VerdictAuth.api('/world/panel/open',{
   caseId,peerId:root.querySelector('[data-p5-peer]')?.value,
   npcId:root.querySelector('[data-p5-npc-select]')?.value});
  else if(kind==='vote')data=await window.VerdictAuth.api('/world/panel/vote',{
   caseId,choice:root.querySelector('[data-p5-choice]')?.value,
   note:root.querySelector('[data-p5-note]')?.value||''});
  else if(kind==='npc')data=await window.VerdictAuth.api('/world/panel/npc/decide',{caseId});
  if(kind!=='refresh'&&!data?.ok)throw Error('p5_rejected');
  await refreshPanel();
  if(status)status.textContent='합의부 상태를 서버에서 갱신했습니다.';
 }catch{
  if(status)status.textContent='합의부 요청이 승인되지 않았습니다. 다른 재판관의 투표와 기일을 확인하세요.';
 }
}
async function confirmSharedVerdict(){
 if(!selectedCase||(!courtStatus?.canDeliberate&&!courtStatus?.canAct&&panelState?.state!=='majority_ready')||window.VERDICT_CONFIG?.p4SharedVerdicts!==true||
  (window.VERDICT_CONFIG?.p5JointPanel===true&&jointBench?.myRole!=='chair'))return;
 const region=(typeof ui!=='undefined'&&ui.p4NativeCourt?
  document.querySelector('[data-world-native-root] [data-world-verdict]'):null)||
  panel?.querySelector('[data-world-verdict]');if(!region)return;
 if(panelState&&panelState.state!=='majority_ready')return;
 const result=panelState?.majority||region.querySelector('[data-verdict-result]')?.value;
 const citations=[...region.querySelectorAll('input[data-cite]:checked')].map(x=>x.dataset.cite);
 const reasons=[...region.querySelectorAll('input[data-verdict-reason]:checked')].map(x=>x.dataset.verdictReason);
 const sentence=window.VERDICT_CONFIG?.p4TrialParity===true&&selectedCase
  ?(selectedCase.card?.kind==='criminal'
   ?{type:region.querySelector('[data-v-type]')?.value||'prison',
     months:Number(region.querySelector('[data-v-months]')?.value||0),
     fine:Number(region.querySelector('[data-v-fine]')?.value||0),
     susp:Number(region.querySelector('[data-v-susp]')?.value||2),
     withFine:region.querySelector('[data-v-with-fine]')?.checked||false,
     mitigating:false,aggravating:false}
   :selectedCase.card?.kind==='civil'
    ?{amount:Number(region.querySelector('[data-v-amount]')?.value||0)}:undefined)
  :undefined;
 if(sentence){
  const addons={};
  for(const element of region.querySelectorAll('input[data-v-addon]:checked')){
   if(element.disabled)continue;
   const value=region.querySelector('input[data-v-addon-val="'+element.dataset.vAddon+'"]');
   addons[element.dataset.vAddon]=value?Number(value.value):true;
  }
  sentence.addons=addons;
  sentence.remedies=[...region.querySelectorAll('input[data-v-remedy]:checked')].map(x=>x.dataset.vRemedy);
 }
 const status=document.querySelector('[data-world-native-status]')||panel?.querySelector('[data-world-offers-status]');
 if(!citations.length){if(status)status.textContent='확인한 증거 또는 증언을 하나 이상 선택하세요.';return}
 if(!window.confirm('공유 세계에 판결을 확정할까요? 판결은 되돌릴 수 없습니다.'))return;
 if(status)status.textContent='서버 법정 기록과 판결을 확인 중…';
 try{
  const d=await window.VerdictAuth.api(panelState?'/world/panel/finalize':'/world/court/verdict',{caseId:selectedCase.caseId,result,citations,reasons,...(sentence?{sentence}:{})});
  if(!d?.ok)throw Error('verdict_invalid');
  finalDecision=d.judgment;await refreshCourt();await refreshCareer();await refresh();
  if(status)status.textContent='공유 판결 확정: '+d.judgment.order;
 }catch{if(status)status.textContent='서버에서 판결이 승인되지 않았습니다. 기일과 제출 증거를 확인하세요.'}
}
async function decideSharedEvidence(recordId,decision){
 if(!selectedCase||courtStatus?.canAct!==true||
  !['use','conditional','exclude'].includes(decision)||
  (window.VERDICT_CONFIG?.p5JointPanel===true&&jointBench?.myRole!=='chair'))return;
 const status=document.querySelector('[data-world-native-status]')||panel?.querySelector('[data-world-offers-status]');
 if(status)status.textContent='서버에 증거 판단을 기록하는 중…';
 try{
  const r=await window.VerdictAuth.api('/world/court/evidence/decide',{
   caseId:selectedCase.caseId,recordId,decision,hearingIndex:courtStatus.hearingIndex});
  if(!r?.ok)throw Error('ruling_rejected');
  await refreshCourt();
  if(status)status.textContent='증거 판단이 서버 공판 기록에 반영됐습니다.';
 }catch{
  if(status)status.textContent='증거 판단을 승인하지 못했습니다. 개정 여부와 기존 결정을 확인하세요.';
 }
}
async function beginCourt(){
 if(!selectedCase||!user()||window.VERDICT_CONFIG?.p4CourtActions!==true||
  (window.VERDICT_CONFIG?.p5JointPanel===true&&jointBench?.myRole!=='chair'))return;
 const area=panel?.querySelector('[data-world-offers-status]');
 if(area)area.textContent='서버에서 공통 기일을 확인하는 중…';
 try{
  const d=await window.VerdictAuth.api('/world/court/begin',{caseId:selectedCase.caseId});
  if(!d?.ok)throw Error('begin_failed');
  await refreshCourt();await refresh();
  if(area)area.textContent='제'+d.hearing.hearing_index+'회 기일 · 공통 세계 '+d.hearing.world_day+'일 개정';
 }catch{if(area)area.textContent='기일을 열 수 없습니다. 이전 기일의 신문·주문 기록 또는 복귀 보호를 확인하세요.'}
}
async function interpretFreeOrder(){
 if(!selectedCase||!courtStatus?.canAct||window.VERDICT_CONFIG?.p4FreeOrders!==true)return;
 const region=(typeof ui!=='undefined'&&ui.p4NativeCourt?document.querySelector('[data-world-native-root]'):null)||panel;
 const value=region?.querySelector('[data-free-order]')?.value||'';
 const status=region?.querySelector('[data-world-native-status]')||panel?.querySelector('[data-world-offers-status]');
 if(value.trim().length<8||value.length>600){
  if(status)status.textContent='구체적으로 어떤 자료가 필요한지 8~600자로 주문해 주세요.';return;
 }
 if(status)status.textContent='AI가 주문의 대상을 해석하고 있습니다…';
 try{
  const plan=await window.VerdictAuth.api('/world/court/free-order',{
   caseId:selectedCase.caseId,hearingIndex:courtStatus.hearingIndex,text:value
  });
  if(!plan?.ok)throw Error('interpretation_failed');
  if(!plan.matched){
   if(status)status.textContent='현재 사건 원본에 확인 가능한 자료가 없습니다. 사건에 없는 증거를 임의로 생성하지 않습니다.';
   return;
  }
  const record=(selectedCase.records||[]).find(r=>r.id===plan.recordId);
  if(!record||record.first===true||
     !(selectedCase.orders||[]).some(o=>o.record===record.id)){
   if(status)status.textContent='검증되지 않은 자료 제안은 법정 명령으로 사용할 수 없습니다.';return;
  }
  if(!window.confirm('AI가 '+String(record.title||record.id)+' 제출 요청으로 해석했습니다. 이 주문을 기록할까요?'))return;
  await doCourtAction('order',record.id);
 }catch{if(status)status.textContent='주문 해석을 완료하지 못했습니다. 기존 주문 선택은 계속 사용할 수 있습니다.'}
}
async function resolveOrder(key){
 if(!selectedCase||!courtStatus?.canAct)return;
 const status=panel?.querySelector('[data-world-offers-status]');
 if(status)status.textContent='이전 기일의 자료 제출 결과를 확인하고 있습니다…';
 try{
  const d=await window.VerdictAuth.api('/world/court/order/resolve',{
   caseId:selectedCase.caseId,key,hearingIndex:courtStatus.hearingIndex
  });
  if(!d?.ok)throw Error('order_not_due');
  await refreshCourt();
  if(status)status.textContent=d.response?.status==='done'
   ?'추가 자료가 법정에 제출됐습니다.':'제출 결과: '+(d.response?.status||'확인 필요');
 }catch{if(status)status.textContent='이전 기일에서 주문한 자료이거나 기일이 열렸는지 확인하세요.'}
}
async function doCourtAction(kind,key){
 if(!selectedCase||courtStatus?.canAct!==true||!['question','order'].includes(kind)||
  (window.VERDICT_CONFIG?.p5JointPanel===true&&!['chair','associate'].includes(jointBench?.myRole)))return;
 const region=panel?.querySelector('[data-world-offers-status]');
 if(region)region.textContent='서버에서 법정 기록을 검증하는 중…';
 try{
  const r=await window.VerdictAuth.api('/world/court/action',{
   caseId:selectedCase.caseId,kind,key,hearingIndex:courtStatus.hearingIndex
  });
  if(!r?.ok)throw Error('invalid_action');
  await refreshCourt();
  if(region)region.textContent='서버 법정기록에 반영됐습니다. 개인 세이브는 변경되지 않았습니다.';
 }catch{if(region)region.textContent='신문·주문이 승인되지 않았습니다. 기일과 선행 증거를 확인하세요.'}
}

async function acceptOffer(id){
 const status=panel?.querySelector('[data-world-offers-status]');
 if(!status||!offerCandidates.some(x=>x.case_id===id)||!user())return;
 status.textContent='사건 배당을 확인하는 중…';
 try{
  const d=await window.VerdictAuth.api('/world/accept',{slot:sharedSlot,caseId:id});
  if(!d?.ok||d.assignment?.case_id!==id)throw Error('claim_failed');
  const c=await window.VerdictAuth.api('/world/case?caseId='+encodeURIComponent(id));
  const r=await window.VerdictAuth.api('/world/case/initial?caseId='+encodeURIComponent(id));
  if(!c?.ok||!r?.ok||c.case?.caseId!==id)throw Error('case_unavailable');
  selectedCase=c.case;firstDocs=Array.isArray(r.records)?r.records:[];courtTab='case';finalDecision=null;panelState=null;panelPartners=null;panelFor=null;offerCandidates=[];
  status.textContent='공통 사건 배당 완료 · 공개 초기 자료만 표시';renderOffers();await refreshCourt();refresh();
 }catch{status.textContent='배당 또는 사건 자료 조회에 실패했습니다. 서버 기록을 확인해 주세요.'}
}

function renderCatchup(){
 const area=panel?.querySelector('[data-world-catchup]');if(!area)return;
 const status=area.querySelector('[data-world-lag]'),button=area.querySelector('[data-world-resume]');
 if(!catchup){status.textContent='세계 시간 확인 전';button.hidden=true;return}
 const lag=Number(catchup.lagDays||0),pending=Array.isArray(catchup.pending)?catchup.pending:[];
 if(lag>0){
  const changes=events.filter(x=>x.game_day>catchup.previousDay&&x.game_day<=catchup.worldDay);
  status.textContent='접속하지 않은 동안 세계 날짜가 '+lag+'일 진행됐습니다. 공개 사건·기사 '+changes.length+'건, 미처리 개인 기일 '+pending.length+'건. 자동 선고나 패소는 없습니다.';
  button.hidden=false;
 }else{
  status.textContent=resumeNotice||('세계 날짜 동기화 완료 · 미처리 기일 '+pending.length+'건');
  button.hidden=true;
 }
}
async function loadCatchup(){
 if(!panel||window.VERDICT_CONFIG?.p4SharedDocket!==true||!user())return;
 try{const d=await window.VerdictAuth.api('/world/catchup',undefined,{timeout:8000});
  if(d?.ok){catchup=d;renderCatchup()}}catch{}
}
async function resumeWorld(){
 const status=panel?.querySelector('[data-world-lag]');if(!status||!user())return;
 status.textContent='공통 세계에 복귀하고 기일을 확인하는 중…';
 try{
  const d=await window.VerdictAuth.api('/world/resume',{});
  if(!d?.ok||!d.resume)throw Error('resume_failed');
  const r=d.resume;
  resumeNotice='세계 '+r.world_day+'일로 복귀 완료 · 미처리 기일 '+r.rescheduled_hearings+'건을 최소 '+r.protected_until_day+'일까지 보호합니다.';
  await loadCatchup();
  await refreshCareer();
 }catch{status.textContent='복귀 처리를 확인하지 못했습니다. 개인 재판 기록은 변경하지 않았습니다.'}
}

async function refresh(){
 const u=user();if(!u){if(owner)reset('');return false}
 if(owner!==u)reset(u);
 if(loading)return false;
 loading=true;
 try{
  let count=0;
  for(let page=0;page<10;page++){
   const result=await window.VerdictAuth.api('/world/events?after='+cursor,undefined,{timeout:10000});
   if(!result?.ok||!Array.isArray(result.events))throw new Error('world_unavailable');
   for(const e of result.events){
    if(!valid(e)||e.event_id<=cursor)continue;
    if(!seen.has(e.event_key)){seen.add(e.event_key);events.push(e);count++}
    cursor=e.event_id;
   }
   if(result.events.length<LIMIT)break;
  }
  if(events.length>500){events=events.slice(-500);seen.clear();for(const e of events)seen.add(e.event_key)}
  // Missing P4 tables on older QA deployments must not break local trials or the public log.
  try{const c=await window.VerdictAuth.api('/world/clock',undefined,{timeout:8000});if(c?.ok&&c.clock)clock=c.clock}catch{}
  try{const n=await window.VerdictAuth.api('/world/npcs',undefined,{timeout:8000});if(n?.ok&&Array.isArray(n.npcs))npcs=n.npcs.slice(0,50)}catch{}
  await loadCatchup();
  // On return from another tab, the associate sees newly opened hearings,
  // submitted evidence, the canonical verdict and public NPC/news updates.
  if(selectedCase&&window.VERDICT_CONFIG?.p4CourtActions===true)await refreshCourt();
  if(panel){panel.querySelector('[data-world-status]').textContent='공개 기록 '+events.length+'건';render()}
  return true;
 }catch(e){if(panel)panel.querySelector('[data-world-status]').textContent='세계 연결을 확인할 수 없습니다. 개인 재판은 계속할 수 있습니다.';return false}
 finally{loading=false}
}
async function loadJointCase(){
 if(jointSlotLoading||window.VERDICT_CONFIG?.p5JointPanel!==true||!user())return;
 jointSlotLoading=true;
 const notice=msg=>{
  const status=document.querySelector('[data-joint-slot-status]');
  if(status)status.textContent=msg;
  const native=document.querySelector('[data-world-native-status]');
  if(native)native.textContent=msg;
 };
 try{
  let slot=await window.VerdictAuth.api('/world/panel/slot');
  if(!slot?.ok)throw Error('joint_slot_offline');
  if(!slot.occupied){
   const assigned=await window.VerdictAuth.api('/world/panel/auto-assign',{});
   if(!assigned?.ok){notice(assigned?.reason==='panel_members_unavailable'?
    '다른 판사가 합류하면 공동재판이 자동 배당됩니다.':'공동재판 사건 재고를 확인할 수 없습니다.');
    return}
   slot={ok:true,occupied:true,caseId:assigned.caseId};
  }
  if(selectedCase?.caseId!==slot.caseId){
   const c=await window.VerdictAuth.api('/world/panel/case?caseId='+encodeURIComponent(slot.caseId));
   if(!c?.ok)throw Error('joint_case_unavailable');
   selectedCase=c.case;
   firstDocs=Array.isArray(c.records)?c.records:[];
   courtActions=Array.isArray(c.actions)?c.actions:[];
   courtStatus={...(c.court||{}),canAct:['chair','associate'].includes(c.role)&&c.court?.canAct===true};
   finalDecision=null;courtTab='case';panelState=null;panelFor=null;
  }
  jointSlotState=slot;
  await refreshCourt();
  notice('공동재판 1/1 · '+String(selectedCase?.card?.title||slot.caseId));
  renderOffers();
  await refreshPanel();
 }catch{notice('공동재판 서버에 연결할 수 없습니다. 개인 사건 5건은 정상 이용 가능합니다.')}
 finally{jointSlotLoading=false}
}
function openSharedCourt(){
 if(!user())return;
 mount();if(!panel)return;
 if(window.VERDICT_CONFIG?.p5JointPanel===true&&!selectedCase)void loadJointCase();
 if(typeof ui!=='undefined'&&typeof window.VerdictNativeCourtRender==='function'){
  ui.p4NativeCourt=true;ui.tab='court';
  if(selectedCase)courtTab='case';
  renderOffers();window.VerdictNativeCourtRender();refresh();
  return;
 }
 panel.hidden=false;button?.setAttribute('aria-expanded','true');
 renderOffers();refresh();
}
function nativeCourt(){
 if(!user())return '<section class="panel t4">공유 법정에 로그인해 주세요.</section>';
 mount();renderOffers();
 const isJoint=window.VERDICT_CONFIG?.p5JointPanel===true;
 const list=isJoint&&!selectedCase?'<p>공동재판 전용 슬롯을 확인하는 중입니다. 배당 버튼을 누를 필요가 없습니다.</p>':
  panel?.querySelector('[data-world-offers-list]')?.innerHTML||'';
 const status=isJoint?'공동재판 '+(selectedCase?'1/1':'0/1')+' · 개인 재판 5건과 별도':
  panel?.querySelector('[data-world-offers-status]')?.textContent||'공유 사건 동기화 중';
 const courtContent='<section class="panel t4"><div class="t4-head"><h3>🌐 공유 법정</h3>'+
  '<button class="btn outline" type="button" data-world-native-back>사건 목록</button></div>'+
  '<p class="muted small">기존 법정의 사건·기일·증거·증인·주문·판결 메뉴를 사용합니다. 개인 사건 세이브와는 분리됩니다.</p>'+
  '<p data-world-native-status aria-live="polite">'+esc(status)+'</p>'+
  (isJoint?'':'<button class="btn outline" type="button" data-world-offers>사건 후보 확인</button>')+
  '<div data-world-native-list>'+list+'</div></section>';
 return window.VerdictCourtSurface?.frame?.('','',courtContent,'shared')||
  '<div class="court-play t4app" data-world-native-root>'+courtContent+'</div>';
}
async function refreshCareer(){
 if(careerLoading||!user()||window.VERDICT_CONFIG?.p4TrialParity!==true)return;
 careerLoading=true;
 try{
  const r=await window.VerdictAuth.api('/world/career');
  if(r?.ok){sharedCareer=r;
   const badge=document.querySelector('[data-shared-career]');
   if(badge)badge.textContent='공유 커리어 · 누적 판결 '+r.cases+'건 (개인 세이브는 유지)';
  }
 }catch{}finally{careerLoading=false}
}
function courtListEntry(){
 if(window.VERDICT_CONFIG?.p4SharedWorld!==true||!user())return '';
 const joint=window.VERDICT_CONFIG?.p5JointPanel===true;
 const current=selectedCase?.card?.title||selectedCase?.caseId||'배정 대기';
 if(!joint)return '<section class="panel tv-inbox"><h3>🌐 공유 세계 법정</h3>'+
  '<p class="muted small">공유 사건과 개인 사건의 세이브는 분리됩니다.</p>'+
  '<button class="btn primary" type="button" data-world-open>공유 법정 열기 · '+esc(current)+'</button></section>';
 return '<section class="panel tv-inbox joint-court-slot" aria-label="공동재판 전용 슬롯">'+
  '<div class="t4-head"><h3>⚖ 공동재판 <small>0~1건 · 개인 사건 5건과 별도</small></h3></div>'+
  '<p class="muted small" data-joint-slot-description>개시한 실제 판사가 재판장, 다른 실제 판사와 NPC는 배석판사입니다. NPC가 재판장을 맡는 일은 없습니다. 개인 사건 배당 한도를 차지하지 않습니다.</p>'+
  '<p class="muted small" data-joint-slot-status aria-live="polite">'+esc(panelState?.state==='majority_ready'?'합의 판결 대기':selectedCase?'진행 중: '+current:'공동재판 배정 대기')+'</p>'+
  '<p class="muted small" data-shared-career>'+esc(sharedCareer?'공유 커리어 · 누적 판결 '+sharedCareer.cases+'건':'공유 커리어 확인 전')+'</p>'+
  '<button class="btn primary" type="button" data-world-open>공동재판 법정 입장</button></section>';
}
function toggle(){if(!panel)return;const visible=panel.hidden;panel.hidden=!visible;if(visible)refresh()}
function mount(){
 if(document.querySelector('#verdict-shared-world'))return;
 const root=document.createElement('div');root.id='verdict-shared-world';root.innerHTML=
 `<button type="button" class="vsw-button" aria-label="공유 세계 연혁 열기" aria-expanded="false">🌐 공유 세계</button>
 <section class="vsw-panel" aria-label="공유 세계 공개 연혁" hidden>
  <header><strong>공유 세계</strong><button type="button" data-world-close aria-label="닫기">닫기</button></header>
  <p class="vsw-note">두 판사가 함께 보는 공개 사건·판결 연혁입니다. 개인 관계와 숨은 진실은 표시되지 않습니다.</p>
  <p data-world-status aria-live="polite">연결 확인 중</p>
  <p data-world-clock></p>
  <div data-world-list></div>
  <div data-world-npcs></div>
  <section data-world-catchup hidden><h4>복귀 및 기일 보호</h4><p data-world-lag>세계 시간 확인 중</p><button type="button" data-world-resume hidden>세계에 복귀하기</button></section>
  <section data-world-docket hidden><h4>전역 사건 후보</h4><p data-world-offers-status>서버 승인된 사건만 표시됩니다.</p>
   <button type="button" data-world-offers>사건 후보 2건 확인</button><div data-world-offers-list></div></section>
  <button type="button" data-world-refresh>새로고침</button>
 </section>`;
 document.body.appendChild(root);button=root.querySelector('.vsw-button');panel=root.querySelector('.vsw-panel');
 const set=()=>{toggle();button.setAttribute('aria-expanded',String(!panel.hidden))};
 button.onclick=set;root.querySelector('[data-world-close]').onclick=set;
 root.querySelector('[data-world-refresh]').onclick=()=>refresh();
 const docket=root.querySelector('[data-world-docket]');
 if(window.VERDICT_CONFIG?.p4SharedDocket===true){docket.hidden=false;
 root.querySelector('[data-world-catchup]').hidden=false;root.querySelector('[data-world-resume]').onclick=resumeWorld;
 root.querySelector('[data-world-offers]').onclick=reserveOffers;
 docket.addEventListener('click',e=>{const target=e.target.closest('button');if(!target)return;
 const id=target.dataset.worldAccept;if(id)acceptOffer(id);
 else if(target.dataset.courtTab){courtTab=target.dataset.courtTab;renderOffers()}
 else if(target.hasAttribute('data-world-begin'))beginCourt();
 else if(target.hasAttribute('data-world-verdict'))confirmSharedVerdict();
 else if(target.dataset.worldEvidence&&target.dataset.evidenceDecision)decideSharedEvidence(target.dataset.worldEvidence,target.dataset.evidenceDecision);
 else if(target.dataset.worldMotion&&target.dataset.motionChoice)decideSharedMotion(target.dataset.worldMotion,target.dataset.motionChoice);
 else if(target.dataset.worldExplain)explainSharedEvidence(target.dataset.worldExplain);
 else if(target.hasAttribute('data-p5-open'))p5Action('open');
 else if(target.hasAttribute('data-p5-vote'))p5Action('vote');
 else if(target.hasAttribute('data-p5-decide'))p5Action('npc');
 else if(target.hasAttribute('data-p5-refresh'))p5Action('refresh');
 else if(target.hasAttribute('data-p5-partners'))p5Action('partners');
 else if(target.hasAttribute('data-free-order-check'))interpretFreeOrder();
 else if(target.dataset.orderResult)resolveOrder(target.dataset.orderResult);
 else if(target.dataset.courtKind&&target.dataset.courtKey)doCourtAction(target.dataset.courtKind,target.dataset.courtKey)})}
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-world-open]')){e.preventDefault();openSharedCourt()}});
 document.addEventListener('click',e=>{
  const target=e.target.closest?.('button'),native=target?.closest('[data-world-native-root]');
  if(!native)return;
  if(target.hasAttribute('data-world-native-back')){
   if(typeof ui!=='undefined'&&typeof window.VerdictNativeCourtRender==='function'){
    ui.p4NativeCourt=false;ui.tab='courtList';window.VerdictNativeCourtRender();
   }
   return;
  }
  if(target.hasAttribute('data-world-offers'))return reserveOffers();
  const id=target.dataset.worldAccept;
  if(id)return acceptOffer(id);
  if(target.dataset.courtTab){courtTab=target.dataset.courtTab;return renderOffers()}
  if(target.hasAttribute('data-world-begin'))return beginCourt();
  if(target.hasAttribute('data-world-verdict'))return confirmSharedVerdict();
  if(target.dataset.worldEvidence&&target.dataset.evidenceDecision)return decideSharedEvidence(target.dataset.worldEvidence,target.dataset.evidenceDecision);
  if(target.dataset.worldMotion&&target.dataset.motionChoice)return decideSharedMotion(target.dataset.worldMotion,target.dataset.motionChoice);
  if(target.dataset.worldExplain)return explainSharedEvidence(target.dataset.worldExplain);
  if(target.hasAttribute('data-p5-open'))return p5Action('open');
  if(target.hasAttribute('data-p5-vote'))return p5Action('vote');
  if(target.hasAttribute('data-p5-decide'))return p5Action('npc');
  if(target.hasAttribute('data-p5-refresh'))return p5Action('refresh');
  if(target.hasAttribute('data-p5-partners'))return p5Action('partners');
  if(target.hasAttribute('data-free-order-check'))return interpretFreeOrder();
  if(target.dataset.orderResult)return resolveOrder(target.dataset.orderResult);
  if(target.dataset.courtKind&&target.dataset.courtKey)
   return doCourtAction(target.dataset.courtKind,target.dataset.courtKey);
 });

 const style=document.createElement('style');style.textContent=
 '#verdict-shared-world{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 80px);z-index:7500;font:inherit}' +
 '.vsw-button{padding:9px 13px;border-radius:22px;background:#182e42;color:#fff;border:1px solid #a8926c;box-shadow:0 2px 12px #0004;cursor:pointer}' +
 '.vsw-panel{position:absolute;right:0;bottom:48px;width:min(390px,calc(100vw - 24px));max-height:min(70vh,600px);overflow:auto;padding:15px;border-radius:14px;box-sizing:border-box;background:#f6f5f0;color:#1b2a36;border:1px solid #b6a58a;box-shadow:0 8px 30px #0005}' +
 '.vsw-six-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:10px 0}.vsw-six-tabs button{padding:8px 4px;font-size:12px;cursor:pointer}.vsw-court-page{max-height:44vh;overflow:auto}.vsw-panel[hidden]{display:none}.vsw-panel header{display:flex;justify-content:space-between;align-items:center}.vsw-panel button{cursor:pointer}.vsw-note{font-size:12px;line-height:1.5;color:#5e6972}' +
 '.vsw-panel [data-world-status]{font-size:12px}.vsw-event{padding:10px 0;border-top:1px solid #d6d3ca}.vsw-event small{display:block;color:#65737d}.vsw-event strong{display:block;margin:4px 0}.vsw-event p{margin:4px 0;font-size:13px;line-height:1.5}';
 document.head.appendChild(style);
}
function start(){
 if(window.VERDICT_CONFIG?.p4SharedWorld!==true||!user())return;
 mount();refresh();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 addEventListener('online',()=>refresh());
 setInterval(()=>{if(!document.hidden)refresh()},60000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
function courtSnapshot(){
 if(!selectedCase)return null;
 // Public, read-only projection only; never materialize server truth/world branches.
 return {
  caseId:selectedCase.caseId,kind:selectedCase.card?.kind||null,
  role:jointBench?.myRole||(courtStatus?.canAct?'chair':'associate'),
  hearingIndex:Number(courtStatus?.hearingIndex)||0,
  gameDay:Number(courtStatus?.worldDay)||0,
  status:finalDecision?'finalized':courtStatus?.canAct?'in_hearing':'awaiting_hearing',
  evidence:[...firstDocs.map(r=>({id:r.id,title:r.title,source:'initial'})),
    ...courtActions.filter(a=>a.action_type==='order_result'&&a.response?.status==='done')
      .map(a=>({id:a.response?.recordId||a.action_key,title:a.response?.title,source:'court_order'}))],
  actions:courtActions.map(a=>({type:a.action_type,key:a.action_key,
    hearingIndex:a.hearing_index,responseStatus:a.response?.status||null})),
  judgment:finalDecision?{order:finalDecision.order,result:finalDecision.result}:null
 };
}
window.VerdictSharedWorld={refresh,career:()=>sharedCareer,open:openSharedCourt,nativeCourt,courtListEntry,
 courtSnapshot,get events(){return events.map(x=>({...x,public_data:{...x.public_data}}))},get cursor(){return cursor},get selectedCase(){return selectedCase?JSON.parse(JSON.stringify(selectedCase)):null},get clock(){return clock?{...clock}:null},get catchup(){return catchup?JSON.parse(JSON.stringify(catchup)):null},get npcs(){return npcs.map(n=>({...n,public_profile:{...n.public_profile}}))}};
})();
