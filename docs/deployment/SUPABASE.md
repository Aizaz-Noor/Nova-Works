# Supabase PostgreSQL

NovaWorks can use PostgreSQL hosted by Supabase. The application connects from its server; browser clients do not connect directly to the database. Use the connection method appropriate for the hosting runtime and keep the connection string in a private server-side secret manager.

Before connecting an application, initialize the schema using the reviewed migrations and a schema-owner connection. Configure the application runtime with only the database permissions it needs. Enable and verify row-level security; application session and company-role checks remain required as well.

Keep TLS certificate and hostname verification enabled. Use only the CA certificate published by the selected Supabase project when a custom trust chain is required. Never expose a database URL, CA private material or migration credentials through frontend variables or committed environment files.

For a release, back up the database and rehearse restore into a separate database before applying schema changes. Verify tenant isolation, expected application reads/writes, and recovery behavior after deployment. Do not run destructive acceptance checks against the public demo database.
