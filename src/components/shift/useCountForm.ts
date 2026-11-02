import { useState } from "react";
import { validateQuantity } from "@/lib/shift/calc";
import type { CashCountLine } from "@/lib/shift/types";

/** Keeps raw text per denomination so invalid input can be shown before saving. */
export function useCountForm(lines: CashCountLine[]) {
  const [drafts, setDrafts] = useState<Record<number, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.denomination, l.quantity ? String(l.quantity) : ""])),
  );
  const hasError = Object.values(drafts).some((v) => validateQuantity(v) !== null);
  const draftLines: CashCountLine[] = lines.map((l) => {
    const raw = drafts[l.denomination] ?? "";
    return { denomination: l.denomination, quantity: validateQuantity(raw) ? 0 : Number(raw || 0) };
  });
  return {
    drafts,
    hasError,
    draftLines,
    setDraft: (d: number, raw: string) => setDrafts((p) => ({ ...p, [d]: raw })),
    reset: () => setDrafts(Object.fromEntries(lines.map((l) => [l.denomination, ""]))),
  };
}
