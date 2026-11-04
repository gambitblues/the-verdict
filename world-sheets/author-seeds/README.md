# 내가 직접 쓰는 사건 기획안

이 폴더는 **새 사건 씨앗만** 받습니다. 기존 `world-sheets/cases/`의 상세 사건 파일이나 게임 세이브는 수정하지 않습니다.

1. [한국어 간편 양식](../author-template.md)을 복사해 이 폴더에 `my-case-001.md`로 올립니다.
2. 고정 사실 3개 이상, 인물(A/B), 증거 단서 2개 이상, 쟁점과 미확정 사항을 적습니다. **고정 사실은 실제 일어난 사실만** 적고 추측은 미확정 사항으로 따로 둡니다.
3. GitHub Actions `Author case intake QA`가 JSON 또는 Markdown 구조를 무료로 검사합니다. 틀린 곳은 검사 로그에서 확인합니다.
4. 검사를 통과한 뒤 `Author case intake QA`의 **Run workflow**에서 `generate_case`에 해당 파일 경로를 적어 Terra를 실행할 수 있습니다. 관리자 설정 `TERRA_AUTHOR_AI_KEY` 비밀 키가 있어야 하며, **AI 호출 비용이 발생**합니다.
5. Terra가 후보 사건과 상세 월드시트 초안, 검토 보고서를 만들어 Actions artifact로 남깁니다. 이를 다운받아 고정 사실·법률·증거 출처를 확인합니다. **사람 승인 없이 배당 풀에 들어가지 않습니다.**
6. 업로드 직후 자동 Terra 가공을 원한다면 저장소 관리자가 GitHub Actions 변수 `TERRA_AUTHOR_AUTO_ENABLED=1`을 명시적으로 설정할 수 있습니다. 자동 처리 역시 초안 생성에만 한정되며 호출 비용이 듭니다.

입력은 원본이 없는 **창작 사건 전용**입니다. 실존 판례에 기반한 사건은 출처·법률·비식별화 검증을 거치는 별도 상세 양식을 사용하세요.

문서 편집이 부담스럽다면 첫 줄의 사건 ID, 분류(homicide/violence/financial/property/reputation/civil/family/professional/public/sexual), 재판유형(criminal/civil/decision)만 맞게 두고, 나머지 한국어 문장을 채우면 됩니다.

**알아둘 점:** 현재 Terra는 기존의 `did/didnt/reason` 세 세계 후보 생성기를 활용합니다. 이 시점에는 집필자가 지정한 고정 사실을 AI가 의미까지 정확히 보존했는지 완전 자동 검증하지 못하므로 검토 보고서 확인이 필수입니다. 새 월드시트가 자동으로 P4의 동적 사실 원장으로 전환되었다고 보아서는 안 됩니다.
