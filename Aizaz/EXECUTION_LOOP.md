# Controlled execution loop

This file owns phase/gate behavior and the planning clock. `RUN_STATE.md` owns the current state. During PREPARATION all product gates are NOT STARTED. Do not create product code. The user-approved dry run is isolated and ends before build.

UNDERSTAND → CHALLENGE ASSUMPTIONS → CHOOSE SOLUTION → DEFINE MVP → DESIGN UX/UI → ARCHITECT → BUILD → RUN → TEST → RED TEAM → JUDGE → FIX → RETEST → RE-JUDGE → FEATURE FREEZE → PITCH.

## Time-aware defaults

| Elapsed time | Work and exit evidence |
| --- | --- |
| 00:00–00:20 | Understand the problem; challenge assumptions; Gate 1. |
| 00:20–00:35 | Compare solutions, define MVP, choose UX direction and smallest architecture; Gates 2–3; lead approves direction. |
| 00:35–01:35 | Build core product. Prove risky essential logic/dependencies in the first slice; aim for an integrated working flow by minute 90. Gate 4. |
| 01:35–02:05 | Complete critical intelligence/integration, correctness, useful output, and error handling. Essential feasibility must already have been checked. |
| 02:05–02:25 | QA and red team; Gate 5. |
| 02:25–02:40 | Judge review and highest-impact fix/retest/re-judge; Gates 6–7. |
| 02:40–03:00 | Feature freeze, final demo verification, submission preparation/authorized submission, pitch rehearsal; Gates 8–9. |

Record actual start, deadline, timezone, and freeze time. The orchestrator adjusts for actual time and observed state instead of restarting the sequence on resume. Preserve at least the final 20 minutes or a larger official submission buffer. Feature freeze at that time is the lead's standing instruction; an explicit lead change overrides it. A FAIL does not stop the clock. Resolve the specific missing evidence or reduce optional scope; do not repeatedly regenerate analysis. Do not claim a failed gate passed just to keep moving.

## Gate 1 — Problem clarity

Owner: Problem Framer. No code. Answer: actual primary user; concrete pain; symptoms versus hypothesized root cause; why it matters; success outcome and current/manual alternative. Identify secondary users, binding constraints, assumptions, and ambiguities. Challenge the shallow interpretation and propose reasonable directions.

End with `PROBLEM CLARITY GATE: PASS / FAIL`. PASS requires the five answers and a clear success example. Hypotheses must be labeled. A binding unresolved ambiguity yields FAIL and one precise question for the lead/organizer. Continue only independent preparation while it is pending.

## Gate 2 — Solution selection

Owner: Solution Architect with lead. Compare up to three reasonable approaches on problem fit, usefulness, total build/verification time, technical risk, demo strength, innovation, and real-world feasibility. Reuse the framer shortlist. Reject noncompliant approaches. Record thesis, reason, main tradeoff, and lead approval; no choice based solely on novelty.

## Gate 3 — MVP, UX, and architecture

Owners: Architect and UI Art Director. Specify USER → INPUT → PROCESSING → INTELLIGENCE/LOGIC → OUTPUT → USEFUL ACTION using a concrete input and expected output. Classify MUST/SHOULD/COULD and WHAT WE WILL NOT BUILD. Specify data flow, interfaces, owners, risky dependencies/fallbacks, and vertical milestones. Art Director fills `DESIGN_SYSTEM.md` with a deliberate product direction and core states; architecture confirms feasibility. No long design detour.

MVP GATE: PASS only when the essential flow fits build, QA, and submission time, requirements map to evidence, and direction is approved. Otherwise FAIL, simplify optional scope or request the consequential decision. Product coding starts only when Gates 1 and 3 PASS and the lead approves product direction.

## Gate 4 — First working build

Owner: Builder. IMPLEMENT → RUN → TEST → FIX → REPORT for each slice. A rough-looking complete flow must execute before substantial polish. Verify correct output, not just build success. If no working flow exists at midpoint, pause optional features and repair/shrink while preserving required behavior. Record tested revision, command, evidence, and restart path.

## Gate 5 — QA / red team

Owner: QA. Exercise startup, correct happy-path output, empty/malformed input, repeated action, network/API failure, refresh/navigation, target and mobile layouts, demo-safe data, and console where applicable. Mark N/A with reason for irrelevant checks. PASS means core demo actually ran, no P0 remains, and binding requirements have evidence. FAIL means observed blockers; UNVERIFIED means missing runtime evidence. Keep these distinct.

## Gate 6 — Judge review

Owner: Judge Simulator. Use the latest lead-confirmed organizer rubric. Until confirmed, cite the flyer 15/20/30/20/15 as planning weights; the supplied rulebook also names UI/UX and presentation/understanding qualitatively without weights. Do not invent those percentages. For each criterion show observed evidence, strength, weakness, missing evidence, risk, and a realistic improvement. Rank at most three useful fixes using impact versus implementation+verification time and regression risk. Do not invent points or a perfect score. A non-AI solution may satisfy all criteria. Reviews should usually take 3–5 minutes.

## Gate 7 — Bounded improvement

Orchestrator selects issue #1 from the shortlist. Builder fixes → QA retests changed behavior and core path → Judge re-evaluates the affected evidence. Keep a short budget and an owner. Repeat only for concrete material weaknesses. Exit when the core is reliable, no P0 remains, major judging gaps are addressed and remaining fixes have poor benefit/time; OR freeze is reached. Before freeze, preserve passing evidence rather than rerunning unrelated checks. After freeze, only a small necessary fix that leaves time for recheck and submission.

## Gate 8 — Feature freeze

Record YES and time/reason. No new major feature, framework, dependency, or architecture. The incomplete state also freezes. Prefer certainty over ambition: cut optional work, use legitimate labeled seed data, simplify backend, remove only unnecessary authentication, and provide transparent allowed fallbacks. A simulated capability never satisfies a required live capability.

## Gate 9 — Pitch and demo

Owner: Pitch Agent with lead. Use the official time limit; unknown duration means a labeled rehearsal default. Fill `DEMO_PLAN.md`, show value early, explain useful logic, real applicability, and limitations. Rehearse exact inputs/clicks and recovery. Verify required artifacts, links/access, attribution, and startup instructions. Submit only within lead authorization and record actual confirmation; prepared files are not a submitted entry.

## Official development hard stop

Supplied rulebook: coding starts only after official announcement and stops at the official end of the three-hour development period. Minute-160 freeze permits only approved essential fixes with verification time BEFORE that hard stop. At the hard stop stop all AI writers and code edits, submit as instructed, record the final revision and demonstrate it; no post-deadline recovery edits. A backup video is supplementary and cannot replace the mandatory live demo. Judges may try unseen inputs.
