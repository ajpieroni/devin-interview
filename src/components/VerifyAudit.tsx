"use client";

import { useState } from "react";
import { Notice } from "./ui";

type Result = { ok: boolean; checked: number; brokenAtId?: number; reason?: string };

export function VerifyAudit() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/audit/verify");
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? `failed (${res.status})`);
    setResult(body);
  }

  return (
    <span className="actions">
      <button onClick={verify} disabled={busy}>{busy ? "Verifying…" : "Verify chain"}</button>
      {result &&
        (result.ok ? (
          <Notice tone="ok">Chain intact: {result.checked.toLocaleString()} entries checked.</Notice>
        ) : (
          <Notice tone="bad">Chain broken at entry #{result.brokenAtId}: {result.reason}</Notice>
        ))}
      {error && <span className="error">{error}</span>}
    </span>
  );
}
