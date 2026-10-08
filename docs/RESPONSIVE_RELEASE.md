# Adaptive workspace release

8 October 2026. Post-event portfolio redesign requested after a laptop screenshot showed oversized navigation, narrow content and tall project rows. The existing meeting-to-work scope and server permissions are preserved.

## Design decisions and implementation

- Full-width application shell replaces the centered 1480px frame and unused outer gutters.
- Quiet light sidebar is 216px on wide screens, 196px at intermediate laptop widths. At 1024px and below, an explicit Menu disclosure releases the full width for work.
- Menu has an accessible name, expanded state and controlled navigation region. Escape closes it and restores trigger focus; selecting a view or crossing the desktop breakpoint closes it.
- Project rows prioritize name/client, manager and deadline. The list uses a short scope preview; the full description remains in project details. Task descriptions and all required owner/date/hour fields remain visible.
- System typography uses Apple system fonts where available and familiar Windows/Linux fallbacks. Inputs remain at least16px on small screens, touch targets44px, zoom is enabled and safe-area insets are respected.
- One small140ms disclosure transition communicates opening navigation/transcript. Reduced Motion disables it. No extra animation library, downloaded Apple font or SF Symbol asset was added.

Apple reference principles: [adaptive layout](https://developer.apple.com/design/human-interface-guidelines/layout), [collapsible sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars?changes=_11) and [multiple split-view widths](https://developer.apple.com/design/human-interface-guidelines/split-views?changes=_6). Applied to the web stack; this is not a native SwiftUI app or an Apple certification. Fresh [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) were reviewed. The named Figma skills require a supplied design/native target; neither exists here, so no Figma translation is claimed. The existing extraction stack does not require a new agent framework.

## Repository cleanup

Removed the empty .gitkeep placeholder. Current deployment/testing guides are grouped under docs/, detailed findings under docs/audits/, and earlier submission/video/UI/unused Render evidence under docs/history/. Active Vercel configuration stays at the repository root. Optional Docker packaging, source, tests, lockfiles, canonical Aizaz controls and genuine event evidence remain. Git history was not rewritten; private databases and environment files were not deleted. Internal links were rebased and workspace-only preparation references labeled. The two identical transcript copies are intentional frontend/backend consumers.

## Checks

Backend regression: npm run test:all --prefix backend PASS39/39, exit0. Integrated npm run build PASS, exit0,29modules; CSS17.92kB/gzip4.24 and JS225.47kB/gzip69.94. Earlier CSS23.79kB was reduced while improving adaptation.

Specialist Edge rendered checks PASS at1920/1366/1280/1024/800/683/375/320px: no horizontal overflow, menu navigation/Escape, filter focus, input/error preservation and Reduced Motion. Preview data was explicitly labeled; these are layout/interaction checks, not real extraction evidence.

Root cross-engine real-flow, recording and cloud-release results are appended when observed. 683px is the layout-equivalent width for1366px at200% zoom, not a claim of actual OS/browser zoom testing. WebKit on Windows checks the browser engine; real macOS/iOS Safari hardware and VoiceOver remain unverified.

## New demo

The latest landscape/vertical exports and screenshots replace previous portfolio media at the same README links. Actual successful extraction, stored records and role views must be verified before publishing. Failed provider attempts are retained as local evidence and never represented as successful footage. The first new recording attempt returned502 and saved no batch; provider models authentication and public health then returned200 before one bounded retry.

Social drafts and storyboard are updated for the new adaptive interface. Videos remain captioned/silent unless explicitly stated otherwise. No social publication or official submission is performed.

## Observed integrated acceptance

- `node scripts/verify-responsive.mjs`: PASS, exit0. Actual Edge and WebKit sessions at1920/1440/1366/1280/1024/800/683/375/320px. Both engines: no horizontal overflow; compact Menu expanded state, Escape focus recovery and close on navigation; admin3projects, manager1project, agent3own tasks, UrbanCart4tasks, directory10people; filter-clear focus; Reduced Motion; zero uncaught JavaScript errors. The first harness run checked the directory before its response; fixed the wait and reran successfully. No product defect was hidden.
- AccessLint actual login and explicitly labeled preview workspace: no reported violations in the examined states. Not a full conformance claim.
- Actual new successful AI recording: HTTP201, replayed=false,3projects/12tasks; expected names, owners, deadlines and hours asserted; browserErrors=[]. No fixture extraction or preseeded project result. Provider wait12.833s retained. Raw successful take82.018s, final landscape and vertical88.08s. Both H.264/yuv420p exports fully decode (exit0); task and mobile frames visually reviewed.
- The 88-second videos are captioned and silent. Screenshot assets show this same repaired application. Real macOS/iPhone Safari hardware, VoiceOver and actual OS/browser200%zoom remain unverified; Windows WebKit and equivalent683px reflow are distinct evidence.

## Cloud publication

Pending the authorized push of this combined candidate. Final source and cloud checks are appended after the deployment is observed.