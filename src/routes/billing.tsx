import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Send,
  Printer,
  Play,
  Search,
  X,
  RotateCcw,
  Calendar,
  Zap,
  Droplets,
  Receipt,
  Tag,
  Layers,
  LayoutGrid,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquare,
  Pencil,
  Check,
  AlertTriangle,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import {
  getCustomerMeterCategory,
  getMeterPrefix,
  type MeterCategoryFilter,
} from "@/lib/customer-matching";
import { BillSheet } from "@/components/rcms/BillSheet";
import { canPerform } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Bill } from "@/lib/rcms-types";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "ออกใบแจ้งหนี้ · RCMS ชย.ทอ." },
      {
        name: "description",
        content: "ประมวลผลใบแจ้งหนี้แยกตามบริการ Statement ค่าไฟฟ้า และ Statement ค่าน้ำประปา",
      },
      { property: "og:title", content: "ออกใบแจ้งหนี้ · RCMS" },
      {
        property: "og:description",
        content: "Billing Module: ประมวลผลบิลแยกบริการ ส่ง Line OA และพิมพ์ใบแจ้งหนี้",
      },
    ],
  }),
  component: Billing,
});

const LINE_BTN = "bg-line text-line-foreground hover:bg-line/90";

function Billing() {
  const {
    bills,
    customers,
    period,
    generateBills,
    sendBill,
    sendsOf,
    customerOf,
    updateCustomer,
    settings,
    arrearsOf,
    role,
  } = useRcms();
  const canIssue = canPerform(role, "billing.issue");
  const canSend = canPerform(role, "billing.send");
  const [mode, setMode] = useState<"electric" | "water">("electric");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [meterCatFilter, setMeterCatFilter] = useState<MeterCategoryFilter>("all");
  const [meterSeriesFilter, setMeterSeriesFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grouped">("table");
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lineSendBillId, setLineSendBillId] = useState<string | null>(null);
  const [editingLineCustId, setEditingLineCustId] = useState<string | null>(null);
  const [lineIdInput, setLineIdInput] = useState<string>("");
  const [printBills, setPrintBills] = useState<Bill[] | null>(null);

  // Meter Categories & Series Statistics
  const meterStats = useMemo(() => {
    let bothCount = 0;
    let elecOnlyCount = 0;
    let waterOnlyCount = 0;
    let noneCount = 0;
    let totalElecMeters = 0;
    let totalWaterMeters = 0;

    const elecSeriesMap = new Map<string, number>();
    const waterSeriesMap = new Map<string, number>();

    customers.forEach((c) => {
      const cat = getCustomerMeterCategory(c);
      if (cat.type === "both") {
        bothCount++;
      } else if (cat.type === "electric") {
        elecOnlyCount++;
      } else if (cat.type === "water") {
        waterOnlyCount++;
      } else {
        noneCount++;
      }

      if (c.elecMeter && c.elecMeter !== "—" && c.elecMeter !== "-") {
        totalElecMeters++;
        const p = getMeterPrefix(c.elecMeter);
        if (p) {
          elecSeriesMap.set(p, (elecSeriesMap.get(p) || 0) + 1);
        }
      }

      if (c.waterMeter && c.waterMeter !== "—" && c.waterMeter !== "-") {
        totalWaterMeters++;
        const p = getMeterPrefix(c.waterMeter);
        if (p) {
          waterSeriesMap.set(p, (waterSeriesMap.get(p) || 0) + 1);
        }
      }
    });

    const elecSeriesList = Array.from(elecSeriesMap.entries())
      .map(([series, count]) => ({ series, count, type: "electric" as const }))
      .sort((a, b) => b.count - a.count);

    const waterSeriesList = Array.from(waterSeriesMap.entries())
      .map(([series, count]) => ({ series, count, type: "water" as const }))
      .sort((a, b) => b.count - a.count);

    return {
      elecOnlyCount,
      waterOnlyCount,
      bothCount,
      noneCount,
      elecCount: elecOnlyCount + bothCount,
      waterCount: waterOnlyCount + bothCount,
      totalElecMeters,
      totalWaterMeters,
      elecSeriesList,
      waterSeriesList,
    };
  }, [customers]);

  // Filter bills strictly by the current mode (electric vs water)
  const allPeriodBills = useMemo(
    () =>
      bills.filter(
        (b) => b.period === period && b.type === mode,
      ),
    [bills, period, mode],
  );

  // Pre-calculate counts for both modes to show on tabs
  const elecBillsCount = useMemo(
    () => bills.filter((b) => b.period === period && b.type === "electric").length,
    [bills, period],
  );
  const waterBillsCount = useMemo(
    () => bills.filter((b) => b.period === period && b.type === "water").length,
    [bills, period],
  );

  const statusOf = (b: Bill) => {
    if (b.status === "paid")
      return { label: "ชำระแล้ว", cls: "bg-success/15 text-success border-success/30" };
    if (b.status === "pending_review")
      return { label: "รอตรวจสลิป", cls: "bg-warning/20 text-warning border-warning/30" };
    if (arrearsOf(b.customerId, mode, b.period).length > 0)
      return { label: "ค้างชำระ", cls: "bg-destructive/15 text-destructive border-destructive/30" };
    if (b.lines.every((l) => l.kind === "maintenance"))
      return { label: "รักษามิเตอร์", cls: "bg-warning/20 text-warning border-warning/30" };
    return { label: "ปกติ", cls: "bg-success/15 text-success border-success/30" };
  };

  const availableStatuses = useMemo(() => {
    const counts: Record<string, number> = {};
    allPeriodBills.forEach((b) => {
      const st = statusOf(b);
      counts[st.label] = (counts[st.label] || 0) + 1;
    });
    return counts;
  }, [allPeriodBills, mode, arrearsOf]);

  const isFiltered =
    q.trim() !== "" ||
    statusFilter !== "all" ||
    meterCatFilter !== "all" ||
    meterSeriesFilter !== "all";

  const resetFilters = () => {
    setQ("");
    setStatusFilter("all");
    setMeterCatFilter("all");
    setMeterSeriesFilter("all");
    setPage(0);
  };

  const periodBills = useMemo(() => {
    const term = q.trim().toLowerCase();
    return allPeriodBills.filter((b) => {
      const cust = customerOf(b.customerId);
      const cat = cust ? getCustomerMeterCategory(cust) : null;
      const meterNo = mode === "electric" ? cust?.elecMeter ?? "" : cust?.waterMeter ?? "";

      // 1. หมวดหมู่มิเตอร์
      if (meterCatFilter === "both" && cat?.type !== "both") return false;
      if (meterCatFilter === "none" && cat?.type !== "none") return false;

      // 2. หมวดรหัสมิเตอร์ (Series Prefix)
      if (meterSeriesFilter !== "all") {
        if (!meterNo || !meterNo.startsWith(meterSeriesFilter)) return false;
      }

      // 3. ตัวกรองสถานะ: อ้างอิงจากสถานะที่มีอยู่ในระบบเท่านั้น
      if (statusFilter !== "all") {
        const st = statusOf(b);
        if (st.label !== statusFilter) return false;
      }

      // 4. ค้นหาตามชื่อผู้ประกอบการ / ชื่อร้าน / รหัส / เบอร์โทร / Line ID / เลขที่บิล / หมายเลขมิเตอร์
      if (term) {
        const searchStr = `${cust?.name ?? ""} ${cust?.shop ?? ""} ${cust?.code ?? ""} ${cust?.phone ?? ""} ${cust?.lineId ?? ""} ${b.no} ${meterNo}`.toLowerCase();
        if (!searchStr.includes(term)) return false;
      }

      return true;
    });
  }, [allPeriodBills, q, statusFilter, meterCatFilter, meterSeriesFilter, customerOf, mode, arrearsOf]);

  const [selectedArrears, setSelectedArrears] = useState<Record<string, string[]>>({});

  // Strictly get arrears for the current mode service (electric vs water) prior to the bill's period
  const getActiveArrears = (billId: string, customerId: string, billPeriod?: string) => {
    const allArr = arrearsOf(customerId, mode, billPeriod);
    const selected = selectedArrears[billId] ?? allArr.map((a) => a.period);
    return allArr.filter((a) => selected.includes(a.period));
  };

  const toggleArrearsPeriod = (billId: string, customerId: string, periodStr: string, billPeriod?: string) => {
    const allArr = arrearsOf(customerId, mode, billPeriod);
    const current = selectedArrears[billId] ?? allArr.map((a) => a.period);
    const next = current.includes(periodStr)
      ? current.filter((p) => p !== periodStr)
      : [...current, periodStr];
    setSelectedArrears((prev) => ({ ...prev, [billId]: next }));
  };

  const setAllArrearsPeriods = (billId: string, customerId: string, selectAll: boolean, billPeriod?: string) => {
    const allArr = arrearsOf(customerId, mode, billPeriod);
    setSelectedArrears((prev) => ({
      ...prev,
      [billId]: selectAll ? allArr.map((a) => a.period) : [],
    }));
  };

  const bill = bills.find((b) => b.id === openId);
  const cust = bill ? customerOf(bill.customerId) : undefined;

  // Total current period amount for this mode
  const totalModeAmount = useMemo(
    () => allPeriodBills.reduce((acc, b) => acc + (b.total || 0), 0),
    [allPeriodBills],
  );

  // สรุปยอดค้างชำระสะสมรวมทั้งหมดแยกตามแต่ละงวดเดือน (สำหรับโหมดปัจจุบัน)
  const modeArrearsSummary = useMemo(() => {
    const periodMap: Record<string, number> = {};
    let totalArrearsAmount = 0;
    let billsWithArrearsCount = 0;

    allPeriodBills.forEach((b) => {
      const arr = getActiveArrears(b.id, b.customerId, b.period);
      if (arr.length > 0) {
        billsWithArrearsCount++;
        arr.forEach((a) => {
          periodMap[a.period] = (periodMap[a.period] || 0) + a.amount;
          totalArrearsAmount += a.amount;
        });
      }
    });

    const sortedPeriods = Object.keys(periodMap).sort((a, b) => a.localeCompare(b));
    return {
      totalArrearsAmount: +totalArrearsAmount.toFixed(2),
      billsWithArrearsCount,
      monthlyBreakdown: sortedPeriods.map((p) => ({
        period: p,
        amount: +periodMap[p]!.toFixed(2),
      })),
      grandTotal: +(totalModeAmount + totalArrearsAmount).toFixed(2),
    };
  }, [allPeriodBills, mode, arrearsOf, selectedArrears, totalModeAmount]);

  // สรุปยอดรวมตามตัวกรองที่แสดงผลในตาราง
  const filteredTotals = useMemo(() => {
    let currentTotal = 0;
    let arrearsTotal = 0;
    const periodMap: Record<string, number> = {};

    periodBills.forEach((b) => {
      currentTotal += b.total || 0;
      const arr = getActiveArrears(b.id, b.customerId, b.period);
      arr.forEach((a) => {
        arrearsTotal += a.amount;
        periodMap[a.period] = (periodMap[a.period] || 0) + a.amount;
      });
    });

    return {
      currentTotal: +currentTotal.toFixed(2),
      arrearsTotal: +arrearsTotal.toFixed(2),
      grandTotal: +(currentTotal + arrearsTotal).toFixed(2),
      monthlyBreakdown: Object.keys(periodMap)
        .sort((a, b) => a.localeCompare(b))
        .map((p) => ({
          period: p,
          amount: +periodMap[p]!.toFixed(2),
        })),
    };
  }, [periodBills, mode, arrearsOf, selectedArrears]);

  // Grouped sections for "แยกหมวดหมู่มิเตอร์" view
  const groupedSections = useMemo(() => {
    if (viewMode !== "grouped") return [];
    const groups: Array<{
      key: string;
      title: string;
      series?: string;
      badgeText: string;
      badgeCls: string;
      items: Bill[];
    }> = [];

    const seriesList = mode === "electric" ? meterStats.elecSeriesList : meterStats.waterSeriesList;

    seriesList.forEach((s) => {
      const items = periodBills.filter((b) => {
        const c = customerOf(b.customerId);
        const m = mode === "electric" ? c?.elecMeter : c?.waterMeter;
        return m?.startsWith(s.series);
      });
      if (items.length > 0) {
        groups.push({
          key: `group-${s.series}`,
          title: mode === "electric" ? `หมวดมิเตอร์ไฟฟ้า: หมวด ${s.series}` : `หมวดมาตรวัดน้ำประปา: หมวด ${s.series}`,
          series: s.series,
          badgeText: mode === "electric" ? `⚡ ไฟฟ้า (หมวด ${s.series})` : `💧 น้ำประปา (หมวด ${s.series})`,
          badgeCls: mode === "electric"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
          items,
        });
      }
    });

    const otherItems = periodBills.filter(
      (b) => !groups.some((g) => g.items.some((item) => item.id === b.id)),
    );
    if (otherItems.length > 0) {
      groups.push({
        key: "other-bills",
        title: "บิลหมวดอื่นๆ / ทั่วไป",
        badgeText: "หมวดอื่นๆ",
        badgeCls: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400",
        items: otherItems,
      });
    }

    return groups;
  }, [viewMode, periodBills, meterStats, customerOf, mode]);

  const effectivePageSize = pageSize === "all" ? Math.max(1, periodBills.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(periodBills.length / effectivePageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedBills = pageSize === "all" ? periodBills : periodBills.slice(currentPage * effectivePageSize, (currentPage + 1) * effectivePageSize);

  const renderBillsTable = (items: Bill[], offsetIdx: number = 0, isGroupTable: boolean = false) => {
    let subCurrent = 0;
    let subArrears = 0;
    let subGrand = 0;

    return (
      <div className="w-full overflow-x-auto">
        <Table className="w-full text-xs">
          <TableHeader className="bg-muted/40 border-b border-border">
            <TableRow className="text-xs hover:bg-transparent border-b border-border">
              <TableHead className="w-10 text-center text-xs font-semibold text-muted-foreground py-2.5 px-1">ลำดับ</TableHead>
              <TableHead className="w-20 text-center text-xs font-semibold text-muted-foreground py-2.5 px-1.5 whitespace-nowrap">เลขที่บิล</TableHead>
              <TableHead className="w-16 text-center text-xs font-semibold text-muted-foreground py-2.5 px-1 whitespace-nowrap">รหัส</TableHead>
              <TableHead className="min-w-[130px] text-xs font-semibold text-muted-foreground py-2.5 px-2.5">ผู้ประกอบการ</TableHead>
              <TableHead className="min-w-[120px] max-w-[200px] text-xs font-semibold text-muted-foreground py-2.5 px-2">สถานที่ / ร้านค้า</TableHead>
              <TableHead className="w-28 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap py-2.5 px-1.5">
                {mode === "electric" ? (
                  <span className="inline-flex items-center gap-1 justify-center"><Zap className="h-3.5 w-3.5 text-amber-500" /> มิเตอร์ไฟ</span>
                ) : (
                  <span className="inline-flex items-center gap-1 justify-center"><Droplets className="h-3.5 w-3.5 text-blue-500" /> มาตรวัดน้ำ</span>
                )}
              </TableHead>
              <TableHead className="w-24 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap py-2.5 px-2">ยอดงวดนี้</TableHead>
              <TableHead className="w-24 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap py-2.5 px-2">
                {mode === "electric" ? "⚡ ยอดค้าง" : "💧 ยอดค้าง"}
              </TableHead>
              <TableHead className="w-28 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap py-2.5 px-2">
                รวมทั้งสิ้น
              </TableHead>
              <TableHead className="w-20 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap py-2.5 px-1.5">สถานะ</TableHead>
              <TableHead className="w-28 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap py-2.5 px-2">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((b, idx) => {
              const cust = customerOf(b.customerId);
              const st = statusOf(b);
              const meterVal = mode === "electric" ? cust?.elecMeter : cust?.waterMeter;
              const allArr = arrearsOf(b.customerId, mode, b.period);
              const activeArr = getActiveArrears(b.id, b.customerId, b.period);
              const activeTotal = activeArr.reduce((s, a) => s + a.amount, 0);
              const grandTotal = (b.total || 0) + activeTotal;

              subCurrent += b.total || 0;
              subArrears += activeTotal;
              subGrand += grandTotal;

              return (
                <TableRow
                  key={b.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/50 group text-xs"
                  onClick={() => setOpenId(b.id)}
                >
                  {/* 1. ลำดับ */}
                  <TableCell className="text-center py-2.5 px-1 w-10 font-mono text-xs text-muted-foreground">
                    {offsetIdx + idx + 1}
                  </TableCell>

                  {/* 2. เลขที่บิล */}
                  <TableCell className="text-center py-2.5 px-1.5 w-20 font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                    {b.no}
                  </TableCell>

                  {/* 3. รหัส */}
                  <TableCell className="text-center py-2.5 px-1 w-16 whitespace-nowrap">
                    <span className="inline-flex items-center justify-center font-mono text-[11px] font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/70">
                      {cust?.code ?? "—"}
                    </span>
                  </TableCell>

                  {/* 4. ผู้ประกอบการ */}
                  <TableCell className="py-2.5 px-2.5 min-w-[130px]">
                    <p className="font-bold text-foreground text-xs leading-snug group-hover:text-primary transition-colors">
                      {cust?.name ?? "—"}
                    </p>
                    {(cust?.phone && cust.phone !== "-") || (cust?.lineId && cust.lineId !== "-") ? (
                      <p className="text-[10.5px] text-muted-foreground mt-0.5 flex items-center gap-1 font-normal">
                        {cust?.phone && cust.phone !== "-" && <span>📞 {cust.phone}</span>}
                        {cust?.phone && cust.phone !== "-" && cust.lineId && cust.lineId !== "-" && <span>·</span>}
                        {cust?.lineId && cust.lineId !== "-" && <span>Line: {cust.lineId}</span>}
                      </p>
                    ) : null}
                  </TableCell>

                  {/* 5. สถานที่ / ร้านค้า */}
                  <TableCell className="py-2.5 px-2 min-w-[120px] max-w-[200px]">
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 font-normal">
                      {cust?.shop ?? "—"}
                    </p>
                  </TableCell>

                  {/* 6. หมายเลขมิเตอร์ */}
                  <TableCell className="text-center py-2.5 px-1.5 w-28 whitespace-nowrap">
                    {meterVal && meterVal !== "—" && meterVal !== "-" ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-mono font-semibold",
                          mode === "electric"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                            : "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200",
                        )}
                      >
                        {mode === "electric" ? (
                          <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0 fill-amber-500/20" />
                        ) : (
                          <Droplets className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0 fill-blue-500/20" />
                        )}
                        {meterVal}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  {/* 7. ยอดเดือนปัจจุบัน */}
                  <TableCell className="text-right py-2.5 px-2 w-24 font-mono whitespace-nowrap font-bold text-xs text-foreground">
                    ฿{thb(b.total)}
                  </TableCell>

                  {/* 8. ยอดค้างชำระ */}
                  <TableCell className="text-right py-2.5 px-2 w-24 font-mono whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {allArr.length === 0 ? (
                      <span className="font-mono text-xs text-muted-foreground/40">—</span>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="group inline-flex flex-col items-end rounded-md p-1 text-right transition hover:bg-muted/80 focus:outline-none cursor-pointer max-w-full"
                            title="คลิกเพื่อดูหรือเลือกงวดค้างชำระที่จะรวมในใบแจ้งหนี้"
                          >
                            <span
                              className={`font-mono text-xs font-bold ${activeTotal > 0 ? "text-destructive" : "text-muted-foreground"}`}
                            >
                              {activeTotal > 0 ? `฿${thb(activeTotal)}` : "฿0 (ไม่รวม)"}
                            </span>
                            {activeArr.length > 0 ? (
                              <span className="text-[10px] font-sans font-medium text-destructive mt-0.5">
                                ค้าง {activeArr.length} เดือน
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-muted-foreground font-sans">
                                (ไม่รวมยอดค้าง)
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80 p-3 shadow-lg">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between border-b border-border pb-1.5">
                              <p className="text-xs font-semibold">
                                งวดค้างชำระ ({mode === "electric" ? "⚡ ค่าไฟฟ้า" : "💧 ค่าน้ำประปา"})
                              </p>
                              <div className="flex gap-2 text-[11px]">
                                <button
                                  type="button"
                                  className="text-primary hover:underline cursor-pointer font-medium"
                                  onClick={() => setAllArrearsPeriods(b.id, b.customerId, true, b.period)}
                                >
                                  เลือกทั้งหมด
                                </button>
                                <span>·</span>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:underline cursor-pointer font-medium"
                                  onClick={() => setAllArrearsPeriods(b.id, b.customerId, false, b.period)}
                                >
                                  ไม่รวม
                                </button>
                              </div>
                            </div>
                            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                              {allArr.map((a) => {
                                const isChecked = activeArr.some((x) => x.period === a.period);
                                return (
                                  <label
                                    key={a.period}
                                    className={`flex cursor-pointer items-center justify-between rounded-md border p-2 text-xs transition ${
                                      isChecked
                                        ? "border-primary/40 bg-muted/50 font-medium shadow-xs"
                                        : "border-border/60 bg-muted/20 text-muted-foreground opacity-60"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() =>
                                          toggleArrearsPeriod(b.id, b.customerId, a.period, b.period)
                                        }
                                      />
                                      <span>
                                        งวด {periodLabel(a.period)} ({periodFullThai(a.period)})
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-destructive">฿{thb(a.amount)}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="border-t border-border pt-1.5 flex items-center justify-between text-xs font-semibold">
                              <span className="text-muted-foreground">ยอดค้างที่เลือก ({activeArr.length} เดือน):</span>
                              <span className="font-mono text-destructive">฿{thb(activeTotal)}</span>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </TableCell>

                  {/* 9. ยอดรวมทั้งสิ้นที่ต้องชำระ */}
                  <TableCell className="text-right py-2.5 px-2 w-28 font-mono whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-xs text-foreground">
                        ฿{thb(grandTotal)}
                      </span>
                      {activeTotal > 0 && (
                        <span className="text-[9.5px] text-muted-foreground font-sans">
                          (งวดนี้ ฿{thb(b.total)} + ค้าง ฿{thb(activeTotal)})
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* 10. สถานะ */}
                  <TableCell className="text-center py-2.5 px-1.5 w-20">
                    {st ? (
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.2 whitespace-nowrap", st.cls)}>
                        {st.label}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* 11. จัดการ */}
                  <TableCell className="space-x-1 text-right py-2.5 px-2 w-28 whitespace-nowrap">
                    <Button size="sm" variant="outline" className="h-6.5 text-[11px] px-2" onClick={() => setOpenId(b.id)}>
                      <FileText className="mr-1 h-3 w-3" /> ดูบิล
                    </Button>
                    <Button
                      size="sm"
                      className={cn(LINE_BTN, "h-6.5 text-[11px] px-2 shadow-xs inline-flex items-center gap-1 font-medium")}
                      disabled={!canSend || b.status === "paid"}
                      onClick={() => setLineSendBillId(b.id)}
                      title={
                        b.status === "paid"
                          ? "ชำระเงินแล้ว — ไม่สามารถส่งบิลได้"
                          : `ส่งบิลผ่าน LINE รายบุคคล${sendsOf(b.id).length > 0 ? ` (ส่งแล้ว ${sendsOf(b.id).length} ครั้ง)` : ""}`
                      }
                    >
                      <Send className="h-3 w-3" />
                      <span>ส่ง</span>
                      {sendsOf(b.id).length > 0 && (
                        <span className="ml-0.5 rounded-full bg-black/25 px-1 py-0 text-[9px] font-mono">
                          {sendsOf(b.id).length}
                        </span>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter className="bg-muted/60 font-semibold border-t-2 border-border">
            <TableRow className="hover:bg-transparent text-xs">
              <TableCell colSpan={6} className="py-2.5 px-2.5 text-left font-sans text-xs">
                {isGroupTable ? `รวมหมวดนี้ (${items.length} ใบแจ้งหนี้)` : `รวมทั้งสิ้น (${periodBills.length} ใบแจ้งหนี้)`}
              </TableCell>
              <TableCell className="py-2.5 px-2 text-right font-mono font-bold text-foreground whitespace-nowrap">
                ฿{thb(isGroupTable ? subCurrent : filteredTotals.currentTotal)}
              </TableCell>
              <TableCell className="py-2.5 px-2 text-right font-mono whitespace-nowrap">
                <div className="flex flex-col items-end">
                  <span className="font-bold text-destructive text-xs">
                    ฿{thb(isGroupTable ? subArrears : filteredTotals.arrearsTotal)}
                  </span>
                  {(isGroupTable ? subArrears : filteredTotals.arrearsTotal) > 0 && (
                    <span className="text-[9.5px] text-muted-foreground font-sans">
                      (ยอดค้างชำระรวม)
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-2.5 px-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs whitespace-nowrap">
                ฿{thb(isGroupTable ? subGrand : filteredTotals.grandTotal)}
              </TableCell>
              <TableCell colSpan={2} className="text-center text-muted-foreground text-xs">
                —
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="ออกใบแจ้งหนี้"
        desc={`งวด ${periodLabel(period)} · ครบกำหนดชำระภายใน ${settings.dueDayOffset} วันหลังออกบิล`}
      />

      {/* แถบเลือก Statement ค่าไฟฟ้า / ค่าน้ำประปา */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-border bg-muted/30 p-1">
              <button
                onClick={() => {
                  setMode("electric");
                  setStatusFilter("all");
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition",
                  mode === "electric"
                    ? "bg-amber-500 text-slate-950 shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <Zap className={cn("h-4 w-4", mode === "electric" ? "text-slate-950" : "text-amber-500")} />
                <span>Statement ค่าไฟฟ้า</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1 text-[11px] font-mono",
                    mode === "electric" ? "bg-slate-950/15 text-slate-950" : "bg-muted text-muted-foreground",
                  )}
                >
                  {elecBillsCount} ใบ
                </Badge>
              </button>

              <button
                onClick={() => {
                  setMode("water");
                  setStatusFilter("all");
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition",
                  mode === "water"
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <Droplets className={cn("h-4 w-4", mode === "water" ? "text-white" : "text-blue-500")} />
                <span>Statement ค่าน้ำประปา</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1 text-[11px] font-mono",
                    mode === "water" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {waterBillsCount} ใบ
                </Badge>
              </button>
            </div>

            <div className="text-xs text-muted-foreground hidden md:block pl-2 border-l border-border">
              {mode === "electric" ? (
                <span>⚡ แสดงเฉพาะข้อมูลผู้ใช้บริการและมิเตอร์ไฟฟ้า</span>
              ) : (
                <span>💧 แสดงเฉพาะข้อมูลผู้ใช้บริการและมาตรวัดน้ำประปา</span>
              )}
            </div>
          </div>

          <Button
            disabled={!canIssue}
            onClick={() => {
              const n = generateBills(period, mode);
              if (n === 0) toast.info(`งวดนี้ประมวลผลบิล${mode === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"}ไปแล้ว หรือไม่มีรายการที่เข้าเงื่อนไข`);
              else toast.success(`ประมวลผลสำเร็จ — ออกบิล${mode === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"} ${n} ใบ`);
            }}
          >
            <Play className="mr-1 h-4 w-4" /> ประมวลผลรอบบิล ({mode === "electric" ? "ไฟฟ้า" : "น้ำประปา"})
          </Button>
        </CardContent>
      </Card>

      {/* สรุปยอดเรียกเก็บและยอดค้างชำระสะสมแยกตามแต่ละงวดเดือน */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: ยอดเรียกเก็บงวดปัจจุบัน */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                {mode === "electric" ? (
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Droplets className="h-3.5 w-3.5 text-blue-500" />
                )}
                <span>ยอดเรียกเก็บงวด {periodLabel(period)}</span>
              </p>
              <p className="mt-1 font-display text-xl font-bold font-mono text-foreground">
                ฿{thb(totalModeAmount)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ทั้งหมด <strong className="text-foreground font-mono">{allPeriodBills.length}</strong> ใบแจ้งหนี้
              </p>
            </div>
            <div
              className={cn(
                "rounded-full p-2.5",
                mode === "electric"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-blue-500/15 text-blue-600 dark:text-blue-400",
              )}
            >
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: ยอดค้างชำระสะสมรวม */}
        <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                <span>⚠️ ยอดค้างชำระสะสมรวม</span>
              </p>
              <p className="mt-1 font-display text-xl font-bold font-mono text-destructive">
                ฿{thb(modeArrearsSummary.totalArrearsAmount)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                มีบิลค้างชำระ <strong className="text-destructive font-mono">{modeArrearsSummary.billsWithArrearsCount}</strong> ใบ
              </p>
            </div>
            <div className="rounded-full bg-destructive/15 p-2.5 text-destructive">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: ยอดรวมที่ต้องชำระทั้งหมด */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <span>💰 ยอดรวมที่ต้องชำระทั้งหมด</span>
              </p>
              <p className="mt-1 font-display text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                ฿{thb(modeArrearsSummary.grandTotal)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                งวดปัจจุบัน + ค้างชำระสะสม
              </p>
            </div>
            <div className="rounded-full bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: สรุปสถานะการชำระ */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <span>📊 สถานะการชำระเงิน</span>
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {allPeriodBills.filter((b) => b.status === "paid").length}
                </span>
                <span className="text-xs text-muted-foreground">ชำระแล้ว</span>
                <span className="text-muted-foreground/50">/</span>
                <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">
                  {allPeriodBills.filter((b) => b.status !== "paid").length}
                </span>
                <span className="text-xs text-muted-foreground">รอชำระ</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                อัตราการชำระ{" "}
                <strong className="font-mono text-foreground">
                  {allPeriodBills.length > 0
                    ? Math.round(
                        (allPeriodBills.filter((b) => b.status === "paid").length / allPeriodBills.length) * 100,
                      )
                    : 0}
                  %
                </strong>
              </p>
            </div>
            <div className="rounded-full bg-primary/10 p-2.5 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* แผงหมวดหมู่มิเตอร์ ค้นหา และตัวกรอง ตามรูปแบบเดียวกับหน้าจดมิเตอร์ */}
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
                ทั้งหมด ({allPeriodBills.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 text-xs px-3 gap-1.5 font-medium rounded-full transition-all",
                  mode === "electric" && meterCatFilter === "electric"
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm hover:bg-amber-700 dark:bg-amber-500 dark:border-amber-500"
                    : "bg-amber-50/80 text-amber-800 border-amber-300/80 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700/60",
                )}
                onClick={() => {
                  setMode("electric");
                  setMeterCatFilter("electric");
                  setPage(0);
                }}
              >
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> หมวดไฟฟ้า ({elecBillsCount})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 text-xs px-3 gap-1.5 font-medium rounded-full transition-all",
                  mode === "water" && meterCatFilter === "water"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500"
                    : "bg-sky-50/80 text-sky-800 border-sky-300/80 hover:bg-sky-100/80 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-700/60",
                )}
                onClick={() => {
                  setMode("water");
                  setMeterCatFilter("water");
                  setPage(0);
                }}
              >
                <Droplets className="h-3.5 w-3.5 text-blue-500 fill-blue-500/20" /> หมวดน้ำประปา ({waterBillsCount})
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

            {/* Toggle View Mode */}
            <div className="flex items-center gap-1 bg-stone-100/90 dark:bg-muted/50 p-1 rounded-xl border border-stone-200/80 dark:border-border/60">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  viewMode === "table"
                    ? "bg-stone-200/90 dark:bg-muted text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setViewMode("table")}
              >
                <ListIcon className="h-3.5 w-3.5" /> ตารางรวม
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  viewMode === "grouped"
                    ? "bg-stone-200/90 dark:bg-muted text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setViewMode("grouped")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> แยกหมวดหมู่มิเตอร์
              </button>
            </div>
          </div>

          {/* แถวที่ 2: ช่องค้นหา + Dropdown หมวดรหัสมิเตอร์ + Dropdown สถานะ */}
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-12">
            <div className="relative md:col-span-6 lg:col-span-7">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อผู้ประกอบการ, ร้านค้า, รหัส, เบอร์โทร, เลขมิเตอร์, เลขที่บิล..."
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

            {/* กรองตามหมวดรหัสมิเตอร์ (Series / Prefix) */}
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

            {/* กรองตามสถานะ */}
            <div className="md:col-span-3 lg:col-span-2">
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
                  <SelectItem value="all">สถานะทั้งหมด ({allPeriodBills.length})</SelectItem>
                  {Object.entries(availableStatuses).map(([label, count]) => (
                    <SelectItem key={label} value={label}>
                      {label} ({count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* แถวที่ 3: สรุปผลการค้นหา และ ตัวเลือกจำนวนแถว */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>ผลการค้นหา:</span>
              <span className="font-mono font-bold text-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/60 text-xs">
                {periodBills.length} ใบ
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

            {/* Page Size Selector */}
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
                <option value={25}>25 รายการ/หน้า</option>
                <option value={50}>50 รายการ/หน้า</option>
                <option value={100}>100 รายการ/หน้า</option>
                <option value="all">แสดงทั้งหมด ({periodBills.length})</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* บัตรตารางหลัก (List View หรือ Grouped View) */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  {mode === "electric" ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <Zap className="h-5 w-5 text-amber-500" /> Statement ใบแจ้งหนี้ค่าไฟฟ้า
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                      <Droplets className="h-5 w-5 text-blue-500" /> Statement ใบแจ้งหนี้ค่าน้ำประปา
                    </span>
                  )}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-mono px-2 py-0.5",
                    mode === "electric"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                  )}
                >
                  งวด {periodLabel(period)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>
                  ทั้งหมด <strong className="font-semibold text-foreground font-mono">{allPeriodBills.length}</strong> ใบ
                </span>
                <span>·</span>
                <span>
                  ยอดงวดนี้{" "}
                  <strong className="font-semibold font-mono text-foreground">
                    ฿{thb(totalModeAmount)}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  ยอดค้างชำระรวม{" "}
                  <strong className="font-semibold font-mono text-destructive">
                    ฿{thb(modeArrearsSummary.totalArrearsAmount)}
                  </strong>
                </span>
                <span>·</span>
                <span>
                  ยอดรวมทั้งสิ้น{" "}
                  <strong className="font-semibold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                    ฿{thb(modeArrearsSummary.grandTotal)}
                  </strong>
                </span>
                {isFiltered && (
                  <>
                    <span>·</span>
                    <span className="text-foreground font-medium">
                      (พบตามตัวกรอง {periodBills.length} ใบ)
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Action Buttons (Send Line & Print All) */}
            <div className="flex items-center gap-2 shrink-0">
              {(() => {
                const sendable = periodBills.filter((b) => b.status !== "paid");
                return (
                  <Button
                    size="sm"
                    className={cn(LINE_BTN, "h-9 shadow-xs")}
                    disabled={!sendable.length || !canSend}
                    onClick={() => {
                      sendable.forEach((bill) => sendBill(bill.id));
                    }}
                    title={
                      sendable.length < periodBills.length
                        ? `ส่งบิลผ่าน Line (${sendable.length} ใบ — ข้ามใบที่ชำระแล้ว)`
                        : "ส่งบิลผ่าน Line"
                    }
                  >
                    <Send className="mr-1.5 h-4 w-4" /> ส่งบิลผ่าน Line
                    {sendable.length > 0 && (
                      <span className="ml-1 rounded bg-black/20 px-1.5 py-0.2 text-[10px] font-mono">
                        {sendable.length}
                      </span>
                    )}
                  </Button>
                );
              })()}
              <Button
                size="sm"
                variant="outline"
                className="h-9 shadow-xs"
                disabled={!periodBills.length}
                onClick={() => setPrintBills(periodBills)}
              >
                <Printer className="mr-1.5 h-4 w-4" /> พิมพ์ทั้งหมด
                {periodBills.length > 0 && (
                  <span className="ml-1 text-xs font-mono text-muted-foreground">
                    ({periodBills.length})
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {allPeriodBills.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              <Receipt className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="font-medium text-foreground">
                ยังไม่มีใบแจ้งหนี้{mode === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"}ในงวด {periodLabel(period)}
              </p>
              <p className="mt-1 text-xs">กดปุ่ม “ประมวลผลรอบบิล ({mode === "electric" ? "ไฟฟ้า" : "น้ำประปา"})” เพื่อสร้างใบแจ้งหนี้</p>
            </div>
          ) : periodBills.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Search className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="font-medium text-foreground">ไม่พบใบแจ้งหนี้ที่ตรงกับคำค้นหา</p>
              <p className="mt-1 text-xs">ลองปรับเปลี่ยนคำค้นหา หรือล้างตัวกรอง</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs"
                onClick={resetFilters}
              >
                ล้างตัวกรองการค้นหา
              </Button>
            </div>
          ) : viewMode === "grouped" ? (
            <div className="space-y-4 p-4">
              {groupedSections.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  ไม่พบกลุ่มมิเตอร์ตามเงื่อนไขที่เลือก
                </div>
              ) : (
                groupedSections.map((group) => (
                  <Card key={group.key} className="overflow-hidden border border-border/80 shadow-xs">
                    <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5", group.badgeCls)}>
                          {group.badgeText}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">
                          ({group.items.length} ใบแจ้งหนี้)
                        </span>
                      </div>
                    </div>
                    {renderBillsTable(group.items, 0, true)}
                  </Card>
                ))
              )}
            </div>
          ) : (
            <>
              {renderBillsTable(paginatedBills, currentPage * (pageSize === "all" ? 0 : (pageSize as number)))}

              {/* แถบการเปลี่ยนหน้า (Pagination) */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-muted/10 px-5 py-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    {pageSize === "all"
                      ? `แสดงใบแจ้งหนี้ทั้งหมด ${periodBills.length.toLocaleString()} ใบ`
                      : `แสดง ${currentPage * (pageSize as number) + 1} - ${Math.min((currentPage + 1) * (pageSize as number), periodBills.length)} จาก ${periodBills.length.toLocaleString()} ใบ`}
                  </span>
                  <span className="text-muted-foreground/40">|</span>
                  <div className="flex items-center gap-1">
                    <span>แถวต่อหน้า:</span>
                    {(["25", "50", "100", "all"] as const).map((ps) => {
                      const val = ps === "all" ? "all" : Number(ps);
                      const active = pageSize === val;
                      return (
                        <Button
                          key={ps}
                          variant={active ? "secondary" : "ghost"}
                          size="sm"
                          className={cn("h-6 px-2 text-xs", active && "font-bold shadow-xs")}
                          onClick={() => {
                            setPageSize(val);
                            setPage(0);
                          }}
                        >
                          {ps === "all" ? "ทั้งหมด" : ps}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {pageSize !== "all" && totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs cursor-pointer"
                      disabled={currentPage === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> ก่อนหน้า
                    </Button>
                    <span className="px-2 font-mono text-xs font-medium">
                      หน้า {currentPage + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs cursor-pointer"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      ถัดไป <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* รายละเอียดบิล */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 border-b border-border">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2 flex-wrap">
              <span>ใบแจ้งหนี้ {bill?.no}</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-mono px-2 py-0.5",
                  bill?.type === "electric"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
                )}
              >
                {bill?.type === "electric" ? "⚡ Statement ค่าไฟฟ้า" : "💧 Statement ค่าน้ำประปา"}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {cust?.name} · {cust?.shop} · {bill?.type === "electric" ? `มิเตอร์ไฟ: ${cust?.elecMeter || "—"}` : `มาตรน้ำ: ${cust?.waterMeter || "—"}`}
            </DialogDescription>
          </DialogHeader>
          {bill ? (
            <div className="flex-1 space-y-4 overflow-y-auto pr-1 sm:pr-2 py-2">
              {(() => {
                const allArr = arrearsOf(
                  bill.customerId,
                  bill.type === "combined" ? undefined : bill.type,
                  bill.period,
                );
                const activeArr = getActiveArrears(bill.id, bill.customerId, bill.period);
                if (allArr.length === 0) return null;

                return (
                  <Card className="border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                          📌 เลือกงวดค้างชำระ{bill.type === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"}ที่ต้องการรวมในใบแจ้งหนี้ ({activeArr.length}/{allArr.length} เดือน)
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          กรณีต้องการชำระเฉพาะบางงวด สามารถเลือกหรือยกเลิกได้ ยอดรวมจะคำนวณใหม่ทันที
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setAllArrearsPeriods(bill.id, bill.customerId, true, bill.period)}
                        >
                          เลือกทั้งหมด
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setAllArrearsPeriods(bill.id, bill.customerId, false, bill.period)}
                        >
                          ไม่รวมยอดค้าง
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {allArr.map((a) => {
                        const isChecked = activeArr.some((x) => x.period === a.period);
                        return (
                          <label
                            key={a.period}
                            className={`flex cursor-pointer items-center justify-between rounded-md border p-2 text-xs transition ${
                              isChecked
                                ? "border-primary/40 bg-background font-medium shadow-xs"
                                : "border-border/60 bg-muted/30 opacity-70"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() =>
                                  toggleArrearsPeriod(bill.id, bill.customerId, a.period, bill.period)
                                }
                              />
                              <span>
                                งวด {periodLabel(a.period)} ({periodFullThai(a.period)})
                              </span>
                            </div>
                            <span className="font-mono text-destructive">฿{thb(a.amount)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </Card>
                );
              })()}

              <div className="flex justify-center w-full">
                <BillSheet
                  bill={bill}
                  customer={cust}
                  arrears={getActiveArrears(bill.id, bill.customerId, bill.period)}
                  reconnectFee={settings.penaltyDisconnectionFee}
                  bankInfo={settings}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="shrink-0 pt-3 border-t border-border flex flex-row items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpenId(null)}>
              ปิด
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintBills([bill!])}
              >
                <Printer className="mr-1 h-3.5 w-3.5" /> พิมพ์ใบแจ้งหนี้ ({cust?.name})
              </Button>
              <Button
                size="sm"
                className={LINE_BTN}
                disabled={!canSend || bill?.status === "paid"}
                onClick={() => setLineSendBillId(bill!.id)}
                title={
                  bill?.status === "paid"
                    ? "ชำระเงินแล้ว — ไม่สามารถส่งบิลได้"
                    : "ส่งบิลผ่าน Line รายบุคคล"
                }
              >
                <Send className="mr-1 h-3.5 w-3.5" /> ส่งบิลผ่าน Line (รายบุคคล)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: ส่งใบแจ้งหนี้ผ่าน LINE รายบุคคล */}
      <Dialog
        open={!!lineSendBillId}
        onOpenChange={(o) => {
          if (!o) setLineSendBillId(null);
        }}
      >
        <DialogContent className="max-w-xl">
          {(() => {
            const sendBillObj = bills.find((b) => b.id === lineSendBillId);
            if (!sendBillObj) return null;
            const sendCust = customerOf(sendBillObj.customerId);
            const sendArrears = sendCust
              ? getActiveArrears(sendBillObj.id, sendCust.id, sendBillObj.period)
              : [];
            const totalArrearsAmount = sendArrears.reduce((sum, a) => sum + a.amount, 0);
            const sendGrandTotal = (sendBillObj.total || 0) + totalArrearsAmount;
            const sendHistory = sendsOf(sendBillObj.id);
            const divisionLabel = sendBillObj.type === "water" ? "ค่าน้ำประปา" : "ค่าไฟฟ้า";
            const meterNo = sendBillObj.type === "water" ? sendCust?.waterMeter : sendCust?.elecMeter;

            const handleSendLine = () => {
              sendBill(sendBillObj.id);
              setLineSendBillId(null);
            };

            const handleCopyMessage = () => {
              const text = `🏢 แจ้งยอด${divisionLabel} กรมช่างโยธาทหารอากาศ (ชย.ทอ.)
━━━━━━━━━━━━━━━━━━
👤 ผู้ประกอบการ: ${sendCust?.name || "ผู้ประกอบการ"} (${sendCust?.shop || "ไม่มีชื่อร้าน"})
🆔 รหัสผู้ประกอบการ: ${sendCust?.code || "—"}
${sendBillObj.type === "water" ? "💧 เลขมาตรวัดน้ำ" : "⚡ เลขมิเตอร์ไฟฟ้า"}: ${meterNo || "—"}
📅 ประจำงวด: ${periodFullThai(sendBillObj.period)} (งวด ${periodLabel(sendBillObj.period)})
📄 เลขที่ใบแจ้งหนี้: ${sendBillObj.no}
━━━━━━━━━━━━━━━━━━
💵 ยอดงวดปัจจุบัน: ฿${thb(sendBillObj.total)}
${totalArrearsAmount > 0 ? `⚠️ ยอดค้างชำระสะสม (${sendArrears.length} งวด): ฿${thb(totalArrearsAmount)}\n` : ""}💰 รวมยอดที่ต้องชำระทั้งสิ้น: ฿${thb(sendGrandTotal)}
⏰ กำหนดชำระภายในวันที่: ${settings.dueDayOffset || 25} ${periodFullThai(sendBillObj.period)}
━━━━━━━━━━━━━━━━━━
🏦 ช่องทางชำระเงิน:
• ธนาคาร: ${settings.bankName || "ทหารไทยธนชาต (TTB)"}
• เลขที่บัญชี: ${settings.bankAccountNo || "057-1-07053-1"}
• ชื่อบัญชี: ${settings.bankAccountName || "เงินนอกงบประมาณ ชย.ทอ."}
• หรือสแกน QR Code ในใบแจ้งหนี้
📌 ชำระแล้วโปรดส่งภาพสลิปกลับเข้ามาเพื่อออกใบเสร็จรับเงิน`;
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(text);
                toast.success("คัดลอกข้อความแจ้งหนี้สำหรับส่ง Line เรียบร้อยแล้ว");
              }
            };

            const handleShareLine = () => {
              const text = `🏢 แจ้งยอด${divisionLabel} กรมช่างโยธาทหารอากาศ\n👤 ผู้ประกอบการ: ${sendCust?.name || ""}\n📅 งวด ${periodLabel(sendBillObj.period)} (${sendBillObj.no})\n💰 ยอดรวมทั้งสิ้น: ฿${thb(sendGrandTotal)}${totalArrearsAmount > 0 ? ` (งวดนี้ ฿${thb(sendBillObj.total)} + ค้าง ฿${thb(totalArrearsAmount)})` : ""}\n⏰ ชำระภายในวันที่ ${settings.dueDayOffset || 25} ${periodFullThai(sendBillObj.period)}\n🏦 บัญชี ${settings.bankName || "TTB"} ${settings.bankAccountNo || "057-1-07053-1"} (${settings.bankAccountName || "เงินนอกงบประมาณ ชย.ทอ."})`;
              const url = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
              window.open(url, "_blank");
            };

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#06C755] text-white shadow-xs">
                      <Send className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <DialogTitle className="text-base sm:text-lg">
                        ส่งใบแจ้งหนี้ผ่าน LINE
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        แชร์ข้อความแจ้งยอดและส่งลิงก์ใบแจ้งหนี้ตรงไปยังผู้ประกอบการผ่าน LINE
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-3.5">
                  {/* Customer Info Card */}
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{sendCust?.name}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {sendCust?.code}
                        </Badge>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        งวด {periodLabel(sendBillObj.period)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1.5 border-t border-border/50">
                      <p>ร้านค้า: <span className="font-medium text-foreground">{sendCust?.shop || "—"}</span></p>
                      <p>เบอร์โทร: <span className="font-medium font-mono text-foreground">{sendCust?.phone || "—"}</span></p>
                      <p>{sendBillObj.type === "water" ? "💧 มาตรวัดน้ำ" : "⚡ มิเตอร์ไฟ"}: <span className="font-medium font-mono text-foreground">{meterNo || "—"}</span></p>
                      <p>เลขที่ใบแจ้งหนี้: <span className="font-medium font-mono text-foreground">{sendBillObj.no}</span></p>
                    </div>
                  </div>

                  {/* LINE Sending Action Bar */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5 text-primary" /> ช่องทางส่งข้อความบิล:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShareLine}
                        className="h-10 text-xs text-[#06C755] hover:text-[#06C755] hover:bg-[#06C755]/10 border-[#06C755]/40 flex items-center justify-center gap-2 font-bold shadow-2xs"
                      >
                        <ExternalLink className="h-4 w-4" /> 🚀 แชร์ไปที่ LINE App
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyMessage}
                        className="h-10 text-xs flex items-center justify-center gap-2 font-semibold shadow-2xs"
                      >
                        <Copy className="h-4 w-4" /> 📋 คัดลอกข้อความบิล
                      </Button>
                    </div>
                  </div>

                  {/* LINE Message Preview Card */}
                  <div className="rounded-xl border border-[#06C755]/30 bg-[#06C755]/5 p-3.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-[#06C755]/20 pb-2">
                      <span className="text-[11px] font-semibold text-[#06C755] flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-[#06C755] animate-pulse" />
                        ตัวอย่างข้อความแจ้งเตือนใน LINE ผู้ประกอบการ
                      </span>
                    </div>

                    <div className="rounded-lg bg-card border border-border p-3 space-y-2 text-xs shadow-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-foreground">
                          🔔 ใบแจ้งหนี้{divisionLabel} · กรมช่างโยธาทหารอากาศ
                        </p>
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                          งวด {periodLabel(sendBillObj.period)}
                        </Badge>
                      </div>

                      <div className="bg-muted/50 rounded p-2 text-center space-y-0.5">
                        <p className="text-[11px] text-muted-foreground">ยอดรวมที่ต้องชำระทั้งสิ้น</p>
                        <p className="text-xl font-bold font-display text-primary">
                          ฿{thb(sendGrandTotal)}
                        </p>
                        {totalArrearsAmount > 0 ? (
                          <p className="text-[10px] text-destructive">
                            (งวดนี้ ฿{thb(sendBillObj.total)} + ยอดค้าง {sendArrears.length} เดือน ฿{thb(totalArrearsAmount)})
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <p>• ผู้ประกอบการ: <strong className="text-foreground">{sendCust?.name}</strong> ({sendCust?.shop})</p>
                        <p>• เลขที่ใบแจ้งหนี้: <span className="font-mono text-foreground font-semibold">{sendBillObj.no}</span></p>
                        <p>• กำหนดชำระภายใน: <strong className="text-destructive font-medium">วันที่ {settings.dueDayOffset || 25} {periodFullThai(sendBillObj.period)}</strong></p>
                        <p>• บัญชีโอน: <strong className="text-foreground">{settings.bankName || "TTB"} {settings.bankAccountNo || "057-1-07053-1"}</strong> ({settings.bankAccountName || "เงินนอกงบประมาณ ชย.ทอ."})</p>
                      </div>

                      <div className="pt-1.5 border-t border-border flex items-center justify-center">
                        <span className="text-[11px] font-semibold text-primary underline">
                          [ 📄 เปิดดูใบแจ้งหนี้ฉบับเต็ม & QR Code ชำระเงิน ]
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Send History status */}
                  <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {sendHistory.length > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ ส่งให้ลูกค้ารายนี้แล้ว {sendHistory.length} ครั้ง (ล่าสุด: {sendHistory[0]?.at})
                        </span>
                      ) : (
                        <span>ยังไม่เคยส่งบิลนี้ผ่าน LINE</span>
                      )}
                    </span>
                  </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 sm:justify-end">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setLineSendBillId(null)} className="text-xs h-8">
                      ปิด
                    </Button>
                    <Button
                      size="sm"
                      className={cn(LINE_BTN, "text-xs h-9 px-4 shadow-sm font-bold gap-1.5")}
                      disabled={sendBillObj.status === "paid"}
                      onClick={handleSendLine}
                    >
                      <Send className="h-4 w-4" />
                      <span>⚡ บันทึกการส่งบิล LINE</span>
                    </Button>
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      <Dialog open={!!printBills} onOpenChange={(o) => !o && setPrintBills(null)}>
        <DialogContent className="max-w-3xl lg:max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="shrink-0 pb-2 border-b border-border">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              <span>
                {printBills && printBills.length === 1 ? (
                  <>
                    ตัวอย่างก่อนพิมพ์ · ใบแจ้งหนี้ {printBills[0]?.no} ({customerOf(printBills[0]?.customerId ?? "")?.name})
                  </>
                ) : (
                  <>
                    ตัวอย่างก่อนพิมพ์ · ใบแจ้งหนี้{mode === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"}งวด {periodLabel(period)} ({printBills?.length ?? 0} ใบ)
                  </>
                )}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {printBills && printBills.length === 1 ? (
                <>
                  พิมพ์ใบแจ้งหนี้เฉพาะราย: {customerOf(printBills[0]?.customerId ?? "")?.name} · {customerOf(printBills[0]?.customerId ?? "")?.shop} · {mode === "electric" ? `มิเตอร์ไฟ: ${customerOf(printBills[0]?.customerId ?? "")?.elecMeter || "—"}` : `มาตรน้ำ: ${customerOf(printBills[0]?.customerId ?? "")?.waterMeter || "—"}`}
                </>
              ) : (
                <>พิมพ์ใบแจ้งหนี้{mode === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"}ทั้งหมดในครั้งเดียว — ขนาดพอดี 1 ใบต่อ 1 หน้ากระดาษ A4</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-6 overflow-y-auto pr-1 sm:pr-2 py-3 bg-muted/20 rounded-xl p-2 sm:p-3">
            {printBills?.map((b) => (
              <div key={b.id} className="flex justify-center w-full">
                <BillSheet
                  bill={b}
                  customer={customerOf(b.customerId)}
                  arrears={getActiveArrears(b.id, b.customerId, b.period)}
                  reconnectFee={settings.penaltyDisconnectionFee}
                  bankInfo={settings}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="shrink-0 pt-3 border-t border-border flex flex-row items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setPrintBills(null)}>
              ปิด
            </Button>
            <Button size="sm" onClick={() => window.print()} className="font-semibold">
              <Printer className="mr-1.5 h-4 w-4" />{" "}
              {printBills && printBills.length === 1
                ? `สั่งพิมพ์ (${customerOf(printBills[0]?.customerId ?? "")?.name})`
                : `สั่งพิมพ์ทั้งหมด (${printBills?.length ?? 0} ใบ)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Body Portal สำหรับการพิมพ์จริง */}
      {typeof document !== "undefined" && printBills && printBills.length > 0
        ? createPortal(
            <div id="print-root">
              {printBills.map((b) => (
                <BillSheet
                  key={b.id}
                  bill={b}
                  customer={customerOf(b.customerId)}
                  arrears={getActiveArrears(b.id, b.customerId, b.period)}
                  reconnectFee={settings.penaltyDisconnectionFee}
                  bankInfo={settings}
                />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
