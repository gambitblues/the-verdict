# THE VERDICT — P0~P3 통합 QA (develop)

## 후속 QA — Run 41694840528 실패 분석 및 최소 조치 (2026-11-04)

### 결과 구분

| 대상 | 실제 상태 | 증빙/한계 |
|---|---|---|
| `0eb6254` Actions Run `41691697637` | **PASS** | 이전 확인 로그의 전체 browser-smoke 성공. 해당 SHA에만 귀속 |
| `7fb01c6` Actions Run `41694840528` | **FAIL** | Job `126122524703`의 `verdict-v83.mjs` step 13 실패(Exit 1). step 4~12 PASS, 뒤 단계 14~22 **SKIPPED**, 성공으로 보고하지 않음 |
| `tests/verdict-v83.mjs:47` | **실제 CI 재현 증빙 확보, 로컬 재실행 미실행** | `AssertionError: didnt world: the defence hands the video over`; expected `['done']`, actual `[null]`; page errors `[]` |
| `05b7322` 테스트 수정 후 | **새 CI PASS 미확인** | `fetch_commit_workflow_runs`, combined status 조회 결과 빈 목록. 해당 API는 일부 트리거 실행을 조회하지 못하므로 실행 여부/성공 여부 확정 불가 |
| 실 Supabase/AI 및 NPC·뉴스 실제 E2E | **미실행** | 독립 TEST 계정, 공개 환경값, Worker TEST 허용 및 실 브라우저 실행 환경 부재 |

### 원인 및 수정 범위

- **분류: 테스트 자체의 잘못된 가정(현재까지 게임 로직 회귀 증거 없음).** `trial_core.js`의 `orderOutcome`은 사건 주문에 정상 `late` 결과를 낼 수 있고, `trial_play.js:resolveOrders`는 `late`인 주문을 `pending`/결과 `null`로 유지하고 `due=t.day+1`로 이월한다. `world-sheets/cases/adv-cr-001.json`의 `r-hall` 주문은 `didnt` 진실에서 최종 결과 `done`이지만 정상적인 한 기일 지연은 가능하다.
- 기존 `tests/verdict-v83.mjs:47`은 둘째 기일에 무조건 `['done']`을 요구함. 실제 CI에서는 이월 상태의 `[null]`이 발생. 이는 UI/판결 확정이 실패했다는 증거가 아니다.
- **최소 수정:** `tests/verdict-v83.mjs`에서 `null`일 때 `status=pending`, `delayed=true`, `due=현재 기일+1` 검증 후 다음 기일로 진행하여 `status=done`, `outcome=done`을 요구. 즉 주문 이월도 명시적으로 검사하는 회귀 검증을 추가. 게임 엔진/서버/DB 수정 없음.
- 수정 커밋: `05b7322734bbdef5deca68a762f8d2c730aead74` (`develop`). 코드 변경 없음, 테스트 파일만 수정. **테스트 수정 자체가 PASS를 증명하지 않음**.
- 로컬 소스 체크아웃은 GitHub DNS 접근 실패로 불가. 최신 커밋의 워크플로는 확인할 수 있는 새 Run ID/Job 로그 없이 `PASS`라 하지 않는다.

### 실서버 E2E 실행을 위한 정확한 준비물 (운영 데이터 쓰기 금지)

1. **실 운영 계정이 아닌 별도 Supabase QA 프로젝트 권장.** Auth 사용자 2명(`TEST-1`, `TEST-2`에 대응하는 각기 다른 이메일)을 초대하고, `public.players`에 이름이 `TEST`로 시작하는 row를 등록. 두 계정에서 `rpc/is_test_player`가 `true`인지 확인. `saves`와 `save_backups`는 모두 **0행**. 기존 사용자 레코드는 사용하지 않는다.
2. QA Supabase의 `SUPABASE_URL` 및 **공개 anon key** `SUPABASE_ANON_KEY`, QA Worker의 `VERDICT_API` 주소 준비. 비밀번호, `service_role`, OpenAI Secret은 채팅/문서/깃에 전송하지 않고 **실행 환경의 안전한 비밀 입력/Secret 설정**으로만 주입.
3. QA Worker의 `ALLOWED_EMAILS`에 위 두 TEST 이메일, `ALLOWED_ORIGINS`에 QA 로컬 origin을 허용하고 QA Worker에만 실패 시나리오용 `ALLOW_TEST_FAIL=1` 설정. 실 운영 Worker 설정·배포 변경 금지. 테스트 후 QA Worker에서 테스트 실패 플래그 해제.
4. Chromium과 Playwright가 있는 독립 머신에 `develop`을 체크아웃. `cd server/live && npm i && npx playwright install chromium` 실행. 이어서 `SUPABASE_URL=... SUPABASE_ANON_KEY=... VERDICT_API=... node live-e2e.mjs` 실행하고 콘솔의 프롬프트에 TEST 계정 자격을 **직접** 입력. `--allow-overwrite` 옵션 금지. 리포트는 `server/live/out/<timestamp>/report.md`, `report.json`, 스크린샷으로 생성.
5. 위 테스트 도구는 로그인·세이브 충돌·기사와 증인 실제 AI 및 단일 사건 선고를 다루지만, **공방 `opening/exchange/closing`, 판결문 `judgment` 전체 실패 매트릭스와 NPC 과거사건 재등장 및 뉴스 단계 전체 E2E가 자동 충족된다고 보지 않는다.** 별도 TEST 브라우저 시나리오 증거와 case ID/NPC ID, 시점, fallback 원문·토큰/사용량 내역을 추가 확보해야 한다. 실 환경에서 직접 확인하지 못한 단계는 미실행으로 유지.

### 현재 남은 Release blocker

- **RB-A — 고장 난 v8.3 검증의 수정 후 전체 CI PASS 미확보:** Actions에서 `05b7322`(또는 이후 QA 문서만 추가한 HEAD)의 `develop-smoke` run ID/job 로그를 확인하고 step 13과 나머지 회귀 전부 `success`로 끝나야 함.
- **RB-B — 독립 TEST 2계정 Supabase·저장 충돌·오프라인 및 실제 AI 호출/실패복구 미실행:** 자격·QA 인프라 확보 전 무단 실행 금지.
- **RB-C — 실제 사용자 흐름의 NPC 재등장/후속 사건 및 뉴스→수사→배당→선고 연결 E2E 미실행:** 단위/장기 시뮬레이션 성공으로 대체 불가.

**P4 착수: NO-GO.** 실제 로직 오류가 입증되지 않아 게임 코드를 변경하지 않았고, CI 실패는 수정 후 재검증이 필요. 운영 `main`, 운영 DB/계정/세이브, 배포에 변경 없음.

---

## 후속 검수 — 2026-11-04 (기존 1차 판정 갱신)

> **이 섹션의 증빙과 판정이 아래 1차 검수에서의 '해당 Actions 실행 결과 미확인/미실행' 문구보다 우선한다.** 다른 테스트나 실서버 동작에 자동으로 성공 판정을 확장하지 않는다.

### A. GitHub Actions 성공 확인

- 워크플로: **Develop runtime and mobile smoke QA**
- 검증 대상 커밋: `0eb6254a2d6464841196c666ce0d5eaebbbfca9a` (2026-11-03, UTC).
- Run ID: **41691697637** · Job: **126111643332** (`browser-smoke`).
- URL: https://github.com/gambitblues/the-verdict/actions/runs/41691697637
- **GitHub API의 job 결론 `success` 확인**, 모든 테스트 step `success`, 실제 job log 95,885자 열람. 이전 QA-02에서 해당 커밋의 CI 성공을 입증하지 못한 문제는 **해소**.
- 특히 로그에 `PASS sheet cases in the normal courtroom`, `PASS: v8.2 courtroom and verdict`, `PASS: v8.3 ...`, `PASS: responsive` (390×844, 412×915, 884×1004, 1280×800 포함), `PASS (plain)` 및 `PASS (compressed)` (v5.7→v8.7.3), `PASS: long career (40 years)`가 기록됨.
- 40년 마지막 체크포인트: **370건 사건, NPC 2,693명, issues 0**, 압축 저장 길이 1,654,051자. 단, `tests/long-career.mjs`는 사건별 직접 상태 구성과 빠른 선고를 이용하는 시뮬레이션이므로 모든 사건을 사람이 UI로 진행한 증거가 아님.
- `PASS match engine · 10920 trials`, `PASS world sheets 100`, `PASS: 1800 generated trials`도 로그 확인.
- 화면 QA 아티팩트: `graphical-qa` 63파일, artifact ID **13256669281**. URL: https://github.com/gambitblues/the-verdict/actions/runs/41691697637/artifacts/13256669281. 업로드 성공은 확인했지만 스크린샷을 사람이 육안으로 판독한 것은 아님.
- **최신 HEAD 구분:** 후속 확인 직전 `develop` HEAD는 `bc2c47c278b9e7ecac80fa24f1e3c2c8b45d0526` (1차 QA 보고서만 추가한 커밋). 이 HEAD에 대한 `fetch_commit_workflow_runs` 및 combined status는 `[]`로 반환됨. 이 API는 PR 기반 실행 조회 제한이 있으므로 **새 HEAD의 성공·실패 모두 확정 불가**. `0eb6254` 성공을 `bc2c47c` 성공으로 표기하지 않는다.

### B. 실제 서버 및 사용자 E2E — 이번 검수에서 실행 불가

- 저장소에는 `server/live/live-e2e.mjs`가 존재하며 **테스트 전 서버 `is_test_player` 확인, TEST 이름, 기존 세이브/백업 0건** 조건을 검사하고, 두 계정 로그인·RLS·같은 계정 2기기 충돌·백업·AI 생성/실패·단일 사건 선고까지 검증하도록 설계됨. 운영 세이브 보호용 `--allow-overwrite` 옵션도 거부함.
- 이 환경에는 독립 TEST 계정의 로그인 자격, 실 Supabase URL/공개 anon 키 및 Worker endpoint가 제공되지 않았고, 원격 소스 체크아웃도 DNS 실패. **실 Supabase/Worker/Playwright E2E 이번 실행 0회**. 운영 계정, 운영 세이브, Secret, 프로덕션 데이터에 접근하거나 변경하지 않음.
- 특히 `tests/auth-gate.mjs`의 fake API, Worker/Supabase 로컬 단위 테스트 및 위 `0eb6254` workflow가 통과해도 **실 Supabase 두 계정의 격리·동시 수정·오프라인 복구** 성공으로 해석할 수 없음.
- **AI 검증 미완료:** 실제 모델을 이용한 증인(`npc`), 검사·변호사 공방(`opening`, `exchange`, `closing`), 기사(`article`), 판결문(`judgment`) 각각의 정상 출력과 모델 실패·429·의미검증 거절·네트워크 단절 시 원본 fallback, 재진입 후 일관성의 실 API E2E 로그 없음. 기존 `live-e2e.mjs`가 모든 P1 공방 endpoint에 대해 전체 성공/실패 매트릭스를 검증하는 것으로 간주하지 말 것.
- **NPC 시간 연속성 미완료:** 자동 40년 시뮬레이션 통과는 확인했으나, 실 로그인된 플레이에서 과거 기억→동일 NPC 재등장→법정 행위/판결→후속 민·형사 사건의 저장·재시작 연속성은 미검증.
- **뉴스 시간 연속성 미완료:** 동일 사건의 사건 발생 뉴스→수사→기소·배당→재판→최종 선고→기사 링크와 인물 ID/사건 ID의 실 브라우저 완주 로그 없음. 미배당 종료·직접 배당 분기도 실제 플로우 미검증.

### C. 남은 Release blocker만 (2026-11-04)

| ID | Release blocker | 해제 증거 |
|---|---|---|
| RB-1 | **실 Supabase 독립 TEST 2계정 E2E 미완료** — 로그인 권한, 슬롯 격리, 2기기 저장 충돌, 원본/백업 복구, 오프라인→온라인 전환 | 테스트 전 `is_test_player=true`, 빈 TEST 계정 2개 확인; `server/live/live-e2e.mjs` 실연결 통과 보고서·백업/충돌 결과 |
| RB-2 | **실 AI 성공/실패 매트릭스 미완료** — 증인·검사/변호사 opening/exchange/closing·기사·판결문 | 테스트 계정의 Worker 실제 요청, 의미변경/타임아웃/429/네트워크 오류 각각의 원본 유지, 저장/재열기, 사용량 로그 |
| RB-3 | **NPC 다중 사건 실제 플레이 미완료** — 과거 판결/관계 기억, 재등장, 사건/인물 상태 시점 고정, 후속 판결과 생애 이력 | 격리 계정으로 2개 이상의 연결 사건 실제 화면 완주 + 저장·복원 후 NPC ID, 나이, 사망/수감/출소·직업 이력 비교 |
| RB-4 | **뉴스→수사→배당→선고 실제 플레이 미완료** | 시점별 기사와 `pendingCases`·배당·판결의 동일 case ID/NPC ID, 비공개/중복·연대기 제약의 실 E2E 증빙 |
| RB-5 | **최신 `develop` HEAD CI 결과 미확인** — `0eb6254` CI는 성공으로 확정, 이후 문서 커밋 `bc2c47c` 결과는 조회 불완전 | 최신 HEAD SHA에 직접 연결된 Actions run ID/job conclusion/log URL 확인; 문서만 변경된 경우에도 그 범위를 명시 |

**수정 작업:** 이 QA 문서만 `develop`에 갱신. 신규 기능, 앱·DB·Worker 코드 변경 및 `main` 배포 없음.

**P4 게이트 재판정: NO-GO (보류).** 기존 재판 엔진·브라우저 자동 회귀는 `0eb6254` CI 기준 성공을 확인했다. 하지만 핵심 P0~P3 **실 서버/계정·AI 실패복구·NPC/뉴스 다중 사건 E2E 증거**가 부족하다. 실패가 재현된 것으로 표현하지 않으며, 해당 실검증 완료 후에만 재판정한다.

---


- 검수일: 2026-11-04 (KST)
- 대상: `gambitblues/the-verdict`, `develop` HEAD `0eb6254a2d6464841196c666ce0d5eaebbbfca9a` (검수 시점)
- 범위: 기존 재판·AI 출력/원본 복구·NPC 생애·뉴스/사건 연결·2계정 세이브·40년·화면·CI
- 변경: **본 문서만 신규 작성.** 기능/세이브/서버/운영 `main` 변경 없음.
- 판정 용어: **코드 확인** = 파일에서 구현·검사 경로 확인(실행 성공 아님); **통과** = 이번 검수에서 직접 실행해 성공 로그 확보; **실패** = 실제 테스트 실패 증거 확보; **미실행** = 테스트 실행 환경/증빙 없음; **미구현** = 구현 부재 확인; **미검증** = 일부 관련 코드가 있으나 해당 동작을 검증하지 못함.

## 총괄 판정

**P0~P3 통합 수용 보류 / P4 착수 게이트 NO-GO.** 이번 검수는 GitHub `develop`의 문서·코드·테스트 정의를 읽은 **정적 검토**이다. 저장소를 실행할 수 있는 소스 체크아웃 및 Chromium, 로그인된 독립 테스트 서버 접근을 확보하지 못했으므로 이번 검수에서 직접 통과시킨 자동 테스트·브라우저 테스트·실 API 테스트는 **0건**이다. 테스트 파일이 존재하거나 기존 문서가 과거 로컬 통과를 기술해도 이번 통합 QA의 PASS로 계산하지 않는다.

`develop`은 `main`보다 286개 커밋 앞서 있으며 비교 시 `main`에서 뒤처진 커밋은 0개였다. 해당 비교는 기능·동작의 통과 증거가 아니다.

## 1. 항목별 결과

| 영역 | 정적 검토에서 확인한 것 | 이번 검수 결과 | 남은 게이트 |
|---|---|---|---|
| 6개 재판 메뉴, 배당→선고 | `README.md`와 `docs/HANDOFF.md`에 단일 6메뉴(사건·기일·증거·증인·주문·판결) 명시. `tests/match-play.mjs`는 실제 6메뉴와 정상 판결 경로를 검증하도록 작성됨; `tests/verdict-v82.mjs`, `tests/verdict-v83.mjs`도 존재 | **코드/테스트 설계 확인, 실행 미실행** | 신규·기존·결정형·형사·민사별 배당부터 선고까지 독립 브라우저에서 완주 |
| AI 증인/공방/기사/판결문, 실패 원문 복구 | `auth_gate.js`, `ai_bridge.js`, `server/worker`와 `server/IMPLEMENTATION_STATUS.md`에 AI 호출, 규칙/원문 fallback 관련 설명·경로 있음. 기존 문서는 P1의 실 API·브라우저 통합 검증을 미완료로 명시 | **미검증** | 성공·타임아웃·429·500·의미검증 거절·네트워크 단절마다 결과 고정, 원문 복구 및 저장 후 재열기 확인 |
| NPC 기억·재등장·생애·후속 사건 | `npc_court_memory.js`, `npc_life_justice.js`, `case_afterlife_engine.js`, `continuity_engine.js` 및 P2-1~7 구현 내역 문서화. `tests/long-career.mjs`는 나이/사망/역할 충돌/가족 대칭/직업/세이브 크기를 검사하도록 작성됨 | **미검증** | 실제 40년 실행, 출소·재취업·재등장·후속 사건의 연대기/기억 스냅샷 및 중복 이벤트 확인 |
| 뉴스→수사→배당→재판→판결 | `server/IMPLEMENTATION_STATUS.md`는 `pendingCases`, `worldIncidents`, 같은 사건 ID의 단계별 뉴스 및 배당/미배당 종결 분기를 기술 | **미검증** | 같은 ID·NPC 식별자 유지, 배당 전 비공개, 기사 중복 금지, 직접 배당/뉴스 선행/뉴스 종결 분기 E2E |
| 2계정 세이브·충돌·오프라인 | `auth_gate.js`에 사용자별 로컬 키 격리, IndexedDB 백업, 원격 저장 버전 충돌, 7일 오프라인 확인 정책이 서술됨. `tests/auth-gate.mjs`는 가짜 Supabase 두 계정·충돌·오프라인을 검증하도록 작성됨 | **미검증** | 독립 테스트 계정 2개로 저장 분리·동시 쓰기·충돌 선택·복구·오프라인→온라인 전환 실검증 |
| 기존 사건·세이브 호환, 40년 | `tests/v5-migration.mjs`, `tests/long-career.mjs 40`, `tests/match-play.mjs` 존재. 장기 테스트는 일부 재판 상태를 직접 설정하여 판결 경로를 빠르게 진행하므로 40년 모든 사건을 수동 UI로 완주한 증거와 구분해야 함 | **미실행** | 이전 버전 실픽스처 읽기/복원·재저장·40년 장기 실행과 UI 완주 표본을 별도로 통과 |
| 390/412/884px·데스크톱 | `tests/responsive.mjs`, `tests/visuals.mjs`, `tests/browser-smoke.mjs`와 Actions 실행 단계가 정의됨 | **미실행** | 지정 4종 화면 스크린샷을 직접 보고 클리핑·탭·모달·판결 창 검수, 모바일 실제 기기 별도 |
| 자동 테스트·GitHub Actions | `.github/workflows/develop-smoke.yml` 및 `worker-regression.yml` 존재, `develop` push 트리거와 Node/Playwright/Worker 테스트 단계 확인. HEAD SHA에 대한 GitHub 연결 도구의 PR 기반 workflow 조회는 `[]`, combined status 조회도 `[]` | **현재 HEAD 성공 증빙 없음(실패 판정 아님)** | 실제 GitHub Actions 화면에서 해당 HEAD의 워크플로 실행 ID, 모든 job 결론 및 아티팩트를 확인하고 로그 보존 |

## 2. 이번 검수에서 실제 수행한 작업

1. GitHub 저장소 `gambitblues/the-verdict` 접근·`develop` 존재 확인.
2. HEAD 커밋 `0eb6254a2d6464841196c666ce0d5eaebbbfca9a`와 `main...develop` 차이 비교(286 ahead / 0 behind).
3. `README.md`, `CLAUDE.md`, `docs/HANDOFF.md`, `docs/ARCHITECTURE.md`, `docs/RELEASE_WORKFLOW.md`, `server/IMPLEMENTATION_STATUS.md`의 관련 개발·검수 기준 정적 열람.
4. `index.html`, `auth_gate.js`, `config.js`, 두 Actions 워크플로, `tests/auth-gate.mjs`, `tests/match-play.mjs`, `tests/verdict-v83.mjs`, `tests/long-career.mjs`, Worker/Supabase 테스트 스크립트 정의 검토.
5. HEAD의 workflow 실행 목록 및 commit status 조회. 두 응답 모두 비어 있어 성공/실패를 확정할 수 없음.
6. 외부 원격 소스 체크아웃 시도: 실행 환경의 GitHub 도메인 DNS 접근 실패. 따라서 `node`/Playwright/DB 자동 테스트 실행 불가. **실행한 자동 테스트 0 / PASS 0 / FAIL 0.**
7. **독립 테스트 서버에 접속하거나 프로덕션 세이브를 변경하지 않음.** 서버 쓰기, 마이그레이션, 배포 미실행.

## 3. 검수 중 발견된 장애·위험 및 조치

| ID | 중요도 | 관찰 / 근거 | 조치 및 상태 |
|---|---|---|---|
| QA-01 | **Release blocker** | `develop/config.js`의 `supabaseUrl`, `supabaseAnonKey`, `apiBase`가 빈 문자열. `auth_gate.js`는 설정이 없으면 원격 로그인 게임 진입을 막음. 외부 배포 환경에서 별도 주입 여부는 확인하지 못함 | **미수정**. 개발 설정을 임의로 채우거나 Secret을 커밋하지 않음. 독립 QA 환경의 공개 설정과 로그인 검증 필요 |
| QA-02 | **Release blocker** | 현재 HEAD의 Github Actions PASS를 입증할 실행 ID/로그 확보 실패. 조회 API는 PR 트리거 실행에 제한될 수 있어 빈 배열은 workflow 미실행을 증명하지 않음 | **미수정**. GitHub Actions 페이지에서 develop push 실행과 전체 job 결론을 따로 확보 |
| QA-03 | **Release blocker** | P0~P3 교차 시나리오를 실제 브라우저와 실 API에서 완료하지 못함. 특히 P2-1~7과 P3 뉴스 단계는 코드/테스트 작성 사실만 확인 | **미수정**. 아래 게이트 실행 전 수용 불가 |
| QA-04 | 높음 | `docs/RELEASE_WORKFLOW.md`의 현실시계 배당 기술(매시간 1건/하루 최대 4건)이 `README.md`/ `CLAUDE.md`(매시간 2건 제안)과 충돌함. 코드 실제 규칙은 미확인 | **문서 불일치 확인, 동작 오류 미확정**. 제품 기준값 확인 후 문서만 일치시키기 |
| QA-05 | 높음 | `server/IMPLEMENTATION_STATUS.md`는 P1/P2/P3 기능마다 직접 브라우저/실 API/전체 회귀가 미완료라고 명시 | **미실행**. 과거 개발자 로컬 테스트 주장과 이번 통합 PASS를 구분 |

**수정 결과:** 치명적 런타임 오류가 재현되지 않았으므로 애플리케이션 코드는 수정하지 않았다. 재실행 대상인 수정 테스트도 없다. 본 QA 보고서만 `develop`에 추가한다.

## 4. 재검수 실행 게이트 (독립 환경 한정)

- `develop` HEAD를 독립 머신에 체크아웃하고 `CLAUDE.md`의 모든 Node 테스트 + `server/worker`의 `npm run check` + `server/supabase`의 `npm test` 실행. 명령·종료코드·테스트 건수·로그 SHA 보관.
- Playwright `tests/browser-smoke.mjs`, `match-play.mjs`, `verdict-v82.mjs`, `verdict-v83.mjs`, `auth-gate.mjs`, `responsive.mjs`, `v5-migration.mjs`, `long-career.mjs 40`, `terra-browser-qa.mjs` 실제 실행. 40년 테스트의 내부 직접 상태 조작은 UI 플레이 커버리지와 별도 기재.
- P0~P3 수동 교차 시나리오: 계정 A/B를 각각 새 빈 테스트 세이브로 로그인 → 동일 재판 메뉴 전부 사용해 선고 → 성공/실패 AI 출력 고정 → 기사·NPC·사건 ID 확인 → 새로고침·동시 쓰기·단절·복귀·백업 복원 → 과거 세이브/40년 시뮬레이션. 운영계정과 운영 데이터 사용 금지.
- 390×844, 412px, 884px, 데스크톱 실제 캡처 비교. Playwright 스크린샷과 Safari/Android 실제 기기 확인을 구분.
- `develop` HEAD와 대응하는 GitHub Actions **run URL, run ID, conclusion, job logs**를 기록. `main` merge/deploy 금지.

## 5. P4 착수 조건 및 결론

**현재 NO-GO.** 최소한 ① 전체 회귀 PASS, ② 6메뉴 사건 완주와 AI 성공/실패 복구, ③ 2개 테스트 계정 격리/충돌/오프라인 복구, ④ NPC·기사·사건 연속성 및 40년, ⑤ 반응형 4화면, ⑥ Actions 증빙을 확보해야 재판정한다. 특히 P4의 공유 세계로 넘어가기 전, 현 P2 기억이 플레이어 개인 세이브 기반이라는 제한과 P3의 관리자 승인/서버 재고 적용 범위를 명확히 해야 한다.

> QA 결론은 **기능 실패**가 아니라 **필수 통합 검증 증거 부족으로 승인 보류**이다. 공개 `main`, 실제 계정 저장 데이터, 배포 환경은 변경하지 않았다.
