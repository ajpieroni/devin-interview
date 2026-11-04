# Spec template for a Devin task

Copy this into the Devin session or the ticket. A task is done when every acceptance test passes in CI and a named reviewer has approved the PR.

## Goal
One or two sentences: the user, the job, and why now.

## Scope
- In:
- Out (say it, so Devin doesn't build it):

## Requirements and acceptance tests
| ID | Requirement | Acceptance test (runnable) |
| --- | --- | --- |
| X-1 | | |

## Controls this change touches
- Roles and permissions (`src/config/policy.ts`): which permission does each new route declare?
- Approval rules (`src/config/approval-rules.ts`): any new limit or second-approver rule?
- Audit: which actions write an entry, with what before and after?
- Data: which fields are sensitive and masked by default?

## Constraints
- Synthetic data only; no production credentials.
- No new dependencies without saying why.
- Never edit, skip or weaken a test to make it pass.

## Demo
The exact clicks or commands a reviewer runs to see it work and to see it fail safely.
