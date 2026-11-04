"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <p>Something went wrong: {error.message}</p>
      <button type="button" onClick={reset}>Try again</button>
    </div>
  );
}
