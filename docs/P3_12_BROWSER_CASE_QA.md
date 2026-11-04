# THE VERDICT — P3-12 실제 법정 화면에서 신규 시트 사전 검증

## 적용 코드
- `tests/terra-browser-qa.mjs`: 390×844 크기의 실제 Chromium 게임 화면에서 사건 1건의 **6개 메뉴(사건·기일·증거·증인·주문·판결)**를 시험하는 독립 QA 도구.
- 원본 게임 데이터는 변경하지 않는다. OS 임시 폴더에 필요한 게임 파일을 링크하고, **검증할 세계 시트만** 그 임시 환경에서 review 상태로 복사한 다음 기존 `tests/build-sheets.cjs`로 검증용 인덱스를 만든다. 종료 시 임시 환경을 삭제한다.
- 각 검사에서 실제 게임의 `createGeneratedCase`, `VerdictTrialPlay`, `courtUI`를 사용하고, 증거 조사·증인신문·주문·기일 종료 후 실제 판결문 확정을 시험한다.
- 현재 3회 브라우저 반복은 **세 세계 각각이 정확히 한 번 배당된다는 보장이 없다**. 세 세계의 확정 진실 검증은 별도의 `tests/terra-trial-qa.cjs` (18회 프로토타입 시뮬레이션)를 유지한다.

## 사용법

```bash
# 게임에 존재하는 기준 사건으로 QA 장치 자체를 점검
node tests/terra-browser-qa.mjs --fixture clinic-001

# 자동 생성 후 pending에 격리된 세계 시트에 대한 실제 브라우저 공판 검증
node tests/terra-browser-qa.mjs --sheet pending/<case-id>/world-sheet.json
```

Playwright와 Chromium 실행 환경이 필요하다. 개발 CI의 `Develop runtime and mobile smoke QA`에도 기존 `clinic-001`을 사용한 독립 브라우저 테스트를 추가했다.

## 상태와 운영 제약
- 이 검증기를 통과해도 자동으로 `review`/`ready`로 승격하거나 공유 배당 풀에 올리지 않는다.
- 기존 시트 100건, 운영 `main`, 사용자 저장 데이터에 영향이 없다.
- 브라우저 검사는 인터페이스/출력/선고 진행 가능성을 검사하며 법률·의학·서사 고증을 자동 인증하지 않는다.
- 실제 Terra API 인증키·사용량을 이 세션에서 확인할 수 없으므로 **실제 모델 생성 성공을 주장하지 않는다**.
- 전체 검증 통과가 확정되기 전에는 P3-12의 CI 결과를 대기 상태로 취급한다.

## 후속
신규 생성 사건 자체를 대상으로 실제 모델 호출 후 browser QA를 실행해 품질을 검토하고, 승인자 권한 검증·공식 판례 확인·원자적 2인 공동 배당을 구축해야 한다.
