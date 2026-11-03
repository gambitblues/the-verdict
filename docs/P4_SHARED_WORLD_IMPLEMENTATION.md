# P4 공유 세계 — 1차 구현 (develop 전용)

상태: **서버 데이터 계층 + 읽기 API 구현 / 운영 미적용 / 게임 UI 미연결**.

## 구현됨
- `server/supabase/003_case_stock.sql`의 원래 `case_stock_assign`: 전역 사건 재고의 원자적 단일 배당. 이미 있던 기능을 재사용하며 사건 본문/봉인 진실은 브라우저에 노출하지 않는다.
- `server/supabase/006_shared_world_events.sql`: 두 판사가 공유해 볼 공개 사건 연혁. 서버 단일 증가 ID와 게임 날짜, 사건 ID, 담당 판사, 공개 필드만 저장한다.
- `shared_world_append`: **service_role 전용** 등록, 같은 event_key 요청은 멱등 성공, 같은 키로 내용을 바꾸면 거절, 판결/심리 이벤트는 담당 판사 일치 검사. INSERT 이후 UPDATE/DELETE 금지.
- 초대 플레이어는 공개 연혁 **읽기만 가능**, 익명·미초대 계정은 조회 불가. `case_stock.sheet`, `world_secrets`는 절대 반환하지 않는다.
- Worker `GET /world/events?after=<id>`: 로그인 사용자 JWT를 Supabase에 그대로 전달하여 RLS 적용, 최대 50개 이벤트 순차 페이지. 인증 없는 요청 차단.
- `server/supabase/test/shared-world.test.js`, `server/worker/test/worker.test.js`: 권한/사실 변조/멱등성/담당 판사 분리/읽기 API 테스트 정의.

## 적용 전 주의
**이 저장소 커밋은 운영 DB 마이그레이션이나 Worker 배포를 수행하지 않는다.** 기존 이용자 세이브와 main도 변경되지 않았다.

개발/QA DB에서만 `001_init.sql`, `002_api_privileges.sql`, `003_case_stock.sql` 이후 `006_shared_world_events.sql`을 실행한다. 게임 화면에 연결하기 전 `npm test` (server/supabase), `npm run check` (server/worker), 그리고 2인 실환경 E2E를 수행한다. 마이그레이션은 QA 승인을 거쳐 운영 적용한다.

## 다음 P4 작업 (아직 미구현)
1. 클라이언트: 두 계정이 동일한 공개 연혁을 읽어 화면에 반영하되, 각자 개인 NPC 기억/세이브를 섞지 않는다.
2. 신뢰된 서버 경로: 사건 배당·심리·선고 시 서버 권한으로만 `shared_world_append` 호출. 브라우저가 임의의 판결/사건 연혁을 올릴 수 있는 범용 쓰기 API는 만들지 않는다.
3. 과거 집필 사건은 현재 `case_stock` 외부에 있으므로 세계 공통 고유 ID·봉인 진실 이전 정책 및 스키마를 별도 설계한다. 현재 이벤트 연혁은 `case_stock` 등록 사건만 연결 가능하다.
4. 두 판사의 세계 시계 동기화, 객관적 NPC 기본 생애/전역 사건 이력과 각자 관계·기억 분리, 항소·후속 사건 연계, 2인 동시 배당/연속성 E2E.
5. 선택 과제 공동 합의부 P5는 P4 안정화 이후.

## 배포 금지 확인
`main` 병합, 기존 Cloudflare Worker 재배포, 운영 Supabase SQL 적용, 기존 세이브 변환은 이 단계의 범위에 포함되지 않는다.
