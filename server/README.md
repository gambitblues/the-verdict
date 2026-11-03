# THE VERDICT 서버 (v8.7.1, develop 전용 · main에 올라가지 않음)

```
브라우저 게임 ─ 로그인·세이브(읽기) ─▶ Supabase Auth + DB (행 단위 보안)
            ─ 세이브 쓰기 ─▶ save_put 함수 (버전 확인 · 덮어쓰기 전 보관)
            ─ AI 문장 ─▶ Cloudflare Worker the-verdict-api ─▶ OpenAI Responses API
                                └▶ Supabase(service role): 초대 명단 · 사용량 예약/기록 · (2단계) 공유 세계 쓰기
```

## 값이 들어가는 곳 (비밀번호·비밀 키는 아무에게도 보내지 않습니다)
| 값 | 어디에 | 공개 여부 | 누가 넣나 |
|---|---|---|---|
| Supabase Project URL | `config.js` `supabaseUrl`, `wrangler.toml` `SUPABASE_URL` | 공개 가능 | 커밋해도 됨 |
| Supabase anon public key | `config.js` `supabaseAnonKey`, `wrangler.toml` `SUPABASE_ANON_KEY` | 공개 가능(행 단위 보안이 지킴) | 커밋해도 됨 |
| Worker 주소 | `config.js` `apiBase` | 공개 | 커밋해도 됨 |
| 초대할 두 이메일 | `public.players` 표(SQL), `wrangler.toml` `ALLOWED_EMAILS` | 비공개 권장 | 기획자 |
| **OpenAI API key** | Cloudflare Secret `OPENAI_API_KEY` | **비밀** | 등록 완료 |
| **Supabase service_role key** | Cloudflare Secret `SUPABASE_SERVICE_ROLE_KEY` | **비밀** | 기획자가 `npx wrangler secret put` 으로 직접 입력 |
| 두 사람의 비밀번호 | Supabase 초대 메일에서 각자 설정 | **비밀** | 각 플레이어 |

`config.js`·`wrangler.toml`에는 공개 가능한 값만 넣습니다. 비밀 값은 Cloudflare 화면이나 `wrangler secret put`의 입력 칸에만 넣고, 채팅·커밋·이슈에 붙이지 않습니다.

## 1. Supabase (프로젝트 THE VERDICT, 서울)
1. SQL Editor에서 `supabase/001_init.sql`을 실행합니다. 섹션 1의 `insert into public.players` 줄에 두 이메일을 넣고 주석을 풀어 함께 실행합니다.
2. Authentication → Sign In / Providers → **Allow new users to sign up 끄기**.
3. Authentication → Users → **Invite user**로 두 사람 초대 → 각자 메일에서 비밀번호 설정.
4. 확인 사항(SQL로 보장, `supabase/test`에서 검사):
   - 세이브: 자기 것만 읽기, 쓰기는 `save_put`만(버전이 다르면 덮어쓰지 않음, 강제로 덮어쓸 때는 이전 것을 `save_backups`에 5개까지 보관)
   - 공유 세계 `world_state`: 플레이어는 읽기만, 쓰기는 Worker(service role)만 / 숨은 진실 `world_secrets`: Worker만
   - `ai_reserve`·`ai_finish`·`ai_usage_today`: Worker만 / `claim_player`·`save_put`·`is_player`: 로그인한 사용자만 / 비로그인(anon)은 아무것도 못 함

## 2. Cloudflare Worker (`server/worker`)
1. `wrangler.toml`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_EMAILS`, `ALLOWED_ORIGINS`(게임을 열 주소)를 채웁니다. `PRICES`는 OpenAI 가격표와 맞춰 주세요.
2. `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (입력 칸에 붙여 넣기)
3. `npx wrangler deploy`

## 3. 실제 연결 테스트 (약 10분)
1. Worker 변수 `ALLOW_TEST_FAIL`을 `"1"`로 바꿔 배포(실패 복구 확인용).
2. 자기 컴퓨터에서:
   ```
   cd server/worker
   VERDICT_API=https://the-verdict-api.<계정>.workers.dev SUPABASE_URL=https://<프로젝트>.supabase.co SUPABASE_ANON_KEY=<anon key> node scripts/smoke.mjs
   ```
   두 사람의 이메일·비밀번호를 물으면 입력합니다(화면에 *로 표시, Supabase로만 감).
   확인 항목: ① 두 사람 로그인 · 초대 명단 · 토큰 없는 AI 호출 401 · 두 모델 사용 권한 ② 계정 분리(남의 세이브 읽기·쓰기 불가, 공유 세계·숨은 진실·사용량 예약 불가) ③ 기사 1건(제목+2~4문장)과 증인 답변 1건 실제 생성, 토큰·예상 비용 ④ 일부러 실패시킨 호출이 fallback=true ⑤ 오늘 사용량.
3. `ALLOW_TEST_FAIL`을 다시 `"0"`으로 배포.
4. 게임: `config.js`에 공개 값 3개를 넣고 저장소 폴더에서 `npx serve .` → `http://localhost:3000/?auth=1`.
   두 사람이 각자 로그인 → 서로의 커리어가 안 보이는지, 증인 답변·기사가 자연스럽게 바뀌는지, 인터넷을 끊었다 켰을 때 원래 문장이 그대로 나오는지 확인.

## 4. 전체 실연결 검수 (자동, 자기 컴퓨터에서) — 테스트 계정 전용
**실제 두 플레이어 계정으로는 돌아가지 않습니다.** 서버가 '테스트 계정'이라고 확인한 빈 계정에서만 돌고, 다른 계정이면 아무것도 쓰기 전에 멈춥니다. 덮어쓰기 옵션은 없습니다.

준비(한 번):
1. Authentication → Users → Invite user로 테스트 계정 2개(필요하면 초대 명단에 없는 계정 1개 더)를 만듭니다.
2. SQL Editor에서 테스트 계정 2개를 이름이 `TEST`로 시작하게 등록합니다.
   `insert into public.players(email,name) values ('테스트1 이메일','TEST-1'),('테스트2 이메일','TEST-2');`
   (초대 명단에 없는 계정은 등록하지 않습니다.)
3. Worker `ALLOWED_EMAILS`에 테스트 계정 2개를 잠시 더하고, `ALLOW_TEST_FAIL="1"`로 배포합니다.

실행:
```
cd server/live && npm i && npx playwright install chromium
SUPABASE_URL=https://<프로젝트>.supabase.co SUPABASE_ANON_KEY=<anon key> \
VERDICT_API=https://the-verdict-api.<계정>.workers.dev node live-e2e.mjs
```
- 테스트 계정 이메일·비밀번호를 물으면 입력합니다(화면에 *로 표시, Supabase로만 감, 파일에 저장 안 함).
- 시작 전에 확인: 두 계정 모두 서버의 `is_test_player()`가 참(초대 이름 TEST…)이고, 세이브·보관본이 0개. 하나라도 아니면 "Nothing was changed"로 멈춤.
- 브라우저는 매번 새 프로필로 별도 주소(127.0.0.1)에서 띄우므로 평소 쓰는 브라우저의 게임 기록은 건드리지 않습니다.
- 확인 항목: 로그인 2명·거절·계정 분리 → 같은 계정 두 기기 충돌·보관·되돌리기 → 기사 1건·답변 1건(모델·토큰·비용)·AI 오류 시 원래 문장 → 증인 답변 20건 과잉 거부율 → 사건 1건 배당부터 판결문까지.
- 결과: `server/live/out/<시각>/report.md`·`report.json`·캡처. 캡처 직전에 화면의 비밀번호 칸을 비우고 이메일을 `a***@도메인`으로 가리며, 보고서 파일은 저장 직전에 이번 실행의 비밀번호·토큰·키·이메일을 찾아 `[가림]`으로 바꿉니다. 이 폴더를 그대로 공유하면 됩니다.

끝나면:
- Worker `ALLOWED_EMAILS`에서 테스트 계정을 빼고 `ALLOW_TEST_FAIL="0"`으로 배포합니다.
- 다시 돌리려면 `supabase/cleanup_test_accounts.sql`로 TEST 계정의 세이브·보관본만 지웁니다(실제 플레이어 데이터는 대상이 아님). 테스트 계정을 아예 없애려면 players에서 TEST 행을 지우고 Authentication에서 사용자를 삭제합니다.

## API
| 경로 | 하는 일 |
|---|---|
| `GET /health` | 살아 있는지 |
| `GET /ai/check` | 설정한 두 모델을 이 키로 쓸 수 있는지 |
| `GET /ai/usage` | 오늘 내 호출 수·예상 비용, 한도 |
| `POST /ai/npc` | 증인 답변 문장 `{role, attitude, names, question, answer}` → `{text}` |
| `POST /ai/article` | 기사 제목 + 본문 2~4문장 100~200자 |
| `POST /ai/judgment` | 판결문 인정 사실·쟁점·결론 문장만 (주문은 보내지 않음) |

### AI 호출이 막히는 경우 (게임은 항상 원래 문장을 씀)
- 로그인 토큰이 없거나 틀림(401) · Worker 명단 또는 DB 명단에 없음(403) · 명단을 확인할 수 없음(503)
- 사용량 저장소에 닿지 못함(503) · 오늘 호출 수나 예상 비용 한도 초과(429) — 호출 전에 최악의 비용으로 자리를 예약하므로 동시에 여러 번 눌러도 한도를 넘지 않음
- 다듬은 문장이 숫자·사람·긍정/부정·주요 낱말·따옴표·문장 수 검사를 통과 못 하거나, 두 번째 AI 검사가 "뜻이 바뀌었다"고 판단

호출마다 `ai_usage`에 모델·입출력 토큰(검사 호출 포함)·예상 비용·성공 여부·실패 이유가 남습니다.
