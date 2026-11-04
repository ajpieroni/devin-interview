# Internal tools: a code core built with Devin vs Power Apps

**For:** VP of Engineering. **Decision:** keep paying for Power Apps, rebuild on a code core with Devin, or run both. This prototype is evidence for that decision, not production software. Data is synthetic, and there are no compliance claims.

## What was built and measured

- **One shared core** provides sign-in (OIDC adapter plus a local dev IdP), server-side roles with default deny, maker-checker approvals with limits in one config file, and a hash-chained audit log with verify, a tamper demo and CSV export.
- **Three apps on top of it,** the client's current Power Apps tools: a KYC review queue, a refunds dashboard, and a feature-flag admin with a tier-gated flag, a second approver for production and a kill switch.
- **The apps changed 0 lines of core code (`src/core`).** That is H1 in the PRD. The flag app added its data model, four permissions and its rules to the config files. Code added per app, including pages and API routes:

| App | App code | Tests | Core code changed |
| --- | --- | --- | --- |
| KYC review queue | 116 lines | 44 lines | 0 |
| Refunds dashboard | 163 lines | 45 lines | 0 |
| Feature-flag admin | 505 lines (incl. 60 of schema/config/seed) | 87 lines | 0 |

- **Every app inherits the controls.** Login, the role checks, plain-language denials, audited decisions, CSRF protection, input validation and the `/policy` default-deny check all came from the core; no app re-implemented them.
- **Quality bar:** 104 automated tests named after the PRD requirements. CI runs `npm audit`, lint, typecheck, tests, build and a secret scan on every PR. Recorded browser runs covered all four roles.
- **Volume:** with 10,000 cases, a queue page returns in about 5–20 ms locally, because filtering and paging happen in the database. Power Apps returns only the first 500 records (2,000 at most) for queries it cannot delegate to the data source ([Microsoft](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/delegation-overview)).

## Side by side

| Capability | Power Apps | Code core + Devin | Edge |
| --- | --- | --- | --- |
| Sign-in | Inherits Entra ID, embeds in Teams | OIDC adapter; switching IdP is configuration only. Not yet tested against a real IdP. | Power Apps today |
| Roles | Security roles, Entra groups | One policy file, default deny, a `/policy` page listing every route and its roles, with a test that fails on any route lacking a policy | Code (reviewable in one place) |
| Approvals | Power Automate flows | Maker-checker in config; the requester can never approve; second approver above $5,000, for high-risk KYC and for production flag changes; all tested | Code (rules are tested, not clicked) |
| Audit trail | Dataverse auditing: off by default, enabled per table, consumes log capacity ([Microsoft](https://learn.microsoft.com/power-platform/admin/manage-dataverse-auditing)) | Every decision, reveal, denial and flag change goes into a hash chain; a direct database edit makes verify fail (tamper-evident, not tamper-proof) | Code for tamper-evidence; Microsoft for attestations |
| Data at volume | Delegation limits, 500/2,000-row cap on non-delegable queries | Server-side filter, sort and page tested at 10,000 rows | Code |
| Release process | Environments, managed solutions, pipelines; teams often publish by hand ([M365 FM](https://www.m365.fm/blog/why-manual-solution-exports-are-wrecking-your-power-apps-production-environment/)) | Every change is a PR with CI and a human reviewer | Code, if the team keeps the discipline |
| Lock-in | Logic in Power Fx, runs only in Microsoft's cloud | Standard TypeScript/Postgres-portable stack in the client's repo | Code (with ownership cost) |
| Connectors | Hundreds prebuilt | Built one at a time | Power Apps |
| Non-engineer builders | Canvas, model-driven, Vibe apps | Not offered; an engineer reviews every Devin change | Power Apps |
| Compliance evidence | Microsoft maps services to SOC 2, ISO 27001, GLBA, NYCRR 500 ([Microsoft](https://learn.microsoft.com/industry/financial-services/compliance-overview)) | None yet; the client would own evidence for its own code | Power Apps |

## Cost shape (needs the client's numbers)

At the $20 per user per month Premium list price ([Superblocks](https://www.superblocks.com/blog/powerapps-pricing)), $250K a year corresponds to about 1,040 seats. That assumes the whole budget is licenses; it may also cover Dataverse capacity, Power Automate or consultants. The code path swaps that for Devin compute, engineer review time, hosting and on-call for 13+ apps. The prototype measured the build side; the client's review minutes per PR (README change log) set the rest.

## Where Power Apps still wins

Zero-effort Entra and Teams integration. Prebuilt connectors. Business users who build and edit their own apps. Microsoft-supplied compliance evidence. No platform to run. Microsoft is also moving toward this pitch with AI-generated code apps on Dataverse (Vibe apps and Code Apps, in preview in 2026), so for a Microsoft shop whose data lives in Dataverse, "buy" stays a serious option.

## Recommendation to test

Run both, split by workload. Move the regulated, high-volume, audit-heavy workflows (KYC, refunds, production flags) onto the code core, where tested maker-checker, a tamper-evident audit trail and unlimited server-side paging matter most. Keep Power Apps for low-risk apps that business users build in the Microsoft estate. Re-decide after a 30-day pilot on one real workflow, using measured review minutes per change and the auditors' reaction to the evidence.

**What would flip this:** the data and workflows mostly live in Dataverse and Power Automate; non-engineers edit these apps weekly; auditors need nothing beyond Microsoft's reports; or the platform team cannot absorb on-call for the apps.

## Before production

Test against a real IdP and sync IdP groups. Move to Postgres with row-level rules. Stream the audit log to a SIEM and write-once storage. Replace the in-process limiter and audit write queue with a shared store or locks. Map controls to SOC 2. Add branch protection with required reviewers.

## Questions for you

What does the $250K cover? Where do the KYC and refund data live? Entra, Okta or Google? Who edits the three apps today, and are they engineers? Is Dataverse auditing on for those tables, and what has capacity overage cost?
