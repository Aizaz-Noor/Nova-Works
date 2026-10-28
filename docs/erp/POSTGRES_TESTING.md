# Real PostgreSQL tenant isolation gate

SQLite isolation and policy-string checks do not prove PostgreSQL enforcement.
Run this opt-in test before accepting the foundation for a hosted pilot:

```powershell
# Supply a NEW disposable database, never the demo/production database.
# The admin connection requires CREATE SCHEMA and CREATE ROLE privileges.
$env:TEST_DATABASE_URL = '<private disposable PostgreSQL connection string>'
$env:TEST_DATABASE_ALLOW_CREATE = 'disposable-only'
node backend/scripts/verify-tenant-postgres.js
```

The script never reads `DATABASE_URL`. It refuses databases containing application
tables, then creates the identity schema, applies the versioned platform and AI
migrations, and creates a random NOLOGIN test role without superuser, BYPASSRLS,
CREATE, TRUNCATE or schema ownership. Its administrative connection uses
transaction-local `SET ROLE` so every application assertion executes under the
restricted role. Connection credentials and URLs are never printed.

Remote connections verify TLS certificates. Supply `TEST_DATABASE_CA_CERT` when
a private CA is required. Loopback PostgreSQL uses its connection-string TLS
configuration. No package installation or service provisioning is performed.

The test exercises actual registration, company creation, tenant-owned projects,
member discovery, scoped draft/file references and exports through the service.
It additionally bypasses service filters to verify raw PostgreSQL SELECT/UPDATE
isolation, rejected cross-company INSERT, composite foreign keys, fail-closed
missing organization/user settings, and transaction-local reset after successful
and failed transactions. A new service instance reads persisted records.

Exit 0 means these real PostgreSQL checks passed. Exit 2 means the opt-in settings
were missing and nothing ran. Exit 1 means refusal, setup failure or failed checks.
The disposable database and random test role are deliberately retained; review
them and remove the disposable database/role through normal administration. This
script does not destroy schemas, databases or roles.

This test complements `node --test backend/test/tenant-http.test.js`, which runs
real HTTP onboarding, invitation, RBAC, CSRF and restart persistence using SQLite.
The PostgreSQL script does not claim browser/UI coverage, production deployment,
or a database-server restart test. Production auth/session-table policies and
restricted runtime grants still need review for the actual hosting configuration.

Local feasibility check on 19 October 2026: `psql`, `postgres`, `initdb` and `docker`
were absent from PATH; the standard `C:\Program Files\PostgreSQL`,
`C:\Program Files (x86)\PostgreSQL`, `C:\msys64\mingw64\bin\postgres.exe`
and `C:\msys64\ucrt64\bin\postgres.exe` locations were absent. No live PostgreSQL
execution was possible in that environment without separately supplied tooling or
an explicitly disposable test connection.
