# Pilot access checklist

Confirm each item with the client before the first Devin session touches their code.

| Area | Item | Owner | Done |
| --- | --- | --- | --- |
| Identity | OIDC app registered in Entra, Okta or Google (issuer, client id, secret in the vault); IdP groups mapped to `viewer`, `reviewer`, `approver`, `admin` in `src/config/policy.ts` | Client IT | |
| Source control | Devin has access to one repository through the Git integration (not personal tokens); branch protection with required reviewers on `main` | Client platform | |
| Named PR approvers | At least two named engineers per workflow; one of them reviews auth, audit and policy changes | Client eng lead | |
| Secrets | Dev-only credentials stored as Devin secrets; no production credentials in any session; rotation owner named | Client security | |
| Network path | Devin reaches only the repo, the package registry and the dev or staging environment; no path to production data stores | Client platform | |
| Test-data policy | Synthetic or masked data only; no real PII or customer records in sessions, logs or screenshots | Client compliance | |
| Environments | Dev and staging for the pilot; production deploys go through the client's existing release process | Client platform | |
| Audit evidence | Where audit logs land (SIEM), retention period, who signs off that the control mapping is acceptable | Client compliance | |
| Success measures | Review minutes per PR, request-to-merge time, post-merge defects, auditor feedback; baseline from the current Power App if available | Both | |
| Exit | Rollback plan: users switch back to the existing Power App; the repo stays with the client | Both | |
