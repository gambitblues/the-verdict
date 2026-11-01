/* Fictional Advanced pilot: Seoul Neulbalgeun Plastic Surgery Clinic.
 * All names, clinical observations, lab records, dates, and dialogue invented.
 * Charge is alleged, not adjudicated. Never infer guilt from a forensic marker.
 */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;if(root)root.VerdictAdvancedPilot=value;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const made=truth=>{
 const incidents={
 did:'의사는 진정상태를 이용해 고소인이 주장한 성기 삽입 행위를 하였다.',
 didnt:'의사는 고소인이 주장한 성적 행위를 하지 않았다. 검체 성분의 출처는 사건 전의 별도 접촉이다.',
 reason:'의사에 의한 성적 접촉은 있었으나 공소장에 적힌 성기 삽입은 발생하지 않았다.'
 };
 const list=[
 {id:'admit',at:'2026-05-14T13:20+09:00',place:'서울 늘밝은성형외과 1층 접수실',action:'환자 이서연이 비수술적 미용 시술을 위해 접수했다.'},
 {id:'sedation',at:'2026-05-14T13:51+09:00',place:'서울 늘밝은성형외과 제2시술실',action:'진정 약물 투여가 기록되었다.'},
 {id:'corridor',at:'2026-05-14T14:06+09:00',place:'제2시술실 앞 복도',action:'간호사 박지민이 제2시술실을 나갔다.'},
 {id:'critical',at:'2026-05-14T14:15+09:00',place:'제2시술실 내부',action:incidents[truth]},
 {id:'recovery',at:'2026-05-14T14:38+09:00',place:'3층 회복실',action:'환자가 회복실로 이송되었다.'},
 {id:'report',at:'2026-05-14T17:05+09:00',place:'서울가람경찰서 민원실',action:'이서연이 성폭력 피해를 신고했다.'}
 ];
 const ev=[
 {id:'chart',kind:'마취기록지',source:'늘밝은성형외과 전자의무기록',excerpt:'13:51 진정 시작, 14:38 회복실 이송'},
 {id:'cctv',kind:'CCTV',source:'늘밝은성형외과 복도 영상 저장장치',excerpt:'14:06 박지민 퇴실, 14:18 재진입 장면'},
 {id:'access',kind:'출입기록',source:'의료기관 카드 출입기록',excerpt:'제2시술실 출입 카드 로그'},
 {id:'forensic',kind:'감정서',source:'가상 국과수 분석 보고서',excerpt:'정액 관련 표지자 양성, 원인 및 채취 전 상황 추가 확인 필요'},
 {id:'dna',kind:'DNA 비교서',source:'가상 국과수 분석 보고서',excerpt:truth==='did'?'일치 프로파일이 검출되었다.':truth==='didnt'?'피고인 대조시료와 일치하지 않는다.':'결과만으로 삽입 여부를 구별할 수 없다.'},
 {id:'nurse',kind:'간호기록',source:'회복실 간호기록',excerpt:'15:26 회복 후 환자 불편감 호소 기록'}
 ];
 const script={return_time:{prompt:'오후 2시 10분에 돌아온 것이 정확합니까?',confrontEvidenceIds:['cctv'],responses:{
 initial:{text:'물품을 가져온 뒤 바로 돌아왔으니 2시 10분쯤이라고 생각합니다.',knowledgeSource:'memory',eventId:'corridor'},
 clarify:{text:'시계를 직접 확인한 것은 아닙니다. 제 추정이었습니다.',knowledgeSource:'memory',eventId:'corridor'},
 confront:{text:'영상의 2시 18분 장면이 저라면 제 기억한 시간이 정확하지 않았습니다.',knowledgeSource:'document',eventId:'corridor'},
 recall:{text:'기록을 다시 봤지만 실제 입실 시간은 영상과 출입기록을 함께 봐야 합니다.',knowledgeSource:'document',eventId:'corridor'}
 }}};
 return {events:list,evidence:ev,witnesses:[
 {id:'nurseA',name:'박지민',role:'시술실 간호사',observedEventIds:['sedation','corridor','recovery'],traits:{memoryAccuracy:70,memoryConfidence:80,honesty:80,pressureSensitivity:45,interest:30},script},
 {id:'nurseB',name:'최민서',role:'보조 간호사',observedEventIds:['sedation','recovery']},
 {id:'analyst',name:'송하진',role:'법과학 감정인',observedEventIds:[]},
 {id:'patient',name:'이서연',role:'고소인',observedEventIds:['admit','recovery','report']}
 ]};
};
const definition={id:'advanced-clinic-001',version:1,meta:{fictional:true,title:'마취실의 47분',hospital:'서울 늘밝은성형외과',clinicRoom:'제2시술실',charge:'준강간',statute:'형법 제299조',allegation:'마취 중 성기 삽입 혐의',issueIds:['sexual_act','incapacity','intent','evidence_identity']},variants:Object.fromEntries(['did','didnt','reason'].map(t=>[t,made(t)]))};
const manifest=truth=>({devices:{hallcam:{offsetMinutes:0}},records:[
 {id:'chart',kind:'의무기록',source:'전자의무기록',provenance:'병원 원본 저장 내역',eventId:'sedation',at:'2026-05-14T13:51+09:00'},
 {id:'cctv',kind:'CCTV',source:'복도 영상 저장장치',provenance:'원본 해시·관리자 인계 기록',eventId:'corridor',deviceId:'hallcam',at:'2026-05-14T14:06+09:00'},
 {id:'access',kind:'출입기록',source:'카드 시스템',provenance:'서버 로그 사본',eventId:'corridor',at:'2026-05-14T14:06+09:00'},
 {id:'forensic',kind:'감정서',source:'법과학 감정',provenance:'검체 봉인·인계 연쇄',eventId:'report',at:'2026-05-14T19:40+09:00'},
 {id:'dna',kind:'DNA 대조',source:'법과학 감정',provenance:'대조시료 동의 및 봉인 기록',eventId:'report',at:'2026-05-14T19:40+09:00'},
 {id:'nurse',kind:'간호기록',source:'회복실 기록',provenance:'서명 포함 원본',eventId:'recovery',at:'2026-05-14T15:26+09:00'}
 ]});
const anchor={fact:'박지민의 14시 10분 복귀 진술과 CCTV에 표시된 14시 18분 재진입 장면',eventId:'corridor'};
const mk=(id,phase,speaker,text,purpose,support,replyTo,extra={})=>({id,phase,speaker,text,purpose,issueId:'witness_timing',target:anchor,support,replyTo,...extra});
const dialogue={lines:[
 mk('question','question','defense','경찰 조사에서 오후 2시 10분 무렵 돌아왔다고 진술했지요?','establish',[{type:'testimony',id:'1'}]),
 mk('answer','answer','witness','네. 물품을 가져오고 금방 돌아온 것으로 기억했습니다.','clarify',[{type:'argument',id:'question'}],'question'),
 mk('show_cctv','confrontation','defense','복도 CCTV에는 오후 2시 18분 재진입 장면이 있습니다. 증인의 복귀 시각이 정확합니까?','impeach',[{type:'argument',id:'answer'},{type:'evidence',id:'cctv'}],'answer'),
 mk('explain','explanation','witness','시계를 확인하지 않았습니다. 제가 추정한 시각이 틀렸을 수 있습니다.','explain',[{type:'argument',id:'show_cctv'}],'show_cctv'),
 mk('prosecution','claim','prosecution','복귀 시각의 착오와 그 사이 시술실에서 실제로 일어난 행위는 구분해 판단해야 합니다.','argue',[{type:'argument',id:'explain'}],'explain'),
 mk('defense','rebuttal','defense','동의합니다. 다만 증인의 직접 관찰 범위가 어디까지인지 반드시 확인해야 합니다.','respond',[{type:'argument',id:'prosecution'}],'prosecution')
]};
const followUp={id:'family-paternity-001',category:'family',sourceCaseId:definition.id,
 label:'출산 후 친자관계 분쟁',minimumDate:'2027-01-01',conditions:['birth_recorded','paternity_disputed','authorized_claimant'],
 legalNote:'사건 당사자와 혼인관계·기존 법률상 부자관계에 따라 인지청구·친생부인·친생자관계존부확인 등 정확한 소송 유형과 당사자 적격을 별도로 검토한다. 형사 판결이나 임신만으로 친자관계가 확정되지 않는다.',
 evidenceNeeded:['출생 관련 기록','유전자 감정 결과','기존 법률상 부모 관계','당사자별 주장'],independentProceeding:true};
return {definition,manifest,dialogue,followUp};
});
