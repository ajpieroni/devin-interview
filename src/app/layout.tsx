import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@/config/policy";
import { currentUser } from "@/core/authz";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northwind Ops",
  description: "Internal tools on one shared core: sign-in, roles, approvals, audit",
};

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  if (!user) {
    return (
      <html lang="en">
        <body className="auth-body">{children}</body>
      </html>
    );
  }
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand"><span className="logo">N</span>Northwind Ops</div>
            <nav>
              <div className="nav-group">Work</div>
              <Link href="/kyc">KYC review</Link>
              <Link href="/refunds">Refunds</Link>
              <Link href="/flags">Feature flags</Link>
              <Link href="/cases">All cases</Link>
              <div className="nav-group">Controls</div>
              {can(user.roles, "audit:read") && <Link href="/audit">Audit log</Link>}
              <Link href="/policy">Access policy</Link>
              <Link href="/rules">Approval rules</Link>
            </nav>
            <div className="me">
              <span className="avatar">{initials(user.name)}</span>
              <div>
                <div className="me-name">{user.name}</div>
                <div className="me-role">{user.roles.join(", ") || "no roles"}</div>
              </div>
              <form action="/api/auth/logout" method="post">
                <button className="link" type="submit" title="Sign out">Sign out</button>
              </form>
            </div>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
