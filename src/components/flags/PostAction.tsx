"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// A button that POSTs to `url`, optionally with a required reason, and shows
// the server's message on failure.
export function PostAction(props: { url: string; label: string; needsReason?: boolean; tone?: "danger" | "secondary"; confirm?: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (props.confirm && !window.confirm(props.confirm)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(props.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(props.needsReason ? { reason } : {}),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? `failed (${res.status})`);
    setReason("");
    router.refresh();
  }

  return (
    <span className="actions">
      {props.needsReason && <input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />}
      <button className={props.tone} disabled={busy} onClick={run}>{busy ? "Saving…" : props.label}</button>
      {error && <span className="error">{error}</span>}
    </span>
  );
}
