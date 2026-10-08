# NovaWorks frontend

React 19 + Vite 6, JavaScript and plain CSS. The current interface is a delivery workspace: role navigation, compact project ledger, assigned task rows and read-only team directory. Scoped searches, filters and ordering use only data returned by the authorized API.

Follow the [root README](../../README.md) for the combined local app. For frontend development, from the root run `npm.cmd ci --prefix app/client` and `npm.cmd run dev --prefix app/client`; configure backend FRONTEND_ORIGIN=http://127.0.0.1:5173 and run the backend separately on port 3001. Vite proxies /api to that backend. No private keys belong in client variables.

`npm.cmd run build --prefix app/client` creates dist/. Express serves that output and the API together for local demonstrations. Vite preview is for visual build review and does not configure the API proxy.

## Static preview

`/?preview=1` is explicitly labeled sample data. It cannot authenticate, call the provider or save work. Normal `/` uses the real API. The preview's answer data never seeds the live database.

## Behavior and evidence

Login/logout, session expiry, transcript sample/loading/validation/retry/replay, authorized projects/tasks and responsive layouts are integrated. The API enforces access; hiding controls is not the security boundary. Loading and error states preserve useful input. Persistent labels and keyboard focus support interaction; full accessibility conformance is not claimed.

See [the public-demo audit](../../docs/PUBLIC_DEMO_REPORT.md), [design handoff](../../Aizaz/DESIGN_SYSTEM.md) and [testing guide](../../TESTING.md). This portfolio includes post-event deployment and UI improvements; it is not an on-time hackathon submission.