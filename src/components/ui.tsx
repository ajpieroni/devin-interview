import type { ReactNode } from "react";

// Shared, plain building blocks so every page looks and behaves the same.

export function ListFooter({ shown, total, ms }: { shown: number; total: number; ms: number }) {
  return (
    <p className="list-footer">
      {shown.toLocaleString()} of {total.toLocaleString()}, {Math.round(ms)} ms
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="state">{children}</div>;
}

export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <div className="state state-error" role="alert">
      {children}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "bad"; children: ReactNode }) {
  return (
    <div className={`notice ${tone}`} role="status">
      {children}
    </div>
  );
}
