/* THE VERDICT v6.2 — presentation-only courtroom layer.
   Never reads or writes saves, outcomes, trial decisions or scoring. */
(()=>{'use strict';
 const STYLE_ID='verdict-court-visual-style';
 const css=`
/* courtroom scene */
.tv-scene{position:relative;isolation:isolate;overflow:hidden;margin:0 0 16px;border-radius:18px;background:linear-gradient(180deg,#192638 0%,#334353 58%,#60503f 59%,#493a30 100%);min-height:188px;color:#fff;box-shadow:0 12px 32px #17263825}
.tv-scene:before{content:"";position:absolute;inset:0 0 43%;background:repeating-linear-gradient(90deg,transparent 0 13%,#ffffff08 13.3% 13.7%,transparent 14% 26%),linear-gradient(90deg,#101b2a88,transparent 20% 80%,#101b2a88)}
.tv-scene:after{content:"";position:absolute;left:50%;top:14px;transform:translateX(-50%);width:70px;height:76px;border:1px solid #d9ba8050;border-radius:45% 45% 15% 15%;background:radial-gradient(circle at 50% 32%,#ead7a280 0 5px,transparent 6px),linear-gradient(110deg,#a4824a65,#e2c78c77,#88673665);clip-path:polygon(15% 0,85% 0,100% 20%,90% 82%,50% 100%,10% 82%,0 20%)}
.tv-scene-stage{position:absolute;inset:auto 0 0;height:98px;display:flex;align-items:end;justify-content:center;gap:5px}
.tv-figure{width:72px;height:88px;position:relative;flex:none}
.tv-figure:before{content:"";position:absolute;left:24px;top:4px;width:26px;height:32px;border-radius:48% 48% 40% 40%;background:#ae9a89;box-shadow:inset 0 8px #29313a}
.tv-figure:after{content:"";position:absolute;bottom:-14px;left:3px;width:66px;height:69px;border-radius:26px 26px 8px 8px;background:linear-gradient(90deg,#182332,#2e3a48 50%,#15202e)}
.tv-figure.judge{transform:scale(1.12);z-index:1}.tv-figure.judge:after{background:linear-gradient(90deg,#111721,#28303b,#111721)}
.tv-bench{position:absolute;bottom:0;width:100%;height:37px;background:linear-gradient(#805c3d,#513925);border-top:5px solid #b0895d;z-index:2;box-shadow:0 -3px 0 #372718}
.tv-scene-label{position:absolute;z-index:3;top:14px;left:16px;display:flex;flex-direction:column;gap:4px;max-width:63%}
.tv-scene-label b{font-size:11px;letter-spacing:.16em;color:#e7ca96}.tv-scene-label span{font-size:15px;font-weight:750;line-height:1.35}
.tv-scene-caption{position:absolute;z-index:3;right:12px;bottom:9px;color:#eee1cf;font-size:10px;letter-spacing:.08em}
.tv-portrait{--tone:#aebdc7;display:grid;place-items:center;flex:none;overflow:hidden;position:relative;background:linear-gradient(160deg,#e6ebed,#b7c6cf);border:1px solid #c8d1d5;width:76px;height:90px;border-radius:8px 8px 4px 4px}
.tv-portrait:before{content:"";position:absolute;width:30px;height:35px;top:15px;border-radius:48% 48% 42% 42%;background:var(--tone);box-shadow:inset 0 7px #313740}
.tv-portrait:after{content:"";position:absolute;bottom:-17px;width:70px;height:56px;background:linear-gradient(95deg,#28394c,#455267,#253445);border-radius:34px 34px 0 0}
.tv-portrait-stamp{position:absolute;z-index:2;bottom:3px;right:4px;color:#f7eee3;font-size:8px;letter-spacing:.08em}
.t4-person.tv-person-enhanced{position:relative;display:grid;grid-template-columns:76px minmax(0,1fr);column-gap:13px;align-items:start}
.t4-person.tv-person-enhanced>.tv-portrait{grid-row:1 / span 3}
.t4-person.tv-person-enhanced>p{grid-column:2}
.t4-pager[data-kind="witness"] .tv-witness-banner{display:flex;align-items:center;gap:15px;padding:14px;margin-bottom:14px;border-radius:14px;background:linear-gradient(110deg,#edf1f1,#fcf9f4);border:1px solid #d8d9d4}
.tv-witness-banner .tv-portrait{width:78px;height:94px}
.tv-witness-banner strong{display:block;font-size:16px;color:#23354c}
.tv-witness-banner small{display:block;color:#73818b;font-size:11px;margin-top:4px}
.t4-pager[data-kind="evidence"] .tv-evidence-banner{display:flex;align-items:center;gap:14px;padding:12px 14px;margin-bottom:14px;border-radius:13px;background:#f5f1e9;border:1px solid #dfd3bc}
.tv-evidence-file{flex:none;width:55px;height:72px;background:#fffdfa;border:1px solid #c9baa1;box-shadow:4px 5px 0 #d8c9ad;position:relative;border-radius:2px}
.tv-evidence-file:before{content:"";position:absolute;top:15px;left:11px;width:32px;height:2px;background:#c0b4a1;box-shadow:0 10px #d4c8b6,0 20px #d4c8b6,0 30px #d4c8b6}
.tv-evidence-file:after{content:"증";position:absolute;bottom:7px;right:6px;border:2px solid #b65b51;color:#b65b51;border-radius:50%;width:20px;height:20px;text-align:center;line-height:16px;font-size:10px;transform:rotate(-16deg)}
.tv-evidence-banner b{display:block;font-size:12px;color:#594b37}.tv-evidence-banner span{display:block;font-size:11px;color:#7c705f;margin-top:4px}
@media(max-width:600px){.tv-scene{min-height:160px}.tv-scene-stage{transform:scale(.88);transform-origin:center bottom}.tv-scene-label span{font-size:13px}.t4-person.tv-person-enhanced{grid-template-columns:64px minmax(0,1fr);gap:9px}.t4-person .tv-portrait{width:64px;height:78px}}
@media(prefers-reduced-motion:no-preference){.tv-scene{animation:tv-enter .3s ease-out}.tv-evidence-banner,.tv-witness-banner{animation:tv-enter .18s ease-out}@keyframes tv-enter{from{opacity:.6;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}}
`;
 if(!document.getElementById(STYLE_ID)){const style=document.createElement('style');style.id=STYLE_ID;style.textContent=css;document.head.append(style)}
 const escapeText=v=>String(v||'').replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));
 function portrait(seed){let h=0;for(const c of seed)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;const tones=['#b5a08e','#d4af93','#9b8576','#c3a18b','#a9968a'];const p=document.createElement('div');p.className='tv-portrait';p.setAttribute('role','img');p.setAttribute('aria-label','인물의 신원을 나타내는 익명 일러스트');p.style.setProperty('--tone',tones[h%tones.length]);p.innerHTML='<span class="tv-portrait-stamp">THE VERDICT</span>';return p}
 function scene(){const s=document.createElement('div');s.className='tv-scene';s.setAttribute('role','img');s.setAttribute('aria-label','중앙 재판장과 양측 좌석이 있는 법정 일러스트');s.innerHTML='<div class="tv-scene-label"><b>THE VERDICT · COURTROOM</b><span>법정에서 진실을 묻다</span></div><div class="tv-scene-stage"><div class="tv-figure"></div><div class="tv-figure judge"></div><div class="tv-figure"></div></div><div class="tv-bench"></div><div class="tv-scene-caption">증거와 증언으로 판단합니다</div>';return s}
 function enhance(){
  if(!document.body.classList.contains('t4-court'))return;
  const root=document.querySelector('#app');if(!root)return;
  const hdr=root.querySelector('.court-play-header');if(hdr&&!root.querySelector('.tv-scene'))hdr.insertAdjacentElement('afterend',scene());
  root.querySelectorAll('.t4-person:not(.tv-person-enhanced)').forEach(p=>{const b=p.querySelector('.t4-name');if(!b)return;p.classList.add('tv-person-enhanced');p.insertBefore(portrait(b.textContent.trim()),p.firstChild)});
  root.querySelectorAll('.t4-pager[data-kind="witness"]:not(.tv-enhanced)').forEach(p=>{p.classList.add('tv-enhanced');const n=p.querySelector('.t4-name,.t4-who');const title=(n?.textContent||p.querySelector('h4,h3,b,strong')?.textContent||'법정 증인').trim();const d=document.createElement('div');d.className='tv-witness-banner';d.append(portrait(title));const text=document.createElement('div');const st=document.createElement('strong');st.textContent=title;const sm=document.createElement('small');sm.textContent='증인 신문 · 기록에 남는 진술';text.append(st,sm);d.append(text);p.insertBefore(d,p.firstChild)});
  root.querySelectorAll('.t4-pager[data-kind="evidence"]:not(.tv-enhanced)').forEach(p=>{p.classList.add('tv-enhanced');const d=document.createElement('div');d.className='tv-evidence-banner';d.innerHTML='<div class="tv-evidence-file" aria-hidden="true"></div><div><b>증거기록 열람</b><span>제출 자료와 확보 경위 · 증거능력 검토</span></div>';p.insertBefore(d,p.firstChild)});
 }
 let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})};
 const observer=new MutationObserver(schedule);
 function start(){if(!document.querySelector('#app'))return;observer.observe(document.querySelector('#app'),{childList:true,subtree:true});schedule()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

/* Advanced presentation: classify evidence, render a document-specific preview,
   animate witness answers and courtroom events without changing any game state. */
const extended=document.createElement('style');
extended.textContent=`
.tv-evidence-preview{padding:15px;background:#fefcf7;border:1px solid #d7c9ae;border-radius:12px;margin:0 0 14px;box-shadow:0 3px 12px #33270f0c}
.tv-ev-heading{display:flex;align-items:center;gap:12px;border-bottom:1px solid #e6decb;padding-bottom:12px;margin-bottom:12px}
.tv-ev-icon{font-size:27px;width:52px;height:52px;display:grid;place-items:center;background:#eee6d7;border-radius:12px}
.tv-ev-heading b{display:block;color:#393e4b;font-size:14px}.tv-ev-heading small{display:block;color:#8a7b65;font-size:11px}
.tv-ev-paper{max-width:430px;margin:auto;padding:16px;border:1px solid #d7d0c1;background:white;min-height:100px}
.tv-ev-paper-title{font-size:13px;font-weight:800;color:#334052;margin-bottom:10px}
.tv-ev-lines{height:4px;background:#dce1e3;margin:10px 0;border-radius:5px}.tv-ev-lines:nth-child(even){width:78%}.tv-ev-lines:nth-child(odd){width:93%}
.tv-ev-chat{display:flex;flex-direction:column;gap:9px}.tv-ev-bubble{width:75%;background:#e5ebec;border-radius:14px 14px 14px 3px;padding:12px;font-size:11px;color:#55646d}.tv-ev-bubble:nth-child(even){align-self:flex-end;background:#f6e3c3;border-radius:14px 14px 3px 14px}
.tv-ev-cctv{position:relative;height:130px;background:linear-gradient(145deg,#263741,#101b28);color:#dde6e8;display:grid;place-items:center;border-radius:7px;overflow:hidden}
.tv-ev-cctv:after{content:"REC ●   CCTV — FILE PREVIEW";position:absolute;left:10px;top:9px;font:9px monospace;color:#f8bbbb}
.tv-ev-wave{height:62px;background:repeating-linear-gradient(90deg,transparent 0 3px,#9ec0b2 3px 5px,transparent 5px 11px);clip-path:polygon(0% 45%,5% 28%,10% 75%,15% 10%,20% 55%,25% 30%,30% 75%,35% 10%,40% 55%,45% 60%,50% 14%,55% 66%,60% 28%,65% 70%,70% 15%,75% 50%,80% 25%,85% 76%,90% 28%,95% 65%,100% 45%,100% 100%,0 100%)}
.tv-court-toast{position:fixed;left:50%;bottom:85px;transform:translateX(-50%);z-index:9998;background:#192a3d;color:#f4e6cf;border:1px solid #c1a77e;padding:13px 22px;border-radius:13px;box-shadow:0 14px 35px #0005;font-size:13px;font-weight:750;pointer-events:none;animation:tv-toast-in .32s ease-out, tv-toast-out .45s 2s forwards;max-width:90vw;text-align:center}
@keyframes tv-toast-in{from{opacity:0;transform:translate(-50%,15px)}to{opacity:1;transform:translate(-50%,0)}}@keyframes tv-toast-out{to{opacity:0}}
.tv-speaker{box-shadow:inset 4px 0 #c9a66b}
@media(prefers-reduced-motion:reduce){.tv-court-toast{animation:none}}
`;
document.head.append(extended);
const evidenceKinds=[
 {rx:/cctv|영상|블랙박스|녹화|카메라|사진|촬영|화면|이미지/i,key:'video',icon:'▣',label:'영상·사진 자료'},
 {rx:/문자|카톡|카카오|대화|메신저|채팅|메시지|sns/i,key:'chat',icon:'▤',label:'디지털 대화 기록'},
 {rx:/녹음|통화|음성|소리|오디오/i,key:'audio',icon:'◉',label:'음성·통화 기록'},
 {rx:/계약|진단|증명|계좌|거래|영수증|기록|보고서|문서|일지|서면/i,key:'document',icon:'▤',label:'공식·서면 자료'}
];
function classifyEvidence(text){return evidenceKinds.find(x=>x.rx.test(text))||{key:'document',icon:'▤',label:'사건 기록'}}
function evidenceArt(kind,title){
 if(kind==='video')return '<div class="tv-ev-cctv" aria-label="영상 자료 모형">▣ 영상 자료를 확인하세요</div>';
 if(kind==='chat')return '<div class="tv-ev-chat" aria-label="대화 기록 모형"><div class="tv-ev-bubble">제출된 대화의 내용을 확인하세요.</div><div class="tv-ev-bubble">원본성과 맥락을 검토하세요.</div></div>';
 if(kind==='audio')return '<div class="tv-ev-wave" aria-label="음성 파형 모형"></div>';
 return '<div class="tv-ev-paper"><div class="tv-ev-paper-title">'+escapeText(title)+'</div><div class="tv-ev-lines"></div><div class="tv-ev-lines"></div><div class="tv-ev-lines"></div><div class="tv-ev-lines"></div></div>'
}
function enhancedEvidence(root){
 root.querySelectorAll('.t4-pager[data-kind="evidence"]').forEach(p=>{
  if(p.querySelector('.tv-evidence-preview'))return;
  const title=p.querySelector('h4,h3,strong,.t4-ev-title')?.textContent?.trim()||'제출 증거';
  const kind=classifyEvidence(p.textContent);
  const d=document.createElement('section');d.className='tv-evidence-preview';d.setAttribute('aria-label',kind.label+' 시각화');
  d.innerHTML='<div class="tv-ev-heading"><span class="tv-ev-icon">'+kind.icon+'</span><div><b>'+escapeText(title)+'</b><small>'+kind.label+' · 내용은 아래 원문을 기준으로 판단</small></div></div>'+evidenceArt(kind.key,title);
  const banner=p.querySelector('.tv-evidence-banner');(banner||p.firstChild)?.after(d);
 });
}
function alertCourt(message){
 if(document.querySelector('.tv-court-toast'))return;
 const t=document.createElement('div');t.className='tv-court-toast';t.setAttribute('role','status');t.textContent=message;document.body.append(t);
 window.setTimeout(()=>t.remove(),2600);
}
document.addEventListener('click',e=>{
 if(!document.body.classList.contains('t4-court'))return;
 const action=e.target.closest('[data-action]');if(!action)return;
 const a=action.dataset.action||'';
 const text=(action.textContent||'').trim();
 if(a==='t4page')return;
 if(/증거|evidence/i.test(text)&&/t4|evidence/i.test(a))alertCourt('증거자료를 제시합니다');
 else if(/증인|질문|신문|대질|추궁/i.test(text)&&/t4|witness/i.test(a))alertCourt('증인신문이 진행됩니다');
 else if(/선고|판결/i.test(text)&&/t4confirm/i.test(a))alertCourt('재판부가 판결을 선고합니다');
},true);
const originalEnhance=enhance;
enhance=function(){originalEnhance();const root=document.querySelector('#app');if(root&&document.body.classList.contains('t4-court'))enhancedEvidence(root)};

})();
