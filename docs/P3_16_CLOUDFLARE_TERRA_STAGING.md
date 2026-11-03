# THE VERDICT — P3-16 Cloudflare Terra 제작 연결 (develop only)

## 기존 서비스 활용
기존 Cloudflare Worker `the-verdict-api`가 이미 보관한 `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`와 `SUPABASE_URL`, `MODEL_CASE`를 그대로 사용한다. 사용자 Mac으로 키를 옮기거나 새 API 키를 발급할 필요가 없다.

**추가된 실제 코드:** `server/worker/src/terra_cloud_staging.cjs`. Cloudflare scheduled handler에서만 호출된다. 003/004의 재고·잠금·예산 RPC를 이용해 실행 잠금을 확보하고, 부족한 사건 유형의 신규 시트를 Terra로 두 단계 생성하고 동일한 match 엔진으로 3세계 × 6시드 = 18회 인메모리 재판 QA를 통과시킨다. 결과는 새 005의 private `terra_pending_drafts`에 **미승인 draft**로 저장한다. 플레이어 API, 게임 배당, 공개 인덱스에 노출하지 않는다.

**보안:** 테스트 없이 발행하지 않는다. Cloudflare Worker에서는 Playwright/Chromium 및 기존 `tests/terra-handoff-qa.cjs` 파일 검사기를 실행할 수 없다. 같은 엔진의 18회 재판은 Worker에서도 실행하지만, 실제 브라우저 6개 메뉴 QA와 전체 시트/법률 품질 검사를 통과한 것은 아니므로 초안 저장까지만 자동화된다. 이후 격리된 실행 환경의 18회 재판 QA + 6메뉴 실제 브라우저 QA + 서버 해시 재검증이 필요하다. 이는 **아직 클라우드에서 자동 승인·등록되지 않는다**.

## 적용 순서 — 기존 API/Supabase 재설정은 필요 없음

1. 이미 적용한 003/004는 재실행하지 않는다.
2. **신규 005만** Supabase SQL Editor에서 실행:
   `server/supabase/005_terra_private_staging.sql`
3. SQL Editor에서 읽기 전용 확인:
   ```sql
   select to_regclass('public.terra_pending_drafts') is not null as drafts,
          to_regprocedure('public.terra_stage_draft(text,text,jsonb,jsonb,text,text)') is not null as stage_rpc,
          to_regprocedure('public.terra_pending_counts()') is not null as count_rpc;
   ```
4. 현재 GitHub `server/worker/wrangler.toml`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_EMAILS`는 **예시 값**이다. 그대로 배포하면 기존 실제 설정이 덮어써질 수 있으므로 `npm run deploy`는 해당 값이 정리되기 전에는 의도적으로 실패하도록 보호 장치를 추가했다.
5. 기존 Cloudflare Worker의 실제 인증·도메인·비밀 변수 설정을 보존하는 방법으로 `develop`의 새 Worker 코드를 배포한 후, **기존 초대된 플레이어 토큰**으로 `GET /terra/status` 조회. 결과는 `privateStock`, `draftStorage`, `budgetLedger`, `modelConfigured`, `scheduled` 불리언만 표시한다. 생성 API를 호출하지 않으며 숨겨진 세계도 반환하지 않는다.
6. 정기 실행은 매일 **한국시간 03:00** (UTC 18:00) 트리거로 정의되었지만, `TERRA_REFILL_ENABLED=0`로 **기본 비활성화**다. 실제 유료 제작을 활성화하려면 별도 운영 결정을 하고 안전한 배포를 마친 뒤 `TERRA_REFILL_ENABLED=1`로 변경해야 한다. 코드의 기준값: 하루 최대 4 AI 호출, 하루 최대 $0.30 예약, 한 사건당 최대 $0.30 예약, 목표 재고 1건, 회차 1건.
7. 안전을 위해 해당 예약은 실제 토큰 단위 청구액이 아니라 보수적인 **최대 예약 비용**으로 정산한다. 수수료나 실제 지출 제어를 보증하는 결제 상한이 아니다.

## 아직 확인되지 않은 항목
- 이 GitHub 연결에서는 Cloudflare 배포 권한과 Supabase SQL 직접 실행 기능이 없으므로 **005 적용, 새 Worker 배포, 실제 Terra 모델 호출, 운영 스케줄 활성화는 완료로 기록하지 않는다.**
- `/ai/check`의 모델 존재 확인은 실제 두 단계 생성 성공과 다르다.
- 생성 후 '자동 검증 → 실전 재판 QA → 비공개 case_stock 자동 입고' 완전한 서버 파이프라인은 아직 미완료다. 특히 고위험 사건 분야는 자동 검수 없이 배당할 수 없다.
- Worker는 하루 1건만 초안 제작하도록 구현되어 있으며, P4의 두 판사 교차 배당 엔드포인트는 아직 미연결이다.

기존 100개 사건, `main`, 판사 저장 데이터는 변경하지 않았다.
