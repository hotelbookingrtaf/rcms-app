import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Zap,
  Pencil,
  Check,
  X,
  Trash2,
  Printer,
  Download,
  Filter,
  Sparkles,
  Tag,
  Layers,
  LayoutGrid,
  List as ListIcon,
  RotateCcw,
  Gauge,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  useRcms,
  thb,
  periodLabel,
  periodFullThai,
  calculateElectricBill,
  type ElectricCalculationBreakdown,
} from "@/lib/rcms-store";
import {
  getCustomerMeterCategory,
  getMeterPrefix,
  type MeterCategoryFilter,
} from "@/lib/customer-matching";
import {
  classifyWorkbook,
  parseReadingWorkbook,
  validateWorkbookFile,
  workbookFingerprint,
} from "@/lib/excel-import";
import { cn } from "@/lib/utils";
import type { Division, Reading } from "@/lib/rcms-types";
import { ReadingSheet } from "@/components/rcms/ReadingSheet";

interface ReadingsSearch {
  division?: Division | undefined;
  period?: string | undefined;
}

export const Route = createFileRoute("/readings")({
  validateSearch: (search: Record<string, unknown>): ReadingsSearch => {
    return {
      division: typeof search["division"] === "string" ? (search["division"] as Division) : undefined,
      period: typeof search["period"] === "string" ? (search["period"] as string) : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "ตรวจสอบหน่วยใช้ล่าสุด · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "ตรวจสอบและแก้ไขหน่วยใช้ไฟฟ้าและน้ำประปาล่าสุด พร้อมคำนวณค่าไฟฟ้าตามแบบฟอร์มกองช่างโยธา ทอ.",
      },
      { property: "og:title", content: "ตรวจสอบหน่วยใช้ล่าสุด · RCMS" },
      {
        name: "description",
        content: "ตรวจสอบหน่วยใช้ไฟฟ้า/ประปารายผู้ประกอบการก่อนออกบิล",
      },
    ],
  }),
  component: Readings,
});

/** คำนวณช่วงวันที่การใช้ไฟ/น้ำของรอบบิล (เช่น งวด 2569-08 -> ระหว่างวันที่ 1 ก.ค.69 - 31 ก.ค.69) */
function getPeriodUsageDateRange(periodStr: string): string {
  if (!periodStr) return "-";
  const parts = periodStr.split("-");
  const yearNum = parseInt(parts[0] || "2569", 10);
  const monthNum = parseInt(parts[1] || "8", 10);

  let prevMonth = monthNum - 1;
  let prevYear = yearNum;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const thaiShortMonths = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const mName = thaiShortMonths[prevMonth - 1] || "ก.ค.";
  const yy = String(prevYear).slice(-2);

  let lastDay = 30;
  if ([1, 3, 5, 7, 8, 10, 12].includes(prevMonth)) {
    lastDay = 31;
  } else if (prevMonth === 2) {
    const ceYear = prevYear > 2400 ? prevYear - 543 : prevYear;
    const isLeap = (ceYear % 4 === 0 && ceYear % 100 !== 0) || (ceYear % 400 === 0);
    lastDay = isLeap ? 29 : 28;
  }

  return `1 ${mName}${yy} - ${lastDay} ${mName}${yy}`;
}

function Readings() {
  const search = Route.useSearch();
  const {
    readings,
    customers,
    period,
    setPeriod,
    setReading,
    settings,
    importReadings,
    clearReadings,
    resetReadings,
  } = useRcms();
  const [div, setDiv] = useState<Division>(search.division || "electric");

  useEffect(() => {
    if (search.division) {
      setDiv(search.division);
    } else {
      const hasElec = readings.some((r) => r.period === period && r.division === "electric");
      const hasWater = readings.some((r) => r.period === period && r.division === "water");
      if (!hasElec && hasWater) {
        setDiv("water");
      }
    }
  }, [search.division, readings, period]);

  useEffect(() => {
    if (search.period && search.period !== period) {
      setPeriod(search.period);
    }
  }, [search.period, period, setPeriod]);

  // ตัวแปรสถานะตัวกรองตามรูปที่แนบ
  const [q, setQ] = useState("");
  const [meterCatFilter, setMeterCatFilter] = useState<MeterCategoryFilter>("all");
  const [meterSeriesFilter, setMeterSeriesFilter] = useState<string>("all");
  const [readingStatusFilter, setReadingStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grouped">("table");
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(0);

  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<
    Array<{
      name?: string;
      shop?: string;
      meter?: string;
      prev?: number;
      curr?: number;
      used?: number;
      amount?: number;
    }> | null
  >(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearScope, setClearScope] = useState<"current" | "all">("current");

  // ตัวแปรสำหรับระบบพิมพ์รายงาน A4 แนวนอน
  const [printOpen, setPrintOpen] = useState(false);
  const [printSeries, setPrintSeries] = useState<string>("all");

  const handleStartEdit = (readingId: string, currentVal: number) => {
    setEditingId(readingId);
    setEditValue(String(currentVal));
  };

  const handleSaveEdit = (r: Reading, prevVal: number) => {
    const num = Number(editValue);
    if (isNaN(num) || editValue.trim() === "") {
      toast.error("กรุณาระบุตัวเลขที่ถูกต้อง");
      return;
    }
    if (num < prevVal) {
      toast.error(`เลขจดครั้งหลัง (${num}) ต้องไม่น้อยกว่าเลขจดครั้งก่อน (${prevVal})`);
      return;
    }
    setReading(r.customerId, r.division, period, num);
    setEditingId(null);
    const usage = num - prevVal;
    if (r.division === "electric") {
      const calc = calculateElectricBill(usage, settings);
      toast.success(
        `บันทึกเลขจดครั้งหลัง (${num}) สำเร็จ — หน่วยใช้ ${usage.toLocaleString()} หน่วย · รวมชำระ ฿${thb(calc.totalDue)}`,
      );
    } else {
      toast.success(`บันทึกเลขจดครั้งหลัง (${num}) สำเร็จ — หน่วยใช้ ${usage.toLocaleString()} หน่วย`);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  // หมวดหมู่และสถิติมิเตอร์ทั้งหมด
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

  const rows = useMemo(
    () => readings.filter((r) => r.period === period && r.division === div),
    [readings, period, div],
  );

  const isFiltered =
    q.trim() !== "" ||
    meterCatFilter !== "all" ||
    meterSeriesFilter !== "all" ||
    readingStatusFilter !== "all";

  const resetFilters = () => {
    setQ("");
    setMeterCatFilter("all");
    setMeterSeriesFilter("all");
    setReadingStatusFilter("all");
    setPage(0);
  };

  // กรองรายการจดมิเตอร์ตามตัวกรองทั้งหมด
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return readings
      .filter((r) => r.period === period)
      .filter((r) => {
        const c = customers.find((x) => x.id === r.customerId);
        const cat = c ? getCustomerMeterCategory(c) : null;
        const meter = r.division === "electric" ? c?.elecMeter : c?.waterMeter;
        const usage = Math.max(0, r.curr - r.prev);

        // 1. กรองตามหมวดหมู่มิเตอร์ (Tab Buttons)
        if (meterCatFilter === "electric") {
          if (r.division !== "electric") return false;
        } else if (meterCatFilter === "water") {
          if (r.division !== "water") return false;
        } else if (meterCatFilter === "both") {
          if (cat?.type !== "both") return false;
        } else if (meterCatFilter === "none") {
          if (cat?.type !== "none") return false;
        } else {
          // ถ้าเป็น 'all' ให้แสดงตามแถบบริการที่เลือก (div)
          if (r.division !== div) return false;
        }

        // 2. กรองตามหมวดรหัสมิเตอร์ (Dropdown Series)
        if (meterSeriesFilter !== "all") {
          if (!meter || !meter.startsWith(meterSeriesFilter)) return false;
        }

        // 3. กรองตามสถานะการใช้งาน
        if (readingStatusFilter === "active" && usage <= 0) return false;
        if (readingStatusFilter === "zero" && usage !== 0) return false;
        if (readingStatusFilter === "warning" && r.validationState === "green") return false;

        // 4. กรองตามคำค้นหา
        if (!term) return true;
        const searchStr = `${c?.code ?? ""} ${c?.name ?? ""} ${c?.shop ?? ""} ${c?.phone ?? ""} ${c?.lineId ?? ""} ${c?.elecMeter ?? ""} ${c?.waterMeter ?? ""} ${meter ?? ""}`.toLowerCase();
        return searchStr.includes(term);
      });
  }, [readings, period, div, customers, meterCatFilter, meterSeriesFilter, readingStatusFilter, q]);

  const effectivePageSize = pageSize === -1 ? Math.max(1, filtered.length) : pageSize;
  const pages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
  const current = Math.min(page, pages - 1);
  const view = pageSize === -1 ? filtered : filtered.slice(current * pageSize, (current + 1) * pageSize);

  // คำนวณยอดรวมของตารางที่กรอง
  const tableTotals = useMemo(() => {
    let totalUnits = 0;
    let totalBaseEnergy = 0;
    let totalFt = 0;
    let totalService = 0;
    let totalSubtotal = 0;
    let totalVat = 0;
    let totalAmountDue = 0;

    filtered.forEach((r) => {
      const usage = Math.max(0, r.curr - r.prev);
      totalUnits += usage;

      if (r.division === "electric") {
        const calc = calculateElectricBill(usage, settings);
        totalBaseEnergy += calc.baseEnergy;
        totalFt += calc.ftAmount;
        totalService += calc.serviceFee;
        totalSubtotal += calc.subtotal;
        totalVat += calc.vatAmount;
        totalAmountDue += calc.totalDue;
      } else {
        const svc = settings.serviceFee ?? 33.29;
        const rate = settings.waterRate ?? 9.5;
        const base = usage > 0 ? usage * rate : svc;
        const vat = base * 0.07;
        totalBaseEnergy += base;
        totalService += svc;
        totalSubtotal += base;
        totalVat += vat;
        totalAmountDue += base + vat;
      }
    });

    return {
      totalUnits,
      totalBaseEnergy,
      totalFt,
      totalService,
      totalSubtotal,
      totalVat,
      totalAmountDue,
    };
  }, [filtered, settings]);

  const totalOverallUnits = rows.reduce((s, r) => s + Math.max(0, r.curr - r.prev), 0);
  const zeroCount = rows.filter((r) => r.curr - r.prev === 0).length;
  const activeCount = rows.filter((r) => r.curr - r.prev > 0).length;
  const exceptions = rows.filter((reading) => reading.validationState !== "green").length;

  // รายการที่เลือกพิมพ์ตามตัวกรองหรือหมวดมิเตอร์
  const printableItems = useMemo(() => {
    if (printSeries === "all") return filtered;
    return filtered.filter((r) => {
      const c = customers.find((x) => x.id === r.customerId);
      const m = r.division === "electric" ? c?.elecMeter : c?.waterMeter;
      return m?.startsWith(printSeries);
    });
  }, [filtered, printSeries, customers]);

  const handlePrint = () => {
    setPrintOpen(true);
  };

  const handleExecutePrint = () => {
    // กำหนดขนาดหน้ากระดาษ A4 แนวนอนสำหรับพิมพ์
    let styleTag = document.getElementById("print-page-style") as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "print-page-style";
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = "@page { size: A4 landscape !important; margin: 8mm 10mm !important; }";

    // หน่วงเวลาเล็กน้อยเพื่อให้ DOM Portal พร้อม แล้วสั่งพิมพ์
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // การจัดกลุ่มข้อมูลสำหรับมุมมอง "แยกหมวดหมู่มิเตอร์"
  const groupedSections = useMemo(() => {
    if (viewMode !== "grouped") return [];
    const groups: {
      key: string;
      title: string;
      series?: string;
      badgeText: string;
      badgeCls: string;
      items: Reading[];
    }[] = [];

    // 1. หมวดมิเตอร์ไฟฟ้า
    meterStats.elecSeriesList.forEach((es) => {
      const items = filtered.filter((r) => {
        const c = customers.find((x) => x.id === r.customerId);
        const m = r.division === "electric" ? c?.elecMeter : c?.waterMeter;
        return m?.startsWith(es.series);
      });
      if (items.length > 0) {
        groups.push({
          key: `elec-${es.series}`,
          title: `หมวดมิเตอร์ไฟฟ้า: หมวด ${es.series}`,
          series: es.series,
          badgeText: `⚡ ไฟฟ้า (หมวด ${es.series})`,
          badgeCls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
          items,
        });
      }
    });

    // 2. หมวดมาตรวัดน้ำประปา
    meterStats.waterSeriesList.forEach((ws) => {
      const items = filtered.filter((r) => {
        const c = customers.find((x) => x.id === r.customerId);
        const m = r.division === "water" ? c?.waterMeter : c?.elecMeter;
        return m?.startsWith(ws.series);
      });
      if (items.length > 0) {
        groups.push({
          key: `water-${ws.series}`,
          title: `หมวดมาตรวัดน้ำประปา: หมวด ${ws.series}`,
          series: ws.series,
          badgeText: `💧 น้ำประปา (หมวด ${ws.series})`,
          badgeCls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
          items,
        });
      }
    });

    // 3. หมวดอื่นๆ
    const otherItems = filtered.filter(
      (r) => !groups.some((g) => g.items.some((item) => item.id === r.id)),
    );
    if (otherItems.length > 0) {
      groups.push({
        key: "other-readings",
        title: "มิเตอร์หมวดอื่นๆ / ทั่วไป",
        badgeText: "หมวดอื่นๆ",
        badgeCls: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400",
        items: otherItems,
      });
    }

    return groups;
  }, [viewMode, filtered, meterStats, customers]);

  // ฟังก์ชันเรนเดอร์ตารางคำนวณ 14 คอลัมน์
  const renderReadingsTable = (items: Reading[], offsetIdx: number = 0, isGroupTable: boolean = false) => {
    let subUnits = 0;
    let subBase = 0;
    let subFt = 0;
    let subSvc = 0;
    let subSubtotal = 0;
    let subVat = 0;
    let subTotal = 0;

    return (
      <div className="overflow-x-auto">
        <Table className="w-full border-collapse text-xs print:text-[10px]">
          <TableHeader className="sticky top-0 z-10 shadow-xs">
            {/* ชั้นที่ 1: หมวดหมู่กลุ่มข้อมูล (2-Tier Header) */}
            <TableRow className="border-b bg-muted/60 text-xs font-bold text-foreground print:bg-gray-200">
              <TableHead
                colSpan={5}
                className="py-2 px-3 text-center font-bold border-r border-border/70 text-foreground print:text-black tracking-wide bg-muted/70"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>ข้อมูลผู้ประกอบการและมิเตอร์</span>
                </div>
              </TableHead>
              <TableHead
                colSpan={3}
                className="py-2 px-3 text-center font-bold border-r border-border/70 text-foreground print:text-black tracking-wide bg-blue-500/10 dark:bg-blue-950/30"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>ข้อมูลการจดเลขมิเตอร์</span>
                </div>
              </TableHead>
              <TableHead
                colSpan={6}
                className="py-2 px-3 text-center font-bold text-foreground print:text-black tracking-wide bg-emerald-500/10 dark:bg-emerald-950/30"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>รายละเอียดการคำนวณค่าบริการ (บาท)</span>
                </div>
              </TableHead>
            </TableRow>

            {/* ชั้นที่ 2: หัวคอลัมน์ย่อยแต่ละรายการ */}
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b text-xs print:bg-gray-100">
              {/* 1. ลำดับ */}
              <TableHead className="w-12 py-2.5 text-center font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap">
                ลำดับ
              </TableHead>

              {/* 2. ผู้ใช้ไฟฟ้า / น้ำประปา */}
              <TableHead className="min-w-[160px] py-2.5 px-3 font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap">
                {div === "electric" ? "ผู้ใช้ไฟฟ้า" : "ผู้ใช้น้ำประปา"}
              </TableHead>

              {/* 3. สถานที่ */}
              <TableHead className="min-w-[180px] py-2.5 px-3 font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap">
                สถานที่ / ร้านค้า
              </TableHead>

              {/* 4. หมายเลขมิเตอร์ */}
              <TableHead className="min-w-[125px] py-2.5 px-3 text-center font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap">
                หมายเลขมิเตอร์
              </TableHead>

              {/* 5. ประเภทมิเตอร์ */}
              <TableHead className="w-16 py-2.5 text-center font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap">
                ประเภท
              </TableHead>

              {/* 6. จดครั้งก่อน */}
              <TableHead className="min-w-[85px] py-2.5 px-3 text-right font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap bg-blue-500/5 dark:bg-blue-950/20">
                จดครั้งก่อน
              </TableHead>

              {/* 7. จดครั้งหลัง (แก้ไขได้) */}
              <TableHead className="min-w-[110px] py-2.5 px-3 text-right font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap bg-blue-500/15 dark:bg-blue-900/30">
                <div className="flex items-center justify-end gap-1">
                  <span>จดครั้งหลัง</span>
                  <span className="text-[10px] font-normal text-primary print:hidden">(แก้ไข)</span>
                </div>
              </TableHead>

              {/* 8. หน่วยที่ใช้ */}
              <TableHead className="min-w-[90px] py-2.5 px-3 text-right font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap bg-blue-500/5 dark:bg-blue-950/20">
                หน่วยที่ใช้
              </TableHead>

              {/* 9. ค่าพลังงาน / เป็นเงิน บาท */}
              <TableHead className="min-w-[95px] py-2.5 px-3 text-right font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap bg-emerald-500/5 dark:bg-emerald-950/20">
                ค่าพลังงาน
              </TableHead>

              {/* 10. ค่า FT บาท */}
              <TableHead className="min-w-[80px] py-2.5 px-3 text-right font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap bg-emerald-500/5 dark:bg-emerald-950/20">
                {div === "electric" ? "ค่า FT" : "—"}
              </TableHead>

              {/* 11. ค่าบริการ บาท */}
              <TableHead className="min-w-[80px] py-2.5 px-3 text-right font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap bg-emerald-500/5 dark:bg-emerald-950/20">
                ค่าบริการ
              </TableHead>

              {/* 12. รวมเป็นเงิน บาท */}
              <TableHead className="min-w-[95px] py-2.5 px-3 text-right font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap bg-emerald-500/5 dark:bg-emerald-950/20">
                รวมเป็นเงิน
              </TableHead>

              {/* 13. ภาษี บาท */}
              <TableHead className="min-w-[80px] py-2.5 px-3 text-right font-bold border-r border-border/60 text-foreground print:text-black whitespace-nowrap bg-emerald-500/5 dark:bg-emerald-950/20">
                ภาษี (7%)
              </TableHead>

              {/* 14. จำนวนเงินที่ต้องชำระ */}
              <TableHead className="min-w-[125px] py-2.5 px-3 text-right font-bold text-foreground print:text-black whitespace-nowrap bg-emerald-500/15 dark:bg-emerald-900/40">
                จำนวนเงินที่ต้องชำระ
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r, index) => {
              const c = customers.find((x) => x.id === r.customerId);
              const rowNumber = offsetIdx + index + 1;
              const usage = Math.max(0, r.curr - r.prev);
              const isEditing = editingId === r.id;
              const meterNo = r.division === "electric" ? c?.elecMeter ?? "—" : c?.waterMeter ?? "—";
              const meterType = "2";

              let calc: ElectricCalculationBreakdown;
              if (r.division === "electric") {
                calc = calculateElectricBill(usage, settings);
              } else {
                const svc = settings.serviceFee ?? 33.29;
                const rate = settings.waterRate ?? 9.5;
                const base = usage > 0 ? usage * rate : svc;
                const vat = +(base * 0.07).toFixed(2);
                calc = {
                  units: usage,
                  baseEnergy: +base.toFixed(2),
                  ftAmount: 0,
                  serviceFee: svc,
                  subtotal: +base.toFixed(2),
                  vatAmount: vat,
                  totalDue: +(base + vat).toFixed(2),
                };
              }

              subUnits += usage;
              subBase += calc.baseEnergy;
              subFt += calc.ftAmount;
              subSvc += calc.serviceFee;
              subSubtotal += calc.subtotal;
              subVat += calc.vatAmount;
              subTotal += calc.totalDue;

              return (
                <TableRow
                  key={r.id}
                  className={cn(
                    "transition-colors hover:bg-muted/30 border-b",
                    isEditing && "bg-primary/5 dark:bg-primary/10",
                    usage === 0 && "bg-amber-500/5",
                  )}
                >
                  {/* 1. ลำดับ */}
                  <TableCell className="text-center font-mono border-r text-muted-foreground print:text-black">
                    {rowNumber}
                  </TableCell>

                  {/* 2. ผู้ใช้ไฟฟ้า / น้ำ */}
                  <TableCell className="font-medium border-r text-foreground print:text-black">
                    {c?.name ?? "ผู้ประกอบการ"}
                  </TableCell>

                  {/* 3. สถานที่ */}
                  <TableCell className="text-xs text-muted-foreground border-r print:text-black">
                    {c?.shop ?? "—"}
                  </TableCell>

                  {/* 4. หมายเลขมิเตอร์ */}
                  <TableCell className="font-mono text-xs font-semibold border-r text-center text-foreground print:text-black whitespace-nowrap">
                    {meterNo}
                  </TableCell>

                  {/* 5. ประเภทมิเตอร์ */}
                  <TableCell className="text-center font-mono text-xs border-r text-muted-foreground print:text-black">
                    {meterType}
                  </TableCell>

                  {/* 6. จดครั้งก่อน */}
                  <TableCell className="text-right font-mono border-r text-foreground print:text-black">
                    {r.prev}
                  </TableCell>

                  {/* 7. จดครั้งหลัง (Editable inline) */}
                  <TableCell
                    className={cn(
                      "text-right border-r relative",
                      isEditing ? "p-1 bg-background shadow-inner" : "cursor-pointer group hover:bg-primary/10",
                    )}
                    onClick={() => {
                      if (!isEditing) handleStartEdit(r.id, r.curr);
                    }}
                    title="คลิกเพื่อแก้ไขเลขจดครั้งหลัง"
                  >
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          autoFocus
                          min={r.prev}
                          className="h-7 w-24 text-right font-mono text-xs font-bold ring-2 ring-primary focus-visible:ring-primary"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(r, r.prev);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950"
                          title="บันทึก (Enter)"
                          onClick={() => handleSaveEdit(r, r.prev)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          title="ยกเลิก (Esc)"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-mono font-semibold text-foreground print:text-black">
                          {r.curr}
                        </span>
                        <Pencil className="h-3 w-3 text-muted-foreground/40 transition-colors group-hover:text-primary print:hidden" />
                      </div>
                    )}
                  </TableCell>

                  {/* 8. หน่วยที่ใช้ */}
                  <TableCell className="text-right font-mono font-bold border-r text-foreground print:text-black">
                    {usage.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>

                  {/* 9. เป็นเงิน บาท */}
                  <TableCell className="text-right font-mono border-r text-foreground print:text-black">
                    {thb(calc.baseEnergy)}
                  </TableCell>

                  {/* 10. ค่า FT บาท */}
                  <TableCell className="text-right font-mono border-r text-foreground print:text-black">
                    {r.division === "electric" ? thb(calc.ftAmount) : "—"}
                  </TableCell>

                  {/* 11. ค่าบริการ บาท */}
                  <TableCell className="text-right font-mono border-r text-foreground print:text-black">
                    {thb(calc.serviceFee)}
                  </TableCell>

                  {/* 12. รวมเป็นเงิน บาท */}
                  <TableCell className="text-right font-mono border-r text-foreground print:text-black">
                    {thb(calc.subtotal)}
                  </TableCell>

                  {/* 13. ภาษี บาท */}
                  <TableCell className="text-right font-mono border-r text-foreground print:text-black">
                    {thb(calc.vatAmount)}
                  </TableCell>

                  {/* 14. จำนวนเงินที่ต้องชำระ */}
                  <TableCell className="text-right font-mono font-bold text-primary dark:text-primary-foreground bg-primary/5 dark:bg-primary/10 print:text-black print:bg-transparent">
                    {thb(calc.totalDue)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>

          {/* แถบสรุปผลรวมด้านล่าง */}
          <tfoot>
            <tr className="border-t-2 border-border font-bold bg-muted/50 print:bg-gray-100 print:border-black">
              <TableCell colSpan={7} className="text-right border-r font-display text-xs sm:text-sm print:text-black">
                {isGroupTable ? "รวมหมวดนี้:" : `รวมทั้งสิ้น (${filtered.length} รายการ):`}
              </TableCell>
              <TableCell className="text-right font-mono border-r font-bold text-xs sm:text-sm text-foreground print:text-black">
                {subUnits.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right font-mono border-r text-xs text-foreground print:text-black">
                {thb(subBase)}
              </TableCell>
              <TableCell className="text-right font-mono border-r text-xs text-foreground print:text-black">
                {div === "electric" ? thb(subFt) : "—"}
              </TableCell>
              <TableCell className="text-right font-mono border-r text-xs text-foreground print:text-black">
                {thb(subSvc)}
              </TableCell>
              <TableCell className="text-right font-mono border-r text-xs text-foreground print:text-black">
                {thb(subSubtotal)}
              </TableCell>
              <TableCell className="text-right font-mono border-r text-xs text-foreground print:text-black">
                {thb(subVat)}
              </TableCell>
              <TableCell className="text-right font-mono font-bold text-sm sm:text-base text-primary dark:text-emerald-400 bg-primary/10 print:text-black print:bg-transparent">
                {thb(subTotal)}
              </TableCell>
            </tr>

            {!isGroupTable && (
              <tr className="border-t border-dashed bg-card print:border-black">
                <td colSpan={7} className="py-3 px-4 text-left text-xs text-muted-foreground print:text-black">
                  พิมพ์จากระบบ RCMS กรมช่างโยธาทหารอากาศ · ข้อมูลคำนวณถูกต้องตามระเบียบ ทอ.
                </td>
                <td className="py-3 text-right font-mono font-bold text-xs sm:text-sm border-r text-foreground print:text-black">
                  {tableTotals.totalUnits.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={5} className="py-3 text-right font-bold text-xs sm:text-sm pr-2 text-foreground print:text-black">
                  รวมเป็นเงิน
                </td>
                <td className="py-3 text-right font-mono font-extrabold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 pr-4 print:text-black">
                  {thb(tableTotals.totalAmountDue)}
                </td>
              </tr>
            )}
          </tfoot>
        </Table>
      </div>
    );
  };

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="ตรวจสอบหน่วยใช้ล่าสุด"
          desc={`งวด ${periodLabel(period)} (${periodFullThai(period)}) · ดึงข้อมูลอัตโนมัติทุกวันที่ ${settings.fetchDay} ของเดือน · ${rows.length} มิเตอร์`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shadow-sm"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" /> พิมพ์รายการคำนวณ
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={syncing}
                onClick={() => {
                  setSyncing(true);
                  toast.info("กำลังเชื่อมต่อ REST API ของกอง...");
                  setTimeout(() => {
                    resetReadings();
                    setSyncing(false);
                    toast.success(
                      `2-Way Sync สำเร็จ — ตรวจสอบและดึงข้อมูลหน่วยใช้เรียบร้อยแล้ว`,
                    );
                  }, 600);
                }}
              >
                <RefreshCw className={`mr-1 h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync API
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setClearScope("current");
                  setClearOpen(true);
                }}
                disabled={rows.length === 0 && readings.length === 0}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> ล้างข้อมูล
              </Button>
            </div>
          }
        />

        {/* สรุปภาพรวมด้านบน */}
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card className="shadow-sm border-l-4 border-l-primary">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">หน่วยใช้รวมในงวด {periodLabel(period)}</p>
              <p className="font-display text-2xl font-bold text-foreground">
                {totalOverallUnits.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} หน่วย
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                มีมิเตอร์ใช้งาน {activeCount} · หน่วยศูนย์ {zeroCount} เครื่อง
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">ยอดคำนวณรวมทั้งสิ้น</p>
              <p className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ฿{thb(tableTotals.totalAmountDue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                (ฐาน + FT + บริการ ฿33.29 + VAT 7%)
              </p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer shadow-sm border-l-4 border-l-amber-500 transition-colors hover:bg-muted/40"
            onClick={() => {
              setReadingStatusFilter(readingStatusFilter === "zero" ? "all" : "zero");
              setPage(0);
            }}
          >
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                การตรวจสอบ {readingStatusFilter === "zero" ? "(กำลังกรองหน่วยศูนย์)" : ""}
              </p>
              <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400">
                {exceptions} รายการเตือน
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                คลิกเพื่อ {readingStatusFilter === "zero" ? "แสดงทั้งหมด" : "กรองเฉพาะหน่วยศูนย์ (0)"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* แผงหมวดหมู่มิเตอร์ ค้นหา และตัวกรอง ตามรูปภาพที่ผู้ใช้แนบ */}
      <Card className="mb-4 print:hidden border-border/70 shadow-sm rounded-2xl bg-card">
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
                ทั้งหมด ({customers.length})
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
                  setDiv("electric");
                  setPage(0);
                }}
              >
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> หมวดไฟฟ้า ({meterStats.elecCount})
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
                  setDiv("water");
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
                placeholder="ค้นหาชื่อผู้ประกอบการ, ร้านค้า, รหัส, เบอร์โทร, เลขมิเตอร์..."
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
                value={readingStatusFilter}
                onValueChange={(v) => {
                  setReadingStatusFilter(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="text-xs rounded-xl h-10 border-border/80 bg-background">
                  <SelectValue placeholder="สถานะทั้งหมด" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                  <SelectItem value="active">
                    ⚡ มีการใช้ไฟฟ้า (&gt; 0 หน่วย)
                  </SelectItem>
                  <SelectItem value="zero">
                    ⚪ ไม่มีการใช้ (0 หน่วย)
                  </SelectItem>
                  {exceptions > 0 && (
                    <SelectItem value="warning">
                      ⚠️ รายการที่ต้องตรวจสอบ ({exceptions})
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* แถวที่ 3: สรุปผลการค้นหา และ ตัวเลือกจำนวนแถว */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>ผลการค้นหา:</span>
              <span className="font-mono font-bold text-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/60 text-xs">
                {filtered.length} ราย
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
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
              >
                <option value={25}>25 รายการ/หน้า</option>
                <option value={50}>50 รายการ/หน้า</option>
                <option value={100}>100 รายการ/หน้า</option>
                <option value={-1}>แสดงทั้งหมด ({filtered.length})</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* บัตรตารางหลัก: รูปแบบตรงตามใบคำนวณ ทอ. */}
      <Card className="overflow-hidden border shadow-sm print:border-none print:shadow-none print:m-0">
        {/* หัวกระดาษราชการ ทอ. */}
        <div className="border-b bg-muted/20 px-4 py-4 text-center sm:px-6 print:bg-transparent print:p-0 print:border-b-2 print:border-black">
          <div className="flex flex-col items-center justify-center gap-1">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl print:text-xl print:text-black flex items-center justify-center gap-2 flex-wrap">
              <span>รายการคำนวณ{div === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"}</span>
              <span className="text-primary font-bold">ประจำเดือน {periodLabel(period)}</span>
              {meterSeriesFilter !== "all" && (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-mono text-xs">
                  หมวด {meterSeriesFilter}
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground print:text-black">
              กองช่างโยธา กรมช่างโยธาทหารอากาศ · ตารางคำนวณหน่วยใช้และยอดเรียกเก็บประจำงวด
            </p>
          </div>
        </div>

        {/* เนื้อหาตาราง: มุมมองรวม vs แยกหมวดหมู่ */}
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              {rows.length === 0 ? (
                <>
                  <div className="mb-3 rounded-full bg-muted p-4">
                    <Trash2 className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-base font-semibold">
                    ไม่มีข้อมูลเลขจดมิเตอร์{div === "electric" ? "ไฟฟ้า" : "น้ำประปา"}ในงวด {periodLabel(period)}
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    สามารถนำเข้าข้อมูลจากไฟล์ Excel หรือระบบจัดเก็บรายได้
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button asChild size="sm">
                      <Link to="/import">
                        <FileSpreadsheet className="mr-1.5 h-4 w-4" /> ไปหน้านำเข้า Excel
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 rounded-full bg-muted p-3">
                    <Search className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <h3 className="text-sm font-semibold">ไม่พบรายการที่ตรงกับตัวกรอง</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ลองปรับเปลี่ยนคำค้นหา หรือเลือกแสดงหมวดมิเตอร์ทั้งหมด
                  </p>
                  {isFiltered && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 text-xs"
                      onClick={resetFilters}
                    >
                      ล้างตัวกรองทั้งหมด
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : viewMode === "grouped" ? (
            /* 1. มุมมองแบบแยกหมวดหมู่มิเตอร์ */
            <div className="space-y-6 p-4">
              {groupedSections.map((group) => (
                <div key={group.key} className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Badge className={cn("px-2.5 py-1 text-xs font-semibold border", group.badgeCls)}>
                        {group.badgeText}
                      </Badge>
                      <h3 className="font-semibold text-foreground text-sm">
                        {group.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>จำนวน <strong className="text-foreground font-mono">{group.items.length}</strong> เครื่อง</span>
                      <span>·</span>
                      <span>หน่วยรวม <strong className="text-foreground font-mono">{group.items.reduce((s, r) => s + Math.max(0, r.curr - r.prev), 0).toLocaleString()}</strong> หน่วย</span>
                    </div>
                  </div>
                  {renderReadingsTable(group.items, 0, true)}
                </div>
              ))}
            </div>
          ) : (
            /* 2. มุมมองแบบตารางรวม */
            renderReadingsTable(view, pageSize === -1 ? 0 : current * pageSize, false)
          )}

          {/* การแบ่งหน้า (Pagination) ในมุมมองตารางรวม */}
          {filtered.length > 0 && viewMode === "table" && pageSize !== -1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs sm:text-sm print:hidden">
              <p className="text-muted-foreground">
                แสดง {current * pageSize + 1}–
                {Math.min(filtered.length, (current + 1) * pageSize)} จาก {filtered.length} รายการ
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                  className="h-8 px-2"
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
                  className="h-8 px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog ผลการอ่าน Excel */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>ผลการอ่านไฟล์ Excel ({preview?.length ?? 0} แถว)</DialogTitle>
            <DialogDescription>
              จำแนกคอลัมน์: ชื่อผู้ประกอบการ · สถานที่ · เลขมิเตอร์/มาตรวัด · จดครั้งก่อน ·
              จดครั้งหลัง · หน่วยที่ใช้ · จำนวนเงิน
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อผู้ประกอบการ</TableHead>
                  <TableHead>สถานที่</TableHead>
                  <TableHead>เลขมิเตอร์</TableHead>
                  <TableHead className="text-right">ก่อน</TableHead>
                  <TableHead className="text-right">หลัง</TableHead>
                  <TableHead className="text-right">หน่วย</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview?.slice(0, 300).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.shop}</TableCell>
                    <TableCell className="font-mono text-xs">{r.meter}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.prev ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.curr ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.used ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {r.amount !== undefined ? thb(r.amount) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog ยืนยันการล้างข้อมูลเลขจดมิเตอร์ */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-destructive">ยืนยันการล้างข้อมูลเลขจดมิเตอร์?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1 text-sm text-foreground">
                <p>เลือกขอบเขตข้อมูลเลขจดมิเตอร์ที่ต้องการล้างออกจากระบบ:</p>

                <div className="space-y-2">
                  <label
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors",
                      clearScope === "current"
                        ? "border-destructive bg-destructive/5"
                        : "border-border hover:bg-muted/50",
                    )}
                    onClick={() => setClearScope("current")}
                  >
                    <input
                      type="radio"
                      name="clearScope"
                      className="mt-0.5 text-destructive focus:ring-destructive"
                      checked={clearScope === "current"}
                      onChange={() => setClearScope("current")}
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-foreground">
                        เฉพาะงวด {periodLabel(period)} ({div === "electric" ? "⚡ ค่าไฟฟ้า" : "💧 ค่าน้ำประปา"})
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        ล้างข้อมูลจำนวน <span className="font-semibold text-destructive">{rows.length}</span> รายการ
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors",
                      clearScope === "all"
                        ? "border-destructive bg-destructive/5"
                        : "border-border hover:bg-muted/50",
                    )}
                    onClick={() => setClearScope("all")}
                  >
                    <input
                      type="radio"
                      name="clearScope"
                      className="mt-0.5 text-destructive focus:ring-destructive"
                      checked={clearScope === "all"}
                      onChange={() => setClearScope("all")}
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-foreground">
                        ล้างข้อมูลเลขจดมิเตอร์ทั้งหมดทุกงวด ทุกบริการ
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        ล้างข้อมูลจำนวน <span className="font-semibold text-destructive">{readings.length}</span> รายการ
                      </p>
                    </div>
                  </label>
                </div>

                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-muted-foreground">
                  <p className="font-medium text-destructive mb-0.5">ผลกระทบจากการล้างข้อมูล:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>ประวัติเลขจดครั้งก่อน-ครั้งหลัง และหน่วยที่ใช้จะถูกลบ</li>
                    <li>สามารถนำเข้าข้อมูลจากไฟล์ Excel ใหม่ได้ตลอดเวลา</li>
                  </ul>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (clearScope === "current") {
                  clearReadings(period, div);
                } else {
                  clearReadings();
                }
                setClearOpen(false);
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> ยืนยันล้างข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ดูตัวอย่างและสั่งพิมพ์รายงานคำนวณ (A4 แนวนอน) */}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Printer className="h-5 w-5 text-primary" />
              พิมพ์รายการคำนวณ{div === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"} (ขนาด A4 แนวนอน)
            </DialogTitle>
            <DialogDescription className="text-xs">
              ประจำเดือน {periodLabel(period)} · ทั้งหมด {printableItems.length} รายการ (
              {Math.max(1, Math.ceil(printableItems.length / 26))} หน้า A4)
            </DialogDescription>
          </DialogHeader>

          {/* แถบตัวเลือกหมวดสำหรับพิมพ์ */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">เลือกหมวดมิเตอร์:</span>
              <Select value={printSeries} onValueChange={setPrintSeries}>
                <SelectTrigger className="h-8 w-56 text-xs">
                  <SelectValue placeholder="ทุกหมวดมิเตอร์" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมดตามตัวกรอง ({filtered.length} รายการ)</SelectItem>
                  {div === "electric" &&
                    meterStats.elecSeriesList.map((s) => (
                      <SelectItem key={`print-elec-${s.series}`} value={s.series}>
                        หมวด {s.series} ({s.count} เครื่อง)
                      </SelectItem>
                    ))}
                  {div === "water" &&
                    meterStats.waterSeriesList.map((s) => (
                      <SelectItem key={`print-water-${s.series}`} value={s.series}>
                        หมวด {s.series} ({s.count} เครื่อง)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPrintOpen(false)}>
                ปิด
              </Button>
              <Button size="sm" className="gap-1.5 shadow-sm" onClick={handleExecutePrint}>
                <Printer className="h-4 w-4" /> สั่งพิมพ์รายงาน (A4 แนวนอน)
              </Button>
            </div>
          </div>

          {/* กล่องแสดงตัวอย่างเอกสาร A4 แนวนอน */}
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-4 max-h-[60vh] overflow-auto shadow-inner">
            <ReadingSheet
              division={div}
              period={period}
              items={printableItems}
              customers={customers}
              settings={settings}
              seriesFilter={
                printSeries !== "all"
                  ? printSeries
                  : meterSeriesFilter !== "all"
                    ? meterSeriesFilter
                    : undefined
              }
              itemsPerPage={26}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Direct Body Portal สำหรับการพิมพ์ออกเครื่องพิมพ์จริง (#print-root) */}
      {typeof document !== "undefined" && printableItems.length > 0
        ? createPortal(
            <div id="print-root">
              <ReadingSheet
                division={div}
                period={period}
                items={printableItems}
                customers={customers}
                settings={settings}
                seriesFilter={
                  printSeries !== "all"
                    ? printSeries
                    : meterSeriesFilter !== "all"
                      ? meterSeriesFilter
                      : undefined
                }
                itemsPerPage={26}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
