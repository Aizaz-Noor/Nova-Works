# Post-event frontend improvement - 8 October 2026

Base b09b92c. Authorized portfolio improvement; missed event submission remains unchanged.

Implemented: compact project ledger with owners/deadlines; charcoal-green role navigation and warm content canvas; balanced login with fill-only demo role choices; project search/name/deadline order; task search/authorized-assignee/deadline order; directory search/role filter; truthful shown/total counts, clear filters and no-result recovery. No backend/API/environment/dependency changes.

Verification:
- npm.cmd run build: exit 0, Vite 28 modules, 1.61 seconds.
- npm.cmd run test:all --prefix backend: exit 0, 25/25 PASS.
- git diff --check: exit 0.
- Actual browser on local port 3007 with configured Supabase backend: fresh administrator login PASS; AYESHA project search 2/5 correct projects; unmatched query recovery PASS; Ali task filter 3/4 correct assignments; manager directory filter 3/10 correct people.
- Actual sample transcript replay: existing 3 projects/12 tasks reused, no duplicate records; five total existing projects preserved.
- Rendered desktop screenshot inspected; real mobile 375px and 720px reflow no document overflow; labeled controls and visible keyboard focus inspected.
- Specialist preview/mock checks: project/task/directory controls, fill-only login, manager/agent scoped arrays, input preservation after 422, 401 session reset, 1440/768/375px layout PASS. Mock checks are not live backend evidence.

Limits: no claim of complete WCAG conformance; 720px check approximates a 1440px viewport at 200% zoom, not a native browser zoom audit. New controls operate only on arrays already authorized by the server. UI counters describe visible results, not progress. Original AI creation is unchanged; regression tests cover its contract and public acceptance reuses the saved official sample.
Release acceptance: source17fa278 deployed READY in Vercel production (dpl_3ZKCN5n4JP83EcfkzjcnF7fgzPZ5). Public verifier exit0 PASS health/login/directory/sample replay/persistence/role restrictions/direct access/logout. Actual public browser search UrbanCart returned1/5correctproject; fresh Ali login opened My tasks with5ownassignments andnoother-assignee selector. No paid AI call needed for saved sample replay.
