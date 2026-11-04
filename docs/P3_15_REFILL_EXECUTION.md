# THE VERDICT P3-15 — Terra 사건 자동 보충 배치 (develop, 배포 전)

## 이번에 실제 구현한 경로
- `server/worker/src/terra_replenishment_runner.cjs`: 동일 실행 잠금 → 서버 재고/예산 스냅샷 → 부족 사건 수 계획 → **AI 호출 4회·예상 USD 상한 선예약** → Terra 제작 → 실제 6개 재판 메뉴의 Chromium QA → 재검증 → 비공개 재고 적재 → 예산 예약 정산 → 잠금 해제 순서의 실패 차단형 배치 실행기.
- `tests/terra-refill-execute.cjs`: 위 흐름을 **서버 전용 SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY**와 연결하는 명시 실행 명령. 기존 `tests/terra-generate.cjs`를 사용하고, 결과는 `pending/`에 보존한다. 정상적인 등록 전에는 기존 게임에 공개하지 않는다.
- `server/supabase/004_case_refill_budget.sql`: 전역 실행 잠금, 일별 원화 아닌 **USD AI 비용/호출 예약**, 예약 정산, 한국시간 일자별 합계 조회를 위한 SQL. 동시 트랜잭션은 DB 잠금으로 처리한다.
- 기존 `003_case_stock.sql`의 `case_stock_admit`와 `case_stock_assign`를 그대로 사용한다. 일반 플레이어 JWT는 숨겨진 세계 및 모든 비공개 재고 DB를 읽을 수 없다.

## 실행 조건
1. Supabase에 001, 002, 003, 004 마이그레이션을 순서대로 적용한다. 현재 **GitHub 코드에 SQL 파일만 추가됐고 실 DB는 건드리지 않았다**.
2. 개발자 서버에 Node 22, Playwright/Chromium 설치 및 정책 환경변수 설정.
3. 서버 비밀 환경변수: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. 절대 GitHub나 클라이언트에 올리지 않는다.
4. 정책 환경변수: `TERRA_MIN_STOCK`, `TERRA_TARGET_STOCK`, `TERRA_MAX_BATCH`, `TERRA_MAX_CALLS_DAY`, `TERRA_MAX_USD_DAY`, `TERRA_MAX_USD_CASE`, `TERRA_MAX_STOCK_CATEGORY`. 기본값이 없으므로 하나라도 누락되면 실행되지 않는다.
5. 명시적 실행:
```bash
node tests/terra-refill-execute.cjs --execute
```
모든 실행 결과는 사건 ID, 상태, 실패 분류 위주로 남기고 AI 원문/숨긴 진실을 로그에 쓰지 않는다.

## 리스크 및 제한
- 실제 API 키, DB SQL 마이그레이션, Terra 모델 사용 권한, 도메인 및 비용 청구는 이 세션에서 확인하거나 사용하지 않았다. **아직 실제 배치가 성공적으로 실행됐다는 증거는 없다**.
- `TERRA_MAX_USD_CASE`는 예약 기준 추정 비용이다. 모델 측 과금액을 실시간으로 강제로 차단하는 결제 상한은 아니다. 현재는 보수적으로 예약된 금액/최대 4회 호출을 비용으로 정산한다.
- 모델 생성 중 누락/불일치가 나면 사건을 격리하고 해당 실행에서 추가 요청을 중단한다. 법률·의학적 개연성은 기계 검증만으로 충분히 보증되지 않는다.
- 높은 위험도(살인, 성범죄, 전문/의료)는 독립 검증 AI가 아직 없으므로 감사 큐로 분류되고 무인 승격되지 않는다.
- 주기적인 cron 호출이나 실제 게임 브라우저의 공유 재고 배당 연동은 아직 **활성화하지 않았다**. 서버에서 `--execute` 명령을 정기 실행하도록 배포해야 완전한 무인 운영이 된다.
- `main`, 기존 100개 사건 및 사용자 세이브는 변경하지 않았다.

## 다음
기존 DB와 분리된 테스트 Supabase에서 2인 동시 배당·접근권한·월/일 비용 정책·실제 Terra 응답을 검증한 후 스케줄러와 공유 세계 플레이 API를 연결한다.
