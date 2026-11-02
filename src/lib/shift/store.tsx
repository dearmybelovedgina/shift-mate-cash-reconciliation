import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { emptyLines } from "./calc";
import { makeSeedShifts } from "./seed";
import type { Shift } from "./types";

const KEY = "shift-mate:v1";

interface State {
  shifts: Shift[];
  activeId: string;
}

interface Ctx {
  state: State;
  loaded: boolean;
  storageError: string | null;
  active: Shift | undefined;
  setActive: (id: string) => void;
  updateActive: (fn: (s: Shift) => Shift) => void;
  createShift: (cashierName: string, handoverFloat: number) => void;
  deleteShift: (id: string) => void;
  resetDemo: () => void;
}

const ShiftContext = createContext<Ctx | null>(null);

function initialState(): State {
  const shifts = makeSeedShifts();
  return { shifts, activeId: shifts[0].id };
}

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (Array.isArray(parsed.shifts)) setState(parsed);
      }
    } catch {
      setStorageError("Không đọc được dữ liệu đã lưu. Đang dùng dữ liệu demo.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      setStorageError("Không lưu được dữ liệu vào trình duyệt (bộ nhớ đầy hoặc bị chặn).");
    }
  }, [state, loaded]);

  const updateActive = useCallback((fn: (s: Shift) => Shift) => {
    setState((st) => ({ ...st, shifts: st.shifts.map((s) => (s.id === st.activeId ? fn(s) : s)) }));
  }, []);

  const value: Ctx = {
    state,
    loaded,
    storageError,
    active: state.shifts.find((s) => s.id === state.activeId) ?? state.shifts[0],
    setActive: (id) => setState((st) => ({ ...st, activeId: id })),
    updateActive,
    createShift: (cashierName, handoverFloat) => {
      const id = crypto.randomUUID();
      const shift: Shift = {
        id,
        label: `Ca ${new Date().toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`,
        isDemo: false,
        cashierName,
        date: new Date().toISOString().slice(0, 10),
        handoverFloat,
        opening: { kind: "opening", lines: emptyLines(), countedAt: null },
        exceptions: [],
        pos: { cashSales: null, cashOutflows: null },
        closing: { kind: "closing", lines: emptyLines(), countedAt: null },
        reconciliation: { adjustments: [], recountConfirmed: false, status: null, notes: "" },
      };
      setState((st) => ({ shifts: [shift, ...st.shifts], activeId: id }));
    },
    deleteShift: (id) =>
      setState((st) => {
        const shifts = st.shifts.filter((s) => s.id !== id);
        if (!shifts.length) return initialState();
        return { shifts, activeId: st.activeId === id ? shifts[0].id : st.activeId };
      }),
    resetDemo: () => setState(initialState()),
  };

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShifts() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShifts must be used inside ShiftProvider");
  return ctx;
}
