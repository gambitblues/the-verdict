# THE VERDICT — P4 공유 세계 구현 현황 (develop)

**상태: 서버 공통 세계 핵심 계층 구현 + 읽기 전용 게임 UI + 자동 테스트. 그러나 P4 전체 게임 플레이 기능은 미완성.**
운영 main, Supabase 운영 DB, 배포된 Cloudflare Worker, 사용자 세이브는 변경하지 않았습니다.

## 반영된 기능

| 파일 | 내용 |
|---|---|
| `server/supabase/003_case_stock.sql` (기존) | 전역 원자적 사건 재고 및 중복 배당 방지 |
| `006_shared_world_events.sql` | 두 판사에게 공통 공개되는 사건·뉴스 연혁; 수정/삭제 불가, 멱등 키, RLS |
| `007_shared_world_clock_npc.sql` | 공통 게임 날짜 CAS 버전; NPC 객관적 생애(생존·직업 등) 별도 원장 |
| `008_shared_docket_publication.sql` | 사건이 전역 재고에서 실제 배당되면 공개 사건 연혁 자동 생성 |
| `009_shared_docket_offers.sql` | 현실 시계 KST 10~22시, 판사별 시간대 후보 2건을 전역으로 예약; 1건 수락, 나머지 반납; 동시 배당 중복 금지; 일일 수락 상한 4 |
| `010_shared_judgment_ledger.sql` | 사건당 판결 1회 확정 원장; 이중 판결·수정·삭제 불가, 공통 판결 기사 이벤트 자동 생성; 판결 이전 후일담/항소 금지 |
| `server/worker/src/index.js` | 로그인한 플레이어만 `GET /world/events`, `/world/clock`, `/world/npcs`; feature flag를 활성화한 QA Worker에서만 `POST /world/offers`, `POST /world/accept` |
| `shared_world.js`, `auth_gate.js`, `config.js` | 기존 6메뉴/세이브는 그대로 두고, 별도 🌐 공유 세계 패널로 공동 사건/시계/객관적 NPC 표시. `p4SharedWorld: false` 기본값 |
| `tests/shared-world-ui.mjs` | 가짜 두 판사 모바일 브라우저에서 동일 공통 기록, XSS 이스케이프, 중복 방지, 미인증 차단 |
| `server/supabase/test/shared-world.test.js` | RLS, 진실 보호, 두 판사 중복배당, 사건 후보 예약/수락, 불변 판결, 사건 연대기 |
| `server/worker/test/worker.test.js` | 공개 읽기 API, 요청 보안, 서버 파생 사용자 ID, feature flag |
| `server/live/p4-read-e2e.mjs` | 독립 TEST 계정 2개로 실서버의 공통 연혁·시계·NPC 일치와 비공개 테이블 차단 확인; 읽기만 수행 |

| `011_sealed_case_admission.sql` | 검증된 세계 시트에 실제 진실 분기(did/didnt/reason)를 단 한 번 봉인하고 이후 변경을 거부 |
| `server/worker/src/public_case_projection.js` | 담당 판사의 공개 사건 카드·공통 사실·증거/질문/주문 **목록만** 내려주고 worlds·미공개 답·주문 결과는 제거 |
| Worker `GET /world/case?caseId=...` | 소유 판사만 자신의 배당 사건 공개 요약을 조회; 타 판사의 사건은 404 |

| `GET /world/case/initial` | 담당 판사에게 첫날 제출된 증거의 텍스트만 반환. 주문으로 확보할 후속 자료 및 미선택 진실 분기 노출 금지 |
| `config.js:p4SharedDocket`, `shared_world.js` | 독립 QA에서 전역 사건 후보 2건 조회→1건 수락→서버 공개 사건 카드 및 첫날 증거 미리보기. 기존 재판 세이브는 변경하지 않음 |

## P4 비동기 게임시간 원칙 (2026-11-04 확정)

**실제 1일 미접속 ≠ 게임에서 1일 자동 결석**. 현실 시각은 사건 후보 오퍼 슬롯(10–22시)에만 사용한다. 게임 날짜는 서버의 `shared_world_clock.game_day` 단 하나만 존재한다.

- A 판사가 재판 **8건을 세계 10일의 동일 날짜**에 열면, `shared_hearing_open`은 세계 날짜를 한 번만 10일로 맞춘다. 사건 8건 때문에 8일을 덧붙이지 않는다.
- A가 미래 공판(예: 세계 12일)을 실제로 열면 공통 날짜가 12일로 전진하고 B도 공개 뉴스·NPC 이력에서 12일을 본다. 과거로 역행하지 않는다.
- B가 하루 접속하지 않았다면 진행 중이던 B 개인 사건의 기일을 자동으로 열거나 판결하지 않는다. B가 복귀할 때 `shared_judge_resume`이 과거로 밀린 개인 예약 기일만 **현재 공통 날짜 + 게임 2일** 이후로 보호 조정한다. A의 기일·판결·공통 뉴스는 수정하지 않는다.
- B의 복귀 보고에는 놓친 **공개 세계 사건의 변화**와 미처리 기일 수를 별도로 표시한다. 재접속 처리 재시도는 멱등적이어서 버튼을 연속 눌러 기일을 무한히 늘릴 수 없다.
- 주의: 아직 2인 실재판 엔진의 `VerdictCalendar.advanceTo`까지 대체하지 않았으므로 이 정책은 **서버 예약 기일·QA 세계 UI**에만 적용된다. 기존 싱글플레이 세이브의 시간은 그대로 둔다.

### 새 코드
- `012_asynchronous_judge_calendar.sql`: 판사별 마지막 접속 세계 날짜, 개인 예약 기일 분리, 복귀 보호 및 중복 재조정 방지
- `013_shared_hearing_progress.sql`: 실제 예정 기일을 열었을 때만 공통 세계 시계가 `max(현재 날짜, 열린 기일)`로 전진, 같은 날짜 여러 공판은 시간 중복 증가 없음
- `014_world_chronology_guards.sql`: 미래 날짜의 기사·NPC 생애 변화 공개 금지, 근거 없는 판결 기사·선고 후 공판 기록 생성 금지
- Worker `GET /world/catchup`: 서명된 판사 자신의 미처리 기일과 세계 날짜 차이 조회
- Worker `POST /world/resume`: 본인 판사 ID를 서버 JWT에서 결정하며 타 판사 기일을 건드리지 않는 복귀 RPC
- `shared_world.js`: 비동기 판사 복귀 상태 표시·복귀 버튼(독립 QA 옵션을 켠 경우만)

## P4 다음 단계: 봉인된 증인신문·증거 제출 명령 (개발 반영)

- `015_shared_court_actions.sql`: 법정 신문 및 증거 제출 명령을 **사건별·액션별 한 번만** 확정 저장하는 불변 법정 원장. 다른 판사는 접근할 수 없고, 실제 서버에서 열린 공판 기일에만 기록 가능하며 판결 후 추가 행위를 거부.
- `server/worker/src/shared_courtroom.js`: 사건 진실 `did/didnt/reason`을 서버에서만 읽고 해당 분기의 진술·주문 결과를 결정. 기일 전에는 봉인된 답이나 자료를 보내지 않음.
- Worker `GET /world/court/status`, `GET /world/court/history`, `POST /world/court/action`: 판사 본인 소유권 검증, 서버 공판 기일 확인, 신문·증거 명령 요청 기록 및 재조회. 브라우저가 제출한 `answer`, `branch` 등은 무시하고 서버에서 만든 결과만 사용.
- `shared_world.js`: 기존 게임 세이브와 독립된 공유 세계 미리보기 안에서 실제 서버가 승인한 공판인 경우에만 신문·주문 버튼을 표시. 본인 법정 기록만 표시.
- Worker `P4_COURT_ACTIONS_ENABLED="0"`, 클라이언트 `p4CourtActions:false`: 기본 비활성화. 독립 QA 환경에서만 명시적으로 두 설정을 모두 활성화.
- QA: `server/worker/test/shared-courtroom.test.js` 및 Worker/SQL 회귀 테스트로 분기별 답, 증거 선행조건, 접근 차단, 중복 액션, 기록 수정 금지 확인.

**남은 게임 연동:** 현재 `trial_play.js`의 기존 재판 절차와 공유 서버 액션을 연결하지 않았음. 서버가 승인하는 최초/추가 공판 일정, 후속 자료가 이월되었을 때의 단계별 공개, 판결문 검증 및 선고 확정, AI 답변 후 검증, 개인 NPC 기억 반영을 마쳐야 실제 2인 P4 재판이 완성됨.

## 적용과 QA

이 단계의 GitHub 코드 변경은 **운영 DB나 Worker에 적용되지 않았습니다**.

1. 독립 QA 프로젝트에서 SQL `001 → 002 → 003 → 006 → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015` 순서로 적용. P3 Terra 기능이 필요한 QA DB라면 기존 `004 → 005`도 해당 절차에 포함.
2. `cd server/supabase && npm ci && npm test`; `cd server/worker && npm run check`.
3. 개발 QA Worker 변수 `P4_SHARED_DOCKET_ENABLED="1"`, `P4_COURT_ACTIONS_ENABLED="1"`은 데이터/권한/이벤트 검수 환경에서만 사용. **기존 운영 Worker와 wrangler.toml의 예시 값으로 재배포 금지.**
4. 별도 QA 게임 설정에 `p4SharedWorld:true`, `p4SharedDocket:true`, `p4CourtActions:true`를 지정하고 UI 확인.
5. 읽기 전용 실제 두 계정 검사: `SUPABASE_URL=... SUPABASE_ANON_KEY=... VERDICT_API=... node server/live/p4-read-e2e.mjs`. 값은 QA용 공개 설정, 비밀번호는 실행 중 직접 입력. 실계정/운영 데이터 사용 금지.
6. 쓰기 테스트(배당 수락, 선고, NPC 갱신)는 QA DB의 별도 TEST 데이터에서만. 운영 계정 세이브/전역 사건에 쓰지 않음.

## P4 전체 완료까지 남은 핵심 게임 작업

**아래 기능은 아직 구현되지 않았으므로 P4 완료라고 주장하지 않습니다.**

1. **배당 UI 실제 연결:** 서버 예약 후보 2건을 기존 `VerdictDocket`의 사건 선택/수락 플로우에 통합. 현재 기존 `offerPair`는 로컬 게임 후보를 사용하며, 서버 후보와 사건 ID 매칭 및 승인된 공통 사건 배당은 연결되지 않음.
2. **서버 봉인 진실·증거 단계별 제공:** 현행 세계 시트는 브라우저에 여러 진실 분기를 번들로 보유. P4 사건은 서버에서 진실을 봉인하고 담당 판사 전용 **공개 사건 카드/초기 제출 증거 API** 및 QA 전용 선택 미리보기까지 구현. 이후 기일별 **후속 증거 주문·증인신문·판결**의 허용 범위를 서버에서 판단해 내려주는 단계별 API와 기존 6메뉴 재판 엔진 적용이 필요. 기존 6메뉴를 그대로 유지해야 함.
3. **서버 판결의 실게임 확정:** `shared_judgment_publish`는 신뢰된 서버 판결 엔진에만 호출 가능하도록 남겨둠. 현재 `trial_play.finish`의 로컬 선고는 아직 서버 원장에 자동 확정되지 않음. 브라우저가 임의로 판결문을 올리는 경로는 도입하지 않음.
4. **동기화된 세계 시간:** 서버 예약 기일과 복귀 보호/동일 날짜 중복 진행 방지는 구현됐으나 `VerdictCalendar.advanceTo`가 이를 실제로 사용하지 않음. 두 판사의 동시 기일, 재시도, 오프라인 전환/충돌 처리 연결 필요.
5. **NPC 생애와 뉴스를 게임 데이터에 반영:** 공용 원장/API는 존재하지만, `S.npcDB`와 개인 `S.memories`의 객관적/주관적 분리·병합, `S.news`와 후속 사건 발생 적용이 미연결.
6. **2계정 게임 E2E:** 서버 데이터/화면 단위 테스트와 달리 실제 QA Supabase + Worker + 2개 테스트 세이브로 공통 사건 진행을 검증한 증빙은 없음.

## 검증 원칙

- CI가 성공해도 그 커밋의 자동 테스트 통과일 뿐, 배포되었거나 전체 P4 게임이 가능한 것은 아님.
- 환경변수와 Secret을 Git에 넣지 않음.
- `main` 배포·운영 DB 마이그레이션·기존 Worker 재배포·운영 세이브 변경 금지.
- P5 공동 합의부는 P4 이후 별도 기능.

**현재 판정: P4 서버 기반 구현 진행, 플레이 가능한 P4 전체 기능은 아직 NO-GO.**
