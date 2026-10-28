# Compact ERP shell acceptance

22 October2026; isolated codex/erp-notifications checkout. Original human-testing candidate is untouched.

Company workspace uses one operating canvas, current-company selector and role badge. Company tools, account security and notifications remain native disclosures. Desktop uses permission-filtered module navigation; widths600px and below use a labeled native module selector. Existing demo/preview retains its rail. Focusable outer h1 remains available to assistive technology; visible company/module headings establish hierarchy.

Actual `npm.cmd run build --prefix app/client`: exit0,54 modules,2.87s.
Actual `node scripts/verify-erp-shell-browser.mjs`: PASS,exit0. Actual Edge login, all10 owner modules, current-page state, security disclosure, second-company creation, tools collapse, scoped company switching and original preview rail verified. Six widths320/390/768/1024/1280/1440 had no document overflow or page errors. Evidence: tmp/erp-shell-browser-SFHalT/results.json and screenshots. Report heading top was414.7px desktop,515.7px768,668.7px mobile in900px viewport. Mobile screenshots visually inspected. This is scoped browser evidence, not whole-app accessibility or real iPhone acceptance.

Initial browser failure reproduced native details remaining open after second-company creation. Replaced derived open prop with explicit disclosure state synchronized on company changes; rerun above passed. No backend/source business-rule changes in this shell milestone.
