import { APPROVAL_RULES, REQUESTER_CAN_APPROVE, REVIEW_TARGET_DAYS } from "@/config/approval-rules";
import { REVEAL_RATE_LIMIT } from "@/config/policy";
import { requirePage } from "@/core/authz";
import { money } from "@/core/format";

export default async function RulesPage() {
  await requirePage("session:read", "/rules");
  return (
    <>
      <h1>Approval rules</h1>
      <p className="muted">Read-only. Loaded from <code>src/config/approval-rules.ts</code>, the only place these limits are set.</p>
      <table>
        <thead>
          <tr><th>Case type</th><th>Approvals needed</th><th>Second approver when</th><th>Review target</th></tr>
        </thead>
        <tbody>
          {Object.entries(APPROVAL_RULES).map(([type, rule]) => (
            <tr key={type}>
              <td>{type}</td>
              <td>1, or 2 when the condition applies</td>
              <td>
                {rule.singleApproverLimitCents !== undefined && <>amount above {money(rule.singleApproverLimitCents)}</>}
                {rule.secondApproverRisks && <>risk is {rule.secondApproverRisks.join(" or ")}</>}
              </td>
              <td>{REVIEW_TARGET_DAYS[type] ? `${REVIEW_TARGET_DAYS[type]} days` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Always applies</h2>
      <table>
        <tbody>
          <tr><td>Requester may approve own item</td><td>{REQUESTER_CAN_APPROVE ? "yes" : "no (not configurable)"}</td></tr>
          <tr><td>Second approver must differ from the first</td><td>yes</td></tr>
          <tr><td>Reason required to reject or escalate</td><td>yes</td></tr>
          <tr><td>Masked-field reveals per user</td><td>{REVEAL_RATE_LIMIT.max} per {REVEAL_RATE_LIMIT.windowMs / 1000} s (<code>src/config/policy.ts</code>)</td></tr>
        </tbody>
      </table>
    </>
  );
}
