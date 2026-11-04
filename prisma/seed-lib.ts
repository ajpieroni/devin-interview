import type { PrismaClient } from "@prisma/client";

// Deterministic synthetic data. No real PII.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ana", "Ben", "Chen", "Dara", "Eli", "Fatima", "Gus", "Hana", "Ivan", "Jade", "Kofi", "Lena", "Mateo", "Nia", "Omar", "Priya"];
const LAST = ["Alvarez", "Brooks", "Chowdhury", "Dubois", "Eze", "Fischer", "Garcia", "Haddad", "Ito", "Jensen", "Kim", "Lopez", "Mensah", "Novak"];
const COUNTRIES = ["US", "GB", "DE", "BR", "IN", "NG", "SG", "MX", "CA", "FR"];
const REFUND_REASONS = ["Duplicate charge", "Service not received", "Fraud claim", "Cancelled subscription", "Billing error"];
const REFUND_REQUESTERS = ["u-riley", "u-avery", "u-support-1", "u-support-2", "u-support-3"];
const DAY_MS = 86_400_000;

export interface SeedOptions {
  count?: number;
  seed?: number;
  now?: Date;
}

export function generateCases({ count = 10_000, seed = 42, now = new Date() }: SeedOptions = {}) {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const rows = [];
  for (let i = 0; i < count; i++) {
    const type = i % 2 === 0 ? "kyc" : "refund";
    const createdAt = new Date(now.getTime() - Math.floor(r() * 60 * DAY_MS));
    const roll = r();
    const status = roll < 0.7 ? "pending" : roll < 0.8 ? "approved" : roll < 0.9 ? "rejected" : "escalated";
    const riskRoll = r();
    const risk = riskRoll < 0.6 ? "low" : riskRoll < 0.9 ? "medium" : "high";
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    if (type === "kyc") {
      rows.push({
        type,
        status,
        risk,
        requesterId: "applicant-portal",
        amountCents: 0,
        createdAt,
        data: JSON.stringify({ applicantName: name, country: pick(COUNTRIES), documentType: pick(["passport", "driver_license", "national_id"]) }),
        sensitive: JSON.stringify({
          governmentId: `ID-${Math.floor(r() * 1e9).toString().padStart(9, "0")}`,
          dateOfBirth: new Date(Date.UTC(1950 + Math.floor(r() * 50), Math.floor(r() * 12), 1 + Math.floor(r() * 28))).toISOString().slice(0, 10),
        }),
      });
    } else {
      const big = r() < 0.2;
      rows.push({
        type,
        status,
        risk,
        requesterId: pick(REFUND_REQUESTERS),
        amountCents: big ? 500_001 + Math.floor(r() * 1_500_000) : 1_000 + Math.floor(r() * 499_000),
        createdAt,
        data: JSON.stringify({ customer: name, reason: pick(REFUND_REASONS), orderId: `ORD-${100000 + i}` }),
        sensitive: "{}",
      });
    }
  }
  return rows;
}

export async function resetAndSeed(prisma: PrismaClient, opts: SeedOptions = {}) {
  await prisma.approval.deleteMany();
  await prisma.case.deleteMany();
  await prisma.auditEntry.deleteMany();
  const rows = generateCases(opts);
  for (let i = 0; i < rows.length; i += 1000) {
    await prisma.case.createMany({ data: rows.slice(i, i + 1000) });
  }
  return rows.length;
}
