# Internal tools prototype: shared core

A prototype that tests one idea: build the control plane of internal tools (sign-in, roles, approvals, audit log) once, in code, then let Devin add thin apps on top of it cheaply. It is the comparison point for the client's Power Apps setup.

This PR contains the **shared core only**. The three apps (KYC review queue, refunds dashboard, feature-flag admin) are later Devin sessions; see [Cut list](#cut-list).

> Synthetic data only. No real credentials or customer data. This is not production software and makes no compliance claims.

## Quick start

Requires Node 22.

```bash
npm install
npm run setup      # creates .env, the SQLite schema and 10,000 synthetic cases
npm run dev        # http://localhost:3000
```

Sign in through the local dev IdP and choose a user:

| User | Role | Can |
| --- | --- | --- |
| Vera | viewer | read the queue (sensitive fields masked) |
| Riley | reviewer | approve (first or second approval), reject, escalate, reveal masked fields |
| Avery | approver | the above, plus read the audit log |
| Adam | admin | the above, plus verify and export the audit log |

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. CI runs all four on every pull request.

Tamper demo: `npm run demo:tamper`, then click **Verify chain** on `/audit`; verification fails and names the first broken entry.

## Layout

| Path | What it holds |
| --- | --- |
| `src/config/policy.ts` | Roles, permissions, IdP group-to-role mapping. The one file to edit to change who can do what. |
| `src/config/approval-rules.ts` | Maker-checker limits ($5,000 refund limit; high-risk KYC needs two approvals). |
| `src/config/auth.ts` | IdP selection (`IDP=dev` or `IDP=oidc`), session settings, dev users. |
| `src/core/auth/` | `IdentityProvider` interface, local dev IdP, generic OIDC adapter (discovery, PKCE, JWKS), signed session cookie. |
| `src/core/authz.ts` | `withPolicy(permission, handler)`, `publicRoute`, `requirePage`. Denials are audited. |
| `src/core/audit.ts` | Hash-chained append, chain verification, CSV export. |
| `src/core/cases.ts`, `decisions.ts` | Generic case queue (server-side filter/sort/page) and approve/reject/escalate/reveal. |
| `src/middleware.ts` | Redirects unauthenticated pages to `/login`, returns 401 for APIs, stamps a request id. |
| `tests/` | One acceptance file per P0 item. |

### Swapping the IdP

Configuration only, no code change: set `IDP=oidc`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `SESSION_SECRET`, and optionally `OIDC_SCOPES`. The adapter reads the issuer's discovery document, so Entra ID, Okta and Google all fit. Roles come from the `groups` claim through `GROUP_ROLE_MAP` in `src/config/policy.ts`. Documented, not demonstrated against a real IdP.

## P0 acceptance tests

| ID | Test file | What it proves |
| --- | --- | --- |
| P0-1 Sign-in | `tests/p0-1-signin.test.ts` | Unauthenticated page requests redirect to `/login`, APIs return 401, forged sessions are rejected, the dev IdP round trip works, OAuth state mismatch and open redirects are refused. |
| P0-2 Roles | `tests/p0-2-roles.test.ts` | A viewer calling approve gets 403 and an `access.denied` audit entry; role checks run on the server for reveal and audit routes. |
| P0-3 Work queue | `tests/p0-3-queue.test.ts` | 10,000 seeded cases; first page under 500 ms; status and age filters run in SQL with `WHERE` and `LIMIT` (asserted on the emitted query), never loading all rows. |
| P0-4 Maker-checker | `tests/p0-4-maker-checker.test.ts` | Requester self-approval is refused; at-limit refunds need one approver, above-limit need a second distinct one; concurrent approvals stay consistent. |
| P0-5 Audit log | `tests/p0-5-audit.test.ts` | Each decision and reveal records actor, action, entity, before/after, time, request id and previous hash; verify passes on a clean chain and fails after a direct edit or delete; concurrent writes keep the chain intact; CSV export. |
| P0-6 Default deny | `tests/p0-6-default-deny.test.ts` | Lists every API route and page and fails on any without a declared policy or an explicit public allowlist entry. |

The audit log is **tamper-evident, not tamper-proof**: a database admin could rewrite the whole chain. Anchoring the head hash outside the database would close that gap.

## Measurements

| Metric | Result |
| --- | --- |
| First queue page, 10,000 cases, local SQLite | ~20 ms (target < 500 ms) |
| Filtered page (`status=pending&minAgeDays=30`) | ~2 ms |
| Acceptance tests | 62 passing |
| Human review minutes per PR | _to fill in_ |
| Compute spend per session | _to fill in_ |

## Change log (P1-2)

| # | Change request | Request to merge | Review minutes |
| --- | --- | --- | --- |
| 1 | _pending_ | | |
| 2 | _pending_ | | |
| 3 | _pending_ | | |

## Defects found

Defects found during the build, before review:

- Concurrent audited writes on SQLite hit socket timeouts because each waited on the single writer lock. Fixed by queueing audited transactions in-process; the unique `prevHash` column still rejects a forked chain if several processes write.

- Found by end-to-end testing, missed by unit tests: with `SESSION_SECRET=""` (the `.env.example` default) the session key was an empty string. Node accepted it, but the Edge middleware's WebCrypto did not, so every signed-in page redirected back to `/login`. Fixed by falling back to the dev key on an empty value, with a regression test.

Defects a reviewer finds that the tests missed go here.

## Cut list

- KYC review queue, refunds dashboard and feature-flag admin apps (next Devin sessions, built on this core).
- Feature-flag change auditing exists only as the generic `writeAudit` call; no flag model yet.
- No real IdP tested; OIDC adapter is covered by type checks and design, not an integration test.
- SQLite only. Postgres would replace the in-process write queue with row locks or advisory locks.
- No rate limiting, CSRF tokens beyond SameSite cookies, or session revocation list.
- No external anchoring of the audit chain head.
