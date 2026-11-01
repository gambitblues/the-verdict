/* Expands 99 fictional case outlines into Advanced engine-compatible working drafts.
 * NOT certified case-authored content. A human must review each case.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'story-beats-99.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
function focus(d){
const t=d.workingTitle;
if(/마약|향정/.test(t))return ['총 세 차례의 투약 혐의 중 첫 회차 자백과 두 번째·세 번째 회차의 거래기록이 다투어진다.','양성 감정 결과로 세 차례의 개별 투약 날짜까지 확정할 수는 없다.','첫 조사에서 인정한 투약 날짜와 횟수는 무엇입니까?','첫 회차는 인정하지만 나머지 회차는 날짜와 장소에 관하여 다툽니다.'];
if(/강간|추행|성폭력|촬영|딥페이크/.test(t))return ['피고인의 구체적인 접촉·촬영 행위와 상대방의 상태·동의 여부에 다툼이 있다.','DNA 또는 관련 검사 결과만으로 삽입·동의·행위자·정확한 시점을 모두 단정할 수는 없다.','어떤 장면을 직접 기억하고 어떤 사실을 이후 알게 됐습니까?','같은 장소에 있었다는 사실과 공소장의 구체적 행위는 구분해야 합니다.'];
if(/사망|살인|치사|상해|폭행|방화|화재/.test(t))return ['피고인의 현장 행위와 상해·사망 결과 사이의 인과관계 및 고의가 다투어진다.','부검의 추정 사망 시각에는 범위가 있으며 손상만으로 행위자를 특정할 수는 없다.','피해자의 자세·손상 부위와 최초 발견 시간을 각각 설명해 주세요.','현장에 있었던 사실만으로 결과를 발생시킨 고의적 행위를 증명하지 못합니다.'];
if(d.category==='family')return ['출생·혼인·양육 또는 재산의 이전 경위와 청구의 법률상 효과가 문제된다.','가족관계 기록이나 유전자 감정만으로 모든 청구인의 자격과 청구 범위가 자동 결정되지는 않는다.','해당 합의에 직접 참석했고 서명과 이행을 확인하셨습니까?','과거 관계는 일부 인정하지만 그로 인해 청구한 법률상 효과가 자동 발생하지 않습니다.'];
if(d.category==='administrative')return ['처분청이 특정 위반 사실을 근거로 한 처분의 사유·절차·재량이 다투어진다.','현장 사진의 위반 사실과 적법한 의견제출 절차·비례성은 구별해 검토해야 한다.','현장 조사표를 누가 작성했고 처분 전 통지·의견제출이 있었습니까?','일부 위반을 인정하더라도 절차와 재량 판단을 별도로 해야 합니다.'];
if(/대금|계약|임차|건물|공사|보증금|누수|하자/.test(t))return ['계약상 이행 기한·하자·손해액과 당사자 귀책의 범위가 다투어진다.','계약서와 지급기록만으로 손해의 원인이나 책임 비율을 단정할 수 없다.','어느 계약 조항을 언제 이행했고 대금은 얼마를 수령했습니까?','이행 일부는 인정하지만 기지급금과 책임 범위가 청구액과 다릅니다.'];
return [d.allegedConduct+' 금전·행위 관련 문서와 당사자 최초 설명이 서로 다르다.','기록의 존재만으로 의사·권한·책임 범위 모두를 단정할 수 없다.','해당 장소에서 직접 확인한 사실과 나중에 들은 내용은 무엇입니까?','일부 사실은 인정하지만 상대방의 법률상 평가를 다툽니다.'];
}
function expand(d){
const [act,limit,question,defence]=focus(d),ev=d.incidentTimeline,loc=d.fictionalLocation;
const evidence=d.authoredEvidence.map((e,j)=>({id:e.id,kind:e.title,source:e.source,provenance:d.id+'-원본 확인 및 인계기록 필요',excerpt:(j===0?act:j===1?limit:e.limitedProof)+' — '+ev[j].at.slice(0,16),limits:e.limitedProof}));
function witness(i){const w=d.witnessPlans[i],id='w0'+(i+1),sourceEv=ev[i].id;const make=(prompt,response,index)=>({prompt,confrontEvidenceIds:['doc0'+(i+1)],responses:{initial:{text:response,knowledgeSource:index===0?'memory':'document',eventId:index===0?sourceEv:null},clarify:{text:'이 부분은 직접 목격한 사실과 다른 사람에게 들은 사실을 구분해야 합니다.',knowledgeSource:'memory'},confront:{text:'원본 자료와 시각이 다를 수 있습니다. 당시 시계를 직접 확인한 것은 아닙니다.',knowledgeSource:'document'}}});
return {id,role:w.role,observedEventIds:[sourceEv],traits:{memoryAccuracy:70,memoryConfidence:65,honesty:75,pressureSensitivity:45,interest:35},script:{
opening:make(w.question,ev[i].at.slice(11,16)+' 무렵 '+loc+'에서 상황의 일부를 보았습니다. 이후 일은 직접 보지 못했습니다.',0),
specifics:make(question,'제가 관찰한 행동의 일부와 다른 사람이 설명한 사실은 분리할 필요가 있습니다.',1),
clock:make(w.crossQuestion,'정확한 시각은 제 기억으로 추정했고 원본과 대조한 적은 없습니다.',2),
document:make('증거 '+d.authoredEvidence[i].title+'의 작성 경위는 직접 알고 계십니까?','자료 작성 전체를 담당한 것은 아니며 작성자의 확인이 필요합니다.',3)
}}}
const testimony=witness(0),witness2=witness(1);
const variant=truth=>({events:ev.map((e,i)=>({...e,action:i!==1?e.action:truth==='did'?act:truth==='didnt'?'주장된 핵심 행위가 발생하지 않았다. 기록은 다른 경위를 통해 작성되었다.':'핵심 행위 일부는 발생했으나 고의·효과·범위가 주장과 다르다.'})),evidence:clone(evidence),witnesses:[clone(testimony),clone(witness2)]});
const target={fact:ev[1].at.slice(0,16)+' '+loc+'의 '+evidence[0].kind+'과 '+evidence[1].kind+'의 차이',eventId:'e2'};
const line=(id,phase,speaker,text,purpose,support,replyTo)=>({id,phase,speaker,text,purpose,issueId:'main',target,support,replyTo});
const dialogue={lines:[
line('q','question','defense',d.witnessPlans[0].question,'establish',[{type:'testimony',id:'1'}]),
line('a','answer','witness',testimony.script.opening.responses.initial.text,'clarify',[{type:'argument',id:'q'}],'q'),
line('c','confrontation','defense',evidence[1].kind+'의 기록 시각과 다른데, '+d.witnessPlans[0].crossQuestion,'impeach',[{type:'argument',id:'a'},{type:'evidence',id:'doc02'}],'a'),
line('e','explanation','witness','자료에 기재된 시각과 제 기억이 다르다면 제 기억은 추정이라는 한계가 있습니다.','explain',[{type:'argument',id:'c'}],'c'),
line('p','claim','prosecution',act+' '+limit,'argue',[{type:'argument',id:'e'}],'e'),
line('d','rebuttal','defense',defence,'respond',[{type:'argument',id:'p'}],'p')]};
return {id:d.id,version:1,category:d.category,fictionalLocation:loc,pleading:{kind:d.category==='criminal'?'공소장 요지':'소장 요지',allegations:[act],issue:d.issue},source:d.source,sourceFactsVerified:false,definition:{id:d.id,version:1,variants:{did:variant('did'),didnt:variant('didnt'),reason:variant('reason')}},manifest:{devices:{},records:evidence.map((r,j)=>({id:r.id,kind:r.kind,source:r.source,provenance:r.provenance,eventId:ev[j].id,at:ev[j].at.replace(':00+09:00','+09:00')}))},dialogue,legalVerified:false,qa:{runtime:false,individualizedAuthorship:false,fullPlaythrough:false},optionalFuture:true};
}
const pack={format:'advanced-expanded-working-drafts/v1',disclaimer:'All 99 are schematic fictional engine-shaped drafts, NOT 99 individually completed legal cases.',cases:raw.drafts.map(expand)};
if(require.main===module){if(process.argv.includes('--write'))fs.writeFileSync(path.join(__dirname,'expanded-99.json'),JSON.stringify(pack,null,2));else process.stdout.write(JSON.stringify({cases:pack.cases.length,ready:0}));}
module.exports=pack;
