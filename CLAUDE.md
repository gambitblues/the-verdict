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

## 확정된 설계 결정
- **시간 두 개:** 현실 시간 배당(10~22시 매시 정각 사건 2건 제안, 3시간 안에 고르지 않으면 다른 재판부로, 진행 중 최대 5건) + 공판을 열 때만 흐르는 하나의 게임 달력(`openSession`이 `14일 ÷ 진행 중 재판 수`, 2~14일).
- 판사 실력 점수는 판결 때 한꺼번에 공개. 여론은 실력 점수에 들어가지 않음.
- 재판일당 증인 신문 4번(민사 6번), 다른 재판부 넘기기 하루 1건.
- 사건 출제 풀은 집필 사건 30건(`curated/`). 이야기가 성별에 기대는 사건만 `curated/registry.js`의 `SEX` 표로 성별 규칙을 둔다. **성범죄·스토킹·부부·연인·이혼·양육·불륜 사건은 항상 두 당사자가 이성**(사용자 확정, `OPPOSITE` 정규식으로 자동 적용). 나머지 성별은 무작위이므로 본문에 성별 단정 단어를 쓰지 않는다.
- 기자 20명(언론사당 1명, 쪽·스타일·이력), 사건당 기사 2편(양쪽 시각). 기자는 처음 카드 열 때 NPC로 생성(`reporter_<n>`).
- 인맥 화면(`people_map.js`)은 실제로 만난 사람만. 미리 만든 법조인 풀은 '법조계 명부'에 접어 둔다.

## 테스트 (모두 통과해야 배포)
```
node tests/trial-core.test.cjs
node tests/media-desk.test.cjs
node tests/save-store.test.cjs
node tests/narrative-qa.cjs        # 집필 사건 문장·조사·구조 검사
node tests/version.test.cjs        # index.html 버전 = sw.js CACHE = CHANGELOG 첫 항목
ln -sfn "$(npm root -g)" node_modules && node tests/browser-smoke.mjs; node tests/long-career.mjs; rm node_modules
```
- `curated/*.js`를 고치면 `node tests/build-curated.cjs`로 `curated_cases.js`를 다시 만든다.
- 화면을 바꾸면 Playwright로 390px 모바일 스크린샷을 찍어 직접 확인한다.

## 릴리스 절차
1. `index.html`의 `VERDICT_VERSION`/`VERDICT_RELEASED`, `sw.js`의 `CACHE`, `docs/CHANGELOG.md` 맨 위 항목을 같은 번호로.
2. develop에 커밋. 작성자 `Claude <noreply@anthropic.com>`, 메시지 끝에 세션이 지정한 Co-Authored-By/Claude-Session 줄.
3. `git push origin develop`
4. main 반영(트리 그대로, 두 부모 병합 커밋):
```
git fetch origin +refs/heads/main:refs/remotes/origin/main
D=$(git rev-parse HEAD); M=$(git commit-tree "$D^{tree}" -p origin/main -p "$D" -m "Release vX.Y.Z to main")
git push origin "$M:refs/heads/main"
```
5. 사용자에게 한국어로 짧게: 무엇이 바뀌었는지, 확인할 곳.

## 현재 상태
- 최신 버전은 `docs/CHANGELOG.md` 맨 위를 본다.
- 다음 후보 아이디어: 기자와의 관계를 문자·인터뷰 외 이벤트로 확장, 서버·AI 연동 준비.
