# THE VERDICT — P4 공유 세계 구현 상태 (develop)

> 대상: develop ONLY. main, 운영 Supabase, 현재 Cloudflare Worker, 운영 세이브 변경 없음.
> 상태: **P4 서버 기반 + 공유 연혁 화면 연결까지 구현. 전체 플레이 가능한 2인 공유 세계는 아직 미완료**.

## 반영된 구현
| 계층 | 구현 | 검증 |
|---|---|---|
| 전역 사건 재고 | 기존 `003_case_stock.sql`의 `FOR UPDATE SKIP LOCKED` 단일 배당 재사용 | PGlite 2판사 비중복 테스트 추가 |
| 공통 연혁 | `006_shared_world_events.sql`: 비공개 진실 분리, 이벤트 키 멱등성, 공개 필드 제한, INSERT 이후 수정 불가 | 권한·중복·변조 테스트 추가 |
| 공통 시계 | `007_shared_world_clock_npc.sql`: 전역 게임 날짜와 버전, CAS 갱신, 최대 14일 전진, 역행 금지 | 서버 전용·충돌 테스트 |
| 객관적 NPC | 동일 SQL: 공통 이름/직업/생존상태, 버전 충돌 검사, 사망 후 생존 복원 금지 | 2인 동일 조회·생애 모순 테스트 |
| 사건 배당 기사 | `008_shared_docket_publication.sql`: 기존 글로벌 case_stock의 실제 배당 상태 전환을 서버 트리거로 공개 연혁에 1회 기록 | 같은 사건 중복 배당/두 판사 공통 조회 테스트 |
| Worker API | `GET /world/events`, `GET /world/clock`, `GET /world/npcs`: 초대·로그인 확인 후 플레이어 JWT로 Supabase RLS 읽기 | 단위 테스트, `server/worker npm run check` |
| 플레이어 화면 | `shared_world.js`를 `auth_gate.js` 부트스트랩에 연결. 로그인/온라인일 때만 🌐 공유 세계 패널, 공개 사건/날짜/NPC 조회 | 정적·Actions 회귀 대상, 실환경 검증 필요 |
| CI | `.github/workflows/worker-regression.yml`에서 Worker + PGlite DB 테스트 | GitHub Actions 확인 필요 |

## 아직 미구현 — P4 전체 완료를 위해 필요
1. **실제 2인 공통 사건 배당 UI 및 수락**: 현재 게임의 `VerdictDocket.offerPair`는 개인 세이브 기반. 기존 글로벌 `case_stock_assign`은 백엔드에 있지만 게임의 수락/재판 루프와 연결되어 있지 않음.
2. **봉인 진실의 서버 이전 및 사건 자료 API**: 현재 브라우저의 기존 curated/world-sheet 엔진은 진실 분기를 로드함. P4 공통 사건은 서버가 비공개 진실을 잠그고, 판사에게 그 시점에 제출된 공적 자료만 내려줘야 함. 진실/판결 실력의 서버 재계산 및 기존 사건 호환 설계 필요.
3. **공동 세계 날짜의 실시간 적용**: 읽기 UI는 연결했지만 `VerdictCalendar.advanceTo`가 서버의 단일 시계를 CAS로 확정하지 않음. 두 판사 동시 기일 진행·시계 충돌·오프라인 복구 미완료.
4. **실판결/공방/후속 뉴스 이벤트 업로드**: 배당 이벤트는 DB에서 자동 발행. 선고 이벤트는 현재 개인 `trial_play.finish`에만 존재하므로 검증 가능한 서버 선고 엔드포인트/증거 스냅샷이 필요. 브라우저에서 자유롭게 거짓 판결을 서버에 게시하는 API는 금지.
5. **NPC 객관적 생애 사건의 동기화**: 공통 NPC 레지스트리는 생겼으나 게임의 `S.npcDB`를 이 레지스트리와 병합하지 않음. 개인 호감도/대화 기억은 각 계정에만 보존.
6. **2계정 실제 E2E**: 독립 TEST 계정, QA Supabase + QA Worker에서 동시 배당·법정·뉴스·세계 시계·세이브·AI 호출 검증. 테스트는 미실행. 운영 환경에 임의 배포하지 않음.

## QA 적용 순서
- 독립 QA DB: `001`, `002`, `003`, `006`, `007`, `008` 순서. `004`, `005`는 Terra 전용 기능을 별도 요구할 때 기존 순서대로 적용.
- `cd server/supabase && npm ci && npm test` — SQL/RLS/동시 배당 테스트.
- `cd server/worker && npm run check` — Worker 단위·API·기능 회귀.
- `develop` 전체 GitHub Actions 확인. 실제 사용자 동작은 독립 테스트 계정으로 별도 기록.

## 보안/호환성
- 운영 DB, 서비스 Worker의 환경변수/Secret 변경이나 재배포 수행하지 않았음.
- 공통 서버 테이블에는 개인 관계·판사별 기억·봉인 진실 저장 금지.
- 기존 6메뉴 및 개인 세이브를 변환하지 않음.
- 서버 연동이 안 되더라도 기존 로컬 테스트는 싱글플레이 그대로 동작.
- P5 공동 합의부는 P4 범위 밖.

**실서비스 P4 출시 판정: 아직 NO-GO. 코드 추가와 실제 공유 세계 E2E 완료는 다르다.**
