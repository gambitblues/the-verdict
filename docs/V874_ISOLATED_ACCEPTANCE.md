# v8.7.4 isolated acceptance — P0/P4/P5, NPC/news, AI

This is a **release gate**, not a claim that the production world was exercised.
Branch: `develop`. Do not deploy `main`, write production saves, or run migrations against production.

## Completed in CI
- Worker regression: shared court access, sealed testimony, evidence rulings, deliberation readiness, panel voting / NPC fallback / re-vote.
- P4 focused QA: PGlite migration tests and **mocked** two-judge browser UI.
- Browser smoke: `tests/long-career.mjs 40` executes 40 **simulated private-career years**. It checks ages, death dates, party eligibility, family links, legal careers, saved-game decoding, and old case rendering. It is **not** a shared-world server history test or an audit of every news article.
- First-ballot closure now has a Worker route regression: both judges lose `canAct` while the completed case record remains readable and votes remain possible.

## Required isolated QA setup (not available to the GitHub code-writing connector)
1. A **new** Supabase QA project (Postgres 15+) with no real user data. Set up the existing schema migrations **in filename order**, `001` through `034` as present; do not omit `032_request_role_claims`, `033_open_hearing_survives_shared_day`, or `034_joint_panel_rules`. Never execute them against the live project. `cd server/supabase && npm ci && npm test` runs isolated PGlite checks, not remote migration installation.
2. In that QA project, create **two fresh invited TEST accounts**, with names beginning `TEST`, separate email/password, and no saves, backups or AI usage. Enable password sign-in; keep signups invitation-only. Populate QA seed cases with sealed truth branches and registered public NPC ids; verify one case of each criminal/civil/decision kind and enough hearing/order records for the minimum-hearing rule.
3. An independent Cloudflare QA Worker URL using the QA Supabase URL, QA anon key, QA-only service-role secret, and an independently scoped OpenAI key/budget. Configure `ALLOWED_EMAILS` for only these QA users, `ALLOWED_ORIGINS` for the isolated QA origin, valid priced `MODEL_TALK` and `MODEL_CASE`, and strict QA AI budgets. In QA only, enable `P4_SHARED_DOCKET_ENABLED`, `P4_COURT_ACTIONS_ENABLED`, `P4_TRIAL_PARITY_ENABLED`, `P4_JUDGMENTS_ENABLED`, `P5_JOINT_PANEL_ENABLED` (and any prerequisite UI flags). Keep production feature flags at 0.
4. Run `cd server/live && npm install && npx playwright install chromium`. Point `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `VERDICT_API` to **QA** and run `node live-e2e.mjs` with fresh TEST credentials entered locally (never into the repository or chat). This script tests login, saves, live AI rewrite, and a **solo** court case; it is **not** by itself a P5 shared-panel E2E.
5. Separately perform an **actual two-account shared bench E2E** in two fresh browser profiles: assignment → one chair opens hearings → both see identical published records → both ask permitted questions/orders → order result only in next hearing → evidence ruling → first vote closes the record → peer vote → NPC opinion / fallback → optionally reopen / abstain / substitute → chair finalizes actual majority → next shared day publishes exactly one public judgment/news event. Verify different JWT users cannot see or change sealed truth or the other account's saves. Record screenshots, timestamped request/response *metadata only*, and PASS/FAIL per stage. Never reuse live user slots.
6. Run shared-world **2–3 game years** in QA after the initial E2E, verifying public events are immutable and chronological, NPC alive/dead/career changes are consistent across both accounts, post-judgment news is neither premature nor duplicated, and repeated logins/catch-up do not shift another judge's hearing. Also run the private-world `tests/long-career.mjs 40` CI smoke (already present) as a separate check. Do not infer shared continuity from the private test.
7. AI quality/cost: call actual configured models for at least one witness answer, opening/closing exchange, article and judgment rewrite, with `ai_usage` verification of model, input/output tokens, cost, refusal reason, second verification pass, same-facts checks, and original-text fallback when the model fails or exceeds budget. Compare narrative to the *disclosed* court record; do not send secret truth branches or witness latent attitudes.

## Acceptance classification
- **PASS** = executed on the specified target, with log/run ID and outcome.
- **FAIL** = an executed assertion failed, with exact case/event/request and mitigation.
- **NOT RUN** = credentials, isolated database, Worker, or actual live calls are missing. Mock tests never count as live E2E.
- Production/main deployment stays **NO-GO** until actual two-account E2E, AI billing checks, and 2–3-year shared continuity complete.

## Remaining engine parity limitation
The Worker calls the same `VerdictTrialCore.skill/evaluate`, minimum-hearing policy and opponent-motion rules, but the shared scoring projection does not yet reproduce persistent NPC temperament/relationships or private media-life feedback. Do not label these 100% identical just because numeric core tests pass.
