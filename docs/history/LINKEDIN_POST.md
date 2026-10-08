We built a working AI project-management MVP at Infinity Hack ’26—but missed the submission window and did not win.

That is the honest starting point for NovaWorks, our Code Nomads project.

The challenge was concrete: paste a meeting transcript, create projects and assigned tasks, then let managers and developers see only their permitted work.

Our React and Node.js app sends the full transcript and a safe team directory to TokenRouter. The server validates assignments, deadlines and estimated hours before saving the entire batch to SQLite. It also enforces access through authenticated sessions.

The event version passed thirteen backend tests. Real AI requests produced the expected three projects and twelve tasks; changing a final decision changed the corresponding estimate and deadline. We also verified the browser flow and saved records.

The biggest lesson was delivery discipline. We need to integrate a thin end-to-end slice earlier and reserve a real buffer for recording, documentation and submission—not simply finish coding near the deadline.

Thanks to Abdullah for the backend and Abdul Basit Shahid for being part of Code Nomads. I handled product/UI and final integration.

We are now continuing it as a portfolio project, with deployment next. These improvements are separate from the frozen hackathon version.

Code: https://github.com/Aizaz-Noor/Nova-Works

#Hackathon #BuildInPublic #WebDevelopment #AI

---

Publishing notes: this is a draft; no LinkedIn post has been sent. Replace Abdullah and Abdul Basit Shahid with their verified profile tags if desired. Add a live link only after deployment is actually verified. Do not present this as an on-time submission, a win, or a production-ready service.
