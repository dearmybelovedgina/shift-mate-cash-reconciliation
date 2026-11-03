import { act, renderHook } from "@testing-library/react";
import { expect, it, describe } from "vitest";
import { useCountForm } from "@/components/shift/useCountForm";
import { countTotal, validateQuantity } from "@/lib/shift/calc";
import { emptyLines } from "@/lib/shift/calc";
import type { CashCountLine } from "@/lib/shift/types";

const lines: CashCountLine[] = emptyLines();

describe("Blank denomination inputs count as zero", () => {
  it("blank input is valid and drafts start blank everywhere", () => {
    expect(validateQuantity("")).toBeNull();
    expect(validateQuantity("   ")).toBeNull();
    const { result } = renderHook(() => useCountForm(lines));
    expect(Object.values(result.current.drafts).every((v) => v === "")).toBe(true);
    expect(result.current.hasError).toBe(false);
    // Saved lines with everything blank are all zero.
    expect(result.current.draftLines.every((l) => l.quantity === 0)).toBe(true);
    expect(countTotal(result.current.draftLines)).toBe(0);
  });

  it("only one denomination populated: saved total is correct, blanks stay 0", () => {
    const { result } = renderHook(() => useCountForm(lines));
    act(() => result.current.setDraft(500000, "3"));
    const saved = result.current.draftLines;
    expect(saved.find((l) => l.denomination === 500000)!.quantity).toBe(3);
    expect(saved.filter((l) => l.denomination !== 500000).every((l) => l.quantity === 0)).toBe(true);
    expect(countTotal(saved)).toBe(1_500_000);
  });

  it("invalid values still block saving but count as 0, and reset clears drafts", () => {
    const { result } = renderHook(() => useCountForm(lines));
    act(() => result.current.setDraft(200000, "1.5"));
    expect(result.current.hasError).toBe(true);
    expect(result.current.draftLines.find((l) => l.denomination === 200000)!.quantity).toBe(0);
    act(() => result.current.reset());
    expect(result.current.hasError).toBe(false);
  });
});
