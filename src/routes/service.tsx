import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Ban,
  PlugZap,
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  AlertTriangle,
  Zap,
  Droplets,
  Layers,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  CheckSquare,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRcms, thb, periodLabel } from "@/lib/rcms-store";
import { canPerform } from "@/lib/permissions";
import { getMeterPrefix } from "@/lib/customer-matching";
import type { Customer, Division, TaskStatus } from "@/lib/rcms-types";

export const Route = createFileRoute("/service")({
  head: () => ({
    meta: [
      { title: "การระงับบริการ (ไฟฟ้า / น้ำประปา) · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "รายการผู้ประกอบการที่เข้าเงื่อนไขระงับบริการ แยกระบบไฟฟ้าและระบบน้ำประปา ขออนุมัติจากผู้บังคับบัญชา รับชำระยอดค้างรายเดือน และแจ้งใบงานต่อระบบ",
      },
      { property: "og:title", content: "การระงับบริการ · RCMS" },
      { property: "og:description", content: "Suspension & Reconnection Workflow by Service Division" },
    ],
  }),
  component: ServicePage,
});

type ServiceTab = "all" | "electric" | "water";
type ServiceStatusFilter = "all" | "arrears" | "suspended" | "pending_task";

const taskStatusMap: Record<TaskStatus, { label: string; cls: string }> = {
  waiting_approval: { label: "รออนุมัติ", cls: "bg-warning/20 text-warning border-warning/40" },
  approved: { label: "อนุมัติแล้ว", cls: "bg-info/15 text-info border-info/40" },
  in_progress: { label: "กำลังดำเนินการ", cls: "bg-accent text-accent-foreground" },
  done: { label: "ปิดงานแล้ว", cls: "bg-success/15 text-success border-success/40" },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-destructive/15 text-destructive border-destructive/40" },
  cancelled: { label: "ยกเลิกแล้ว", cls: "bg-muted text-muted-foreground" },
};

function ServicePage() {
  const {
    customers,
    tasks,
    createTask,
    cancelTask,
    cancelSuspension,
    outstanding,
    arrearsOf,
    unpaidBillsOf,
    settings,
    displayStatus,
    settle,
    role,
  } = useRcms();

  // Tab & Filters
  const [serviceTab, setServiceTab] = useState<ServiceTab>("all");
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>("all");
  const [meterSeriesFilter, setMeterSeriesFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [page, setPage] = useState(0);

  // Modals & Selection
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payDivision, setPayDivision] = useState<"electric" | "water">("electric");
  const [picked, setPicked] = useState<string[]>([]);
  const [ref, setRef] = useState("");
  const [includeReconnectFee, setIncludeReconnectFee] = useState<boolean>(true);
  const [reconnectFeeAmount, setReconnectFeeAmount] = useState<number>(100);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [batchActionConfirm, setBatchActionConfirm] = useState<{
    division: Division;
    ids: string[];
  } | null>(null);

  const openPayDialog = (customerId: string, division: "electric" | "water") => {
    setPayFor(customerId);
    setPayDivision(division);
    setPicked(unpaidBillsOf(customerId).filter((b) => b.type === division).map((b) => b.id));
    setRef(`TMB${Math.floor(Math.random() * 900000 + 100000)}`);
    setIncludeReconnectFee(true);
    setReconnectFeeAmount(settings.penaltyDisconnectionFee ?? 100);
  };

  const canRequest = canPerform(role, "service.request");

  // Helper to get active task for a customer in a division
  const getActiveTask = (customerId: string, division: Division) => {
    return tasks.find(
      (t) =>
        t.customerId === customerId &&
        t.division === division &&
        !["done", "rejected", "cancelled"].includes(t.status),
    );
  };

  // Extract all distinct meter prefixes
  const meterPrefixOptions = useMemo(() => {
    const prefixes = new Set<string>();
    customers.forEach((c) => {
      if (serviceTab === "electric" || serviceTab === "all") {
        const p = getMeterPrefix(c.elecMeter);
        if (p) prefixes.add(p);
      }
      if (serviceTab === "water" || serviceTab === "all") {
        const p = getMeterPrefix(c.waterMeter);
        if (p) prefixes.add(p);
      }
    });
    return Array.from(prefixes).sort();
  }, [customers, serviceTab]);

  // Overall Statistics for KPI Cards
  const stats = useMemo(() => {
    let elecRiskyCount = 0;
    let elecRiskyAmount = 0;
    let elecSuspendedCount = 0;

    let waterRiskyCount = 0;
    let waterRiskyAmount = 0;
    let waterSuspendedCount = 0;

    customers.forEach((c) => {
      if (c.status === "installment") return;

      const elecOut = outstanding(c.id, "electric");
      const isElecSuspended = c.serviceStates?.electric === "suspended";
      if (elecOut > 0 || isElecSuspended) {
        elecRiskyCount++;
        elecRiskyAmount += elecOut;
      }
      if (isElecSuspended) {
        elecSuspendedCount++;
      }

      const waterOut = outstanding(c.id, "water");
      const isWaterSuspended = c.serviceStates?.water === "suspended";
      if (waterOut > 0 || isWaterSuspended) {
        waterRiskyCount++;
        waterRiskyAmount += waterOut;
      }
      if (isWaterSuspended) {
        waterSuspendedCount++;
      }
    });

    const waitingApprovalTasks = tasks.filter((t) => t.status === "waiting_approval").length;
    const inProgressTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "approved").length;

    return {
      elecRiskyCount,
      elecRiskyAmount,
      elecSuspendedCount,
      waterRiskyCount,
      waterRiskyAmount,
      waterSuspendedCount,
      totalSuspendedCount: customers.filter((c) =>
        Object.values(c.serviceStates || {}).includes("suspended"),
      ).length,
      waitingApprovalTasks,
      inProgressTasks,
    };
  }, [customers, outstanding, tasks]);

  // Filtered List based on tab, status, series, and search query
  const filteredCustomers = useMemo(() => {
    const term = q.trim().toLowerCase();

    return customers.filter((c) => {
      if (c.status === "installment") return false;

      const elecOut = outstanding(c.id, "electric");
      const isElecSuspended = c.serviceStates?.electric === "suspended";
      const elecTask = getActiveTask(c.id, "electric");

      const waterOut = outstanding(c.id, "water");
      const isWaterSuspended = c.serviceStates?.water === "suspended";
      const waterTask = getActiveTask(c.id, "water");

      // 1. Division Tab Filter
      if (serviceTab === "electric") {
        // Customer must have electric arrears or be electric suspended or have an electric task
        if (elecOut === 0 && !isElecSuspended && !elecTask) return false;
      } else if (serviceTab === "water") {
        // Customer must have water arrears or be water suspended or have a water task
        if (waterOut === 0 && !isWaterSuspended && !waterTask) return false;
      } else {
        // "all" tab: must have any arrears or any suspension or any task
        const totalOut = outstanding(c.id);
        const anySuspended = Object.values(c.serviceStates || {}).includes("suspended");
        const anyTask = elecTask || waterTask;
        if (totalOut === 0 && !anySuspended && !anyTask) return false;
      }

      // 2. Status Filter
      if (statusFilter === "arrears") {
        if (serviceTab === "electric" && (elecOut <= 0 || isElecSuspended)) return false;
        if (serviceTab === "water" && (waterOut <= 0 || isWaterSuspended)) return false;
        if (serviceTab === "all" && (outstanding(c.id) <= 0 || Object.values(c.serviceStates || {}).includes("suspended"))) return false;
      } else if (statusFilter === "suspended") {
        if (serviceTab === "electric" && !isElecSuspended) return false;
        if (serviceTab === "water" && !isWaterSuspended) return false;
        if (serviceTab === "all" && !Object.values(c.serviceStates || {}).includes("suspended")) return false;
      } else if (statusFilter === "pending_task") {
        if (serviceTab === "electric" && !elecTask) return false;
        if (serviceTab === "water" && !waterTask) return false;
        if (serviceTab === "all" && !elecTask && !waterTask) return false;
      }

      // 3. Meter Series Prefix Filter
      if (meterSeriesFilter !== "all") {
        const elecPrefix = getMeterPrefix(c.elecMeter);
        const waterPrefix = getMeterPrefix(c.waterMeter);
        if (serviceTab === "electric" && elecPrefix !== meterSeriesFilter) return false;
        if (serviceTab === "water" && waterPrefix !== meterSeriesFilter) return false;
        if (serviceTab === "all" && elecPrefix !== meterSeriesFilter && waterPrefix !== meterSeriesFilter) return false;
      }

      // 4. Search term
      if (term) {
        const text = `${c.name} ${c.shop} ${c.code} ${c.elecMeter || ""} ${c.waterMeter || ""}`.toLowerCase();
        if (!text.includes(term)) return false;
      }

      return true;
    });
  }, [customers, q, serviceTab, statusFilter, meterSeriesFilter, outstanding, tasks]);

  // Pagination
  const effectivePageSize = pageSize === "all" ? Math.max(1, filteredCustomers.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / effectivePageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const displayedCustomers =
    pageSize === "all"
      ? filteredCustomers
      : filteredCustomers.slice(currentPage * effectivePageSize, currentPage * effectivePageSize + effectivePageSize);

  // Modals Data
  const detail = customers.find((c) => c.id === detailId);
  const payCust = customers.find((c) => c.id === payFor);
  const payBills = payCust ? unpaidBillsOf(payCust.id).filter((b) => b.type === payDivision) : [];
  const pickedBillsSum = payBills
    .filter((b) => picked.includes(b.id))
    .reduce((s, b) => s + b.total, 0);
  const effectiveReconnectFee = includeReconnectFee ? Number(reconnectFeeAmount || 0) : 0;
  const pickedTotal = pickedBillsSum + effectiveReconnectFee;

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedCustomerIds.length === displayedCustomers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(displayedCustomers.map((c) => c.id));
    }
  };

  const toggleSelectCustomer = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Batch Request Suspension
  const handleBatchSuspend = (division: Division) => {
    if (selectedCustomerIds.length === 0) return;
    setBatchActionConfirm({
      division,
      ids: selectedCustomerIds,
    });
  };

  const executeBatchSuspend = () => {
    if (!batchActionConfirm) return;
    const { division, ids } = batchActionConfirm;
    ids.forEach((id) => {
      const out = outstanding(id, division);
      createTask(id, "disconnect", division, out);
    });
    setSelectedCustomerIds([]);
    setBatchActionConfirm(null);
  };

  // Quick reset all filters
  const resetFilters = () => {
    setQ("");
    setStatusFilter("all");
    setMeterSeriesFilter("all");
    setPage(0);
  };

  const hasActiveFilters = q !== "" || statusFilter !== "all" || meterSeriesFilter !== "all";

  return (
    <>
      <PageHeader
        title="การระงับบริการ"
        desc={`จัดการการระงับบริการแยกระบบไฟฟ้าและน้ำประปา · ค้างชำระก่อนวันที่ ${settings.suspendCutoffDay} · ค่าประสานมิเตอร์ ฿${thb(settings.penaltyDisconnectionFee)}`}
      />

      <div className="space-y-6">
        {/* 1. Top Summary Metric Cards (Separated Electric / Water / Suspended / Tasks) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Electric Suspension Risks */}
          <Card
            className={`cursor-pointer transition-all hover:border-amber-500/60 ${
              serviceTab === "electric"
                ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20"
                : ""
            }`}
            onClick={() => {
              setServiceTab("electric");
              setPage(0);
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <Zap className="h-4 w-4 fill-amber-500 text-amber-500" />
                ระงับบริการไฟฟ้า
              </CardTitle>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                {stats.elecRiskyCount} ราย
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
                ฿{thb(stats.elecRiskyAmount)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
                <span>ยอดค้างค่าไฟฟ้าเสี่ยงระงับ</span>
                <span className="font-semibold text-destructive">
                  ระงับอยู่ {stats.elecSuspendedCount} ราย
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Water Suspension Risks */}
          <Card
            className={`cursor-pointer transition-all hover:border-blue-500/60 ${
              serviceTab === "water"
                ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20"
                : ""
            }`}
            onClick={() => {
              setServiceTab("water");
              setPage(0);
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                <Droplets className="h-4 w-4 fill-blue-500 text-blue-500" />
                ระงับบริการน้ำประปา
              </CardTitle>
              <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                {stats.waterRiskyCount} ราย
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold text-blue-600 dark:text-blue-400">
                ฿{thb(stats.waterRiskyAmount)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
                <span>ยอดค้างค่าน้ำประปาเสี่ยงระงับ</span>
                <span className="font-semibold text-destructive">
                  ระงับอยู่ {stats.waterSuspendedCount} ราย
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Total Currently Suspended */}
          <Card
            className={`cursor-pointer transition-all hover:border-destructive/60 ${
              statusFilter === "suspended"
                ? "border-destructive ring-2 ring-destructive/20 bg-destructive/5"
                : ""
            }`}
            onClick={() => {
              setStatusFilter((prev) => (prev === "suspended" ? "all" : "suspended"));
              setPage(0);
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5 text-destructive">
                <ShieldAlert className="h-4 w-4" />
                ถูกระงับบริการอยู่
              </CardTitle>
              <Badge variant="destructive" className="font-mono text-xs">
                {stats.totalSuspendedCount} ราย
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold text-destructive">
                {stats.totalSuspendedCount} <span className="text-sm font-normal text-muted-foreground">ราย</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                <span>⚡ ไฟฟ้า {stats.elecSuspendedCount}</span>
                <span>·</span>
                <span>💧 น้ำ {stats.waterSuspendedCount}</span>
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Service Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-primary" />
                ใบงานตัด-ต่อระบบ
              </CardTitle>
              <Button variant="ghost" size="sm" asChild className="h-6 px-1.5 text-xs text-primary">
                <Link to="/tasks">ดูใบงาน →</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold">
                {stats.waitingApprovalTasks + stats.inProgressTasks}{" "}
                <span className="text-sm font-normal text-muted-foreground">รายการเปิด</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                <span className="text-warning font-semibold">รออนุมัติ {stats.waitingApprovalTasks}</span>
                <span>·</span>
                <span className="text-info font-semibold">รอดำเนินการ {stats.inProgressTasks}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2. Main Service Disconnection Panel */}
        <Card className="shadow-sm">
          <CardHeader className="space-y-4 pb-4">
            {/* Division Switcher Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <Tabs
                value={serviceTab}
                onValueChange={(v) => {
                  setServiceTab(v as ServiceTab);
                  setPage(0);
                  setSelectedCustomerIds([]);
                }}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex h-10 p-1 bg-muted/70">
                  <TabsTrigger
                    value="all"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 text-xs sm:text-sm font-medium flex items-center gap-1.5"
                  >
                    <Layers className="h-4 w-4" />
                    รวมทุกบริการ
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[11px]">
                      {stats.elecRiskyCount + stats.waterRiskyCount}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="electric"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 text-xs sm:text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400"
                  >
                    <Zap className="h-4 w-4 fill-amber-500 text-amber-500" />
                    ระงับบริการไฟฟ้า
                    <Badge variant="outline" className="ml-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0 text-[11px]">
                      {stats.elecRiskyCount}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="water"
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 text-xs sm:text-sm font-medium flex items-center gap-1.5 text-blue-700 dark:text-blue-400"
                  >
                    <Droplets className="h-4 w-4 fill-blue-500 text-blue-500" />
                    ระงับบริการน้ำประปา
                    <Badge variant="outline" className="ml-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400 px-1.5 py-0 text-[11px]">
                      {stats.waterRiskyCount}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Batch Action Buttons if items selected */}
              {selectedCustomerIds.length > 0 && canRequest && (
                <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg text-xs animate-in fade-in">
                  <span className="font-semibold text-primary">
                    เลือกแล้ว {selectedCustomerIds.length} ราย
                  </span>
                  {(serviceTab === "electric" || serviceTab === "all") && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => handleBatchSuspend("electric")}
                    >
                      <Ban className="mr-1 h-3.5 w-3.5" /> ระงับไฟฟ้า ({selectedCustomerIds.length})
                    </Button>
                  )}
                  {(serviceTab === "water" || serviceTab === "all") && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleBatchSuspend("water")}
                    >
                      <Ban className="mr-1 h-3.5 w-3.5" /> ระงับน้ำ ({selectedCustomerIds.length})
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => setSelectedCustomerIds([])}
                  >
                    ยกเลิก
                  </Button>
                </div>
              )}
            </div>

            {/* Filter Toolbar: Status Pills, Series Dropdown, Search, Page Size */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              {/* Quick Status Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant={statusFilter === "all" ? "default" : "outline"}
                  className="h-8 text-xs font-medium"
                  onClick={() => {
                    setStatusFilter("all");
                    setPage(0);
                  }}
                >
                  ทั้งหมด ({filteredCustomers.length})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "arrears" ? "default" : "outline"}
                  className={`h-8 text-xs font-medium ${
                    statusFilter === "arrears" ? "bg-amber-600 hover:bg-amber-700 text-white" : "text-amber-700 dark:text-amber-400"
                  }`}
                  onClick={() => {
                    setStatusFilter("arrears");
                    setPage(0);
                  }}
                >
                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                  ค้างชำระ (ยังไม่ระงับ)
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "suspended" ? "default" : "outline"}
                  className={`h-8 text-xs font-medium ${
                    statusFilter === "suspended" ? "bg-destructive hover:bg-destructive/90 text-white" : "text-destructive"
                  }`}
                  onClick={() => {
                    setStatusFilter("suspended");
                    setPage(0);
                  }}
                >
                  <Ban className="mr-1 h-3.5 w-3.5" />
                  ถูกระงับบริการอยู่
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "pending_task" ? "default" : "outline"}
                  className={`h-8 text-xs font-medium ${
                    statusFilter === "pending_task" ? "bg-info hover:bg-info/90 text-white" : "text-info"
                  }`}
                  onClick={() => {
                    setStatusFilter("pending_task");
                    setPage(0);
                  }}
                >
                  <Clock className="mr-1 h-3.5 w-3.5" />
                  มีใบงานเปิดอยู่
                </Button>
              </div>

              {/* Controls: Series Filter, Search, Page Size */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                {/* Meter Series Dropdown */}
                {meterPrefixOptions.length > 0 && (
                  <Select
                    value={meterSeriesFilter}
                    onValueChange={(v) => {
                      setMeterSeriesFilter(v);
                      setPage(0);
                    }}
                  >
                    <SelectTrigger className="h-8 w-auto min-w-[8.5rem] text-xs font-medium">
                      <SelectValue placeholder="หมวดซีรีส์มิเตอร์" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกหมวดซีรีส์ ({meterPrefixOptions.length})</SelectItem>
                      {meterPrefixOptions.map((prefix) => (
                        <SelectItem key={prefix} value={prefix}>
                          ซีรีส์ {prefix}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Search Input */}
                <div className="relative flex-1 sm:w-60 lg:w-56">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-xs"
                    placeholder="ค้นหาชื่อ/ร้าน/มิเตอร์"
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>

                {/* Page size dropdown */}
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    setPageSize(v === "all" ? "all" : Number(v));
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="h-8 w-[5.5rem] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / หน้า</SelectItem>
                    <SelectItem value="20">20 / หน้า</SelectItem>
                    <SelectItem value="50">50 / หน้า</SelectItem>
                    <SelectItem value="100">100 / หน้า</SelectItem>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                  </SelectContent>
                </Select>

                {/* Reset Filters */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={resetFilters}
                    title="ล้างตัวกรองทั้งหมด"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {displayedCustomers.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <CheckCircle2 className="mx-auto h-12 w-12 text-success/70" />
                <p className="text-base font-medium">ไม่พบรายการค้างชำระหรือรายการที่เข้าเงื่อนไขระงับบริการ</p>
                <p className="text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? "ลองเปลี่ยนหรือล้างเงื่อนไขตัวกรอง"
                    : "ผู้ประกอบการทุกรายชำระเงินตามกำหนดปกติ"}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={resetFilters} className="text-xs">
                    ล้างตัวกรอง
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-10 text-center">
                          <Checkbox
                            checked={
                              displayedCustomers.length > 0 &&
                              selectedCustomerIds.length === displayedCustomers.length
                            }
                            onCheckedChange={toggleSelectAll}
                            aria-label="เลือกทั้งหมดในหน้านี้"
                          />
                        </TableHead>
                        <TableHead className="w-20 font-semibold">รหัส</TableHead>
                        <TableHead className="min-w-[160px] font-semibold">ผู้ประกอบการ / ร้านค้า</TableHead>

                        {/* Separate Columns for Electric Mode */}
                        {serviceTab === "electric" && (
                          <>
                            <TableHead className="font-semibold text-amber-700 dark:text-amber-400">
                              <span className="flex items-center gap-1">
                                <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                                เลขมิเตอร์ไฟฟ้า
                              </span>
                            </TableHead>
                            <TableHead className="font-semibold">สถานะบริการไฟฟ้า</TableHead>
                            <TableHead className="font-semibold">เดือนที่ค้าง</TableHead>
                            <TableHead className="text-right font-semibold text-amber-700 dark:text-amber-400">
                              ยอดค้างค่าไฟฟ้า
                            </TableHead>
                          </>
                        )}

                        {/* Separate Columns for Water Mode */}
                        {serviceTab === "water" && (
                          <>
                            <TableHead className="font-semibold text-blue-700 dark:text-blue-400">
                              <span className="flex items-center gap-1">
                                <Droplets className="h-3.5 w-3.5 fill-blue-500 text-blue-500" />
                                เลขมาตรน้ำประปา
                              </span>
                            </TableHead>
                            <TableHead className="font-semibold">สถานะบริการน้ำประปา</TableHead>
                            <TableHead className="font-semibold">เดือนที่ค้าง</TableHead>
                            <TableHead className="text-right font-semibold text-blue-700 dark:text-blue-400">
                              ยอดค้างค่าน้ำประปา
                            </TableHead>
                          </>
                        )}

                        {/* Combined Columns for All Mode */}
                        {serviceTab === "all" && (
                          <>
                            <TableHead className="font-semibold">มิเตอร์ไฟ / น้ำ</TableHead>
                            <TableHead className="font-semibold">สถานะบริการ</TableHead>
                            <TableHead className="text-right font-semibold text-amber-700 dark:text-amber-400">
                              ค้างค่าไฟ
                            </TableHead>
                            <TableHead className="text-right font-semibold text-blue-700 dark:text-blue-400">
                              ค้างค่าน้ำ
                            </TableHead>
                            <TableHead className="text-right font-semibold">ยอดค้างรวม</TableHead>
                          </>
                        )}

                        <TableHead className="text-right font-semibold pr-4">ดำเนินการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedCustomers.map((c) => {
                        const isSelected = selectedCustomerIds.includes(c.id);

                        // Electric info
                        const elecOut = outstanding(c.id, "electric");
                        const isElecSuspended = c.serviceStates?.electric === "suspended";
                        const elecTask = getActiveTask(c.id, "electric");
                        const elecUnpaidBills = unpaidBillsOf(c.id).filter((b) => b.type === "electric");

                        // Water info
                        const waterOut = outstanding(c.id, "water");
                        const isWaterSuspended = c.serviceStates?.water === "suspended";
                        const waterTask = getActiveTask(c.id, "water");
                        const waterUnpaidBills = unpaidBillsOf(c.id).filter((b) => b.type === "water");

                        const totalOut = outstanding(c.id);

                        return (
                          <TableRow
                            key={c.id}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? "bg-primary/5" : ""
                            }`}
                            onClick={() => setDetailId(c.id)}
                          >
                            {/* Checkbox */}
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectCustomer(c.id)}
                              />
                            </TableCell>

                            {/* Code */}
                            <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                              {c.code}
                            </TableCell>

                            {/* Name & Shop */}
                            <TableCell>
                              <p className="text-sm font-semibold">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.shop || "—"}</p>
                            </TableCell>

                            {/* ================= ELECTRIC TAB CONTENT ================= */}
                            {serviceTab === "electric" && (
                              <>
                                <TableCell>
                                  <div className="flex items-center gap-1.5 font-mono text-xs">
                                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="font-medium text-amber-800 dark:text-amber-300">
                                      {c.elecMeter || "—"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {isElecSuspended ? (
                                    <Badge variant="destructive" className="font-medium gap-1 text-xs">
                                      <Ban className="h-3 w-3" /> ระงับไฟฟ้าแล้ว
                                    </Badge>
                                  ) : elecTask ? (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs gap-1 ${taskStatusMap[elecTask.status].cls}`}
                                    >
                                      <Clock className="h-3 w-3" />
                                      {elecTask.type === "disconnect" ? "รอระงับไฟฟ้า" : "รอต่อไฟ"} ·{" "}
                                      {taskStatusMap[elecTask.status].label}
                                    </Badge>
                                  ) : elecOut > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs gap-1"
                                    >
                                      <AlertTriangle className="h-3 w-3" /> ค้างชำระค่าไฟ
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-success/40 text-success text-xs">
                                      ปกติ
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {elecUnpaidBills.length > 0 ? (
                                    <span>
                                      {elecUnpaidBills.map((b) => periodLabel(b.period)).join(", ")}
                                      <span className="ml-1 text-foreground/80 font-medium">
                                        ({elecUnpaidBills.length} เดือน)
                                      </span>
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="font-display text-sm font-bold text-amber-700 dark:text-amber-400">
                                    {elecOut > 0 ? `฿${thb(elecOut)}` : "฿0.00"}
                                  </div>
                                  {elecOut > 0 && (
                                    <div className="text-[11px] font-normal text-amber-800/80 dark:text-amber-300/80">
                                      ค้าง {Math.max(1, elecUnpaidBills.length)} เดือน
                                    </div>
                                  )}
                                </TableCell>
                              </>
                            )}

                            {/* ================= WATER TAB CONTENT ================= */}
                            {serviceTab === "water" && (
                              <>
                                <TableCell>
                                  <div className="flex items-center gap-1.5 font-mono text-xs">
                                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="font-medium text-blue-800 dark:text-blue-300">
                                      {c.waterMeter || "—"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {isWaterSuspended ? (
                                    <Badge variant="destructive" className="font-medium gap-1 text-xs">
                                      <Ban className="h-3 w-3" /> ระงับน้ำแล้ว
                                    </Badge>
                                  ) : waterTask ? (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs gap-1 ${taskStatusMap[waterTask.status].cls}`}
                                    >
                                      <Clock className="h-3 w-3" />
                                      {waterTask.type === "disconnect" ? "รอระงับน้ำประปา" : "รอต่อน้ำ"} ·{" "}
                                      {taskStatusMap[waterTask.status].label}
                                    </Badge>
                                  ) : waterOut > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs gap-1"
                                    >
                                      <AlertTriangle className="h-3 w-3" /> ค้างชำระค่าน้ำ
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-success/40 text-success text-xs">
                                      ปกติ
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {waterUnpaidBills.length > 0 ? (
                                    <span>
                                      {waterUnpaidBills.map((b) => periodLabel(b.period)).join(", ")}
                                      <span className="ml-1 text-foreground/80 font-medium">
                                        ({waterUnpaidBills.length} เดือน)
                                      </span>
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="font-display text-sm font-bold text-blue-700 dark:text-blue-400">
                                    {waterOut > 0 ? `฿${thb(waterOut)}` : "฿0.00"}
                                  </div>
                                  {waterOut > 0 && (
                                    <div className="text-[11px] font-normal text-blue-800/80 dark:text-blue-300/80">
                                      ค้าง {Math.max(1, waterUnpaidBills.length)} เดือน
                                    </div>
                                  )}
                                </TableCell>
                              </>
                            )}

                            {/* ================= ALL TAB CONTENT ================= */}
                            {serviceTab === "all" && (
                              <>
                                <TableCell className="text-xs">
                                  <div className="font-mono text-xs space-y-0.5">
                                    <div className="text-amber-800 dark:text-amber-300">
                                      ⚡ {c.elecMeter || "—"}
                                    </div>
                                    <div className="text-blue-800 dark:text-blue-300">
                                      💧 {c.waterMeter || "—"}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    {isElecSuspended && (
                                      <Badge variant="destructive" className="text-[11px] py-0 w-fit">
                                        🚫 ระงับไฟ
                                      </Badge>
                                    )}
                                    {isWaterSuspended && (
                                      <Badge variant="destructive" className="text-[11px] py-0 w-fit">
                                        🚫 ระงับน้ำ
                                      </Badge>
                                    )}
                                    {!isElecSuspended && !isWaterSuspended && totalOut > 0 && (
                                      <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 text-[11px] py-0 w-fit">
                                        ⚠️ มียอดค้าง
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {elecOut > 0 ? (
                                    <div>
                                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                                        ฿{thb(elecOut)}
                                      </span>
                                      <div className="text-[11px] font-normal text-muted-foreground">
                                        ({Math.max(1, elecUnpaidBills.length)} เดือน)
                                      </div>
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {waterOut > 0 ? (
                                    <div>
                                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                                        ฿{thb(waterOut)}
                                      </span>
                                      <div className="text-[11px] font-normal text-muted-foreground">
                                        ({Math.max(1, waterUnpaidBills.length)} เดือน)
                                      </div>
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="font-display text-sm font-bold text-destructive">
                                    ฿{thb(totalOut)}
                                  </div>
                                </TableCell>
                              </>
                            )}

                            {/* Actions Column */}
                            <TableCell
                              className="text-right pr-4 space-x-1 whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Electric Tab Actions */}
                              {serviceTab === "electric" && (
                                <div className="inline-flex items-center gap-1.5">
                                  {isElecSuspended ? (
                                    <>
                                      <Button
                                        size="sm"
                                        className="h-8 px-3.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center gap-1.5 transition-all"
                                        disabled={!canRequest}
                                        onClick={() => openPayDialog(c.id, "electric")}
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" /> ต่อระบบไฟ
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-3.5 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:border-amber-400 inline-flex items-center gap-1.5 transition-all"
                                        onClick={() => cancelSuspension(c.id, "electric")}
                                        title="ยกเลิกระงับไฟฟ้า"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" /> ยกเลิกระงับไฟฟ้า
                                      </Button>
                                    </>
                                  ) : elecTask ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3.5 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:border-amber-400 inline-flex items-center gap-1.5 transition-all"
                                      onClick={() => cancelTask(elecTask.id)}
                                      title="ยกเลิกใบงานระงับไฟฟ้า"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" /> ยกเลิกระงับไฟฟ้า
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3.5 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:border-amber-400 inline-flex items-center gap-1.5 transition-all"
                                      disabled={!canRequest || elecOut <= 0}
                                      onClick={() =>
                                        createTask(c.id, "disconnect", "electric", elecOut)
                                      }
                                    >
                                      <XCircle className="h-3.5 w-3.5" /> ระงับไฟฟ้า
                                    </Button>
                                  )}
                                </div>
                              )}

                              {/* Water Tab Actions */}
                              {serviceTab === "water" && (
                                <div className="inline-flex items-center gap-1.5">
                                  {isWaterSuspended ? (
                                    <>
                                      <Button
                                        size="sm"
                                        className="h-8 px-3.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center gap-1.5 transition-all"
                                        disabled={!canRequest}
                                        onClick={() => openPayDialog(c.id, "water")}
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" /> ต่อระบบน้ำ
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-3.5 rounded-full text-xs font-semibold border-sky-300 dark:border-sky-700/60 bg-sky-50/90 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 hover:border-sky-400 inline-flex items-center gap-1.5 transition-all"
                                        onClick={() => cancelSuspension(c.id, "water")}
                                        title="ยกเลิกระงับน้ำประปา"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" /> ยกเลิกระงับน้ำประปา
                                      </Button>
                                    </>
                                  ) : waterTask ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3.5 rounded-full text-xs font-semibold border-sky-300 dark:border-sky-700/60 bg-sky-50/90 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 hover:border-sky-400 inline-flex items-center gap-1.5 transition-all"
                                      onClick={() => cancelTask(waterTask.id)}
                                      title="ยกเลิกใบงานระงับน้ำประปา"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" /> ยกเลิกระงับน้ำประปา
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3.5 rounded-full text-xs font-semibold border-sky-300 dark:border-sky-700/60 bg-sky-50/90 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 hover:border-sky-400 inline-flex items-center gap-1.5 transition-all"
                                      disabled={!canRequest || waterOut <= 0}
                                      onClick={() =>
                                        createTask(c.id, "disconnect", "water", waterOut)
                                      }
                                    >
                                      <XCircle className="h-3.5 w-3.5" /> ระงับน้ำประปา
                                    </Button>
                                  )}
                                </div>
                              )}

                              {/* All Tab Actions */}
                              {serviceTab === "all" && (
                                <div className="inline-flex items-center gap-1">
                                  {/* Electric Action */}
                                  {isElecSuspended ? (
                                    <>
                                      <Button
                                        size="sm"
                                        className="h-7 px-2.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center gap-1 transition-all"
                                        disabled={!canRequest}
                                        onClick={() => openPayDialog(c.id, "electric")}
                                      >
                                        <CheckCircle2 className="h-3 w-3" /> ต่อไฟ
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 w-7 rounded-full p-0 border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:border-amber-400 inline-flex items-center justify-center transition-all"
                                        onClick={() => cancelSuspension(c.id, "electric")}
                                        title="ยกเลิกระงับไฟฟ้า"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    </>
                                  ) : elecTask ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2.5 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:border-amber-400 inline-flex items-center gap-1 transition-all"
                                      onClick={() => cancelTask(elecTask.id)}
                                      title="ยกเลิกใบงานระงับไฟฟ้า"
                                    >
                                      <RotateCcw className="h-3 w-3" /> ยกเลิกระงับไฟฟ้า
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2.5 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:border-amber-400 inline-flex items-center gap-1 transition-all"
                                      disabled={!canRequest || elecOut <= 0}
                                      onClick={() =>
                                        createTask(c.id, "disconnect", "electric", elecOut)
                                      }
                                    >
                                      <XCircle className="h-3 w-3" /> ระงับไฟฟ้า
                                    </Button>
                                  )}

                                  {/* Water Action */}
                                  {isWaterSuspended ? (
                                    <>
                                      <Button
                                        size="sm"
                                        className="h-7 px-2.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center gap-1 transition-all"
                                        disabled={!canRequest}
                                        onClick={() => openPayDialog(c.id, "water")}
                                      >
                                        <CheckCircle2 className="h-3 w-3" /> ต่อน้ำ
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 w-7 rounded-full p-0 border-sky-300 dark:border-sky-700/60 bg-sky-50/90 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 hover:border-sky-400 inline-flex items-center justify-center transition-all"
                                        onClick={() => cancelSuspension(c.id, "water")}
                                        title="ยกเลิกระงับน้ำประปา"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    </>
                                  ) : waterTask ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2.5 rounded-full text-xs font-semibold border-sky-300 dark:border-sky-700/60 bg-sky-50/90 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 hover:border-sky-400 inline-flex items-center gap-1 transition-all"
                                      onClick={() => cancelTask(waterTask.id)}
                                      title="ยกเลิกใบงานระงับน้ำประปา"
                                    >
                                      <RotateCcw className="h-3 w-3" /> ยกเลิกระงับน้ำประปา
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2.5 rounded-full text-xs font-semibold border-sky-300 dark:border-sky-700/60 bg-sky-50/90 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 hover:border-sky-400 inline-flex items-center gap-1 transition-all"
                                      disabled={!canRequest || waterOut <= 0}
                                      onClick={() =>
                                        createTask(c.id, "disconnect", "water", waterOut)
                                      }
                                    >
                                      <XCircle className="h-3 w-3" /> ระงับน้ำประปา
                                    </Button>
                                  )}
                                </div>
                              )}

                              {/* View detail button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 inline-flex items-center justify-center transition-all"
                                onClick={() => setDetailId(c.id)}
                                title="ดูรายละเอียด"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border px-4 py-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    แสดง {pageSize === "all" ? 1 : currentPage * (pageSize as number) + 1}–
                    {pageSize === "all"
                      ? filteredCustomers.length
                      : Math.min(filteredCustomers.length, (currentPage + 1) * (pageSize as number))}{" "}
                    จากทั้งหมด {filteredCustomers.length} รายการ
                  </div>
                  {pageSize !== "all" && totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        disabled={currentPage === 0}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span>
                        หน้า {currentPage + 1} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ================= DETAIL DIALOG (CUSTOMER & UNPAID BILLS BY DIVISION) ================= */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.name}
                  <Badge variant="outline" className={displayStatus(detail.id).cls}>
                    {displayStatus(detail.id).label}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  {detail.code} · {detail.shop || "ไม่มีชื่อร้าน"}
                </DialogDescription>
              </DialogHeader>

              <div className="divide-y divide-border text-xs sm:text-sm">
                <p className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">เบอร์โทรศัพท์</span>
                  <span className="font-mono">{detail.phone || "—"}</span>
                </p>
                <p className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Line ID</span>
                  <span>{detail.lineId || "—"}</span>
                </p>
                <p className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">มิเตอร์ไฟฟ้า / มาตรน้ำประปา</span>
                  <span className="font-mono">
                    ⚡ {detail.elecMeter || "—"} / 💧 {detail.waterMeter || "—"}
                  </span>
                </p>
                <p className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">สถานะไฟฟ้า / น้ำประปา</span>
                  <span className="space-x-1">
                    <Badge
                      variant={detail.serviceStates?.electric === "suspended" ? "destructive" : "outline"}
                      className="text-[11px]"
                    >
                      ⚡ {detail.serviceStates?.electric === "suspended" ? "ระงับบริการ" : "ปกติ"}
                    </Badge>
                    <Badge
                      variant={detail.serviceStates?.water === "suspended" ? "destructive" : "outline"}
                      className="text-[11px]"
                    >
                      💧 {detail.serviceStates?.water === "suspended" ? "ระงับบริการ" : "ปกติ"}
                    </Badge>
                  </span>
                </p>
              </div>

              <Separator />

              {/* Unpaid Bills Breakdown */}
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">ยอดค้างชำระทั้งหมด</p>
                  <p className="font-display text-xl font-bold text-destructive">
                    ฿{thb(outstanding(detail.id))}
                  </p>
                </div>

                {/* Electric Unpaid */}
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> หมวดไฟฟ้า
                      {unpaidBillsOf(detail.id).filter((b) => b.type === "electric").length > 0 && (
                        <span className="font-normal text-amber-700/90 dark:text-amber-300/90 text-[11px]">
                          (ค้าง {unpaidBillsOf(detail.id).filter((b) => b.type === "electric").length} เดือน)
                        </span>
                      )}
                    </span>
                    <span>฿{thb(outstanding(detail.id, "electric"))}</span>
                  </div>
                  {unpaidBillsOf(detail.id).filter((b) => b.type === "electric").length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">ไม่มีบิลค้างชำระไฟฟ้า</p>
                  ) : (
                    unpaidBillsOf(detail.id)
                      .filter((b) => b.type === "electric")
                      .map((b) => (
                        <div key={b.id} className="flex justify-between text-xs text-muted-foreground pt-0.5">
                          <span>บิล {periodLabel(b.period)} ({b.no})</span>
                          <span className="font-mono">฿{thb(b.total)}</span>
                        </div>
                      ))
                  )}
                </div>

                {/* Water Unpaid */}
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2.5 space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-blue-800 dark:text-blue-300">
                    <span className="flex items-center gap-1">
                      <Droplets className="h-3.5 w-3.5 fill-blue-500 text-blue-500" /> หมวดน้ำประปา
                      {unpaidBillsOf(detail.id).filter((b) => b.type === "water").length > 0 && (
                        <span className="font-normal text-blue-700/90 dark:text-blue-300/90 text-[11px]">
                          (ค้าง {unpaidBillsOf(detail.id).filter((b) => b.type === "water").length} เดือน)
                        </span>
                      )}
                    </span>
                    <span>฿{thb(outstanding(detail.id, "water"))}</span>
                  </div>
                  {unpaidBillsOf(detail.id).filter((b) => b.type === "water").length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">ไม่มีบิลค้างชำระน้ำประปา</p>
                  ) : (
                    unpaidBillsOf(detail.id)
                      .filter((b) => b.type === "water")
                      .map((b) => (
                        <div key={b.id} className="flex justify-between text-xs text-muted-foreground pt-0.5">
                          <span>บิล {periodLabel(b.period)} ({b.no})</span>
                          <span className="font-mono">฿{thb(b.total)}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
                {/* Electric Action */}
                {detail.serviceStates?.electric === "suspended" ? (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 px-3.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center gap-1.5 transition-all"
                      onClick={() => {
                        openPayDialog(detail.id, "electric");
                        setDetailId(null);
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> ต่อระบบไฟฟ้า
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3.5 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:border-amber-400 inline-flex items-center gap-1.5 transition-all"
                      onClick={() => {
                        cancelSuspension(detail.id, "electric");
                        setDetailId(null);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> ยกเลิกระงับไฟฟ้า
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3.5 rounded-full text-xs font-semibold border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:border-amber-400 inline-flex items-center gap-1.5 transition-all"
                    disabled={outstanding(detail.id, "electric") <= 0}
                    onClick={() => {
                      createTask(detail.id, "disconnect", "electric", outstanding(detail.id, "electric"));
                      setDetailId(null);
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" /> ระงับไฟฟ้า
                  </Button>
                )}

                {/* Water Action */}
                {detail.serviceStates?.water === "suspended" ? (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-8 px-3.5 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center gap-1.5 transition-all"
                      onClick={() => {
                        openPayDialog(detail.id, "water");
                        setDetailId(null);
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> ต่อระบบน้ำประปา
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3.5 rounded-full text-xs font-semibold border-sky-300 dark:border-sky-700/60 bg-sky-50/90 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 hover:border-sky-400 inline-flex items-center gap-1.5 transition-all"
                      onClick={() => {
                        cancelSuspension(detail.id, "water");
                        setDetailId(null);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> ยกเลิกระงับน้ำประปา
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3.5 rounded-full text-xs font-semibold border-sky-300 dark:border-sky-700/60 bg-sky-50/90 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 hover:bg-sky-100 hover:border-sky-400 inline-flex items-center gap-1.5 transition-all"
                    disabled={outstanding(detail.id, "water") <= 0}
                    onClick={() => {
                      createTask(detail.id, "disconnect", "water", outstanding(detail.id, "water"));
                      setDetailId(null);
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" /> ระงับน้ำประปา
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ================= RECONNECTION & PAYMENT DIALOG ================= */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ต่อระบบ · รับชำระยอดค้าง ({payDivision === "electric" ? "ไฟฟ้า" : "น้ำประปา"})
            </DialogTitle>
            <DialogDescription>
              {payCust?.name} ({payCust?.shop}) — เลือกเดือนที่ต้องการชำระและคิดค่าประสานมิเตอร์
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            {/* Header with Selection Control */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>รายการบิลค้างชำระ ({payBills.length} เดือน)</span>
              {payBills.length > 1 && (
                <button
                  type="button"
                  className="text-primary hover:underline font-medium"
                  onClick={() => {
                    if (picked.length === payBills.length) {
                      setPicked([]);
                    } else {
                      setPicked(payBills.map((b) => b.id));
                    }
                  }}
                >
                  {picked.length === payBills.length ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
                </button>
              )}
            </div>

            {/* Overdue Bills List */}
            <div className="rounded-md border border-border divide-y divide-border max-h-48 overflow-y-auto">
              {payBills.map((b) => (
                <label
                  key={b.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 text-xs sm:text-sm hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={picked.includes(b.id)}
                    onCheckedChange={(v) =>
                      setPicked((prev) => (v ? [...prev, b.id] : prev.filter((x) => x !== b.id)))
                    }
                  />
                  <span className="flex-1">
                    ยอดค้างเดือน {periodLabel(b.period)} ·{" "}
                    <span className="font-mono text-xs text-muted-foreground">{b.no}</span>
                  </span>
                  <span className="font-mono font-semibold">฿{thb(b.total)}</span>
                </label>
              ))}
              {payBills.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">ไม่มียอดค้างในหมวดนี้</p>
              ) : null}
            </div>

            {/* Reconnection Fee (ค่าประสานมิเตอร์) Section */}
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-3 transition-all">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="inc-reconnect-fee"
                    checked={includeReconnectFee}
                    onCheckedChange={(v) => setIncludeReconnectFee(!!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-200">
                        ค่าประสานมิเตอร์ (ต่อระบบ)
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-300 text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-900/40">
                        {payDivision === "electric" ? "⚡ ไฟฟ้า" : "💧 น้ำประปา"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5">
                      ค่าธรรมเนียมต่อมิเตอร์กลับเข้าสู่ระบบตามระเบียบ ชย.ทอ.
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-mono font-bold text-sm sm:text-base ${includeReconnectFee ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground line-through"}`}>
                    +฿{thb(reconnectFeeAmount)}
                  </span>
                </div>
              </label>
            </div>

            {/* Reference Number Input */}
            <div className="grid gap-1.5">
              <Label htmlFor="sref" className="text-xs font-medium">เลขที่อ้างอิงจากสลิป / ใบเสร็จ</Label>
              <Input
                id="sref"
                className="font-mono text-sm uppercase"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="เช่น TMB123456 หรือ RC-00123"
              />
            </div>

            {/* Total Calculation Breakdown Card */}
            <div className="rounded-lg bg-muted/80 p-3 space-y-1.5 border border-border/60">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ยอดค้างชำระ ({picked.length} รายการ)</span>
                <span className="font-mono font-medium">฿{thb(pickedBillsSum)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ค่าประสานมิเตอร์ (ต่อระบบ)</span>
                <span className="font-mono font-medium">
                  {includeReconnectFee ? `+฿${thb(reconnectFeeAmount)}` : "฿0.00 (ไม่คิดค่าธรรมเนียม)"}
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex items-baseline justify-between pt-0.5">
                <span className="text-sm font-semibold">รวมยอดที่รับชำระทั้งสิ้น</span>
                <span className="font-display text-xl font-bold text-primary">฿{thb(pickedTotal)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button variant="outline" size="sm" onClick={() => setPayFor(null)}>
              ยกเลิก
            </Button>
            <Button
              size="sm"
              disabled={(!picked.length && !includeReconnectFee) || !ref.trim()}
              onClick={() => {
                const effectiveFee = includeReconnectFee ? reconnectFeeAmount : 0;
                const cleanRef = ref.trim().toUpperCase();
                if (settle({ billIds: picked, method: "counter", ref: cleanRef, slipAttached: true, reconnectFee: effectiveFee })) {
                  // Create reconnection task and dispatch to Electricity/Water division
                  if (payCust?.serviceStates?.[payDivision] === "suspended" || payCust?.serviceStates?.[payDivision] === "pending_reconnect") {
                    createTask(payCust.id, "reconnect", payDivision, 0, {
                      referenceNo: cleanRef,
                      reconnectFee: effectiveFee,
                      autoApprove: true,
                    });
                  }
                  setPayFor(null);
                }
              }}
            >
              รับชำระและแจ้งใบงานต่อระบบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= BATCH SUSPENSION CONFIRMATION DIALOG ================= */}
      <Dialog open={!!batchActionConfirm} onOpenChange={(o) => !o && setBatchActionConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              ยืนยันการส่งขออนุมัติระงับบริการ{batchActionConfirm?.division === "electric" ? "ไฟฟ้า" : "น้ำประปา"}
            </DialogTitle>
            <DialogDescription>
              ระบบจะสร้างใบงานขออนุมัติระงับบริการ{batchActionConfirm?.division === "electric" ? "ไฟฟ้า" : "น้ำประปา"}{" "}
              จำนวน <strong>{batchActionConfirm?.ids.length} รายการ</strong> เพื่อเสนอผู้บังคับบัญชาอนุมัติต่อไป
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border p-3 max-h-48 overflow-y-auto space-y-1 text-xs">
            {batchActionConfirm?.ids.map((id) => {
              const c = customers.find((x) => x.id === id);
              if (!c) return null;
              const out = outstanding(id, batchActionConfirm.division);
              const unpaidMonths = unpaidBillsOf(id).filter((b) => b.type === batchActionConfirm.division).length;
              return (
                <div key={id} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                  <span>
                    {c.name} ({c.code})
                    {unpaidMonths > 0 ? (
                      <span className="text-muted-foreground ml-1">(ค้าง {unpaidMonths} เดือน)</span>
                    ) : null}
                  </span>
                  <span className="font-mono font-semibold text-destructive">฿{thb(out)}</span>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setBatchActionConfirm(null)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" size="sm" onClick={executeBatchSuspend}>
              ยืนยันส่งใบงานระงับบริการ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

