import Link from "next/link";
import { notFound } from "next/navigation";
import { evaluate, getFlag } from "@/apps/flags";
import { FLAG_RULES } from "@/config/approval-rules";
import { can } from "@/config/policy";
import { requirePage } from "@/core/authz";
import { HttpError } from "@/core/http";
import { parseJson } from "@/core/json";
import { FlagChangeForm } from "@/components/flags/FlagChangeForm";
import { PostAction } from "@/components/flags/PostAction";
import { EmptyState } from "@/components/ui";

export default async function FlagPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const user = await requirePage("flags:read", `/flags/${key}`);
  let flag;
  try {
    flag = await getFlag(key);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
  return (
    <>
      <p><Link href="/flags">← Flags</Link></p>
      <h1>Flag <span className="mono">{flag.key}</span></h1>
      <p className="muted">{flag.description}</p>

      <h2>Who sees it</h2>
      <table>
        <thead>
          <tr><th>Environment</th><th>Value</th><th>Targeting</th>{FLAG_RULES.planTiers.map((p) => <th key={p}>{p} plan</th>)}</tr>
        </thead>
        <tbody>
          {FLAG_RULES.environments.map((e) => (
            <tr key={e}>
              <td>{e}{FLAG_RULES.protectedEnvironments.includes(e) && <span className="muted"> (needs approval)</span>}</td>
              <td><span className={`badge ${flag.envs[e].on ? "ok" : ""}`}>{flag.envs[e].on ? "on" : "off"}</span></td>
              <td>{flag.envs[e].plans.length ? `${flag.envs[e].plans.join(", ")} only` : "everyone"}</td>
              {FLAG_RULES.planTiers.map((p) => <td key={p}>{evaluate(flag.envs[e], p) ? "sees it" : "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {can(user.roles, "flags:kill") && (
        <div className="card actions" style={{ marginTop: 16 }}>
          <strong>Kill switch</strong>
          <span className="muted">Turns this flag off in every environment now and cancels pending changes.</span>
          <PostAction url={`/api/flags/${flag.key}/kill`} label="Turn off everywhere" needsReason tone="danger" confirm={`Turn ${flag.key} off in every environment?`} />
        </div>
      )}

      <h2>Waiting for approval</h2>
      {flag.pending.length === 0 ? (
        <EmptyState>No pending changes.</EmptyState>
      ) : (
        <table>
          <thead>
            <tr><th>Environment</th><th>Proposed</th><th>Requested by</th><th>Reason</th><th /></tr>
          </thead>
          <tbody>
            {flag.pending.map((c) => (
              <tr key={c.id}>
                <td>{c.env}</td>
                <td>{c.on ? "on" : "off"}{c.plans.length > 0 && ` (${c.plans.join(", ")} only)`}</td>
                <td className="mono">{c.requesterId}</td>
                <td>{c.reason ?? "—"}</td>
                <td>
                  {can(user.roles, "flags:approve") ? (
                    <span className="actions">
                      <PostAction url={`/api/flag-changes/${c.id}/approve`} label="Approve" />
                      <PostAction url={`/api/flag-changes/${c.id}/reject`} label="Reject" needsReason tone="secondary" />
                    </span>
                  ) : (
                    <span className="muted">An approver or admin must approve.</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {can(user.roles, "flags:change") && (
        <div style={{ marginTop: 16 }}>
          <FlagChangeForm flagKey={flag.key} envs={flag.envs} planTiers={FLAG_RULES.planTiers} protectedEnvs={FLAG_RULES.protectedEnvironments} />
        </div>
      )}

      <h2>History (from the audit log)</h2>
      {flag.history.length === 0 ? (
        <EmptyState>No changes yet.</EmptyState>
      ) : (
        <table>
          <thead>
            <tr><th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Before</th><th>After</th></tr>
          </thead>
          <tbody>
            {flag.history.map((h) => (
              <tr key={h.id}>
                <td>{h.id}</td>
                <td>{h.createdAt.toLocaleString()}</td>
                <td className="mono">{h.actorId}</td>
                <td>{h.action}</td>
                <td className="mono">{JSON.stringify(parseJson(h.before ?? "null", null))}</td>
                <td className="mono">{JSON.stringify(parseJson(h.after ?? "null", null))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
