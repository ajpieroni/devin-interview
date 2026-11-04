# Evidence pack for the one-pager and recommendation

These are notes to write the one-pager from, not the one-pager. Every number is measured in this repo or cited. Anything else is labeled as an assumption or a question.

## Discovery first: the $250K doesn't fit 60 engineers

- Premium lists at $20 per user per month ([Superblocks](https://www.superblocks.com/blog/powerapps-pricing)). 60 engineers on Premium would cost about $14,400 a year (60 × $20 × 12).
- $250K a year at that price is about 1,040 seats ($250,000 ÷ $240). That's arithmetic, not data.
- So either most users are not engineers (ops, support, compliance staff), or the $250K covers more than licenses: Dataverse capacity, Power Automate, consultants, a Center of Excellence.
- Either answer changes the recommendation. Many non-engineer users means the builder matters and "buy" gets stronger. Mostly capacity and consultants means a rebuild could remove more of it.
- Ask before recommending: what does the $250K cover; how many people use each app, and how many are engineers; who edits the apps; where the KYC and refund data live; Entra, Okta or Google; is Dataverse auditing on, and what has capacity overage cost over 12 months.

## Measured in this prototype

| Fact | Value | Where |
| --- | --- | --- |
| Core code (`src/core`) changed by the three apps | 0 lines | per-app commits on PR #1 |
| App size: KYC / refunds / flags | 116 / 163 / 505 lines (flags incl. 60 lines of schema, config and seed) | same commits |
| Automated tests | 104, named after PRD IDs; CI green (`npm audit`, lint, typecheck, tests, build, secret scan) | `tests/`, `.github/workflows/ci.yml` |
| Queue page at 10,000 cases | about 5–20 ms locally (SQLite, dev server) | list footers; `p0-3-queue` asserts < 500 ms |
| Demo reset | about 1.5 s | `npm run demo:reset` |
| Defects caught by end-to-end testing that unit tests missed | 2 (sign-in loop with an empty `SESSION_SECRET`; refunds filter select out of sync with the URL) | `docs/devin-log.md` |
| Human review minutes per PR, request-to-merge for 3 change requests | not yet recorded | README change log, for you to fill |
| Devin compute cost | not stated: Cognition doesn't publish the ACU rate | session usage page only |

Power Apps facts used (cited in the PRD): non-delegable queries return the first 500 records, adjustable to 2,000 ([Microsoft](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview)). Dataverse auditing is off by default and enabled per table ([Microsoft](https://learn.microsoft.com/power-platform/admin/manage-dataverse-auditing)). Microsoft maps Power Platform services to SOC 2, ISO 27001, GLBA and NYCRR 500 ([Microsoft](https://learn.microsoft.com/industry/financial-services/compliance-overview)). Vibe apps and Code Apps were in preview in 2026; check their status before quoting.

## Tradeoffs, each with what would change the choice

| Choice | Over | Cost | Would flip if |
| --- | --- | --- | --- |
| Shared code core, apps as thin modules | Three independent apps | Upfront core work; the core's flaws reach every app | App 2 or 3 had needed core rewrites (they didn't here; a real workflow may) |
| OIDC seam with a stub IdP | Real Entra, Teams and Power Automate | SSO unproven; rebuilds what Microsoft bundles | Data and workflows mostly live in Dataverse and Power Automate |
| Engineers as makers | Builder for non-engineers | Ops can't change an app without an engineer | Non-engineers edit these apps weekly |
| Hash-chained audit in the app database | SIEM and write-once storage | Tamper-evident only | Auditors need nothing beyond Microsoft's reports |
| Code in the client's repo | Licensed platform | Upgrades and on-call for 13+ apps (this session already needed one major-version upgrade round) | The platform team can't absorb that load |

## What I'm least sure of

- What the $250K covers. It decides how much a rebuild could save.
- Review time at app ten, not app one. This session measured build size, not human review minutes per change.
- Whether Microsoft's AI app generation is good enough for a Microsoft shop to make this moot.
- Maintenance load. The upgrade round (Next 16, Prisma 7, Vitest 5) hints at what owning the code costs.

## Where Devin shouldn't be used (honest limits)

- Apps that business users build and edit themselves; Power Apps fits them better.
- Workflows that need the Microsoft estate on day one (Teams, Power Automate, Dataverse).
- Anything that needs production credentials or real customer data inside a session. The pilot rule is synthetic data only.
- Changes with no human reviewer. This session's two end-to-end defects passed every unit test.

## Smallest reversible next step

A 30-day pilot on one regulated workflow (refunds is the smallest), run in parallel with the existing Power App and reverted by switching users back. Run it on the pilot access checklist (`docs/pilot-checklist.md`), with named PR approvers. Success is measured by review minutes per change, request-to-merge time, defects found after merge, and the auditors' reaction to the evidence. Keep Power Apps for low-risk, business-built apps either way.
