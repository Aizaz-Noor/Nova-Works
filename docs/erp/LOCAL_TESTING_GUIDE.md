# Test NovaWorks on this computer

Open **http://127.0.0.1:3039**. This is the current local ERP candidate, separate from the public demonstration. Use fictional companies and records. Your manual acceptance results are still TO TRY; previous automated checks do not count as your approval.

## First session

Choose Create ERP account and use an email/password you can remember. No verification email is sent. Create a company such as Test Agency. Use a second browser or private window for a second account, so the two sessions stay separate. Invite that account as MEMBER and copy the invitation's company ID/token privately into Accept a company invitation. No invitation email is sent.

| Try | What should happen | Your result |
| --- | --- | --- |
| Create account/company, sign out/in | Company and saved records remain | TO TRY |
| Create a project and assign a task to the second account | Owner sees company work; member sees their assigned task | TO TRY |
| Member changes their task status | Saved status remains after refresh | TO TRY |
| Post a task comment from each account | Both authorized users can read it after refreshing the thread | TO TRY |
| Add a milestone; mark Done; reopen | Due date/state persist; member can read but cannot edit | TO TRY |
| Edit the same milestone from two owner windows | The second stale save shows a conflict, keeps edits, and requires reviewing the latest version | TO TRY |
| Create a customer/contact/activity and a deal | Saved customer and pipeline information remains after refresh | TO TRY |
| Create a quote, issue it, record a test approval and convert to order | Saved amounts/states remain; conversion is controlled | TO TRY |
| Submit time as the member; review as the owner | Another authorized reviewer approves/rejects; worker cannot approve their own entry | TO TRY |
| Create/issue a test invoice; record a manual payment; download PDF | Amounts and remaining balance agree; PDF opens | TO TRY |
| Open reports and company settings | Figures reflect saved records; settings persist | TO TRY |
| Create a second company and switch between them | Records stay with the company that owns them | TO TRY |
| Resize browser narrow or use its device preview | Forms, navigation and saved work remain usable | TO TRY |

Quote approval here is your internal test record, not an email to or consent from a customer. Invoice payments are manual records, not real bank transfers. Time entries are not yet automatically allocated to invoices.

## Account security

Account security supports password changes and authenticator setup. For optional MFA testing, use your authenticator's manual time-based setup key (6 digits/30 seconds), confirm a current code and privately retain the one-time recovery codes. After sign-in, wait for a fresh authenticator code before another sensitive action. Reauthenticate account supplies the recent verification needed by protected settings/invitation actions. Password change signs you out. Actual phone interoperability is a manual acceptance item, not already verified.

## What is not connected

- Live AI provider/worker: this launcher injects a disabled provider. An AI job may remain queued because there is no worker; this is not a completed AI result. Do not use Meeting AI as a live-provider acceptance test in this session.
- Password-reset and invitation email delivery; reset delivery is disabled.
- Paid subscription checkout, merchant verification or real payment processing. Local subscription enforcement is disabled for this general workflow session, so it cannot prove an expired paid plan's behavior.
- Private attachments and notifications remain unfinished. This is not the full ERP or a production release.

## Report a problem

Send: the screen, account role, steps/clicks, expected result and actual result. Include a screenshot if useful, without passwords, setup keys, recovery codes or invitation tokens. Mark each checklist row PASS/FAIL/NOT TRIED; these are your observations, not automatic test results.

## Restart later

Keep the terminal/process running during testing. If the site stops, open PowerShell:

```powershell
cd E:\Projects\Hackathon\tmp\novaworks-analysis-20261019
node scripts/start-local-testing.mjs
```

The launcher binds only to this computer. Use the exact127.0.0.1 address; localhost is a different configured origin. It serves the last built interface. Rebuild only after agreeing to test a newer candidate; this guide does not silently update the running version.

Your SQLite test database and private local session/MFA configuration persist under ignored tmp/human-testing. Do not delete that folder to restart. To retain a database backup in a new destination:

```powershell
node backend/scripts/backup-sqlite.js tmp/human-testing/novaworks.sqlite tmp/human-testing/manual-test-backup.sqlite
```

That command refuses an existing destination. The private configuration must be retained separately for MFA-key recovery; a database-only backup is insufficient. No backup command has been run on your human-testing database as part of writing this guide.
