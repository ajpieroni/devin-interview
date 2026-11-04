import { IDP } from "@/config/auth";

// Public page.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const href = `/api/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <div className="auth-card">
      <div className="brand auth-brand"><span className="logo">N</span>Northwind Ops</div>
      <h1>Sign in</h1>
      <p className="muted">Use your company account. Access is based on your directory groups.</p>
      <a className="btn-primary" href={href}>Continue with company SSO</a>
      <p className="auth-foot">{IDP === "dev" ? "Demo environment: synthetic data, demo directory." : "Single sign-on via OIDC."}</p>
    </div>
  );
}
