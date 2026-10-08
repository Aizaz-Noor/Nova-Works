# Historical event submission package — 7 October 2026

**Not submitted.** This page records the frozen event artifacts. Current post-event source, deployment and social video are documented in the root README; later portfolio commits include product changes.

Team: Code Nomads (Aizaz, Abdul Basit, Abdullah).
Repository: https://github.com/Aizaz-Noor/Nova-Works
Frozen tested product source: a17f503ce98dc9d9b266730a223baaaa095c8389. The event snapshot is preserved; separately authorized portfolio improvements were made after the event.

## Submit these artifacts

- Source repository, including root README/setup/environment/account instructions.
- Recorded demo: [NovaWorks-live-demo.mp4](hackathon/demo-video/NovaWorks-live-demo.mp4). Silent actual screen recording,42.96seconds. Shows login, complete official transcript processing through real TokenRouter, success3projects/12tasks, saved details and Ayesha's filtered view. Captured against a separate persistent recording database using the unchanged tested app; no fixture extraction or pre-seeded answer. Supplementary to the mandatory live demonstration.
- Local working demo http://127.0.0.1:3001/ with ten supplied accounts; all fictional passwordsDemo123!. Live hosted link: Not deployed.
- Self-test: TESTING.md. Presentation: Aizaz/DEMO_PLAN.md. Deployment packaging: Dockerfile/.dockerignore/DEPLOYMENT.md.
- Verification: hackathon/reports/final-mvp-verification-20261007.md. Backend13testsPASS; actual original/modified TokenRouter acceptancePASS; browser real creation/roles and restart persistencePASS; missing-information input422savesnothing.

An archive of the final repository can be handed over without node_modules, private.env, database files or credentials. Generated local database is not required in source; use the setup/seeder and a private provider key.

## Short presentation

“NovaWorks turns final meeting decisions into saved delivery work. The administrator pastes the full transcript; a live model identifies projects and assignments using the supplied team. Our server checks roles, dates and effort estimates, then saves the whole batch together. The final meeting creates three projects and twelve tasks. Ayesha sees her project, and Ali sees his own three tasks. Records and sessions survive restart. We prepared Docker deployment; this submission uses a verified local demo.”

Point to UrbanCart20October/integration19October, QuickServeintegration10hours and HelpDeskProevaluationMaryam. If showing the video, explicitly call it a recording. If identical transcript is replayed, disclose duplicate prevention; deliberately reset generated demo work before a fresh live conversion when needed.

## Status and limitations

Prepared, not submitted: organizer submission channel/access/confirmation has not been supplied. No hosted deployment or database bonus claimed. Docker image/container verification NOTRUN (Docker unavailable). The public fictional passwords suit the hackathon demo; do not use them for real company data. Rotate the key exposed in chat before deploying and set the replacement privately on the backend/host.
