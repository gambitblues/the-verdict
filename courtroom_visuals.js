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
})();
