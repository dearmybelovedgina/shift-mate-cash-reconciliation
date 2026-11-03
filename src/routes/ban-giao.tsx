import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXCEPTION_STATUS_LABEL, EmptyState, FieldError, Notice, PageHeader, Panel, RECON_LABEL, ReconBadge } from "@/components/shift/ui";
import { computeBreakdown, formatSigned, formatVND, openIssues, openingDiscrepancy, suggestedStatus } from "@/lib/shift/calc";
import { useShifts } from "@/lib/shift/store";
import type { ReconciliationStatus, Shift } from "@/lib/shift/types";
import { reconciliationSummary } from "@/lib/shift/presentation";

export const Route = createFileRoute("/ban-giao")({
  head: () => ({
    meta: [
      { title: "Bàn giao ca — Shift-Mate" },
      { name: "description", content: "Chốt trạng thái đối soát, ghi chú và sao chép báo cáo bàn giao ca." },
      { property: "og:title", content: "Bàn giao ca — Shift-Mate" },
      { property: "og:description", content: "Báo cáo bàn giao ca có thể sao chép." },
    ],
  }),
  component: HandoverPage,
});

function buildReport(s: Shift, status: ReconciliationStatus, notes: string) {
  const b = computeBreakdown(s);
  const summary = reconciliationSummary(s);
  const lines = [
    `BÁO CÁO BÀN GIAO CA — Shift-Mate${s.isDemo ? " [DỮ LIỆU DEMO]" : ""}`,
    `Ca: ${s.label} | Ngày: ${s.date} | Thu ngân: ${s.cashierName}`,
    `Trạng thái: ${RECON_LABEL[status]}`,
    "",
    `Tiền đầu ca: ${formatVND(b.opening)} (lệch so với bàn giao: ${formatSigned(openingDiscrepancy(s))})`,
    `Doanh thu tiền mặt POS: ${formatVND(b.cashSales)}`,
    `Chi đã ghi trong POS: ${formatVND(b.posOutflows)}`,
    `Chi đã xác minh ngoài POS: ${formatVND(b.verifiedOffPosExpenses)}`,
    `Tiền mặt từ đơn nhanh đã xác minh ngoài POS: ${formatVND(b.verifiedOffPosQuickOrders)}`,
    `QR từ đơn nhanh đã xác minh ngoài POS (không tính vào tiền mặt): ${formatVND(b.verifiedOffPosQr)}`,
    `Điều chỉnh khác: ${formatSigned(b.manualAdjustments)}`,
    `Tiền dự kiến: ${formatVND(b.expected)}`,
    `Tiền thực tế: ${formatVND(b.actual)}`,
    `Chênh lệch: ${formatSigned(b.discrepancy)}`,
    ...(b.discrepancy === 0 && summary.incomplete ? [`Tiền mặt đang khớp, nhưng ca chưa hoàn tất đối soát do còn ${summary.reasons}.`] : []),
    "",
    "Ngoại lệ:",
    ...(s.exceptions.length
      ? s.exceptions.map((e) => `- ${e.type === "expense" ? "Chi" : `Đơn nhanh (${e.paymentMethod === "cash" ? "tiền mặt" : e.paymentMethod === "qr" ? "QR" : e.paymentMethod === "split" ? `kết hợp: TM ${formatVND(e.cashAmount ?? 0)}, QR ${formatVND(e.qrAmount ?? 0)}` : "chưa rõ hình thức"})`} ${formatVND(e.amount)} — ${e.description} [${EXCEPTION_STATUS_LABEL[e.status]}] (Nguồn: ${e.provenance || "—"}; BC: ${e.evidence || "chưa có"})`)
      : ["- Không có"]),
    ...(s.reconciliation.adjustments.length ? ["", "Điều chỉnh:", ...s.reconciliation.adjustments.map((a) => `- ${formatSigned(a.amount)}: ${a.reason}`)] : []),
    ...(openIssues(s).length ? ["", "Cảnh báo chưa xử lý:", ...openIssues(s).map((m) => `- ${m}`)] : []),
    "",
    `Ghi chú: ${notes.trim() || "(không có)"}`,
  ];
  return lines.join("\n");
}

function HandoverPage() {
  const { active } = useShifts();
  if (!active) return null;
  return <HandoverForm key={active.id} />;
}

function HandoverForm() {
  const { active, updateActive } = useShifts();
  const shift = active!;
  const b = computeBreakdown(shift);
  const suggested = suggestedStatus(shift);
  const [status, setStatus] = useState<ReconciliationStatus | null>(shift.reconciliation.status ?? suggested);
  const [notes, setNotes] = useState(shift.reconciliation.notes);
  const [error, setError] = useState<string | null>(null);

  if (!b.closingReady || !status) {
    return (
      <>
        <PageHeader step="Bước 5" title="Bàn giao ca" />
        <EmptyState title="Chưa thể bàn giao" description="Hoàn tất Đóng ca trước để có số liệu đối soát." action={<Button asChild><Link to="/dong-ca">Đến Đóng ca</Link></Button>} />
      </>
    );
  }

  function validate(st: ReconciliationStatus): string | null {
    if (st === "reconciled" && b.discrepancy !== 0) return "Chỉ chọn “Đã khớp” khi chênh lệch bằng 0.";
    if (st === "reconciled" && openIssues(shift).length) return "Không thể chọn “Đã khớp” khi còn khoản chưa xác minh, thiếu bằng chứng hoặc mâu thuẫn — kể cả khi chênh lệch bằng 0.";
    if (st === "explained" && openIssues(shift).length && notes.trim().length < 10) return "Còn khoản chưa xác minh/mâu thuẫn: cần ghi chú giải trình (ít nhất 10 ký tự).";
    if (st === "explained" && b.discrepancy !== 0 && notes.trim().length < 10) return "Còn chênh lệch: cần ghi chú giải trình rõ ràng (ít nhất 10 ký tự).";
    if (st === "unresolved" && notes.trim().length < 5) return "Ghi chú những gì đã kiểm tra để ca sau/quản lý tiếp tục.";
    return null;
  }

  function save() {
    const err = validate(status!);
    setError(err);
    if (err) return;
    updateActive((s) => ({ ...s, reconciliation: { ...s.reconciliation, status, notes } }));
    toast.success("Đã lưu bàn giao");
  }

  const report = buildReport(shift, status, notes);

  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
      toast.success("Đã sao chép báo cáo");
    } catch {
      toast.error("Không sao chép được. Hãy chọn và sao chép thủ công.");
    }
  }

  return (
    <>
      <PageHeader step="Bước 5" title="Bàn giao ca" description="Chốt trạng thái, ghi chú và gửi báo cáo cho quản lý hoặc ca sau." actions={<ReconBadge status={reconciliationSummary(shift).incomplete ? "unresolved" : shift.reconciliation.status} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Trạng thái đối soát">
          <div className="space-y-2">
            {(Object.keys(RECON_LABEL) as ReconciliationStatus[]).map((st) => (
              <label key={st} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${status === st ? "border-primary bg-primary-soft" : ""}`}>
                <input type="radio" name="status" checked={status === st} onChange={() => { setStatus(st); setError(null); }} />
                <span className="font-medium">{RECON_LABEL[st]}</span>
                {suggested === st && <span className="ml-auto text-xs text-primary">Gợi ý</span>}
              </label>
            ))}
          </div>
          <p className="tabular mt-3 text-sm">Chênh lệch hiện tại: <b>{formatSigned(b.discrepancy)}</b></p>
          <label htmlFor="notes" className="mt-4 block text-sm font-medium">Ghi chú bàn giao</label>
          <textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3 text-sm" placeholder="VD: Đã đếm lại 2 lần, còn thiếu 90.000 ₫ chưa rõ lý do" />
          <FieldError>{error}</FieldError>
          {openIssues(shift).length > 0 && <div className="mt-3"><Notice tone="warning">Vẫn còn {openIssues(shift).length} cảnh báo (khoản chưa xác minh, thiếu bằng chứng hoặc mâu thuẫn). Chúng sẽ được ghi trong báo cáo.</Notice></div>}
          <Button className="mt-4 w-full" onClick={save}>Lưu bàn giao</Button>
        </Panel>
        <Panel title="Báo cáo" action={<Button size="sm" variant="outline" onClick={copy}><Copy className="h-4 w-4" /> Sao chép</Button>}>
          <pre className="tabular max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-4 text-xs leading-relaxed">{report}</pre>
        </Panel>
      </div>
    </>
  );
}
