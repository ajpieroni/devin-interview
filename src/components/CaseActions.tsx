"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const OPEN = ["pending", "awaiting_second_approval", "escalated"];

export function CaseActions(props: { caseId: string; status: string; canApprove: boolean; canDecide: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!OPEN.includes(props.status)) return null;
  if (!props.canApprove && !props.canDecide) return <p className="muted">Your role is read-only for this case.</p>;

  async function act(action: "approve" | "reject" | "escalate") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/cases/${props.caseId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "approve" ? {} : { reason }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `failed (${res.status})`);
      return;
    }
    setReason("");
    router.refresh();
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Decision</h2>
      <div className="actions">
        {props.canApprove && <button disabled={busy} onClick={() => act("approve")}>Approve</button>}
        {props.canDecide && (
          <>
            <input placeholder="Reason (required to reject or escalate)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ minWidth: 320 }} />
            <button className="danger" disabled={busy} onClick={() => act("reject")}>Reject</button>
            {props.status !== "escalated" && <button className="secondary" disabled={busy} onClick={() => act("escalate")}>Escalate</button>}
          </>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
