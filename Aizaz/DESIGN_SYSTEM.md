# NovaWorks CRM - Direction1 design handoff

7October2026. Approved direction; minimal design within required scope. DESIGN HANDOFF READY. RENDERED REVIEW NOT RUN. Source: official challenge minimum screens, original task-focused composition; no borrowed assets.

## Identity and audience

Meeting-to-work CRM for administrator, three managers and six developers. Desktop demo with narrow-screen usability. Calm, concrete, compact. No marketing hero or unrelated dashboard metrics.

## Hierarchy and interactions

Login: persistent email/password labels, sign-in button/error. Signed-in header: company, user name/role, logout; Projects, Team Directory, agent My Tasks navigation. Admin Projects: primary Create from Transcript reveals labeled full-width textarea; instruction to paste complete meeting; primary Process and Save; then saved project cards with name/client/manager/deadline. Detail: back, project identity/client/manager/deadline/description, authorized task rows with title/description/agent/deadline/hours. Agent defaults My Tasks, with related project links. Directory read-only names/specializations. No additional screens.

## States

Empty admin invites transcript; employee empty states explain no work assigned. Processing disables repeat action and announces progress. Preserve input after errors. Success counts/updated cards only after committed save. Validation error summary names unresolved fields; correct/retry. Provider/network error says no new records saved. Session expiry returns login; forbidden access explains denial with safe return path. Never show other users' tasks.

## Typography/colors

System-ui, Segoe UI, Arial; no downloaded font. Labels14px, body16px, section20px, main heading28px. Background#F5F7FA; surface#FFFFFF; text#17212B; muted#52606D; primary#174B43 with white text; accent#B7791F sparingly; border#CDD5DF; success#17633B; warning#805300; error#A12622; focus3px#245B91. Non-color text states. Contrast/render verification NOT RUN.

## Layout/components

Spacing4/8/12/16/24/32px; max page1120px; gutters24px desktop/16px mobile. Controls/cards6px radius; grouping borders, no shadows. Native semantic inputs/buttons/nav; project cards only for distinct projects; task rows not nested card piles. Text actions, no icon package. No animation/effects dependencies.

## Responsive/accessibility

Cards auto-fit min260px, single column below600px; task rows become stacked label/value blocks. Header/navigation wrap. Controls at least44px high; no horizontal document overflow. Persistent labels, keyboard completion, visible focus, error association, aria-live status; no color-only meaning. Verify375px/768px/desktop,200%zoom and keyboard error recovery when runnable. No claim of compliance before checks.

## Exclusions/resource decisions

Plain CSS/native foundation; zero visual effects sources, no fonts/icons/motion packages. No gradients/blobs/hero/metrics/charts/extra modules. Polishing follows complete working flow. Screen evidence goes under hackathon/screenshots. Final feature freeze12:40 and hard stop13:00 Asia/Karachi today.

## Frontend implementation7October

System name: NovaWorks ? Meeting to Execution. app/client implements the required operating screens with native React/CSS. Signature interaction: successful server-confirmed creation closes transcript area and reveals saved projects with a success notice, no decorative animation. Static review samples remain isolated behind ?preview=1 and visibly labeled; they cannot generate saved work. Production build PASS; rendered interface review PASS for examined preview states at1440/768/375 with no observed document overflow. Full live workflow and accessibility conformance NOT VERIFIED. Evidence: ../hackathon/reports/frontend-milestone-20261007.md.
