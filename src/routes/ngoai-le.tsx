import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXCEPTION_STATUS_HELP, EXCEPTION_STATUS_LABEL, EmptyState, ExceptionStatusBadge, FieldError, Notice, PageHeader, Panel } from "@/components/shift/ui";
import { attestationText, findDuplicates, formatVND, parseAmount, validateAmount, validateException, type ExceptionField } from "@/lib/shift/calc";
import { useShifts } from "@/lib/shift/store";
import type { ExceptionLog, ExceptionStatus, ExceptionType, PaymentMethod } from "@/lib/shift/types";

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: "Tiền mặt", qr: "QR / chuyển khoản", split: "Kết hợp" };

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
  provenance: string;
  paymentMethod: PaymentMethod | null;
  cashAmount: string;
  qrAmount: string;
  attested: boolean;
}
type DraftErrors = Partial<Record<ExceptionField | "description" | "time", string>>;
const blank = (): Draft => ({ type: "expense", amount: "", description: "", time: nowLocal(), status: "pending", evidence: "", provenance: "", paymentMethod: null, cashAmount: "", qrAmount: "", attested: false });

function ExceptionsPage() {
  const { active, updateActive } = useShifts();
  const [draft, setDraft] = useState<Draft>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [dupWarning, setDupWarning] = useState<ExceptionLog[] | null>(null);
  if (!active) return null;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v, ...(k === "status" || k === "type" ? { attested: false } : {}) }));
    setDupWarning(null);
  };

  function submit(e: React.FormEvent, force = false) {
    e.preventDefault();
    const next: DraftErrors = {};
    const amtErr = validateAmount(draft.amount);
    if (amtErr) next.amount = amtErr;
    if (!draft.description.trim()) next.description = "Vui lòng mô tả ngắn gọn";
    if (!draft.time || isNaN(new Date(draft.time).getTime())) next.time = "Thời gian không hợp lệ";
    const isSplit = draft.type === "quick_order" && draft.paymentMethod === "split";
    const item: ExceptionLog = {
      id: editingId ?? crypto.randomUUID(),
      type: draft.type,
      amount: amtErr ? 0 : parseAmount(draft.amount),
      description: draft.description.trim(),
      time: next.time ? new Date().toISOString() : new Date(draft.time).toISOString(),
      status: draft.status,
      evidence: draft.evidence.trim(),
      provenance: draft.provenance.trim(),
      paymentMethod: draft.type === "quick_order" ? draft.paymentMethod : null,
      cashAmount: isSplit && /^\d+$/.test(draft.cashAmount.replace(/[.,\s]/g, "")) ? parseAmount(draft.cashAmount) : null,
      qrAmount: isSplit && /^\d+$/.test(draft.qrAmount.replace(/[.,\s]/g, "")) ? parseAmount(draft.qrAmount) : null,
      attested: draft.status !== "pending" && draft.attested,
    };
    const rule = validateException(item);
    if (amtErr) delete rule.amount;
    Object.assign(next, rule, amtErr ? { amount: amtErr } : {});
    setErrors(next);
    if (Object.keys(next).length) return;

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
    setDraft({
      type: x.type, amount: String(x.amount), description: x.description, time: toLocalInput(x.time), status: x.status,
      evidence: x.evidence, provenance: x.provenance, paymentMethod: x.paymentMethod,
      cashAmount: x.cashAmount === null ? "" : String(x.cashAmount), qrAmount: x.qrAmount === null ? "" : String(x.qrAmount),
      attested: x.attested,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const attestLabel = attestationText(draft.type, draft.status);

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
              <input id="amt" inputMode="numeric" aria-invalid={!!errors.amount} value={draft.amount} onChange={(e) => set("amount", e.target.value)} className="tabular mt-1 h-10 w-full rounded-lg border bg-background px-3" placeholder="VD: 50000" />
              <FieldError>{errors.amount}</FieldError>
            </div>
            {draft.type === "quick_order" && (
              <fieldset>
                <legend className="text-sm font-medium">Hình thức thanh toán thực tế</legend>
                <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-invalid={!!errors.paymentMethod}>
                  {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
                    <button type="button" role="radio" aria-checked={draft.paymentMethod === m} key={m} onClick={() => set("paymentMethod", m)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium ${draft.paymentMethod === m ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground"}`}>
                      {METHOD_LABEL[m]}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Chỉ phần tiền mặt được tính vào tiền trong két. QR không làm thay đổi tiền mặt.</p>
                <FieldError>{errors.paymentMethod}</FieldError>
                {draft.paymentMethod === "split" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="cashpart" className="text-xs font-medium">Phần tiền mặt</label>
                      <input id="cashpart" inputMode="numeric" value={draft.cashAmount} onChange={(e) => set("cashAmount", e.target.value)} aria-invalid={!!errors.split} aria-describedby="split-err" className="tabular mt-1 h-10 w-full rounded-lg border bg-background px-3" />
                    </div>
                    <div>
                      <label htmlFor="qrpart" className="text-xs font-medium">Phần QR</label>
                      <input id="qrpart" inputMode="numeric" value={draft.qrAmount} onChange={(e) => set("qrAmount", e.target.value)} aria-invalid={!!errors.split} aria-describedby="split-err" className="tabular mt-1 h-10 w-full rounded-lg border bg-background px-3" />
                    </div>
                    <div id="split-err" className="col-span-2" role="alert"><FieldError>{errors.split}</FieldError></div>
                  </div>
                )}
              </fieldset>
            )}
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
            <p className="text-xs text-muted-foreground">{EXCEPTION_STATUS_HELP[draft.status]}</p>
            <div>
              <label htmlFor="prov" className="text-sm font-medium">Nguồn gốc / ngữ cảnh (bắt buộc)</label>
              <input id="prov" value={draft.provenance} onChange={(e) => set("provenance", e.target.value)} aria-invalid={!!errors.provenance} aria-describedby="prov-err" className="mt-1 h-10 w-full rounded-lg border bg-background px-3" placeholder="VD: Quản lý gọi mua gấp — chưa có biên nhận" />
              <div id="prov-err" role="alert"><FieldError>{errors.provenance}</FieldError></div>
            </div>
            <div>
              <label htmlFor="ev" className="text-sm font-medium">
                Bằng chứng / mã tham chiếu {draft.status === "pending" ? "(không bắt buộc khi chưa xác minh)" : "(bắt buộc)"}
              </label>
              <input id="ev" value={draft.evidence} onChange={(e) => set("evidence", e.target.value)} aria-invalid={!!errors.evidence} aria-describedby="ev-err" className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
                placeholder={draft.status === "accounted_in_pos" ? "VD: Mã hoá đơn POS #A-123" : "VD: Biên nhận số 0457, phiếu ghi tay #3"} />
              <p className="mt-1 text-xs text-muted-foreground">Đây là nội dung bạn tự nhập; ứng dụng không tự kiểm chứng.</p>
              <div id="ev-err" role="alert"><FieldError>{errors.evidence}</FieldError></div>
            </div>
            {attestLabel && (
              <div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={draft.attested} onChange={(e) => set("attested", e.target.checked)} aria-invalid={!!errors.attested} aria-describedby="att-err" className="mt-1" />
                  {attestLabel}
                </label>
                <div id="att-err" role="alert"><FieldError>{errors.attested}</FieldError></div>
              </div>
            )}
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
                      <p className="text-xs font-medium text-muted-foreground">{TYPE_LABEL[x.type]}{x.type === "quick_order" && ` · ${x.paymentMethod ? METHOD_LABEL[x.paymentMethod] : "Chưa rõ hình thức"}`} · {new Date(x.time).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</p>
                      <p className="font-semibold">{x.description}</p>
                      {x.provenance && <p className="mt-0.5 text-xs text-muted-foreground">Nguồn gốc: {x.provenance}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">Bằng chứng: {x.evidence || "chưa có"}</p>
                      {x.paymentMethod === "split" && <p className="tabular mt-0.5 text-xs text-muted-foreground">Tiền mặt {formatVND(x.cashAmount ?? 0)} · QR {formatVND(x.qrAmount ?? 0)}</p>}
                      {x.type === "quick_order" && !x.paymentMethod && <p className="mt-0.5 text-xs font-medium text-destructive">Cần chọn hình thức thanh toán — chưa tính vào tiền mặt</p>}
                    </div>
                    <p className={`tabular font-bold ${x.type === "expense" ? "text-destructive" : "text-success"}`}>{x.type === "expense" ? "−" : "+"}{formatVND(x.amount)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ExceptionStatusBadge status={x.status} />
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => edit(x)}>Xác minh / đổi trạng thái</Button>
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
