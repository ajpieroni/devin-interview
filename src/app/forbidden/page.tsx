// Public page.
export default function ForbiddenPage() {
  return (
    <div className="card">
      <h1>Not allowed</h1>
      <p>Your role does not permit this page. The attempt was recorded in the audit log.</p>
    </div>
  );
}
