import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Circle, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiscrepancyBadge, FieldError, Panel, PageHeader, ReconBadge, ReconciliationNotice, Stat } from "@/components/shift/ui";
import { reconciliationSummary } from "@/lib/shift/presentation";
import { computeBreakdown, formatVND, parseAmount, suggestedStatus, validateAmount } from "@/lib/shift/calc";
import { useShifts } from "@/lib/shift/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tổng quan ca — Shift-Mate" },
      { name: "description", content: "Theo dõi tiến độ mở ca, ngoại lệ, đóng ca và đối soát tiền mặt." },
      { property: "og:title", content: "Tổng quan ca — Shift-Mate" },
      { property: "og:description", content: "Trợ lý đối soát tiền mặt cuối ca cho thu ngân F&B." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { active, state, setActive, createShift, deleteShift, resetDemo } = useShifts();
  const [name, setName] = useState("");
  const [float, setFloat] = useState("2000000");
  const [errors, setErrors] = useState<{ name?: string | undefined; float?: string | undefined }>({});

  if (!active) return null;
  const b = computeBreakdown(active);
  const summary = reconciliationSummary(active);
  const status = summary.incomplete ? "unresolved" : active.reconciliation.status ?? suggestedStatus(active);

  const steps = [
    { to: "/mo-ca", label: "Mở ca", done: active.opening.countedAt !== null },
    { to: "/ngoai-le", label: "Ghi ngoại lệ", done: active.exceptions.length > 0 },
    { to: "/dong-ca", label: "Đóng ca", done: b.closingReady },
    { to: "/kiem-tra", label: "Kiểm tra chênh lệch", done: b.closingReady && b.discrepancy === 0 && !summary.incomplete },
    { to: "/ban-giao", label: "Bàn giao", done: active.reconciliation.status !== null },
  ] as const;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      name: name.trim() ? undefined : "Vui lòng nhập tên thu ngân",
      float: validateAmount(float, true) ?? undefined,
    };
    setErrors(next);
    if (next.name || next.float) return;
    createShift(name.trim(), parseAmount(float));
    setName("");
    toast.success("Đã tạo ca mới");
  }

  return (
    <>
      <PageHeader title={active.label} description={`Thu ngân: ${active.cashierName} · Ngày ${active.date}`} actions={<ReconBadge status={status} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tiền đầu ca" value={formatVND(b.opening)} tone="primary" />
        <Stat label="Doanh thu tiền mặt POS" value={active.pos.cashSales === null ? "—" : formatVND(b.cashSales)} />
        <Stat label="Tiền dự kiến cuối ca" value={b.closingReady ? formatVND(b.expected) : "—"} />
        <Stat
          label="Chênh lệch (thực − dự kiến)"
          value={b.closingReady ? formatVND(b.discrepancy) : "—"}
          tone={!b.closingReady ? "default" : b.discrepancy === 0 ? "success" : b.discrepancy < 0 ? "danger" : "warning"}
          hint={b.closingReady ? undefined : "Hoàn tất Đóng ca để tính"}
        />
      </div>

      <div className="mt-4"><ReconciliationNotice shift={active} /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Tiến độ ca">
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.to}>
                <Link to={s.to} className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-accent">
                  {s.done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-sm font-medium">
                    {i + 1}. {s.label}
                  </span>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Tạo ca mới">
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div>
              <label className="text-sm font-medium" htmlFor="cashier">Tên thu ngân</label>
              <input id="cashier" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3" />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="float">Tiền bàn giao từ ca trước (VND)</label>
              <input id="float" inputMode="numeric" value={float} onChange={(e) => setFloat(e.target.value)} className="tabular mt-1 h-10 w-full rounded-lg border bg-background px-3" />
              <FieldError>{errors.float}</FieldError>
            </div>
            <Button type="submit" className="w-full"><Plus className="h-4 w-4" /> Tạo ca</Button>
          </form>
        </Panel>
      </div>

      <Panel title="Tất cả ca" className="mt-6" action={
        <Button variant="outline" size="sm" onClick={() => { if (confirm("Khôi phục dữ liệu demo? Các ca bạn tạo sẽ bị xoá.")) { resetDemo(); toast.success("Đã khôi phục dữ liệu demo"); } }}>
          <RotateCcw className="h-4 w-4" /> Khôi phục demo
        </Button>
      }>
        <ul className="divide-y">
          {state.shifts.map((s) => {
            const sb = computeBreakdown(s);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <button onClick={() => setActive(s.id)} className="min-w-0 flex-1 text-left">
                  <p className={s.id === active.id ? "font-semibold text-primary" : "font-medium"}>{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.cashierName} · {s.date}</p>
                </button>
                {sb.closingReady ? <DiscrepancyBadge value={sb.discrepancy} /> : <span className="text-xs text-muted-foreground">Chưa đóng ca</span>}
                <Button variant="ghost" size="icon" aria-label="Xoá ca" onClick={() => { if (confirm(`Xoá "${s.label}"?`)) deleteShift(s.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
