# THE VERDICT P3-14 — 재고 부족 감지 · 비용 한도 · 두 판사 원자적 배당

## 현재 develop에 구현한 기능

1. `server/worker/src/terra_replenishment_plan.cjs`
   - `stock`과 `inFlight`를 합산한 분야별 확보 수량을 계산한다.
   - 보유 재고가 `minPerCategory` 미만인 분야만 `targetPerCategory`를 향해 부족분을 제안한다.
   - `maxNewCasesPerRun`, 하루 최대 AI 호출 수(사건당 최소 2회), 하루 최대 USD 추정 비용으로 제안 수를 제한한다.
   - 설정이 없거나, 음수·중복 사건 ID·잘못된 카테고리가 들어오면 생산을 막는다.
   - **계획 단계는 읽기 전용이며 실제 Terra 호출은 하지 않는다.**
2. `tests/terra-replenish-plan.cjs policy.json inventory.json [in-flight.json]`
   - 입력 JSON으로 계산한 계획을 출력한다. 사람 승인 없이도 매일 자동 계산할 수 있는 순수 함수 기반 모듈이다.
3. `server/supabase/003_case_stock.sql`
   - 숨긴 진실을 포함하는 시트를 **RLS를 적용한 private case_stock** 테이블에 둔다. 일반 판사 계정의 직접 조회 및 변경을 차단한다.
   - `case_stock_admit`: 신뢰된 service_role에만 허용되는 신규 사건 저장 RPC. 중복 사건 ID 및 원형을 DB에서 차단한다.
   - `case_stock_assign`: 등록된 판사 UUID를 확인하고 `SELECT FOR UPDATE SKIP LOCKED`를 사용해 **한 사건이 두 판사에게 동시에 배당되지 않도록** 원자적으로 처리한다. 이미 배당된 사건은 재고로 자동 복귀하지 않는다.
   - **이 SQL은 GitHub에 추가했을 뿐, 실제 Supabase DB에는 아직 적용하지 않았다.**
4. `server/worker/src/terra_stock_service.cjs`
   - 신뢰된 service_role 서버 요청만 이용하도록 하는 RPC 어댑터. 일반 사용자 JWT나 클라이언트에 서비스 키를 보내지 않는다.
   - 자동 적재는 기존 P3-13 분류에 더해 **별도 서버 재검증 함수와 동일 원본 해시 확인**을 요구한다. 해당 서버 재검증 함수는 아직 실제 운영 서비스에 연결되지 않았으므로, 임의의 QA 보고서만으로 공개 등록할 수 없다.

## 설계 경계
- 배당받은 판사의 기존 저장데이터, 판결문, 사건 진실은 변경하지 않는다.
- 공판 전 공개 정보는 별도 안전한 요약 API를 통해 제공해야 한다. private `sheet`의 세 진실 전체를 플레이어가 직접 내려받게 해서는 안 된다.
- 자동 생산 스케줄러, 실제 Terra API 예산 예약 및 지출 기록, 독립 브라우저 검증자의 신뢰된 배포, 서비스의 사건 공개/배당 API는 **미구현**이다.
- SQL 실행 전 권한/RLS/동시성 통합 테스트와 서비스 키 비밀 환경변수 검토가 필요하다.
- 이번 개발은 신규 모듈과 SQL 추가로만 수행했다. 기존 100개 사건, `main`, 실제 유저 저장과 공개 서비스는 그대로 유지했다.

## 다음 개발
1. 일정에 따라 읽기 전용 부족분을 계산하고, 실제 사용 권한·비용 예산 예약이 허용된 환경에서만 Terra 생산 배치를 실행
2. 독립 서버에서 생성 결과를 재검증하고 성공 사건만 DB에 적재
3. 두 판사 클라이언트와 비밀 정보가 누출되지 않는 배당 API 연동
4. 원자적 배당 SQL의 실제 Supabase 통합 테스트, 저재고 알림 및 복구 처리
