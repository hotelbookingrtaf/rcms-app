import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Gauge,
  FileText,
  Wallet,
  Zap,
  BarChart3,
  Settings as SettingsIcon,
  History,
  ReceiptText,
  LogOut,
  ClipboardList,
  ShieldCheck,
  FileSpreadsheet,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { type ReactNode, useState, useMemo, useEffect } from "react";
import { RCMS_LOGO_URL } from "@/lib/branding";
import { useRcms, periodLabel, periodFullThai } from "@/lib/rcms-store";
import { CURRENT_PERIOD, SEED_USERS } from "@/lib/rcms-seed";
import { ROLE_LABEL, fullName } from "@/lib/rcms-types";
import { LoginScreen } from "@/components/rcms/LoginScreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const THAI_MONTHS = [
  { num: "01", name: "ม.ค.", full: "มกราคม" },
  { num: "02", name: "ก.พ.", full: "กุมภาพันธ์" },
  { num: "03", name: "มี.ค.", full: "มีนาคม" },
  { num: "04", name: "เม.ย.", full: "เมษายน" },
  { num: "05", name: "พ.ค.", full: "พฤษภาคม" },
  { num: "06", name: "มิ.ย.", full: "มิถุนายน" },
  { num: "07", name: "ก.ค.", full: "กรกฎาคม" },
  { num: "08", name: "ส.ค.", full: "สิงหาคม" },
  { num: "09", name: "ก.ย.", full: "กันยายน" },
  { num: "10", name: "ต.ค.", full: "ตุลาคม" },
  { num: "11", name: "พ.ย.", full: "พฤศจิกายน" },
  { num: "12", name: "ธ.ค.", full: "ธันวาคม" },
];

export function HeaderPeriodPicker() {
  const { period, setPeriod } = useRcms();
  const [open, setOpen] = useState(false);

  const currentYear = useMemo(() => {
    if (period && period.includes("-")) {
      const y = parseInt(period.split("-")[0] ?? "2569", 10);
      if (!isNaN(y)) return y;
    }
    return 2569;
  }, [period]);

  const [displayYear, setDisplayYear] = useState<number>(currentYear);

  useEffect(() => {
    if (period && period.includes("-")) {
      const y = parseInt(period.split("-")[0] ?? "2569", 10);
      if (!isNaN(y)) setDisplayYear(y);
    }
  }, [period]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 min-w-[140px] justify-between gap-2 border-border/80 bg-card px-3.5 text-sm font-medium shadow-xs transition-all hover:bg-muted/80 hover:border-primary/50",
              open && "ring-2 ring-primary/40 border-primary bg-primary/5",
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
              <span className="font-bold text-foreground">
                {periodLabel(period)}
              </span>
              <span className="hidden md:inline text-xs text-muted-foreground font-normal">
                ({periodFullThai(period)})
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                open && "rotate-180 text-primary",
              )}
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-3.5 shadow-xl border-border bg-popover" align="end">
          {/* Header with Year Selector */}
          <div className="flex items-center justify-between pb-2.5 border-b border-border">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-md hover:bg-muted"
              onClick={() => setDisplayYear((y) => y - 1)}
              title="ปีก่อนหน้า"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <p className="font-display font-bold text-sm text-foreground flex items-center justify-center gap-1.5">
                <span>พ.ศ. {displayYear}</span>
                <span className="text-xs font-normal text-muted-foreground">(ค.ศ. {displayYear - 543})</span>
              </p>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-md hover:bg-muted"
              onClick={() => setDisplayYear((y) => y + 1)}
              title="ปีถัดไป"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-1.5 py-3">
            {THAI_MONTHS.map((m) => {
              const periodKey = `${displayYear}-${m.num}`;
              const isSelected = period === periodKey;
              const isCurrent = CURRENT_PERIOD === periodKey;

              return (
                <button
                  key={m.num}
                  type="button"
                  onClick={() => {
                    setPeriod(periodKey);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-lg p-2 text-xs transition-all cursor-pointer border",
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-xs border-primary scale-102"
                      : isCurrent
                        ? "border-primary/50 bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                        : "border-transparent bg-muted/40 hover:bg-muted text-foreground hover:border-border",
                  )}
                >
                  <span className="text-sm font-semibold">{m.name}</span>
                  <span
                    className={cn(
                      "text-[10px]",
                      isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {m.full}
                  </span>
                  {isCurrent && (
                    <span
                      className={cn(
                        "mt-0.5 rounded px-1 text-[8px] font-medium leading-tight",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      งวดระบบ
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2.5 border-t border-border text-xs">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-primary font-medium hover:bg-primary/10"
              onClick={() => {
                setDisplayYear(2569);
                setPeriod(CURRENT_PERIOD);
                setOpen(false);
              }}
            >
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              งวดปัจจุบัน ({periodLabel(CURRENT_PERIOD)})
            </Button>

            <span className="text-[11px] text-muted-foreground font-mono">
              {period ? period : ""}
            </span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "เมนูหลัก",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/customers", label: "ข้อมูลผู้ประกอบการ", icon: Users },
      { to: "/readings", label: "หน่วยใช้ล่าสุด", icon: Gauge },
    ],
  },
  {
    title: "จัดการข้อมูล & การเงิน",
    items: [
      { to: "/billing", label: "ออกใบแจ้งหนี้", icon: FileText },
      { to: "/payments", label: "ตรวจสอบการชำระเงิน", icon: Wallet },
      { to: "/history", label: "ประวัติการชำระเงิน", icon: ReceiptText },
      { to: "/service", label: "การระงับบริการ", icon: Zap },
      { to: "/approvals", label: "อนุมัติระงับบริการ", icon: ShieldCheck },
      { to: "/tasks", label: "มอบหมายใบงาน", icon: ClipboardList },
      { to: "/import", label: "นำข้อมูลเข้า Excel", icon: FileSpreadsheet },
    ],
  },
  {
    title: "ระบบ & รายงาน",
    items: [
      { to: "/reports", label: "รายงานสรุป", icon: BarChart3 },
      { to: "/audit", label: "Audit Log", icon: History },
      { to: "/users", label: "กำหนดสิทธิ์ผู้ใช้งาน", icon: ShieldCheck },
      { to: "/settings", label: "ตั้งค่าระบบ", icon: SettingsIcon },
    ],
  },
];

export function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {desc ? <p className="mt-1.5 text-sm sm:text-base text-muted-foreground leading-relaxed">{desc}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { me, logout, can, tasks, payments, customers, bills, users } = useRcms();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (!me || path === "/login") {
    return <LoginScreen />;
  }

  const activeUser = me;

  const pendingApprovals = tasks.filter(
    (t) => t.status === "waiting_approval" && t.type === "disconnect",
  ).length;
  const approvedTasks = tasks.filter(
    (t) => t.status === "approved" || t.status === "in_progress",
  ).length;
  const pendingSlips = payments.filter(
    (p) => p.status === "pending" || p.status === "problem",
  ).length;
  const pendingUsers = users.filter((u) => u.status === "pending").length;

  const allowed = can(path === "/" ? "/" : `/${path.split("/")[1]}`);

  return (
    <div className="flex min-h-screen bg-background">
      {/* ------------------------------------------------------------------ */}
      {/* Desktop Sidebar (Wide & High Readability)                          */}
      {/* ------------------------------------------------------------------ */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col panel-gradient text-sidebar-foreground lg:flex border-r border-sidebar-border/40">
        {/* Logo & Header */}
        <div className="flex items-center gap-3.5 border-b border-sidebar-border/60 px-5 py-5">
          <img
            src={RCMS_LOGO_URL}
            alt="ตราสัญลักษณ์กรมช่างโยธาทหารอากาศ"
            className="h-11 w-11 object-contain drop-shadow-md"
          />
          <div>
            <p className="font-display text-xl font-extrabold leading-tight text-sidebar-primary tracking-tight">
              RCMS
            </p>
            <p className="text-xs leading-tight text-sidebar-foreground/90 font-medium mt-0.5">
              ระบบบริหารจัดเก็บรายได้ ชย.ทอ.
            </p>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-3.5 py-4 no-scrollbar custom-scrollbar">
          {navSections.map((section, sIdx) => {
            const visibleItems = section.items.filter((n) => can(n.to));
            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx} className="space-y-1.5">
                <p className="px-3 text-xs font-extrabold uppercase tracking-wider text-sidebar-primary/90">
                  {section.title}
                </p>
                <div className="space-y-1 mt-1">
                  {visibleItems.map((n) => {
                    const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
                    const badge =
                      n.to === "/approvals"
                        ? pendingApprovals
                        : n.to === "/tasks"
                          ? approvedTasks
                          : n.to === "/payments"
                            ? pendingSlips
                            : n.to === "/users"
                              ? pendingUsers
                              : n.to === "/customers"
                                ? customers.length
                                : 0;

                    return (
                      <Link
                        key={n.to}
                        to={n.to}
                        className={`group flex items-center gap-3.5 rounded-2xl px-4 py-3 text-[15.5px] font-semibold transition-all duration-200 ${
                          active
                            ? "bg-gradient-to-r from-sidebar-primary to-sidebar-primary/85 font-bold text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25 scale-[1.02]"
                            : "text-sidebar-foreground/90 hover:bg-sidebar-accent/80 hover:text-white"
                        }`}
                      >
                        <n.icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", active && "text-sidebar-primary-foreground")} />
                        <span className="flex-1 leading-snug">{n.label}</span>
                        {badge > 0 ? (
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-bold shadow-xs",
                              active
                                ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground"
                                : n.to === "/approvals" || n.to === "/tasks" || n.to === "/payments" || n.to === "/users"
                                  ? "bg-destructive text-destructive-foreground"
                                  : "bg-sidebar-accent text-sidebar-foreground/95 border border-white/10",
                            )}
                          >
                            {badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Card Footer */}
        <div className="p-3.5 border-t border-sidebar-border/60 bg-sidebar-accent/30">
          <div className="flex items-center gap-3 rounded-2xl bg-sidebar-accent/60 p-3 border border-sidebar-border/50">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground text-sm font-extrabold shrink-0 shadow-xs">
              {activeUser.firstName.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-bold text-sidebar-foreground truncate">
                {fullName(activeUser)}
              </p>
              <p className="text-xs text-sidebar-foreground/80 font-medium truncate mt-0.5">
                {ROLE_LABEL[activeUser.role]}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-sidebar-foreground/80 hover:text-white hover:bg-sidebar-accent cursor-pointer"
              title="ออกจากระบบ"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main Content Area                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border/80 bg-card/85 px-4 py-3 backdrop-blur-md lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <img src={RCMS_LOGO_URL} alt="โลโก้ ชย.ทอ." className="h-8 w-8 object-contain" />
            <span className="font-display font-bold text-lg">RCMS</span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {!path.startsWith("/import") && path !== "/" && <HeaderPeriodPicker />}

            {/* Mobile / Tablet User Info */}
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1.5 shadow-xs lg:hidden">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {activeUser.firstName.slice(0, 1)}
              </div>
              <div className="leading-tight text-xs">
                <p className="font-semibold">{fullName(activeUser)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="ออกจากระบบ"
                onClick={logout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Mobile Horizontal Menu */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden no-scrollbar">
          {navSections.flatMap((s) => s.items).filter((n) => can(n.to)).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold [&.active]:bg-primary [&.active]:text-primary-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-7">
          {allowed ? (
            children
          ) : (
            <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-10 text-center shadow-xs">
              <p className="font-display text-lg font-bold">ไม่มีสิทธิ์เข้าถึงเมนูนี้</p>
              <p className="mt-2 text-sm text-muted-foreground">
                บัญชีของท่านมีสิทธิ์ระดับ “{ROLE_LABEL[activeUser.role]}” กรุณาติดต่อผู้ดูแลระบบ
              </p>
              <Button asChild className="mt-4 rounded-xl">
                <Link to="/">กลับสู่แดชบอร์ด</Link>
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
