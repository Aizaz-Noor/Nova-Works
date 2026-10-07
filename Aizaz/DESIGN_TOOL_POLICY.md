# Design Tool Policy

Status: pre-hackathon infrastructure. No product stack, design direction, or component library has been selected. Official-source research began 2026-10-01; pinned skill audit completed 2026-10-02.

## Choose for the product

The UI Art Director defines the audience, task, information hierarchy, states, and design tokens in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) from the real challenge and agreed candidate MVP as part of Gate 3. Builder follows those decisions once the MVP gate and lead direction approval are complete. A library demo is a reference, not the product's visual identity.

1. Use the approved framework and existing dependencies first. For a suitable React project, shadcn/ui with Radix is a foundation option; native HTML/CSS may be sufficient. Choose one consistent primitive foundation.
2. Add Motion for React only when state, feedback, hierarchy, navigation, or cause and effect needs it. CSS transitions are enough for many controls. Do not install multiple animation engines for equivalent work.
3. Select **at most one primary effects/component source** among React Bits, Aceternity, Magic UI, Kokonut UI, or another justified source. Additional sources require the UI Art Director to record the specific missing capability, added dependency cost, and consistency plan; major dependency changes require the lead's authorization.
4. Prefer zero effects sources when they add no user value. Each primary screen gets at most one dominant visual treatment, one background treatment, one distinctive interaction, and subtle supporting microinteractions by default.
5. Install individual components after inspecting their source, dependency list, license, and registry origin. Map their colors, typography, radii, spacing, icons, and motion to DESIGN_SYSTEM. Preserve applicable notices. Check keyboard, touch, reduced motion, loading/error states, and mobile behavior.
6. Record the selected source URL, component/version or commit, license, purpose, and dependencies in DESIGN_SYSTEM. No bulk component installs, whole library clones into the app, or paid service enrollment during setup.

## Current resource map

Commands below are documented options for the future approved product, not commands executed during setup. Recheck compatibility on selection; `@latest` is not a reproducible pin. Keep the resulting lockfile and record actual versions.

| Resource | Verified use / command | Decision rule |
|---|---|---|
| [shadcn/ui](https://ui.shadcn.com/docs/cli) | In the selected app: `npx shadcn@latest init`, then `npx shadcn@latest add <component>`. Current CLI offers Radix, Base UI, and other foundation options. | Initialize only after stack choice; never overwrite existing configuration with `--force` as a shortcut. [Official provenance](https://ui.shadcn.com/docs/official). |
| [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/getting-started) | Direct primitive route: `npm install radix-ui@latest`. | Use if a component abstraction needs accessible behavior; avoid redundant direct installs when the chosen component setup already supplies them. |
| [Motion for React](https://motion.dev/docs/react-installation) | `npm install motion`; import from `motion/react`. | Optional semantic motion; preserve usable stable states and `prefers-reduced-motion`. |
| [21st.dev](https://github.com/21st-dev/magic-mcp/blob/main/llms-install.md) | Current MCP setup: `npx @21st-dev/cli@latest init --client codex`; HTTP endpoint `https://21st.dev/api/mcp`. | Optional discovery. Requires account key from [21st MCP](https://21st.dev/mcp). Do not run the installer over managed config without merging. Current shared config/report governs actual availability. |
| [React Bits](https://github.com/DavidHDev/react-bits) | Official example: `npx shadcn@latest add @react-bits/BlurText-TS-TW`. Choose the matching JS/TS and CSS/Tailwind variant on the component page. | Optional effects source. [MIT + Commons Clause](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md), not plain MIT: preserve notices and observe component redistribution restrictions. |
| [Aceternity UI](https://ui.aceternity.com/components/cli) | `npx shadcn@latest add https://ui.aceternity.com/registry/<component>.json`; namespaced form available after configuring its registry. | Optional effects source; inspect dependencies and exact component permissions. [Website terms](https://ui.aceternity.com/terms) are restrictive; do not assume an MIT license or copy paid assets. |
| [Magic UI](https://magicui.design/docs/installation) | Initialize shadcn, then add the chosen component; official example: `npx shadcn@latest add @magicui/globe`. | Optional source. [OSS repository](https://github.com/magicuidesign/magicui) is MIT; Pro access is separate. Example is syntax, not a recommendation to add a globe. |
| [Kokonut UI](https://kokonutui.com/docs) | Registry `https://kokonutui.com/r/{name}.json` under `@kokonutui`, then `npx shadcn@latest add @kokonutui/<name>`. Direct registry URLs also supported. | Optional source targeting Tailwind v4. [OSS repository](https://github.com/kokonut-labs/kokonutui) is MIT; Pro access is separate. |
| [Origin UI / coss ui](https://coss.com/ui/docs) | `originui.com` currently redirects to coss ui. Current components use Base UI and Tailwind; follow its current Get Started guide if selected. | Alternative foundation/reference. Do not mix foundations or assume old Origin installation instructions still apply. |
| [tweakcn](https://tweakcn.com/) | Browser theme editor; export and review the chosen tokens. [Source](https://github.com/jnsahaj/tweakcn) is Apache-2.0. | No local editor install required. Do not accept a preset without product reasoning or blindly overwrite the app's styles. |
| [Mobbin](https://mobbin.com/) | Human reference browsing, subject to the user's account access. | No automated integration claimed. No scraping protected content, copying private designs, or bypassing access restrictions. |

## 21st access and cost boundaries

Magic MCP has been replaced by the unified 21st MCP; `@21st-dev/magic` is a compatibility proxy and is not the new-install choice. Old Magic keys no longer work. The current service supports discovery and retrieval according to account entitlements; code retrieval and hosted generation may be metered. Inspect tools and usage before generation; do not retry through legacy aliases after an entitlement denial. Search results are not a blanket copyright license. Use only legitimately accessible components with appropriate reuse permission. Keep API keys in the approved environment/credential mechanism, never in Git or prompt text. See [official migration](https://github.com/21st-dev/magic-mcp/blob/main/README.md) and [Codex integration](https://github.com/21st-dev/codex-plugin/blob/main/README.md).

## frontend-craft provenance

The name is shared by unrelated projects. The selected implementation is [hungson1002/frontend-craft](https://github.com/hungson1002/frontend-craft), a standalone MIT skill with audit helpers. The downloaded source at commit `1a99b1315f0379a7d338ff72e48ac3c12d11564f` documents `npx skills add hungson1002/frontend-craft`; the bundled Codex installer downloaded that exact commit for inspection. Its runtime skill, metadata, two helpers, and license were staged with narrow hackathon authority/timebox adaptations; website, examples, and evaluation code were excluded. External benchmark claims are not validation of this workspace. Audit details and deployment status are in [design-research.md](../hackathon/reports/design-research.md).

[bovinphang/frontend-craft](https://github.com/bovinphang/frontend-craft/) is a different MIT toolkit. Its documented `npx @bovinphang/frontend-craft@latest install --local codex` command installs a broad rules/skills/agents/hooks package; it is not selected because that duplicates this environment. [IndelibleVivi/frontend-craft](https://github.com/IndelibleVivi/frontend-craft) documents installation but explicitly states no copyright license is granted; it is not copied.

The repository's UI Art Director and approved DESIGN_SYSTEM remain authoritative. Supplementary craft advice cannot expand product scope, require concept replacement after freeze, authorize paid imagery, or prolong the event past its timebox.

## Acceptance before adopting any visual resource

The component must make the user's next action or result clearer, fit the selected visual language, have understood licensing and dependencies, work in the approved stack, and be testable within the remaining time. If a simpler native component meets the same need, prefer it. Substantial visual polish follows the first functional end-to-end flow.

## Current toolkit integration

[UI_RESOURCES.md](UI_RESOURCES.md) is the current on-demand catalog; [FRONTEND_QA.md](FRONTEND_QA.md) defines runtime verification. No UI product dependencies are preinstalled. Prefer shadcn, Lucide and Motion when appropriate; review existing foundation and Base UI/Radix compatibility. Select at most one primary effects source. Supplementary design skills remain under UI Art Director and canonical DESIGN_SYSTEM authority.
