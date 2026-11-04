import { deniedMessage, isPermission } from "@/config/policy";
import { currentUser } from "@/core/authz";

// Public page.
export default async function ForbiddenPage({ searchParams }: { searchParams: Promise<{ need?: string; from?: string }> }) {
  const { need, from } = await searchParams;
  const user = await currentUser();
  const message =
    user && need && isPermission(need)
      ? deniedMessage(user.roles, need)
      : "Not allowed: your role does not permit this page. This attempt was recorded in the audit log.";
  return (
    <div className="card">
      <h1>Not allowed</h1>
      {from && <p className="muted mono">{from}</p>}
      <p>{message}</p>
    </div>
  );
}
