# THE VERDICT — Approved Batch Release v2.9

Release scope: Character customization + 100-case editorial expansion + legal careers + focused court UI + fame simulation.

## Player-facing updates
- A single judge ID portrait is reused for creation, home, and court; customizable style, skin, hair, glasses, outfit.
- 100 original fictional cases contain distinct allegations, scene/context, legal positions, witness occupations and questions.
- Forensic scene/medical details for 17 death-related and 16 sexual-offence scenarios; record-specific contested evidence across all 100.
- New games accept four distinct random cases from the curated pack.
- Limited, persistent lawyer/judge/prosecutor pools scale with active caseload (0.6× / 1× / 2×; player judge counted).
- Eight fictional firms and a public-defense roster, with attorney experience, skill, firm tier, defense quality and client resources affecting case preparation.
- Professionals may transition from judge/prosecutor to attorney, change firms or take public-defense work without losing NPC identity.
- Case-linked fame and notoriety, news coverage, lawyer selection weighting and annual decay.
- Court page now has four clear screens: hearing/verdict, opposing positions, evidence/witnesses, and hearing history. Redundant long sections are collapsed or moved off the primary view.

## Checks completed
- New Javascript files syntax checks passed.
- 100 archetype IDs mapped to 100 editorial case dossiers; 33 detailed forensic entries.
- Four initial randomly selected cases and 3/4/8 initial judiciary roster verified in simulated integration.
- Attorney ability changed stored examination dialogue and judicial review grade without determining objective guilt.
- Court screen element retention and four-screen navigation checked with a mocked DOM; physically running mobile Safari/Chrome was not validated.
- New script references, CSS and service-worker asset list checked.

## Caveats
- Criminal charges and sentencing requests are fictional and not an individually peer-reviewed substitute for legal advice.
- Some dramatic dossiers still need human story QA; 100 data records do not mean 100 polished full-length television-style stories.
- Cloud sign-in and cross-device save synchronization remain unimplemented.
- Prior saves are not deliberately reset. Installed PWA may require refresh before its service worker activates.
- GitHub Pages deployment passing is distinct from real-world device validation.

## Rollback
Identify prior main SHA before merge and revert the release commit if needed; do not delete browser site storage or player saves.
