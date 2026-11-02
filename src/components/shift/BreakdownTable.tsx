import { computeBreakdown, formatVND } from "@/lib/shift/calc";
import { DiscrepancyBadge } from "./ui";

type B = ReturnType<typeof computeBreakdown>;

export function BreakdownTable({ b }: { b: B }) {
  const rows: [string, number, string][] = [
    ["Tiền đầu ca", b.opening, "+"],
    ["Doanh thu tiền mặt POS", b.cashSales, "+"],
    ["Chi đã ghi trong POS", b.posOutflows, "−"],
    ["Chi đã xác minh ngoài POS", b.verifiedOffPosExpenses, "−"],
    ["Đơn nhanh đã xác minh ngoài POS", b.verifiedOffPosQuickOrders, "+"],
  ];
  return (
    <dl className="tabular space-y-2 text-sm">
      {rows.map(([label, v, sign]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{sign} {label}</dt>
          <dd>{formatVND(v)}</dd>
        </div>
      ))}
      {b.manualAdjustments !== 0 && (
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">± Điều chỉnh đã xác nhận</dt>
          <dd>{formatVND(b.manualAdjustments)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-3 border-t pt-2 font-semibold">
        <dt>Tiền dự kiến</dt>
        <dd>{formatVND(b.expected)}</dd>
      </div>
      <div className="flex justify-between gap-3 font-semibold">
        <dt>Tiền thực tế đếm được</dt>
        <dd>{formatVND(b.actual)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-2">
        <dt className="font-semibold">Chênh lệch</dt>
        <dd><DiscrepancyBadge value={b.discrepancy} /></dd>
      </div>
    </dl>
  );
}
