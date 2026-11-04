# THE VERDICT P3-10 — Terra 실제 호출을 위한 opt-in 사건 생성기

## 이번 구현
- `server/worker/src/terra_case_generator.cjs`: 프로젝트에 지정된 기본 모델 `gpt-6.1-terra`로 **OpenAI Responses API**에 2차례 요청하는 로컬용 생성 로직. 모델 호출을 임의로 백그라운드 실행하거나 브라우저에 노출하지 않는다.
  1. 후보 `verdict-terra-candidate/v1` 생산. 세 갈래 진실·증거 원본·증인 관찰·분야별 현실 고증 작성. `draft`만 허용.
  2. 같은 후보의 사실과 원문을 보존하는 `verdict-world-sheet/v1` 제작. 법률·인물·자료 주문·양형 포함. 결과는 **`draft`로만 반환**.
- `tests/terra-generate.cjs`: 개발자 터미널에서만 실행하는 CLI. `OPENAI_API_KEY` 없이는 요청하지 않는다. 결과는 `pending/<id>/candidate.json`, `world-sheet.json`, `qa-result.json`에 작성된다. 해당 경로가 이미 있으면 덮어쓰지 않는다.
- 두 번의 실제 AI 호출 이후에도 기존 `tests/terra-handoff-qa.cjs`로 스키마 검증 및 `did/didnt/reason` × 6시드 = 18회 모의 재판을 **통과해야만 로컬 임시 보관 파일을 만든다**. 실패한 사건은 자동 게재하지 않는다.
- `server/worker/test/terra-case-generator.test.js`: 네트워크를 모의 처리한 API 요청 및 잘못된 응답의 실패 차단 테스트.

## 실행 방법 (사용자/개발자 Mac, 로컬)
1. `seed.json` 파일 작성:
```json
{
  "id": "terra-financial-contract-101",
  "category": "financial",
  "premise": "오래된 건설 현장의 협력업체 장비 대금 중 일부가 동일한 전자결재 번호로 두 번 지급되었다는 의혹을 다투는 가상의 사건을 제작한다."
}
```
2. 개인 컴퓨터의 안전한 환경에서만 환경변수 `OPENAI_API_KEY`를 설정한다. 키를 코드·GitHub·대화에 붙여 넣지 않는다.
3. 개발자 명령:
```bash
node tests/terra-generate.cjs --execute seed.json
```
기본 모델은 저장소 `server/worker/wrangler.toml`에 적힌 `gpt-6.1-terra`를 따른다. `TERRA_CASE_MODEL` 환경변수로 변경할 수 있으나 **계정에서 해당 API 모델 사용이 가능한지 확인이 필요하다**.
4. 결과는 로컬 `pending/<id>/`에만 생긴다. `status=draft`이며 절대로 `world-sheets/cases/`로 자동 옮기지 않는다.

## 정확히 구분할 사항
- 이번 코드의 **AI 요청 경로는 구현**되었으나, 현재 연결된 도구에 OpenAI API 키가 없어 **실제 Terra 모델에 요청하여 응답을 받은 실연결 검증은 하지 않았다**.
- `generate()`는 내부적으로 구조 확인을 위해 후보를 `review` 사본으로 바꾸지만 **사람이 리뷰·승인한 것으로 주장하거나 원본 초안의 상태를 바꾸지 않는다**.
- 모든 모델 결과는 불신 입력으로 취급된다. 공식 법률, 판례, 전문 감정은 검증자의 별도 확인이 필요하다.
- 자동 QA는 프로토타입 `match_engine.js` 기반 재판이며 실제 게임의 6개 탭 브라우저 완주와 다르다.
- 서버 공유 사건 재고, 2인 동시 배당 트랜잭션, 승인자 인증 및 사건 유형별 품질 리뷰 UI는 아직 미구현.
- `main`, 사용자 세이브 및 기존 세계 시트 100건을 변경하거나 배포하지 않았다.

## 향후 작업
실제 개발자 환경에서 API 응답·비용을 확인하고, 생성 결과의 누락·환각/개연성을 교정하는 편집 루프를 추가한다. 이후 검수된 사건에만 브라우저 6탭 완주 테스트와 관리자 승인 기능을 연결한다.
