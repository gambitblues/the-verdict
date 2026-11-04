/* Parse the simple Korean seed template. The text is a fictional authoring
 * draft, not a court record. Unknown facts stay unknown; no AI inference here.
 */
'use strict';
const path=require('node:path');
const {validateAuthorSeed}=require('./terra_author_seed.cjs');
const sections={
 '고정 사실':'facts','인물':'people','증거 단서':'leads',
 '쟁점':'issues','미확정 사항':'unknowns'
};
function parseAuthorMarkdown(source,filename='author-case.md'){
 if(typeof source!=='string'||source.length>18000)throw Error('집필 양식이 비어 있거나 너무 깁니다.');
 const sectionsData={facts:[],people:[],leads:[],issues:[],unknowns:[]},meta={};
 let section=null;
 for(const raw of source.replace(/\r/g,'').split('\n')){
  const line=raw.trim();
  if(!line||line.startsWith('<!--'))continue;
  const sectionName=line.replace(/^#{1,4}\s*/,'').replace(/:$/,'');
  if(sections[sectionName]){section=sections[sectionName];continue}
  const field=line.match(/^(사건ID|분류|재판유형|사건명|처음 알려진 사건|집필 메모):\s*(.+)$/);
  if(field){meta[field[1]]=field[2].trim();section=null;continue}
  if(line.startsWith('#'))continue;
  if(line.startsWith('- ')){
   if(!section)throw Error('항목보다 먼저 고정 사실/인물/증거 단서 등 제목을 적으세요.');
   sectionsData[section].push(line.slice(2).trim());continue;
  }
  throw Error('해석할 수 없는 줄: '+line.slice(0,100));
 }
 const category=meta['분류'],kind=meta['재판유형'];
 const people=sectionsData.people.map(x=>{
  const p=x.split('|').map(z=>z.trim());
  if(p.length!==3)throw Error('인물은 A | 역할 | 인물이 실제 알고 있는 범위로 적어 주세요.');
  return {id:p[0],role:p[1],knowledge:p[2]};
 });
 const mapExists={확정:'confirmed',가능:'possible',미확인:'possible',없음:'unavailable'};
 const evidenceLeads=sectionsData.leads.map((x,i)=>{
  const v=x.split('|').map(z=>z.trim());
  if(v.length!==5||!mapExists[v[1]])throw Error('증거 단서는 제목 | 확정/가능/없음 | 출처 | 확인 가능한 내용 | 한계 형식입니다.');
  return {id:'e'+(i+1),title:v[0],exists:mapExists[v[1]],source:v[2],reveals:v[3],limit:v[4]};
 });
 const seed={
  format:'verdict-author-seed/v1',
  id:meta['사건ID']||path.basename(filename).replace(/\.md$/i,''),
  status:'draft',category,kind,title:meta['사건명'],opening:meta['처음 알려진 사건'],
  immutableFacts:sectionsData.facts.map((fact,i)=>({id:'f'+(i+1),fact,certainty:'confirmed'})),
  people,evidenceLeads,contestedQuestions:sectionsData.issues,
  unknowns:sectionsData.unknowns,authorNotes:meta['집필 메모']||'',
  source:{type:'original',note:'집필자가 창작한 가상 사건이며 실재 사건의 원문을 인용하지 않았다.'}
 };
 const check=validateAuthorSeed(seed);
 if(!check.ok)throw Error(check.errors.join(' | '));
 return seed;
}
module.exports={parseAuthorMarkdown};
