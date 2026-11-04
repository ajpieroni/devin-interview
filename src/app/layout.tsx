import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@/config/policy";
import { currentUser } from "@/core/authz";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Tools",
  description: "Shared internal-tools core: login, roles, approvals, audit",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <strong>Internal Tools</strong>
          {user && <Link href="/cases">Cases</Link>}
          {user && <Link href="/kyc">KYC</Link>}
          {user && can(user.roles, "audit:read") && <Link href="/audit">Audit log</Link>}
          {user && <Link href="/policy">Policy</Link>}
          {user && <Link href="/rules">Rules</Link>}
          <span className="spacer" />
          {user && (
            <>
              <span className="who">
                {user.name} · {user.roles.join(", ") || "no roles"}
              </span>
              <form action="/api/auth/logout" method="post">
                <button className="secondary" type="submit">Log out</button>
              </form>
            </>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
