import { IDP } from "@/config/auth";

// Public page.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const href = `/api/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <div className="card" style={{ maxWidth: 420, margin: "60px auto" }}>
      <h1>Sign in</h1>
      <p className="muted">Identity provider: {IDP === "dev" ? "local dev IdP (stand-in for the company IdP)" : "OIDC"}</p>
      <a href={href}>
        <button type="button">Continue to sign in</button>
      </a>
    </div>
  );
}
