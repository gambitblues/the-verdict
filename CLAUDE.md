# THE VERDICT — 작업 인수인계 (새 세션은 이 파일부터 읽기)

풋볼매니저식 법정 시뮬레이션 PWA. 바닐라 JS, 빌드 도구 없음. GitHub Pages(main)에서 서비스.
**다음으로 `docs/HANDOFF.md`를 읽는다** — 게임 방향, 사건(세계 시트) 쓰는 법, 지금 어디까지 왔는지. 다음 업데이트 할 일은 `docs/BACKLOG.md`.
구조는 `docs/ARCHITECTURE.md`, 버전별 변경은 `docs/CHANGELOG.md`, 배포 정책은 `docs/RELEASE_WORKFLOW.md`.

## 사용자(기획자)와 일하는 방식
- 답은 한국어로. 게임 안 문구는 고등학생도 이해할 쉬운 말로(전문 용어·게이지 수치 노출 금지).
- 최우선 가치는 **몰입감**. 기능을 붙일 때 "이게 판사로서의 체감을 늘리나"를 먼저 본다.
- 사용자 테스트는 **항상 새 게임**으로 한다. 구버전 세이브 마이그레이션보다 새 게임 경험이 우선(단, 세이브가 깨지면 안 됨).
- 피드백은 보통 "사용자 테스트 체크리스트"(P0/P1/P2)로 온다. 항목별로 반영하고 보고한다.
- "배포해줘" 요청이 오면 main까지 올린다. 최근에는 기능 요청 뒤 바로 배포하는 흐름을 원함.
- 서버는 아직 없음(로컬 저장). 나중에 서버 + AI로 NPC·사건 생태계를 만들 계획이라, 데이터는 직렬화 가능한 평범한 객체로 두고 `offerPair(slot)`처럼 서버로 옮기기 쉬운 모양을 유지한다.

## 개발 분담: 기획자 초기 개발 → Claude 최종 검수·배포 (2026-11 확정)
- 기획자가 develop(큰 기능은 `feature/이름` 브랜치)에 초기 개발을 올리고, "검수해줘 + 범위(브랜치명·오늘 커밋 등)"로 요청한다.
- Claude 검수 항목:
  1. 위 테스트 전부 + `tests/advanced-*.test.cjs`
  2. 코드 읽기(버그·기존 세이브 호환·새 게임 동작)
  3. 390px 아이폰 / 412px 폴드 접힘 / 884px 폴드 펼침 스크린샷 눈 확인
  4. 게임 문구 규칙(쉬운 말·수치 비노출·성별 단어·조사)
  5. 공개 범위(개발용 테스트 화면·실제 판례 원문·개인 식별 정보가 main에 섞이지 않게)
- 작은 문제는 바로 고치고, 기획 판단이 필요한 것은 물어본 뒤 배포한다. 끝나면 한국어로 짧게 보고(바뀐 것·고친 것·확인할 곳).
- 기획자 쪽 약속:
  - 버전 번호(`index.html`·`sw.js`·CHANGELOG)는 Claude가 배포 때 맞춘다.
  - 사건 데이터는 `curated/*.js`만 고친다(`curated_cases.js`는 빌드 산출물).
  - 게임에 아직 연결하지 않은 기능은 Advanced처럼 별도 파일·스위치로 분리한다.
- 같은 메시지 커밋이 2~3번 반복돼 들어오는 일이 있다(기획자 도구 재시도). 동작 문제는 없고, 검수 때 필요하면 정리한다.
- Advanced 엔진(`advanced_*.js`, `docs/ADVANCED_ENGINE.md`)은 기획자가 개발 중인 독립 모듈이다. 게임에 연결할 때는 아래를 따른다.
  - 세이브에 사건 전체(`lock`)를 복사하지 말고 사건 id·버전·진실·진행 기록만 저장한다(로컬 저장 5MB 한도).
  - 기획 양식은 하나로 유지한다. 기존 양식(`docs/case-template.json`)에 Advanced 칸을 선택 칸으로 더하는 방향을 제안해 둔 상태다(사용자 미확정).
  - 개발용 화면·시범 사건은 `dev/`(예: `dev/advanced-pilot/advanced_pilot.html`), 초안 사건 데이터는 `advanced-content/`에 둔다. 둘 다 main에 올라가지 않는다.
  - Advanced 초안 99건은 아직 틀에서 찍어낸 초안이다. `tests/advanced-content-qa.cjs`가 사건 사이 반복 문장·시각 불일치·주제형 증인 역할을 세고, 문제가 남은 사건은 플레이 가능 표시를 못 한다.
  - 기존 60건 → Advanced 변환은 `advanced_legacy_adapter.js`(집필 문장만 사용, 이름 토큰 유지, 없는 시각·장소는 'needs_authoring'으로 표시).
- **세계 시트(2026-11 확정):** 사건의 고정 사실을 세 세계로 쓰는 양식 `world-sheets/template.json`, 사건은 `world-sheets/cases/<id>.json`(견본 clinic-001). 기획자는 실제 판례를 바탕으로 새 사건을 여기에 올리고, 기존 60건은 요청이 오면 Claude가 같은 수준으로 써서 커밋한다. 법정 진술·전략은 쓰지 않는다(엔진 몫). 폴더는 main에 안 올라간다. 시트를 읽는 매치 엔진 시범 `match_engine.js` + 개발 화면 `dev/match-engine/` (검사·변호사 능력치 4개와 전술 4개, 증인 태도 정직·감싸기·두려움, 거짓은 다른 세계의 같은 칸을 빌림, 자료 제시로 번복 판정, 시각·효력 다툼 중인 자료는 증명에서 빠짐, 판결은 법정 기록으로 가려낼 수 있었는지로 평가). **v8.0부터 게임에 연결됨:** `node tests/build-sheets.cjs`가 review·ready 시트를 `world_sheets.js`(게임 데이터, main에 올라감 — 숨은 진실 공개는 집필 사건과 같음)로 만들고, 60건에 없는 시트는 사건팩 `world-sheets-v1`로 배당 풀에 들어간다. **v8.1(사용자 확정): 재판 UI·진행은 하나 — 모든 사건이 `trial_play.js`의 6개 메뉴(사건·기일·증거·증인·주문·판결)로 진행된다. 새 사건 데이터가 다른 화면이나 엔진으로 바꾸면 안 된다.** `match_play.js`는 시트를 집필 사건 모양으로 바꾸는 다리(`toCurated`: 첫날 자료→증거, 나머지 자료→주문, 시트 인물→증인, 진실별 답), 배당 풀 등록, 사건 화면 '다툼 없는 사실'(`factsOf`), v8.0 매치 재판 세이브 재시작(`reset`)을 맡는다. 매치 엔진 화면 코드는 남아 있지만 연결돼 있지 않다(개발 화면 `dev/match-engine/`에서만 씀). 집필 60건은 원래 글 그대로이고 시트는 다툼 없는 사실에만 쓴다. 시트를 고치면 반드시 다시 빌드. **사건 공급(2026-11 확정):** 기획자는 `world-sheets/seeds.md`에 씨앗(판례·죄명·무슨 일·갈리는 지점)만 계속 추가하고, Claude가 시트를 처음부터 써서 반영한 뒤 씨앗 제목 줄에 `→ <id> (v8.x)`를 표시한다. 목표: 40년 커리어(약 370건) 동안 '해 본 사건' 느낌이 없도록 사건 수를 계속 늘린다.
- 정리 원칙(사용자 요청): 프로그램에 영향 없는 옛 코드·안 쓰는 파일·중복 코드는 검수 때 지운다. 이미 올라간 커밋 기록은 고쳐 쓰지 않는다(공유 브랜치 강제 푸시 금지).

## 확정된 설계 결정
- **시간 두 개:** 현실 시간 배당(10~22시 매시 정각 사건 2건 제안, 3시간 안에 고르지 않으면 다른 재판부로, 진행 중 최대 5건) + 공판을 열 때만 흐르는 하나의 게임 달력(`openSession`이 `14일 ÷ 진행 중 재판 수`, 2~14일).
- 판사 실력 점수는 판결 때 한꺼번에 공개. 여론은 실력 점수에 들어가지 않음.
- 재판일당 증인 신문 4번(민사 6번), 다른 재판부 넘기기 하루 1건.
- 사건 출제 풀은 집필 사건 60건(`curated/`, v6에서 31~60번 추가 · 같은 유형 비율). 41·42·43·59번은 결정형(심리 1회 뒤 바로 결정, 금액 없음). 이야기가 성별에 기대는 사건만 `curated/registry.js`의 `SEX` 표로 성별 규칙을 둔다. **성범죄·스토킹·부부·연인·이혼·양육·불륜 사건은 항상 두 당사자가 이성**(사용자 확정, `OPPOSITE` 정규식으로 자동 적용). **형사 성범죄는 피고인이 항상 남성**(2026-11-03 확정, `SEXCRIME` 규칙 — 새 시트도 피고인에 `"sex": "남"`). 나머지 성별은 무작위이므로 본문에 성별 단정 단어를 쓰지 않는다.
- 인물 고증: 당사자는 `PROFILE` 표(직업·나이·학력·혼인), 증인은 `trial_play.js`의 `witnessProfile` 규칙(관계·경력 연수·직함)으로 나이와 직업을 맞춘다. 사건을 새로 쓰면 `PROFILE`에도 추가할 것.
- 기자 20명(언론사당 1명, 쪽·스타일·이력), 사건당 기사 2편(양쪽 시각). 기자는 처음 카드 열 때 NPC로 생성(`reporter_<n>`).
- 인맥 화면(`people_map.js`)은 실제로 만난 사람만. 관계도에는 법원 동료·법조인·기자만, 사건 당사자·증인은 '사건별 인물관계도'(드롭다운)에만. 미리 만든 법조인 풀은 '법조계 명부'에 접어 둔다. 연애(서민아·최태오)는 숨김(`ROMANCE_ON=false`).
- v6 원칙(사용자 확정): 과거 인물은 의미 있는 연결이 있을 때만 재등장. MBTI·혈액형은 인물카드에 보이고 행동 능력은 따로 계산(수치 비노출). 사건 사실·진실은 생성 때 고정, 진술·전략·관계만 상황 따라 변화. 영속 인물은 200~300명 규모(법조인 ~210 + 전문가 명부).
- 증인 태도는 인물 성향+이해관계로(`behaviour`), 증거 반박·대질·재판부 의견·몇 년 뒤 진실은 `trial_play.js`/`v6_world.js`.
- 집필 문장 규칙: 인물 이름 뒤 조사는 항상 `{A|이}`처럼. 호칭은 `{A>B}`(B가 A를 부르는 형·오빠·누나·언니). '쫓아내'처럼 성별 단어(아내)를 품은 말도 QA에 걸린다.

## 테스트 (모두 통과해야 배포)
```
node tests/trial-core.test.cjs
node tests/media-desk.test.cjs
node tests/save-store.test.cjs
node tests/narrative-qa.cjs        # 집필 사건 문장·조사·구조 검사
node tests/version.test.cjs        # index.html 버전 = sw.js CACHE = CHANGELOG 첫 항목
node tests/v6-case-matrix.test.cjs  # 60건 × 80시드 증거·결정성 (개발자 추가)
node tests/v6-behaviour.test.cjs    # 증인 태도·이의·증거 반박·대질·주문 결과 순수 함수
node tests/career-hearing-events.test.cjs  # 40년 경력 성장 속도·공판 중 당사자 자료
node tests/world-sheets.test.cjs   # 세계 시트(world-sheets/cases) 구조·세 세계 구별
node tests/match-engine.test.cjs   # 매치 엔진: 세계 불변·거짓은 다른 세계 사실에서만·판마다 다른 재판
node tests/build-sheets.cjs --check  # world_sheets.js가 시트와 같은지 (시트 고치면 node tests/build-sheets.cjs)
node tests/build-curated.cjs --check # curated_cases.js·curated_index.js·case-data/가 curated/와 같은지
node tests/case-data.test.cjs      # 사건 데이터를 필요할 때 불러오기: 색인+case-data = 전체, 오프라인 목록
ln -sfn "$(npm root -g)" node_modules && node tests/browser-smoke.mjs; node tests/v6-flow.mjs; node tests/court-orders.mjs; node tests/visuals.mjs; node tests/responsive.mjs; node tests/hearing-events.mjs; node tests/evidence-moments.mjs; node tests/v5-migration.mjs; node tests/v6-narrative-combos.mjs; node tests/match-play.mjs; node tests/verdict-v82.mjs; node tests/verdict-v83.mjs; node tests/docket-offers.mjs; node tests/family-kin.mjs; node tests/auth-gate.mjs; node tests/clerk-review.mjs; node tests/colleague-court.mjs; node tests/ai-wording.mjs; node tests/long-career.mjs 40; rm node_modules
(cd server/worker && npm test)   # Worker: 인증·명단·동시 호출 한도·사용량·뜻 검사·되돌림 (가짜 fetch)
(cd server/supabase && npm i && npm test)   # DB 권한·세이브 버전·공유 세계 쓰기 차단 (PGlite에서 001_init.sql 실행)
```
- `curated/*.js`를 고치면 `node tests/build-curated.cjs`(→ `curated_cases.js`·`curated_index.js`·`case-data/<id>.json`), 그다음 `node tests/build-sheets.cjs`(→ 시트 파일과 `case-data/manifest.json`)를 다시 돌린다.
- **사건 데이터는 필요할 때 불러온다(v8.2.3):** 게임은 처음에 색인(`curated_index.js` 51KB·`world_sheets_index.js` 26KB)만 읽고, 사건의 법정 기록은 배당되거나 열 때 `case-data/<id>.json`·`sheet-<id>.json`에서 가져온다(`VerdictCurated.load/isLoaded/loadMany/loadAll`). 받기 전에는 `curOf`가 null이고 법정 화면은 '불러오는 중'을 보여 재판을 색인만으로 만들지 않는다. 세이브에 있는 사건은 시작 때 미리 받는다. 서비스 워커가 `case-data/manifest.json`의 파일을 모두 저장해 오프라인도 된다. 전체 파일 `curated_cases.js`·`world_sheets.js`는 테스트·도구용(게임은 안 읽음). 엔진 수준 브라우저 테스트는 시작 뒤 `VerdictCurated.loadAll()`을 부른다.
- **브라우저 테스트의 팝업:** `tests/lib/court-ui.mjs`(팝업 종류별 처리·상태 대기·한 번만 실행)를 쓴다. `ui.modal`을 강제로 지우지 않는다.
- 화면을 바꾸면 Playwright로 390px 모바일 스크린샷을 찍어 직접 확인한다.

## 릴리스 절차
1. `index.html`의 `VERDICT_VERSION`/`VERDICT_RELEASED`, `sw.js`의 `CACHE`, `docs/CHANGELOG.md` 맨 위 항목을 같은 번호로.
2. develop에 커밋. 작성자 `Claude <noreply@anthropic.com>`, 메시지 끝에 세션이 지정한 Co-Authored-By/Claude-Session 줄.
3. `git push origin develop`
4. main 반영: `scripts/release-main.sh X.Y.Z` (두 부모 병합 커밋. 개발 전용 `dev/`·`advanced-content/`는 빼고 올린다 — 공개 사이트에 테스트 화면·초안 사건이 나가지 않게). 직전 Pages 배포가 끝났는지 먼저 `gh run list -R gambitblues/the-verdict --branch main -L 1`로 확인.
5. 사용자에게 한국어로 짧게: 무엇이 바뀌었는지, 확인할 곳.

## 현재 상태
- 최신 버전은 `docs/CHANGELOG.md` 맨 위를 본다.
- v6.1 반영 끝: 청탁 문자(`v6_world.js` pressure), 인사철·희망 재판부(×3 가중, 독점 아님), 순수 함수 분리, 검수 테스트 셋, 야간 QA.
  - 청탁 기획 기본값(사용자 미확정, 추천안으로 진행): 보고 시 변호사는 징계 회부·그 밖은 경고 서한, 무시는 판결 반년 뒤 기사 위험(유리한 판결·누적 시 증가), 희망 부서는 '더 자주'.
- v6.2 반영 끝: 재판장 주문(`trial_play.js` availableOrders/issueOrder/resolveOrders, 결과 규칙 `T.orderOutcome`). 사건 전용 주문은 집필 `detail.followUps`(issue·type·to·evidence/witness, 진실별 `have`·`none`)로 쓰고 지금은 대표 3건(냉동 창고·호텔·배수문)만 있다 — 다른 사건에 추가하면 `narrative-qa`가 구조를 검사. 기사·SNS는 재판 전 전망 / 선고 후 평가·비판. 새 게임은 두 슬롯·스냅숏까지 전부 삭제(계정 생기기 전까지).
- v6.5 반영 끝: 60건 모두 후속 노드(`curated/follow1~11.js`, registry가 각 사건 `followUps`에 합침). 노드 필드: id·issue·type·to·day·after(heard 'w:q' / got·miss·done 노드 / contra 쟁점 / any·all)·ask·evidence(출처: by·when·how·caveat, 진실별 값)·witness·recall{w,q}·answer{p,d}·have/none. 결정형은 `now:true`(그 자리 질문). 5기일부터는 recall·explain만. 노드는 앞선 노드만 참조(QA 검사). 새 사건을 쓰면 노드 5개 이상 + recall·explain·3기일 이후 노드 + 거절/없음 뒤 miss 노드가 있어야 narrative-qa 통과.
- v6.6 반영 끝: 증거 모양 11가지(`court_visuals.js` EV_TYPES, 순서가 중요), 증인 순간(`trial_play.js` momentOf → `VerdictVisuals.record(...,moment)`, 증인 `moments`). 갤러리 `qa-visuals/evidence-gallery.png`로 눈 검수.
- v6.9 반영 끝: 기자 인터뷰(`world_feed.js` IQ/interviewStep → 기사·여론), 문자 문장 풀(TPL text 배열), 배석판사 의견(`v6_world.js` ADVICE/ADVICE2), 인물 학력 고증(`fitPeople`, EDU 표), '주문' 탭(기록 탭은 선고 뒤에만), 새 증거·증인 먼저(`orderOf`), 피고인·당사자 신문(`curated/party1~4.js` → 사건 `party`, `askParty`, 진술 거부 20%). (선고 때 남기는 말은 v8.2에서 사용자 요청으로 뺐다.)
- v7.0.x 반응형: 화면 구간 ≤599 / 600~1100(하단 메뉴 유지) / ≥1101(사이드바). 하단 메뉴·재판 버튼 줄·본문 여백은 `game.css` 맨 끝 v7.0.2 블록 한 곳(`--nav-total`)에서만 정한다. 숨은 화면 높이는 `viewport_fix.js`(`--vv-gap`, 키보드 `kb-open`, 홈 화면 실행 `app-mode`). 화면을 바꾸면 `tests/responsive.mjs`도 돌린다.
- v8.2 반영 끝(사용자 확정): 이의는 신문 중에(유도·관련성은 답 전 / 남에게 들은 말은 답 뒤, `live` 카드), 증거능력(뺀 말은 기록·판단·판결문 어디에도 없음)과 신빙성(이의가 있었지만 남긴 말은 `weak`, 판단 무게 절반)을 나눔, 판결 창 5단계(결론·주문·이유·미리보기·선고), 징역 6개월 단위·집행유예 1~5년(3년 이하만)·벌금 사건별 단위와 직접 입력·병과(법이 정한 죄만, `penaltyOf`)·무기·**사형**(법정형에 있을 때), 배상액 100만 원 단위와 직접 입력, 판결 결과가 인물의 재산·사는 곳·직업에 반영(`st.sentenced` → `npc_life_justice.applySentenced`). 시트의 선택 칸 `questions`·`orders`·`claim.remedies`·`charge.orders`·`after`는 양식과 검사만 준비(게임 연결은 다음).
- v8.3 반영 끝(사용자 확정 순서: 깊이 먼저 → 씨앗 시트): 사건 전용 증인 질문(시트 `questions`: 자동 질문보다 먼저, `after`로 주문 자료·다른 답 뒤에 열림 → `q.needs`/`needsMet`), 사건 전용 재판장 주문(시트 `orders`: 자료별 문구·쟁점·진실별 결과 `result` → 노드 `result`/`have`), 부수 명령(형사 `addons`: 시트 `card.charge.orders`·집필 `curated/extras.js` — 요건 안 되면 회색+이유, `expected`는 빠뜨리면 감점, `notice`는 판결문 고지), 금전 외 조치(민사 `remedies`: 청구한 것만, `상환`은 동시이행 문장, `fit` 진실별 채점), 판결 뒤 삶(`after`: A/B × yes/no/part → 결과 화면·인물 기억). 채점은 `T.skill(...extra)`. 대표 10건에 채움(시트 adv-cr-001·003·006·009, 집필 살인 주차장·스토킹·태양광·그림·강아지·상속). 부수 명령 요건은 2026년 기준 법령을 따라 썼으니 새 사건에 붙일 때 다시 확인.
- v8.4 반영 끝: 씨앗 016~026 중 9건을 시트로(022·023은 기획자 결정으로 제외, v8.4.1). 시트 사건의 `reason` 세계가 일부 유죄면 `cur.partial` → 판결 창에 '일부만 유죄'(`partialOption`). v8.5: 씨앗 027~048에서 10건 추가, 9건 제외(이상한 씨앗은 Claude가 판단해 빼고 seeds.md에 이유 — 기획자 지시). 다음은 038·041·043, 그다음 049부터.
- v8.5.1: 배당 제안 유효성 검사(`game_hearings.js` freshPool/revalidate/dedupeOpen) — 진행 중·판결한·다른 재판부로 최근 넘어간·다른 시간대 제안에 있는 사건은 새 사건이 남아 있는 동안 다시 나오지 않고, 다 본 뒤에는 오래된 것부터 돌아온다. 같은 사건 두 건 수락은 거절. 테스트 `tests/docket-offers.mjs`.
- v8.7(develop, 검수 전 — 사용자 지시: 검수 전 main 배포 금지): 비공개 로그인(`auth_gate.js`, Supabase Auth REST, 초대 2명), 계정별 세이브(로컬 키 교체 + `saves` 표), AI 문장(`ai_bridge.js` → Worker `server/worker` → OpenAI Responses, 사건 생성 Terra `gpt-6.1-terra`·대화/기사/판결문 Luna `gpt-6-luna`). 서버 설치·첫 호출은 `server/README.md`. AI는 문장만 바꾸고 실패하면 엔진 문장. 숨은 진실은 서버로 보내지 않는다. v8.7.1: 온라인 확인 실패 시 로그인 불가·오프라인은 7일 안에 확인된 기기 주인만, 세이브는 `save_put` 버전 충돌 시 묻고 양쪽 보관, AI는 사용량 예약 뒤에만·뜻 검사 2단. 다음(사용자 지시 순서): 실제 Supabase·Cloudflare 연결 → 그 뒤 Terra 사건 생성·공동 합의부.
- v8.7.4(develop, 검수 1차): 빈 config면 혼자 하기, 실행 중 클라우드 세이브는 저장 멈춤→재시작, AI에는 화면에 보이는 것만(숨은 태도 금지), 증거 AI 해설 제거, AI는 법정 사건(개정·마지막 기일)에서만. 판결 탭 '재판연구원 의견'(`clerkCard`, AI 없음)과 '판결 작성 검토'(`draftAdvice` 조언 / `legalProblems` 차단). DB `032`(request.jwt.claims) `033`(열린 기일 유지) `034`(합의부: 종류별 의견·변론 종결·66조·심의 3번·기권/대리).
- v10.2.0(develop, 2026-11-08 · main 배포 안 함): 합의부 형량·배상액 = 세 의견의 가운데 값(`server/worker/src/p5_sentence.js`, DB `036` — Worker보다 먼저 실행), 로그인 선택('로그인 없이 혼자 하기' = 기기의 주인 없는 기록, `vauth_guest`), 로그인 상태 새로하기는 기기·서버에 먼저 보관. 공유 법정 확인은 `window.confirm` 대신 두 번 누르기.
- v10.3.0(develop, 2026-11-08 · main 배포 안 함, 기획 확정 '가벼운 공유 세계'): 다른 플레이어 = 같은 법원 동료 판사(인맥 '법원 동료' + '법원 소식' 기사)만, 같은 사건 동시 배당 금지. `colleague_court.js`(로그인·037 있을 때만, 없으면 조용히 쉼) + DB `037`(court_judges·court_cases, 플레이어가 자기 줄만 RPC로 씀). 서버로는 사건 제목·결론·형량·공판 수만(인물 이름·진실·점수·세이브 금지). 따로 기소된 증인은 시트 `people[].separate`(charge + 세 세계 문장, `{W|은}`) / 집필본은 증인 객체 `separate`(`{W1|은}`) → 내 선고 3~8주 뒤 기사(로그인 무관). P4 공유 법정·P5 합의부 화면은 연결하지 않고 스위치 꺼 둠. 다음 단계(반응 보고): 대표 사건에 짝 시트를 써서 별건 사건을 실제 동료에게 배당.
- v10.4.0(develop, 법원 동료 3단계): 짝 사건 — 원래 시트 증인 `separate.case`가 짝 시트를 가리키고, 짝 시트는 `linked:{from,witness,worlds}`(원래 세계→짝 세계). 짝 사건은 `world_sheets*.js`의 `linked`(팩 밖)에만 있어 혼자 하는 배당에 안 나옴(`VerdictMatchPlay.linkedCandidate`). 원래 사건 선고 요약에 `links:[{case,world}]` → 동료에게 24시간 배당 후보(`offers[].linked`, 옵션 `link`) → 수락 시 `c.linkedWorld`로 진실 고정(`trial_play` ensure) → 동료 선고 요약 `from:{judge,parent}` → 원래 판사 세계에 증인 소식. 36시간 안에 아무도 안 맡으면 NPC 판사 기사. 지금 2건(link-cr-020-w1, link-ghost-w1).
- v10.5.0(develop): **AI 문장 규칙(기획 확정)** — 화면에 한 번 나온 문장은 안 바뀐다(증인 답은 `heard[].ai`에 그때 쓴 문장, 첫 기일·최종 변론·판결문은 짧게 기다린 뒤 `aiOpeningLock`·`aiClosingLock`·`final.judgmentLock`). 증인 답 AI는 시트의 역할별 기본 질문(`q.auto`)만, 증인이 증인석에 서면 미리(`aiPrefetch`), 나이·직업 함께. 기사·배석판사 메모 AI 경로는 삭제. **항소** — 형사만 한 번(`S.cases[id].appeal`, 결정은 `colleague_court.js` decideAppeals), 동료에게 '(항소심)' 배당 후보(옵션 `link.appeal` → `c.appeal`), 결과는 `appealOf`로 1심 판사에게, 동료 없으면 NPC 항소심(appealTick). **Terra** — Worker 크론 켬(`TERRA_REFILL_ENABLED=1`, 소재 VARIANTS), `tests/terra-pull.cjs` + `.github/workflows/terra-pull.yml`(변수 `TERRA_PULL_ENABLED`, 비밀 `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`)이 QA 통과 초안을 world-sheets로 PR. DB `038`.
- 다음 후보 아이디어: 기자와의 관계를 문자·인터뷰 외 이벤트로 확장.
