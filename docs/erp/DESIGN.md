# NovaWorks ERP design system — premium operating surfaces

22October2026. User explicitly approves a modern compact ERP with charts/diagrams, stronger typography/contrast/color and iOS-inspired polish. This extends prior post-event direction. Implement in isolated next candidate; keep human-testing3039 stable. The first implemented surface is Reports, not the entire ERP redesign.

## Overview

Audience:service-business owners, managers and assigned staff. Register:Operate. Prioritize company scope, accurate records, decisive primary actions and compact readable hierarchy. No fabricated growth/trend/AI output. iOS influence comes from coherent layers, restrained shapes, readable type and responsive controls; a browser ERP remains a browser ERP.

## Colors

Ink#182230; secondary#526174; surface#FFFFFF; canvas#F8F9FA; border#DCE3E9. Preserve NovaWorks green identity. Semantic chart palette:blue#2369B5 active/in-progress; green#176B57 done; amber#9A630C to-do; slate#596779 planned; gray#737C89 archived. Color always accompanies text/counts.

Calculated against white:ink16.03:1,secondary6.32:1,blue5.59:1,green6.41:1,amber5.04:1. Archived gray4.22:1 is used as a chart segment, not body text. These pairs do not establish whole-application conformance.

## Typography

One installed system family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif; no font download or unlicensed SF asset. Tabular numerals for data. Report title30px/26px mobile; section17px; body13–16px; metadata12px. Exact values wrap rather than truncate; bounded chart-center label falls back to Total for large counts while exact totals remain outside and in descriptions.

## Layout

Two-column report chart grid, one column<=700px;18px desktop/12px mobile gaps. Keep controls grouped with clear scope/filter/export states. Current outer ERP setup/navigation still needs the broader compact-shell redesign; do not imply that this report pass completes it.

## Elevation and shapes

White layers on quiet canvas;14–18px report panel corners,8–9px controls; light border and near-flat shadow. No decorative WebGL, background animation or multiple effects packages.44px interactive targets and existing visible keyboard focus.

## Components

- Status bars and task ring from actual scoped API counts, with labels, exact totals, semantic SVG description and Show values table toggle.
- Approved-time card preserves exact integer minutes and separates recorded time from estimates.
- Sales workflow diagram uses independent deal/quote/order record counts. Not a measured conversion funnel; no sums across stages/currencies.
- Notifications disclose task-comment updates on open/refresh, show read state in words, support pagination and acknowledgement. No polling or external-email claim.
- Empty/loading/error/read-only/permission/conflict states stay explicit. JSON export and currency separation remain intact.

## Do and do not

Do verify real browser/API/database flow, zero-data and huge-value boundaries, member scope, narrow reflow and keyboard alternatives. Do not invent date trends absent from the reporting API, render charts using a financial total converted through unsafe Number, or label status ratios as completed work. Do not delay actions for decorative animation; respect reduced motion if motion is introduced.

## Resource provenance

See UI_RESOURCE_REVIEW.md. Relevant Pro Max/Taste/Impeccable/Emil Apple-design source guidance informed this pass. Matching canonical repositories were verified, but the supplied lnkd.in redirect destinations could not be verified. No claim that all12 packages were installed/applied. Google DESIGN.md informed this document structure.

## Compact operating shell

Company workspaces use a single canvas and compact company selector; tools/security/notifications disclose on demand. Permission-filtered desktop module actions become a labeled native select at600px and below. Native disclosure state is tracked and reset when the company changes, preserving manual opening while keeping new-company onboarding compact. Original demo navigation remains separate. See COMPACT_SHELL_ACCEPTANCE.md for actual browser evidence and remaining limits.


## Compact working screens — 22 October2026

Team administration lives in Settings, leaving delivery focused on projects and tasks. Task discussions and member editors disclose on demand. Invoice summary shows status, customer, total, balance and PDF first; billing metadata, payment entry/history and corrections are secondary disclosures. Shared forms use44px controls,14px desktop/16px mobile input text,96px default textareas, consistent12/14/18px rhythm, white surfaces and readable disabled states. Mobile invoice rows use a fixed three-column table with wrapping exact amounts; rendering acceptance remains pending because browser URLpolicy rejected fresh navigation. Do not infer current visuals from prior screenshots.


## Professional company workspace — accepted 23 October2026

Implementation follows FRONTEND_REDESIGN_PLAN.md reviewed by Astra/high. A224px desktop company rail groups Workspace, Sales, Finance, Insights and Company. Below1024px use a labeled in-flow collapsible menu with hidden collapsed links, Escape/focus restoration and destination heading focus. Keep original demo UI separate. Overview becomes the initial company view, with authorized delivery/sales/invoice evidence fetched independently from current APIs. Preserve exact monetary and time arithmetic, per-section scope/UTC snapshot labels, unavailable vs zero distinctions and relevant navigation actions. System typography/greenidentity/44px controls and understated white operating surfaces remain; no invented time trends, newlibraries, paidfonts or decorativeeffects. Existingworkingmodules receivecoherent scopedstyles andretainallactions. Renderedacceptance stillBLOCKED by priorbrowserURLpolicy; source/API/staticDOM checks cannot substitute for actualappearance/interaction.
