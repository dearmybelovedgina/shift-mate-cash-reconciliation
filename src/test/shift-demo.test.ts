import { describe, expect, it } from "vitest";
import { computeBreakdown, emptyLines, normalizeException, suggestedStatus } from "@/lib/shift/calc";
import { isDemoModified, restoreDemoShift } from "@/lib/shift/demo";
import { makeSeedShifts } from "@/lib/shift/seed";
import type { Shift } from "@/lib/shift/types";

function matched(): Shift {
  const shift = makeSeedShifts().find((s) => s.id === "demo-matched");
  if (!shift) throw new Error("Missing matched demo");
  return shift;
}

describe("Edited demo detection and isolated restoration", () => {
  it("canonical matched demo remains reconciled at 7,330,000 VND", () => {
    const shift = matched();
    expect(isDemoModified(shift)).toBe(false);
    expect(computeBreakdown(shift)).toMatchObject({ expected: 7_330_000, actual: 7_330_000, discrepancy: 0 });
    expect(suggestedStatus(shift)).toBe("reconciled");
  });

  it("opening changed from 2m to 500k creates a 1.5m surplus and restoring preserves user shifts and other demo edits", () => {
    const shift = matched();
    shift.opening.lines = emptyLines().map((l) => ({ ...l, quantity: l.denomination === 500000 ? 1 : 0 }));
    const userShift: Shift = { ...matched(), id: "user-shift", isDemo: false, cashierName: "User fixture" };
    const otherDemo = makeSeedShifts().find((s) => s.id === "demo-expense");
    if (!otherDemo) throw new Error("Missing other demo");
    otherDemo.reconciliation.notes = "Other demo edit";
    expect(computeBreakdown(shift)).toMatchObject({ opening: 500_000, expected: 5_830_000, actual: 7_330_000, discrepancy: 1_500_000 });
    expect(isDemoModified(shift)).toBe(true);
    const restored = restoreDemoShift([userShift, shift, otherDemo], shift.id);
    expect(restored).toHaveLength(3);
    expect(restored[0]).toBe(userShift);
    expect(restored[2]).toBe(otherDemo);
    const restoredDemo = restored.find((s) => s.id === shift.id);
    if (!restoredDemo) throw new Error("Demo was deleted");
    expect(computeBreakdown(restoredDemo).discrepancy).toBe(0);
    expect(suggestedStatus(restoredDemo)).toBe("reconciled");
    expect(isDemoModified(restoredDemo)).toBe(false);
  });

  it("resaving count timestamps alone does not mark a demo as modified", () => {
    const shift = matched();
    shift.opening.countedAt = "2026-11-03T03:24:00Z";
    shift.closing.countedAt = "2026-11-03T03:25:00Z";
    expect(isDemoModified(shift)).toBe(false);
  });

  it("storage normalization and object key order do not mark unchanged demos as edited", () => {
    for (const shift of makeSeedShifts()) {
      shift.exceptions = shift.exceptions.map(normalizeException);
      expect(isDemoModified(shift)).toBe(false);
    }
  });

  it("user-created records are never treated as demos or restored, even with a canonical ID", () => {
    const userShift = { ...matched(), isDemo: false };
    expect(isDemoModified(userShift)).toBe(false);
    expect(restoreDemoShift([userShift], userShift.id)[0]).toBe(userShift);
  });
});