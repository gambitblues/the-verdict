// Browser-test helpers for the courtroom screen: popups are handled by kind, the way a player would, and every step
// waits on game state instead of a fixed sleep. Nothing here clears `ui.modal` by force.
//
//   request      — an objection or delay request (data-kind="card"): always ruled on (accept / reject)
//   season       — the yearly personnel choice (data-action="v6dept"): a department is picked
//   end-confirm  — "제N회 공판을 마칠까요?": only endSession() answers it; elsewhere it means "keep going"
//   notice       — a popup with a close button (확인 / 닫기; new filings also offer '증거 보기'): closed with it
//   anything else fails the test with the popup's text, so a new popup kind cannot slip through silently.
export function courtUI(page,{rule='reject'}={}){
 const kind=()=>page.evaluate(()=>{const r=document.querySelector('#modal-root');if(!r||!r.querySelector('.modal'))return null;
  if(r.querySelector('[data-kind="card"][data-choice]'))return 'request';
  if(r.querySelector('[data-action="v6dept"]'))return 'season';
  if(r.querySelector('[data-action="t4end"][data-ok]'))return 'end-confirm';
  if(r.querySelector('.modal-actions [data-action="dismiss"]')||r.querySelector('.modal-actions [data-action="t4go"][data-go="evidence"]'))return 'notice';   // 확인 / 닫기 (a filing may also offer '증거 보기')
  return 'other: '+r.innerText.replace(/\s+/g,' ').slice(0,120)});
 const sig=()=>page.evaluate(()=>String(ui.modal||''));
 const gone=before=>page.waitForFunction(b=>String(ui.modal||'')!==b,before,{timeout:10000});
 const trial=()=>page.evaluate(()=>{const t=S.cases[ui.caseId]?.trial4;return t?{day:t.day,days:t.daysDone,heard:t.heard.length,orders:(t.courtOrders||[]).length,open:t.dates?.[t.day]!=null,tab:ui.t4tab}:null});

 /* one popup, handled by kind; returns its kind (null when nothing was open) */
 async function handleOne(){
  const k=await kind();if(!k)return null;const before=await sig();
  if(k==='request'){
   const btn=page.locator(`#modal-root [data-kind="card"][data-choice="${rule}"]`).first(),id=await btn.getAttribute('data-id');
   await btn.click();
   await page.waitForFunction(i=>!!S.cases[ui.caseId]?.trial4?.cards.find(v=>v.id===i)?.choice,id,{timeout:10000});   // the ruling is recorded
  }else if(k==='season'){await page.locator('#modal-root [data-action="v6dept"]').first().click();await gone(before)}
  else if(k==='notice'||k==='end-confirm'){const close=page.locator('#modal-root .modal-actions [data-action="dismiss"]');const target=await close.count()?close:page.locator('#modal-root .modal-actions [data-action="t4go"][data-go="evidence"]');await target.first().click();await gone(before)}
  else throw new Error('unknown popup — '+k);
  return k;
 }
 /* handle popups until none is open (several can follow one another: requests, then filings) */
 async function settle(){const seen=[];for(let n=0;n<12;n++){const k=await handleOne();if(!k)return seen;seen.push(k)}throw new Error('popups keep coming: '+seen.join(', '))}

 /* press a button once. `done` (a page-side function of `arg`) says whether the press took effect; it is checked
  * before every try, so a retry after a popup collision can never do the thing twice. Only a popup that arrived in
  * between is retried; a missing button or a press that changes nothing is a real failure. */
 async function press(loc,{done,arg=null,label='button'}={}){
  for(let k=0;k<4;k++){
   await settle();
   if(done&&await page.evaluate(([f,a])=>(0,eval)(f)(a),[done.toString(),arg]))return;
   if(!(await loc.count()))throw new Error(`${label}: the button is not on screen`);
   try{await loc.first().click({timeout:5000})}
   catch(e){if(await kind())continue;throw new Error(`${label}: ${e.message.split('\n')[0]}`)}
   if(!done)return;
   try{await page.waitForFunction(([f,a])=>(0,eval)(f)(a),[done.toString(),arg],{timeout:5000});return}
   catch(e){if(await kind())continue;throw new Error(`${label}: pressed, but nothing happened`)}
  }
  throw new Error(`${label}: still blocked by popups after 4 tries`);
 }
 const tab=id=>press(page.locator(`.t4-tab[data-tab="${id}"]`),{label:'tab '+id,arg:id,done:i=>ui.t4tab===i});
 async function openSession(){
  const t0=await trial();if(t0?.open)return false;
  const ob=page.locator('.t4-dock [data-kind="open"]');if(!(await ob.count()))return false;
  await press(ob,{label:'open session',done:()=>{const t=S.cases[ui.caseId].trial4;return t.dates?.[t.day]!=null}});
  await settle();return true;
 }
 /* end today's session exactly once: the end button, then the confirmation, then the result popup */
 async function endSession(){
  const t0=await trial(),end=page.locator('.t4-dock [data-action="t4end"]');if(!(await end.count()))return false;
  await press(end,{label:'end session',arg:t0.days,done:d=>!!document.querySelector('#modal-root [data-action="t4end"][data-ok]')||S.cases[ui.caseId].trial4.daysDone>d});
  if(await page.locator('#modal-root [data-action="t4end"][data-ok]').count()){
   await page.locator('#modal-root [data-action="t4end"][data-ok]').click();
   await page.waitForFunction(d=>S.cases[ui.caseId].trial4.daysDone>d,t0.days,{timeout:10000});
  }
  await settle();
  const t1=await trial();if(t1.days!==t0.days+1)throw new Error(`end session: hearings went ${t0.days} → ${t1.days} (expected +1)`);
  return true;
 }
 /* one question or one order, sent the way the screen sends it; any popup it raises is ruled on */
 async function ask(loc){const h0=(await trial()).heard;await loc.dispatchEvent('click');
  await page.waitForFunction(h=>S.cases[ui.caseId].trial4.heard.length>h||!!document.querySelector('#modal-root .modal'),h0,{timeout:10000});await settle();
  return (await trial()).heard>h0}
 async function order(loc){const o0=(await trial()).orders;await loc.dispatchEvent('click');
  await page.waitForFunction(o=>(S.cases[ui.caseId].trial4.courtOrders||[]).length>o,o0,{timeout:10000});await settle();return (await trial()).orders-o0}
 /* every ruling of the day is in the log exactly once; orders and questions are never duplicated */
 const audit=()=>page.evaluate(()=>{const t=S.cases[ui.caseId].trial4,out=[];
  const ruled=t.cards.filter(v=>v.choice&&(v.type==='objection'||v.type==='delay')).length,logged=t.log.filter(l=>l.day===t.day&&(l.kind==='이의'||l.kind==='연기')&&/: (받아들임|받아들이지 않음|기각)$/.test(l.text)).length;
  if(ruled!==logged)out.push(`day ${t.day}: ${ruled} rulings, ${logged} in the log`);
  const ids=(t.courtOrders||[]).map(o=>o.id||o.key+':'+o.day);if(new Set(ids).size!==ids.length)out.push('an order was recorded twice');
  t.witnesses.forEach((w,i)=>{const a=w.askedIds||[];if(new Set(a).size!==a.length)out.push(`witness ${i}: a question was asked twice`)});
  return out});
 return {kind,settle,press,tab,openSession,endSession,ask,order,audit,trial};
}
