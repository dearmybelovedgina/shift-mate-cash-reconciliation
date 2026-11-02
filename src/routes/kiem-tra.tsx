import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Lightbulb, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BreakdownTable } from "@/components/shift/BreakdownTable";
import { EmptyState, FieldError, Notice, PageHeader, Panel, Stat } from "@/components/shift/ui";
import { buildSuggestions, computeBreakdown, findConflicts, formatSigned, formatVND, openingDiscrepancy, parseAmount, validateAmount, type Suggestion } from "@/lib/shift/calc";
import { useShifts } from "@/lib/shift/store";

export const Route = createFileRoute("/kiem-tra")({
  head: () => ({
    meta: [
      { title: "Kiểm tra chênh lệch — Shift-Mate" },
      { name: "description", content: "Gợi ý theo quy tắc để điều tra chênh lệch tiền mặt cuối ca. Người dùng xác nhận trước mọi điều chỉnh." },
      { property: "og:title", content: "Kiểm tra chênh lệch — Shift-Mate" },
      { property: "og:description", content: "Gợi ý điều tra chênh lệch tiền mặt cuối ca." },
    ],
  }),
  component: InvestigatePage,
});

function InvestigatePage() {
  const { active, updateActive } = useShifts();
  const [pending, setPending] = useState<Suggestion | null>(null);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjSign, setAdjSign] = useState<1 | -1>(-1);
  const [adjReason, setAdjReason] = useState("");
  const [adjConfirm, setAdjConfirm] = useState(false);
  const [adjErrors, setAdjErrors] = useState<{ amount?: string; reason?: string; confirm?: string }>({});
  if (!active) return null;

  const b = computeBreakdown(active);
  const conflicts = findConflicts(active);
  const suggestions = buildSuggestions(active);
  const openDiff = openingDiscrepancy(active);

  if (!b.closingReady) {
    return (
      <>
        <PageHeader step="Bước 4" title="Kiểm tra chênh lệch" />
        <EmptyState title="Chưa có số liệu đóng ca" description="Cần nhập doanh thu POS, chi POS và đếm tiền cuối ca trước khi kiểm tra." action={<Button asChild><Link to="/dong-ca">Đến Đóng ca</Link></Button>} />
      </>
    );
  }

  function confirmSuggestion() {
    if (!pending) return;
    if (pending.kind === "recount") {
      updateActive((s) => ({ ...s, reconciliation: { ...s.reconciliation, recountConfirmed: true } }));
      toast.success("Đã ghi nhận: đã đếm lại tiền");
    } else if (pending.exceptionId) {
      const id = pending.exceptionId;
      updateActive((s) => ({ ...s, exceptions: s.exceptions.map((e) => (e.id === id ? { ...e, status: "verified", evidence: e.evidence || "Xác nhận tại màn Kiểm tra" } : e)) }));
      toast.success("Đã xác minh khoản này — tiền dự kiến đã cập nhật");
    }
    setPending(null);
  }

  function addAdjustment(e: React.FormEvent) {
    e.preventDefault();
    const errs = {
      amount: validateAmount(adjAmount) ?? undefined,
      reason: adjReason.trim().length < 5 ? "Ghi rõ lý do (ít nhất 5 ký tự)" : undefined,
      confirm: adjConfirm ? undefined : "Cần xác nhận có bằng chứng",
    };
    setAdjErrors(errs);
    if (errs.amount || errs.reason || errs.confirm) return;
    updateActive((s) => ({
      ...s,
      reconciliation: {
        ...s.reconciliation,
        adjustments: [...s.reconciliation.adjustments, { id: crypto.randomUUID(), label: adjSign > 0 ? "Cộng vào dự kiến" : "Trừ khỏi dự kiến", amount: adjSign * parseAmount(adjAmount), reason: adjReason.trim(), confirmedAt: new Date().toISOString() }],
      },
    }));
    setAdjAmount(""); setAdjReason(""); setAdjConfirm(false);
    toast.success("Đã thêm điều chỉnh");
  }

  const tone = b.discrepancy === 0 ? "success" : b.discrepancy < 0 ? "danger" : "warning";

  return (
    <>
      <PageHeader step="Bước 4" title="Kiểm tra chênh lệch" description="Các gợi ý dưới đây chỉ là khả năng cần kiểm tra, không phải nguyên nhân đã được xác định." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Tiền dự kiến" value={formatVND(b.expected)} />
        <Stat label="Tiền thực tế" value={formatVND(b.actual)} />
        <Stat label="Chênh lệch" value={formatSigned(b.discrepancy)} tone={tone} hint={b.discrepancy === 0 ? "Khớp" : b.discrepancy < 0 ? "Thiếu tiền so với dự kiến" : "Dư tiền so với dự kiến"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {conflicts.length > 0 && (
            <Panel title="Bằng chứng mâu thuẫn">
              <ul className="space-y-2">
                {conflicts.map((c) => (
                  <li key={c.id}><Notice tone="danger"><span className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{c.message}</span></Notice></li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Sửa ở <Link to="/ngoai-le" className="text-primary underline">Nhật ký ngoại lệ</Link> hoặc <Link to="/dong-ca" className="text-primary underline">Đóng ca</Link>. Hệ thống không tự sửa.</p>
            </Panel>
          )}
          {openDiff !== 0 && <Notice tone="warning">Đầu ca đã lệch {formatSigned(openDiff)} so với tiền bàn giao. Chênh lệch này có thể liên quan, cần trao đổi với ca trước.</Notice>}

          <Panel title="Gợi ý kiểm tra">
            {b.discrepancy === 0 ? (
              <Notice tone="success">Không có chênh lệch. Bạn có thể chuyển sang <Link to="/ban-giao" className="underline">Bàn giao</Link>.</Notice>
            ) : suggestions.length === 0 ? (
              <EmptyState title="Không còn gợi ý theo quy tắc" description="Đã đếm lại và không còn khoản chờ xác minh phù hợp. Ghi chú lại và đánh dấu chưa giải quyết khi bàn giao." />
            ) : (
              <ul className="space-y-3">
                {suggestions.map((s) => (
                  <li key={s.id} className="rounded-xl border p-4">
                    <div className="flex gap-3">
                      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{s.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>
                        {s.remainingIfConfirmed !== undefined && (
                          <p className="tabular mt-1 text-xs">Nếu xác nhận, chênh lệch còn: <b>{formatSigned(s.remainingIfConfirmed)}</b></p>
                        )}
                        <div className="mt-3">
                          {s.kind === "recount" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button asChild size="sm" variant="outline"><Link to="/dong-ca">Sửa số đếm</Link></Button>
                              <Button size="sm" onClick={() => setPending(s)}>Tôi đã đếm lại</Button>
                            </div>
                          ) : (
                            <Button size="sm" onClick={() => setPending(s)}>Xác nhận đã có bằng chứng</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Điều chỉnh khác (đã có bằng chứng)">
            <form onSubmit={addAdjustment} className="space-y-3" noValidate>
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <select aria-label="Chiều điều chỉnh" value={adjSign} onChange={(e) => setAdjSign(Number(e.target.value) as 1 | -1)} className="h-10 rounded-lg border bg-background px-2 text-sm">
                  <option value={-1}>− Trừ</option>
                  <option value={1}>+ Cộng</option>
                </select>
                <input inputMode="numeric" aria-label="Số tiền điều chỉnh" placeholder="Số tiền" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} className="tabular h-10 rounded-lg border bg-background px-3" />
              </div>
              <FieldError>{adjErrors.amount}</FieldError>
              <input aria-label="Lý do" placeholder="Lý do & bằng chứng" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3" />
              <FieldError>{adjErrors.reason}</FieldError>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={adjConfirm} onChange={(e) => setAdjConfirm(e.target.checked)} className="mt-1" />
                Tôi xác nhận khoản này có bằng chứng và chưa được tính ở nơi khác.
              </label>
              <FieldError>{adjErrors.confirm}</FieldError>
              <Button type="submit" variant="outline">Thêm điều chỉnh</Button>
            </form>
            {active.reconciliation.adjustments.length > 0 && (
              <ul className="mt-4 divide-y border-t">
                {active.reconciliation.adjustments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="tabular font-semibold">{formatSigned(a.amount)}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.reason}</span>
                    <Button variant="ghost" size="icon" aria-label="Huỷ điều chỉnh" onClick={() => updateActive((s) => ({ ...s, reconciliation: { ...s.reconciliation, adjustments: s.reconciliation.adjustments.filter((x) => x.id !== a.id) } }))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Cách tính" className="lg:sticky lg:top-20 lg:self-start">
          <BreakdownTable b={b} />
          <p className="mt-4 text-xs text-muted-foreground">Khoản chờ xác minh không được tính. Khoản đã ghi trong POS không bị trừ hai lần.</p>
        </Panel>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.kind === "recount" ? "Xác nhận đã đếm lại?" : "Xác nhận khoản này?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "recount"
                ? "Chỉ xác nhận khi bạn đã đếm lại từng mệnh giá và cập nhật số đếm (nếu có thay đổi)."
                : "Khoản sẽ chuyển sang “Đã xác minh (ngoài POS)” và được tính vào tiền dự kiến. Chỉ xác nhận khi đã có hoá đơn/phiếu và khoản này chưa được ghi trong POS."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSuggestion}>Xác nhận</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
