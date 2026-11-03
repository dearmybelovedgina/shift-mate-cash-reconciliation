import { describe, expect, it } from "vitest";
import { computeBreakdown } from "@/lib/shift/calc";
import { reconciliationSummary } from "@/lib/shift/presentation";
import { makeSeedShifts } from "@/lib/shift/seed";
import type { Shift } from "@/lib/shift/types";

function matchedShift(): Shift {
  const shift = makeSeedShifts().find((s) => s.id === "demo-matched");
  if (!shift) throw new Error("Missing matched fixture");
  return shift;
}

describe("Separate cash matching from overall reconciliation", () => {
  it("zero cash discrepancy remains incomplete with pending exceptions, even with a saved matched status", () => {
    const shift = matchedShift();
    shift.reconciliation.status = "reconciled";
    shift.exceptions.push({
      id: "pending-ux", type: "expense", amount: 50_000, description: "Chi chưa xác minh",
      time: "2026-11-03T10:00:00Z", status: "pending", evidence: "", provenance: "Phiếu ghi tay",
      paymentMethod: null, cashAmount: null, qrAmount: null, attested: false,
    });
    expect(computeBreakdown(shift).expected).toBe(7_330_000);
    expect(computeBreakdown(shift).discrepancy).toBe(0);
    expect(reconciliationSummary(shift)).toMatchObject({ pendingCount: 1, conflictCount: 0, incomplete: true });
  });

  it("zero cash discrepancy remains incomplete with conflicting evidence and no pending exceptions", () => {
    const shift = matchedShift();
    const expense = shift.exceptions.find((e) => e.type === "expense");
    if (!expense) throw new Error("Missing expense fixture");
    expense.evidence = "";
    expect(computeBreakdown(shift).discrepancy).toBe(0);
    expect(reconciliationSummary(shift)).toMatchObject({ pendingCount: 0, conflictCount: 1, incomplete: true });
  });

  it("a matched shift without unresolved items has neither pending nor conflict warnings", () => {
    expect(reconciliationSummary(matchedShift())).toMatchObject({ pendingCount: 0, conflictCount: 0, incomplete: false });
  });
});