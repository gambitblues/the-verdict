/* THE VERDICT — unified judge ID portrait (gender, face, complexion, hair, glasses, outfit). */
'use strict';
(()=>{
const oldAvatar=avatar,oldHome=home,oldSetup=setup,oldClick=clicker,oldShell=shell;
const choices={
 gender:[['masculine','남성형'],['feminine','여성형'],['neutral','중성형']],
 face:[['oval','계란형'],['round','둥근형'],['square','각진형']],
 skin:[['fair','밝음'],['medium','중간'],['deep','어두움']],
 hair:[['part','가르마'],['crop','숏컷'],['bob','단발'],['ponytail','묶음'],['wave','웨이브'],['slick','올백']],
 glasses:[['no','안경 없음'],['yes','안경']],
 outfit:[['robe','법복'],['suit','정장']]
};
const skinMap={fair:'#f1c9a9',medium:'#d6a07c',deep:'#9d644d'};
const darkMap={fair:'#ca9279',medium:'#ad7054',deep:'#7e4b39'};
const hairMap={part:'#302b30',crop:'#28292d',bob:'#3f2d2d',ponytail:'#332b31',wave:'#453338',slick:'#242b31'};
function avatarState(){
 if(!S.judgeAvatar){S.judgeAvatar={gender:S.style===4?'feminine':'masculine',face:'oval',skin:'medium',hair:['crop','part','slick','wave','bob'][Math.max(0,Math.min(4,S.style||0))],glasses:false,outfit:'robe'};}
 return S.judgeAvatar;
}
function portrait(settings,klass){
 const g=settings||avatarState(),color=skinMap[g.skin]||skinMap.medium,shade=darkMap[g.skin]||darkMap.medium,hair=hairMap[g.hair]||hairMap.part;
 const shapes={round:'M42 60 Q42 27 81 26 Q120 27 120 61 Q120 115 82 119 Q42 113 42 60Z',oval:'M42 60 Q43 18 81 21 Q120 21 120 60 Q119 119 81 125 Q41 119 42 60Z',square:'M43 53 Q45 23 81 24 Q116 24 118 51 L118 103 Q106 122 81 123 Q54 120 44 104Z'};
 const silhouette=shapes[g.face]||shapes.oval;
 const wide=g.gender==='feminine',neutral=g.gender==='neutral',longHair=wide&&['bob','ponytail','wave'].includes(g.hair);
 const back=longHair?'<path d="M36 64Q25 5 81 11 Q135 8 126 67 L134 155 Q103 175 84 125 L62 128 Q36 170 27 147Z" fill="'+hair+'"/>':'';
 const hairFront={
  part:'<path d="M39 64 Q27 29 51 16 Q72 6 84 21 Q112 6 124 52 Q109 41 91 32 Q67 42 39 64Z" fill="'+hair+'"/>',
  crop:'<path d="M39 64 Q33 22 70 17 Q112 11 125 55 Q94 39 74 42 Q49 38 39 64Z" fill="'+hair+'"/>',
  bob:'<path d="M33 82 Q28 18 75 15 Q128 9 127 84 L119 118 L111 76 Q105 42 80 37 Q50 41 43 78 L42 117Z" fill="'+hair+'"/>',
  ponytail:'<path d="M39 68 Q26 24 71 17 Q112 8 124 56 Q96 33 74 35 Q48 40 39 68Z" fill="'+hair+'"/><path d="M119 44 Q148 61 129 125" stroke="'+hair+'" stroke-width="19" fill="none"/>',
  wave:'<path d="M34 76 Q23 38 48 20 Q65 6 80 19 Q103 5 122 26 L129 88 Q117 63 111 45 Q91 51 75 38 Q54 44 43 77Z" fill="'+hair+'"/>',
  slick:'<path d="M40 60 Q36 25 76 17 Q118 11 123 53 Q100 27 77 28 Q54 34 40 60Z" fill="'+hair+'"/>'
 }[g.hair]||'';
 const eyes=neutral?20:wide?18:14;
 const glasses=g.glasses?'<rect x="49" y="68" width="28" height="20" rx="7" fill="none" stroke="#28323e" stroke-width="3"/><rect x="87" y="68" width="28" height="20" rx="7" fill="none" stroke="#28323e" stroke-width="3"/><path d="M77 76 Q82 73 87 76" fill="none" stroke="#28323e" stroke-width="3"/>':'';
 const jacket=g.outfit==='robe'?'#1b2536':'#344c68',shirt=g.outfit==='robe'?'#f8f6ee':'#f3f3ef';
 return '<span class="judge-id-portrait '+(klass||'')+'" role="img" aria-label="선택한 판사의 증명사진"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 184" preserveAspectRatio="xMidYMid meet">'+
 '<defs><linearGradient id="judge-photo-bg" x2="0" y2="1"><stop stop-color="#e4ded5"/><stop offset="1" stop-color="#c5c0ba"/></linearGradient></defs><rect width="160" height="184" fill="#dadbd9"/><rect x="5" y="5" width="150" height="174" fill="#f0ece5"/>'+
 '<path d="M0 180 Q10 132 56 131 L107 131 Q151 137 160 180Z" fill="'+jacket+'"/><path d="M61 130 L81 160 L99 130 L94 119 L67 119Z" fill="'+shirt+'"/><path d="M81 140 l-7 14 7 24 7-24Z" fill="#a98350"/>'+
 back+'<rect x="69" y="111" width="24" height="29" rx="10" fill="'+color+'"/><path d="'+silhouette+'" fill="'+color+'" stroke="'+shade+'" stroke-width="1.1"/>'+
 '<ellipse cx="41" cy="78" rx="7" ry="10" fill="'+color+'"/><ellipse cx="120" cy="78" rx="7" ry="10" fill="'+color+'"/>'+hairFront+
 '<path d="M52 65 Q62 '+(eyes+40)+' 74 65 M89 65 Q103 '+(eyes+40)+' 113 65" fill="none" stroke="'+hair+'" stroke-width="'+(wide?'2.4':'3.4')+'" stroke-linecap="round"/>'+
 '<ellipse cx="63" cy="79" rx="3.5" ry="4.1" fill="#2b3340"/><ellipse cx="101" cy="79" rx="3.5" ry="4.1" fill="#2b3340"/>'+
 '<path d="M82 85 L79 99 L84 101" fill="none" stroke="'+shade+'" stroke-width="1.8"/><path d="M70 108 Q82 '+(wide?'114':'112')+' 94 108" fill="none" stroke="#995d56" stroke-width="2"/>'+glasses+
 '<path d="M12 182 H148" stroke="#9a9993" stroke-width="1"/></svg></span>';
}
window.VerdictJudgePortrait={get:avatarState,picture:portrait,choices};
avatar=function(id,style){return id==='self'||id===undefined?portrait(avatarState(),'judge-avatar'):oldAvatar(id,style)};
function replaceJudgePhoto(html){
 const tmp=document.createElement('template');tmp.innerHTML=html;
 tmp.content.querySelectorAll('.dashboard-hero-badge .id-portrait').forEach(e=>{e.outerHTML=portrait(avatarState(),'judge-home-photo')});
 return tmp.innerHTML;
}
home=function(){return replaceJudgePhoto(oldHome());};
shell=function(content){let html=oldShell(content);return html.replace('class="sidebar-user">','class="sidebar-user"><button class="judge-edit" data-action="judgeEdit" title="판사 얼굴 수정">프로필 수정</button>')};
function controls(group,label){
 return '<div class="judge-control"><b>'+label+'</b><div class="judge-control-items">'+choices[group].map(p=>'<button type="button" class="judge-option" data-action="judgeOption" data-key="'+group+'" data-value="'+p[0]+'" aria-pressed="'+(String(avatarState()[group])===p[0])+'">'+p[1]+'</button>').join('')+'</div></div>';
}
function drawEditor(editing){
 const body='<div class="judge-creator"><div class="judge-preview">'+portrait(avatarState(),'judge-preview-image')+'<div><b>나의 판사</b><small>프로필·법정·홈에 동일하게 반영</small></div></div>'+
 '<div class="judge-name-field"><label for="playerName">판사 이름</label><input class="control" id="playerName" maxlength="16" value="'+h(S.name||'')+'" placeholder="이름을 입력하세요" autocomplete="off"></div>'+
 controls('gender','외모 유형')+controls('face','얼굴형')+controls('skin','피부톤')+controls('hair','헤어스타일')+controls('glasses','안경')+controls('outfit','복장')+'</div>';
 modal(editing?'판사 프로필 변경':'나의 판사 만들기',body,'<button class="btn primary full" data-action="'+(editing?'judgeSaveEdit':'start')+'">'+(editing?'프로필 저장':'법관 커리어 시작하기')+'</button>');
}
setup=function(){drawEditor(false)};
clicker=function(e){
 const el=e.target.closest('[data-action]');if(!el)return oldClick(e);
 if(el.dataset.action==='judgeOption'){
  const k=el.dataset.key,v=el.dataset.value;if(!(k in choices)||!choices[k].some(x=>x[0]===v))return;
  avatarState()[k]=k==='glasses'?v==='yes':v;
  const view=document.querySelector('.judge-preview-image');if(view)view.outerHTML=portrait(avatarState(),'judge-preview-image');
  document.querySelectorAll('.judge-option[data-key="'+k+'"]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.value===v)));
  save();return;
 }
 if(el.dataset.action==='judgeEdit'){drawEditor(true);return}
 if(el.dataset.action==='judgeSaveEdit'){const inp=document.querySelector('#playerName');if(inp)S.name=inp.value.trim().slice(0,16)||S.name;save();ui.modal=null;render();toast('프로필 변경 저장');return}
 return oldClick(e);
};
avatarState();
})();