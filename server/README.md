# THE VERDICT 서버 (v8.7, develop 전용 · main에 올라가지 않음)

브라우저 게임(GitHub Pages) ─ 로그인·세이브 → **Supabase** (Auth + DB, 행 단위 보안)
                         └ AI 문장 → **Cloudflare Worker `the-verdict-api`** → OpenAI Responses API

- OpenAI 키는 Worker 비밀값에만 있습니다. 브라우저는 키를 모릅니다.
- AI에는 플레이어 화면에 이미 보이는 글만 갑니다(증인의 답, 기사, 판결문 초안). 사건의 숨은 진실·점수는 가지 않습니다.
- AI는 문장만 바꿉니다. 숫자·이름·따옴표 안의 말·판결 순서가 바뀌면 서버가 버리고, 게임은 원래 문장을 씁니다.

## 1. Supabase (프로젝트 THE VERDICT, 서울)
1. SQL Editor에서 `supabase/001_init.sql`을 실행합니다. 맨 위 주석의 `insert into public.players`에 두 사람 이메일을 넣어 함께 실행하세요.
2. Authentication → Sign In / Providers → **Allow new users to sign up 끄기** (공개 가입 차단).
3. Authentication → Users → **Invite user**로 두 사람을 초대합니다. 초대 메일에서 비밀번호를 정합니다.
4. Project Settings → API에서 **Project URL**, **anon public key**, **service_role key**를 확인합니다.

## 2. Cloudflare Worker (`server/worker`)
1. `wrangler.toml`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_EMAILS`(두 사람), `ALLOWED_ORIGINS`를 채웁니다.
2. 비밀값: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (OPENAI_API_KEY는 등록 완료).
3. 배포: `npx wrangler deploy`
4. 오프라인 검사: `npm test` (가짜 OpenAI·Supabase로 인증·한도·기록·되돌림 검사)

## 3. 첫 실제 호출 (기사 1건 + 증인 답변 1건)
```
VERDICT_API=https://the-verdict-api.<계정>.workers.dev \
SUPABASE_URL=... SUPABASE_ANON_KEY=... VERDICT_EMAIL=... VERDICT_PASSWORD=... \
node scripts/smoke.mjs
```
모델 사용 권한(`/ai/check`), 토큰 없이 호출하면 401, 기사·답변 결과, 토큰과 예상 비용, 오늘 사용량을 출력합니다.

## 4. 게임 쪽
- `config.js`에 Supabase URL·anon key·Worker 주소를 넣습니다(공개돼도 되는 값).
- develop 확인: 저장소 폴더에서 `npx serve .` 후 `http://localhost:3000/?auth=1` (localhost는 `?auth=1`이 없으면 로그인을 건너뜁니다 — 테스트용).
  Worker의 `ALLOWED_ORIGINS`에 실제로 쓸 주소를 넣어야 AI 호출이 됩니다(localhost는 항상 허용).

## API
| 경로 | 하는 일 | 모델 |
|---|---|---|
| `GET /health` | 살아 있는지 | – |
| `GET /ai/check` | 설정한 두 모델을 이 키로 쓸 수 있는지 | – |
| `GET /ai/usage` | 오늘 내 호출 수·예상 비용, 한도 | – |
| `POST /ai/npc` | 증인 답변 다듬기 `{role, attitude, question, answer}` → `{text}` | MODEL_TALK |
| `POST /ai/article` | 기사: 제목 + 본문 2~4문장 100~200자 | MODEL_TALK |
| `POST /ai/judgment` | 판결문 인정 사실·쟁점·결론 문장만 (주문은 보내지도 않음) | MODEL_TALK |

`/ai/*`는 모두 Supabase 로그인 토큰 + 초대 명단(ALLOWED_EMAILS) 확인 뒤에만 열립니다. 호출마다 `ai_usage`에 모델·입출력 토큰·예상 비용(PRICES 표 기준)·성공 여부가 남고, 하루 한도(DAILY_CALLS·DAILY_USD, 한국 날짜)를 넘으면 429로 막고 게임은 원래 문장을 씁니다.
사건 생성(MODEL_CASE, Terra)은 2단계에서 붙입니다.
