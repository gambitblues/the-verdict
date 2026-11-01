/* Procedural hearing events; submissions are claims, not proof or automatic mitigation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.VerdictHearingEvents=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h>>>0};
const choices=[
 {id:'defendant_question',label:'피고인에게 직접 질문',criminalOnly:true,opens:'party'},   // opens the case's own authored party questions (trial_play partyCard), no stock dialogue
 {id:'reflection',label:'반성문 제출 및 내용 확인',criminalOnly:true},
 {id:'settlement',label:'합의·피해회복 자료 확인',criminalOnly:false}
];
function available(c,st,open){
 if(!st||st.verdict||!open)return [];
 return choices.filter(x=>!x.criminalOnly||c.kind==='criminal').filter(x=>!(st.hearingEvents||[]).some(e=>e.id===x.id));
}
function event(c,st,id,open,seed){
 const opt=available(c,st,open).find(x=>x.id===id);if(!opt)throw Error('해당 공판 이벤트를 진행할 수 없습니다.');
 const n=hash(c.id+':'+id+':'+(seed||'0'))%3;
 const person=c.kind==='criminal'?'피고인':'당사자';
 let text;
 if(id==='defendant_question'){
  throw Error('피고인 질문은 사건별 신문 카드에서 진행합니다.');
 }else if(id==='reflection'){
  text=[`피고인 반성문: 사건으로 상대방에게 고통을 준 점을 후회합니다. 다만 혐의 사실 전체를 인정하는 것은 아닙니다.`,`피고인 반성문: 제 행동을 돌아보고 재발 방지 교육을 받았습니다. 구체적인 피해 회복 여부는 별도 자료가 없습니다.`,`피고인 반성문: 당시의 판단이 경솔했습니다. 제출일 이후 실제 행동 변화에 관한 자료는 없습니다.`][n]+'\n재판장: 반성문 제출 사실과 진정성 및 양형상 의미는 구분해 검토합니다.';
 }else{
  text=[`${person} 측 합의서 사본이 제출됐습니다. 서명 사실은 확인되지만 약정한 배상금의 실제 지급은 아직 확인되지 않았습니다.`,`양측이 조정을 논의했지만 액수에 합의하지 못했습니다. 합의가 성립한 것으로 기록하지 않습니다.`,`피해 회복을 위한 일부 송금 내역이 제출됐습니다. 전액 배상 또는 피해자의 처벌 의사 변경으로 단정하지 않습니다.`][n];
 }
 return {id,day:st.trial4?.day||0,text,verified:false,effect:'none',createdAtCase:c.id};
}
function apply(c,st,id,open,seed){
 const item=event(c,st,id,open,seed);
 st.hearingEvents??=[];st.hearingEvents.push(item);
 if(st.trial4){st.trial4.log??=[];st.trial4.log.push({day:st.trial4.day,kind:'공판 이벤트',text:item.text});}
 return item;
}
return Object.freeze({choices,available,event,apply});
});
