# NovaWorks — meeting decisions into assigned work

A hackathon MVP and continuing portfolio project by Code Nomads.

We built NovaWorks for the Infinity Hack ’26 AI Project Manager challenge on 7 October 2026. The challenge asked for a small CRM in which an administrator pastes a meeting transcript, AI creates projects and tasks, and employees see only work permitted by their roles.

**Outcome:** we missed the submission window and did not win. Working code and prepared artifacts are not an on-time competition submission. This case study describes what we verified, what we learned, and the separately authorized work after the event.

## The problem and focused flow

A meeting can mix initial suggestions, rejected features and final corrections. Copying every statement into tasks would produce the wrong plan. NovaWorks takes the complete transcript and known team directory, extracts the final decisions, validates every required reference and field, then saves the complete batch in one transaction.

Administrator → full meeting transcript → actual server-side model extraction → deterministic validation → persistent projects and tasks → manager project view or developer's own task view → useful delivery handoff.

The MVP includes seeded demo login/logout, a read-only ten-person directory, multiple projects, project details and assigned task rows. It intentionally omits signup, billing, progress dashboards and other unrelated features.

## Event implementation and evidence

The frozen event product source is commit **a17f503ce98dc9d9b266730a223baaaa095c8389**. Later documentation and video artifacts do not turn later product enhancements into competition work.

| Capability | Recorded event evidence |
| --- | --- |
| Real extraction | Genuine TokenRouter requests using deepseek/deepseek-v4-flash-0731 passed original transcript acceptance: three projects and twelve tasks, with final correction fields matching the reference. |
| Changed input | A consistently modified QuickServe integration decision changed its estimate to twelve hours and deadline to 23 October; the other checked fields stayed unchanged. |
| Saved useful output | An actual browser conversion saved the live result to SQLite and displayed project/task details. |
| Role enforcement | Backend session/access tests passed; browser Ayesha saw only UrbanCart, and Ali saw his three assigned tasks. |
| Persistence | Browser restart verification preserved saved records and Ali's session. |
| Failure behavior | An unseen incomplete UnknownShop request returned validation failure while the saved project count remained three. |
| Regression checks | Thirteen backend tests passed; frontend production build passed. These are bounded checks, not a comprehensive reliability or accuracy benchmark. |
| Demonstration artifact | A 42.96-second recording captured actual provider conversion and manager filtering. A recording is not a hosted deployment or submission confirmation. |

See TESTING.md and the verification report for the exact commands and checks. The supplied employee identities are permitted demo seeds; generated project/task answers are not a canned fallback. Passwords and the provider key remain outside model input and public source.

## Architecture and database decision

React/Vite and plain CSS provide the web interface; Node.js/Express handles sessions, access control and conversion. TokenRouter supplies model extraction, followed by application validation and an atomic SQLite transaction.

SQLite matched a three-hour local MVP: the official challenge allowed a local database, and the incoming backend already used it. It preserves the relational links between users, projects and tasks without adding database hosting or a migration to the critical path. This was a scope and integration decision, not a claim that SQLite fits every deployment.

For a future hosted version, PostgreSQL through a service such as Supabase could retain those relational concepts, with an explicit migration and regression testing. A Firestore implementation would introduce a document data model and require reworking data access, relationships and the atomic-save workflow. Neither migration was needed to satisfy the local hackathon flow; neither is claimed implemented here.

## Team ownership

Aizaz led product/UI work and final integration. Abdullah delivered the backend branch that was reviewed and integrated. Abdul Basit Shahid was assigned backend/AI support; this case study does not attribute an unverified implementation to him. Team members can expand the contribution record with their specific reviewed commits.

## What we learned

Our delivery plan needed a stronger submission buffer. An end-to-end thin slice should integrate earlier, followed by the actual provider request, so API contracts and deployment assumptions are exposed while there is time to fix them. Recording, README checks and submission steps need their own owner and reserved time, rather than being treated as the work after coding is complete. These are lessons from our missed delivery, not claims of winning or successful submission.

## Separate post-event portfolio work

On 8 October, the lead authorized portfolio enhancement and prioritized deployment. Those changes must be recorded in subsequent commits and verified separately from the frozen event source. At this document handoff, enhancements and hosted deployment are **pending**, and no public live URL is claimed. Docker packaging was prepared during the event; Docker runtime and hosted HTTPS checks were not performed then.

Before describing a public deployment as working, verify its startup, persistent storage, HTTPS/session behavior, live conversion, access restrictions and failure recovery. Rotate the key previously exposed in chat before using it for deployment. Demo credentials and local tests do not establish business production readiness.

Repository: [Nova-Works](https://github.com/Aizaz-Noor/Nova-Works). This is a candid portfolio case study, not a winner announcement or a production-ready claim.
