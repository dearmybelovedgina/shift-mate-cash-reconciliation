import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DenominationCounter, FieldError, Notice, PageHeader, Panel } from "@/components/shift/ui";
import { BreakdownTable } from "@/components/shift/BreakdownTable";
import { useCountForm } from "@/components/shift/useCountForm";
import { computeBreakdown, countTotal, formatVND, parseAmount, validateAmount } from "@/lib/shift/calc";
import { useShifts } from "@/lib/shift/store";

export const Route = createFileRoute("/dong-ca")({
  head: () => ({
    meta: [
      { title: "Đóng ca — Shift-Mate" },
      { name: "description", content: "Nhập doanh thu tiền mặt POS, chi tiền mặt và đếm tiền cuối ca để so sánh dự kiến với thực tế." },
      { property: "og:title", content: "Đóng ca — Shift-Mate" },
      { property: "og:description", content: "So sánh tiền dự kiến và thực tế cuối ca." },
    ],
  }),
  component: CloseShiftPage,
});

function CloseShiftPage() {
  const { active } = useShifts();
  if (!active) return null;
  return <CloseShiftForm key={active.id} />;
}

function CloseShiftForm() {
  const { active, updateActive } = useShifts();
  const shift = active!;
  const form = useCountForm(shift.closing.lines);
  const [sales, setSales] = useState(shift.pos.cashSales?.toString() ?? "");
  const [outflows, setOutflows] = useState(shift.pos.cashOutflows?.toString() ?? "");
  const [touched, setTouched] = useState(false);

  const salesErr = validateAmount(sales, true);
  const outErr = validateAmount(outflows, true);

  function save() {
    setTouched(true);
    if (salesErr || outErr || form.hasError) return toast.error("Vui lòng kiểm tra lại các ô nhập");
    updateActive((s) => ({
      ...s,
      pos: { cashSales: parseAmount(sales), cashOutflows: parseAmount(outflows) },
      closing: { ...s.closing, lines: form.draftLines, countedAt: new Date().toISOString() },
    }));
    toast.success("Đã lưu số liệu đóng ca");
  }

  const preview = computeBreakdown({
    ...shift,
    pos: { cashSales: salesErr ? null : parseAmount(sales), cashOutflows: outErr ? null : parseAmount(outflows) },
    closing: { ...shift.closing, lines: form.draftLines, countedAt: "draft" },
  });
  const previewReady = !salesErr && !outErr && !form.hasError;

  return (
    <>
      <PageHeader step="Bước 3" title="Đóng ca" description="Nhập số liệu từ báo cáo POS và đếm tiền trong két." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Số liệu POS (nhập tay)">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sales" className="text-sm font-medium">Doanh thu tiền mặt POS</label>
                <input id="sales" inputMode="numeric" value={sales} placeholder="VD: 3200000" onChange={(e) => setSales(e.target.value)} className="tabular mt-1 h-10 w-full rounded-lg border bg-background px-3" />
                {touched && <FieldError>{salesErr}</FieldError>}
              </div>
              <div>
                <label htmlFor="out" className="text-sm font-medium">Chi tiền mặt đã ghi trong POS</label>
                <input id="out" inputMode="numeric" value={outflows} placeholder="0 nếu không có" onChange={(e) => setOutflows(e.target.value)} className="tabular mt-1 h-10 w-full rounded-lg border bg-background px-3" />
                {touched && <FieldError>{outErr}</FieldError>}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Khoản chi ở trạng thái “Đã ghi trong POS” nằm trong ô này và không bị trừ lần nữa. Khoản chi “Đã xác minh (ngoài POS)” sẽ được trừ thêm.
            </p>
          </Panel>
          <Panel title="Đếm tiền cuối ca">
            <DenominationCounter lines={shift.closing.lines} drafts={form.drafts} onDraftChange={form.setDraft} />
            <p className="tabular mt-3 text-right font-semibold">Tổng: {formatVND(countTotal(form.draftLines))}</p>
          </Panel>
        </div>
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Panel title="Dự kiến vs thực tế">
            {previewReady ? <BreakdownTable b={preview} /> : <Notice tone="info">Nhập đủ số liệu hợp lệ để xem kết quả.</Notice>}
          </Panel>
          {shift.opening.countedAt === null && <Notice tone="warning">Chưa lưu tiền đầu ca — kết quả có thể sai. <Link to="/mo-ca" className="underline">Mở ca</Link></Notice>}
          <Button size="lg" className="w-full" onClick={save}>Lưu đóng ca</Button>
          {shift.closing.countedAt && (
            <Button asChild variant="outline" className="w-full"><Link to="/kiem-tra">Kiểm tra chênh lệch</Link></Button>
          )}
        </div>
      </div>
    </>
  );
}
