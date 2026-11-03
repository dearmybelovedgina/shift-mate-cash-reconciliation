import { makeSeedShifts } from "./seed";
import type { Shift } from "./types";

function businessSnapshot(shift: Shift) {
  return JSON.stringify({
    ...shift,
    opening: { ...shift.opening, countedAt: shift.opening.countedAt !== null },
    closing: { ...shift.closing, countedAt: shift.closing.countedAt !== null },
    reconciliation: {
      ...shift.reconciliation,
      adjustments: shift.reconciliation.adjustments.map((a) => ({ ...a, confirmedAt: Boolean(a.confirmedAt) })),
    },
  }, (_key, value: unknown) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  });
}

export function isDemoModified(shift: Shift): boolean {
  if (!shift.isDemo) return false;
  const canonical = makeSeedShifts().find((s) => s.id === shift.id);
  return canonical !== undefined && businessSnapshot(shift) !== businessSnapshot(canonical);
}

/** Replace only the matching known demo; all other records retain their identity. */
export function restoreDemoShift(shifts: Shift[], id: string): Shift[] {
  const canonical = makeSeedShifts().find((s) => s.id === id);
  if (!canonical) return shifts;
  return shifts.map((s) => s.id === id && s.isDemo ? canonical : s);
}