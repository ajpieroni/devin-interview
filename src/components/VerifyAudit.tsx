"use client";

import { useState } from "react";

type Result = { ok: boolean; checked: number; brokenAtId?: number; reason?: string };

export function VerifyAudit() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setError(null);
    const res = await fetch("/api/audit/verify");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setError(body.error ?? `failed (${res.status})`);
    setResult(body);
  }

  return (
    <span className="actions">
      <button onClick={verify}>Verify chain</button>
      {result && (result.ok
        ? <span className="badge ok">Chain intact · {result.checked} entries checked</span>
        : <span className="badge bad">Chain broken at entry #{result.brokenAtId}: {result.reason}</span>)}
      {error && <span className="error">{error}</span>}
    </span>
  );
}
