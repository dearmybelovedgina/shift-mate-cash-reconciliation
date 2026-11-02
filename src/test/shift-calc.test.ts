import { describe, expect, it } from "vitest";
import { buildSuggestions, computeBreakdown, findConflicts, findDuplicates, openingDiscrepancy, suggestedStatus, validateAmount, validateQuantity } from "@/lib/shift/calc";
import { makeSeedShifts } from "@/lib/shift/seed";

const byId = (id: string) => makeSeedShifts().find((s) => s.id === id)!;

describe("Shift-Mate reconciliation rules", () => {
  it("matched shift has zero discrepancy and is reconciled", () => {
    const s = byId("demo-matched");
    const b = computeBreakdown(s);
    expect(b.expected).toBe(7_330_000);
    expect(b.discrepancy).toBe(0);
    expect(suggestedStatus(s)).toBe("reconciled");
  });

  it("expense accounted in POS is not double-counted", () => {
    const b = computeBreakdown(byId("demo-matched"));
    expect(b.confirmedOutflows).toBe(120_000);
  });

  it("verified unrecorded 50,000 VND expense is subtracted and shift is explained", () => {
    const s = byId("demo-expense");
    const b = computeBreakdown(s);
    expect(b.confirmedOutflows).toBe(50_000);
    expect(b.discrepancy).toBe(0);
    expect(suggestedStatus(s)).toBe("explained");
  });

  it("pending expense is not counted; unresolved shortage of 120,000", () => {
    const s = byId("demo-unresolved");
    const b = computeBreakdown(s);
    expect(b.discrepancy).toBe(-120_000);
    expect(suggestedStatus(s)).toBe("unresolved");
    const sug = buildSuggestions(s);
    expect(sug.find((x) => x.kind === "pending_expense")?.remainingIfConfirmed).toBe(-90_000);
    expect(sug.some((x) => x.kind === "recount")).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(validateQuantity("-1")).not.toBeNull();
    expect(validateQuantity("1.5")).not.toBeNull();
    expect(validateQuantity("3")).toBeNull();
    expect(validateAmount("0")).not.toBeNull();
    expect(validateAmount("abc")).not.toBeNull();
    expect(validateAmount("0", true)).toBeNull();
  });

  it("warns on duplicates and conflicting evidence", () => {
    const s = byId("demo-conflict");
    expect(findDuplicates(s.exceptions, s.exceptions[1]!, s.exceptions[1]!.id)).toHaveLength(1);
    const ids = findConflicts(s).map((c) => c.id);
    expect(ids).toContain("pos-outflow");
    expect(ids.some((i) => i.startsWith("dup-"))).toBe(true);
    expect(openingDiscrepancy(s)).toBe(-20_000);
  });

  it("correcting a duplicate (removing it) changes expected cash by its amount", () => {
    const s = byId("demo-conflict");
    const before = computeBreakdown(s).expected;
    const fixed = { ...s, exceptions: s.exceptions.filter((e) => e.id !== "c3") };
    expect(computeBreakdown(fixed).expected).toBe(before - 85_000);
  });
});
