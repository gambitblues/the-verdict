# Advanced Case Engine — foundation v1

This module is **experimental** and does not replace the currently running trial core. Its purpose is to prove the invariant case-truth architecture while old cases and saves remain unchanged.

- `advanced_case_engine.js`: deterministic selection among authored `did/didnt/reason` variants, serialization of immutable authoring facts into `lock`, append-only court proceeding events, and conservative proposition-based conflict classification.
- `tests/advanced-case-engine.test.cjs`: checks deterministic creation, stable locked facts across submissions and save/load, and distinguishes same-event contradictions from different times or legal propositions.
- The source material is fictionalized. `events` are hidden world-state facts; `evidence` are original artifacts, and `witnesses[].observedEventIds` restrict actual observation scope.
- Conflict detection **never decides guilt, consent, credibility or legal conclusions**. A hallway CCTV showing walking does not determine legal capacity or consent.
- Later steps: author a real (fictionalized) pilot case using the same contract; build a compatibility adapter for existing UI; add evidence submission rules, complex witnesses, event clock offsets and dynamic hearings. Only after tests should the engine be enabled in ordinary play.
- Korean legal statutes, offenses and sentencing ranges are authored/verified case metadata rather than automatically judged by this engine.

Run: `node tests/advanced-case-engine.test.cjs`.
\n## Witness Engine v1 — 작성 규칙 (Advanced 전용)\n\n`advanced_witness_engine.js`는 기존 게임에 아직 연결되지 않은 독립 모듈이다. `AdvancedCase.create()`에 제공되는 세 진실별 `witnesses[]` 안에 `script`를 작성한다. 응답은 오직 `script[questionId].responses.initial/clarify/confront/recall.text`에 기록한 문구 중에서 선택하며 자동 문장 생성과 임의 사실 추가를 하지 않는다.\n\n- `traits` 선택 수치: `memoryAccuracy`, `memoryConfidence`, `honesty`, `pressureSensitivity`, `interest` (각 0~100). v1에서는 메타데이터이고 사실이나 응답을 자동 변경하지 않는다.\n- `observedEventIds`는 증인이 실제 관찰한 고정 사건 ID다. 직접 목격 응답은 `knowledgeSource: 'direct'`와 해당 `eventId`를 명시해야 한다. 기억·전언·자료 열람은 `memory/hearsay/document/inference/unknown`으로 구별한다.\n- `initial`: 첫 질문에서만 가능. `clarify`: 같은 질문의 선행 답변 뒤 가능. `confront`: 같은 질문의 선행 답변 + `confrontEvidenceIds` 중 하나가 법정에 제출된 뒤 가능. `recall`: 선행 답변 + 그 증인에 대한 재소환 명령 기록이 있을 때 가능.\n- 응답은 항상 제작자가 쓴 대사 그대로 저장한다. 같은 시드·같은 행동 이력에서는 같은 답변이 나온다. 이 엔진은 진술의 진실성·범죄 성립·동의 여부를 자동 판단하지 않는다.\n- `tests/advanced-witness-engine.test.cjs`로 기본 상태 전이·법정 증거 대조·재소환·세이브 재현을 검증하도록 마련했다.\n- **남은 작업:** 최초 증언·추가 증언의 플레이 화면 연결, 허위 직접 목격의 허용 여부 등 고급 지식 모델, 신청의 적법성 검토, 작성자용 실제 사건 시드 3~5건과 통합 브라우저 QA.\n
## Timeline & Evidence Engine v1 (독립 모듈)

- `advanced_timeline_evidence.js`: 확정된 사건 시드의 `events` 및 `evidence` ID와 대조하여 기록의 시각·출처·확보 경위를 확인한다.
- 시간은 반드시 날짜와 시간대가 포함된 ISO 값(`2026-06-12T00:43+09:00`)으로 기획한다. `devices[deviceId].offsetMinutes`는 **장치 표시 시간 = 실제 시간 + 오차(분)**으로 정의한다. 동일 장치의 모든 관련 기록에 같은 오차를 적용한다.
- `records`에는 `id,kind,source,provenance,at`와 선택적인 `eventId,deviceId,uncertaintyMinutes`를 기록한다. 시간 비교 결과는 양립 여부이지 진위, 동의, 유무죄 판정이 아니다.
- 원본 증거로 잠기지 않은 ID를 법정 제출할 수 없다. 제출 기록은 사건 진실을 변경하지 않고 법정 이력에 추가한다. 중복 제출은 중복 기록하지 않는다.
- 현재는 개발용 순수 데이터 모듈이며 기존 사건 화면과 연결되지 않았다. 타임라인 증거의 진위·장치 오차는 기획자가 검증하여 제공해야 한다. 테스트 파일은 `tests/advanced-timeline-evidence.test.cjs`.

## Courtroom Conflict Engine v1 (독립 모듈)

- `advanced_courtroom_conflict.js`: 기획자가 쓴 대사만 `claim → rebuttal → counter → intervention`로 연결한다. `line.support`에 법정 제출된 증거 ID, 앞서 기록된 증언 순번 또는 공방 ID를 명시해야 다음 대사가 해금된다.
- `line`에는 `id,phase,speaker,text,intensity,support,replyTo`를 지정한다. `intensity`는 `analytical/firm/heated` 중 하나다. 공격적 언사는 법적 유죄 판단 또는 증명력 수치에 영향을 주지 않는다.
- `judge`만 `intervention`을 실행할 수 있고, 모든 공방 발언은 원래 사건 사실을 변경하지 않는 법정 이력에 기록된다. 무작위 문장 생성은 하지 않는다.
- 기본 테스트: `node tests/advanced-courtroom-conflict.test.cjs`. 실제 게임 UI 연결, 법률 절차 검증 및 사건 5건에 대한 플레이 QA는 후속 작업이다.
