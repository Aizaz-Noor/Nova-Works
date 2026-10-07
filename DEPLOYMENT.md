# NovaWorks single-instance deployment

This is a hackathon MVP with fictional seeded accounts. The supplied demo passwords are public. Use it only as an isolated demonstration; it is not ready to hold real business data on an unrestricted public endpoint. Do not publish the demo accounts as production credentials.

## Runtime contract

Use Node.js 24, one Express process, SQLite on a persistent writable volume, and HTTPS terminated by a trusted reverse proxy. The backend serves the built React application and API on the same origin. Do not split the client onto a different domain. Do not run multiple replicas against this SQLite volume.

Set these private server environment variables in your host's secret/environment configuration:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3001`, or the port assigned by your host |
| `DATABASE_PATH` | `/data/novaworks.sqlite` |
| `SESSION_SECRET` | A private random string of at least 32 characters |
| `FRONTEND_ORIGIN` | The exact public HTTPS origin, for example `https://novaworks.example`, without a trailing slash |
| `TRUST_PROXY` | `1` only behind one trusted HTTPS reverse proxy |
| `TOKENROUTER_API_KEY` | The private provider key; never a frontend/Vite variable |
| `TOKENROUTER_MODEL` | `deepseek/deepseek-v4-flash-0731`, verified against the original and modified challenge transcripts |
| `TOKENROUTER_BASE_URL` | `https://api.tokenrouter.com/v1` |

The trusted proxy must send `X-Forwarded-Proto: https`; production session cookies require HTTPS. Proxy trust must match the hosting topology. The app's configured single proxy setting is intended for one trusted ingress; do not expose the backend directly to untrusted clients that can forge forwarded headers.

Sessions are persisted in the same SQLite database as projects and tasks. Session-store tests verified persistence; keep the database volume and the same private `SESSION_SECRET` across restarts. Keep this MVP to one instance and one persistent volume.

## Docker preparation

Run these commands from the repository root on a machine with Docker installed:

```sh
docker build -t novaworks:demo .
docker volume create novaworks-data
```

Create a private `deployment.env` outside source control containing the variables above. Keep it outside the build context. Initialize the schema and fictional users explicitly:

```sh
docker run --rm --env-file /private/deployment.env -v novaworks-data:/data novaworks:demo npm run db:init
docker run --rm --env-file /private/deployment.env -v novaworks-data:/data novaworks:demo npm run seed
docker run -d --name novaworks --restart unless-stopped --env-file /private/deployment.env -v novaworks-data:/data -p 127.0.0.1:3001:3001 novaworks:demo
```

Configure your HTTPS reverse proxy to forward the public origin to `127.0.0.1:3001`. The user selected Docker preparation; no hosted deployment has been performed. Mount the persistent volume at `/data` and keep one container instance. The volume must be writable by the container's `node` user. An ephemeral filesystem loses saved work and sessions.

`Dockerfile` installs from the existing lockfiles, builds the frontend, excludes private `.env` files and databases, and runs as the unprivileged `node` user. Back up the database using a SQLite-consistent snapshot before replacing the volume or resetting records. Do not run the project reset command on a database whose records you need to preserve.

## Acceptance before sharing a deployment

Check `/api/health`, then log in through HTTPS. Verify the cookie remains authenticated on refresh. Submit the original full challenge transcript and confirm three projects and twelve tasks with the final meeting corrections. The original and modified transcript acceptance tests passed with the selected TokenRouter model; repeat the useful flow on the deployed environment. Verify manager and agent visibility, logout, error recovery, and duplicate prevention. Restart the instance and confirm stored projects and the authenticated session remain while the session is unexpired. Never count a successful image build or health response as proof of the complete flow.

Deployment preparation is not deployment. Docker build/container runtime and hosted HTTPS verification were not run in the preparation environment because Docker was unavailable. Record the actual results on the selected host before claiming a hosted demo works.
