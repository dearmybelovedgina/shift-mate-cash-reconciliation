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

import { cashComponent, normalizeException, validateException } from "@/lib/shift/calc";
import type { ExceptionLog, Shift } from "@/lib/shift/types";

const qo = (o: Partial<ExceptionLog>): ExceptionLog => ({
  id: "q", type: "quick_order", amount: 100_000, description: "Đơn nhanh", time: "2026-11-02T10:00:00+07:00",
  status: "verified", evidence: "Phiếu #9", provenance: "Mất mạng", paymentMethod: "cash", cashAmount: null, qrAmount: null, attested: true, ...o,
});
const withEx = (list: ExceptionLog[]): Shift => ({ ...byId("demo-expense"), exceptions: list });
const base = computeBreakdown(withEx([])).expected;

describe("Quick orders by payment method", () => {
  it("verified cash quick order adds its full amount", () => {
    expect(computeBreakdown(withEx([qo({})])).expected).toBe(base + 100_000);
  });
  it("verified QR-only quick order adds zero cash", () => {
    expect(computeBreakdown(withEx([qo({ paymentMethod: "qr" })])).expected).toBe(base);
  });
  it("verified split quick order adds only the cash part", () => {
    expect(computeBreakdown(withEx([qo({ paymentMethod: "split", cashAmount: 30_000, qrAmount: 70_000 })])).expected).toBe(base + 30_000);
  });
  it("split must sum exactly to the order total", () => {
    expect(validateException(qo({ paymentMethod: "split", cashAmount: 30_000, qrAmount: 60_000 })).split).toBeDefined();
    expect(validateException(qo({ paymentMethod: "split", cashAmount: -1, qrAmount: 100_001 })).split).toBeDefined();
    expect(validateException(qo({ paymentMethod: "split", cashAmount: 0, qrAmount: 100_000 })).split).toBeUndefined();
  });
  it("quick order requires a payment method", () => {
    expect(validateException(qo({ paymentMethod: null, status: "pending" })).paymentMethod).toBeDefined();
  });
  it("pending and accounted-in-POS quick orders are never added", () => {
    expect(computeBreakdown(withEx([qo({ status: "pending" }), qo({ id: "q2", status: "accounted_in_pos" })])).expected).toBe(base);
  });
  it("pending QR-only order is follow-up only, with no surplus effect", () => {
    const s = withEx([qo({ paymentMethod: "qr", status: "pending" })]);
    const sug = buildSuggestions(s).find((x) => x.exceptionId === "q");
    expect(sug?.kind).toBe("followup");
    expect(sug?.remainingIfConfirmed).toBeUndefined();
  });
  it("pending cash expense is not suggested for a surplus", () => {
    const s: Shift = { ...withEx([{ ...qo({ status: "pending" }), type: "expense", paymentMethod: null }]), reconciliation: { adjustments: [{ id: "a", label: "", amount: -60_000, reason: "x", confirmedAt: "" }], recountConfirmed: true, status: null, notes: "" } };
    expect(computeBreakdown(s).discrepancy).toBeGreaterThan(0);
    expect(buildSuggestions(s).some((x) => x.kind === "pending_expense")).toBe(false);
  });
});

describe("Evidence rules for status transitions", () => {
  it("cannot verify or mark accounted without evidence and confirmation", () => {
    const e = qo({ evidence: "", attested: false, status: "pending" });
    expect(validateException(e)).toEqual({});
    expect(validateException(e, "verified").evidence).toBeDefined();
    expect(validateException(e, "verified").attested).toBeDefined();
    expect(validateException(e, "accounted_in_pos").evidence).toBeDefined();
  });
  it("pending still requires a provenance note", () => {
    expect(validateException(qo({ status: "pending", provenance: "" })).provenance).toBeDefined();
  });
  it("arithmetic zero with a pending record is not 'reconciled'", () => {
    const s = byId("demo-matched");
    const withPending = { ...s, exceptions: [...s.exceptions, qo({ id: "p", paymentMethod: "qr", status: "pending" })] };
    expect(computeBreakdown(withPending).discrepancy).toBe(0);
    expect(suggestedStatus(withPending)).toBe("unresolved");
  });
});

describe("Legacy data migration", () => {
  it("legacy quick order without method stays pending and adds no cash", () => {
    const m = normalizeException({ id: "x", type: "quick_order", amount: 85_000, status: "verified", evidence: "Phiếu", description: "cũ", time: "2026-10-31T10:00:00Z" });
    expect(m.paymentMethod).toBeNull();
    expect(m.status).toBe("pending");
    expect(cashComponent(m)).toBe(0);
  });
  it("legacy verified expense keeps its status", () => {
    const m = normalizeException({ id: "y", type: "expense", amount: 50_000, status: "verified", evidence: "Biên nhận" });
    expect(m.status).toBe("verified");
    expect(m.provenance).toBe("");
  });
});
