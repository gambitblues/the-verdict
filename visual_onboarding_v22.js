/* THE VERDICT visual refresh v2.2 — mobile-first career onboarding */
'use strict';
(()=>{
const oldSetup=setup;
setup=function(){
 const chosen=Number.isInteger(S.style)?S.style:0;
 modal('새 커리어 시작',`
 <div class="onboard-head"><div class="onboard-seal">⚖</div><div class="onboard-kicker">THE VERDICT · CAREER 01</div><h3>당신의 판결이<br>한 사람의 인생을 바꿉니다.</h3><p>2027년 · 신임 판사 35세 · 40년의 기록</p></div>
 <div class="onboard-field"><label for="playerName">판사 이름</label><input id="playerName" class="control" maxlength="16" placeholder="이름을 입력하세요" autocomplete="off"></div>
 <div class="onboard-choice-head"><strong>프로필 스타일</strong><small>시작 후 변경 가능 · 외형은 판결에 영향 없음</small></div>
 <div class="onboard-portrait-grid">${[0,1,2,3,4].map(i=>`<button type="button" class="onboard-portrait ${i===chosen?'selected':''}" data-action="style" data-i="${i}" aria-label="스타일 ${i+1}" aria-pressed="${i===chosen}"><div class="onboard-face">${avatar('self',i)}</div><span>STYLE ${String(i+1).padStart(2,'0')}</span></button>`).join('')}</div>
 <div class="onboard-note"><span>●</span> 판결·동료·가족·사건 기록은 자동 저장됩니다.</div>`,
 '<button class="btn primary full onboard-start" data-action="start">나의 법관 커리어 시작하기 <span>→</span></button>');
};
const oldClick=clicker;
clicker=function(e){
 const b=e.target.closest('[data-action]');if(b?.dataset.action==='style'){
 S.style=Number(b.dataset.i);const modalRoot=document.querySelector('#modal-root');
 modalRoot?.querySelectorAll('.onboard-portrait').forEach((node,i)=>{const yes=i===S.style;node.classList.toggle('selected',yes);node.setAttribute('aria-pressed',String(yes))});
 save();return;
 }
 return oldClick(e);
};
const css=document.createElement('style');css.textContent=`
/* Startup overlay: deliberately no internal scrolling on normal phone sizes */
#modal-root .modal-veil:has(.onboard-head){z-index:20000;padding:16px;align-items:center;overflow-y:auto;background:rgba(8,18,28,.86);backdrop-filter:blur(7px)}
#modal-root .modal:has(.onboard-head){width:min(440px,100%);max-height:min(95dvh,850px);overflow-y:auto;padding:0;border:1px solid #bb9a6d;border-radius:22px;background:#f9f7f2;box-shadow:0 24px 80px #080d16b3;color:#253849}
#modal-root .modal:has(.onboard-head)>h2{display:none}
#modal-root .modal:has(.onboard-head)>div:nth-child(2){padding:0 22px}
.onboard-head{text-align:center;background:linear-gradient(150deg,#17283c,#2b4354);color:#f4eddf;margin:0 -22px 20px;padding:22px 20px 24px}
.onboard-seal{font-family:serif;display:inline-grid;place-items:center;width:45px;height:45px;border:1px solid #c7a370;border-radius:50%;font-size:23px;color:#cba76e;margin-bottom:10px}
.onboard-kicker{font-size:10px;letter-spacing:2.3px;color:#d3b689;font-weight:700}
.onboard-head h3{font-size:24px;line-height:1.38;margin:12px 0 7px;color:#fff;font-weight:700;word-break:keep-all}
.onboard-head p{font-size:12px;color:#c5cfd2;margin:0}
.onboard-field label{display:block;font-size:13px;font-weight:700;margin:0 0 8px}
.onboard-field input{width:100%;border:1px solid #d1d9dd;border-radius:12px;padding:13px 14px;background:#fff;min-height:48px;font-size:16px}
.onboard-choice-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:19px 0 10px}
.onboard-choice-head strong{font-size:14px}.onboard-choice-head small{font-size:10px;color:#88939b}
.onboard-portrait-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
.onboard-portrait{min-width:0;background:white;border:2px solid #d8dedf;border-radius:11px;padding:5px 2px 6px;cursor:pointer;color:#6d7c87}
.onboard-portrait.selected{border-color:#b98b4d;background:#fdf6e9;box-shadow:0 0 0 2px #b98b4d22;color:#805b2b}
.onboard-face{height:92px;display:flex;justify-content:center;align-items:flex-end;overflow:hidden}
.onboard-face .avatar{height:88px;width:auto;max-width:100%}
.onboard-face svg{width:100%;height:100%;object-fit:contain}
.onboard-portrait span:not(.avatar){display:block;font-size:8px;font-weight:800;letter-spacing:.4px;margin-top:4px}
.onboard-note{font-size:11px;color:#687e7c;margin:16px 0 9px}.onboard-note span{color:#4c8f75;font-size:9px}
#modal-root .modal:has(.onboard-head)>.modal-actions{padding:9px 22px 20px;margin:0}
.onboard-start{border-radius:12px!important;min-height:50px;background:#ad8550!important;color:#fff!important;font-size:14px!important;font-weight:700}
.onboard-start span{margin-left:12px}
@media(max-height:740px){.onboard-head{padding:12px 18px 15px;margin-bottom:13px}.onboard-head h3{font-size:20px;margin:7px 0}.onboard-seal{width:33px;height:33px;font-size:18px;margin-bottom:5px}.onboard-face{height:72px}.onboard-face .avatar{height:68px}.onboard-choice-head{margin-top:11px}.onboard-note{margin:8px 0}}
`;document.head.appendChild(css);
})();