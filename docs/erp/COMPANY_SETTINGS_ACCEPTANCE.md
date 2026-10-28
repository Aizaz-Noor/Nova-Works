# Company settings local acceptance

Company preferences are isolated by selected company and forced PostgreSQL RLS. Members may read; Owner/Admin may update only with the current version and permitted subscription write access. Concurrent initialization is serialized. Updates append audit events, accept only supported fields and validate legal name, supported business currency, canonical locale and timezone.

Direct new quotes load the saved currency before editing; deals retain their agreed currency. New invoice drafts snapshot configured legal name, falling back to organization name when settings are absent. Existing invoice and correction snapshots remain intact. Locale/timezone format the settings saved timestamp; this is not application-wide localization. Explicit UTC business date and usage rules remain unchanged.

## Evidence

Final full backend suite105/105 PASS exit0; client build44modules PASS exit0.

- Focused settings/invoice tests:5/5 PASS exit0, including name-change snapshot regression.
- Restricted local PostgreSQL verifier `node scripts/verify-settings-postgres.mjs`: PASS exit0, concurrent first writes admit one writer, member update and foreign-company access denied, no-context RLS returns zero, DELETE denied42501.
- `node scripts/verify-settings-upgrade-postgres.mjs`: PASS exit0, nonbypass migration role preserves19 populated prior tables and002-012 checksums; forced RLS and repeat migration verified.
- `node scripts/verify-settings-restore.mjs data/settings-development.sqlite`: PASS exit0, fresh32-table digest match/integrity/foreign keys. Settings and audit populated; finance/delivery empty in this fixture.
- Edge browser verifier exercises save,409 retained draft/current-version recovery, persisted refresh and newquotePKR default at1366/768/375/320. Final rerun8viewportchecks PASS exit0/nooverflow/no pageerrors.

## Remaining plan requirements

Configurable invoice numbering, company address/tax identity and broader issuer defaults, application-wide locale/timezone consumers, security/recovery/MFA, integration administration and data lifecycle controls remain separate unfinished requirements. No commercial readiness or full ERP completion claim. No deployment/push/provider call.
