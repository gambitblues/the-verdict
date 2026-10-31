/* THE VERDICT v1.0 — local JSON archetype packs. No API, no dynamic code execution.
 * Packs define situations and evidence scaffolding, never a correct verdict.
 * Accepted packs are serialized with player saves so the original cases never mutate.
 */
'use strict';
const CasePackEngine=(()=>{
 const FORMAT='the-verdict-casepack/v1';
 const CATEGORY_TARGETS=Object.freeze({homicide:85,sexual:80,violence:40,financial:50,property:45,reputation:45,civil:25,family:55,professional:45,public:30});
 const KEY_KIND=Object.freeze({rent:'civil',fraud:'criminal',assault:'criminal',murder:'criminal',sexual:'criminal',stalking:'criminal',embezzle:'criminal',celebrity:'civil',affair:'civil',inherit:'civil',defamation:'criminal',medical:'civil',bribe:'criminal',accident:'criminal',contract:'civil',harassment:'civil',fire:'criminal',construction:'civil',privacy:'criminal'});
 const allowedArchetype=new Set(['id','category','baseKey','kind','tag','icon','importance','legal','title','premise','trigger','motive','relationship','incident','evidence','questions','causalTags']);
 const safeText=v=>typeof v==='string'&&v.trim().length>=3&&v.trim().length<=900;
 const safeId=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{3,79}$/.test(v);
 function validate(pack){
  const errors=[],warnings=[];
  if(!pack||typeof pack!=='object'||Array.isArray(pack))return {ok:false,errors:['JSON 객체여야 합니다.'],warnings:[]};
  if(pack.format!==FORMAT)errors.push('사건팩 포맷 불일치: '+FORMAT);
  if(!safeId(pack.packId))errors.push('팩 ID 형식 오류');
  if(!/^\d+\.\d+\.\d+$/.test(pack.version||''))errors.push('팩 버전은 1.0.0 형태여야 합니다.');
  if(!safeText(pack.title))errors.push('팩 제목 누락');
  if(!Array.isArray(pack.archetypes)||pack.archetypes.length<1||pack.archetypes.length>500)errors.push('사건 원형 수는 1~500개여야 합니다.');
  const seen=new Set(),signatures=new Set();
  for(const [i,a] of (pack.archetypes||[]).entries()){
   const at=`${i+1}번`;if(!a||typeof a!=='object'||Array.isArray(a)){errors.push(at+'이 객체가 아닙니다.');continue;}
   if(!safeId(a.id)||seen.has(a.id))errors.push(at+'의 원형 ID 중복 또는 형식 오류');seen.add(a.id);
   if(!(a.category in CATEGORY_TARGETS))errors.push(at+'의 10대 분야 오류');
   if(!(a.baseKey in KEY_KIND)||KEY_KIND[a.baseKey]!==a.kind)errors.push(at+'의 법률 기초 유형/민형사 분류 불일치');
   for(const key of ['tag','legal','title','premise','trigger','motive','relationship'])if(!safeText(a[key]))errors.push(at+'의 '+key+' 누락 또는 길이 오류');
   if(!a.incident||!['cause','action','aftermath'].every(k=>safeText(a.incident[k])))errors.push(at+'의 사건 인과 3단계 누락');
   if(!Array.isArray(a.evidence)||a.evidence.length!==3||!a.evidence.every(e=>e&&['title','proves','limitation'].every(k=>safeText(e[k]))))errors.push(at+'의 증거 3개(명칭·입증범위·한계) 누락');
   else if(new Set(a.evidence.map(e=>e.title)).size!==3)errors.push(at+'의 증거명 중복');
   if(!Array.isArray(a.questions)||a.questions.length<3||!a.questions.every(safeText))errors.push(at+'의 심리 질문 누락');
   if(!Array.isArray(a.causalTags)||a.causalTags.length<3||!a.causalTags.every(x=>typeof x==='string'&&x.trim().length>=2&&x.length<=40))errors.push(at+'의 고유 인과 태그 누락');
   const sig=[a.baseKey,a.incident?.cause,a.incident?.action,(a.evidence||[]).map(e=>e?.title).join('|')].join('|');
   if(signatures.has(sig))errors.push(at+'의 원인·증거구조 중복');signatures.add(sig);
   if(Object.keys(a).some(key=>!allowedArchetype.has(key)))errors.push(at+'의 미허용 필드: '+Object.keys(a).filter(x=>!allowedArchetype.has(x)).join(', '));
   if(/\b(guilty|notguilty|correctVerdict|fixedVerdict)\b/i.test(JSON.stringify(a)))warnings.push(at+'의 판결 정답 표현 여부를 검토하세요.');
  }
  return {ok:errors.length===0,errors:errors.slice(0,20),warnings,count:seen.size};
 }
 const semver=v=>(v||'0.0.0').split('.').map(Number);
 const compare=(a,b)=>{let x=semver(a),y=semver(b);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]-y[i];}return 0;};
 function install(save,pack){
  const result=validate(pack);if(!result.ok)return result;
  const list=save.casePacks??(save.casePacks=[]);
  const idx=list.findIndex(p=>p.packId===pack.packId);
  if(idx>=0&&compare(pack.version,list[idx].version)<=0)return {ok:false,errors:['이미 설치된 팩과 버전이 같거나 이전 버전입니다. 새 버전은 더 높은 번호로 제작하세요.'],warnings:[]};
  const existing=new Set(list.filter((p,i)=>i!==idx).flatMap(p=>(p.archetypes||[]).map(a=>a.id)));
  const collisions=pack.archetypes.filter(a=>existing.has(a.id)).map(a=>a.id);
  if(collisions.length)return {ok:false,errors:['다른 팩의 사건 원형 ID와 충돌: '+collisions.slice(0,5).join(', ')],warnings:[]};
  const value=JSON.parse(JSON.stringify(pack));value.enabled=idx<0?true:list[idx].enabled!==false;
  if(idx<0)list.push(value);else list[idx]=value;
  save.removedPackIds=(save.removedPackIds||[]).filter(id=>id!==pack.packId);
  return {...result,installed:idx>=0?'updated':'new'};
 }
 function setEnabled(save,id,enabled){const pack=(save.casePacks||[]).find(p=>p.packId===id);if(!pack)return false;pack.enabled=!!enabled;return true;}
 function remove(save,id){let arr=save.casePacks||[],i=arr.findIndex(p=>p.packId===id);if(i<0)return false;arr.splice(i,1);return true;}
 function pool(save){return (save.casePacks||[]).filter(p=>p.enabled!==false).flatMap(pack=>(pack.archetypes||[]).map(a=>({pack,a})));}
 function choose(save,random){const a=pool(save);return a.length?a[Math.floor(random()*a.length)]:null;}
 function blueprint(pack,archetype){const a=archetype;return {key:a.baseKey,kind:a.kind,tag:a.tag,icon:a.icon||'⚖️',importance:Math.min(5,Math.max(1,Number(a.importance||3))),legal:a.legal,titles:[a.title],premises:[a.premise],docs:a.evidence.map(e=>e.title),questions:a.questions.slice(0,3),packOrigin:{id:a.id,packId:pack.packId,version:pack.version,category:a.category,trigger:a.trigger,motive:a.motive,relationship:a.relationship,incident:a.incident,evidence:a.evidence,causalTags:a.causalTags}};}
 function stats(save){const enabled=pool(save),counts=Object.fromEntries(Object.keys(CATEGORY_TARGETS).map(k=>[k,0]));for(const {a} of enabled)counts[a.category]++;return {packs:(save.casePacks||[]).length,enabled:enabled.length,counts,targets:CATEGORY_TARGETS};}
 return {format:FORMAT,targets:CATEGORY_TARGETS,validate,install,setEnabled,remove,pool,choose,blueprint,stats};
})();
