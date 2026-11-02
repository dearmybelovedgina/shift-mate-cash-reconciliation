import { DENOMINATIONS, type CashCountLine, type ExceptionLog, type Shift } from "./types";

export const MAX_QTY = 10000;
export const MAX_AMOUNT = 1_000_000_000;

export function emptyLines(): CashCountLine[] {
  return DENOMINATIONS.map((denomination) => ({ denomination, quantity: 0 }));
}

export function countTotal(lines: CashCountLine[]): number {
  return lines.reduce((s, l) => s + l.denomination * l.quantity, 0);
}

/** Returns an error message (Vietnamese) or null if the raw quantity input is valid. */
export function validateQuantity(raw: string): string | null {
  if (raw.trim() === "") return null;
  if (!/^\d+$/.test(raw.trim())) return "Chỉ nhập số nguyên không âm";
  if (Number(raw) > MAX_QTY) return `Tối đa ${MAX_QTY.toLocaleString("vi-VN")} tờ`;
  return null;
}

/** Validates a VND amount. allowZero for POS fields. */
export function validateAmount(raw: string, allowZero = false): string | null {
  const v = raw.replace(/[.,\s]/g, "");
  if (v === "") return "Vui lòng nhập số tiền";
  if (!/^\d+$/.test(v)) return "Số tiền phải là số nguyên dương (VND)";
  const n = Number(v);
  if (!allowZero && n <= 0) return "Số tiền phải lớn hơn 0";
  if (n > MAX_AMOUNT) return "Số tiền quá lớn";
  return null;
}

export function parseAmount(raw: string): number {
  return Number(raw.replace(/[.,\s]/g, ""));
}

/**
 * Breakdown of expected closing cash.
 * expected = opening + POS cash sales − confirmed outflows ± confirmed adjustments
 * Anti double-count: expenses with status "accounted_in_pos" are already inside
 * pos.cashOutflows, and quick orders "accounted_in_pos" are inside pos.cashSales,
 * so they are NOT added again. Pending items are never counted.
 */
export function computeBreakdown(shift: Shift) {
  const opening = countTotal(shift.opening.lines);
  const cashSales = shift.pos.cashSales ?? 0;
  const posOutflows = shift.pos.cashOutflows ?? 0;
  const verifiedOffPosExpenses = sum(shift.exceptions.filter((e) => e.type === "expense" && e.status === "verified"));
  const verifiedOffPosQuickOrders = sum(shift.exceptions.filter((e) => e.type === "quick_order" && e.status === "verified"));
  const manualAdjustments = shift.reconciliation.adjustments.reduce((s, a) => s + a.amount, 0);
  const confirmedOutflows = posOutflows + verifiedOffPosExpenses;
  const expected = opening + cashSales - confirmedOutflows + verifiedOffPosQuickOrders + manualAdjustments;
  const actual = countTotal(shift.closing.lines);
  const closingReady = shift.pos.cashSales !== null && shift.pos.cashOutflows !== null && shift.closing.countedAt !== null;
  return {
    opening,
    cashSales,
    posOutflows,
    verifiedOffPosExpenses,
    verifiedOffPosQuickOrders,
    manualAdjustments,
    confirmedOutflows,
    expected,
    actual,
    discrepancy: actual - expected,
    closingReady,
  };
}

function sum(list: ExceptionLog[]) {
  return list.reduce((s, e) => s + e.amount, 0);
}

export function openingDiscrepancy(shift: Shift) {
  return countTotal(shift.opening.lines) - shift.handoverFloat;
}

/** Possible duplicates: same type & amount within 15 minutes. */
export function findDuplicates(list: ExceptionLog[], candidate: Pick<ExceptionLog, "type" | "amount" | "time">, ignoreId?: string) {
  const t = new Date(candidate.time).getTime();
  return list.filter(
    (e) =>
      e.id !== ignoreId &&
      e.type === candidate.type &&
      e.amount === candidate.amount &&
      Math.abs(new Date(e.time).getTime() - t) <= 15 * 60 * 1000,
  );
}

export interface Conflict {
  id: string;
  message: string;
}

/** Evidence that contradicts itself — shown as warnings, never auto-resolved. */
export function findConflicts(shift: Shift): Conflict[] {
  const out: Conflict[] = [];
  const inPosExpenses = sum(shift.exceptions.filter((e) => e.type === "expense" && e.status === "accounted_in_pos"));
  if (shift.pos.cashOutflows !== null && inPosExpenses > shift.pos.cashOutflows) {
    out.push({
      id: "pos-outflow",
      message: `Các khoản chi được đánh dấu "đã ghi POS" (${formatVND(inPosExpenses)}) lớn hơn tổng chi ghi trong POS (${formatVND(shift.pos.cashOutflows)}). Kiểm tra lại trạng thái hoặc số liệu POS.`,
    });
  }
  const inPosQuick = sum(shift.exceptions.filter((e) => e.type === "quick_order" && e.status === "accounted_in_pos"));
  if (shift.pos.cashSales !== null && inPosQuick > shift.pos.cashSales) {
    out.push({
      id: "pos-sales",
      message: `Đơn nhanh được đánh dấu "đã ghi POS" (${formatVND(inPosQuick)}) lớn hơn doanh thu tiền mặt POS (${formatVND(shift.pos.cashSales)}).`,
    });
  }
  const seen = new Set<string>();
  for (const e of shift.exceptions) {
    if (seen.has(e.id)) continue;
    const dups = findDuplicates(shift.exceptions, e, e.id);
    if (dups.length) {
      [e, ...dups].forEach((d) => seen.add(d.id));
      out.push({
        id: `dup-${e.id}`,
        message: `Có ${dups.length + 1} ghi nhận cùng loại, cùng số tiền ${formatVND(e.amount)} trong 15 phút — có thể bị ghi trùng. Xác nhận đây là các khoản riêng biệt hoặc xoá bản trùng.`,
      });
    }
  }

/**
 * Rule-based hints only. They describe possibilities ("có thể"), never a root cause.
 * - Shortage (actual < expected): a pending expense may explain it.
 * - Surplus (actual > expected): a pending quick order may explain it.
 * - Any non-zero discrepancy: suggest a recount.
 */
export function buildSuggestions(shift: Shift): Suggestion[] {
  const { discrepancy, closingReady } = computeBreakdown(shift);
  if (!closingReady || discrepancy === 0) return [];
  const out: Suggestion[] = [];
  for (const e of shift.exceptions) {
    if (e.status !== "pending") continue;
    if (e.type === "expense" && discrepancy < 0) {
      out.push({
        id: `s-${e.id}`,
        kind: "pending_expense",
        exceptionId: e.id,
        title: `Khoản chi chưa xác minh: ${e.description || "Không mô tả"}`,
        detail: `Có thể giải thích một phần chênh lệch thiếu. Cần kiểm tra hoá đơn/biên nhận trước khi xác nhận.`,
        remainingIfConfirmed: discrepancy + e.amount,
      });
    }
    if (e.type === "quick_order" && discrepancy > 0) {
      out.push({
        id: `s-${e.id}`,
        kind: "pending_quick_order",
        exceptionId: e.id,
        title: `Đơn nhanh chưa xác minh: ${e.description || "Không mô tả"}`,
        detail: `Có thể giải thích một phần tiền dư. Cần đối chiếu phiếu ghi tay trước khi xác nhận.`,
        remainingIfConfirmed: discrepancy - e.amount,
      });
    }
  }
  if (!shift.reconciliation.recountConfirmed) {
    out.push({
      id: "s-recount",
      kind: "recount",
      title: "Đếm lại tiền cuối ca",
      detail: "Sai sót khi đếm là khả năng phổ biến. Đếm lại từng mệnh giá và cập nhật ở màn Đóng ca.",
    });
  }
  return out;
}

export function suggestedStatus(shift: Shift) {
  const b = computeBreakdown(shift);
  if (!b.closingReady) return null;
  if (b.discrepancy !== 0) return "unresolved" as const;
  const hasAdjustments =
    shift.reconciliation.adjustments.length > 0 || b.verifiedOffPosExpenses > 0 || b.verifiedOffPosQuickOrders > 0;
  return hasAdjustments ? ("explained" as const) : ("reconciled" as const);
}

export function formatVND(n: number): string {
  return `${n.toLocaleString("vi-VN")} ₫`;
}

export function formatSigned(n: number): string {
  if (n === 0) return formatVND(0);
  return `${n > 0 ? "+" : "−"}${formatVND(Math.abs(n))}`;
}
