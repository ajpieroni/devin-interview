import Link from "next/link";
import { listFlags } from "@/apps/flags";
import { FLAG_RULES } from "@/config/approval-rules";
import { requirePage } from "@/core/authz";
import { timed } from "@/core/timing";
import { EmptyState, ListFooter } from "@/components/ui";

export default async function FlagsPage() {
  await requirePage("flags:read", "/flags");
  const { value: flags, ms } = await timed(() => listFlags());
  return (
    <>
      <h1>Feature flags</h1>
      <p className="muted">
        Changes to {FLAG_RULES.protectedEnvironments.join(", ")} need a second, distinct approver; other environments apply immediately. Every change is in the audit log.
      </p>
      {flags.length === 0 ? (
        <EmptyState>No flags yet.</EmptyState>
      ) : (
        <table>
          <thead>
            <tr><th>Flag</th><th>Description</th>{FLAG_RULES.environments.map((e) => <th key={e}>{e}</th>)}<th>Pending</th></tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.key}>
                <td><Link href={`/flags/${f.key}`} className="mono">{f.key}</Link></td>
                <td>{f.description}</td>
                {FLAG_RULES.environments.map((e) => (
                  <td key={e}>
                    <span className={`badge ${f.envs[e].on ? "ok" : ""}`}>{f.envs[e].on ? "on" : "off"}</span>
                    {f.envs[e].plans.length > 0 && <span className="muted"> {f.envs[e].plans.join(", ")} only</span>}
                  </td>
                ))}
                <td>{f.pending > 0 ? <span className="badge medium">{f.pending} awaiting approval</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ListFooter shown={flags.length} total={flags.length} ms={ms} />
    </>
  );
}
