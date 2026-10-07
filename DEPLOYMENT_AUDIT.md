# Deployment audit - 8 October 2026

Scope: actual hosted startup, authentication, database integration, meeting creation, saved work, authorization, core browser states and responsive layout. Original event source/history and local databases were preserved. Post-event improvements do not establish an on-time hackathon submission.

## Findings resolved

- P0: public API failed SELF_SIGNED_CERT_IN_CHAIN. Bundled the official public Supabase Root2021CA; verified real connection without CA environment variables. TLS verification stays enabled.
- P0: incorrect manually configured origin blocked production with403. Allow exact assigned Vercel domains from system environment variables; unrelated domains still403.
- P0: login returned200without a cookie. Adapter now trusts Vercel HTTPS ingress so HttpOnly/Secure session cookies are emitted and reused.
- P1: delayed asynchronous quota permitted duplicate same-process AI calls. Claim in-flight hash before awaiting quota and release on every failure; HTTP regression confirms one provider call.
- P1: CRLF/LF versions bypassed transcript deduplication. Normalize line endings and recognize legacy saved hashes. Regression tests one provider call and one batch; browser replay verified. Removed only our duplicate test-created batch and retained original3projects12tasks plus replay markers.
- P2: blank task descriptions accepted despite challenge fields. Validate missing/blank/oversized task descriptions as422.
- P2: stalled requests could leave startup/login pending forever. Normal requests15s; AI120s; caller abort preserved. Timeout explains uncertain save and safe replay. Five targeted API checks and mocked browser recovery passed.
- P2: long imported words widened narrow layouts. Wrap identifiers; mocked300-character inputs and actual375px project/detail layouts did not overflow.

## Evidence

- npm.cmd run test:all --prefix backend: exit0,25/25PASS.
- npm.cmd run test:postgres --prefix backend: exit0, realPostgres seed/RBAC/atomicrollback/concurrentdedupe/sessionreopen/quota/private-schemaPASS; fixture extraction, no AI claim.
- npm.cmd run build: exit0,27modules; clean dependencies, no audit findings in frontend install.
- node backend/scripts/verify-deployed.js: exit0 on https://nova-works-zeta.vercel.app. Live model created3projects12tasks; reference comparison verified exact final names/owners/dates/hours. Replay, persistence, manager/agentdirect restrictions and logoutPASS. Repeat run reused existing batch.
- Actual browser: sign-in and refresh preserved session; three projects rendered; UrbanCart showed4tasks/final19Octoberintegration; sample replay reported existing3/12; no alert;375px scrollWidth375.

## Limits

Cross-instance requests may each invoke AI before transactional save deduplicates the result; saved batches remain unique and the persistent global quota bounds calls. The audit covers observed product behavior and tested failure paths, not every possible input or full accessibility conformance. Previously shared credentials should be rotated privately. LinkedIn text remains a draft; no social post published.
