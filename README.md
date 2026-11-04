# Internal tools prototype: shared core

**What it is.** A prototype that tests one idea: build the control plane of internal tools (sign-in, roles, maker-checker approvals, audit log) once, in code, and let Devin add thin apps on top of it cheaply. It is the comparison point for the client's Power Apps setup. This repo holds the **shared core only**. The three apps (KYC review queue, refunds dashboard, feature-flag admin) are later Devin sessions.

> Synthetic data only. No real credentials or customer data. Not production software; no compliance claims.

**Cut and known gaps at a glance** (details at the end):
- Cut: the three apps, real-IdP integration test, Postgres.
- Gaps: audit log is tamper-evident, not tamper-proof; rate limit and audit write queue are in-memory (one process only); `npm audit` reports advisories that need major upgrades (Next 16, Prisma 7, Vitest 5).

## Run it (one command)

Requires Node 22.

```bash
npm install && npm run setup && npm run dev   # http://localhost:3000
```

`npm run setup` creates `.env`, the SQLite schema and the seed. Then:

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
| `src/middleware.ts` | Login redirect for pages, 401 for APIs, Origin check on every state-changing request (CSRF), request id. |
| `src/components/ui.tsx` | The one in-repo component set: list footer ("50 of 10,000, 42 ms"), empty, error and status notices. |

Database access goes through Prisma, which parameterizes queries. The only raw SQL is the tagged-template `$executeRaw` in `scripts/tamper-audit.ts`, which is parameterized too.

Swapping the IdP is configuration only: set `IDP=oidc`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `SESSION_SECRET` and optionally `OIDC_SCOPES`. Roles come from the `groups` claim through `GROUP_ROLE_MAP`. Documented, not demonstrated against a real IdP.

## What is tested

`npm test` runs 80 tests. Files and test names start with their PRD ID. CI runs `npm audit`, lint, typecheck, tests and build, plus a gitleaks secret scan.

| ID | Test files | What they prove |
| --- | --- | --- |
| P0-1 Sign-in | `p0-1-signin` | Unauthenticated pages redirect to `/login` and APIs return 401. Forged sessions are rejected. The dev IdP round trip works. State mismatch and open redirects are refused. An empty `SESSION_SECRET` falls back safely. |
| P0-2 Roles | `p0-2-roles`, `p0-2-csrf-and-validation` | A viewer calling approve gets 403, a plain-language reason and an `access.denied` audit entry. Cross-site or Origin-less writes are refused. Invalid queries, unknown body fields and malformed ids return 400. |
| P0-3 Work queue | `p0-3-queue`, `p0-3-seed` | 10,000 cases. The first page returns in under 500 ms. Status and age filters run in SQL with `WHERE`/`LIMIT`. The seed has the required spread and boundary rows, and `demo:reset` finishes in under 10 s. |
| P0-4 Maker-checker | `p0-4-maker-checker` | Self-approval is refused. At the limit, one approver is enough; above it, a second distinct approver is required. Concurrent approvals stay consistent. |
| P0-5 Audit log | `p0-5-audit`, `p0-5-reveal-rate-limit` | Every decision and reveal records actor, action, entity, before/after, time, request id and previous hash. Verify fails after a direct edit or delete. Concurrent writes keep the chain intact. CSV export works. Reveals beyond 10 per minute return 429 and are audited. |
| P0-6 Default deny | `p0-6-default-deny`, `p0-6-policy-page` | Fails on any route or page without a declared policy or allowlist entry. The `/policy` scan flags the same problems. |

Measured locally (SQLite, 10,000 cases): first queue page about 20 ms; filtered page about 2 ms; `demo:reset` 0.6 s.

## What is cut and why

- **KYC review queue, refunds dashboard, feature-flag admin.** The PRD builds these in later sessions on this core, and the core is where review effort has to go first.
- **Feature-flag change auditing.** It exists only as the generic `writeAudit` call; there is no flag model until the flag app.
- **Real IdP integration test.** That needs a tenant and credentials, which are out of scope for synthetic-only sessions.
- **Postgres.** SQLite keeps the demo to one command.

## Known gaps

- The audit log is **tamper-evident, not tamper-proof**: a database admin could rewrite the whole chain. Anchoring the head hash outside the database would close that gap.
- The audit write queue and the reveal rate limiter live in process memory, so they are correct for one instance only. Several instances would need row or advisory locks and a shared store.
- `npm audit --audit-level=high` fails today. The fixes need major upgrades (Next 16 for postcss, Prisma 7, Vitest 5, ESLint 9 plugins), which are not in the PRD's scope without sign-off.
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
