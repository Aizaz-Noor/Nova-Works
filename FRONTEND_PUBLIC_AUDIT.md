# Frontend public-demo audit

Date: 8 October 2026. Owner: frontend specialist. Authorized scope: app/client/src/** and this report. Working source base supplied by integration owner: eabe5e2, feature/public-demo-readiness.

Result: repaired the reproduced frontend failures below while preserving the delivery-ledger visual direction, session API, server authorization contract, transcript processing, duplicate replay and existing filter scope. No backend, API deployment, package, credential, database or paid-model changes were made. No commits were made.

## Findings and repairs

| ID / severity | Location | Before / impact / reproduction | Repair | Verification |
| --- | --- | --- | --- | --- |
| F01 / P1 resilience | App.jsx, loadSample | Intercept sample-meeting.txt without responding; click Load sample meeting. At 16 seconds the button still said Loading sample and the transcript field remained disabled. This direct fetch did not use the API adapter's deadline. | Independent 15-second abort deadline with readable sample-specific error; timer cleanup; restore paste and retry. Session/unmount abort remains silent. | Actual stalled fetch recovered after 15 seconds; error visible, textarea and Load sample enabled. PASS. |
| F02 / P1 resilience | WorkLists.jsx date display; new formatDate.js | A success response containing deadline "not-a-date" raised "Invalid time value" and crashed the work list. Synthetic inconsistent data, not a claim that current production records are malformed. | Share a strict calendar-date formatter with project detail. Invalid/missing values show Date unavailable / Not set; valid date-only values render in UTC so viewer timezone cannot move the day. | Invalid text, impossible 30 February, number and null handled; valid date and timestamp remained 20 Oct 2026 across UTC, Pacific/Auckland and America/Los_Angeles. Browser emitted no error. PASS. |
| F03 / P1 reflow | styles.css, directory grid/person and signed-in identity | At a 375px viewport, one synthetic directory row with 500-character unbroken name and specialization widened the document to 8158px. | Zero-minimum grid tracks; shrinkable text containers; wrap external directory and identity text. Existing project/task wrapping retained. | Directory plus 500-character signed-in identity: document width 375px. Project/client 500-character strings also width 375px. PASS. |
| F04 / P1 accessibility | WorkLists.jsx, clear handlers/search refs | Type a nonmatching search; keyboard Enter on the no-results Clear filters button. Focus moved to BODY when the button disappeared. | Keep search-input refs and return focus there before clearing filters. | Keyboard Enter in project, task and directory clear states returns to the corresponding search field; expected rows/counts restored. PASS. |
| F05 / P1 accessibility | App.jsx, Login/ErrorNotice/transcript input | Invalid login displayed an alert, but email had no aria-describedby or aria-invalid. Transcript validation likewise had no input association. | Stable error IDs, conditional described-by relationships and invalid state only for credential or input-validation errors. Added explicit login progress live region and busy form state; disabled editable credentials while login is pending. | Credential 401 associates both fields to login-error, invalid=true; fields reenable for retry. Transcript 422 associates transcript-error, invalid=true and preserves text. Pending login has live Signing in text and aria-busy=true, resetting after response. PASS. |
| F06 / P1 recovery | App.jsx, non-project creation feedback | Source finding: a late creation failure updated createError, which was rendered only inside the Projects composer. Navigating to another view during processing could hide the failure. | While away, announce processing; show the actual failure and Return to transcript recovery. Preserve the entire input and existing records. | Start creation, navigate to directory, receive 422: visible failure and recovery button; returning restores exact input. Subsequent replay reports existing three projects/twelve tasks rather than claiming new records. PASS. |
| F07 / P2 state clarity | WorkLists.jsx, DirectoryList | Source finding: an empty users array with no filters used No matching people and Clear filters, implying a search caused the absence. | Distinct truthful empty-directory explanation; filtered no-results behavior unchanged. | users=[] displays No team members available; normal ten-person directory, six-agent filter and genuine no-results still work. PASS. |

Additional hardening within the same flows:
- Discard obsolete session/read callbacks when their controller is aborted; cleanup aborts in-flight creation and sample work on unmount.
- Focus the signed-in heading after identity/checking changes, and the transcript input when its composer opens.
- Respect prefers-reduced-motion explicitly; no decorative motion was introduced.
- Directory skill search handles both an array and a single string without spreading a string into separate characters.
- No broad component rewrite was necessary to repair these findings. The shared date formatter removes the actual inconsistent rendering path; App remains structurally compatible with the existing release.

## Executed checks

Commands used from the assigned clone:
- npm.cmd run dev --prefix app/client -- --port 5176
- npm.cmd run build --prefix app/client
- PowerShell inline Node harnesses importing the already installed E:/Projects/Hackathon/hackathon/tools/node_modules/playwright, launching installed Edge with channel: msedge; API responses explicitly mocked. No browser/package installation.
- Inline Node assertions importing app/client/src/formatDate.js.

Final production build: exit 0; Vite 6.4.3, 29 modules, built in 1.24 seconds. JS 224.17 kB / gzip 69.49 kB; CSS 23.79 kB / gzip 5.10 kB.

Browser suite: exit 0, with these observed checks:
1. Keyboard Enter opens a project; focus reaches H1.
2. No-results Clear filters restores focus and available rows in all three lists.
3. Task assignee filtering and directory role filtering preserve truthful counts.
4. Every visible input/select/textarea in examined views has a persistent native label.
5. Reduced-motion context has no transitions in examined navigation.
6. 1440px, 768px and 375px directory views: no document overflow; no JavaScript errors.
7. Pending login disables credential edits; credential error associations and retry work.
8. Opening composer focuses transcript; loading official static sample does not submit/create anything.
9. 422 preserves the exact full transcript; error association and retry work.
10. Navigating while creation fails exposes the failure and return action.
11. Replay shows existing counts and the three-project ledger.
12. A slow obsolete project response cannot replace the current directory view.
13. Genuine empty directory is distinguished from no search matches.
14. Session 401 removes project/directory data and returns to login.
15. Malformed date does not crash; long imported project/client strings remain within phone width.
16. Actual 15-second sample timeout recovers paste and retry.
17. Long directory and signed-in identity do not widen the phone document.
18. Login live progress and busy state reset after response.

Exact harness output:
- PASS keyboard Enter/focus recovery in3lists; task/directory filters+counts; labeled controls; reduced-motion;1440/768/375 no overflow/no JS errors.
- PASS login pending snapshot+error association+retry.
- PASS sample no save; composer focus;422 text preserved+associated; async navigation failure visible+return; replay; slow obsolete response ignored; true empty directory;401 clears data.
- PASS malformed calendar date+long imported500char name/client no crash/no overflow.
- PASS actual15s sample timeout unlocks paste/retry.
- ALL frontend audit checks PASS; all backend responses mocked; no model calls/saved records.
- PASS calendar-date timezone and malformed/missing-value checks.
- PASS long directory AND signed-in500char identity:375px document matches viewport.
- PASS accessible login progress and busy reset.

Temporary rendered evidence captured: public-audit-directory-1440.png, public-audit-directory-768.png, public-audit-directory-375.png; desktop and phone images were visually inspected in the local Windows temporary directory. These are local audit evidence, not published portfolio assets.

## Limits and integration handoff

This is bounded frontend evidence, not proof of the deployed backend or actual AI extraction. Public live session/cookie/server permissions, deployed bundle, real database persistence, full organizer transcript output and recording remain integration-owner checks. No paid calls or production records were modified here. Browser keyboard/native-label/alert/reflow checks do not establish full accessibility conformance; human screen-reader coverage, full contrast scan and true browser 200% zoom were not run.

FRONTEND QA: PASS for the documented preview/mock and calendar-date cases. LIVE END-TO-END: NOT RUN by this specialist. No known P0 remains in the examined frontend flows. Root should run the real authorized core flow and recording after integration. Own local Vite was stopped with Ctrl+C (session exited 1); port 5176 had no listener on verification.