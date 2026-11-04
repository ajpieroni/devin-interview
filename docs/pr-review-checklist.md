# PR review checklist for Devin changes

Review the control paths hardest; every app inherits their flaws.

**Every PR**
- [ ] CI green: `npm audit`, lint, typecheck, tests, build, secret scan.
- [ ] The tests map to the spec's acceptance tests and are named by requirement ID. No test was edited, skipped or loosened to pass.
- [ ] No new dependency without a stated reason; no secrets or real data in code, fixtures or screenshots.
- [ ] Scope matches the spec; anything extra is removed or split out.

**Auth and roles (P0-1, P0-2, P0-6)**
- [ ] Every new route is wrapped in `withPolicy(permission, ...)`, and every page calls `requirePage(...)`; `/policy` still shows the default-deny check passing.
- [ ] Any new public route is added to the allowlist on purpose, with a reason in the PR.
- [ ] Denials return a plain message and write an `access.denied` entry.

**Approvals (P0-4)**
- [ ] Limits come from `src/config/approval-rules.ts`, not hard-coded.
- [ ] The requester cannot approve; a second approver must be a distinct person.

**Audit (P0-5)**
- [ ] Each decision or change writes actor, action, entity, before, after and request id in the same transaction as the change.
- [ ] Sensitive values never appear in audit `before`/`after`.
- [ ] `Verify chain` still passes after the demo.

**Input and data**
- [ ] Every query, body and route param is validated with a zod schema; bad input returns 400.
- [ ] State-changing requests go through the CSRF check; no raw SQL outside tagged templates.

**Run it**
- [ ] Reviewer ran `npm run demo:reset`, clicked the demo in the spec, and saw it fail safely as a viewer.
