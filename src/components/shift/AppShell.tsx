import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ClipboardList, FileText, LayoutDashboard, LogIn, LogOut, Search, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShifts } from "@/lib/shift/store";

const NAV = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/mo-ca", label: "Mở ca", icon: LogIn },
  { to: "/ngoai-le", label: "Ngoại lệ", icon: ClipboardList },
  { to: "/dong-ca", label: "Đóng ca", icon: LogOut },
  { to: "/kiem-tra", label: "Kiểm tra", icon: Search },
  { to: "/ban-giao", label: "Bàn giao", icon: FileText },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { active, state, setActive, loaded, storageError } = useShifts();

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="bg-hero flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">Shift-Mate</span>
          </Link>
          <nav className="ml-4 hidden gap-1 lg:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  pathname === n.to && "bg-primary-soft text-primary",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto min-w-0">
            {loaded && (
              <select
                aria-label="Chọn ca"
                value={active?.id}
                onChange={(e) => setActive(e.target.value)}
                className="h-9 max-w-[180px] truncate rounded-lg border bg-background px-2 text-sm sm:max-w-[260px]"
              >
                {state.shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {storageError && <p className="mb-4 rounded-xl bg-destructive-soft px-4 py-3 text-sm text-destructive">{storageError}</p>}
        {active?.isDemo && (
          <p className="mb-4 rounded-xl bg-warning-soft px-4 py-2 text-xs text-warning-foreground">
            Bạn đang xem <b>dữ liệu demo hư cấu</b>. Tên người, số tiền đều là giả lập.
          </p>
        )}
        {loaded ? children : <div className="h-64 animate-pulse rounded-2xl bg-muted" />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-background lg:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground", pathname === n.to && "text-primary")}
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
