# Docker

The repository includes a Dockerfile for building the frontend and running the Express backend in a Node.js 24 container. The container stores its SQLite database at `/data/novaworks.sqlite`; mount a persistent volume at `/data` if data must survive restarts.

Build the image from the repository root:

```sh
docker build -t novaworks:local .
```

Run it only with server-side environment values stored in a private environment file outside the repository. Set `NODE_ENV=production`, a private `SESSION_SECRET`, the correct `FRONTEND_ORIGIN`, and an appropriate persistent `DATABASE_PATH`. Configure HTTPS at a trusted reverse proxy. Never bake credentials into the image or use a public demo password for a production deployment.

The Docker image builds the client and starts the API server. Schema initialization, migrations, seed data, backup and restore must be planned for the selected environment. Do not assume the container automatically migrates or seeds a production database.

Docker execution has not been independently verified for this release. Before sharing a hosted instance, test first-start setup, health, sign-in, role permissions, database persistence across restart, backup and restore.
