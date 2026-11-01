# Advanced Case Engine — foundation v1

This module is **experimental** and does not replace the currently running trial core. Its purpose is to prove the invariant case-truth architecture while old cases and saves remain unchanged.

- `advanced_case_engine.js`: deterministic selection among authored `did/didnt/reason` variants, serialization of immutable authoring facts into `lock`, append-only court proceeding events, and conservative proposition-based conflict classification.
- `tests/advanced-case-engine.test.cjs`: checks deterministic creation, stable locked facts across submissions and save/load, and distinguishes same-event contradictions from different times or legal propositions.
- The source material is fictionalized. `events` are hidden world-state facts; `evidence` are original artifacts, and `witnesses[].observedEventIds` restrict actual observation scope.
- Conflict detection **never decides guilt, consent, credibility or legal conclusions**. A hallway CCTV showing walking does not determine legal capacity or consent.
- Later steps: author a real (fictionalized) pilot case using the same contract; build a compatibility adapter for existing UI; add evidence submission rules, complex witnesses, event clock offsets and dynamic hearings. Only after tests should the engine be enabled in ordinary play.
- Korean legal statutes, offenses and sentencing ranges are authored/verified case metadata rather than automatically judged by this engine.

Run: `node tests/advanced-case-engine.test.cjs`.
