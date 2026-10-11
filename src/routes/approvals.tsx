import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Zap,
  Droplets,
  Eye,
  FileCheck,
  RotateCcw,
  CheckSquare,
  Building2,
  ArrowRight,
  History,
} from "lucide-react";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useRcms, thb } from "@/lib/rcms-store";
import { RCMS_LOGO_URL } from "@/lib/branding";
import type { ServiceTask, TaskStatus } from "@/lib/rcms-types";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "อนุมัติระงับบริการ · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "ศูนย์พิจารณาอนุมัติคำขอระงับบริการไฟฟ้าและน้ำประปา สำหรับผู้บังคับบัญชา (ผบช.) กรมช่างโยธาทหารอากาศ",
      },
      { property: "og:title", content: "อนุมัติระงับบริการ · RCMS ชย.ทอ." },
      { property: "og:description", content: "Suspension Approval Management for Commanders" },
    ],
  }),
  component: ApprovalsPage,
});

const PAGE = 15;

const approvalStatusConfig: Record<
  TaskStatus,
  { label: string; cls: string; icon: typeof Clock }
> = {
  waiting_approval: {
    label: "รอ ผบช. อนุมัติ",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-semibold",
    icon: Clock,
  },
  approved: {
    label: "อนุมัติแล้ว · ส่งมอบกองช่าง",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    icon: CheckCircle2,
  },
  in_progress: {
    label: "กองช่างกำลังดำเนินการ",
    cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
    icon: Clock,
  },
  done: {
    label: "ระงับบริการเสร็จสิ้น",
    cls: "bg-muted text-muted-foreground border-border",
    icon: FileCheck,
  },
  rejected: {
    label: "ไม่อนุมัติคำขอ",
    cls: "bg-destructive/15 text-destructive border-destructive/40",
    icon: XCircle,
  },
  cancelled: {
    label: "ยกเลิกคำขอแล้ว",
    cls: "bg-muted text-muted-foreground border-border",
    icon: XCircle,
  },
};

function ApprovalsPage() {
  const {
    tasks,
    decideTask,
    batchDecideTasks,
    cancelTask,
    customerOf,
    unpaidBillsOf,
    role,
  } = useRcms();

  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("waiting_approval");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTask, setActiveTask] = useState<ServiceTask | null>(null);

  const canDecide = role === "supervisor" || role === "admin";
  const canCancel = role === "supervisor" || role === "admin" || role === "revenue_officer";

  // Filter and deduplicate disconnect requests for this dedicated approval screen
  const disconnectTasks = useMemo(() => {
    const seen = new Set<string>();
    return tasks.filter((t) => {
      if (!t || !t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return t.type === "disconnect";
    });
  }, [tasks]);

  // Statistics for KPI Cards
  const elecWaiting = disconnectTasks.filter(
    (t) => t.division === "electric" && t.status === "waiting_approval",
  );
  const elecWaitingSum = elecWaiting.reduce((sum, t) => sum + (t.amountDue || 0), 0);

  const waterWaiting = disconnectTasks.filter(
    (t) => t.division === "water" && t.status === "waiting_approval",
  );
  const waterWaitingSum = waterWaiting.reduce((sum, t) => sum + (t.amountDue || 0), 0);

  const approvedCount = disconnectTasks.filter(
    (t) => t.status === "approved" || t.status === "in_progress",
  ).length;

  const rejectedCount = disconnectTasks.filter((t) => t.status === "rejected").length;

  // Fully filtered tasks
  const filteredTasks = useMemo(() => {
    const term = q.trim().toLowerCase();
    return disconnectTasks.filter((t) => {
      const c = customerOf(t.customerId);
      const matchesSearch =
        !term ||
        t.id.toLowerCase().includes(term) ||
        (c &&
          (c.name.toLowerCase().includes(term) ||
            c.shop.toLowerCase().includes(term) ||
            c.code.toLowerCase().includes(term) ||
            (c.elecMeter && c.elecMeter.toLowerCase().includes(term)) ||
            (c.waterMeter && c.waterMeter.toLowerCase().includes(term))));

      const matchesDivision = divisionFilter === "all" || t.division === divisionFilter;
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;

      return matchesSearch && matchesDivision && matchesStatus;
    });
  }, [disconnectTasks, q, divisionFilter, statusFilter, customerOf]);

  const pages = Math.max(1, Math.ceil(filteredTasks.length / PAGE));
  const current = Math.min(page, pages - 1);
  const view = filteredTasks.slice(current * PAGE, current * PAGE + PAGE);

  const activeCustomer = activeTask ? customerOf(activeTask.customerId) : null;
  const activeUnpaidBills = activeTask ? unpaidBillsOf(activeTask.customerId) : [];

  // ================= APPROVAL HISTORY SECTION STATE & DATA =================
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(true);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");
  const [historyDivisionFilter, setHistoryDivisionFilter] = useState<string>("all");
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState<number | "all">(10);

  // Decided tasks for History section (any task with decision: approved, rejected, in_progress, done, cancelled)
  const historyTasksList = useMemo(() => {
    return disconnectTasks.filter((t) => t.status !== "waiting_approval");
  }, [disconnectTasks]);

  const historyApprovedCount = historyTasksList.filter(
    (t) => t.status === "approved" || t.status === "in_progress" || t.status === "done",
  ).length;
  const historyRejectedCount = historyTasksList.filter((t) => t.status === "rejected").length;
  const historyCancelledCount = historyTasksList.filter((t) => t.status === "cancelled").length;

  const filteredHistoryTasks = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    return historyTasksList.filter((t) => {
      const c = customerOf(t.customerId);
      const matchesSearch =
        !term ||
        t.id.toLowerCase().includes(term) ||
        (c &&
          (c.name.toLowerCase().includes(term) ||
            c.shop.toLowerCase().includes(term) ||
            c.code.toLowerCase().includes(term) ||
            (c.elecMeter && c.elecMeter.toLowerCase().includes(term)) ||
            (c.waterMeter && c.waterMeter.toLowerCase().includes(term))));

      const matchesDivision =
        historyDivisionFilter === "all" || t.division === historyDivisionFilter;
      const matchesStatus =
        historyStatusFilter === "all" || t.status === historyStatusFilter;

      return matchesSearch && matchesDivision && matchesStatus;
    });
  }, [historyTasksList, historySearch, historyDivisionFilter, historyStatusFilter, customerOf]);

  const historyPages =
    historyPageSize === "all"
      ? 1
      : Math.max(1, Math.ceil(filteredHistoryTasks.length / (historyPageSize as number)));
  const currentHistoryPage = Math.min(historyPage, historyPages - 1);
  const historyView =
    historyPageSize === "all"
      ? filteredHistoryTasks
      : filteredHistoryTasks.slice(
          currentHistoryPage * (historyPageSize as number),
          currentHistoryPage * (historyPageSize as number) + (historyPageSize as number),
        );

  // Handle batch select
  const allPageIds = view.map((t) => t.id);
  const isAllPageSelected =
    allPageIds.length > 0 && allPageIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allPageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allPageIds])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleBatchApprove = () => {
    if (selectedIds.length === 0) return;
    batchDecideTasks(selectedIds, true);
    setSelectedIds([]);
  };

  const handleBatchReject = () => {
    if (selectedIds.length === 0) return;
    batchDecideTasks(selectedIds, false);
    setSelectedIds([]);
  };

  return (
    <>
      <PageHeader
        title="อนุมัติระงับบริการ"
        desc="ศูนย์พิจารณาอนุมัติคำขอระงับบริการไฟฟ้าและน้ำประปา สำหรับผู้บังคับบัญชา (ผบช.) · กรมช่างโยธาทหารอากาศ"
      />

      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Electric Waiting Approval */}
        <Card className="border-l-4 border-l-amber-500 shadow-xs bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  รออนุมัติระงับไฟฟ้า
                </p>
                <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {elecWaiting.length} <span className="text-sm font-normal text-muted-foreground">รายการ</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono font-medium">
                  ยอดค้าง ฿{thb(elecWaitingSum)}
                </p>
              </div>
              <div className="rounded-full bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
                <Zap className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Water Waiting Approval */}
        <Card className="border-l-4 border-l-blue-500 shadow-xs bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  รออนุมัติระงับน้ำประปา
                </p>
                <p className="font-display text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {waterWaiting.length} <span className="text-sm font-normal text-muted-foreground">รายการ</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono font-medium">
                  ยอดค้าง ฿{thb(waterWaitingSum)}
                </p>
              </div>
              <div className="rounded-full bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
                <Droplets className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approved & Sent to Field */}
        <Card className="border-l-4 border-l-emerald-500 shadow-xs bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  อนุมัติแล้ว · ส่งมอบกองช่าง
                </p>
                <p className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {approvedCount} <span className="text-sm font-normal text-muted-foreground">รายการ</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  พร้อมให้เจ้าหน้าที่ลงพื้นที่ตัดระบบ
                </p>
              </div>
              <div className="rounded-full bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rejected */}
        <Card className="border-l-4 border-l-destructive shadow-xs bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ไม่อนุมัติ / ยกเลิกคำขอ
                </p>
                <p className="font-display text-2xl font-bold text-destructive mt-1">
                  {rejectedCount} <span className="text-sm font-normal text-muted-foreground">รายการ</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  คำขอที่ไม่ผ่านการพิจารณา
                </p>
              </div>
              <div className="rounded-full bg-destructive/10 p-2.5 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Division Selector Tabs (แยกระบบ ไฟฟ้า / น้ำประปา) */}
      <div className="mb-6">
        <Tabs
          value={divisionFilter}
          onValueChange={(v) => {
            setDivisionFilter(v);
            setPage(0);
            setSelectedIds([]);
          }}
        >
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex h-11 bg-muted/70 p-1 border border-border">
            <TabsTrigger
              value="all"
              className="gap-2 text-sm font-medium data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <ShieldCheck className="h-4 w-4 text-primary" />
              ทุกระบบ
              <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0 h-5">
                {elecWaiting.length + waterWaiting.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="electric"
              className="gap-2 text-sm font-medium data-[state=active]:bg-card data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300 data-[state=active]:shadow-xs"
            >
              <Zap className="h-4 w-4 fill-amber-500 text-amber-500" />
              กองไฟฟ้า
              <Badge
                variant="outline"
                className="ml-1 text-[11px] px-1.5 py-0 h-5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              >
                {elecWaiting.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="water"
              className="gap-2 text-sm font-medium data-[state=active]:bg-card data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-xs"
            >
              <Droplets className="h-4 w-4 fill-blue-500 text-blue-500" />
              กองประปา
              <Badge
                variant="outline"
                className="ml-1 text-[11px] px-1.5 py-0 h-5 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
              >
                {waterWaiting.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-xs border-border">
        <CardHeader className="pb-3 pt-4 px-4 border-b border-border">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="font-display text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                รายการคำขอระงับบริการสำหรับผู้บังคับบัญชาพิจารณา
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                เมื่อผู้บังคับบัญชากดอนุมัติ ใบงานจะถูกส่งต่อไปยังหน้ามอบหมายใบงานเพื่อให้เจ้าหน้าที่กองช่างลงพื้นที่ตัดระบบต่อไป
              </p>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(0);
                  setSelectedIds([]);
                }}
              >
                <SelectTrigger className="h-8 w-44 text-xs font-medium bg-background">
                  <SelectValue placeholder="สถานะการพิจารณา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waiting_approval">⏳ รอ ผบช. อนุมัติ</SelectItem>
                  <SelectItem value="approved">✅ อนุมัติแล้ว · ส่งมอบกองช่าง</SelectItem>
                  <SelectItem value="rejected">🚫 ไม่อนุมัติ</SelectItem>
                  <SelectItem value="all">📋 ทุกสถานะ</SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ/ร้าน/มิเตอร์..."
                  className="h-8 pl-8 text-xs bg-background"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Batch Action Toolbar */}
          {selectedIds.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">
                  เลือกอยู่ {selectedIds.length} รายการ
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                  onClick={handleBatchApprove}
                  disabled={!canDecide}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  อนุมัติทั้งหมดที่เลือก ({selectedIds.length})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs font-medium shadow-xs"
                  onClick={handleBatchReject}
                  disabled={!canDecide}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  ไม่อนุมัติ ({selectedIds.length})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setSelectedIds([])}
                >
                  ยกเลิกการเลือก
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {filteredTasks.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500/70" />
              <p className="text-base font-medium">ไม่พบรายการคำขอระงับบริการที่รออนุมัติ</p>
              <p className="text-xs text-muted-foreground">
                {statusFilter === "waiting_approval"
                  ? "ไม่มีคำขอค้างอยู่ ผู้บังคับบัญชาได้พิจารณาครบถ้วนแล้ว"
                  : "ลองเปลี่ยนเงื่อนไขการค้นหาหรือตัวกรองสถานะ"}
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Button variant="outline" size="sm" asChild className="text-xs">
                  <Link to="/service">ไปสร้างคำขอระงับบริการ</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="text-xs">
                  <Link to="/tasks">ดูงานที่มอบหมายแล้ว</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-10 text-center">
                        <Checkbox
                          checked={isAllPageSelected}
                          onCheckedChange={toggleSelectAllPage}
                          aria-label="เลือกทั้งหมดในหน้านี้"
                        />
                      </TableHead>
                      <TableHead className="w-28 font-semibold">รหัสคำขอ</TableHead>
                      <TableHead className="font-semibold">ผู้ใช้น้ำ-ไฟ / กิจการ</TableHead>
                      <TableHead className="w-32 font-semibold">ระบบ</TableHead>
                      <TableHead className="w-36 font-semibold">เลขมิเตอร์</TableHead>
                      <TableHead className="text-right font-semibold">ยอดหนี้ค้างชำระ</TableHead>
                      <TableHead className="text-center font-semibold">สถานะ</TableHead>
                      <TableHead className="w-28 text-center font-semibold">วันที่ยื่นคำขอ</TableHead>
                      <TableHead className="w-64 text-right pr-4 font-semibold">
                        การพิจารณา (ผบช.)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.map((t) => {
                      const c = customerOf(t.customerId);
                      const st = approvalStatusConfig[t.status];
                      const isSelected = selectedIds.includes(t.id);
                      const meter =
                        t.division === "electric"
                          ? c?.elecMeter || "—"
                          : c?.waterMeter || "—";

                      return (
                        <TableRow
                          key={t.id}
                          className={`hover:bg-muted/40 transition-colors ${
                            isSelected ? "bg-primary/5" : ""
                          }`}
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectOne(t.id)}
                              aria-label={`เลือก ${t.id}`}
                            />
                          </TableCell>

                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            {t.id}
                          </TableCell>

                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground text-sm">
                                {c?.name ?? "ไม่ทราบชื่อ"}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Building2 className="h-3 w-3 shrink-0" />
                                {c?.shop || "—"}{c?.siteCode ? ` · รหัสสถานที่: ${c.siteCode}` : ""}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell>
                            {t.division === "electric" ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1 text-xs font-semibold"
                              >
                                <Zap className="h-3 w-3 fill-amber-500" /> ไฟฟ้า
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 gap-1 text-xs font-semibold"
                              >
                                <Droplets className="h-3 w-3 fill-blue-500" /> น้ำประปา
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="font-mono text-xs text-muted-foreground font-medium">
                            {meter}
                          </TableCell>

                          <TableCell className="text-right font-mono text-sm font-bold text-destructive">
                            ฿{thb(t.amountDue)}
                          </TableCell>

                          <TableCell className="text-center">
                            <Badge variant="outline" className={`text-xs gap-1 ${st.cls}`}>
                              <st.icon className="h-3 w-3" />
                              {st.label}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-center text-xs text-muted-foreground">
                            {t.createdAt}
                          </TableCell>

                          <TableCell
                            className="text-right pr-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              {t.status === "waiting_approval" && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                                    onClick={() => decideTask(t.id, true)}
                                    disabled={!canDecide}
                                    title={!canDecide ? "ต้องใช้สิทธิ์ผู้บังคับบัญชา" : "อนุมัติคำขอระงับบริการ"}
                                  >
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> อนุมัติ
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 font-medium"
                                    onClick={() => decideTask(t.id, false)}
                                    disabled={!canDecide}
                                    title="ไม่อนุมัติคำขอนี้"
                                  >
                                    <XCircle className="mr-1 h-3.5 w-3.5" /> ไม่อนุมัติ
                                  </Button>
                                </>
                              )}

                              {t.status === "approved" && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                >
                                  ส่งมอบแล้ว
                                </Badge>
                              )}

                              {t.status !== "cancelled" && t.status !== "rejected" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                                  onClick={() => cancelTask(t.id)}
                                  disabled={!canCancel}
                                  title="ยกเลิกระงับบริการ"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => setActiveTask(t)}
                                title="ดูรายละเอียดและพิมพ์ใบสั่งการ"
                              >
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <p className="text-muted-foreground text-xs">
                  แสดง {current * PAGE + 1}–
                  {Math.min(filteredTasks.length, (current + 1) * PAGE)} จาก{" "}
                  {filteredTasks.length} รายการ
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current === 0}
                    onClick={() => setPage(current - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground font-medium">
                    หน้า {current + 1} / {pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current >= pages - 1}
                    onClick={() => setPage(current + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ================= APPROVAL HISTORY CARD (ประวัติการอนุมัติ) ================= */}
      <Card className="shadow-xs border-border mt-6">
        <CardHeader
          className={`pt-4 px-4 transition-all ${
            isHistoryExpanded ? "pb-3 border-b border-border" : "pb-4"
          }`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="cursor-pointer select-none group"
              onClick={() => setIsHistoryExpanded((prev) => !prev)}
            >
              <CardTitle className="font-display text-lg font-bold flex items-center gap-2 group-hover:text-primary transition-colors">
                <History className="h-5 w-5 text-primary" />
                รายการประวัติการอนุมัติและผลการพิจารณา
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                ประวัติรายการคำขอระงับบริการที่ผ่านการพิจารณาแล้ว โดยผู้บังคับบัญชา (ผบช.) กรมช่างโยธาทหารอากาศ
              </p>
            </div>

            {/* Quick Summary Badges & Toggle Button */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-xs bg-muted/60">
                  ประวัติทั้งหมด {historyTasksList.length} รายการ
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" /> อนุมัติ {historyApprovedCount}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs border-destructive/30 bg-destructive/10 text-destructive font-medium"
                >
                  <XCircle className="h-3 w-3 mr-1" /> ไม่อนุมัติ {historyRejectedCount}
                </Badge>
                {historyCancelledCount > 0 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    <RotateCcw className="h-3 w-3 mr-1" /> ยกเลิก {historyCancelledCount}
                  </Badge>
                )}
              </div>

              {/* Expand / Collapse Button */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-medium border-border hover:bg-muted/70 gap-1.5 shadow-2xs"
                onClick={() => setIsHistoryExpanded((prev) => !prev)}
                title={isHistoryExpanded ? "ย่อตารางประวัติ" : "ขยายตารางประวัติ"}
              >
                <span>{isHistoryExpanded ? "ย่อตาราง" : "ขยายตาราง"}</span>
                {isHistoryExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          {/* History Filter Toolbar (Shown only when expanded) */}
          {isHistoryExpanded && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
              <Select
                value={historyStatusFilter}
                onValueChange={(v) => {
                  setHistoryStatusFilter(v);
                  setHistoryPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-44 text-xs font-medium bg-background">
                  <SelectValue placeholder="ผลการพิจารณา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">📋 ทุกผลการพิจารณา</SelectItem>
                  <SelectItem value="approved">✅ อนุมัติแล้ว · ส่งมอบกองช่าง</SelectItem>
                  <SelectItem value="rejected">🚫 ไม่อนุมัติคำขอ</SelectItem>
                  <SelectItem value="in_progress">⚙️ กองช่างกำลังดำเนินการ</SelectItem>
                  <SelectItem value="done">🏁 ระงับบริการเสร็จสิ้น</SelectItem>
                  <SelectItem value="cancelled">↩️ ยกเลิกคำขอแล้ว</SelectItem>
                </SelectContent>
              </Select>

              {/* Division Filter */}
              <Select
                value={historyDivisionFilter}
                onValueChange={(v) => {
                  setHistoryDivisionFilter(v);
                  setHistoryPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-32 text-xs font-medium bg-background">
                  <SelectValue placeholder="ระบบ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">⚡💧 ทุกระบบ</SelectItem>
                  <SelectItem value="electric">⚡ ไฟฟ้า</SelectItem>
                  <SelectItem value="water">💧 น้ำประปา</SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ/ร้าน/มิเตอร์/รหัส..."
                  className="h-8 pl-8 text-xs bg-background"
                  value={historySearch}
                  onChange={(e) => {
                    setHistorySearch(e.target.value);
                    setHistoryPage(0);
                  }}
                />
              </div>

              {(historySearch || historyStatusFilter !== "all" || historyDivisionFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setHistorySearch("");
                    setHistoryStatusFilter("all");
                    setHistoryDivisionFilter("all");
                    setHistoryPage(0);
                  }}
                  title="ล้างตัวกรองประวัติ"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> ล้างตัวกรอง
                </Button>
              )}
            </div>

            {/* Page size */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>แสดง:</span>
              <Select
                value={String(historyPageSize)}
                onValueChange={(v) => {
                  setHistoryPageSize(v === "all" ? "all" : Number(v));
                  setHistoryPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-24 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / หน้า</SelectItem>
                  <SelectItem value="25">25 / หน้า</SelectItem>
                  <SelectItem value="50">50 / หน้า</SelectItem>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardHeader>

        {isHistoryExpanded && (
          <CardContent className="p-0">
            {filteredHistoryTasks.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <History className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">ไม่พบรายการประวัติการอนุมัติ</p>
                <p className="text-xs text-muted-foreground">
                  {historySearch || historyStatusFilter !== "all" || historyDivisionFilter !== "all"
                    ? "ลองเปลี่ยนหรือล้างเงื่อนไขตัวกรองการค้นหา"
                    : "เมื่อผู้บังคับบัญชากดอนุมัติหรือไม่อนุมัติคำขอ รายการประวัติจะถูกบันทึกและแสดงที่นี่โดยอัตโนมัติ"}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-28 font-semibold">รหัสคำขอ</TableHead>
                        <TableHead className="font-semibold">ผู้ใช้น้ำ-ไฟ / กิจการ</TableHead>
                        <TableHead className="w-28 font-semibold">ระบบ</TableHead>
                        <TableHead className="w-36 font-semibold">เลขมิเตอร์</TableHead>
                        <TableHead className="text-right font-semibold">ยอดหนี้ค้างชำระ</TableHead>
                        <TableHead className="w-28 text-center font-semibold">วันที่ยื่นคำขอ</TableHead>
                        <TableHead className="text-center font-semibold">ผลการพิจารณา / สถานะ</TableHead>
                        <TableHead className="w-24 text-right pr-4 font-semibold">รายละเอียด</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyView.map((t) => {
                        const c = customerOf(t.customerId);
                        const st = approvalStatusConfig[t.status];
                        const meter =
                          t.division === "electric" ? c?.elecMeter || "—" : c?.waterMeter || "—";

                        return (
                          <TableRow key={t.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              {t.id}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground text-sm">
                                  {c?.name ?? "ไม่ทราบชื่อ"}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  {c?.shop || "—"}{c?.siteCode ? ` · รหัสสถานที่: ${c.siteCode}` : ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {t.division === "electric" ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1 text-xs font-semibold"
                                >
                                  <Zap className="h-3 w-3 fill-amber-500" /> ไฟฟ้า
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 gap-1 text-xs font-semibold"
                                >
                                  <Droplets className="h-3 w-3 fill-blue-500" /> น้ำประปา
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground font-medium">
                              {meter}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-bold text-destructive">
                              ฿{thb(t.amountDue)}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {t.createdAt}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={`text-xs gap-1 ${st.cls}`}>
                                <st.icon className="h-3 w-3" />
                                {st.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 rounded-full"
                                onClick={() => setActiveTask(t)}
                                title="ดูรายละเอียดและพิมพ์ใบสั่งการ"
                              >
                                <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* History Pagination */}
                {historyPageSize !== "all" && historyPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                    <p className="text-muted-foreground text-xs">
                      แสดง {currentHistoryPage * (historyPageSize as number) + 1}–
                      {Math.min(
                        filteredHistoryTasks.length,
                        (currentHistoryPage + 1) * (historyPageSize as number),
                      )}{" "}
                      จาก {filteredHistoryTasks.length} รายการ
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentHistoryPage === 0}
                        onClick={() => setHistoryPage(currentHistoryPage - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground font-medium">
                        หน้า {currentHistoryPage + 1} / {historyPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentHistoryPage >= historyPages - 1}
                        onClick={() => setHistoryPage(currentHistoryPage + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* ================= TASK DETAIL & PRINT MODAL ================= */}
      <Dialog open={Boolean(activeTask)} onOpenChange={(o) => !o && setActiveTask(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {activeTask ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-4">
                  <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    พิจารณาคำขอระงับบริการ (ใบสั่งการ ชย.ทอ.)
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={`text-xs gap-1 ${approvalStatusConfig[activeTask.status].cls}`}
                  >
                    {approvalStatusConfig[activeTask.status].label}
                  </Badge>
                </div>
                <DialogDescription>
                  รหัสคำขอ: <span className="font-mono font-semibold text-foreground">{activeTask.id}</span> ·
                  วันที่ยื่นคำขอ: {activeTask.createdAt}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm mt-2">
                {/* Entrepreneur Info */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3.5 border border-border">
                  <div>
                    <span className="text-xs text-muted-foreground">ผู้ใช้น้ำ-ไฟ / กิจการ</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5">
                      {activeCustomer?.name || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{activeCustomer?.shop}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">ระบบสาธารณูปโภค</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {activeTask.division === "electric" ? "⚡ ไฟฟ้า (กองไฟฟ้า)" : "💧 น้ำประปา (กองประปา)"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      มิเตอร์:{" "}
                      {activeTask.division === "electric"
                        ? activeCustomer?.elecMeter || "—"
                        : activeCustomer?.waterMeter || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">ยอดหนี้ค้างชำระทั้งหมด</span>
                    <p className="font-display text-lg font-bold text-destructive mt-0.5">
                      ฿{thb(activeTask.amountDue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      (ค้างชำระ {activeUnpaidBills.filter((b) => b.type === activeTask.division).length} งวด)
                    </p>
                  </div>
                </div>

                {/* Overdue bills breakdown */}
                <div>
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    รายการบิลค้างชำระในระบบ
                  </p>
                  <div className="rounded-md border border-border divide-y divide-border">
                    {activeUnpaidBills
                      .filter((b) => b.type === activeTask.division)
                      .map((b) => (
                        <div key={b.id} className="flex items-center justify-between p-2.5 text-xs">
                          <div>
                            <span className="font-medium text-foreground">
                              งวด {b.period} (บิล {b.no})
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              ครบกำหนด: {b.dueAt || "ตามรอบประจำเดือน"}
                            </span>
                          </div>
                          <span className="font-mono font-semibold text-destructive">
                            ฿{thb(b.total)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <Separator />

                {/* Official Royal Thai Air Force Command Preview */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-3 border-b border-primary/20 pb-3">
                    <img
                      src={RCMS_LOGO_URL}
                      alt="RTAF"
                      className="h-10 w-10 object-contain shrink-0"
                    />
                    <div>
                      <p className="font-bold text-sm text-foreground">
                        กรมช่างโยธาทหารอากาศ (ชย.ทอ.)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ใบสั่งการระงับการให้บริการสาธารณูปโภค (ตัดระบบ)
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    เรียน นายช่างผู้ควบคุมงาน / เจ้าหน้าที่กอง{activeTask.division === "electric" ? "ไฟฟ้า" : "ประปา"}:
                    <br />
                    ตามที่ผู้ประกอบการค้างชำระค่าสาธารณูปโภคเกินกำหนดเวลาที่ระเบียบกำหนด ขอให้ลงพื้นที่ดำเนินการระงับบริการ และรายงานผลการปฏิบัติงานให้ทราบต่อไป
                  </p>
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between pt-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.print();
                  }}
                >
                  <Printer className="mr-1.5 h-4 w-4" /> พิมพ์ใบสั่งการ
                </Button>

                <div className="flex gap-2">
                  {activeTask.status === "waiting_approval" && (
                    <>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        onClick={() => {
                          decideTask(activeTask.id, true);
                          setActiveTask(null);
                        }}
                        disabled={!canDecide}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> อนุมัติคำขอ
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          decideTask(activeTask.id, false);
                          setActiveTask(null);
                        }}
                        disabled={!canDecide}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" /> ไม่อนุมัติ
                      </Button>
                    </>
                  )}

                  {activeTask.status !== "cancelled" && activeTask.status !== "rejected" && (
                    <Button
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        cancelTask(activeTask.id);
                        setActiveTask(null);
                      }}
                      disabled={!canCancel}
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" /> ยกเลิกระงับบริการ
                    </Button>
                  )}

                  <Button variant="outline" onClick={() => setActiveTask(null)}>
                    ปิดหน้าต่าง
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
