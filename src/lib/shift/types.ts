// Domain model for Shift-Mate (cash shift reconciliation).
export const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000] as const;

export interface CashCountLine {
  denomination: number;
  quantity: number;
}

export interface CashCount {
  kind: "opening" | "closing";
  lines: CashCountLine[];
  countedAt: string | null;
}

export type ExceptionType = "expense" | "quick_order";
export type ExceptionStatus = "pending" | "verified" | "accounted_in_pos";
/** Actual payment method of a quick order. null = unknown (legacy data) — never assumed to be cash. */
export type PaymentMethod = "cash" | "qr" | "split";

export interface ExceptionLog {
  id: string;
  type: ExceptionType;
  amount: number;
  description: string;
  time: string; // ISO
  status: ExceptionStatus;
  /** Evidence / reference (receipt no., handwritten slip no., POS bill ID). Typed text only — not independently verified. */
  evidence: string;
  /** Provenance/context note, required even when pending (e.g. "chưa có biên nhận, quản lý gọi mua gấp"). */
  provenance: string;
  /** Quick orders only. null for expenses or unknown legacy records. */
  paymentMethod: PaymentMethod | null;
  /** Split quick orders only: cash part and QR part (sum must equal amount). */
  cashAmount: number | null;
  qrAmount: number | null;
  /** Staff ticked the confirmation checkbox matching the current non-pending status. */
  attested: boolean;
}

export interface POSSummary {
  cashSales: number | null;
  /** Cash outflows already recorded inside the POS (refunds, payouts, expenses entered in POS). */
  cashOutflows: number | null;
}

export interface Adjustment {
  id: string;
  label: string;
  /** Signed: + adds to expected cash, − subtracts. */
  amount: number;
  reason: string;
  confirmedAt: string;
}

export type ReconciliationStatus = "reconciled" | "explained" | "unresolved";

export interface Reconciliation {
  adjustments: Adjustment[];
  recountConfirmed: boolean;
  status: ReconciliationStatus | null;
  notes: string;
}

export interface Shift {
  id: string;
  label: string;
  isDemo: boolean;
  cashierName: string;
  date: string;
  /** Float handed over by previous shift — used to flag opening discrepancy. */
  handoverFloat: number;
  opening: CashCount;
  exceptions: ExceptionLog[];
  pos: POSSummary;
  closing: CashCount;
  reconciliation: Reconciliation;
}
