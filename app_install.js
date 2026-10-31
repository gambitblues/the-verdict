/* THE VERDICT — install as a home-screen app.
 * Shows a short guide on the home screen when the game runs in a normal browser tab.
 * iOS (Safari or Chrome): Share → "홈 화면에 추가". Android Chrome: native install prompt.
 * On iOS the home-screen app has its own storage, so the card offers a backup file first.
 */
'use strict';
(()=>{
const KEY='verdict_install_card_hidden';
const ua=navigator.userAgent||'';
const ios=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
const iosChrome=ios&&/CriOS/.test(ua);
const inApp=/KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua);
const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
let deferred=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(ui?.tab==='home'&&!ui.modal)render()});
window.addEventListener('appinstalled',()=>{deferred=null;try{localStorage.setItem(KEY,'1')}catch{}render()});
const hidden=()=>{try{return localStorage.getItem(KEY)==='1'}catch{return false}};

function card(){
 if(standalone()||hidden())return '';
 let steps;
 if(inApp)steps=['오른쪽 위 메뉴(⋮ 또는 ···)를 누르세요.','<b>다른 브라우저로 열기</b>(Safari 또는 Chrome)를 고르세요.','열린 브라우저에서 이 안내를 다시 따라 하세요.'];
 else if(iosChrome)steps=['주소창 오른쪽의 <b>공유 버튼</b>(□↑)을 누르세요.','<b>홈 화면에 추가</b>를 고르세요.','홈 화면의 THE VERDICT 아이콘으로 실행하세요.'];
 else if(ios)steps=['화면 아래의 <b>공유 버튼</b>(□↑)을 누르세요.','목록을 내려 <b>홈 화면에 추가</b>를 고르세요.','홈 화면의 THE VERDICT 아이콘으로 실행하세요.'];
 else if(deferred)steps=null;
 else steps=['브라우저 메뉴(⋮)를 누르세요.','<b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 고르세요.'];
 const hasSave=!!S?.name;
 return `<section class="install-card"><h3>📱 홈 화면에 앱으로 설치하기</h3>
 <p class="small">설치하면 주소창 없이 전체 화면으로 열리고, 아이콘 한 번으로 바로 들어올 수 있어요.</p>
 ${steps?`<ol>${steps.map(s=>`<li>${s}</li>`).join('')}</ol>`:''}
 ${ios&&hasSave?`<p class="note">아이폰에서는 홈 화면 앱과 브라우저의 저장 공간이 따로예요. 지금 하던 게임을 이어가려면 먼저 <b>백업 파일 저장</b>을 누르고, 홈 화면 앱의 시작 화면에서 <b>저장 파일 불러오기</b>로 옮기세요.</p>`:''}
 <div class="row">${deferred?'<button class="btn primary mini" data-action="installPrompt">앱 설치</button>':''}${ios&&hasSave?'<button class="btn outline mini" data-action="export">백업 파일 저장</button>':''}<button class="btn outline mini" data-action="installHide">닫기</button></div></section>`;
}

const priorHome=home;
home=function(){return card()+priorHome()};

const priorClick=clicker;
clicker=function(e){
 const el=e.target.closest('[data-action]'),a=el?.dataset.action;
 if(a==='installHide'){try{localStorage.setItem(KEY,'1')}catch{}render();return}
 if(a==='installPrompt'&&deferred){deferred.prompt();deferred.userChoice.finally(()=>{deferred=null;render()});return}
 return priorClick(e);
};
window.VerdictInstall={standalone,card};
})();
