/* v8.3 — what can be ordered besides the sentence or the money, and how the parties' lives go on (written cases).
 * Merged by registry.js into each case: c.addons (criminal), c.remedies (civil), c.after.
 *
 * addons (ancillary orders with a criminal conviction):
 *   {id, kind, label, needs (one plain line: when the law allows it), order (the judgment's sentence, %n% = years /
 *    hours / 만 원), range:[min,max], step, unit ('년'|'시간'|'만 원'), expected (the law says to order it with a
 *    conviction unless there is a special reason), fixed (always goes with a conviction, not a choice),
 *    ok:false + why (not available in this case, e.g. the prosecutor did not apply), notice (not a choice: a line the
 *    judgment adds), fit:{did,didnt,reason} (whether the record supports it in each world)}
 * remedies (civil, only what the plaintiff asked for): {id, kind ('철거'|'인도'|'이행'|'조정'|'상환'), label, order, note,
 *   fit:{did,didnt,reason}}. '상환' turns the money order into "…와 동시에 지급하라" (simultaneous performance).
 * after: {A:{yes,no,part}, B:{…}} — yes = the accusation or claim was accepted, no = it was not, part = partly.
 * Legal requirements are written from the statutes as of 2026 (전자장치부착법 제5조·제9조, 성폭력처벌법 제16조,
 * 스토킹처벌법 제19조, 형법 제134조, 소송촉진법 제25조, 민법 제250조); check them again when adding cases. */
window.VERDICT_CURATED_EXTRA=[
 {id:'v6-homicide-parking-14',
  addons:[
   {id:'tag',kind:'부착명령',label:'위치추적 전자장치 부착명령',needs:'검사가 청구했어요. 살인죄는 10년~30년 사이에서 정해요.',range:[10,30],step:1,unit:'년',order:'피고인에게 %n%년 동안 위치추적 전자장치의 부착을 명한다.',fit:{did:true,didnt:false,reason:false}}
  ],
  after:{A:{yes:'양조장 지분은 남은 가족에게 넘어갔고, 교정시설에서 첫 해를 보내고 있다. 투자자들과의 소송은 아직 이어지고 있다.',no:'무죄가 확정된 뒤 양조장을 정리했다. 동업자의 장례식에는 끝내 가지 못했다.'},
   B:{yes:'유족은 판결문을 받아 들고 양조장 문을 닫았다. 남은 빚은 투자자들과 나눠 갚기로 했다.',no:'유족은 판결 뒤 다른 채권자를 상대로 민사소송을 내기로 했다.'}}},
 {id:'stalking-repeat-contact',
  addons:[
   {id:'program',kind:'이수명령',label:'스토킹 치료프로그램 이수명령',needs:'스토킹범죄로 유죄를 선고하면 원칙적으로 함께 명해요(200시간 안).',range:[40,200],step:10,unit:'시간',order:'피고인에게 %n%시간의 스토킹 치료프로그램 이수를 명한다.',expected:true},
   {id:'tag',kind:'부착명령',label:'위치추적 전자장치 부착명령',ok:false,why:'검사가 부착명령을 청구하지 않아 고를 수 없어요.'}
  ],
  after:{A:{yes:'구청에서 징계 절차가 시작됐고, 휴대전화 연락처에서 상대의 이름을 지웠다고 상담사에게 말했다.',no:'무죄 판결 뒤 다시 출근했지만 같은 층 사람들과는 말을 거의 하지 않는다.'},
   B:{yes:'판결 뒤 이사한 집 주소는 회사 사람들에게도 알리지 않았다. 퇴근길에 뒤를 돌아보는 버릇은 아직 남아 있다.',no:'판결 뒤 회사를 옮겼다. 메시지 알림은 지금도 꺼 두고 지낸다.'}}},
 {id:'v6-civil-shaded-roof',
  remedies:[
   {id:'lower',kind:'조정',label:'옥상 태양광 구조물을 1미터 낮추게 하기',order:'피고는 그 건물 옥상의 태양광 구조물 꼭대기를 지금보다 1미터 낮추라.',note:'원고가 청구한 "구조물 높이 조정"이에요.',fit:{did:true,didnt:false,reason:true}}
  ],
  after:{A:{yes:'구조물이 낮아진 첫 겨울, 거실 창가에 화분을 다시 내놓았다.',no:'판결 뒤 거실에 조명을 하나 더 달았다. 옆 건물 쪽 창에는 커튼을 쳤다.'},
   B:{yes:'구조물 공사로 발전량이 줄었지만 대출 상환 계획을 다시 짰다. 골목에서 마주치면 먼저 고개를 숙인다.',no:'판결 뒤에도 발전 설비를 그대로 돌린다. 명절 떡은 더 이상 오가지 않는다.'}}},
 {id:'v6-property-returned-painting',
  remedies:[
   {id:'return',kind:'인도',label:'그림을 원고에게 돌려주게 하기',order:'피고는 원고에게 그 그림을 인도하라.',note:'원고가 청구한 "그림의 반환"이에요. 반환이 안 되면 값을 물어 달라는 청구도 함께 있어요.',fit:{did:true,didnt:false,reason:false}}
  ],
  after:{A:{yes:'그림은 수십 년 만에 유족의 거실로 돌아왔다. 잘려 나간 가장자리는 복원하지 않기로 했다.',no:'판결 뒤 경매 도록을 오려 아버지의 작업 노트 사이에 끼워 두었다.'},
   B:{yes:'갤러리를 상대로 구입 대금 반환 소송을 냈다.',no:'판결 뒤 그림을 미술관에 장기 대여하기로 했다.'}}},
 {id:'beta-family-011',
  remedies:[
   {id:'dog',kind:'인도',label:'강아지를 원고에게 돌려주게 하기',order:'피고는 원고에게 강아지를 인도하라.',note:'원고가 청구한 "강아지 반환"이에요.',fit:{did:true,didnt:false,reason:false}}
  ],
  after:{A:{yes:'강아지는 원고의 집으로 갔다. 첫 주에는 현관 앞에서 한참을 기다렸다고 한다.',no:'판결 뒤 입양 계약서를 서랍에 넣어 두었다. 산책길은 바꿨다.'},
   B:{yes:'판결 날 저녁, 강아지의 장난감과 사료를 상자에 담아 보냈다.',no:'강아지는 그대로 피고의 집에서 지낸다. 등록 이름을 바꾸는 절차를 밟고 있다.'}}},
 {id:'inherit-family-records',
  remedies:[
   {id:'deed',kind:'이행',label:'집 명의(소유권이전등기)를 되돌리게 하기',order:'피고는 원고에게 그 집에 관하여 증여를 원인으로 마친 소유권이전등기의 말소등기 절차를 이행하라.',note:'원고가 청구한 "집의 반환"이에요. 반환이 안 되면 값을 물어 달라는 청구도 함께 있어요.',fit:{did:true,didnt:false,reason:false}}
  ],
  after:{A:{yes:'집 명의는 아버지 앞으로 돌아갔고, 형제들은 다시 상속 협의를 시작했다.',no:'판결 뒤 공장 일에 매달렸다. 막내와는 아직 연락하지 않는다.'},
   B:{yes:'아버지의 집을 비워 주고 작은 원룸으로 옮겼다. 번역 일감을 늘렸다.',no:'아버지가 살던 집에 그대로 산다. 맏이에게 보낼 편지를 몇 번 쓰다 말았다.'}}}
];
