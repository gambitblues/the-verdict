/* THE VERDICT — keeps the bottom app bar inside the visible screen (v7.0.2).
 * Some Android home-screen launches (Chrome shortcut / minimal UI, seen on Galaxy Fold) report a layout viewport taller
 * than what is visible and no safe-area inset for the gesture bar. We measure the hidden part ("gap") and expose it as
 * --vv-gap; CSS lifts the bar, the trial dock and the space under the content by that much.
 * Rules (pure, tested in tests/responsive.mjs):
 *  - keyboard up (an input is focused and the visible height dropped a lot) → gap 0 and class kb-open (bar hides)
 *  - pinch zoom (scale > 1) → gap 0
 *  - a gap larger than 140px is not a browser bar but something else (keyboard without focus info, split screen) → 0 */
(function(root){
 'use strict';
 function gapOf(m){
  if(!m||!m.vvHeight)return {gap:0,kb:false};
  if((m.scale||1)>1.01)return {gap:0,kb:false};
  const hidden=Math.max(0,Math.round(m.innerHeight-(m.vvHeight+(m.vvTop||0))));
  const kb=!!m.editing&&hidden>120;
  if(kb)return {gap:0,kb:true};
  return {gap:hidden>140?0:hidden,kb:false};
 }
 const api={gapOf};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return}
 const doc=root.document,html=doc.documentElement,vv=root.visualViewport;
 const editing=()=>{const a=doc.activeElement;return !!a&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable)};
 let last='';
 function fix(){
  const r=gapOf({innerHeight:root.innerHeight,vvHeight:vv?vv.height:root.innerHeight,vvTop:vv?vv.offsetTop:0,scale:vv?vv.scale:1,editing:editing()});
  const key=r.gap+'|'+r.kb;if(key!==last){last=key;html.style.setProperty('--vv-gap',r.gap+'px');html.classList.toggle('kb-open',r.kb)}
  const mm=q=>root.matchMedia&&root.matchMedia(q).matches;
  html.classList.toggle('app-mode',mm('(display-mode: standalone)')||mm('(display-mode: minimal-ui)')||mm('(display-mode: fullscreen)')||root.navigator.standalone===true);
 }
 let raf=0;const soon=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;fix()})};
 if(vv){vv.addEventListener('resize',soon);vv.addEventListener('scroll',soon)}
 root.addEventListener('resize',soon);root.addEventListener('orientationchange',()=>setTimeout(fix,250));
 doc.addEventListener('focusin',()=>setTimeout(fix,300));doc.addEventListener('focusout',()=>setTimeout(fix,300));
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)fix()});
 root.VerdictViewport={...api,fix};fix();
})(typeof window!=='undefined'?window:globalThis);
