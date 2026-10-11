import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  PlugZap,
  Search,
  Printer,
  ChevronLeft,
  ChevronRight,
  Zap,
  Droplets,
  Eye,
  FileCheck,
  Layers,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import type { ServiceTask, TaskStatus, Division } from "@/lib/rcms-types";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "แจ้งการมอบหมายใบงาน · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "แจ้งการมอบหมายใบงาน ตัด-ต่อระบบสาธารณูปโภค แยกระบบไฟฟ้าและน้ำประปา ขออนุมัติจากผู้บังคับบัญชา และบันทึกผลการปฏิบัติงานภาคสนาม",
      },
      { property: "og:title", content: "แจ้งการมอบหมายใบงาน · RCMS" },
      { property: "og:description", content: "Work Order & Task Assignment Management" },
    ],
  }),
  component: TasksPage,
});

const PAGE = 15;

const taskStatusConfig: Record<
  TaskStatus,
  { label: string; cls: string; icon: typeof Clock }
> = {
  waiting_approval: {
    label: "รออนุมัติ",
    cls: "bg-warning/20 text-warning border-warning/40",
    icon: Clock,
  },
  approved: {
    label: "อนุมัติแล้ว · รอลงพื้นที่",
    cls: "bg-info/15 text-info border-info/40",
    icon: CheckCircle2,
  },
  in_progress: {
    label: "กำลังดำเนินการ",
    cls: "bg-accent text-accent-foreground border-accent",
    icon: Clock,
  },
  done: {
    label: "ปิดงานแล้ว",
    cls: "bg-success/15 text-success border-success/40",
    icon: FileCheck,
  },
  rejected: {
    label: "ไม่อนุมัติ",
    cls: "bg-destructive/15 text-destructive border-destructive/40",
    icon: XCircle,
  },
  cancelled: {
    label: "ยกเลิกแล้ว",
    cls: "bg-muted text-muted-foreground border-border",
    icon: XCircle,
  },
};

function TasksPage() {
  const {
    tasks,
    decideTask,
    completeTask,
    cancelTask,
    customerOf,
    role,
  } = useRcms();

  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [activeTask, setActiveTask] = useState<ServiceTask | null>(null);

  const canDecide = role === "supervisor" || role === "admin";
  const canComplete = role === "utility_field_officer" || role === "admin";
  const canCancel = role === "supervisor" || role === "admin" || role === "revenue_officer";

  // Deduplicate tasks by ID and include ONLY approved/in_progress/done tasks
  // (Waiting approval is handled exclusively by Commander on /approvals)
  const activeValidTasks = useMemo(() => {
    const seen = new Set<string>();
    return tasks.filter((t) => {
      if (!t || !t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      // Exclude waiting_approval, cancelled, and rejected tasks
      if (t.status === "waiting_approval" || t.status === "cancelled" || t.status === "rejected") {
        return false;
      }
      return true;
    });
  }, [tasks]);

  // System-level counts for tabs
  const electricTasks = activeValidTasks.filter((t) => t.division === "electric");
  const waterTasks = activeValidTasks.filter((t) => t.division === "water");

  // Awaiting Commander approval count (for header shortcut badge)
  const waitingApprovalTasks = useMemo(() => {
    const seen = new Set<string>();
    return tasks.filter((t) => {
      if (!t || !t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return t.status === "waiting_approval";
    });
  }, [tasks]);
  const waitingApprovalCount = waitingApprovalTasks.length;

  // Tasks scoped by selected division for KPIs
  const divisionTasks = useMemo(() => {
    if (divisionFilter === "all") return activeValidTasks;
    return activeValidTasks.filter((t) => t.division === divisionFilter);
  }, [activeValidTasks, divisionFilter]);

  // Dynamic KPIs according to division
  const totalCount = divisionTasks.length;
  const approvedCount = divisionTasks.filter((t) => t.status === "approved").length;
  const inProgressCount = divisionTasks.filter((t) => t.status === "in_progress").length;
  const doneCount = divisionTasks.filter((t) => t.status === "done").length;

  // Fully filtered tasks for the table
  const filteredTasks = useMemo(() => {
    const term = q.trim().toLowerCase();
    return activeValidTasks.filter((t) => {
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
      const matchesType = typeFilter === "all" || t.type === typeFilter;

      return matchesSearch && matchesDivision && matchesStatus && matchesType;
    });
  }, [activeValidTasks, q, divisionFilter, statusFilter, typeFilter, customerOf]);

  const pages = Math.max(1, Math.ceil(filteredTasks.length / PAGE));
  const current = Math.min(page, pages - 1);
  const view = filteredTasks.slice(current * PAGE, current * PAGE + PAGE);

  const activeCustomer = activeTask ? customerOf(activeTask.customerId) : null;

  const divisionTitle =
    divisionFilter === "electric"
      ? "ระบบไฟฟ้า"
      : divisionFilter === "water"
        ? "ระบบน้ำประปา"
        : "ทุกระบบ";

  return (
    <>
      <PageHeader
        title="แจ้งการมอบหมายใบงาน"
        desc="ระบบแจ้งและติดตามการมอบหมายใบงาน ตัด-ต่อระบบสาธารณูปโภค · แยกระบบไฟฟ้าและน้ำประปา"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/approvals">
                <ShieldCheck className="mr-1.5 h-4 w-4 text-primary" />
                หน้าอนุมัติระงับบริการ (ผบช.)
                {waitingApprovalCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
                    {waitingApprovalCount} รออนุมัติ
                  </Badge>
                )}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/service">
                <Zap className="mr-1.5 h-4 w-4 text-amber-500" />
                การระงับบริการ
              </Link>
            </Button>
          </div>
        }
      />

      {/* Division Selector Tabs (แยกระบบ ไฟฟ้า / น้ำประปา) */}
      <div className="mb-6">
        <Tabs
          value={divisionFilter}
          onValueChange={(v) => {
            setDivisionFilter(v);
            setPage(0);
          }}
        >
          <TabsList className="h-auto inline-flex flex-wrap items-center gap-1.5 bg-card border border-border p-1 shadow-xs rounded-xl">
            <TabsTrigger
              value="all"
              className="gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Layers className="h-4 w-4" />
              <span>ใบงานทั้งหมด</span>
              <Badge
                variant="secondary"
                className="ml-1 text-xs px-1.5 py-0 bg-muted text-foreground"
              >
                {activeValidTasks.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="electric"
              className="gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-amber-600 data-[state=active]:text-white hover:text-amber-600"
            >
              <Zap className="h-4 w-4" />
              <span>⚡ กองไฟฟ้า (ระบบไฟฟ้า)</span>
              <Badge
                variant="secondary"
                className="ml-1 text-xs px-1.5 py-0 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                {electricTasks.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="water"
              className="gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:text-blue-600"
            >
              <Droplets className="h-4 w-4" />
              <span>💧 กองน้ำประปา (ระบบน้ำประปา)</span>
              <Badge
                variant="secondary"
                className="ml-1 text-xs px-1.5 py-0 bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
              >
                {waterTasks.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards (Scoped to selected division) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="flex items-center gap-4 p-5">
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${
                divisionFilter === "electric"
                  ? "bg-amber-500/15 text-amber-600"
                  : divisionFilter === "water"
                    ? "bg-blue-500/15 text-blue-600"
                    : "bg-primary/10 text-primary"
              }`}
            >
              {divisionFilter === "electric" ? (
                <Zap className="h-6 w-6" />
              ) : divisionFilter === "water" ? (
                <Droplets className="h-6 w-6" />
              ) : (
                <ClipboardList className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                ใบงาน ({divisionTitle})
              </p>
              <p className="font-display text-2xl font-bold">{totalCount}</p>
              <p className="text-[11px] text-muted-foreground">รายการที่มอบหมาย</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-info/30 bg-info/5">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-info/20 text-info">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-info">อนุมัติแล้ว · รอลงพื้นที่</p>
              <p className="font-display text-2xl font-bold text-info">{approvedCount}</p>
              <p className="text-[11px] text-muted-foreground">พร้อมดำเนินการภาคสนาม</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">กำลังดำเนินการ</p>
              <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">{inProgressCount}</p>
              <p className="text-[11px] text-muted-foreground">เจ้าหน้าที่กำลังปฏิบัติงาน</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-success/20 text-success">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-success">ปิดงานแล้ว</p>
              <p className="font-display text-2xl font-bold text-success">{doneCount}</p>
              <p className="text-[11px] text-muted-foreground">เสร็จสิ้นสมบูรณ์</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table Card */}
      <Card className="mt-6">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span>รายการใบงาน{divisionTitle !== "ทุกระบบ" ? ` · ${divisionTitle}` : ""}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {filteredTasks.length} รายการ
              </Badge>
            </CardTitle>

            {(statusFilter !== "all" || typeFilter !== "all" || q.trim() !== "") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setQ("");
                  setPage(0);
                }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> ล้างตัวกรอง
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="ค้นหารหัสใบงาน, รหัสผู้ประกอบการ, ชื่อ, เลขมิเตอร์"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="สถานะใบงาน" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด (ใบงานที่มอบหมาย)</SelectItem>
                <SelectItem value="approved">อนุมัติแล้ว · รอลงพื้นที่</SelectItem>
                <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
                <SelectItem value="done">ปิดงานแล้ว</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="ประเภทใบงาน" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภทใบงาน</SelectItem>
                <SelectItem value="disconnect">ระงับบริการ (ตัดระบบ)</SelectItem>
                <SelectItem value="reconnect">ต่อระบบ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">
                ไม่พบรายการใบงาน{divisionTitle !== "ทุกระบบ" ? `ใน${divisionTitle}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                ลองปรับเปลี่ยนเงื่อนไขการค้นหาหรือตัวกรองสถานะ
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">รหัสใบงาน</TableHead>
                      <TableHead className="w-28">วันที่แจ้ง</TableHead>
                      <TableHead className="w-20">รหัส</TableHead>
                      <TableHead>ผู้ประกอบการ / ร้านค้า</TableHead>
                      <TableHead>หน่วยงานรับมอบหมาย</TableHead>
                      {divisionFilter === "all" ? (
                        <TableHead>ระบบ</TableHead>
                      ) : (
                        <TableHead>
                          {divisionFilter === "electric" ? "เลขมิเตอร์ไฟฟ้า" : "เลขมาตรวัดน้ำ"}
                        </TableHead>
                      )}
                      <TableHead>ประเภทใบงาน</TableHead>
                      <TableHead className="text-right">ยอดเกี่ยวข้อง</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                      <TableHead className="text-right">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.map((t) => {
                      const c = customerOf(t.customerId);
                      const st = taskStatusConfig[t.status] ?? {
                        label: t.status,
                        cls: "bg-muted text-foreground",
                        icon: Clock,
                      };
                      return (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setActiveTask(t)}
                        >
                          <TableCell className="font-mono text-xs font-semibold">
                            {t.id}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.createdAt}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">
                            {c?.code ?? "—"}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{c?.name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">{c?.shop ?? "—"}</p>
                          </TableCell>

                          {/* Assigned Department Column */}
                          <TableCell>
                            {t.division === "electric" ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 font-medium text-[11px]"
                              >
                                <Zap className="mr-1 h-3 w-3 text-amber-500" /> กองไฟฟ้า ชย.ทอ.
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200 font-medium text-[11px]"
                              >
                                <Droplets className="mr-1 h-3 w-3 text-blue-500" /> กองน้ำประปา ชย.ทอ.
                              </Badge>
                            )}
                          </TableCell>

                          {/* Dynamic Division / Meter column */}
                          {divisionFilter === "all" ? (
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs font-medium">
                                {t.division === "electric" ? (
                                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                    ไฟฟ้า
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                    น้ำประปา
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          ) : (
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {divisionFilter === "electric"
                                ? c?.elecMeter || "—"
                                : c?.waterMeter || "—"}
                            </TableCell>
                          )}

                          <TableCell>
                            <div className="space-y-0.5">
                              {t.type === "disconnect" ? (
                                <Badge
                                  variant="outline"
                                  className="border-destructive/30 bg-destructive/10 text-destructive"
                                >
                                  <Ban className="mr-1 h-3 w-3" /> ระงับบริการ
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                >
                                  <PlugZap className="mr-1 h-3 w-3" /> ต่อระบบ
                                </Badge>
                              )}
                              {t.referenceNo ? (
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  ชำระแล้ว ({t.referenceNo})
                                </p>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell className="text-right font-mono text-sm font-semibold">
                            ฿{thb(t.amountDue)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={st.cls}>
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              {(t.status === "approved" || t.status === "in_progress") && (
                                <Button
                                  size="sm"
                                  className={t.type === "reconnect" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                                  onClick={() => completeTask(t.id)}
                                  disabled={!canComplete}
                                  title={!canComplete ? "ต้องใช้สิทธิ์เจ้าหน้าที่กองช่าง" : undefined}
                                >
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                  {t.type === "reconnect" ? "ลงพื้นที่แล้ว · ปิดงานต่อระบบ" : "ลงพื้นที่แล้ว · ปิดงาน"}
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setActiveTask(t)}
                                title="ดูรายละเอียดและพิมพ์ใบสั่งการ"
                              >
                                <Eye className="h-4 w-4" />
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
                <p className="text-muted-foreground">
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
                  <span className="text-xs text-muted-foreground">
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

      {/* Dialog รายละเอียด & พิมพ์ใบสั่งการ */}
      <Dialog open={!!activeTask} onOpenChange={(o) => !o && setActiveTask(null)}>
        <DialogContent className="max-w-2xl">
          {activeTask && activeCustomer ? (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                      <span>ใบสั่งการปฏิบัติงาน</span>
                      <span className="font-mono text-sm text-muted-foreground">
                        ({activeTask.id})
                      </span>
                    </DialogTitle>
                    <DialogDescription>
                      แจ้งการมอบหมายใบงาน ตัด-ต่อระบบสาธารณูปโภค ชย.ทอ.
                    </DialogDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={taskStatusConfig[activeTask.status]?.cls}
                  >
                    {taskStatusConfig[activeTask.status]?.label}
                  </Badge>
                </div>
              </DialogHeader>

              {/* Printable work order sheet content */}
              <div
                id="printable-task-order"
                className="space-y-4 rounded-xl border border-border bg-card p-5 text-sm"
              >
                {/* Header with Emblem */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={RCMS_LOGO_URL}
                      alt="ตราสัญลักษณ์ ชย.ทอ."
                      className="h-12 w-12 object-contain"
                    />
                    <div>
                      <p className="font-display font-bold leading-tight text-foreground">
                        กรมช่างโยธาทหารอากาศ
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ใบสั่งการมอบหมายปฏิบัติงานตัด-ต่อระบบสาธารณูปโภค
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-semibold">เลขที่: {activeTask.id}</p>
                    <p className="text-xs text-muted-foreground">วันที่: {activeTask.createdAt}</p>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">รหัสผู้ประกอบการ:</span>
                    <span className="ml-2 font-mono font-bold text-foreground">
                      {activeCustomer.code}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ชื่อ-สกุล:</span>
                    <span className="ml-2 font-medium text-foreground">
                      {activeCustomer.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">ร้านค้า / สถานที่:</span>
                    <span className="ml-2 font-medium text-foreground">
                      {activeCustomer.shop}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">เบอร์โทรศัพท์:</span>
                    <span className="ml-2 font-medium text-foreground">
                      {activeCustomer.phone || "—"}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Task Details with System/Division highlight */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">หน่วยงานผู้รับมอบหมาย:</span>
                      <span className="ml-2 font-bold text-primary">
                        {activeTask.assignedDepartment ||
                          (activeTask.division === "electric"
                            ? "กองไฟฟ้า กรมช่างโยธาทหารอากาศ"
                            : "กองน้ำประปา กรมช่างโยธาทหารอากาศ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ประเภทการปฏิบัติงาน:</span>
                      <span className="ml-2 font-semibold text-foreground">
                        {activeTask.type === "disconnect"
                          ? "ระงับการให้บริการ (ตัดระบบ)"
                          : "ต่อระบบการให้บริการ"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ระบบสาธารณูปโภค:</span>
                      <span className="ml-2 inline-flex items-center gap-1 font-semibold text-foreground">
                        {activeTask.division === "electric" ? (
                          <>
                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                            <span>ระบบไฟฟ้า</span>
                          </>
                        ) : (
                          <>
                            <Droplets className="h-3.5 w-3.5 text-blue-500" />
                            <span>ระบบน้ำประปา</span>
                          </>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {activeTask.division === "electric"
                          ? "เลขที่มิเตอร์ไฟฟ้า:"
                          : "เลขที่มาตรวัดน้ำประปา:"}
                      </span>
                      <span className="ml-2 font-mono font-medium text-foreground">
                        {activeTask.division === "electric"
                          ? activeCustomer.elecMeter || "—"
                          : activeCustomer.waterMeter || "—"}
                      </span>
                    </div>
                    {activeTask.type === "reconnect" && activeTask.referenceNo ? (
                      <div>
                        <span className="text-muted-foreground">เลขอ้างอิงชำระเงิน/สลิป:</span>
                        <span className="ml-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {activeTask.referenceNo}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-muted-foreground">ยอดหนี้ค้างชำระที่เกี่ยวข้อง:</span>
                        <span className="ml-2 font-mono font-bold text-destructive">
                          ฿{thb(activeTask.amountDue)}
                        </span>
                      </div>
                    )}
                  </div>

                  {activeTask.note ? (
                    <div className="pt-2 border-t border-border/50 text-xs">
                      <span className="text-muted-foreground">บันทึกคำสั่งการ:</span>
                      <p className="mt-0.5 text-foreground bg-background/60 rounded p-1.5 font-medium">
                        {activeTask.note}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Signature Blocks */}
                <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs">
                  <div className="space-y-12">
                    <p className="text-muted-foreground">ผู้อนุมัติ / ผู้บังคับบัญชา</p>
                    <div>
                      <p className="border-b border-dashed border-foreground/40 pb-1">
                        (......................................................)
                      </p>
                      <p className="mt-1 text-muted-foreground">ตำแหน่ง .................................</p>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <p className="text-muted-foreground">เจ้าหน้าที่ผู้ปฏิบัติงานภาคสนาม</p>
                    <div>
                      <p className="border-b border-dashed border-foreground/40 pb-1">
                        (......................................................)
                      </p>
                      <p className="mt-1 text-muted-foreground">วันที่ดำเนินการ ....../....../......</p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.print();
                    }}
                  >
                    <Printer className="mr-1.5 h-4 w-4" /> พิมพ์ใบสั่งการ
                  </Button>
                </div>

                <div className="flex gap-2">
                  {(activeTask.status === "approved" || activeTask.status === "in_progress") && (
                    <Button
                      onClick={() => {
                        completeTask(activeTask.id);
                        setActiveTask(null);
                      }}
                      disabled={!canComplete}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" /> ลงพื้นที่แล้ว · ปิดงาน
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

      {/* Direct Body Portal สำหรับพิมพ์ใบสั่งการปฏิบัติงาน */}
      {typeof document !== "undefined" && activeTask && activeCustomer
        ? createPortal(
            <div
              id="print-root"
              className="p-6 text-black"
              style={{
                fontFamily: "'TH SarabunPSK', 'THSarabunPSK', 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif",
              }}
            >
              <div
                className="task-sheet mx-auto w-full max-w-[740px] rounded-md border border-black bg-white p-6 text-black"
                style={{
                  fontFamily: "'TH SarabunPSK', 'THSarabunPSK', 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif",
                }}
              >
                {/* 1. ส่วนหัวเอกสารราชการ */}
                <div className="flex items-start justify-between border-b-2 border-black pb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={RCMS_LOGO_URL}
                      alt="ตราสัญลักษณ์ ชย.ทอ."
                      className="h-14 w-14 object-contain"
                    />
                    <div>
                      <p className="text-[17pt] font-bold leading-tight text-black">
                        กรมช่างโยธาทหารอากาศ
                      </p>
                      <p className="text-[13.5pt] leading-tight text-slate-800">
                        ใบสั่งการมอบหมายปฏิบัติงานตัด-ต่อระบบสาธารณูปโภค
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-[13pt] leading-snug text-slate-800">
                    <p>
                      <span className="font-semibold">เลขที่ใบสั่งการ:</span>{" "}
                      <span className="font-bold text-black">{activeTask.id}</span>
                    </p>
                    <p className="mt-0.5">
                      <span>วันที่สั่งการ:</span>{" "}
                      <span className="font-medium text-black">{activeTask.createdAt}</span>
                    </p>
                  </div>
                </div>

                {/* 2. ข้อมูลผู้ประกอบการ */}
                <div className="mt-3 rounded border border-slate-300 bg-slate-50/50 p-3 text-[13.5pt] leading-snug">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div>
                      <span className="text-slate-700">รหัสผู้ประกอบการ:</span>
                      <span className="ml-2 font-bold text-black">{activeCustomer.code}</span>
                    </div>
                    <div>
                      <span className="text-slate-700">ชื่อ-สกุล:</span>
                      <span className="ml-2 font-bold text-black">{activeCustomer.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-700">ร้านค้า / สถานที่:</span>
                      <span className="ml-2 font-bold text-black">{activeCustomer.shop}</span>
                    </div>
                    <div>
                      <span className="text-slate-700">เบอร์โทรศัพท์:</span>
                      <span className="ml-2 font-medium text-black">{activeCustomer.phone || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 3. รายละเอียดการปฏิบัติงาน */}
                <div className="mt-3 rounded border border-slate-300 p-3 text-[13.5pt] leading-snug">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="text-slate-700">หน่วยงานผู้รับมอบหมาย:</span>
                      <span className="ml-2 font-bold text-black">
                        {activeTask.assignedDepartment ||
                          (activeTask.division === "electric"
                            ? "กองไฟฟ้า กรมช่างโยธาทหารอากาศ"
                            : "กองน้ำประปา กรมช่างโยธาทหารอากาศ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-700">ประเภทการปฏิบัติงาน:</span>
                      <span className="ml-2 font-bold text-black">
                        {activeTask.type === "disconnect"
                          ? "ระงับการให้บริการ (ตัดระบบ)"
                          : "ต่อระบบการให้บริการ"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-700">ระบบสาธารณูปโภค:</span>
                      <span className="ml-2 font-bold text-black">
                        {activeTask.division === "electric" ? "ระบบไฟฟ้า" : "ระบบน้ำประปา"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-700">
                        {activeTask.division === "electric"
                          ? "เลขที่มิเตอร์ไฟฟ้า:"
                          : "เลขที่มาตรวัดน้ำประปา:"}
                      </span>
                      <span className="ml-2 font-bold text-black">
                        {activeTask.division === "electric"
                          ? activeCustomer.elecMeter || "—"
                          : activeCustomer.waterMeter || "—"}
                      </span>
                    </div>
                    {activeTask.type === "reconnect" && activeTask.referenceNo ? (
                      <div className="col-span-2 text-emerald-800 font-bold">
                        <span>สถานะการชำระเงิน:</span>
                        <span className="ml-2">
                          รับชำระยอดค้างชำระและค่าประสานมิเตอร์แล้ว (เลขอ้างอิง: {activeTask.referenceNo})
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-700">ยอดหนี้ค้างชำระที่เกี่ยวข้อง:</span>
                        <span className="ml-2 font-bold text-red-600">
                          ฿{thb(activeTask.amountDue)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. ช่องลงนามตามระเบียบงานสารบรรณ */}
                <div className="mt-10 grid grid-cols-2 gap-8 text-center text-[13pt]">
                  <div className="space-y-10">
                    <p className="font-semibold text-black">ผู้อนุมัติ / ผู้บังคับบัญชา</p>
                    <div>
                      <p className="border-b border-dotted border-black pb-1">
                        (......................................................)
                      </p>
                      <p className="mt-1 text-slate-700">ตำแหน่ง .................................</p>
                      <p className="mt-0.5 text-[12pt] text-slate-600">วันที่ ....../....../......</p>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <p className="font-semibold text-black">เจ้าหน้าที่ผู้ปฏิบัติงานภาคสนาม</p>
                    <div>
                      <p className="border-b border-dotted border-black pb-1">
                        (......................................................)
                      </p>
                      <p className="mt-1 text-slate-700">ผลการปฏิบัติงาน: [  ] เรียบร้อย [  ] มีปัญหา</p>
                      <p className="mt-0.5 text-[12pt] text-slate-600">วันที่ดำเนินการ ....../....../......</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
