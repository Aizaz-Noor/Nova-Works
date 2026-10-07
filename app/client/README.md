# NovaWorks - Meeting to Execution frontend

React19.2.8 + Vite6.4.3; JavaScript and plain CSS. Tested with Node24.12.0.

## Run

From app/client:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:5173/. Keep this terminal running. API requests proxy to Basit's backend at http://127.0.0.1:3001; backend must run separately. No API keys belong in this frontend.

Build with `npm.cmd run build`; output is dist/. `npm.cmd run preview` serves the build for visual review but does not configure the backend API proxy; use the dev server for API integration or have Express serve dist/ on the same origin for the demo.

## Static design preview

http://127.0.0.1:5173/?preview=1 is explicitly labeled static sample data. Role selector previews administrator/manager/agent interfaces only. It cannot authenticate, call AI or create records. Normal application route requires the real backend. The answer key is not used by the live API path.

## Integration

Shared API and data contract: ../../Aizaz/TEAM_BUILD_HANDOFF.md. The backend must derive identity from session cookies and enforce permissions on every request. Frontend handles401 session expiry, visible errors and disabled creation while processing. Three projects/twelve tasks are sample meeting results, not output limits.

Implemented login, admin transcript form, project cards/details, manager project view, agent task list, read-only directory, feedback and responsive layouts. Live authentication, runtime AI, atomic saves and access enforcement remain unverified until backend integration. This is a frontend source milestone; no deployment performed.
