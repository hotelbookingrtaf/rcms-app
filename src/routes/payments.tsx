import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  Banknote,
  ScanLine,
  Check,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  MessageSquareShare,
  AlertTriangle,
  RotateCcw,
  Zap,
  Droplets,
  Layers,
  Tag,
  Receipt,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List as ListIcon,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRcms, thb, periodLabel, periodFullThai } from "@/lib/rcms-store";
import { canPerform } from "@/lib/permissions";
import { SlipView } from "@/components/rcms/SlipView";
import {
  getCustomerMeterCategory,
  type MeterCategoryFilter,
} from "@/lib/customer-matching";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "ตรวจสอบการชำระเงิน · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "ตรวจสอบการชำระเงิน ดึงสลิปจาก Line OA อ่านข้อมูลด้วย OCR ตรวจยอดเงินกับใบแจ้งหนี้ และยืนยันการชำระ",
      },
      { property: "og:title", content: "ตรวจสอบการชำระเงิน · RCMS" },
      {
        property: "og:description",
        content: "Payment Verification: OCR สลิปโอนเงินและยืนยันการชำระ",
      },
    ],
  }),
  component: Payments,
});

function Payments() {
  const { bills, payments, customers, settle, verifyPayment, customerOf, fetchLineSlips, role, period } = useRcms();
  const canRecord = canPerform(role, "payment.record");
  const canVerify = canPerform(role, "payment.verify");

  // Filter States
  const [q, setQ] = useState("");
  const [meterCatFilter, setMeterCatFilter] = useState<MeterCategoryFilter>("all");
  const [meterSeriesFilter, setMeterSeriesFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<"all" | "electric" | "water">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sectionView, setSectionView] = useState<"both" | "bills" | "slips">("both");
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [page, setPage] = useState(0);

  // Dialog States
  const [payId, setPayId] = useState<string | null>(null);
  const [method, setMethod] = useState<"online" | "counter">("online");
  const [ref, setRef] = useState("");
  const [slipName, setSlipName] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // สรุปข้อมูลหมวดหมู่มิเตอร์และ Series
  const meterStats = useMemo(() => {
    let electricCount = 0;
    let waterCount = 0;
    let bothCount = 0;
    let noneCount = 0;

    const elecSeriesMap: Record<string, number> = {};
    const waterSeriesMap: Record<string, number> = {};

    customers.forEach((c) => {
      const cat = getCustomerMeterCategory(c);
      if (cat.type === "both") bothCount++;
      else if (cat.type === "electric") electricCount++;
      else if (cat.type === "water") waterCount++;
      else noneCount++;

      if (cat.elecPrefix) {
        elecSeriesMap[cat.elecPrefix] = (elecSeriesMap[cat.elecPrefix] || 0) + 1;
      }
      if (cat.waterPrefix) {
        waterSeriesMap[cat.waterPrefix] = (waterSeriesMap[cat.waterPrefix] || 0) + 1;
      }
    });

    return {
      electricCount,
      waterCount,
      bothCount,
      noneCount,
      elecSeriesList: Object.entries(elecSeriesMap).map(([series, count]) => ({ series, count })),
      waterSeriesList: Object.entries(waterSeriesMap).map(([series, count]) => ({ series, count })),
    };
  }, [customers]);

  // All open unpaid/overdue bills
  const allOpenBills = useMemo(() => {
    return bills.filter((b) => b.status === "unpaid" || b.status === "overdue");
  }, [bills]);

  // All waiting slips (pending / problem)
  const allWaitingSlips = useMemo(() => {
    return payments.filter((p) => p.status === "pending" || p.status === "problem");
  }, [payments]);

  // 1. Filtered Unpaid/Overdue Bills
  const filteredOpenBills = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allOpenBills.filter((b) => {
      const cust = customerOf(b.customerId);
      const cat = getCustomerMeterCategory(cust);

      // 1. Meter category filter
      if (meterCatFilter === "electric" && cat.type !== "electric" && cat.type !== "both") return false;
      if (meterCatFilter === "water" && cat.type !== "water" && cat.type !== "both") return false;
      if (meterCatFilter === "both" && cat.type !== "both") return false;
      if (meterCatFilter === "none" && cat.type !== "none") return false;

      // 2. Meter series filter
      if (meterSeriesFilter !== "all") {
        const matchesElec = cat.elecPrefix === meterSeriesFilter;
        const matchesWater = cat.waterPrefix === meterSeriesFilter;
        if (!matchesElec && !matchesWater) return false;
      }

      // 3. Service type filter
      if (serviceTypeFilter === "electric" && b.type !== "electric") return false;
      if (serviceTypeFilter === "water" && b.type !== "water") return false;

      // 4. Status filter
      if (statusFilter === "unpaid" && b.status !== "unpaid") return false;
      if (statusFilter === "overdue" && b.status !== "overdue") return false;
      if (statusFilter === "pending" || statusFilter === "problem") return false; // these are slip statuses

      // 5. Search term query
      if (term) {
        const billNo = (b.no || "").toLowerCase();
        const cName = (cust?.name || "").toLowerCase();
        const cShop = (cust?.shop || "").toLowerCase();
        const cCode = (cust?.code || "").toLowerCase();
        const cPhone = (cust?.phone || "").toLowerCase();
        const elecM = (cust?.elecMeter || "").toLowerCase();
        const waterM = (cust?.waterMeter || "").toLowerCase();
        if (
          !billNo.includes(term) &&
          !cName.includes(term) &&
          !cShop.includes(term) &&
          !cCode.includes(term) &&
          !cPhone.includes(term) &&
          !elecM.includes(term) &&
          !waterM.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allOpenBills, q, meterCatFilter, meterSeriesFilter, serviceTypeFilter, statusFilter, customerOf]);

  // 2. Filtered Waiting Slips
  const filteredWaitingSlips = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allWaitingSlips.filter((p) => {
      const cust = customerOf(p.customerId);
      const cat = getCustomerMeterCategory(cust);
      const linkedBill = bills.find((b) => b.id === p.billId);

      // 1. Meter category filter
      if (meterCatFilter === "electric" && cat.type !== "electric" && cat.type !== "both") return false;
      if (meterCatFilter === "water" && cat.type !== "water" && cat.type !== "both") return false;
      if (meterCatFilter === "both" && cat.type !== "both") return false;
      if (meterCatFilter === "none" && cat.type !== "none") return false;

      // 2. Meter series filter
      if (meterSeriesFilter !== "all") {
        const matchesElec = cat.elecPrefix === meterSeriesFilter;
        const matchesWater = cat.waterPrefix === meterSeriesFilter;
        if (!matchesElec && !matchesWater) return false;
      }

      // 3. Service type filter
      if (serviceTypeFilter === "electric" && linkedBill && linkedBill.type !== "electric") return false;
      if (serviceTypeFilter === "water" && linkedBill && linkedBill.type !== "water") return false;

      // 4. Status filter
      if (statusFilter === "unpaid" || statusFilter === "overdue") return false;
      if (statusFilter === "pending" && p.status !== "pending") return false;
      if (statusFilter === "problem" && p.status !== "problem") return false;

      // 5. Search term query
      if (term) {
        const billNo = (p.billNo || "").toLowerCase();
        const refNo = (p.ref || "").toLowerCase();
        const payer = (p.slip?.payerName || "").toLowerCase();
        const cName = (cust?.name || "").toLowerCase();
        const cShop = (cust?.shop || "").toLowerCase();
        const cCode = (cust?.code || "").toLowerCase();
        const cPhone = (cust?.phone || "").toLowerCase();
        const elecM = (cust?.elecMeter || "").toLowerCase();
        const waterM = (cust?.waterMeter || "").toLowerCase();
        if (
          !billNo.includes(term) &&
          !refNo.includes(term) &&
          !payer.includes(term) &&
          !cName.includes(term) &&
          !cShop.includes(term) &&
          !cCode.includes(term) &&
          !cPhone.includes(term) &&
          !elecM.includes(term) &&
          !waterM.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allWaitingSlips, bills, q, meterCatFilter, meterSeriesFilter, serviceTypeFilter, statusFilter, customerOf]);

  // Summary Metrics calculations
  const totalOpenAmount = useMemo(
    () => allOpenBills.reduce((acc, b) => acc + (b.total || 0), 0),
    [allOpenBills],
  );
  const overdueBills = useMemo(
    () => allOpenBills.filter((b) => b.status === "overdue"),
    [allOpenBills],
  );
  const pendingSlips = useMemo(
    () => payments.filter((p) => p.status === "pending"),
    [payments],
  );
  const problemSlips = useMemo(
    () => payments.filter((p) => p.status === "problem"),
    [payments],
  );
  const totalPendingAmount = useMemo(
    () => pendingSlips.reduce((acc, p) => acc + (p.slip?.amount || p.amount || 0), 0),
    [pendingSlips],
  );
  const totalProblemAmount = useMemo(
    () => problemSlips.reduce((acc, p) => acc + (p.slip?.amount || p.amount || 0), 0),
    [problemSlips],
  );

  // Filtered totals for bills table footer
  const filteredBillsTotal = useMemo(
    () => filteredOpenBills.reduce((acc, b) => acc + (b.total || 0), 0),
    [filteredOpenBills],
  );

  // Pagination for bills table
  const effectivePageSize = pageSize === "all" ? Math.max(1, filteredOpenBills.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredOpenBills.length / effectivePageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedBills =
    pageSize === "all"
      ? filteredOpenBills
      : filteredOpenBills.slice(currentPage * effectivePageSize, (currentPage + 1) * effectivePageSize);

  const isFiltered =
    q !== "" ||
    meterCatFilter !== "all" ||
    meterSeriesFilter !== "all" ||
    serviceTypeFilter !== "all" ||
    statusFilter !== "all";

  const resetFilters = () => {
    setQ("");
    setMeterCatFilter("all");
    setMeterSeriesFilter("all");
    setServiceTypeFilter("all");
    setStatusFilter("all");
    setPage(0);
  };

  const bill = bills.find((b) => b.id === payId);
  const viewing = payments.find((p) => p.id === viewId);

  return (
    <>
      <PageHeader
        title="ตรวจสอบการชำระเงิน"
        desc="ระบบดึงสลิปจาก Line OA อัตโนมัติ อ่าน วันเวลา · รหัสอ้างอิง · ชื่อบัญชีผู้โอน · ยอดเงิน ด้วย OCR แล้วเทียบกับยอดตามใบแจ้งหนี้"
        actions={
          <Button disabled={!canRecord} onClick={() => fetchLineSlips()}>
            <MessageSquareShare className="mr-1 h-4 w-4" /> ดึงสลิปจาก Line + OCR
          </Button>
        }
      />

      {/* 4 Summary Cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: บิลรอรับชำระ */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-amber-500" />
                <span>บิลรอรับชำระทั้งหมด</span>
              </p>
              <p className="mt-1 font-display text-xl font-bold font-mono text-foreground">
                ฿{thb(totalOpenAmount)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ทั้งหมด <strong className="font-mono text-foreground">{allOpenBills.length}</strong> ใบ
                {overdueBills.length > 0 && (
                  <span className="text-destructive font-medium ml-1">
                    (ค้างชำระ {overdueBills.length})
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-full bg-amber-500/15 p-2.5 text-amber-600 dark:text-amber-400">
              <Banknote className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: สลิปรอตรวจสอบ OCR */}
        <Card className="border-blue-500/30 bg-blue-500/5 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1.5">
                <ScanLine className="h-3.5 w-3.5 text-blue-500" />
                <span>สลิปรอตรวจสอบ OCR</span>
              </p>
              <p className="mt-1 font-display text-xl font-bold font-mono text-blue-700 dark:text-blue-400">
                ฿{thb(totalPendingAmount)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ส่งจาก Line OA / เคาน์เตอร์ <strong className="font-mono text-foreground">{pendingSlips.length}</strong> รายการ
              </p>
            </div>
            <div className="rounded-full bg-blue-500/15 p-2.5 text-blue-600 dark:text-blue-400">
              <ScanLine className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: สลิปมีปัญหา / ต้องตรวจสอบ */}
        <Card className={cn(
          "border-border shadow-xs",
          problemSlips.length > 0 ? "border-destructive/40 bg-destructive/5" : "bg-card"
        )}>
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className={cn(
                "text-xs font-medium flex items-center gap-1.5",
                problemSlips.length > 0 ? "text-destructive" : "text-muted-foreground"
              )}>
                <AlertTriangle className={cn("h-3.5 w-3.5", problemSlips.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                <span>สลิปมีปัญหา / รอแก้ไข</span>
              </p>
              <p className={cn(
                "mt-1 font-display text-xl font-bold font-mono",
                problemSlips.length > 0 ? "text-destructive" : "text-foreground"
              )}>
                ฿{thb(totalProblemAmount)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ยอดเงินไม่ตรง/ตรวจไม่ผ่าน <strong className={cn("font-mono", problemSlips.length > 0 ? "text-destructive" : "text-foreground")}>{problemSlips.length}</strong> รายการ
              </p>
            </div>
            <div className={cn(
              "rounded-full p-2.5",
              problemSlips.length > 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: สถานะรวม */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>คิวรอตรวจสอบทั้งหมด</span>
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                  {allWaitingSlips.length}
                </span>
                <span className="text-xs text-muted-foreground">สลิปรอตรวจ</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">
                  {allOpenBills.length}
                </span>
                <span className="text-xs text-muted-foreground">บิลรอชำระ</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                งวดปัจจุบัน: <strong className="font-medium text-foreground">{periodLabel(period)}</strong>
              </p>
            </div>
            <div className="rounded-full bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* แผงตัวกรองและหมวดหมู่มิเตอร์ (Filter Toolbar) */}
      <Card className="mb-4 border-border/70 shadow-sm rounded-2xl bg-card">
        <CardContent className="space-y-3.5 p-4 sm:p-5">
          {/* แถวที่ 1: Quick-Filter Tabs ตามหมวดหมู่มิเตอร์ + ปุ่มสลับมุมมอง */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground mr-0.5 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" /> หมวดหมู่มิเตอร์:
              </span>
              <Button
                variant={meterCatFilter === "all" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs px-3 font-semibold rounded-full transition-all",
                  meterCatFilter === "all"
                    ? "bg-[#6b1d24] text-white hover:bg-[#5a141b] dark:bg-[#7f1d1d] dark:text-white shadow-sm border-transparent"
                    : "bg-background text-foreground border-border hover:bg-muted/60",
                )}
                onClick={() => {
                  setMeterCatFilter("all");
                  setPage(0);
                }}
              >
                ทั้งหมด ({meterStats.electricCount + meterStats.waterCount + meterStats.bothCount + meterStats.noneCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 text-xs px-3 gap-1.5 font-medium rounded-full transition-all",
                  meterCatFilter === "electric"
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm hover:bg-amber-700 dark:bg-amber-500 dark:border-amber-500"
                    : "bg-amber-50/80 text-amber-800 border-amber-300/80 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700/60",
                )}
                onClick={() => {
                  setMeterCatFilter("electric");
                  setPage(0);
                }}
              >
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> หมวดไฟฟ้า ({meterStats.electricCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 text-xs px-3 gap-1.5 font-medium rounded-full transition-all",
                  meterCatFilter === "water"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500"
                    : "bg-sky-50/80 text-sky-800 border-sky-300/80 hover:bg-sky-100/80 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-700/60",
                )}
                onClick={() => {
                  setMeterCatFilter("water");
                  setPage(0);
                }}
              >
                <Droplets className="h-3.5 w-3.5 text-blue-500 fill-blue-500/20" /> หมวดน้ำประปา ({meterStats.waterCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 text-xs px-3 gap-1.5 font-medium rounded-full transition-all",
                  meterCatFilter === "both"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm hover:bg-purple-700 dark:bg-purple-500 dark:border-purple-500"
                    : "bg-purple-50/80 text-purple-800 border-purple-300/80 hover:bg-purple-100/80 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-700/60",
                )}
                onClick={() => {
                  setMeterCatFilter("both");
                  setPage(0);
                }}
              >
                <Layers className="h-3.5 w-3.5 text-purple-500" /> 2 ระบบ ({meterStats.bothCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 text-xs px-3 gap-1.5 font-medium rounded-full transition-all",
                  meterCatFilter === "none"
                    ? "bg-slate-700 text-white border-slate-700 shadow-sm dark:bg-slate-600 dark:border-slate-600"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700/60",
                )}
                onClick={() => {
                  setMeterCatFilter("none");
                  setPage(0);
                }}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-500" /> ไม่มีมิเตอร์ ({meterStats.noneCount})
              </Button>
            </div>

            {/* Toggle View Mode: Both / Bills Only / Slips Only */}
            <div className="flex items-center gap-1 bg-stone-100/90 dark:bg-muted/50 p-1 rounded-xl border border-stone-200/80 dark:border-border/60">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  sectionView === "both"
                    ? "bg-stone-200/90 dark:bg-muted text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSectionView("both")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> ⊞ ทั้ง 2 ส่วน
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  sectionView === "bills"
                    ? "bg-stone-200/90 dark:bg-muted text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSectionView("bills")}
              >
                <Receipt className="h-3.5 w-3.5" /> บิลรอชำระ ({filteredOpenBills.length})
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  sectionView === "slips"
                    ? "bg-stone-200/90 dark:bg-muted text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setSectionView("slips")}
              >
                <ScanLine className="h-3.5 w-3.5" /> สลิปรอตรวจ ({filteredWaitingSlips.length})
              </button>
            </div>
          </div>

          {/* แถวที่ 2: ช่องค้นหา + Dropdown หมวดรหัสมิเตอร์ + Dropdown ประเภทบริการ + Dropdown สถานะ */}
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-12">
            {/* 1. ช่องค้นหา */}
            <div className="relative md:col-span-5 lg:col-span-5">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อผู้ประกอบการ, ร้านค้า, รหัส, เบอร์โทร, เลขมิเตอร์, เลขที่บิล, อ้างอิงสลิป..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                className="pl-9 pr-8 text-xs rounded-xl h-10 border-border/80 bg-background focus-visible:ring-primary/20"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* 2. Dropdown หมวดรหัสมิเตอร์ (Series / Prefix) */}
            <div className="md:col-span-3 lg:col-span-3">
              <Select
                value={meterSeriesFilter}
                onValueChange={(v) => {
                  setMeterSeriesFilter(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="text-xs rounded-xl h-10 border-border/80 bg-background">
                  <SelectValue placeholder="ทุกหมวดรหัสมิเตอร์" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">ทุกหมวดรหัสมิเตอร์</SelectItem>
                  {meterStats.elecSeriesList.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-sm my-1">
                        ⚡ หมวดมิเตอร์ไฟฟ้า
                      </div>
                      {meterStats.elecSeriesList.map((s) => (
                        <SelectItem key={`elec-${s.series}`} value={s.series}>
                          หมวด {s.series} ({s.count} เครื่อง)
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {meterStats.waterSeriesList.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 rounded-sm my-1">
                        💧 หมวดมาตรวัดน้ำประปา
                      </div>
                      {meterStats.waterSeriesList.map((s) => (
                        <SelectItem key={`water-${s.series}`} value={s.series}>
                          หมวด {s.series} ({s.count} เครื่อง)
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Dropdown ประเภทบริการ (Service Type) */}
            <div className="md:col-span-2 lg:col-span-2">
              <Select
                value={serviceTypeFilter}
                onValueChange={(v: "all" | "electric" | "water") => {
                  setServiceTypeFilter(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="text-xs rounded-xl h-10 border-border/80 bg-background">
                  <SelectValue placeholder="ทุกประเภทบริการ" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">ทุกประเภทบริการ</SelectItem>
                  <SelectItem value="electric">⚡ บิลค่าไฟฟ้า</SelectItem>
                  <SelectItem value="water">💧 บิลค่าน้ำประปา</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Dropdown สถานะ */}
            <div className="md:col-span-2 lg:col-span-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="text-xs rounded-xl h-10 border-border/80 bg-background">
                  <SelectValue placeholder="สถานะทั้งหมด" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                  <SelectItem value="unpaid">รอชำระ (Unpaid)</SelectItem>
                  <SelectItem value="overdue">ค้างชำระ (Overdue)</SelectItem>
                  <SelectItem value="pending">รอตรวจสลิป (Pending)</SelectItem>
                  <SelectItem value="problem">สลิปมีปัญหา (Problem)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* แถวที่ 3: สรุปผลการค้นหา และ ตัวเลือกจำนวนแถว */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>ผลการค้นหา:</span>
              <span className="font-mono font-bold text-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/60 text-xs">
                บิลรอชำระ {filteredOpenBills.length} ใบ
              </span>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 text-xs">
                สลิปรอตรวจ {filteredWaitingSlips.length} รายการ
              </span>
              {isFiltered && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 ml-1"
                  onClick={resetFilters}
                >
                  <RotateCcw className="h-3 w-3" /> ล้างตัวกรอง
                </Button>
              )}
            </div>

            {/* Page Size Selector สำหรับบิลรอชำระ */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>แสดง:</span>
              <select
                className="h-7 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === "all" ? "all" : Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value={10}>10 รายการ/หน้า</option>
                <option value={20}>20 รายการ/หน้า</option>
                <option value={50}>50 รายการ/หน้า</option>
                <option value={100}>100 รายการ/หน้า</option>
                <option value="all">แสดงทั้งหมด ({filteredOpenBills.length})</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid / Layout */}
      <div className={cn(
        "grid gap-5",
        sectionView === "both" ? "xl:grid-cols-12" : "grid-cols-1"
      )}>
        {/* ส่วนที่ 1: บิลรอชำระ (Unpaid / Overdue Bills) */}
        {(sectionView === "both" || sectionView === "bills") && (
          <Card className={cn(
            "border-border/70 shadow-sm overflow-hidden",
            sectionView === "both" ? "xl:col-span-7" : "col-span-1"
          )}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 p-4 sm:p-5 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-amber-500" />
                  <span>บิลรอรับชำระ</span>
                  <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
                    {filteredOpenBills.length} ใบ
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ยอดรวมตามตัวกรอง: <strong className="font-mono font-bold text-foreground">฿{thb(filteredBillsTotal)}</strong>
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredOpenBills.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Receipt className="mx-auto mb-2 h-8 w-8 opacity-40 text-muted-foreground" />
                  <p>ไม่มีบิลรอชำระตามตัวกรองที่เลือก</p>
                  {isFiltered && (
                    <Button variant="link" size="sm" onClick={resetFilters} className="mt-1 text-xs">
                      ล้างตัวกรองทั้งหมด
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40 border-b border-border">
                        <TableRow className="text-xs hover:bg-transparent">
                          <TableHead className="w-12 text-center py-2.5">ลำดับ</TableHead>
                          <TableHead className="w-24 text-center py-2.5">เลขที่บิล</TableHead>
                          <TableHead className="min-w-[150px] py-2.5">ผู้ประกอบการ / ร้านค้า</TableHead>
                          <TableHead className="w-32 text-center py-2.5">หมายเลขมิเตอร์</TableHead>
                          <TableHead className="w-20 text-center py-2.5">งวด</TableHead>
                          <TableHead className="w-20 text-center py-2.5">ประเภท</TableHead>
                          <TableHead className="w-24 text-right py-2.5">ยอดชำระ</TableHead>
                          <TableHead className="w-24 text-center py-2.5">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedBills.map((b, idx) => {
                          const cust = customerOf(b.customerId);
                          const rowNum = currentPage * effectivePageSize + idx + 1;
                          const meterVal = b.type === "water" ? cust?.waterMeter : cust?.elecMeter;

                          return (
                            <TableRow key={b.id} className="hover:bg-muted/30 text-xs">
                              <TableCell className="text-center font-mono text-muted-foreground py-2.5">
                                {rowNum}
                              </TableCell>
                              <TableCell className="font-mono text-center font-semibold text-foreground py-2.5">
                                {b.no}
                              </TableCell>
                              <TableCell className="py-2.5">
                                <p className="font-medium text-foreground">{cust?.name || "—"}</p>
                                <p className="text-[11px] text-muted-foreground">{cust?.shop || "—"}</p>
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs py-2.5">
                                {meterVal ? (
                                  <span className="inline-flex items-center gap-1">
                                    {b.type === "water" ? (
                                      <Droplets className="h-3 w-3 text-blue-500" />
                                    ) : (
                                      <Zap className="h-3 w-3 text-amber-500" />
                                    )}
                                    {meterVal}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground font-mono text-[11px] py-2.5">
                                {periodLabel(b.period)}
                              </TableCell>
                              <TableCell className="text-center py-2.5">
                                {b.type === "water" ? (
                                  <Badge variant="outline" className="border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] px-1.5 py-0">
                                    💧 น้ำ
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] px-1.5 py-0">
                                    ⚡ ไฟ
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-foreground py-2.5">
                                ฿{thb(b.total)}
                              </TableCell>
                              <TableCell className="text-center py-2.5">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-2.5 font-medium shadow-xs"
                                  disabled={!canRecord}
                                  onClick={() => {
                                    setPayId(b.id);
                                    setMethod("online");
                                    setSlipName("");
                                    setRef(`TMB${Math.floor(Math.random() * 900000 + 100000)}`);
                                  }}
                                >
                                  <Banknote className="mr-1 h-3.5 w-3.5" /> รับชำระ
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter className="bg-muted/50 font-semibold border-t">
                        <TableRow className="text-xs hover:bg-transparent">
                          <TableCell colSpan={6} className="py-2.5 text-left font-sans">
                            รวมยอดบิลรอชำระ ({filteredOpenBills.length} ใบ)
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-mono font-bold text-foreground">
                            ฿{thb(filteredBillsTotal)}
                          </TableCell>
                          <TableCell className="text-center">—</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="flex flex-wrap items-center justify-between border-t border-border px-4 py-3 text-xs gap-2">
                    <p className="text-muted-foreground">
                      แสดง {currentPage * effectivePageSize + 1}–
                      {Math.min(filteredOpenBills.length, (currentPage + 1) * effectivePageSize)} จาก{" "}
                      {filteredOpenBills.length} รายการ
                    </p>
                    {pageSize !== "all" && totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={currentPage === 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> ก่อนหน้า
                        </Button>
                        <span className="px-2 font-mono text-xs font-medium">
                          หน้า {currentPage + 1} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={currentPage >= totalPages - 1}
                          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        >
                          ถัดไป <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ส่วนที่ 2: บิลรอตรวจสอบ / สลิปโอนเงิน (Waiting Slips & OCR) */}
        {(sectionView === "both" || sectionView === "slips") && (
          <Card className={cn(
            "border-border/70 shadow-sm overflow-hidden",
            sectionView === "both" ? "xl:col-span-5" : "col-span-1"
          )}>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 p-4 sm:p-5 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ScanLine className="h-4 w-4 text-blue-500" />
                  <span>สลิปรอตรวจสอบ OCR</span>
                  <Badge
                    variant={filteredWaitingSlips.length > 0 ? "default" : "secondary"}
                    className={cn(
                      "font-mono text-xs px-2 py-0.5",
                      filteredWaitingSlips.length > 0
                        ? "bg-blue-600 text-white dark:bg-blue-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {filteredWaitingSlips.length} รายการ
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  อ่านยอดเงิน/วันเวลาอัตโนมัติจาก Line OA พร้อมตรวจยอดตรงบิล
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              {filteredWaitingSlips.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <ScanLine className="mx-auto mb-2 h-8 w-8 opacity-40 text-muted-foreground" />
                  <p>ไม่มีสลิปค้างตรวจตามตัวกรองที่เลือก</p>
                  {isFiltered && (
                    <Button variant="link" size="sm" onClick={resetFilters} className="mt-1 text-xs">
                      ล้างตัวกรองทั้งหมด
                    </Button>
                  )}
                </div>
              ) : (
                filteredWaitingSlips.map((p) => {
                  const cust = customerOf(p.customerId);
                  const linkedBill = bills.find((b) => b.id === p.billId);
                  const isProblem = p.status === "problem";

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "rounded-xl border p-3.5 sm:p-4 transition-all shadow-2xs",
                        isProblem
                          ? "border-destructive/50 bg-destructive/5 dark:bg-destructive/10"
                          : "border-border/80 bg-card hover:border-border"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-foreground">{cust?.name || "ผู้ประกอบการ"}</p>
                            {cust?.shop && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
                                {cust.shop}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            บิล <strong className="text-foreground font-mono">{p.billNo}</strong> · อ้างอิง: <span className="font-mono text-foreground">{p.ref}</span> · {p.paidAt}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ช่องทาง: <span className="font-medium text-foreground">{p.method === "online" ? "โอนผ่าน Line OA" : "เคาน์เตอร์"}</span> · ผู้โอน: <span className="text-foreground">{p.slip?.payerName || "—"}</span> ({p.slip?.bank || "ธนาคาร"})
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display text-base sm:text-lg font-bold font-mono text-foreground">
                            ฿{thb(p.slip?.amount || p.amount)}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            ยอดตามบิล ฿{thb(p.amount)}
                          </p>
                        </div>
                      </div>

                      {isProblem ? (
                        <div className="mt-2.5 rounded-lg bg-destructive/10 border border-destructive/20 p-2 text-xs font-semibold text-destructive flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>สลิปมีปัญหา — {p.issue}</span>
                        </div>
                      ) : null}

                      {/* OCR Confidence Bar */}
                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ScanLine className="h-3 w-3 text-blue-500" /> ค่าความเชื่อมั่น OCR
                          </span>
                          <span className="font-mono font-semibold text-foreground">
                            {p.ocrConfidence}%
                          </span>
                        </div>
                        <Progress value={p.ocrConfidence} className="h-1.5" />
                      </div>

                      {/* Actions */}
                      <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs px-2.5"
                          onClick={() => setViewId(p.id)}
                        >
                          ดูภาพสลิป
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                          disabled={!canVerify}
                          onClick={() => verifyPayment(p.id, true)}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> ยืนยัน + ออกใบเสร็จ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs px-2.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                          disabled={!canVerify}
                          onClick={() => verifyPayment(p.id, false)}
                        >
                          <X className="mr-1 h-3.5 w-3.5" /> ปฏิเสธสลิป
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog: รับชำระบิล */}
      <Dialog open={!!payId} onOpenChange={(o) => !o && setPayId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>รับชำระบิล {bill?.no}</DialogTitle>
            <DialogDescription>
              ยอดที่ต้องชำระ ฿{thb(bill?.total ?? 0)} — {customerOf(bill?.customerId ?? "")?.name} ({customerOf(bill?.customerId ?? "")?.shop})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label>ช่องทางการชำระเงิน</Label>
              <div className="flex gap-2">
                {(["online", "counter"] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={method === m ? "default" : "outline"}
                    onClick={() => setMethod(m)}
                    className="flex-1 text-xs"
                  >
                    {m === "online" ? "โอน + แนบสลิปใน Line" : "Walk-in เคาน์เตอร์"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ref">เลขที่อ้างอิงจากสลิป / สัญญาณโอน</Label>
              <Input id="ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="เช่น TMB123456" />
            </div>

            {method === "counter" ? (
              <div className="rounded-lg border border-border p-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setSlipName(f.name);
                      toast.success(`แนบสลิป ${f.name} — ระบบกำลังอ่านข้อมูลด้วย OCR`);
                    }
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="mr-1 h-4 w-4" /> แนบสลิป (จาก Laptop / มือถือ)
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {slipName
                    ? `แนบแล้ว: ${slipName}`
                    : "รองรับไฟล์ภาพจากเครื่องหรือถ่ายจากกล้องมือถือ"}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                <ScanLine className="mx-auto mb-1 h-5 w-5 text-blue-500" /> ระบบจะดึงสลิปจาก Line OA แล้วรัน OCR
                อ่านยอดเงิน/วันเวลา/เลขอ้างอิงอัตโนมัติ
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayId(null)}>
              ยกเลิก
            </Button>
            <Button
              disabled={!ref || (method === "counter" && !slipName)}
              onClick={() => {
                if (settle({ billIds: [payId!], method, ref, slipAttached: false })) {
                  setSlipName("");
                  setPayId(null);
                }
              }}
            >
              บันทึกการชำระเงิน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: ภาพสลิป */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ภาพสลิปการโอนเงิน</DialogTitle>
            <DialogDescription>
              {viewing ? `${customerOf(viewing.customerId)?.name} · บิล ${viewing.billNo}` : ""}
            </DialogDescription>
          </DialogHeader>
          {viewing ? <SlipView payment={viewing} /> : null}
          {viewing?.status === "problem" ? (
            <Badge variant="destructive" className="mx-auto">
              สลิปมีปัญหา: {viewing.issue}
            </Badge>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
