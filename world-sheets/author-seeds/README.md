# THE VERDICT — 새 사건 업로드 → Terra 제작 → 자동 QA → 게임 배당 재고

**기존 사건과 세이브는 변경하지 않습니다.** 새 창작 사건은 [간단한 한국어 사건 양식](../author-template.md)을 복사해 이 폴더에 `case-001.md` 형식으로 올립니다.

## 실제 흐름

1. `develop`에 새 파일을 올리면 GitHub Actions **Author case intake QA**가 필수 고정 사실, 인물, 증거, 쟁점을 검사합니다.
2. 최초 1회 설정으로 `TERRA_AUTHOR_AUTO_ENABLED=1` 및 GitHub Secret `TERRA_AUTHOR_AI_KEY`를 준비하면, 신규 파일에 대해 Terra가 정식 3세계 사건과 6메뉴 진행에 필요한 증인·증거·제출명령을 생성합니다. AI 호출 비용이 발생하므로 한 push에 사건 하나만 자동 처리합니다.
3. `terra_auto_admission.cjs`가 집필자 고정 사실을 수정하지 않았는지, 확정 증거 출처, 후보-월드시트의 잠긴 진실·원문 불변성, 후속 제출명령 및 **18회 엔진 시뮬레이션**을 검사합니다. 실패하면 배당되지 않으며 CI와 보고서에 이유를 남깁니다.
4. 최초 1회 `TERRA_AUTHOR_AUTO_ADMIT_ENABLED=1`, **독립 QA 환경 전용** Secrets `TERRA_QA_SUPABASE_URL`, `TERRA_QA_SERVICE_ROLE_KEY`를 설정하면 **추가 수동 승인 없이 PASS 사건을 `shared_case_admit_sealed`로 단 한 번 입고합니다.** 해당 QA Worker에서 공유 사건 배당을 활성화하면 다음 시간대부터 후보로 등장할 수 있습니다.
5. PASS/FAIL과 사건 자료는 Actions artifact의 `terra-author-drafts/`에 남습니다. `qa_stock_admitted`는 실제 입고 RPC가 성공한 상태만 의미합니다.

**운영 DB에 대한 자동 입고는 금지되어 있습니다.** 먼저 독립 QA에서 실제 2계정·AI·장기 저장 테스트까지 통과한 뒤 운영 승격 정책을 별도로 결정해야 합니다. 기능이 이미 운영 서비스에 배포되었다는 뜻이 아닙니다.

## 자동 입고의 한계

18회 시뮬레이션과 고정 사실 문자열 보존만으로 AI의 법률·의학 판단이 의미상 정확하다고 보장할 수 없습니다. 모순·확정되지 않은 사실을 발견하면 별도 검토가 필요하며, QA 환경에 등록됐다고 법률적 정답임을 인증한 것은 아닙니다. 실제 사건이나 출처가 있는 판례는 이 자동 창작 경로의 대상이 아닙니다.

**집필자가 매번 승인하는 구조는 아닙니다.** 한 번 정책·키·QA 환경을 준비하면 사건마다 자동 생성/자동 검증/자동 입고하며, 배당은 서버가 중복 없이 처리합니다.
