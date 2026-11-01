/* Case-specific v1 editorial layer for the remaining 94. Fiction, not judicial facts. */
const source=require('./individualized-overrides.cjs');
const authored=new Set(source.cases.filter(c=>c.qa.individualizedAuthorship).map(c=>c.id));
const clone=v=>JSON.parse(JSON.stringify(v));
const sites=['자료보관실','계약상담실','주차관제실','3층 복도','작업장 출입구','접견실','회계팀 사무실','후문 경비실','회의실','응급접수대','민원상담실','세탁실','창고 B동','점포 계산대','옥상 계단참'];
const observers=['보안 담당자','장부 작성자','현장 관리인','직원 대표','서류 접수자','시설 관리자','거래 입회자','CCTV 관제요원'];
const money=i=>(24+i*17)%190*100000+500000;
function editorial(c,index){
 const t=c.legal?c.legal.workingTitle:c.pleading?.issue||'분쟁';
 const p=c.fictionalLocation,room=sites[index%sites.length],other=sites[(index+5)%sites.length];
 const date=c.definition.variants.did.events[0].at.slice(0,10);
 const h=(9+(index%9));const clock=String(h).padStart(2,'0');
 const amount=money(index).toLocaleString('ko-KR');
 const subtype=/마약|향정/.test(t)?'drug':/강간|추행|성폭력|촬영|딥페이크/.test(t)?'sex':/사망|살인|치사|상해|폭행|방화|화재/.test(t)?'harm':/음주|운전|교통/.test(t)?'traffic':/사기|횡령|수뢰|조세|대금|투자|금융|보증금|채권|계약/.test(t)?'money':c.category==='family'?'family':c.category==='administrative'?'admin':/개인정보|비밀|스토킹|명예/.test(t)?'digital':/의료|진료|과실|약국/.test(t)?'medical':'property';
 const templates={
 drug:[`피의자는 ${date} ${clock}:15 ${room}에서 첫 투약을 인정했지만, 이틀 뒤 22:40 ${other}에서의 투약과 일주일 뒤의 재투약은 부인한다.`,`압수물에서는 메트암페타민 성분이 확인됐지만 해당 성분 검출만으로 혐의상 세 회차의 일자를 각각 확정할 수 없다.`,`첫 진술에서 몇 회 투약했다고 인정했습니까?`,`첫날 한 차례라고 말했습니다. 나중에 같은 사람을 다시 만난 건 맞지만 투약했다는 뜻은 아닙니다.`,`거래 상대방을 만난 날짜와 실제 투약한 날짜를 같은 것으로 보아선 안 됩니다.`],
 sex:[`${date} ${clock}:15 ${room}에서의 접촉 또는 촬영 혐의. 신고인은 동의하지 않았다고 주장하고 피고인은 정확한 행위 유형을 다툰다.`,`신고 당일 검체·디지털 자료의 원본 인계 및 작성 시각을 특정해야 한다. 관련 성분 검출로 동의·삽입·정확한 행위 시점 전체를 단정할 수 없다.`,`그 장면을 직접 기억하십니까, 신고 이후 자료를 보고 알게 된 겁니까?`,`문 앞까지는 기억합니다. 내부의 일부 장면은 이후 자료를 확인하고 알았습니다.`,`감정 결과가 무엇을 검출했는지와 법적으로 다투는 행위의 유형을 구분해야 합니다.`],
 harm:[`${date} ${clock}:15 ${room}에서 말다툼 직후 신체 접촉이 있었고 ${clock}:23 ${other}에서 피해자가 쓰러진 채 발견됐다.`,`진료기록에는 두부 또는 몸통 손상이 기재됐다. 손상 발생 시각과 행위자의 특정은 감정서 외 다른 자료와 종합해야 한다.`,`피해자를 마지막으로 멀쩡하게 본 시각이 정확히 언제입니까?`,`말다툼이 끝날 때는 서 있었습니다. 쓰러지는 순간을 직접 보지는 못했습니다.`,`피고인의 접촉과 부상 결과의 인과관계 및 고의는 각각 심리해야 합니다.`],
 traffic:[`${date} ${clock}:15 ${p} 진입도로에서 충돌이 발생했고 차량 블랙박스에는 충돌 직전 8초만 남아 있다.`,`운전 시점과 호흡측정 시각 사이의 간격, 신호주기, 피해 차량의 진입 경로가 서로 독립된 입증 항목이다.`,`차량이 교차로에 진입할 때 신호등이 무슨 색이었습니까?`,`제 차에서는 녹색으로 보였지만 상대 차량의 신호는 직접 확인하지 못했습니다.`,`측정값과 충돌의 원인을 하나로 묶지 말고 시각별로 나눠야 합니다.`],
 money:[`${date} ${clock}:15 ${room}에서 ${amount}원 지급 관련 약속이 작성됐고 ${clock}:48 ${other}에서 다른 조건이 구두로 논의됐다.`,`입금기록은 금전 이동을 증명하지만 지급의 법적 원인과 반환 약정의 최종 내용을 단독 입증하지 않는다.`,`이체된 ${amount}원의 반환일이 문서에 명시돼 있었습니까?`,`원래 문서에는 기한이 있었지만 그날 오후에 연장을 말로 합의했다고 들었습니다.`,`문서 조항과 사후 구두변경의 증거를 분리해 봐야 합니다.`],
 family:[`${date} ${clock}:15 ${room}에서 부부·가족의 재산 및 거주에 관한 대화가 이뤄졌고 당사자들은 그날 합의의 범위를 다르게 설명한다.`,`가족관계 기록은 법률상 신고사실을, 송금자료는 금전 이동을 보여줄 뿐 실제 양육과 혼인 파탄의 모든 경위를 대체하지 않는다.`,`당일 대화에서 자녀의 거주와 비용 분담을 누가 어떻게 말했습니까?`,`비용을 함께 내기로 한 건 들었습니다. 영구적으로 양육권을 넘긴다는 표현은 듣지 못했습니다.`,`재산분할, 양육과 친자관계는 서로 다른 법적 요건이 있습니다.`],
 admin:[`${date} ${clock}:15 ${p} 현장 점검표가 작성됐고 ${clock}:48 담당자에게 보완 요구가 전달됐다.`,`점검표의 사실관계가 맞더라도 처분 사전통지·의견 제출·재량 판단의 적법성은 별도로 검토해야 한다.`,`처분 전 당사자가 조사결과에 의견을 낼 기회가 있었습니까?`,`점검 당일 구두 설명은 했지만 정식 안내문을 송달했는지는 기록을 확인해야 합니다.`,`현장 위반 사실과 절차적 하자는 별개로 판단해야 합니다.`],
 digital:[`${date} ${clock}:15 ${room}에서 계정 접속 또는 반복 연락이 기록됐지만 사용자의 실제 신원과 행위 목적은 다투어진다.`,`접속 IP와 기기 ID는 접근 경로를 나타내며 특정인의 실제 입력 행위는 단독 확정하지 못한다.`,`기록된 계정에 누가 접근 권한을 갖고 있었습니까?`,`정규 직원 두 명에게 권한이 있었고 기록상 계정 이름만으로 조작자를 알 수 없습니다.`,`로그 생성과 특정인의 고의를 동일시해서는 안 됩니다.`],
 medical:[`${date} ${clock}:15 ${room}에서 의료행위 또는 안전점검이 이뤄졌으나 ${clock}:48 기록과 인계표의 시각이 다르다.`,`진료기록상의 작성 시각과 실제 처치 시각은 다를 수 있으며, 부작용의 원인에는 별도의 의학적 검토가 필요하다.`,`환자의 상태를 직접 확인한 시간과 기록을 입력한 시간이 같습니까?`,`측정은 먼저 했고 기록은 다른 환자 처치 후 입력했습니다. 정확한 차이는 전산기록을 봐야 합니다.`,`결과가 나빴다는 사실만으로 당시 의료행위의 과실을 추정할 수는 없습니다.`],
 property:[`${date} ${clock}:15 ${room}에서 ${t} 관련 서류가 작성됐고 한 시간 뒤 현장 점검에서 당사자 주장이 달라졌다.`,`원본 자료는 현장 상태를 설명하지만 계약상 의무 위반 여부를 평가하려면 작성 날짜와 당사자 합의가 추가로 필요하다.`,`당일 확인한 사실 중 문서에 직접 기록한 내용은 무엇입니까?`,`제가 직접 본 위치와 나중에 전달받은 내용이 섞여 있어 구별이 필요합니다.`,`현장 기록과 계약 당시 상태의 동일성을 먼저 확인해야 합니다.`]
 };
 const [fact,proof,q,a,challenge]=templates[subtype];
 const timeline=[`${date} ${clock}:15 ${p} ${room}: ${fact}`,`${date} ${clock}:48 ${p} ${other}: 서류 및 통신 기록의 기재 시각을 재확인한다.`];
 const otherQ=`${date} ${clock}:48의 자료는 누가 작성했으며 원본을 직접 확인했습니까?`;
 const answer2=`저는 ${other}에서 서류를 전달받았지만 원본 작성 장면을 보지 못했습니다.`;
 const claim=`제1호증 기록은 ${fact} 다만 ${proof}`;
 const rebut=`상대방은 기록의 존재에서 법적 결론까지 한 번에 도출하고 있습니다. ${challenge}`;
 return {id:c.id,title:c.title,subtype,place:`${p} ${room}`,facts:timeline,pleading:`${t}: ${fact}`,evidence:[
 {title:`${room} 원본 기록`,body:`${date} ${clock}:15 기재. ${fact}`},
 {title:`${other} 전산·영상 원본`,body:`${date} ${clock}:48 자료. ${proof}`},
 {title:'진술 및 인계기록',body:`${date} 관련 최초 진술. ${a} 자료 작성·전달 경위는 확인 필요.`}],
 questions:[[q,a,`원본과 다르다면 제가 추정한 시각을 정정하겠습니다. ${proof}`],[otherQ,answer2,`저는 원본 작성자가 아니므로 기록의 진위는 제가 확언할 수 없습니다.`]],
 fight:[`제1호증과 제2호증의 시각 및 관찰 범위를 비교하겠습니다. ${challenge}`,claim,rebut],
 truths:[`핵심 행위는 실제 발생했다. ${fact}`,`핵심 행위는 발생하지 않았고 자료의 해당 표시는 다른 사람·원인으로 생성됐다. ${proof}`,`행위 일부는 있었지만 법률상 고의·귀책 또는 청구범위는 다르다. ${challenge}`],
 review:{sourceFacts:false,legalAccuracy:false,humanAuthorship:false,fullPlaythrough:false}};
}
const records=source.cases.filter(c=>!authored.has(c.id)).map(editorial);
const pack={format:'advanced-remaining-94-expanded/v1',notes:'Distinct factual beats per site and legal domain, but still generated editorial drafts requiring individual human review.',count:records.length,records};
if(require.main===module)console.log(JSON.stringify({records:records.length,subtypes:[...new Set(records.map(r=>r.subtype))].length}));
module.exports=pack;
