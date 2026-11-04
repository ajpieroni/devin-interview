"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Env = string;
type State = { on: boolean; plans: string[] };

export function FlagChangeForm(props: { flagKey: string; envs: Record<Env, State>; planTiers: readonly string[]; protectedEnvs: readonly string[] }) {
  const router = useRouter();
  const envNames = Object.keys(props.envs);
  const [env, setEnv] = useState(envNames[0]);
  const [on, setOn] = useState(props.envs[envNames[0]].on);
  const [plans, setPlans] = useState<string[]>(props.envs[envNames[0]].plans);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function pickEnv(e: Env) {
    setEnv(e);
    setOn(props.envs[e].on);
    setPlans(props.envs[e].plans);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/flags/${props.flagKey}/changes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ env, on, plans, ...(reason.trim() ? { reason } : {}) }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: body.error ?? `failed (${res.status})` });
    setReason("");
    setMessage({ ok: true, text: body.status === "pending" ? `Submitted. ${env} changes need a second approver.` : `Applied to ${env}.` });
    router.refresh();
  }

  const isProtected = props.protectedEnvs.includes(env);
  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginTop: 0 }}>Change a value</h2>
      <div className="filters">
        <label>Environment
          <select value={env} onChange={(e) => pickEnv(e.target.value)}>
            {envNames.map((e) => <option key={e} value={e}>{e}{props.protectedEnvs.includes(e) ? " (needs approval)" : ""}</option>)}
          </select>
        </label>
        <label>Value
          <select value={on ? "on" : "off"} onChange={(e) => setOn(e.target.value === "on")}>
            <option value="on">on</option>
            <option value="off">off</option>
          </select>
        </label>
        <fieldset className="plans">
          <legend>Plan tiers (none = everyone)</legend>
          {props.planTiers.map((p) => (
            <label key={p} className="inline">
              <input type="checkbox" checked={plans.includes(p)} onChange={(e) => setPlans(e.target.checked ? [...plans, p] : plans.filter((x) => x !== p))} />
              {p}
            </label>
          ))}
        </fieldset>
        <label>Reason
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={isProtected ? "Why (shown to the approver)" : "Optional"} />
        </label>
        <button type="submit" disabled={busy}>{busy ? "Saving…" : isProtected ? "Request approval" : "Apply now"}</button>
      </div>
      {message && <p className={message.ok ? "muted" : "error"}>{message.text}</p>}
    </form>
  );
}
