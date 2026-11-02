import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXCEPTION_STATUS_LABEL, EmptyState, ExceptionStatusBadge, FieldError, Notice, PageHeader, Panel } from "@/components/shift/ui";
import { findDuplicates, formatVND, parseAmount, validateAmount } from "@/lib/shift/calc";
import { useShifts } from "@/lib/shift/store";
import type { ExceptionLog, ExceptionStatus, ExceptionType } from "@/lib/shift/types";

export const Route = createFileRoute("/ngoai-le")({
  head: () => ({
    meta: [
      { title: "Nhật ký ngoại lệ — Shift-Mate" },
      { name: "description", content: "Ghi lại chi tiền mặt, đơn nhanh khi POS mất kết nối và trạng thái xác minh." },
      { property: "og:title", content: "Nhật ký ngoại lệ — Shift-Mate" },
      { property: "og:description", content: "Ghi chi tiền mặt và đơn nhanh trong ca." },
    ],
  }),
  component: ExceptionsPage,
});

const TYPE_LABEL: Record<ExceptionType, string> = { expense: "Chi tiền mặt", quick_order: "Đơn nhanh (POS mất kết nối)" };

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function toLocalInput(iso: string) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

interface Draft {
  type: ExceptionType;
  amount: string;
  description: string;
  time: string;
  status: ExceptionStatus;
  evidence: string;
}
const blank = (): Draft => ({ type: "expense", amount: "", description: "", time: nowLocal(), status: "pending", evidence: "" });

function ExceptionsPage() {
  const { active, updateActive } = useShifts();
  const [draft, setDraft] = useState<Draft>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [dupWarning, setDupWarning] = useState<ExceptionLog[] | null>(null);
  if (!active) return null;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setDupWarning(null);
  };

  function submit(e: React.FormEvent, force = false) {
    e.preventDefault();
    const next: typeof errors = {};
    const amtErr = validateAmount(draft.amount);
    if (amtErr) next.amount = amtErr;
    if (!draft.description.trim()) next.description = "Vui lòng mô tả ngắn gọn";
    if (!draft.time || isNaN(new Date(draft.time).getTime())) next.time = "Thời gian không hợp lệ";
    if (draft.status !== "pending" && !draft.evidence.trim()) next.evidence = "Cần ghi bằng chứng khi đã xác minh";
    setErrors(next);
    if (Object.keys(next).length) return;

    const item: ExceptionLog = {
      id: editingId ?? crypto.randomUUID(),
      type: draft.type,
      amount: parseAmount(draft.amount),
      description: draft.description.trim(),
      time: new Date(draft.time).toISOString(),
      status: draft.status,
      evidence: draft.evidence.trim(),
    };
    const dups = findDuplicates(active!.exceptions, item, editingId ?? undefined);
    if (dups.length && !force) {
      setDupWarning(dups);
      return;
    }
    updateActive((s) => ({
      ...s,
      exceptions: editingId ? s.exceptions.map((x) => (x.id === editingId ? item : x)) : [...s.exceptions, item],
    }));
    toast.success(editingId ? "Đã cập nhật ngoại lệ" : "Đã ghi ngoại lệ");
    setDraft(blank());
    setEditingId(null);
    setDupWarning(null);
  }

  function edit(x: ExceptionLog) {
    setEditingId(x.id);
    setErrors({});
    setDupWarning(null);
    setDraft({ type: x.type, amount: String(x.amount), description: x.description, time: toLocalInput(x.time), status: x.status, evidence: x.evidence });
  }

  function changeStatus(id: string, status: ExceptionStatus) {
    updateActive((s) => ({ ...s, exceptions: s.exceptions.map((x) => (x.id === id ? { ...x, status } : x)) }));
  }

  const sorted = [...active.exceptions].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <>
      <PageHeader step="Bước 2" title="Nhật ký ngoại lệ" description="Ghi lại mọi khoản chi tiền mặt và đơn nhanh khi POS mất kết nối. Chỉ khoản đã xác minh mới được tính vào tiền dự kiến." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Panel title={editingId ? "Sửa ngoại lệ" : "Thêm ngoại lệ"}>
          <form onSubmit={(e) => submit(e)} className="space-y-3" noValidate>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(TYPE_LABEL) as ExceptionType[]).map((t) => (
                <button type="button" key={t} onClick={() => set("type", t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${draft.type === t ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground"}`}>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="amt" className="text-sm font-medium">Số tiền (VND)</label>
              <input id="amt" inputMode="numeric" value={draft.amount} onChange={(e) => set("amount", e.target.value)} className="tabular mt-1 h-10 w-full rounded-lg border bg-background px-3" placeholder="VD: 50000" />
              <FieldError>{errors.amount}</FieldError>
            </div>
            <div>
              <label htmlFor="desc" className="text-sm font-medium">Mô tả</label>
              <input id="desc" value={draft.description} onChange={(e) => set("description", e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3" placeholder="VD: Mua đá viên" />
              <FieldError>{errors.description}</FieldError>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="time" className="text-sm font-medium">Thời gian</label>
                <input id="time" type="datetime-local" value={draft.time} onChange={(e) => set("time", e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3" />
                <FieldError>{errors.time}</FieldError>
              </div>
              <div>
                <label htmlFor="status" className="text-sm font-medium">Trạng thái</label>
                <select id="status" value={draft.status} onChange={(e) => set("status", e.target.value as ExceptionStatus)} className="mt-1 h-10 w-full rounded-lg border bg-background px-2">
                  {(Object.keys(EXCEPTION_STATUS_LABEL) as ExceptionStatus[]).map((s) => <option key={s} value={s}>{EXCEPTION_STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="ev" className="text-sm font-medium">Bằng chứng / ghi chú</label>
              <input id="ev" value={draft.evidence} onChange={(e) => set("evidence", e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3" placeholder="VD: Có hoá đơn, phiếu ghi tay #3" />
              <FieldError>{errors.evidence}</FieldError>
            </div>
            {dupWarning && (
              <Notice tone="warning">
                <p className="font-semibold">Có thể trùng lặp</p>
                <p className="mt-1">Đã có {dupWarning.length} khoản cùng loại, cùng số tiền trong vòng 15 phút: {dupWarning.map((d) => `“${d.description}”`).join(", ")}.</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" type="button" onClick={(e) => submit(e as unknown as React.FormEvent, true)}>Vẫn lưu (khoản riêng biệt)</Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setDupWarning(null)}>Huỷ</Button>
                </div>
              </Notice>
            )}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">{editingId ? "Lưu thay đổi" : "Thêm"}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setDraft(blank()); setErrors({}); }}>Huỷ sửa</Button>}
            </div>
          </form>
        </Panel>

        <Panel title={`Danh sách (${active.exceptions.length})`}>
          {sorted.length === 0 ? (
            <EmptyState title="Chưa có ngoại lệ nào" description="Nếu trong ca có chi tiền mặt hoặc đơn ghi tay khi POS lỗi, hãy ghi lại ngay để dễ đối soát." />
          ) : (
            <ul className="space-y-3">
              {sorted.map((x) => (
                <li key={x.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{TYPE_LABEL[x.type]} · {new Date(x.time).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</p>
                      <p className="font-semibold">{x.description}</p>
                      {x.evidence && <p className="mt-0.5 text-xs text-muted-foreground">Bằng chứng: {x.evidence}</p>}
                    </div>
                    <p className={`tabular font-bold ${x.type === "expense" ? "text-destructive" : "text-success"}`}>{x.type === "expense" ? "−" : "+"}{formatVND(x.amount)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ExceptionStatusBadge status={x.status} />
                    <select aria-label="Đổi trạng thái" value={x.status} onChange={(e) => changeStatus(x.id, e.target.value as ExceptionStatus)} className="h-8 rounded-lg border bg-background px-2 text-xs">
                      {(Object.keys(EXCEPTION_STATUS_LABEL) as ExceptionStatus[]).map((s) => <option key={s} value={s}>{EXCEPTION_STATUS_LABEL[s]}</option>)}
                    </select>
                    <div className="ml-auto flex">
                      <Button variant="ghost" size="icon" aria-label="Sửa" onClick={() => edit(x)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Xoá" onClick={() => { if (confirm("Xoá ngoại lệ này?")) updateActive((s) => ({ ...s, exceptions: s.exceptions.filter((y) => y.id !== x.id) })); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
