
/* ---- registry: lookup, name filling, and the 30-case draw ---- */
(()=>{
const list=window.VERDICT_CURATED_PARTS||[];
const cases=Object.fromEntries(list.map(c=>[c.id,c]));
function batchim(w){const s=String(w||'').trim(),last=s.slice(-1);if(/[0-9]/.test(last))return '013678'.includes(last);const c=last.charCodeAt(0);if(c<0xAC00||c>0xD7A3)return false;return (c-0xAC00)%28!==0}
function rieul(w){const s=String(w||'').trim(),last=s.slice(-1),c=last.charCodeAt(0);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28===8}
const PAIRS={'이':['이','가'],'가':['이','가'],'은':['은','는'],'는':['은','는'],'을':['을','를'],'를':['을','를'],'과':['과','와'],'와':['과','와'],'아':['아','야'],'야':['아','야']};
function particle(name,p){
 if(p==='으로'||p==='로')return name+(batchim(name)&&!rieul(name)?'으로':'로');
 const pair=PAIRS[p];return name+(pair?(batchim(name)?pair[0]:pair[1]):p);
}
/* {A} → name, {A|이} → name + 이/가. Unknown keys stay readable as a role word. */
function fill(text,names){
 return String(text||'').replace(/\{([A-Z][0-9]?)(?:\|([가-힣]+))?\}/g,(m,key,p)=>{const n=names[key]||({A:'피고인',B:'상대방',L:'변호사'}[key]||'증인');return p?particle(n,p):n});
}
/* Courtroom detail (curated/detail*.js) is merged into each case: evidence and witnesses line up by index. */
for(const d of window.VERDICT_CURATED_DETAIL||[]){const c=cases[d.id];if(!c)continue;
 c.evidence=c.evidence.map((e,i)=>({...e,...(d.evidence?.[i]||{})}));
 c.witnesses=c.witnesses.map((w,i)=>({...w,...(d.witnesses?.[i]||{})}));
 for(const k of ['charge','demand','claim','issues','late','rebut','closing'])if(d[k]!=null)c[k]=d[k];
}
/* Gender facts a story depends on. A/B: fixed gender; AB: same or opposite to each other;
 * W: witness index → sameA / sameB / diffA / diffB. Everything else stays random. */
const SEX={
 'beta-homicide-009':{AB:'same',W:{0:'sameA',1:'sameA'}},   // dorm roommates, the dorm supervisor and the student next door
 'beta-family-003':{AB:'diff'},                              // separated parents
 'beta-family-011':{AB:'diff'},                              // former couple who lived together
 'beta-sexual-009':{AB:'diff'},                              // former couple
 'stalking-repeat-contact':{AB:'diff'},                      // met on a blind date
 'beta-reputation-004':{A:'여'},                             // a mom-cafe regular
 'beta-violence-003':{W:{1:'diffB'}}                         // the victim's spouse
};
for(const [id,s] of Object.entries(SEX))if(cases[id])cases[id].sex=s;
window.VerdictCurated={cases,ids:Object.keys(cases),fill,particle,active:list.length>0};
if(typeof CasePackEngine!=='undefined'&&list.length){
 const basePool=CasePackEngine.pool;
 CasePackEngine.pool=save=>{const all=basePool(save),cur=all.filter(x=>cases[x.a.id]);return cur.length?cur:all};
 CasePackEngine.choose=(save,random)=>{const a=CasePackEngine.pool(save);return a.length?a[Math.floor(random()*a.length)]:null};
}
})();
