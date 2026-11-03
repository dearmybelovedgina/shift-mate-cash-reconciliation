import { findConflicts } from "./calc";
import type { Shift } from "./types";

/** Display-only summary; cash calculations and reconciliation rules stay in calc.ts. */
export function reconciliationSummary(shift: Shift) {
  const pendingCount = shift.exceptions.filter((e) => e.status === "pending").length;
  const conflictCount = findConflicts(shift).length;
  const incomplete = pendingCount > 0 || conflictCount > 0;
  const reasons = [
    pendingCount > 0 ? `${pendingCount} ngoại lệ chưa xác minh` : null,
    conflictCount > 0 ? `${conflictCount} cảnh báo mâu thuẫn cần kiểm tra` : null,
  ].filter(Boolean).join(" / ");
  return { pendingCount, conflictCount, incomplete, reasons };
}