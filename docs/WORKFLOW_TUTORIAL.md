# NovaWorks workflow tutorial

The tutorial uses actual local application screens and clearly fictional QA records. It is an edited, captioned sequence with reading pauses, not an uninterrupted real-time recording. It is silent. It does not show every click; some task controls are below the captured project directory. Credential entry is excluded. No customer was contacted and no money moved.

Open the local app at http://127.0.0.1:3048/. Choose Explore demo workspace, then NovaWorks UI QA Sandbox. The tutorial shows:

1. Owner creates and qualifies a lead, then converts it into linked customer/contact/deal records.
2. Owner prepares a PKR100 quote with explicit zero tax for the fictional example, issues it, records fictional acceptance and converts it into a sales order.
3. Owner marks the deal Won and creates its linked delivery project, manager and deadline.
4. Owner assigns Morgan a task. Scroll down to Company tasks to find the task-status control below the project directory. Morgan progresses it to Done and submits90minutes of nonbillable fixed-price effort.
5. A different account reviews and approves the time; the saved entry and review history are locked.
6. Owner creates and issues invoice INV-000005 from the order, records fictional receipt evidence PKR25, and sees PKR75 outstanding.
7. Reports reconcile approved time and financial evidence. The financial report includes earlier QA records as well as this engagement, so its company totals exceed this one invoice.

Video: `docs/assets/novaworks-workflow-guide-20261028.mp4`. Raw complete-frame captures, edited scene list and subtitles: `tmp/workflow-retake-20261028/`. Persisted linked-record verification: `tmp/workflow-retake-20261028/data-evidence.json`.

This tutorial demonstrates the manual fixed-price business flow. It does not demonstrate live AI, email delivery, payment processing, or the separate TIME invoice branch. Those must not be inferred from the animation or captions. The separate TIME branch has its own browser/data acceptance reports. Project task status, time approval, invoice issue and payment evidence are distinct states.
