import { DENOMINATIONS, type CashCountLine, type Shift } from "./types";

// All data below is FICTIONAL demo data, labeled "[Demo]" in the UI.

function lines(q: Partial<Record<number, number>>): CashCountLine[] {
  return DENOMINATIONS.map((d) => ({ denomination: d, quantity: q[d] ?? 0 }));
}

const standardOpening = { 200000: 5, 100000: 5, 50000: 6, 20000: 5, 10000: 5, 5000: 6, 2000: 5, 1000: 10 }; // 2.000.000

const emptyRecon = { adjustments: [], recountConfirmed: false, status: null, notes: "" };

export function makeSeedShifts(): Shift[] {
  return [
    {
      id: "demo-matched",
      label: "[Demo] Ca khớp tiền",
      isDemo: true,
      cashierName: "Nguyễn Văn An (giả lập)",
      date: "2026-11-02",
      handoverFloat: 2_000_000,
      opening: { kind: "opening", lines: lines(standardOpening), countedAt: "2026-11-02T06:00:00+07:00" },
      exceptions: [
        { id: "m1", type: "expense", amount: 120_000, description: "Mua đá viên", time: "2026-11-02T08:15:00+07:00", status: "accounted_in_pos", evidence: "Hoá đơn giấy, đã nhập POS" },
      ],
      pos: { cashSales: 5_450_000, cashOutflows: 120_000 },
      closing: {
        kind: "closing",
        lines: lines({ 500000: 8, 200000: 10, 100000: 10, 50000: 4, 20000: 4, 10000: 3, 5000: 2, 2000: 3, 1000: 4 }),
        countedAt: "2026-11-02T14:00:00+07:00",
      },
      reconciliation: { ...emptyRecon, adjustments: [] },
    },
    {
      id: "demo-expense",
      label: "[Demo] Chi 50.000 ₫ chưa ghi POS",
      isDemo: true,
      cashierName: "Trần Thị Bình (giả lập)",
      date: "2026-11-02",
      handoverFloat: 2_000_000,
      opening: { kind: "opening", lines: lines(standardOpening), countedAt: "2026-11-02T14:00:00+07:00" },
      exceptions: [
        { id: "e1", type: "expense", amount: 50_000, description: "Mua đá viên gấp — chưa nhập POS", time: "2026-11-02T16:40:00+07:00", status: "verified", evidence: "Có biên nhận cửa hàng đá, quản lý đã xem" },
      ],
      pos: { cashSales: 3_200_000, cashOutflows: 0 },
      closing: {
        kind: "closing",
        lines: lines({ 500000: 6, 200000: 5, 100000: 8, 50000: 5, 20000: 4, 10000: 1, 5000: 2 }),
        countedAt: "2026-11-02T22:00:00+07:00",
      },
      reconciliation: { ...emptyRecon, adjustments: [] },
    },
    {
      id: "demo-unresolved",
      label: "[Demo] Chênh lệch chưa giải quyết",
      isDemo: true,
      cashierName: "Lê Minh Châu (giả lập)",
      date: "2026-11-01",
      handoverFloat: 2_000_000,
      opening: { kind: "opening", lines: lines(standardOpening), countedAt: "2026-11-01T14:00:00+07:00" },
      exceptions: [
        { id: "u1", type: "expense", amount: 30_000, description: "Mua khăn giấy", time: "2026-11-01T18:05:00+07:00", status: "pending", evidence: "" },
      ],
      pos: { cashSales: 4_000_000, cashOutflows: 0 },
      closing: {
        kind: "closing",
        lines: lines({ 500000: 8, 200000: 5, 100000: 7, 50000: 3, 20000: 1, 10000: 1 }),
        countedAt: "2026-11-01T22:00:00+07:00",
      },
      reconciliation: { ...emptyRecon, adjustments: [] },
    },
    {
      id: "demo-conflict",
      label: "[Demo] Bằng chứng mâu thuẫn & trùng lặp",
      isDemo: true,
      cashierName: "Phạm Quốc Dũng (giả lập)",
      date: "2026-10-31",
      handoverFloat: 2_000_000,
      opening: { kind: "opening", lines: lines({ ...standardOpening, 20000: 4 }), countedAt: "2026-10-31T06:00:00+07:00" },
      exceptions: [
        { id: "c1", type: "expense", amount: 70_000, description: "Mua sữa tươi", time: "2026-10-31T09:00:00+07:00", status: "accounted_in_pos", evidence: "Nhân viên nói đã nhập POS" },
        { id: "c2", type: "quick_order", amount: 85_000, description: "Mất mạng — 2 cà phê sữa, 1 bạc xỉu", time: "2026-10-31T10:10:00+07:00", status: "verified", evidence: "Phiếu ghi tay #1" },
        { id: "c3", type: "quick_order", amount: 85_000, description: "Mất mạng — đơn bàn 4", time: "2026-10-31T10:14:00+07:00", status: "verified", evidence: "Phiếu ghi tay #2?" },
      ],
      pos: { cashSales: 2_500_000, cashOutflows: 40_000 },
      closing: {
        kind: "closing",
        lines: lines({ 500000: 6, 200000: 5, 100000: 5, 50000: 2 }),
        countedAt: "2026-10-31T14:00:00+07:00",
      },
      reconciliation: { ...emptyRecon, adjustments: [] },
    },
  ];
}
