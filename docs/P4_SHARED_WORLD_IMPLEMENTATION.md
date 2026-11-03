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

## 적용과 QA

이 단계의 GitHub 코드 변경은 **운영 DB나 Worker에 적용되지 않았습니다**.

1. 독립 QA 프로젝트에서 SQL `001 → 002 → 003 → 006 → 007 → 008 → 009 → 010` 순서로 적용. P3 Terra 기능이 필요한 QA DB라면 기존 `004 → 005`도 해당 절차에 포함.
2. `cd server/supabase && npm ci && npm test`; `cd server/worker && npm run check`.
3. 개발 QA Worker 변수 `P4_SHARED_DOCKET_ENABLED="1"`은 데이터/권한/이벤트 검수 환경에서만 사용. **기존 운영 Worker와 wrangler.toml의 예시 값으로 재배포 금지.**
4. 별도 QA 게임 설정에 `p4SharedWorld:true`를 지정하고 UI 확인.
5. 읽기 전용 실제 두 계정 검사: `SUPABASE_URL=... SUPABASE_ANON_KEY=... VERDICT_API=... node server/live/p4-read-e2e.mjs`. 값은 QA용 공개 설정, 비밀번호는 실행 중 직접 입력. 실계정/운영 데이터 사용 금지.
6. 쓰기 테스트(배당 수락, 선고, NPC 갱신)는 QA DB의 별도 TEST 데이터에서만. 운영 계정 세이브/전역 사건에 쓰지 않음.

## P4 전체 완료까지 남은 핵심 게임 작업

**아래 기능은 아직 구현되지 않았으므로 P4 완료라고 주장하지 않습니다.**

1. **배당 UI 실제 연결:** 서버 예약 후보 2건을 기존 `VerdictDocket`의 사건 선택/수락 플로우에 통합. 현재 기존 `offerPair`는 로컬 게임 후보를 사용하며, 서버 후보와 사건 ID 매칭 및 승인된 공통 사건 배당은 연결되지 않음.
2. **서버 봉인 진실·증거 단계별 제공:** 현행 세계 시트는 브라우저에 여러 진실 분기를 번들로 보유. P4 사건은 서버만 실제 진실을 알고, 재판부는 제출된 자료/증인 진술만 받도록 별도 사건/신문/증거 API와 엔진 적용이 필요. 기존 6메뉴를 그대로 유지해야 함.
3. **서버 판결의 실게임 확정:** `shared_judgment_publish`는 신뢰된 서버 판결 엔진에만 호출 가능하도록 남겨둠. 현재 `trial_play.finish`의 로컬 선고는 아직 서버 원장에 자동 확정되지 않음. 브라우저가 임의로 판결문을 올리는 경로는 도입하지 않음.
4. **동기화된 세계 시간:** 서버 CAS는 구현됐으나 `VerdictCalendar.advanceTo`가 이를 실제로 사용하지 않음. 두 판사의 동시 기일, 재시도, 오프라인 전환/충돌 처리 연결 필요.
5. **NPC 생애와 뉴스를 게임 데이터에 반영:** 공용 원장/API는 존재하지만, `S.npcDB`와 개인 `S.memories`의 객관적/주관적 분리·병합, `S.news`와 후속 사건 발생 적용이 미연결.
6. **2계정 게임 E2E:** 서버 데이터/화면 단위 테스트와 달리 실제 QA Supabase + Worker + 2개 테스트 세이브로 공통 사건 진행을 검증한 증빙은 없음.

## 검증 원칙

- CI가 성공해도 그 커밋의 자동 테스트 통과일 뿐, 배포되었거나 전체 P4 게임이 가능한 것은 아님.
- 환경변수와 Secret을 Git에 넣지 않음.
- `main` 배포·운영 DB 마이그레이션·기존 Worker 재배포·운영 세이브 변경 금지.
- P5 공동 합의부는 P4 이후 별도 기능.

**현재 판정: P4 서버 기반 구현 진행, 플레이 가능한 P4 전체 기능은 아직 NO-GO.**
