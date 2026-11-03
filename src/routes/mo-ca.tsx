import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DenominationCounter, Notice, PageHeader, Panel, Stat } from "@/components/shift/ui";
import { useCountForm } from "@/components/shift/useCountForm";
import { countTotal, formatSigned, formatVND } from "@/lib/shift/calc";
import { useShifts } from "@/lib/shift/store";

export const Route = createFileRoute("/mo-ca")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Mở ca — Shift-Mate" },
      { name: "description", content: "Đếm tiền đầu ca theo mệnh giá VND và phát hiện chênh lệch đầu ca." },
      { property: "og:title", content: "Mở ca — Shift-Mate" },
      { property: "og:description", content: "Đếm tiền đầu ca theo mệnh giá VND." },
    ],
  }),
  component: OpenShiftPage,
});

function OpenShiftPage() {
  const { active } = useShifts();
  if (!active) return null;
  return <OpenShiftForm key={active.id} />;
}

function OpenShiftForm() {
  const { active, updateActive } = useShifts();
  const form = useCountForm(active!.opening.lines);
  const total = countTotal(form.draftLines);
  const diff = total - active!.handoverFloat;

  function save() {
    if (form.hasError) {
      toast.error("Vui lòng sửa các ô nhập không hợp lệ");
      return;
    }
    updateActive((s) => ({ ...s, opening: { ...s.opening, lines: form.draftLines, countedAt: new Date().toISOString() } }));
    toast.success("Đã lưu tiền đầu ca");
  }

  return (
    <>
      <PageHeader step="Bước 1" title="Mở ca" description="Kiểm đếm tiền mặt đầu ca và đối chiếu với số tiền bàn giao từ ca trước." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Đếm tiền đầu ca">
          <DenominationCounter lines={active!.opening.lines} drafts={form.drafts} onDraftChange={form.setDraft} />
        </Panel>
        <div className="space-y-4">
          <Stat label="Tổng tiền đầu ca" value={formatVND(total)} tone="primary" />
          <Stat label="Tiền bàn giao từ ca trước" value={formatVND(active!.handoverFloat)} />
          {total === 0 ? (
            <Notice tone="info">Chưa nhập số tờ nào.</Notice>
          ) : diff === 0 ? (
            <Notice tone="success">Tiền đầu ca khớp với tiền bàn giao.</Notice>
          ) : (
            <Notice tone="warning">
              <b>Chênh lệch đầu ca: {formatSigned(diff)}.</b> Hãy đếm lại cùng người bàn giao trước khi bắt đầu bán. Chênh lệch này không tự động được điều chỉnh.
            </Notice>
          )}
          {form.hasError && <Notice tone="danger">Có ô nhập không hợp lệ — chưa thể lưu.</Notice>}
          <Notice tone="info">Khi lưu thay đổi tiền đầu ca, tiền dự kiến cuối ca sẽ thay đổi. Số tiền đếm cuối ca và số liệu POS không tự động cập nhật.</Notice>
          <Button className="w-full" size="lg" onClick={save} disabled={form.hasError}>Lưu tiền đầu ca</Button>
          {active!.opening.countedAt && (
            <p className="text-center text-xs text-muted-foreground">Đã lưu lúc {new Date(active!.opening.countedAt).toLocaleString("vi-VN")}</p>
          )}
        </div>
      </div>
    </>
  );
}
