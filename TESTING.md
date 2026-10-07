# Test NovaWorks yourself

Use the verified checkout in `E:\Projects\Hackathon\tmp\novaworks-publish`. Node.js 24 or later is required. Open PowerShell there:

```powershell
Set-Location 'E:\Projects\Hackathon\tmp\novaworks-publish'
npm.cmd ci --prefix app/client
npm.cmd ci --prefix backend
npm.cmd run build --prefix app/client
npm.cmd run db:init --prefix backend
npm.cmd run seed --prefix backend
npm.cmd start --prefix backend
```

If the app is already running on port 3001, use that instance instead of starting a second one. Open **http://127.0.0.1:3001/**. Keep the server terminal open. The private `backend/.env` must contain the server-only TokenRouter key, the configured model, a private session secret, and `FRONTEND_ORIGIN=http://127.0.0.1:3001`. See `.env.example`; never put the key in frontend code or screenshots. Use normal `/`, not the explicitly static `/?preview=1` design preview.

Every seeded account uses the fictional demo password **Demo123!**:

| Role | Email |
| --- | --- |
| Admin | admin@novaworks.example |
| Manager | ayesha@novaworks.example |
| Manager | bilal@novaworks.example |
| Manager | hina@novaworks.example |
| Agent | ali@novaworks.example |
| Agent | hamza@novaworks.example |
| Agent | sara@novaworks.example |
| Agent | usman@novaworks.example |
| Agent | zain@novaworks.example |
| Agent | maryam@novaworks.example |

## Main test

1. Sign in as Admin. Open Team Directory: ten supplied people with their specializations should appear.
2. Open `backend/docs/meeting-transcript.txt`, select all, and copy the complete text. In Projects, choose **Create from Transcript**, paste it, and choose **Process and Save**. This makes a real provider request and consumes credits if the transcript has not already been saved. Wait for the processing state; do not repeatedly submit.
3. A successful new batch has **three projects and twelve tasks**. Inspect the details: UrbanCart deadline **20 October 2026**, website integration **19 October**; QuickServe mobile integration **10 hours, 22 October**; HelpDeskPro evaluation assigned to **Maryam**, **8 hours, 21 October**. Rejected payments/maps and outsider Kamran should not become tasks or assignments.
4. Refresh the page. Saved records should remain. Submit the identical transcript again: it should reuse the saved batch rather than duplicate it.
5. Log out. Sign in as Ayesha: she should see only UrbanCart and its four tasks. Log out and sign in as Ali: My Tasks should show his three UrbanCart tasks, without other agents' tasks. Hamza should have two API tasks across UrbanCart and QuickServe. These exact counts assume a clean database with one original batch.
6. For persistence, stop the server with Ctrl+C, run the same start command again, and refresh. Saved projects should remain. Whether the session survives is checked separately; sign in again if necessary.
7. Try an empty transcript and incorrect password: understandable errors should appear. For incomplete required input, correct the text and retry; invalid extracted work must save nothing.

If records already exist, identical-input deduplication may show the existing result without a new AI request. To rehearse a fresh live conversion, reset only when you intentionally want to remove generated demo work:

```powershell
# Stop the app with Ctrl+C first. This deletes generated projects/tasks
# and transcript deduplication records; it preserves seeded users and sessions.
npm.cmd run reset:projects --prefix backend
npm.cmd start --prefix backend
```

## Automated checks and recorded evidence

```powershell
npm.cmd run test:all --prefix backend
npm.cmd run build --prefix app/client
# Optional: two genuine AI requests, consuming provider credits.
npm.cmd run test:live --prefix backend
```

At this handoff, backend tests passed **13/13**. Genuine TokenRouter requests with `deepseek/deepseek-v4-flash-0731` passed both original and consistently modified transcript acceptance: original three projects/twelve tasks, and only the modified QuickServe integration hours/date changed. Actual browser Admin conversion saved the live result to SQLite. Final browser checks PASS: Ayesha sees only UrbanCart and no creation action; Ali sees three own tasks. After backend restart, Ali remains signed in and sees the same three tasks. An unseen incomplete meeting returned422 and saved no new projects.

Docker deployment preparation is requested; Docker execution is **NOT RUN** because Docker is unavailable in this environment. No hosted deployment or submission is claimed. Keep the local database on persistent storage and follow the Docker instructions supplied with the final checkout.
