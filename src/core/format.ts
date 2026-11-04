export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function ageDays(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}
