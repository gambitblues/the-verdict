# THE VERDICT P3-8 — Terra 사건 원형을 세계 시트로 전달하는 안전한 개발 경로

## 구현 파일
- `server/worker/src/terra_world_sheet_handoff.cjs` — `prepareWorldSheet(candidate, authoredSheet)`
- `server/worker/test/terra-world-sheet-handoff.test.js` — 전환·누락·원문변조·상태 제한 테스트
- `tests/terra-handoff-qa.cjs` — 저장소 파일에 쓰지 않는 독립 세계 시트 QA CLI

## 자료 흐름
1. Terra 등 제작자가 `verdict-terra-candidate/v1` 초안에 실제 상황과 세 가지 고정 세계, 증거 원문, 증인 관찰을 **직접 작성**한다.
2. 분야별 개연성·법률 검수 항목을 작성하고 `status: "review"`로 옮긴다.
3. 제작자는 별도로 정식 `verdict-world-sheet/v1` 데이터의 법적 청구, 인물, 장소·장치, 자료별 주문, 공통 사실, 세 세계의 각종 인자, 양형 내용을 채운다.
4. `prepareWorldSheet`는 **없는 사실을 자동으로 지어내지 않는다.** 사건 ID/공개 개요/증거 원본/증인 관찰/실제 행위와 동기를 서로 대조해 누락·변조를 거부한다. 통과한 데이터도 **`draft` 상태**로 반환한다.
5. `node tests/terra-handoff-qa.cjs candidate.json authored-world-sheet.json`은 임시 폴더에서 기존 `tests/world-sheets.test.cjs`를 실행하고 자동 삭제한다. **파일을 배포하거나 게임 사건 재고에 올리지 않는다.**
6. 시간표·인물·물증·법률 검토, 공판~선고 전체 플레이 시뮬레이션을 독립적으로 검수한 후에만 운영자 승인 후보가 된다. `review` 또는 `ready`로 상태를 바꾸면 기존 게임 빌더가 곧바로 배당 후보에 포함하므로 단계별 승인은 신중하게 다룬다.

## 현 단계의 의도적 제한
- 실제 Terra 모델/API 호출과 법원 공식 판례 API 수집은 아직 연결되지 않았다.
- `terra-handoff-qa.cjs`는 세계 시트 스키마와 일부 콘텐츠 경고/오류만 판단한다. 법률·의학적 개연성, 브라우저 선고 완주, 2인 공유 배당 트랜잭션은 아직 자동으로 보증하지 않는다.
- 검수 통과 후 자동으로 `world-sheets/cases` 또는 `world_sheets.js`를 수정하지 않는다.
- 기존 100건과 운영 `main`, 사용자 세이브는 그대로 보존한다.

## 다음 단계
운영자 검수 데이터와 권한 인증, Terra 호출·비용·중복 검증, 변환 시트의 사건별 장기 플레이 QA, 승인된 사건만 공유 세계의 분산 배당 저장소에 등록하는 서버 트랜잭션이 필요하다.
