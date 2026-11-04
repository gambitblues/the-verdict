# THE VERDICT — 초기 100개 원형 중 신규 9건 제작 검수표 (P3-6)

## 기준
- 기존 `world-sheets/cases/` 91건을 보존하고 아래 9개 독립 가상 사건 초안을 추가하여 **저장소 사건 시트 100건**을 구성.
- 현재 9건은 모두 `status: draft`이다. 게임에 배당되는 완성 사건은 아니다. 개발자/관리자가 `review`로 옮기는 순간 기존 빌드에 편입되므로 승인 전 전환 금지.
- 이 9건은 현재 대화에서 생성한 **초안**이며 Terra AI 런타임이 실제로 호출된 결과가 아니다. Terra 실행 및 API 토큰 사용 여부를 과장하지 않는다.
- 출처 `original`은 실제 판례 검증을 뜻하지 않는다. 나무위키는 배경 탐색만 허용하고 판례/법조문은 공식 원문으로 별도 확인한다.

| ID | 분류 | 작품명 | 상태 |
|---|---|---|---|
| terra-homicide-riverside-shift | 살인 | 강변 세차장의 마지막 야간 교대 | draft |
| terra-homicide-medical-transfer | 살인 | 요양시설 이송 전 사라진 기록 | draft |
| terra-sexual-studio-message | 성범죄 | 닫힌 연습실과 예약 메시지 | draft |
| terra-sexual-reunion-record | 성범죄 | 동창회 이후의 택시 승하차 기록 | draft |
| terra-financial-school-grants | 금융 | 지역 장학회 보조금의 다른 수취인 | draft |
| terra-civil-rooftop-water | 일반 민사 | 옥상 배수 공사 뒤 이어진 누수 | draft |
| terra-family-inheritance-voice | 가족 | 녹음된 유언과 두 장의 약속 | draft |
| terra-property-bridge-collision | 재산·교통 | 임시 우회로에서 사라진 블랙박스 구간 | draft |
| terra-public-permit-ledger | 공공 | 지역 축제 허가와 자문비 750만 원 | draft |

## Terra 또는 편집자가 완료해야 할 실질적 콘텐츠 제작
1. 각 `worlds.did / didnt / reason`의 시간표를 모든 원본 증거와 맞춘다. 현재 일부 초안의 증거 문자열은 개별 원본을 확정하지 않은 **설계용 서술**이다. 최종본에서는 원문 형식, 시각, 기록 주체, 취득 경로, 누락 범위를 구체적으로 작성한다.
2. 증인 W1/W2의 세계별 답변을 일관된 사실 기억·기기 관찰 한계·이해관계로 세분화한다. 신문 질문, 추가 주문 및 진술 모순을 각 사건에 맞춰 작성한다.
3. 각 사건 세계의 범죄구성요건·증명책임·법정형·절차를 대한민국 공식 법령/판례에서 독립 확인한다. 특히 범죄명·죄수·형량 및 민사 청구의 주문이 실제 법률상 가능한지 점검한다.
4. 같은 사건에서 증거 1개만으로 세 세계가 분리되지 않도록 난이도를 조정하고, 사전 공개/법원 명령으로 제출된 증거의 접근 경로를 확보한다.
5. 실제 사건과 문장·인물·장소가 우연히 같아지는지 중복·민감정보 확인을 수행한다.
6. `node tests/world-sheets.test.cjs`, `node tests/match-engine.test.cjs`, `node tests/build-sheets.cjs --check`와 UI 선고 완주 검수. `--check`는 편입 후 출력 재생성이 필요한 경우 별도 빌드/검토한 뒤 수행한다.
7. 검수자가 승인할 때만 `review` → 사용자 최종 승인 후 `ready`. 서버 공유 재고와 Terra 실제 API는 추가 구현 대상.

## 수정 범위
- 기존 91건, `world_sheets.js`, `world_sheets_index.js`, `case-data`, 운영 `main`, 실제 사용자 세이브는 수정하지 않는다.
- 테스트 `match-engine.test.cjs`는 게임 빌드와 같이 `draft`를 제외한다. 초안의 스키마 검사는 `world-sheets.test.cjs`가 계속 수행한다.
- 500개 원형 최종 유형 목표는 `case_pack_engine.js`의 `CATEGORY_TARGETS`를 따른다.
