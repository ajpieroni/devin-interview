"use client";

import { useState } from "react";

export function RevealField(props: { caseId: string; field: string; canReveal: boolean }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/cases/${props.caseId}/reveal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: props.field }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? `failed (${res.status})`);
    setValue(String(body.value));
  }

  return (
    <span className="actions">
      <span className="mono">{value ?? "••••••"}</span>
      {value === null && props.canReveal && <button className="secondary" onClick={reveal} disabled={busy}>{busy ? "Revealing…" : "Reveal (audited)"}</button>}
      {error && <span className="error">{error}</span>}
    </span>
  );
}
