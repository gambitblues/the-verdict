# THE VERDICT — 작업 인수인계 (새 세션은 이 파일부터 읽기)

풋볼매니저식 법정 시뮬레이션 PWA. 바닐라 JS, 빌드 도구 없음. GitHub Pages(main)에서 서비스.
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
- **세계 시트(2026-11 확정):** 사건의 고정 사실을 세 세계로 쓰는 양식 `world-sheets/template.json`, 사건은 `world-sheets/cases/<id>.json`(견본 clinic-001). 기획자는 실제 판례를 바탕으로 새 사건을 여기에 올리고, 기존 60건은 요청이 오면 Claude가 같은 수준으로 써서 커밋한다. 법정 진술·전략은 쓰지 않는다(엔진 몫). 폴더는 main에 안 올라간다. 시트를 읽는 매치 엔진 시범 `match_engine.js` + 개발 화면 `dev/match-engine/` (검사·변호사 능력치 4개와 전술 4개, 증인 태도 정직·감싸기·두려움, 거짓은 다른 세계의 같은 칸을 빌림, 자료 제시로 번복 판정, 시각·효력 다툼 중인 자료는 증명에서 빠짐, 판결은 법정 기록으로 가려낼 수 있었는지로 평가). 아직 게임에 연결 안 됨.
- 정리 원칙(사용자 요청): 프로그램에 영향 없는 옛 코드·안 쓰는 파일·중복 코드는 검수 때 지운다. 이미 올라간 커밋 기록은 고쳐 쓰지 않는다(공유 브랜치 강제 푸시 금지).

## 확정된 설계 결정
- **시간 두 개:** 현실 시간 배당(10~22시 매시 정각 사건 2건 제안, 3시간 안에 고르지 않으면 다른 재판부로, 진행 중 최대 5건) + 공판을 열 때만 흐르는 하나의 게임 달력(`openSession`이 `14일 ÷ 진행 중 재판 수`, 2~14일).
- 판사 실력 점수는 판결 때 한꺼번에 공개. 여론은 실력 점수에 들어가지 않음.
- 재판일당 증인 신문 4번(민사 6번), 다른 재판부 넘기기 하루 1건.
- 사건 출제 풀은 집필 사건 60건(`curated/`, v6에서 31~60번 추가 · 같은 유형 비율). 41·42·43·59번은 결정형(심리 1회 뒤 바로 결정, 금액 없음). 이야기가 성별에 기대는 사건만 `curated/registry.js`의 `SEX` 표로 성별 규칙을 둔다. **성범죄·스토킹·부부·연인·이혼·양육·불륜 사건은 항상 두 당사자가 이성**(사용자 확정, `OPPOSITE` 정규식으로 자동 적용). 나머지 성별은 무작위이므로 본문에 성별 단정 단어를 쓰지 않는다.
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
ln -sfn "$(npm root -g)" node_modules && node tests/browser-smoke.mjs; node tests/v6-flow.mjs; node tests/court-orders.mjs; node tests/visuals.mjs; node tests/responsive.mjs; node tests/hearing-events.mjs; node tests/evidence-moments.mjs; node tests/v5-migration.mjs; node tests/v6-narrative-combos.mjs; node tests/long-career.mjs 40; rm node_modules
```
- `curated/*.js`를 고치면 `node tests/build-curated.cjs`로 `curated_cases.js`를 다시 만든다.
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
- v6.9 반영 끝: 기자 인터뷰(`world_feed.js` IQ/interviewStep → 기사·여론), 문자 문장 풀(TPL text 배열), 배석판사 의견(`v6_world.js` ADVICE/ADVICE2), 인물 학력 고증(`fitPeople`, EDU 표), '주문' 탭(기록 탭은 선고 뒤에만), 새 증거·증인 먼저(`orderOf`), 피고인·당사자 신문(`curated/party1~4.js` → 사건 `party`, `askParty`, 진술 거부 20%), 선고 때 남기는 말(`remarksFor`).
- v7.0.x 반응형: 화면 구간 ≤599 / 600~1100(하단 메뉴 유지) / ≥1101(사이드바). 하단 메뉴·재판 버튼 줄·본문 여백은 `game.css` 맨 끝 v7.0.2 블록 한 곳(`--nav-total`)에서만 정한다. 숨은 화면 높이는 `viewport_fix.js`(`--vv-gap`, 키보드 `kb-open`, 홈 화면 실행 `app-mode`). 화면을 바꾸면 `tests/responsive.mjs`도 돌린다.
- 다음 후보 아이디어: 기자와의 관계를 문자·인터뷰 외 이벤트로 확장, 서버·AI 연동 준비.
