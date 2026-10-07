# NovaWorks backend API â€” handoff for Aizaz

Base URL: `http://localhost:3001/api`. JSON uses camelCase. All protected routes derive identity and role from the session, never request parameters. There is no frontend in the supplied repository.

## Frontend setup

Set backend `FRONTEND_ORIGIN` to the frontend's exact origin, e.g. `http://localhost:5173` (no trailing slash). Use `localhost` consistently for both apps, rather than mixing it with `127.0.0.1`. Send `credentials: "include"` on **every** request, including login/logout. Cookies are HttpOnly, so do not read or store tokens in browser code.

```js
const API = 'http://localhost:3001/api';
async function request(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error.message), {
    status: response.status, code: data.error.code, issues: data.error.issues,
  });
  return data;
}
const user = await request('/auth/login', {
  method: 'POST', body: JSON.stringify({ email: 'admin@novaworks.example', password: 'Demo123!' }),
});
const { projects } = await request('/projects');
```

Call `/auth/me` when loading/reloading the frontend; send users to login on 401. Disable Create while pending. Show the structured validation issues on 422 and leave the transcript editable. After success, reload project lists. A role check in the UI only controls presentation; backend rules enforce access.

## Routes and responses

GET routes have no request body. POST routes accept JSON. Logout accepts an empty body or `{}`.

| Method | Route | Authentication / roles | Request | Success |
| --- | --- | --- | --- | --- |
| GET | `/health` | Public | â€” | 200 `{ "success": true }` |
| POST | `/auth/login` | Public | `{ "email": "â€¦", "password": "â€¦" }` | 200 safe user; sets cookie |
| POST | `/auth/logout` | Public; clears existing session | `{}` | 200 `{ "success": true }`; clears cookie |
| GET | `/auth/me` | All signed-in roles | â€” | 200 safe user |
| GET | `/team` | All signed-in roles; read-only | â€” | 200 `{ "team": [directoryEntry] }` |
| GET | `/projects` | ADMIN: all; MANAGER: managed; AGENT: projects with own tasks | â€” | 200 `{ "projects": [projectSummary] }` |
| GET | `/projects/:id` | Same project visibility rule | â€” | 200 project detail with authorized tasks |
| GET | `/tasks` | ADMIN: all; MANAGER: managed-project tasks; AGENT: assigned tasks | â€” | 200 `{ "tasks": [task] }` |
| POST | `/admin/create-from-transcript` | ADMIN only | `{ "transcript": "â€¦" }` | 201 newly saved result; 200 if replayed |

`GET /tasks` is the agent My Tasks endpoint. There is no separate `/my-tasks`, editing, signup, or user-management route. Empty lists return 200 with `[]`. Query parameters such as `userId`, `role`, or `agentId` do not change authorization.

Safe user (login/me):
```json
{"id":"PM01","name":"Ayesha Khan","email":"ayesha@novaworks.example","role":"MANAGER","specialization":"Web PM"}
```

Directory entry:
```json
{"id":"DEV01","name":"Ali Raza","role":"AGENT","specialization":"Full-Stack","skills":["React","frontend integration"]}
```

Project summary:
```json
{"id":"generated-uuid","name":"UrbanCart Website","clientName":"UrbanCart Clothing","description":"Agreed demo scope","managerId":"PM01","deadline":"2026-10-20","createdAt":"2026-10-07 06:00:00","managerName":"Ayesha Khan","managerSpecialization":"Web PM"}
```

Project detail adds `manager: { id, name, specialization }` and `tasks: [task]`. For an AGENT, that array contains only the signed-in agent's tasks; task counts and other assignments are not included. ADMIN and the owning MANAGER receive all project tasks. Unauthorized/nonexistent project IDs both return 404.

Task:
```json
{"id":"generated-uuid","projectId":"generated-project-uuid","title":"Product catalog UI","description":"Product listing, detail and responsive layout","assigneeId":"DEV01","deadline":"2026-10-12","estimatedHours":12,"createdAt":"2026-10-07 06:00:00","assigneeName":"Ali Raza","projectName":"UrbanCart Website","managerId":"PM01"}
```

Creation success:
```json
{"success":true,"replayed":false,"projectCount":3,"taskCount":12,"projects":[]}
```
`projects` actually contains the full newly created project details and tasks; abbreviated here. Success is returned only after commit. Project/task UUIDs come from the backend, user IDs from the seeded directory. Identical trimmed transcript content returns the originally committed result with `replayed: true` and does not call AI again. Changed content creates a new batch; reset between organizer tests if you want only one batch visible.

## Consistent errors

All error responses have this shape:
```json
{"success":false,"error":{"code":"INVALID_AI_OUTPUT","message":"AI result requires correction; nothing was saved","issues":[{"path":"projects[0].tasks[1].assigneeId","message":"Must reference an existing AGENT"}]}}
```
`issues` appears only where relevant. Never expect stack traces or raw provider responses.

| Status | Codes / triggers | Applicable routes |
| --- | --- | --- |
| 400 | `BAD_INPUT`: missing credentials, empty/oversized transcript; `BAD_JSON`: malformed JSON | login, creation, any JSON body |
| 401 | `INVALID_CREDENTIALS`, `UNAUTHENTICATED` | login, all protected routes |
| 403 | `FORBIDDEN`: non-admin creation; `ORIGIN_FORBIDDEN`: disallowed browser origin | creation; all routes with Origin |
| 404 | `NOT_FOUND`: inaccessible/missing project or route | detail / unknown routes |
| 409 | `SUBMISSION_IN_PROGRESS`: identical transcript already processing | creation |
| 413 | `PAYLOAD_TOO_LARGE`: JSON body over 256 KB | POST routes |
| 422 | `INVALID_AI_OUTPUT`: invalid JSON or required extracted fields | creation |
| 500 | `INTERNAL_ERROR`: database/session/internal failure | any route |
| 502 | `AI_PROVIDER_ERROR`, `AI_INVALID_RESPONSE`, `AI_TRUNCATED` | creation |
| 503 | `AI_NOT_CONFIGURED`; provider quota/unavailability as `AI_PROVIDER_ERROR` | creation |

Transcript limit is 100,000 characters. Provider timeout is 60 seconds. Show errors and allow retries; failed extraction/validation/insertion saves nothing. Sessions last eight hours and are lost when the backend restarts; saved SQLite records remain. Local separate ports work with SameSite=Lax. For deployment, host frontend/API on the same site; production uses Secure cookies and requires HTTPS. Cross-site hosting is not supported by this default cookie configuration.
