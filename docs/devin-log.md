# Devin session log

One row per Devin session. Times are America/New_York.

| # | Prompt summary | Start | End | PR | What Devin got wrong or the user corrected |
| --- | --- | --- | --- | --- | --- |
| 1 | Build the shared core from the PRD P0 table (sign-in, roles, queue, maker-checker, audit, default deny), tests and CI; then the PRD addendum (repeatable demo seed, `demo:reset`, audit filters and diff view, Policy and Rules pages, denial messages, list footers, zod validation, CSRF, reveal rate limit, `npm audit` and secret scan in CI, docs); then major upgrades (Next 16, Prisma 7, Vitest 5) so `npm audit` passes; then the three apps (KYC queue, refunds dashboard, feature-flag admin), each its own commit with 0 lines changed in `src/core`, and the client one-pager. | 2026-11-03 19:53 | in progress | [#1](https://github.com/ajpieroni/devin-interview/pull/1) | (1) Concurrent audited writes timed out on SQLite; fixed with an in-process write queue. (2) End-to-end testing found a sign-in loop: an empty `SESSION_SECRET` became an empty HMAC key that the Edge middleware rejected; unit tests had missed it. Fixed, with a regression test. (3) The first README role table overstated the approver and admin permissions; corrected before push. (4) The user tightened scope with the addendum: build only what the PRD lists, never weaken tests. (5) CI went red on the new `npm audit` step; the user chose the major upgrades. Prisma 7 removed `--skip-generate`, so `tests/global-setup.ts` (test infrastructure, not a test) changed that flag and the test DB path; no test assertions changed. (6) After the Prisma schema change for flags, the running dev server served a stale module (`FLAG_RULES` undefined); a restart fixed it. This was not a code defect. |

## Product feedback notes (evidence for the write-up)

Notes from this session's log, for the product-feedback section. Rewrite them in your own words.

**Did well**
- Built the core and then three apps without touching core code. The per-app commits show it.
- Wrote tests named by PRD requirement and kept them passing through a major-version upgrade (Next 16, Prisma 7, Vitest 5).
- End-to-end browser testing caught two defects that unit tests missed: the sign-in loop with an empty `SESSION_SECRET`, and the refunds filter select out of sync with the URL.

**Where a human had to step in**
- GitHub access: the Devin GitHub integration page showed a black screen. A deploy key was used to push, and a fine-grained token to open the PR. The first token pasted was a placeholder; Devin detected it was invalid (401) and asked again.
- Scope: the addendum tightened the rules (build only what the PRD lists, never weaken tests), and the user chose to take the major upgrades rather than leave CI red.
- Interpretation: "ages up to 30 days" needed a decision to fit an existing test.

**What I'd tell the product team**
- When the GitHub integration isn't installed, the setup path is unclear. A working installer, or a guided fallback (deploy key plus token), would save a long detour.
- Built-in PR tools failed with a personal token that had the right scopes, so the PR had to be created through the API. The error should say which credential was used.
- Recording browser tests per revision was the most persuasive evidence. Make it the default for UI changes.
