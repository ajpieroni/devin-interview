import type { PrismaClient } from "@prisma/client";
import { DEV_USERS } from "../src/config/auth";
import { rolesFromGroups } from "../src/config/policy";
import { requiredApprovals } from "../src/config/approval-rules";

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
const SUPPORT_AGENTS = ["u-support-1", "u-support-2", "u-support-3"];
const REFUND_REQUESTERS = ["u-riley", "u-avery", ...SUPPORT_AGENTS];
const STATUSES = ["pending", "awaiting_second_approval", "approved", "rejected", "escalated"] as const;
// Seeded first approvals on awaiting_second_approval cases come from this user.
const FIRST_APPROVER = "u-avery";
const DAY_MS = 86_400_000;
export const MAX_AGE_DAYS = 30;
export const BOUNDARY_REFUND_CENTS = [4_999_00, 5_000_00, 5_001_00];

export interface SeedOptions {
  count?: number;
  seed?: number;
  now?: Date;
}

interface CaseRow {
  id: string;
  type: string;
  status: string;
  risk: string;
  requesterId: string;
  amountCents: number;
  createdAt: Date;
  decidedAt: Date | null;
  data: string;
  sensitive: string;
}

export function generateSeed({ count = 10_000, seed = 42, now = new Date() }: SeedOptions = {}) {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const cases: CaseRow[] = [];
  const approvals: { caseId: string; userId: string; createdAt: Date }[] = [];
  const name = () => `${pick(FIRST)} ${pick(LAST)}`;
  // Whole-day ages 0..30: mostly recent, with a uniform tail so a minority of
  // open cases is overdue and every age bucket has rows.
  const createdAt = () => {
    const x = r() < 0.8 ? r() ** 3 : r();
    return new Date(now.getTime() - Math.floor(x * (MAX_AGE_DAYS + 1) * DAY_MS));
  };

  const add = (row: Omit<CaseRow, "id" | "decidedAt">) => {
    const id = `c-${String(cases.length + 1).padStart(5, "0")}`;
    const decided = row.status === "approved" || row.status === "rejected";
    cases.push({ ...row, id, decidedAt: decided ? new Date(Math.min(now.getTime(), row.createdAt.getTime() + DAY_MS)) : null });
    if (row.status === "awaiting_second_approval") approvals.push({ caseId: id, userId: FIRST_APPROVER, createdAt: row.createdAt });
  };
  const kyc = (status: string, risk: string, at: Date) =>
    add({
      type: "kyc",
      status,
      risk,
      requesterId: "applicant-portal",
      amountCents: 0,
      createdAt: at,
      data: JSON.stringify({ applicantName: name(), country: pick(COUNTRIES), documentType: pick(["passport", "driver_license", "national_id"]) }),
      sensitive: JSON.stringify({
        governmentId: `ID-${Math.floor(r() * 1e9).toString().padStart(9, "0")}`,
        dateOfBirth: new Date(Date.UTC(1950 + Math.floor(r() * 50), Math.floor(r() * 12), 1 + Math.floor(r() * 28))).toISOString().slice(0, 10),
      }),
    });
  const refund = (status: string, risk: string, amountCents: number, requesterId: string, at: Date, orderId: string) =>
    add({
      type: "refund",
      status,
      risk,
      requesterId,
      amountCents,
      createdAt: at,
      data: JSON.stringify({ customer: name(), reason: pick(REFUND_REASONS), orderId }),
      sensitive: "{}",
    });

  if (count >= STATUSES.length + BOUNDARY_REFUND_CENTS.length) {
    // One KYC case in every status (awaiting a second approval needs high risk).
    STATUSES.forEach((s, i) => kyc(s, s === "awaiting_second_approval" ? "high" : "medium", new Date(now.getTime() - (i + 1) * DAY_MS)));
    // Refunds just under, at and just over the single-approver limit.
    for (const cents of BOUNDARY_REFUND_CENTS) {
      refund("pending", "low", cents, "u-support-1", new Date(now.getTime() - DAY_MS), `ORD-LIMIT-${cents / 100}`);
    }
  }

  while (cases.length < count) {
    const i = cases.length;
    const at = createdAt();
    const riskRoll = r();
    const risk = riskRoll < 0.6 ? "low" : riskRoll < 0.9 ? "medium" : "high";
    const roll = r();
    const type = i % 2 === 0 ? "kyc" : "refund";
    const amountCents = type === "refund" ? (r() < 0.2 ? 5_000_01 + Math.floor(r() * 15_000_00) : 10_00 + Math.floor(r() * 4_990_00)) : 0;
    const needsTwo = requiredApprovals({ type, amountCents, risk }) > 1;
    const status =
      roll < 0.6 ? "pending" : roll < 0.68 ? (needsTwo ? "awaiting_second_approval" : "pending") : roll < 0.8 ? "approved" : roll < 0.9 ? "rejected" : "escalated";
    if (type === "kyc") kyc(status, risk, at);
    else {
      const requester = status === "awaiting_second_approval" ? pick(SUPPORT_AGENTS) : pick(REFUND_REQUESTERS);
      refund(status, risk, amountCents, requester, at, `ORD-${100000 + i}`);
    }
  }
  return { cases, approvals };
}

export function generateCases(opts: SeedOptions = {}) {
  return generateSeed(opts).cases;
}

export async function resetAndSeed(prisma: PrismaClient, opts: SeedOptions = {}) {
  const { cases, approvals } = generateSeed(opts);
  await prisma.$transaction([prisma.approval.deleteMany(), prisma.case.deleteMany(), prisma.auditEntry.deleteMany()]);
  for (const u of DEV_USERS) {
    const roles = rolesFromGroups(u.groups).join(",");
    await prisma.user.upsert({ where: { id: u.sub }, create: { id: u.sub, email: u.email, name: u.name, roles }, update: { email: u.email, name: u.name, roles } });
  }
  for (let i = 0; i < cases.length; i += 1000) {
    await prisma.case.createMany({ data: cases.slice(i, i + 1000) });
  }
  if (approvals.length) await prisma.approval.createMany({ data: approvals });
  return cases.length;
}
