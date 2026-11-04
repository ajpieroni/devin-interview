# Internal tools prototype: shared core

**What it is.** A prototype that tests one idea: build the control plane of internal tools (sign-in, roles, maker-checker approvals, audit log) once, in code, and let Devin add thin apps on top of it cheaply. It is the comparison point for the client's Power Apps setup. It holds the shared core and the client's three tools built on it: a KYC review queue (`/kyc`), a refunds dashboard (`/refunds`) and a feature-flag admin (`/flags`). The three apps changed 0 lines of `src/core`. Evidence for the one-pager and recommendation is in [docs/client-comparison.md](docs/client-comparison.md). Enablement docs: [spec template](docs/spec-template.md), [PR review checklist](docs/pr-review-checklist.md), [pilot access checklist](docs/pilot-checklist.md).

> Synthetic data only. No real credentials or customer data. Not production software; no compliance claims.

**Cut and known gaps at a glance** (details at the end):
- Cut: builder for non-engineers, connectors (incl. the P1 mock payments API), real-IdP integration test, Postgres, partial-refund adjustment, flag segments other than plan tier.
- Gaps: audit log is tamper-evident, not tamper-proof; rate limit and audit write queue are in-memory (one process only); `src/middleware.ts` uses Next 16's deprecated `middleware` convention.

## Run it (one command)

Requires Node 22.

```bash
npm install && npm run setup && npm run dev   # http://localhost:3000
```

`npm run setup` creates `.env`, the SQLite schema (`prisma/dev.db`) and the seed. SQLite paths in `DATABASE_URL` are relative to the repo root. Then:

- `npm run demo:reset`: restore the seed state (10,000 cases, 4 users, empty audit log) in about 1 second.
- `npm run demo:tamper`: edit one audit row directly in the database. Click **Verify chain** on `/audit` and it turns red, naming the broken entry.

Sign in through the local dev IdP and pick a user:

| User | Role | Can |
| --- | --- | --- |
| Vera | viewer | read the queue (sensitive fields masked), Policy and Rules pages |
| Riley | reviewer | approve (first or second approval), reject, escalate, reveal masked fields |
| Avery | approver | the above, plus read the audit log |
| Adam | admin | the above, plus verify and export the audit log |

The seed: ages 0 to 30 days, mostly recent, so a minority of open cases is past the 7-day review target and shows as overdue. All three risk tiers. Pending refunds at exactly $4,999, $5,000 and $5,001 (`ORD-LIMIT-*`, requested by `u-support-1`). One KYC case in every status (`c-00001` to `c-00005`). Every case awaiting a second approval already has a first approval from Avery.

## Architecture

| Path | What it holds |
| --- | --- |
| `src/config/policy.ts` | Roles, permissions, IdP group-to-role mapping, public allowlist, reveal rate limit. The one file to edit to change who can do what. |
| `src/config/approval-rules.ts` | Maker-checker limits (refunds above $5,000 and high-risk KYC need two approvals) and review targets. Shown read-only on `/rules`. |
| `src/config/auth.ts` | IdP selection (`IDP=dev` or `IDP=oidc`), session settings, dev users. |
| `src/core/auth/` | `IdentityProvider` interface, local dev IdP, generic OIDC adapter (discovery, PKCE, JWKS), signed httpOnly, sameSite session cookie. |
| `src/core/authz.ts` | `withPolicy(permission, handler)`, `publicRoute`, `requirePage`. Denials return a plain-language reason and write an audit entry. |
| `src/core/route-policy.ts` | Scans `src/app` for every route's policy. Powers the read-only `/policy` page and its default-deny check. |
| `src/core/audit.ts` | Hash-chained append, chain verification, CSV export. |
| `src/core/validation.ts` | zod schemas for every query string, body and route parameter. |
| `src/core/cases.ts`, `decisions.ts` | Generic case queue (server-side filter, sort, page) and approve/reject/escalate/reveal. |
| `src/apps/kyc.ts`, `refunds.ts`, `flags.ts` | The three apps: thin modules on the core. KYC and refunds reuse the case queue, approvals and audit; flags add a `Flag`/`FlagChange` model and reuse roles, maker-checker and the audit chain. |
| `src/middleware.ts` | Login redirect for pages, 401 for APIs, Origin check on every state-changing request (CSRF), request id. |
| `src/components/ui.tsx` | The one in-repo component set: list footer ("50 of 10,000, 42 ms"), empty, error and status notices. |

Database access goes through Prisma, which parameterizes queries. The only raw SQL is the tagged-template `$executeRaw` in `scripts/tamper-audit.ts`, which is parameterized too.

Swapping the IdP is configuration only: set `IDP=oidc`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `SESSION_SECRET` and optionally `OIDC_SCOPES`. Roles come from the `groups` claim through `GROUP_ROLE_MAP`. Documented, not demonstrated against a real IdP.

## What is tested

`npm test` runs 104 tests. Files and test names start with their PRD ID. CI runs `npm audit`, lint, typecheck, tests and build, plus a gitleaks secret scan.

| ID | Test files | What they prove |
| --- | --- | --- |
| P0-1 Sign-in | `p0-1-signin` | Unauthenticated pages redirect to `/login` and APIs return 401. Forged sessions are rejected. The dev IdP round trip works. State mismatch and open redirects are refused. An empty `SESSION_SECRET` falls back safely. |
| P0-2 Roles | `p0-2-roles`, `p0-2-csrf-and-validation` | A viewer calling approve gets 403, a plain-language reason and an `access.denied` audit entry. Cross-site or Origin-less writes are refused. Invalid queries, unknown body fields and malformed ids return 400. |
| P0-3 Work queue | `p0-3-queue`, `p0-3-seed` | 10,000 cases. The first page returns in under 500 ms. Status and age filters run in SQL with `WHERE`/`LIMIT`. The seed has the required spread and boundary rows, and `demo:reset` finishes in under 10 s. |
| P0-4 Maker-checker | `p0-4-maker-checker` | Self-approval is refused. At the limit, one approver is enough; above it, a second distinct approver is required. Concurrent approvals stay consistent. |
| P0-5 Audit log | `p0-5-audit`, `p0-5-reveal-rate-limit` | Every decision and reveal records actor, action, entity, before/after, time, request id and previous hash. Verify fails after a direct edit or delete. Concurrent writes keep the chain intact. CSV export works. Reveals beyond 10 per minute return 429 and are audited. |
| P0-6 Default deny | `p0-6-default-deny`, `p0-6-policy-page` | Fails on any route or page without a declared policy or allowlist entry. The `/policy` scan flags the same problems. |
| Apps | `app-kyc`, `app-refunds`, `app-flags` | The KYC queue shows open KYC cases oldest first, with age against target. The refunds totals by status match the database. A production flag change waits for a second, distinct approver; non-production changes apply immediately; the tier-gated flag reaches enterprise only; the kill switch turns a flag off everywhere and cancels pending changes. All of it is audited. |

Measured locally (SQLite, 10,000 cases): queue pages 5–20 ms; `demo:reset` about 1.5 s. App size: KYC 116 lines, refunds 163, flags 505 (incl. 60 of schema/config/seed); core code changed by the apps: 0 lines.

## What is cut and why

- **Builder for non-engineers.** Devin needs an engineer in the loop; this is the largest product gap against Power Apps.
- **Connectors**, including the PRD's P1 mock payments API. They're built one at a time; Power Apps ships hundreds.
- **Real-IdP integration test.** It needs a tenant and credentials, which are out of scope for synthetic-only sessions.
- **Postgres.** SQLite keeps the demo to one command.
- **Partial-refund adjustment.** The audit entries already record the amount before and after, but there's no UI to adjust an amount.
- **Flag segments other than plan tier.** The PRD asks for plan tier; other segments follow the same pattern.

## Known gaps

- The audit log is **tamper-evident, not tamper-proof**: a database admin could rewrite the whole chain. Anchoring the head hash outside the database would close that gap.
- The audit write queue and the reveal rate limiter live in process memory, so they are correct for one instance only. Several instances would need row or advisory locks and a shared store.
- Upgraded to Next 16, Prisma 7 (driver adapter `@prisma/adapter-better-sqlite3`, client generated to `src/generated/prisma`) and Vitest 5 so `npm audit --audit-level=high` passes. 16 moderate advisories remain, all in ESLint plugins via `minimatch` (dev-only tooling, no non-breaking fix).
- Next 16 renamed `middleware` to `proxy` (Node runtime). The file stays `src/middleware.ts` because the P0-1 and P0-6 tests import it by that path, and the rule is not to edit tests; Next still runs it, with a deprecation warning.
- CSRF protection is an Origin check plus sameSite cookies, with no per-form token. There is no session revocation list.
- `/policy` scans source files at runtime, so it needs the repo on disk (true for `npm run dev` and `npm start` here).

## Defects found

Defects found during the build, before review:

- Concurrent audited writes on SQLite hit socket timeouts because each waited on the single writer lock. Fixed by queueing audited transactions in-process; the unique `prevHash` column still rejects a forked chain if several processes write.

- Found by end-to-end testing, missed by unit tests: with `SESSION_SECRET=""` (the `.env.example` default) the session key was an empty string. Node accepted it, but the Edge middleware's WebCrypto did not, so every signed-in page redirected back to `/login`. Fixed by falling back to the dev key on an empty value, with a regression test.

Defects a reviewer finds that the tests missed go here.

The session log, including corrections, is in [docs/devin-log.md](docs/devin-log.md).

## Change log (P1-2)

| # | Change request | Request to merge | Review minutes |
| --- | --- | --- | --- |
| 1 | _pending_ | | |
| 2 | _pending_ | | |
| 3 | _pending_ | | |
