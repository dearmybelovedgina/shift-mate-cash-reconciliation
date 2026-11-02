import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatSigned, formatVND, validateQuantity } from "@/lib/shift/calc";
import type { CashCountLine, ExceptionStatus, ReconciliationStatus } from "@/lib/shift/types";
import { Inbox } from "lucide-react";

export function PageHeader({ step, title, description, actions }: { step?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {step && <p className="text-xs font-semibold uppercase tracking-wider text-primary">{step}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone = "default", hint }: { label: string; value: string; tone?: "default" | "success" | "warning" | "danger" | "primary"; hint?: string | undefined }) {
  const tones = {
    default: "bg-card",
    primary: "bg-primary-soft",
    success: "bg-success-soft",
    warning: "bg-warning-soft",
    danger: "bg-destructive-soft",
  };
  const text = { default: "text-foreground", primary: "text-primary", success: "text-success", warning: "text-warning-foreground", danger: "text-destructive" };
  return (
    <div className={cn("rounded-2xl border p-4 shadow-card", tones[tone])}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 text-xl font-bold sm:text-2xl", text[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function discrepancyTone(n: number) {
  return n === 0 ? "success" : n < 0 ? "danger" : "warning";
}

export function DiscrepancyBadge({ value }: { value: number }) {
  const tone = discrepancyTone(value);
  const cls = { success: "bg-success-soft text-success", danger: "bg-destructive-soft text-destructive", warning: "bg-warning-soft text-warning-foreground" }[tone];
  const label = value === 0 ? "Khớp" : value < 0 ? "Thiếu" : "Dư";
  return (
    <span className={cn("tabular inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", cls)}>
      {label} {value !== 0 && formatSigned(value)}
    </span>
  );
}

const exceptionStatusMeta: Record<ExceptionStatus, { label: string; cls: string }> = {
  pending: { label: "Chờ xác minh", cls: "bg-warning-soft text-warning-foreground" },
  verified: { label: "Đã xác minh (ngoài POS)", cls: "bg-primary-soft text-primary" },
  accounted_in_pos: { label: "Đã ghi trong POS", cls: "bg-success-soft text-success" },
};
export const EXCEPTION_STATUS_LABEL = Object.fromEntries(Object.entries(exceptionStatusMeta).map(([k, v]) => [k, v.label])) as Record<ExceptionStatus, string>;

export function ExceptionStatusBadge({ status }: { status: ExceptionStatus }) {
  const m = exceptionStatusMeta[status];
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", m.cls)}>{m.label}</span>;
}

export const RECON_LABEL: Record<ReconciliationStatus, string> = {
  reconciled: "Đã khớp",
  explained: "Đã giải trình",
  unresolved: "Chưa giải quyết",
};

export function ReconBadge({ status }: { status: ReconciliationStatus | null }) {
  if (!status) return <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Chưa đủ dữ liệu</span>;
  const cls = { reconciled: "bg-success-soft text-success", explained: "bg-primary-soft text-primary", unresolved: "bg-destructive-soft text-destructive" }[status];
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", cls)}>{RECON_LABEL[status]}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-muted px-6 py-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  const cls = {
    info: "bg-primary-soft text-accent-foreground border-primary/20",
    warning: "bg-warning-soft text-warning-foreground border-warning/30",
    danger: "bg-destructive-soft text-destructive border-destructive/30",
    success: "bg-success-soft text-success border-success/30",
  }[tone];
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", cls)}>{children}</div>;
}

/** Banknote counter: quantity per denomination, with per-row validation. */
export function DenominationCounter({
  lines,
  drafts,
  onDraftChange,
}: {
  lines: CashCountLine[];
  drafts: Record<number, string>;
  onDraftChange: (denomination: number, raw: string) => void;
}) {
  return (
    <div className="divide-y rounded-xl border">
      <div className="grid grid-cols-[1fr_96px_1fr] gap-3 bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>Mệnh giá</span>
        <span className="text-center">Số tờ</span>
        <span className="text-right">Thành tiền</span>
      </div>
      {lines.map((l) => {
        const raw = drafts[l.denomination] ?? (l.quantity ? String(l.quantity) : "");
        const err = validateQuantity(raw);
        const qty = err ? 0 : Number(raw || 0);
        return (
          <div key={l.denomination} className="px-3 py-2">
            <div className="grid grid-cols-[1fr_96px_1fr] items-center gap-3">
              <span className="tabular font-semibold">{l.denomination.toLocaleString("vi-VN")}</span>
              <input
                inputMode="numeric"
                aria-label={`Số tờ ${l.denomination.toLocaleString("vi-VN")} đồng`}
                aria-invalid={!!err}
                value={raw}
                placeholder="0"
                onChange={(e) => onDraftChange(l.denomination, e.target.value)}
                className={cn(
                  "tabular h-10 w-full rounded-lg border bg-background px-2 text-center outline-none focus:ring-2 focus:ring-ring",
                  err && "border-destructive focus:ring-destructive",
                )}
              />
              <span className="tabular text-right text-sm text-muted-foreground">{formatVND(qty * l.denomination)}</span>
            </div>
            {err && <p className="mt-1 text-right text-xs text-destructive">{err}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-destructive">{children}</p>;
}
