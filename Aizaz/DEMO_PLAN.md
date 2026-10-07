# NovaWorks demo and pitch

Presenter: Aizaz. Backend/validation questions: Abdullah; AI integration support: Abdul Basit, with Aizaz confirming only verified contributions. Official presentation duration is unknown: the following is a **two-minute rehearsal default**, not an organizer rule. Allow live provider latency in addition to narration.

## Opening, 15 seconds

“NovaWorks has three client projects discussed in one meeting. The administrator must turn final decisions into assignments without carrying forward rejected features or earlier estimates. Our CRM converts the complete transcript into saved projects and tasks, then shows each manager and developer only their own work.”

## Exact demo

Before presenting, run the app at **http://127.0.0.1:3001/**, confirm the private provider configuration and internet connection, and open `backend/docs/meeting-transcript.txt`. Have the normal app open, not `/?preview=1`. Follow TESTING.md to deliberately clear generated work only if a fresh conversion is needed. The seeded users are permitted demo data; the generated answer is not seeded.

| Approximate narration time | Action and narration | Expected result |
| --- | --- | --- |
| 0:15–0:30 | Sign in as `admin@novaworks.example`, password `Demo123!`. Show the read-only directory briefly. | Ten supplied users; administrator controls. |
| 0:30–0:45 | Return to Projects, choose Create from Transcript, paste the complete official file, choose Process and Save once. “The provider receives this transcript and the safe team directory, without passwords.” | Processing state; submit disabled while working. |
| Provider wait | “The model extracts final decisions. Our server validates users, roles, dates and positive hours before saving the whole batch together.” | A genuine API response, validated and committed; three projects/twelve tasks. |
| 0:45–1:10 | Open UrbanCart. Point to project deadline 20 October and integration task 19 October. Show QuickServe's final ten-hour integration estimate or HelpDeskPro evaluation owner Maryam. | Earlier suggestions are replaced by final decisions. |
| 1:10–1:35 | Log out; sign in as Ayesha. Then, if time allows, log out and sign in as Ali. | Ayesha sees only UrbanCart; Ali sees three own tasks, not other agents' tasks. |
| 1:35–1:40 | Briefly explain saved SQLite records and server-enforced access. | Records survive refresh; role checks are enforced in API requests. |
| 1:40–2:00 | Closing below. | Clear practical value and honest limitations. |

A fresh conversion uses roughly seven clicks before inspecting a project, plus typing/pasting and provider latency. Role changes add logout, sign-in, and credential entry. Prefer one role switch when the official time is short. Rehearse and time this exact path locally; this written script is **prepared, not a completed timed rehearsal**.

## Closing, 20 seconds

“NovaWorks connects meeting decisions to useful work: named projects, assigned tasks, deadlines and effort estimates, saved immediately and filtered by each account. The core is a live model followed by deterministic validation and an atomic database save. This is a focused local MVP; we prepared Docker packaging, while hosted deployment and broader operational hardening remain outside this demo.”

## Mechanism and applicability

Administrator → full transcript plus safe seeded directory → TokenRouter `deepseek/deepseek-v4-flash-0731` extraction → parse and validate complete draft → transaction saves project/task relationships → authorized project and task screens → manager coordinates assigned project; developer reads own next tasks. This method handles conversational corrections while deterministic rules reject missing or invalid required fields. It is applicable to a small delivery team that already has known staff and wants meeting handoff into a CRM; no unmeasured time savings or accuracy percentage is claimed.

## Recovery and limitations

- If AI is unavailable, say: “The request failed; no new batch was saved. We can correct or retry the input.” Show the visible error. Do not replace this with a canned live result.
- If the transcript was already processed, say: “This is the persisted result of the earlier request. The app avoids duplicating an identical meeting.” Reset deliberately before a fresh rehearsal, not during an uncertain live demo.
- If the browser refreshes, use saved records. If the server stops, restart using TESTING.md; show unchanged persisted work.
- Keep an actual screen recording of login → live conversion → created details → role view. Label playback as a recording. It supports the local-database submission requirement and is supplementary to the mandatory live demo; recording and submission are **not yet claimed complete**.
- Internet and provider credits are required for new extraction. Model variability and ambiguity remain; invalid drafts save nothing and require correction. SQLite is a simple local/single-server persistence choice. Docker packaging has not been executed here, and no hosted link is claimed.

## Likely judge questions

**Is the result hardcoded?** No. Genuine original and modified transcript provider tests passed; modified QuickServe final hours/date changed accordingly. Directory and demo credentials are seeded as permitted.

**What happens when AI gets something wrong?** Full validation precedes any save. Unknown users, wrong assignment roles, invalid dates or nonpositive hours reject the batch; transaction failures roll back. Semantic correctness beyond these checks still depends on the model and user input.

**Can developers fetch another person's tasks directly?** The server derives identity from its session and filters or denies requests; API role/access tests are part of the verified backend suite.

**Why this model?** It is the lead-selected lower-cost TokenRouter option, and it passed the two actual transcript acceptance cases. We do not claim a measured price advantage or comprehensive accuracy benchmark.

**What is distinctive?** The working combination of final-decision extraction, seeded identity references, all-or-nothing validation/save, and useful role-specific delivery views. We do not claim a novel research algorithm.

**Is it deployed?** A local demo is working. The lead selected Docker preparation only; no hosted deployment is claimed, and Docker runtime testing is not available on this machine.

**What did the team build?** The frontend, backend, integration and runtime extraction during the official window. Existing preparation tooling and design skills were supporting infrastructure; disclose their provenance if requested. Do not claim organizers approved other unconfirmed resources.
