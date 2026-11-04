# P3-9 — Terra 원형 사전 재판 시뮬레이션 (develop)

## 실제 구현
- `tests/terra-trial-qa.cjs`: 승인 대기 중인 별도 세계 시트에 대해 기존 `match_engine.js`를 사용해 `did`, `didnt`, `reason` 각 세계를 6개 고정 시드로 4기일 진행한다. 총 **18회 검증**.
- 각 시뮬레이션: 사건 잠금 해시 보존, 사건 기록의 세계별 원문 유지, 세계의 판결 가능성 보존, 시트 불변성 및 동일 시드의 시작 상태 잠금을 검사한다.
- `tests/terra-handoff-qa.cjs`: 후보→세계시트 일치성, 기존 `world-sheets.test.cjs` 스키마 검사, 18회 재판 검사를 순서대로 통과해야 `staged-draft` 결과를 돌려준다. 실패하면 해당 단계를 반환한다.
- `tests/terra-trial-qa.test.cjs`: 기존 `clinic-001`을 읽기 전용 참조 시트로 사용해 3세계 × 3시드 검사를 한다. CI에 등록.
- 어떤 단계도 원본 100건, 게임 배당 인덱스, 사용자 세이브, `main`을 변경하거나 AI를 호출하지 않는다.

## 보장하지 않는 것
- `match_engine.js` 시뮬레이션은 **개발용 프로토타입 엔진**이다. 실제 6개 메뉴의 모바일·데스크톱 브라우저 E2E 재판을 대신하지 않는다.
- `clinic-001`의 실제 진실/판결/임신 관련 원본 데이터는 변경하지 않았다.
- 법률·의학·증인 신빙성의 실질적 타당성은 자동 입증되지 않는다.
- 실제 Terra 생성 API, 운영자 인증/서명, 원자적 공유 사건 재고 배당은 아직 미연결이다.

## 사용 예
```bash
node tests/terra-handoff-qa.cjs /path/to/terra-candidate.json /path/to/fully-authored-world-sheet.json
```
출력은 `candidate-handoff`, `world-sheet-QA`, `simulated-trial-QA`, `staged-draft` 단계 및 관련 오류. 파일을 저장하거나 배당되지 않음.

## 남은 작업
1. 실제 여섯 재판 메뉴의 머리 없는 브라우저 E2E 시뮬레이션을 입고 후보에도 실행하는 기능.
2. Terra/API 작성 → 독립 검수 → 승인/배당 트랜잭션과 비용 관리.
3. 신규 9개 초안의 증거/증인·법률 고증을 완성하고 실제 전체 재판 QA에 통과시켜 100건 플레이 가능 목표 달성.
