import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ReceiptText,
  Image as ImageIcon,
  Printer,
  CalendarDays,
  Zap,
  Droplets,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Tag,
  Layers,
  Receipt,
  CheckCircle2,
  Clock,
  CreditCard,
  X,
  Banknote,
  AlertTriangle,
  Building2,
  Smartphone,
  Pencil,
  Save,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useRcms, thb, formatThaiDate, periodLabel } from "@/lib/rcms-store";
import type { Payment } from "@/lib/rcms-types";
import { SlipView } from "@/components/rcms/SlipView";
import { ReceiptSheet } from "@/components/rcms/ReceiptSheet";
import { LineSendReceiptDialog } from "@/components/rcms/LineSendReceiptDialog";
import {
  getCustomerMeterCategory,
  type MeterCategoryFilter,
} from "@/lib/customer-matching";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "ประวัติการชำระเงิน · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "ค้นหาประวัติการชำระเงินย้อนหลังตามวันเดือนปี พิมพ์ใบเสร็จขนาด A5 และเรียกดูภาพสลิปได้ตลอดเวลา",
      },
      { property: "og:title", content: "ประวัติการชำระเงิน · RCMS" },
      { property: "og:description", content: "Payment History: ใบเสร็จ A5 และภาพสลิปย้อนหลัง" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { payments, bills, customers, customerOf, updatePayment, receiptSendsOf } = useRcms();

  // Filter States
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [meterCatFilter, setMeterCatFilter] = useState<MeterCategoryFilter>("all");
  const [meterSeriesFilter, setMeterSeriesFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "online" | "counter">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [page, setPage] = useState(0);

  // Dialog States
  const [slipId, setSlipId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [lineSendPaymentId, setLineSendPaymentId] = useState<string | null>(null);

  // Edit Payment Reference / Receipt Dialog State
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [editRef, setEditRef] = useState("");
  const [editReceiptNo, setEditReceiptNo] = useState("");
  const [editBookNo, setEditBookNo] = useState("");
  const [editPaidDate, setEditPaidDate] = useState("");
  const [editMethod, setEditMethod] = useState<"online" | "counter">("online");
  const [editDivision, setEditDivision] = useState<"electric" | "water">("electric");

  // Helper to determine utility division of a payment record
  const getDivision = (p: Payment): "electric" | "water" => {
    if (p.division === "electric" || p.division === "water") {
      return p.division;
    }
    if (p.billId) {
      const b = bills.find((bill) => bill.id === p.billId);
      if (b?.type === "electric" || b?.type === "water") return b.type;
    }
    const billNoUpper = (p.billNo || "").toUpperCase();
    if (
      billNoUpper.endsWith("W") ||
      billNoUpper.includes("-W") ||
      p.billNo?.includes("ประปา") ||
      p.billId?.toLowerCase().includes("water")
    ) {
      return "water";
    }
    if (
      billNoUpper.endsWith("E") ||
      billNoUpper.includes("-E") ||
      p.billNo?.includes("ไฟฟ้า") ||
      p.billId?.toLowerCase().includes("electric")
    ) {
      return "electric";
    }
    const cust = customerOf(p.customerId);
    if (cust?.waterMeter && !cust?.elecMeter) return "water";
    return "electric";
  };

  const openEditModal = (p: Payment) => {
    setEditPayment(p);
    setEditRef(p.ref || "");
    setEditReceiptNo(p.receiptNo || "");
    setEditBookNo(p.bookNo || "");
    setEditPaidDate(p.paidDate || p.paidAt?.slice(0, 10) || "");
    setEditMethod(p.method || "online");
    setEditDivision(getDivision(p));
  };

  const handleSaveEdit = () => {
    if (!editPayment) return;
    updatePayment(editPayment.id, {
      ref: editRef.trim(),
      receiptNo: editReceiptNo.trim() || undefined,
      bookNo: editBookNo.trim() || undefined,
      paidDate: editPaidDate.trim(),
      method: editMethod,
      division: editDivision,
    });
    setEditPayment(null);
  };

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

  // Overall counts and totals
  const counts = useMemo(() => {
    let elec = 0;
    let water = 0;
    let verified = 0;
    let online = 0;
    let counter = 0;
    let totalVerified = 0;
    let totalElec = 0;
    let totalWater = 0;

    payments.forEach((p) => {
      const div = getDivision(p);
      if (div === "electric") {
        elec++;
        if (p.status === "verified") totalElec += p.amount;
      } else {
        water++;
        if (p.status === "verified") totalWater += p.amount;
      }

      if (p.status === "verified") {
        verified++;
        totalVerified += p.amount;
      }

      if (p.method === "online") online++;
      else counter++;
    });

    return {
      all: payments.length,
      electric: elec,
      water,
      verified,
      online,
      counter,
      totalVerified,
      totalElec,
      totalWater,
    };
  }, [payments, bills, customerOf]);

  // Filtered Payments List
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return payments.filter((p) => {
      const div = getDivision(p);
      const cust = customerOf(p.customerId);
      const cat = getCustomerMeterCategory(cust);

      // 1. Meter category filter
      if (meterCatFilter === "electric" && div !== "electric" && cat.type !== "electric" && cat.type !== "both") {
        return false;
      }
      if (meterCatFilter === "water" && div !== "water" && cat.type !== "water" && cat.type !== "both") {
        return false;
      }
      if (meterCatFilter === "both" && cat.type !== "both") return false;
      if (meterCatFilter === "none" && cat.type !== "none") return false;

      // 2. Meter series filter
      if (meterSeriesFilter !== "all") {
        const matchesElec = cat.elecPrefix === meterSeriesFilter;
        const matchesWater = cat.waterPrefix === meterSeriesFilter;
        if (!matchesElec && !matchesWater) return false;
      }

      // 3. Payment Method filter
      if (methodFilter !== "all" && p.method !== methodFilter) return false;

      // 4. Status filter
      if (statusFilter !== "all" && p.status !== statusFilter) return false;

      // 5. Date filter
      if (date && p.paidDate !== date && !p.paidAt?.startsWith(date)) return false;

      // 6. Text search query
      if (term) {
        const refStr = (p.ref || "").toLowerCase();
        const billNoStr = (p.billNo || "").toLowerCase();
        const receiptNoStr = (p.receiptNo || "").toLowerCase();
        const bookNoStr = (p.bookNo || "").toLowerCase();
        const payerStr = (p.slip?.payerName || "").toLowerCase();
        const cName = (cust?.name || "").toLowerCase();
        const cShop = (cust?.shop || "").toLowerCase();
        const cCode = (cust?.code || "").toLowerCase();
        const cPhone = (cust?.phone || "").toLowerCase();
        const elecM = (cust?.elecMeter || "").toLowerCase();
        const waterM = (cust?.waterMeter || "").toLowerCase();
        const periodStrs = (p.periods?.join(" ") ?? "").toLowerCase();
        const divStr = div === "electric" ? "ค่าไฟ ค่าไฟฟ้า" : "ค่าน้ำ น้ำประปา";

        if (
          !refStr.includes(term) &&
          !billNoStr.includes(term) &&
          !receiptNoStr.includes(term) &&
          !bookNoStr.includes(term) &&
          !payerStr.includes(term) &&
          !cName.includes(term) &&
          !cShop.includes(term) &&
          !cCode.includes(term) &&
          !cPhone.includes(term) &&
          !elecM.includes(term) &&
          !waterM.includes(term) &&
          !periodStrs.includes(term) &&
          !divStr.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [payments, q, date, meterCatFilter, meterSeriesFilter, methodFilter, statusFilter, bills, customerOf]);

  // Total amount for filtered items
  const filteredTotalAmount = useMemo(() => {
    return list.reduce((s, p) => s + p.amount, 0);
  }, [list]);

  // Pagination
  const effectivePageSize = pageSize === "all" ? Math.max(1, list.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(list.length / effectivePageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedList = useMemo(() => {
    return pageSize === "all" ? list : list.slice(currentPage * effectivePageSize, (currentPage + 1) * effectivePageSize);
  }, [list, currentPage, effectivePageSize, pageSize]);

  const isFiltered =
    q !== "" ||
    date !== "" ||
    meterCatFilter !== "all" ||
    meterSeriesFilter !== "all" ||
    methodFilter !== "all" ||
    statusFilter !== "all";

  const resetFilters = () => {
    setQ("");
    setDate("");
    setMeterCatFilter("all");
    setMeterSeriesFilter("all");
    setMethodFilter("all");
    setStatusFilter("all");
    setPage(0);
  };

  const slip = payments.find((p) => p.id === slipId);
  const receipt = payments.find((p) => p.id === receiptId);

  return (
    <>
      <PageHeader
        title="ประวัติการชำระเงิน"
        desc={`ประวัติและสมุดบัญชีรายรับ ${payments.length.toLocaleString()} รายการ · ยอดที่ยืนยันแล้วรวม ฿${thb(counts.totalVerified)}`}
      />

      {/* 4 Summary Cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: ยอดรับชำระสะสมรวม */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-emerald-500" />
                <span>ยอดรับชำระสะสมรวม</span>
              </p>
              <p className="mt-1 font-display text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                ฿{thb(counts.totalVerified)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ยืนยันแล้ว <strong className="font-mono text-foreground">{counts.verified}</strong> / {counts.all} รายการ
              </p>
            </div>
            <div className="rounded-full bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: ยอดรับชำระค่าไฟฟ้า */}
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span>รายรับหมวดค่าไฟฟ้า</span>
              </p>
              <p className="mt-1 font-display text-xl font-bold font-mono text-amber-700 dark:text-amber-400">
                ฿{thb(counts.totalElec)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ทั้งหมด <strong className="font-mono text-foreground">{counts.electric}</strong> รายการ
              </p>
            </div>
            <div className="rounded-full bg-amber-500/15 p-2.5 text-amber-600 dark:text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: ยอดรับชำระค่าน้ำประปา */}
        <Card className="border-blue-500/30 bg-blue-500/5 shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-blue-500 fill-blue-500" />
                <span>รายรับหมวดค่าน้ำประปา</span>
              </p>
              <p className="mt-1 font-display text-xl font-bold font-mono text-blue-700 dark:text-blue-400">
                ฿{thb(counts.totalWater)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ทั้งหมด <strong className="font-mono text-foreground">{counts.water}</strong> รายการ
              </p>
            </div>
            <div className="rounded-full bg-blue-500/15 p-2.5 text-blue-600 dark:text-blue-400">
              <Droplets className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: สรุปช่องทางชำระเงิน */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>ช่องทางการชำระเงิน</span>
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {counts.online}
                </span>
                <span className="text-xs text-muted-foreground">Line OA</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-mono text-base font-bold text-slate-700 dark:text-slate-300">
                  {counts.counter}
                </span>
                <span className="text-xs text-muted-foreground">เคาน์เตอร์</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                อัตราการยืนยันเงิน:{" "}
                <strong className="font-mono text-foreground">
                  {counts.all > 0 ? Math.round((counts.verified / counts.all) * 100) : 0}%
                </strong>
              </p>
            </div>
            <div className="rounded-full bg-primary/10 p-2.5 text-primary">
              <Banknote className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* แผงตัวกรองและหมวดหมู่มิเตอร์ (Filter Toolbar) */}
      <Card className="mb-4 border-border/70 shadow-sm rounded-2xl bg-card">
        <CardContent className="space-y-3.5 p-4 sm:p-5">
          {/* แถวที่ 1: Quick-Filter Tabs ตามหมวดหมู่มิเตอร์ + สลับช่องทางการชำระ */}
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
                ทั้งหมด ({counts.all})
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
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> หมวดไฟฟ้า ({counts.electric})
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
                <Droplets className="h-3.5 w-3.5 text-blue-500 fill-blue-500/20" /> หมวดน้ำประปา ({counts.water})
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

            {/* Toggle Payment Channel */}
            <div className="flex items-center gap-1 bg-stone-100/90 dark:bg-muted/50 p-1 rounded-xl border border-stone-200/80 dark:border-border/60">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  methodFilter === "all"
                    ? "bg-stone-200/90 dark:bg-muted text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => {
                  setMethodFilter("all");
                  setPage(0);
                }}
              >
                <span>ทุกช่องทาง ({counts.all})</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  methodFilter === "online"
                    ? "bg-stone-200/90 dark:bg-muted text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => {
                  setMethodFilter("online");
                  setPage(0);
                }}
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Online / Line OA ({counts.online})</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all",
                  methodFilter === "counter"
                    ? "bg-stone-200/90 dark:bg-muted text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => {
                  setMethodFilter("counter");
                  setPage(0);
                }}
              >
                <Building2 className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                <span>เคาน์เตอร์ ({counts.counter})</span>
              </button>
            </div>
          </div>

          {/* แถวที่ 2: ช่องค้นหา + Dropdown หมวดรหัสมิเตอร์ + Date Picker + Dropdown สถานะ */}
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-12">
            {/* 1. ช่องค้นหา */}
            <div className="relative md:col-span-5 lg:col-span-5">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อผู้ประกอบการ, ร้านค้า, รหัส, เบอร์โทร, เลขมิเตอร์, เลขที่บิล, เลขที่ใบเสร็จ, อ้างอิง..."
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

            {/* 3. ค้นหาตามวันที่ชำระ (Date Picker) */}
            <div className="md:col-span-2 lg:col-span-2 relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                className="pl-9 pr-7 h-10 text-xs rounded-xl border-border/80 bg-background"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPage(0);
                }}
              />
              {date ? (
                <button
                  type="button"
                  onClick={() => {
                    setDate("");
                    setPage(0);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
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
                  <SelectItem value="verified">ยืนยันแล้ว (Verified)</SelectItem>
                  <SelectItem value="pending">รอตรวจ (Pending)</SelectItem>
                  <SelectItem value="problem">สลิปมีปัญหา (Problem)</SelectItem>
                  <SelectItem value="rejected">ปฏิเสธ (Rejected)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* แถวที่ 3: สรุปผลการค้นหา และ ตัวเลือกจำนวนแถว */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>ผลการค้นหา:</span>
              <span className="font-mono font-bold text-foreground bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/60 text-xs">
                {list.length.toLocaleString()} รายการ
              </span>
              <span>·</span>
              <span>
                ยอดเงินรวมตามตัวกรอง:{" "}
                <strong className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                  ฿{thb(filteredTotalAmount)}
                </strong>
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
                <option value={10}>10 รายการ/หน้า</option>
                <option value={20}>20 รายการ/หน้า</option>
                <option value={50}>50 รายการ/หน้า</option>
                <option value={100}>100 รายการ/หน้า</option>
                <option value="all">แสดงทั้งหมด ({list.length})</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* บัตรตารางประวัติการชำระเงิน */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border/60 bg-muted/15 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>รายการประวัติการรับชำระเงิน</span>
            </CardTitle>
            <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
              {list.length.toLocaleString()} รายการ
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            ยอดรวม: <strong className="font-mono font-bold text-foreground">฿{thb(filteredTotalAmount)}</strong>
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <ReceiptText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                ไม่พบรายการชำระเงินตามเงื่อนไขที่ค้นหา
              </p>
              <p className="text-xs text-muted-foreground/70">
                ลองเปลี่ยนคำค้นหา หรือกดปุ่มล้างตัวกรอง
              </p>
              {isFiltered && (
                <Button variant="link" size="sm" onClick={resetFilters} className="mt-2 text-xs">
                  ล้างตัวกรองทั้งหมด
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40 border-b border-border">
                    <TableRow className="border-b border-border/70 hover:bg-transparent text-xs">
                      <TableHead className="w-12 text-center py-3 px-2 font-semibold text-muted-foreground">
                        ลำดับ
                      </TableHead>
                      <TableHead className="w-[170px] py-3 px-3 font-semibold text-muted-foreground">
                        เลขที่อ้างอิง / ใบเสร็จ
                      </TableHead>
                      <TableHead className="w-[125px] py-3 px-3 font-semibold text-muted-foreground">
                        วันเวลาชำระ
                      </TableHead>
                      <TableHead className="w-[1%] whitespace-nowrap py-3 px-2 text-center font-semibold text-muted-foreground">
                        รหัส
                      </TableHead>
                      <TableHead className="min-w-[180px] py-3 px-3 font-semibold text-muted-foreground">
                        ผู้ประกอบการ / ร้านค้า
                      </TableHead>
                      <TableHead className="w-32 text-center py-3 px-3 font-semibold text-muted-foreground">
                        หมายเลขมิเตอร์
                      </TableHead>
                      <TableHead className="min-w-[170px] py-3 px-3 font-semibold text-muted-foreground">
                        รายการที่ชำระ
                      </TableHead>
                      <TableHead className="w-[130px] py-3 px-3 font-semibold text-muted-foreground">
                        ช่องทาง
                      </TableHead>
                      <TableHead className="w-[120px] py-3 px-4 text-right font-semibold text-muted-foreground">
                        ยอดเงิน
                      </TableHead>
                      <TableHead className="w-[100px] py-3 px-2 text-center font-semibold text-muted-foreground">
                        สถานะ
                      </TableHead>
                      <TableHead className="w-[170px] py-3 px-4 text-center font-semibold text-muted-foreground">
                        จัดการ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedList.map((p, idx) => {
                      const cust = customerOf(p.customerId);
                      const rowNum = currentPage * effectivePageSize + idx + 1;
                      const division = getDivision(p);
                      const meterVal = division === "water" ? cust?.waterMeter : cust?.elecMeter;

                      const periods =
                        p.periods && p.periods.length > 0
                          ? p.periods
                          : p.billNo?.match(/^(\d{4})(\d{2})/)
                            ? [`${p.billNo.match(/^(\d{4})(\d{2})/)![1]}-${p.billNo.match(/^(\d{4})(\d{2})/)![2]}`]
                            : [];

                      return (
                        <TableRow
                          key={p.id}
                          className="border-b border-border/40 hover:bg-muted/30 transition-colors text-xs"
                        >
                          {/* 0. ลำดับ */}
                          <TableCell className="text-center font-mono text-muted-foreground py-3 px-2">
                            {rowNum}
                          </TableCell>

                          {/* 1. เลขที่อ้างอิง / ใบเสร็จ (สามารถกดแก้ไขได้) */}
                          <TableCell className="py-3 px-3 align-middle">
                            <div className="group flex items-center justify-between gap-1.5">
                              <div>
                                <div className="font-mono text-xs font-semibold text-foreground">
                                  {p.receiptNo ? (
                                    p.receiptNo.includes("เลขที่") || p.receiptNo.includes("เล่มที่") || p.receiptNo.startsWith("RC-")
                                      ? p.receiptNo
                                      : `เลขที่ ${p.receiptNo}`
                                  ) : (
                                    p.ref
                                  )}
                                </div>
                                {p.bookNo && !p.receiptNo?.includes("เล่มที่") && (
                                  <div className="text-[10px] text-muted-foreground font-sans mt-0.5">
                                    เล่มที่ {p.bookNo}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                title="แก้ไขเลขที่อ้างอิง / ใบเสร็จ"
                                onClick={() => openEditModal(p)}
                                className="opacity-60 hover:opacity-100 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-all cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>

                          {/* 2. วันเวลาชำระ */}
                          <TableCell className="py-3 px-3 align-middle whitespace-nowrap">
                            <div className="text-xs font-medium text-foreground">
                              {formatThaiDate(p.paidDate || p.paidAt)}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              {p.paidDate || p.paidAt?.slice(0, 10)}
                            </div>
                          </TableCell>

                          {/* 3. รหัสผู้ประกอบการ */}
                          <TableCell className="w-[1%] whitespace-nowrap py-3 px-2 text-center align-middle">
                            <span className="inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                              {cust?.code ?? "—"}
                            </span>
                          </TableCell>

                          {/* 4. ผู้ประกอบการ */}
                          <TableCell className="py-3 px-3 align-middle">
                            <p className="text-xs font-semibold text-foreground leading-snug">
                              {cust?.name || "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {cust?.shop || "—"}
                            </p>
                          </TableCell>

                          {/* 5. หมายเลขมิเตอร์ */}
                          <TableCell className="text-center font-mono text-xs py-3 px-3 align-middle">
                            {meterVal ? (
                              <span className="inline-flex items-center gap-1 justify-center">
                                {division === "water" ? (
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

                          {/* 6. รายการที่ชำระ (ประเภท + งวด) */}
                          <TableCell className="py-3 px-3 align-middle">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {division === "electric" ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold py-0.5 px-2 rounded-full gap-1 shadow-none"
                                >
                                  <Zap className="h-3 w-3 fill-amber-500/20" /> ค่ากระแสไฟฟ้า
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-semibold py-0.5 px-2 rounded-full gap-1 shadow-none"
                                >
                                  <Droplets className="h-3 w-3 fill-blue-500/20" /> ค่าน้ำประปา
                                </Badge>
                              )}

                              {periods.length > 0 && (
                                <span className="text-xs font-medium text-foreground whitespace-nowrap">
                                  งวด {periods.map(periodLabel).join(", ")}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* 7. ช่องทางชำระเงิน */}
                          <TableCell className="py-3 px-3 align-middle whitespace-nowrap">
                            {p.method === "online" ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Line OA
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                                เคาน์เตอร์
                              </span>
                            )}
                          </TableCell>

                          {/* 8. ยอดเงิน */}
                          <TableCell className="py-3 px-4 text-right align-middle whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-foreground">
                              ฿{thb(p.amount)}
                            </span>
                          </TableCell>

                          {/* 9. สถานะ */}
                          <TableCell className="py-3 px-2 text-center align-middle whitespace-nowrap">
                            {p.status === "verified" ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-none"
                              >
                                ยืนยันแล้ว
                              </Badge>
                            ) : p.status === "pending" ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-none"
                              >
                                รอตรวจ
                              </Badge>
                            ) : p.status === "problem" ? (
                              <Badge
                                variant="destructive"
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-none"
                              >
                                สลิปมีปัญหา
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-rose-500/30 bg-rose-500/10 text-rose-600 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-none"
                              >
                                ปฏิเสธ
                              </Badge>
                            )}
                          </TableCell>

                          {/* 10. จัดการ (แก้ไข / สลิป / ใบเสร็จ) */}
                          <TableCell className="py-3 px-4 text-center align-middle whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 hover:bg-muted font-medium"
                                onClick={() => openEditModal(p)}
                                title="แก้ไขเลขที่อ้างอิงและใบเสร็จ"
                              >
                                <Pencil className="mr-1 h-3 w-3 text-muted-foreground" /> แก้ไข
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 hover:bg-muted font-medium"
                                onClick={() => setSlipId(p.id)}
                              >
                                <ImageIcon className="mr-1 h-3.5 w-3.5 text-muted-foreground" /> สลิป
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 font-medium border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-40"
                                disabled={p.status !== "verified"}
                                onClick={() => setReceiptId(p.id)}
                              >
                                <ReceiptText className="mr-1 h-3.5 w-3.5" /> ใบเสร็จ
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs px-2 font-medium bg-[#06C755] hover:bg-[#06C755]/90 text-white shadow-xs disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
                                disabled={p.status !== "verified"}
                                onClick={() => setLineSendPaymentId(p.id)}
                                title={
                                  p.status !== "verified"
                                    ? "ยังไม่ได้ยืนยันการชำระเงิน"
                                    : `ส่งใบเสร็จผ่าน LINE รายบุคคล${receiptSendsOf(p.id).length > 0 ? ` (ส่งแล้ว ${receiptSendsOf(p.id).length} ครั้ง)` : ""}`
                                }
                              >
                                <Send className="h-3 w-3" />
                                <span>ส่ง Line</span>
                                {receiptSendsOf(p.id).length > 0 && (
                                  <span className="ml-0.5 rounded-full bg-black/25 px-1.5 py-0 text-[10px] font-mono">
                                    {receiptSendsOf(p.id).length}
                                  </span>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter className="bg-muted/50 font-semibold border-t">
                    <TableRow className="text-xs hover:bg-transparent">
                      <TableCell colSpan={8} className="py-3 px-4 text-left font-sans">
                        รวมยอดเงินตามตัวกรอง ({list.length.toLocaleString()} รายการ)
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        ฿{thb(filteredTotalAmount)}
                      </TableCell>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        —
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>

              {/* ส่วนควบคุมหน้า (Pagination) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-5 py-3 text-xs text-muted-foreground">
                <div>
                  แสดง{" "}
                  <span className="font-semibold text-foreground">
                    {(currentPage * effectivePageSize + 1).toLocaleString()}
                  </span>{" "}
                  –{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(list.length, (currentPage + 1) * effectivePageSize).toLocaleString()}
                  </span>{" "}
                  จากทั้งหมด{" "}
                  <span className="font-semibold text-foreground">
                    {list.length.toLocaleString()}
                  </span>{" "}
                  รายการ
                </div>

                {pageSize !== "all" && totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs font-medium"
                      disabled={currentPage === 0}
                      onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                    >
                      <ChevronLeft className="mr-1 h-3.5 w-3.5" /> ก่อนหน้า
                    </Button>
                    <span className="px-2 font-mono text-xs font-medium text-foreground">
                      หน้า {currentPage + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs font-medium"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                    >
                      ถัดไป <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog: แก้ไขข้อมูลเลขที่อ้างอิง / ใบเสร็จ */}
      <Dialog open={!!editPayment} onOpenChange={(o) => !o && setEditPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              <span>แก้ไขเลขที่อ้างอิง / ใบเสร็จรับเงิน</span>
            </DialogTitle>
            <DialogDescription>
              {editPayment ? (
                <>
                  {customerOf(editPayment.customerId)?.name || "ผู้ประกอบการ"} · {customerOf(editPayment.customerId)?.shop || ""} (บิล {editPayment.billNo})
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* 1. เลขที่อ้างอิง (Ref) */}
            <div className="space-y-1">
              <Label htmlFor="edit-ref" className="text-xs font-semibold">
                เลขที่อ้างอิงการโอน / สลิป (Reference No.) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-ref"
                value={editRef}
                onChange={(e) => setEditRef(e.target.value)}
                placeholder="เช่น TMB123456 หรือ TXN-998822"
                className="h-9 text-xs"
              />
            </div>

            {/* 2. เลขที่ใบเสร็จรับเงิน (Receipt No) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="edit-receipt" className="text-xs font-semibold">
                  เลขที่ใบเสร็จ (Receipt No.)
                </Label>
                <Input
                  id="edit-receipt"
                  value={editReceiptNo}
                  onChange={(e) => setEditReceiptNo(e.target.value)}
                  placeholder="เช่น 20/001 หรือ RCT-12345"
                  className="h-9 text-xs"
                />
              </div>

              {/* 3. เล่มที่ใบเสร็จ (Book No) */}
              <div className="space-y-1">
                <Label htmlFor="edit-book" className="text-xs font-semibold">
                  เล่มที่ (Book No.)
                </Label>
                <Input
                  id="edit-book"
                  value={editBookNo}
                  onChange={(e) => setEditBookNo(e.target.value)}
                  placeholder="เช่น 20 หรือ เล่มที่ 5"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* 4. วันที่ชำระเงิน (Paid Date) */}
            <div className="space-y-1">
              <Label htmlFor="edit-paid-date" className="text-xs font-semibold">
                วันที่ชำระเงิน (Payment Date)
              </Label>
              <Input
                id="edit-paid-date"
                type="date"
                value={editPaidDate}
                onChange={(e) => setEditPaidDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* 5. ช่องทางชำระเงิน และ ประเภทบริการ */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">ช่องทางการชำระ</Label>
                <Select
                  value={editMethod}
                  onValueChange={(v: "online" | "counter") => setEditMethod(v)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online / Line OA</SelectItem>
                    <SelectItem value="counter">เคาน์เตอร์ ชย.ทอ.</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">ประเภทสาธารณูปโภค</Label>
                <Select
                  value={editDivision}
                  onValueChange={(v: "electric" | "water") => setEditDivision(v)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electric">⚡ ค่าไฟฟ้า</SelectItem>
                    <SelectItem value="water">💧 ค่าน้ำประปา</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditPayment(null)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!editRef.trim()}
              onClick={handleSaveEdit}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" /> บันทึกการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: ภาพสลิป */}
      <Dialog open={!!slipId} onOpenChange={(o) => !o && setSlipId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ภาพสลิปการโอนเงิน</DialogTitle>
            <DialogDescription>
              {slip ? `${customerOf(slip.customerId)?.name} · ${slip.ref}` : ""}
            </DialogDescription>
          </DialogHeader>
          {slip ? <SlipView payment={slip} /> : null}
        </DialogContent>
      </Dialog>

      {/* Dialog: ใบเสร็จรับเงิน */}
      <Dialog open={!!receiptId} onOpenChange={(o) => !o && setReceiptId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              ตัวอย่างก่อนพิมพ์ · ใบเสร็จรับเงิน {receipt?.receiptNo || receipt?.ref} ({customerOf(receipt?.customerId ?? "")?.name || "ผู้ประกอบการ"})
            </DialogTitle>
            <DialogDescription>
              ใบเสร็จรับเงินรูปแบบทางการ ชย.ทอ. (ขนาดพอดี 1 หน้ากระดาษ A4 เหมือนใบแจ้งหนี้)
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            {receipt ? (
              <ReceiptSheet payment={receipt} customer={customerOf(receipt.customerId)} />
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReceiptId(null)}>
              ปิด
            </Button>
            <Button
              className="bg-[#06C755] text-white hover:bg-[#06C755]/90"
              onClick={() => {
                if (receipt) setLineSendPaymentId(receipt.id);
              }}
            >
              <Send className="mr-1.5 h-4 w-4" /> ส่งใบเสร็จผ่าน Line (รายบุคคล)
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> พิมพ์ใบเสร็จ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: ส่งใบเสร็จรับเงินผ่าน LINE OA รายบุคคล */}
      <LineSendReceiptDialog
        paymentId={lineSendPaymentId}
        open={!!lineSendPaymentId}
        onClose={() => setLineSendPaymentId(null)}
        onViewReceiptSheet={(p) => {
          setLineSendPaymentId(null);
          setReceiptId(p.id);
        }}
      />

      {/* Direct Body Portal สำหรับการพิมพ์ใบเสร็จจริง */}
      {typeof document !== "undefined" && receipt
        ? createPortal(
            <div id="print-root">
              <ReceiptSheet payment={receipt} customer={customerOf(receipt.customerId)} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
