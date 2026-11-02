import { DENOMINATIONS, type CashCountLine, type ExceptionLog, type ExceptionStatus, type Shift } from "./types";

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
 * Cash part of a record. Expenses: full amount. Quick orders: only the CASH component —
 * QR-only = 0, split = cashAmount, unknown method (legacy) = 0 (never assumed cash).
 */
export function cashComponent(e: ExceptionLog): number {
  if (e.type === "expense") return e.amount;
  if (e.paymentMethod === "cash") return e.amount;
  if (e.paymentMethod === "split") return e.cashAmount ?? 0;
  return 0;
}

/**
 * Breakdown of expected closing cash.
 * expected = opening + POS cash sales − POS cash outflows − VERIFIED off-POS cash expenses
 *            + CASH part of VERIFIED off-POS quick orders + confirmed adjustments
 * Anti double-count: records "accounted_in_pos" are already inside the POS figures and are
 * NOT added again. Pending records are never counted.
 */
export function computeBreakdown(shift: Shift) {
  const opening = countTotal(shift.opening.lines);
  const cashSales = shift.pos.cashSales ?? 0;
  const posOutflows = shift.pos.cashOutflows ?? 0;
  const verified = shift.exceptions.filter((e) => e.status === "verified");
  const verifiedOffPosExpenses = sum(verified.filter((e) => e.type === "expense"));
  const verifiedQuick = verified.filter((e) => e.type === "quick_order");
  const verifiedOffPosQuickOrders = verifiedQuick.reduce((s, e) => s + cashComponent(e), 0);
  const verifiedOffPosQr = verifiedQuick.reduce((s, e) => s + (e.amount - cashComponent(e)), 0);
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
    verifiedOffPosQr,
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

export type ExceptionField = "amount" | "provenance" | "evidence" | "paymentMethod" | "split" | "attested";

/**
 * Validates a record (already-parsed numbers) for the given status. Used for every save AND
 * every status change, so no path can mark a record verified/accounted without evidence.
 */
export function validateException(e: ExceptionLog, status: ExceptionStatus = e.status): Partial<Record<ExceptionField, string>> {
  const err: Partial<Record<ExceptionField, string>> = {};
  if (!Number.isInteger(e.amount) || e.amount <= 0) err.amount = "Số tiền phải lớn hơn 0";
  if (e.provenance.trim().length < 3)
    err.provenance = "Ghi nguồn gốc/ngữ cảnh (VD: “phiếu ghi tay #3”, hoặc “chưa có biên nhận — lý do…”)";
  if (e.type === "quick_order") {
    if (!e.paymentMethod) err.paymentMethod = "Chọn hình thức thanh toán thực tế (tiền mặt / QR / kết hợp)";
    else if (e.paymentMethod === "split") {
      const c = e.cashAmount, q = e.qrAmount;
      if (c === null || q === null || !Number.isInteger(c) || !Number.isInteger(q) || c < 0 || q < 0)
        err.split = "Nhập phần tiền mặt và phần QR (số nguyên ≥ 0)";
      else if (c + q !== e.amount) err.split = `Tiền mặt + QR (${formatVND(c + q)}) phải bằng tổng đơn (${formatVND(e.amount)})`;
    }
  }
  if (status !== "pending") {
    if (e.evidence.trim().length < 3)
      err.evidence =
        status === "accounted_in_pos"
          ? "Cần mã/tham chiếu trong POS (VD: số hoá đơn POS) trước khi đánh dấu “Đã ghi trong POS”"
          : e.type === "expense"
            ? "Cần số hoá đơn/biên nhận hoặc người xác nhận trước khi xác minh"
            : "Cần số phiếu ghi tay/tham chiếu thanh toán trước khi xác minh";
    if (!e.attested) err.attested = "Cần tick xác nhận trước khi đổi trạng thái";
  }
  return err;
}

/** Confirmation text the staff must tick for a non-pending status. */
export function attestationText(type: ExceptionLog["type"], status: ExceptionStatus): string | null {
  if (status === "pending") return null;
  if (status === "accounted_in_pos")
    return "Tôi đã đối chiếu: khoản này có trong số liệu POS (theo mã tham chiếu trên), nên sẽ không được tính thêm lần nữa.";
  return type === "expense"
    ? "Tôi xác nhận tiền đã được chi từ két trong ca này và khoản này CHƯA được ghi trong POS."
    : "Tôi xác nhận đã nhận thanh toán theo hình thức trên và đơn này CHƯA được nhập vào POS.";
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
  const inPosQuick = shift.exceptions
    .filter((e) => e.type === "quick_order" && e.status === "accounted_in_pos")
    .reduce((s, e) => s + cashComponent(e), 0);
  if (shift.pos.cashSales !== null && inPosQuick > shift.pos.cashSales) {
    out.push({
      id: "pos-sales",
      message: `Phần tiền mặt của đơn nhanh được đánh dấu "đã ghi POS" (${formatVND(inPosQuick)}) lớn hơn doanh thu tiền mặt POS (${formatVND(shift.pos.cashSales)}).`,
    });
  }
  for (const e of shift.exceptions) {
    if (e.type !== "quick_order") continue;
    if (!e.paymentMethod) {
      out.push({ id: `method-${e.id}`, message: `Đơn nhanh “${e.description}” (${formatVND(e.amount)}) chưa có hình thức thanh toán. Không được tính vào tiền mặt cho đến khi nhân viên chọn tiền mặt/QR/kết hợp.` });
    } else if (e.paymentMethod === "split" && (e.cashAmount ?? -1) + (e.qrAmount ?? -1) !== e.amount) {
      out.push({ id: `split-${e.id}`, message: `Đơn nhanh “${e.description}”: phần tiền mặt + QR không bằng tổng đơn.` });
    }
  }
  for (const e of shift.exceptions) {
    if (e.status !== "pending" && e.evidence.trim().length < 3) {
      out.push({ id: `noev-${e.id}`, message: `“${e.description}” đang ở trạng thái đã xác minh/đã ghi POS nhưng thiếu bằng chứng/tham chiếu.` });
    }
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
  return out;
}

export interface Suggestion {
  id: string;
  kind: "pending_expense" | "pending_quick_order" | "followup" | "recount";
  title: string;
  detail: string;
  exceptionId?: string;
  /** Discrepancy after this suggestion would be confirmed. */
  remainingIfConfirmed?: number;
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
    if (e.type === "quick_order") {
      const cash = cashComponent(e);
      if (!e.paymentMethod || cash === 0) {
        // QR-only or unknown method: listed for follow-up only, no cash effect.
        out.push({
          id: `s-${e.id}`,
          kind: "followup",
          exceptionId: e.id,
          title: `Đơn nhanh cần theo dõi: ${e.description || "Không mô tả"}`,
          detail: e.paymentMethod
            ? "Đơn thanh toán QR — không ảnh hưởng tiền mặt trong két. Cần nhập bù vào POS/đối chiếu sau."
            : "Chưa rõ hình thức thanh toán — không tính vào tiền mặt. Sửa ở Nhật ký ngoại lệ để chọn hình thức.",
        });
      } else if (discrepancy > 0) {
        out.push({
          id: `s-${e.id}`,
          kind: "pending_quick_order",
          exceptionId: e.id,
          title: `Đơn nhanh chưa xác minh: ${e.description || "Không mô tả"}`,
          detail: `Phần tiền mặt (${formatVND(cash)}) có thể giải thích một phần tiền dư. Cần đối chiếu phiếu ghi tay trước khi xác nhận.`,
          remainingIfConfirmed: discrepancy - cash,
        });
      }
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

/** Open items that block "reconciled": pending records, contradictions, missing methods/evidence. */
export function openIssues(shift: Shift): string[] {
  const out = findConflicts(shift).map((c) => c.message);
  const pending = shift.exceptions.filter((e) => e.status === "pending");
  if (pending.length) out.push(`Còn ${pending.length} ngoại lệ chưa xác minh.`);
  return out;
}

export function suggestedStatus(shift: Shift) {
  const b = computeBreakdown(shift);
  if (!b.closingReady) return null;
  if (b.discrepancy !== 0) return "unresolved" as const;
  // Arithmetic zero is not enough when records are unverified or contradictory.
  if (openIssues(shift).length) return "unresolved" as const;
  const hasAdjustments =
    shift.reconciliation.adjustments.length > 0 || b.verifiedOffPosExpenses > 0 || b.verifiedOffPosQuickOrders > 0 || b.verifiedOffPosQr > 0;
  return hasAdjustments ? ("explained" as const) : ("reconciled" as const);
}

/** Defensive migration of stored records (older v1 data lacked method/provenance fields). */
export function normalizeException(raw: Partial<ExceptionLog> & { id: string; type: ExceptionLog["type"]; amount: number }): ExceptionLog {
  const isQuick = raw.type === "quick_order";
  const method = isQuick && (raw.paymentMethod === "cash" || raw.paymentMethod === "qr" || raw.paymentMethod === "split") ? raw.paymentMethod : null;
  const status: ExceptionStatus =
    raw.status === "verified" || raw.status === "accounted_in_pos" || raw.status === "pending" ? raw.status : "pending";
  return {
    id: raw.id,
    type: raw.type,
    amount: raw.amount,
    description: raw.description ?? "",
    time: raw.time ?? new Date(0).toISOString(),
    // Legacy quick order without a method stays unresolved until staff selects one.
    status: isQuick && !method ? "pending" : status,
    evidence: raw.evidence ?? "",
    provenance: raw.provenance ?? "",
    paymentMethod: method,
    cashAmount: method === "split" ? (raw.cashAmount ?? null) : null,
    qrAmount: method === "split" ? (raw.qrAmount ?? null) : null,
    attested: isQuick && !method ? false : (raw.attested ?? false),
  };
}

export function formatVND(n: number): string {
  return `${n.toLocaleString("vi-VN")} ₫`;
}

export function formatSigned(n: number): string {
  if (n === 0) return formatVND(0);
  return `${n > 0 ? "+" : "−"}${formatVND(Math.abs(n))}`;
}
