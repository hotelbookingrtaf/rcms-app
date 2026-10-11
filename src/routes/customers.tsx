import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  UserPlus,
  Search,
  Pencil,
  Save,
  X,
  RotateCcw,
  Receipt,
  CheckCircle2,
  Zap,
  Droplets,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  Gauge,
  Layers,
  LayoutGrid,
  List as ListIcon,
  Tag,
  Building2,
  ChevronLeft,
  ChevronRight,
  Users,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { useRcms, thb, periodLabel, formatThaiDate } from "@/lib/rcms-store";
import {
  getCustomerMeterCategory,
  getMeterPrefix,
  type MeterCategoryFilter,
} from "@/lib/customer-matching";
import { cn } from "@/lib/utils";
import type { Customer, CustomerStatus } from "@/lib/rcms-types";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "ทะเบียนผู้ประกอบการ · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "ทะเบียนข้อมูลผู้ประกอบการทั้งหมด หมายเลขเครื่องวัดไฟฟ้าและมาตรวัดน้ำประปา แยกหมวดหมู่อัตโนมัติ ค่าประกันมิเตอร์ วันที่เริ่มสัญญา และสถานะการใช้งาน",
      },
      { property: "og:title", content: "ทะเบียนผู้ประกอบการ · RCMS" },
      {
        property: "og:description",
        content: "จัดการทะเบียนผู้ประกอบการทั้งหมด แยกหมวดหมู่รหัสมิเตอร์ ค่าประกัน และสัญญาการใช้บริการ",
      },
    ],
  }),
  component: Customers,
});

const statusMap: Record<CustomerStatus, { label: string; cls: string }> = {
  active: { label: "ใช้งานปกติ", cls: "bg-success/15 text-success border-success/30" },
  registered: { label: "รอติดตั้งมิเตอร์", cls: "bg-info/15 text-info border-info/30" },
  disconnected: {
    label: "ถูกตัดบริการ",
    cls: "bg-destructive/15 text-destructive border-destructive/30",
  },
  pending_reconnect: { label: "รอต่อบริการ", cls: "bg-warning/20 text-warning border-warning/30" },
  installment: { label: "ผ่อนชำระ", cls: "bg-accent text-accent-foreground border-gold" },
};

type FormState = {
  name: string;
  shop: string;
  phone: string;
  lineId: string;
  elecMeter: string;
  waterMeter: string;
  depositPaid: string;
  contractStart: string;
  noContractDate: boolean;
};

const emptyForm: FormState = {
  name: "",
  shop: "",
  phone: "",
  lineId: "",
  elecMeter: "",
  waterMeter: "",
  depositPaid: "",
  contractStart: "",
  noContractDate: true,
};

function CustomerForm({ form, set }: { form: FormState; set: (f: FormState) => void }) {
  const field = (k: keyof FormState, label: string, placeholder?: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input
        id={k}
        placeholder={placeholder}
        value={form[k] as string}
        onChange={(e) => set({ ...form, [k]: e.target.value })}
      />
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field("name", "ชื่อผู้ประกอบการ")}
      {field("shop", "สถานที่ / ชื่อร้าน")}
      {field("phone", "เบอร์โทร", "08x-xxx-xxxx")}
      {field("lineId", "LINE ID", "เช่น @ร้านค้า หรือ ID LINE")}

      {field("elecMeter", "หมายเลขเครื่องวัดไฟฟ้า", "20177-093, 72793-059 หรือ 50365-68")}
      {field("waterMeter", "เลขมาตรวัดน้ำประปา", "10023-01")}
      {field("depositPaid", "ค่าประกันมิเตอร์ (บาท)", "3000")}
      <div className="grid gap-1.5">
        <Label htmlFor="contractStart">วันที่เริ่มสัญญา</Label>
        <Input
          id="contractStart"
          type="date"
          disabled={form.noContractDate}
          value={form.contractStart}
          onChange={(e) => set({ ...form, contractStart: e.target.value })}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={form.noContractDate}
            onCheckedChange={(v) =>
              set({ ...form, noContractDate: !!v, contractStart: v ? "" : form.contractStart })
            }
          />
          ไม่ระบุ
        </label>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Customers() {
  const {
    customers,
    outstanding,
    arrearsOf,
    displayStatus,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    clearCustomers,
    settings,
    payments,
    period,
    bills,
    readings,
  } = useRcms();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [meterCatFilter, setMeterCatFilter] = useState<MeterCategoryFilter>("all");
  const [meterSeriesFilter, setMeterSeriesFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grouped">("table");
  const [pageSize, setPageSize] = useState<number | "all">("all");
  const [page, setPage] = useState(0);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteConfirmCust, setDeleteConfirmCust] = useState<Customer | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const getCustomerPayments = (c: Customer) => {
    return payments.filter(
      (p) =>
        p.customerId === c.id ||
        (!p.customerId && p.slip?.payerName && p.slip.payerName.replace(/\s+/g, "") === c.name.replace(/\s+/g, "")),
    );
  };

  const detail = useMemo(
    () => customers.find((c) => c.id === detailId) || null,
    [customers, detailId],
  );

  const arrears = useMemo(
    () => (detail ? arrearsOf(detail.id, undefined, period) : []),
    [detail, arrearsOf, period],
  );

  const customerPayments = useMemo(
    () => (detail ? getCustomerPayments(detail) : []),
    [detail, payments],
  );

  const totalPaidAmount = useMemo(
    () => customerPayments.reduce((acc, p) => acc + (p.amount || 0), 0),
    [customerPayments],
  );

  // ข้อมูลยอดเรียกเก็บงวดปัจจุบันและยอดค้างชำระสำหรับ Dialog รายละเอียด
  const currentPeriodInfo = useMemo(() => {
    if (!detail) return null;

    // ใบแจ้งหนี้งวดปัจจุบัน
    const custBills = bills.filter((b) => b.customerId === detail.id && b.period === period);
    const elecBill = custBills.find(
      (b) => b.type === "electric" || (b.type === "combined" && b.lines.some((l) => l.kind === "electric")),
    );
    const waterBill = custBills.find(
      (b) => b.type === "water" || (b.type === "combined" && b.lines.some((l) => l.kind === "water")),
    );

    // ผลการจดมิเตอร์งวดปัจจุบัน
    const elecReading = readings.find(
      (r) => r.customerId === detail.id && r.period === period && r.division === "electric",
    );
    const waterReading = readings.find(
      (r) => r.customerId === detail.id && r.period === period && r.division === "water",
    );

    // คำนวณค่าไฟฟ้างวดปัจจุบัน
    let elecAmount = 0;
    const elecUsage = elecReading ? elecReading.usageUnits : 0;
    let elecStatus: "paid" | "unpaid" | "none" = "none";
    const elecBillNo: string | undefined = elecBill?.no;

    if (elecBill) {
      elecAmount =
        elecBill.type === "electric"
          ? elecBill.total
          : elecBill.lines.filter((l) => l.kind === "electric").reduce((s, l) => s + l.amount, 0);
      elecStatus = elecBill.status === "paid" ? "paid" : "unpaid";
    } else if (elecReading && elecReading.amountDue > 0 && elecReading.validationState !== "red") {
      elecAmount = elecReading.amountDue;
      elecStatus = "unpaid";
    }

    // คำนวณค่าน้ำประปางวดปัจจุบัน
    let waterAmount = 0;
    const waterUsage = waterReading ? waterReading.usageUnits : 0;
    let waterStatus: "paid" | "unpaid" | "none" = "none";
    const waterBillNo: string | undefined = waterBill?.no;

    if (waterBill) {
      waterAmount =
        waterBill.type === "water"
          ? waterBill.total
          : waterBill.lines.filter((l) => l.kind === "water").reduce((s, l) => s + l.amount, 0);
      waterStatus = waterBill.status === "paid" ? "paid" : "unpaid";
    } else if (waterReading && waterReading.amountDue > 0 && waterReading.validationState !== "red") {
      waterAmount = waterReading.amountDue;
      waterStatus = "unpaid";
    }

    const currentTotal = +(elecAmount + waterAmount).toFixed(2);
    const currentUnpaid = +(
      (elecStatus === "unpaid" ? elecAmount : 0) + (waterStatus === "unpaid" ? waterAmount : 0)
    ).toFixed(2);

    const pastArrearsTotal = +arrears.reduce((sum, a) => sum + a.amount, 0).toFixed(2);
    const pastElecArrears = +arrears
      .filter((a) => a.division !== "water")
      .reduce((sum, a) => sum + a.amount, 0)
      .toFixed(2);
    const pastWaterArrears = +arrears
      .filter((a) => a.division === "water")
      .reduce((sum, a) => sum + a.amount, 0)
      .toFixed(2);

    const grandTotal = +(pastArrearsTotal + currentUnpaid).toFixed(2);

    return {
      elecAmount,
      elecUsage,
      elecStatus,
      elecBillNo,
      waterAmount,
      waterUsage,
      waterStatus,
      waterBillNo,
      currentTotal,
      currentUnpaid,
      pastArrearsTotal,
      pastElecArrears,
      pastWaterArrears,
      grandTotal,
      hasCurrentUsage: !!elecReading || !!waterReading || custBills.length > 0,
    };
  }, [detail, bills, readings, period, arrears]);

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
      totalElecMeters,
      totalWaterMeters,
      elecSeriesList,
      waterSeriesList,
    };
  }, [customers]);

  const totalDepositAll = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.depositPaid || 0), 0);
  }, [customers]);

  const startEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      shop: c.shop,
      phone: c.phone || "",
      lineId: c.lineId || "",
      elecMeter: c.elecMeter || "",
      waterMeter: c.waterMeter || "",
      depositPaid: String(c.depositPaid || ""),
      contractStart: c.contractStart || "",
      noContractDate: !c.contractStart,
    });
  };

  const editList = useMemo(() => {
    const term = editQ.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.shop.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term),
    );
  }, [customers, editQ]);

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

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers.filter((c) => {
      const cat = getCustomerMeterCategory(c);

      if (term) {
        const searchStr = `${c.name} ${c.shop} ${c.code} ${c.phone ?? ""} ${c.lineId ?? ""} ${c.elecMeter ?? ""} ${c.waterMeter ?? ""} ${c.siteCode ?? ""} ${cat.elecPrefix ?? ""} ${cat.waterPrefix ?? ""}`.toLowerCase();
        if (!searchStr.includes(term)) return false;
      }
      if (statusFilter !== "all" && c.status !== statusFilter) {
        return false;
      }
      if (meterCatFilter !== "all") {
        if (meterCatFilter === "electric" && cat.type !== "electric" && cat.type !== "both") {
          return false;
        }
        if (meterCatFilter === "water" && cat.type !== "water" && cat.type !== "both") {
          return false;
        }
        if (meterCatFilter === "both" && cat.type !== "both") {
          return false;
        }
        if (meterCatFilter === "none" && cat.type !== "none") {
          return false;
        }
      }
      if (meterSeriesFilter !== "all") {
        const matchesElec = cat.elecPrefix === meterSeriesFilter;
        const matchesWater = cat.waterPrefix === meterSeriesFilter;
        if (!matchesElec && !matchesWater) {
          return false;
        }
      }
      return true;
    });
  }, [
    customers,
    q,
    statusFilter,
    meterCatFilter,
    meterSeriesFilter,
  ]);

  // Grouped by Category/Series for Grouped View
  const groupedCategories = useMemo(() => {
    const groups: Array<{
      key: string;
      title: string;
      type: "electric" | "water" | "both" | "none";
      badgeText: string;
      badgeCls: string;
      series?: string;
      items: Customer[];
    }> = [];

    // 1. Electric Series groups
    meterStats.elecSeriesList.forEach((es) => {
      const items = list.filter((c) => getCustomerMeterCategory(c).elecPrefix === es.series);
      if (items.length > 0) {
        groups.push({
          key: `elec-${es.series}`,
          title: `หมวดมิเตอร์ไฟฟ้า: หมวด ${es.series}`,
          type: "electric",
          badgeText: `⚡ ไฟฟ้า (หมวด ${es.series})`,
          badgeCls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
          series: es.series,
          items,
        });
      }
    });

    // 2. Water Series groups
    meterStats.waterSeriesList.forEach((ws) => {
      const items = list.filter(
        (c) =>
          getCustomerMeterCategory(c).waterPrefix === ws.series &&
          !getCustomerMeterCategory(c).elecPrefix,
      );
      if (items.length > 0) {
        groups.push({
          key: `water-${ws.series}`,
          title: `หมวดมาตรวัดน้ำประปา: หมวด ${ws.series}`,
          type: "water",
          badgeText: `💧 น้ำประปา (หมวด ${ws.series})`,
          badgeCls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
          series: ws.series,
          items,
        });
      }
    });

    // 3. Dual service customers not yet in above
    const dualItems = list.filter(
      (c) =>
        getCustomerMeterCategory(c).type === "both" &&
        !groups.some((g) => g.items.some((item) => item.id === c.id)),
    );
    if (dualItems.length > 0) {
      groups.push({
        key: "dual-meters",
        title: "ผู้ประกอบการใช้บริการ 2 ระบบ (ไฟฟ้า + น้ำประปา)",
        type: "both",
        badgeText: "⚡💧 ไฟฟ้า + น้ำ",
        badgeCls: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300",
        items: dualItems,
      });
    }

    // 4. Other meters
    const otherWithMeter = list.filter(
      (c) =>
        (c.elecMeter || c.waterMeter) &&
        !groups.some((g) => g.items.some((item) => item.id === c.id)),
    );
    if (otherWithMeter.length > 0) {
      groups.push({
        key: "other-meters",
        title: "มิเตอร์หมวดอื่นๆ",
        type: "both",
        badgeText: "หมวดอื่นๆ",
        badgeCls: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400",
        items: otherWithMeter,
      });
    }

    // 5. No meters
    const noMeters = list.filter((c) => getCustomerMeterCategory(c).type === "none");
    if (noMeters.length > 0) {
      groups.push({
        key: "no-meters",
        title: "ผู้ประกอบการที่ยังไม่มีมิเตอร์ / รอติดตั้ง",
        type: "none",
        badgeText: "⚪ ยังไม่มีมิเตอร์",
        badgeCls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
        items: noMeters,
      });
    }

    return groups;
  }, [list, meterStats]);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(list.length / (pageSize as number)));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedList = useMemo(() => {
    if (pageSize === "all") return list;
    const size = pageSize as number;
    return list.slice(currentPage * size, (currentPage + 1) * size);
  }, [list, currentPage, pageSize]);

  const renderCustomerRow = (c: Customer, idx: number) => {
    let effectiveElecMeter = c.elecMeter;
    let effectiveWaterMeter = c.waterMeter;
    if (
      effectiveWaterMeter &&
      (effectiveWaterMeter.startsWith("20177-") ||
        effectiveWaterMeter.startsWith("72793-") ||
        effectiveWaterMeter.startsWith("50365-") ||
        effectiveWaterMeter.startsWith("38944-"))
    ) {
      if (!effectiveElecMeter || effectiveElecMeter === "—" || effectiveElecMeter === "-") {
        effectiveElecMeter = effectiveWaterMeter;
        effectiveWaterMeter = undefined;
      } else if (effectiveWaterMeter.startsWith("20177-") || effectiveWaterMeter === effectiveElecMeter) {
        effectiveWaterMeter = undefined;
      }
    }

    const st = statusMap[c.status] || { label: c.status, cls: "bg-muted text-muted-foreground border-border" };

    return (
      <TableRow
        key={c.id}
        className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/50 group text-xs"
        onClick={() => setDetailId(c.id)}
      >
        {/* 1. ลำดับ */}
        <TableCell className="text-center py-3 px-2 w-12 font-mono text-xs text-muted-foreground">
          {idx + 1}
        </TableCell>

        {/* 2. รหัส */}
        <TableCell className="text-center py-3 px-2 w-20">
          <span className="inline-flex items-center justify-center font-mono text-xs font-semibold text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/70">
            {c.code}
          </span>
        </TableCell>

        {/* 3. ผู้ประกอบการ */}
        <TableCell className="py-3 px-3 min-w-[180px] max-w-[240px]">
          <p className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors">
            {c.name}
          </p>
          {(c.phone && c.phone !== "-") || (c.lineId && c.lineId !== "-") ? (
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 font-normal">
              {c.phone && c.phone !== "-" && <span>📞 {c.phone}</span>}
              {c.phone && c.phone !== "-" && c.lineId && c.lineId !== "-" && <span>·</span>}
              {c.lineId && c.lineId !== "-" && <span>Line: {c.lineId}</span>}
            </p>
          ) : null}
        </TableCell>

        {/* 4. สถานที่ / ร้านค้า */}
        <TableCell className="py-3 px-3 min-w-[180px] max-w-[280px]">
          <p className="text-xs text-foreground/90 leading-relaxed font-normal">
            {c.shop || "—"}
          </p>
        </TableCell>

        {/* 5. ⚡ หมายเลขมิเตอร์ไฟฟ้า */}
        <TableCell className="text-center py-3 px-2 w-36 whitespace-nowrap">
          {effectiveElecMeter && effectiveElecMeter !== "—" && effectiveElecMeter !== "-" ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-mono font-semibold text-amber-900 dark:text-amber-200">
              <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0 fill-amber-500/20" />
              {effectiveElecMeter}
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground/40">—</span>
          )}
        </TableCell>

        {/* 6. 💧 หมายเลขมิเตอร์น้ำ */}
        <TableCell className="text-center py-3 px-2 w-36 whitespace-nowrap">
          {effectiveWaterMeter && effectiveWaterMeter !== "—" && effectiveWaterMeter !== "-" ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-mono font-semibold text-blue-900 dark:text-blue-200">
              <Droplets className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0 fill-blue-500/20" />
              {effectiveWaterMeter}
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground/40">—</span>
          )}
        </TableCell>

        {/* 7. ค่าประกันมิเตอร์ */}
        <TableCell className="text-right py-3 px-3 w-32 font-mono whitespace-nowrap">
          {c.depositPaid && c.depositPaid > 0 ? (
            <span className="text-xs font-semibold text-foreground">
              ฿{thb(c.depositPaid)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">฿0.00</span>
          )}
        </TableCell>

        {/* 8. วันที่เริ่มสัญญา */}
        <TableCell className="text-center py-3 px-2 w-32 whitespace-nowrap">
          {c.contractStart ? (
            <span className="text-xs text-foreground/80 font-mono">
              {formatThaiDate(c.contractStart)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/40 font-mono">ไม่ระบุ</span>
          )}
        </TableCell>

        {/* 9. สถานะ */}
        <TableCell className="text-center py-3 px-2 w-28 whitespace-nowrap">
          <Badge variant="outline" className={cn("text-xs font-medium px-2.5 py-0.5", st.cls)}>
            {st.label}
          </Badge>
        </TableCell>

        {/* 10. จัดการ */}
        <TableCell className="text-center py-3 px-2 w-24 whitespace-nowrap">
          <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              title="แก้ไขข้อมูล"
              onClick={(e) => {
                e.stopPropagation();
                startEdit(c);
                setEditOpen(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="ลบผู้ประกอบการ"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirmCust(c);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const TableHeaderBlock = () => (
    <TableHeader className="bg-muted/40 border-b border-border">
      <TableRow className="hover:bg-transparent border-b border-border">
        <TableHead className="w-12 text-center text-xs font-semibold text-muted-foreground py-3">ลำดับ</TableHead>
        <TableHead className="w-20 text-center text-xs font-semibold text-muted-foreground py-3">รหัส</TableHead>
        <TableHead className="min-w-[190px] max-w-[240px] text-xs font-semibold text-muted-foreground py-3">ผู้ประกอบการ</TableHead>
        <TableHead className="min-w-[180px] max-w-[280px] text-xs font-semibold text-muted-foreground py-3">สถานที่ / ร้านค้า</TableHead>
        <TableHead className="w-36 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap py-3">
          <span className="inline-flex items-center gap-1 justify-center"><Zap className="h-3.5 w-3.5 text-amber-500" /> หมายเลขมิเตอร์ไฟฟ้า</span>
        </TableHead>
        <TableHead className="w-36 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap py-3">
          <span className="inline-flex items-center gap-1 justify-center"><Droplets className="h-3.5 w-3.5 text-blue-500" /> หมายเลขมิเตอร์น้ำ</span>
        </TableHead>
        <TableHead className="w-32 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap py-3">
          <span className="inline-flex items-center gap-1 justify-end"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> ค่าประกันมิเตอร์</span>
        </TableHead>
        <TableHead className="w-32 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap py-3">
          <span className="inline-flex items-center gap-1 justify-center"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> วันที่เริ่มสัญญา</span>
        </TableHead>
        <TableHead className="w-28 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap py-3">สถานะ</TableHead>
        <TableHead className="w-24 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap py-3">จัดการ</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <>
      <PageHeader
        title="ทะเบียนผู้ประกอบการ"
        desc={`ข้อมูลผู้ประกอบการทั้งหมด ${customers.length} ราย · มิเตอร์ไฟฟ้า ${meterStats.totalElecMeters} เครื่อง · มาตรวัดน้ำ ${meterStats.totalWaterMeters} เครื่อง · ค่าประกันรวม ฿${thb(totalDepositAll)}`}
        actions={
          <>
            <Button
              onClick={() => {
                setForm(emptyForm);
                setAddOpen(true);
              }}
            >
              <UserPlus className="mr-1 h-4 w-4" /> ลงทะเบียนผู้ใช้ใหม่
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setEditQ("");
                setEditOpen(true);
              }}
            >
              <Pencil className="mr-1 h-4 w-4" /> แก้ไขข้อมูล
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setClearOpen(true)}
              disabled={customers.length === 0}
            >
              <Trash2 className="mr-1 h-4 w-4" /> ล้างข้อมูล
            </Button>
          </>
        }
      />

      {/* สรุปข้อมูลผู้ประกอบการและมิเตอร์ */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: 👥 ผู้ประกอบการทั้งหมด */}
        <Card
          className={cn(
            "border-border/60 bg-card/60 shadow-sm transition-all cursor-pointer hover:border-primary/40",
            meterCatFilter === "all" && "ring-2 ring-primary/40 bg-primary/5",
          )}
          onClick={() => setMeterCatFilter("all")}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Users className="h-4 w-4 text-primary" />
                <span>ผู้ประกอบการทั้งหมด</span>
              </div>
              <p className="mt-1 font-display text-xl font-bold text-foreground">
                {customers.length}{" "}
                <span className="text-xs font-normal text-muted-foreground font-sans">ราย</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ใช้งานปกติ {customers.filter((c) => c.status === "active").length} ราย · อื่นๆ {customers.filter((c) => c.status !== "active").length} ราย
              </p>
            </div>
            <div className="rounded-full bg-primary/10 p-2.5 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: ⚡ หมวดมิเตอร์ไฟฟ้า */}
        <Card
          className={cn(
            "border-amber-500/30 bg-amber-500/5 shadow-sm transition-all cursor-pointer hover:border-amber-500/60",
            meterCatFilter === "electric" && "ring-2 ring-amber-500/50 bg-amber-500/10",
          )}
          onClick={() => setMeterCatFilter(meterCatFilter === "electric" ? "all" : "electric")}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                <Zap className="h-4 w-4" />
                <span>หมวดมิเตอร์ไฟฟ้า</span>
              </div>
              <p className="mt-1 font-display text-xl font-bold text-amber-700 dark:text-amber-400">
                {meterStats.totalElecMeters}{" "}
                <span className="text-xs font-normal text-muted-foreground font-sans">เครื่อง ({meterStats.elecOnlyCount + meterStats.bothCount} ราย)</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground truncate max-w-[180px]">
                {meterStats.elecSeriesList.length
                  ? `หมวด: ${meterStats.elecSeriesList.map((s) => s.series).join(", ")}`
                  : "ยังไม่มีมิเตอร์"}
              </p>
            </div>
            <div className="rounded-full bg-amber-500/15 p-2.5 text-amber-600 dark:text-amber-400">
              <Gauge className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: 💧 หมวดมาตรวัดน้ำประปา */}
        <Card
          className={cn(
            "border-blue-500/30 bg-blue-500/5 shadow-sm transition-all cursor-pointer hover:border-blue-500/60",
            meterCatFilter === "water" && "ring-2 ring-blue-500/50 bg-blue-500/10",
          )}
          onClick={() => setMeterCatFilter(meterCatFilter === "water" ? "all" : "water")}
        >
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-medium">
                <Droplets className="h-4 w-4" />
                <span>หมวดมาตรวัดน้ำประปา</span>
              </div>
              <p className="mt-1 font-display text-xl font-bold text-blue-700 dark:text-blue-400">
                {meterStats.totalWaterMeters}{" "}
                <span className="text-xs font-normal text-muted-foreground font-sans">เครื่อง ({meterStats.waterOnlyCount + meterStats.bothCount} ราย)</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground truncate max-w-[180px]">
                {meterStats.waterSeriesList.length
                  ? `หมวด: ${meterStats.waterSeriesList.map((s) => s.series).join(", ")}`
                  : "ยังไม่มีมาตรวัด"}
              </p>
            </div>
            <div className="rounded-full bg-blue-500/15 p-2.5 text-blue-600 dark:text-blue-400">
              <Droplets className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: 🛡️ เงินประกันมิเตอร์รวม */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                <span>เงินประกันมิเตอร์รวม</span>
              </p>
              <p className="mt-1 font-display text-xl font-bold text-emerald-700 dark:text-emerald-400">
                ฿{thb(totalDepositAll)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                เกณฑ์: ไฟ ฿{thb(settings.depositElectric)} · น้ำ ฿{thb(settings.depositWater)}
              </p>
            </div>
            <div className="rounded-full bg-emerald-500/15 p-2.5 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* แผงหมวดหมู่มิเตอร์ ค้นหา และตัวกรอง */}
      <Card className="mb-4">
        <CardContent className="space-y-3.5 p-4">
          {/* Quick-Filter Tabs ตามหมวดหมู่มิเตอร์ */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> หมวดหมู่มิเตอร์:
              </span>
              <Button
                variant={meterCatFilter === "all" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => {
                  setMeterCatFilter("all");
                  setPage(0);
                }}
              >
                ทั้งหมด ({customers.length})
              </Button>
              <Button
                variant={meterCatFilter === "electric" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs px-2.5 gap-1",
                  meterCatFilter !== "electric" && "text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10",
                )}
                onClick={() => {
                  setMeterCatFilter("electric");
                  setPage(0);
                }}
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" /> หมวดไฟฟ้า ({meterStats.elecOnlyCount + meterStats.bothCount})
              </Button>
              <Button
                variant={meterCatFilter === "water" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs px-2.5 gap-1",
                  meterCatFilter !== "water" && "text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10",
                )}
                onClick={() => {
                  setMeterCatFilter("water");
                  setPage(0);
                }}
              >
                <Droplets className="h-3.5 w-3.5 text-blue-500" /> หมวดน้ำประปา ({meterStats.waterOnlyCount + meterStats.bothCount})
              </Button>
              <Button
                variant={meterCatFilter === "both" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs px-2.5 gap-1",
                  meterCatFilter !== "both" && "text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/10",
                )}
                onClick={() => {
                  setMeterCatFilter("both");
                  setPage(0);
                }}
              >
                <Layers className="h-3.5 w-3.5 text-purple-500" /> 2 ระบบ ({meterStats.bothCount})
              </Button>
              <Button
                variant={meterCatFilter === "none" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5 text-muted-foreground"
                onClick={() => {
                  setMeterCatFilter("none");
                  setPage(0);
                }}
              >
                ⚪ ไม่มีมิเตอร์ ({meterStats.noneCount})
              </Button>
            </div>

            {/* Toggle View Mode */}
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 text-xs px-2 gap-1 font-medium shadow-none"
                onClick={() => setViewMode("table")}
              >
                <ListIcon className="h-3.5 w-3.5" /> ตารางรวม
              </Button>
              <Button
                variant={viewMode === "grouped" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 text-xs px-2 gap-1 font-medium shadow-none"
                onClick={() => setViewMode("grouped")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> แยกหมวดหมู่มิเตอร์
              </Button>
            </div>
          </div>

          {/* แผงกรองข้อมูล */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อผู้ประกอบการ, ร้านค้า, รหัส, เบอร์โทร, เลขมิเตอร์..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>

            {/* กรองตามหมวดรหัสมิเตอร์ (Series / Prefix) */}
            <Select
              value={meterSeriesFilter}
              onValueChange={(v) => {
                setMeterSeriesFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="หมวดรหัสมิเตอร์" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวดรหัสมิเตอร์</SelectItem>
                {meterStats.elecSeriesList.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-sm my-1">
                      ⚡ หมวดมิเตอร์ไฟฟ้า
                    </div>
                    {meterStats.elecSeriesList.map((s) => (
                      <SelectItem key={`elec-${s.series}`} value={s.series}>
                        ⚡ หมวด {s.series} ({s.count} เครื่อง)
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
                        💧 หมวด {s.series} ({s.count} เครื่อง)
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="สถานะการใช้งาน" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="active">ใช้งานปกติ</SelectItem>
                <SelectItem value="registered">รอติดตั้งมิเตอร์</SelectItem>
                <SelectItem value="disconnected">ถูกตัดบริการ</SelectItem>
                <SelectItem value="pending_reconnect">รอต่อบริการ</SelectItem>
                <SelectItem value="installment">ผ่อนชำระ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Filter Tags & Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>ผลการค้นหา:</span>
              <Badge variant="outline" className="font-semibold text-foreground">
                {list.length} ราย
              </Badge>
              {q ? (
                <Badge variant="secondary" className="gap-1 font-normal">
                  คำค้น: &quot;{q}&quot;
                  <button type="button" onClick={() => setQ("")}>
                    <X className="h-3 w-3 hover:text-foreground" />
                  </button>
                </Badge>
              ) : null}
              {meterCatFilter !== "all" ? (
                <Badge variant="secondary" className="gap-1 font-normal">
                  หมวด: {meterCatFilter === "electric" ? "⚡ เฉพาะไฟฟ้า" : meterCatFilter === "water" ? "💧 เฉพาะน้ำประปา" : meterCatFilter === "both" ? "⚡💧 2 ระบบ" : "⚪ ไม่มีมิเตอร์"}
                  <button type="button" onClick={() => setMeterCatFilter("all")}>
                    <X className="h-3 w-3 hover:text-foreground" />
                  </button>
                </Badge>
              ) : null}
              {meterSeriesFilter !== "all" ? (
                <Badge variant="secondary" className="gap-1 font-normal">
                  หมวดรหัส: {meterSeriesFilter}
                  <button type="button" onClick={() => setMeterSeriesFilter("all")}>
                    <X className="h-3 w-3 hover:text-foreground" />
                  </button>
                </Badge>
              ) : null}
              {statusFilter !== "all" ? (
                <Badge variant="secondary" className="gap-1 font-normal">
                  {statusMap[statusFilter as CustomerStatus]?.label ?? statusFilter}
                  <button type="button" onClick={() => setStatusFilter("all")}>
                    <X className="h-3 w-3 hover:text-foreground" />
                  </button>
                </Badge>
              ) : null}
            </div>

            {isFiltered ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={resetFilters}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> ล้างตัวกรองทั้งหมด
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* มุมมองตารางหลัก (List View หรือ Grouped View) */}
      {viewMode === "grouped" ? (
        <div className="space-y-4">
          {groupedCategories.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                ไม่พบข้อมูลผู้ประกอบการตามเงื่อนไขที่เลือก
              </CardContent>
            </Card>
          ) : (
            groupedCategories.map((group) => {
              return (
                <Card key={group.key} className="overflow-hidden border-border/80 shadow-sm">
                  <div className="bg-muted/40 px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {group.type === "electric" ? (
                        <div className="rounded p-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <Zap className="h-4 w-4" />
                        </div>
                      ) : group.type === "water" ? (
                        <div className="rounded p-1 bg-blue-500/15 text-blue-600 dark:text-blue-400">
                          <Droplets className="h-4 w-4" />
                        </div>
                      ) : group.type === "both" ? (
                        <div className="rounded p-1 bg-purple-500/15 text-purple-600 dark:text-purple-400">
                          <Layers className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="rounded p-1 bg-muted text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          {group.title}
                          <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5", group.badgeCls)}>
                            {group.items.length} ราย
                          </Badge>
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeaderBlock />
                      <TableBody>
                        {group.items.map((c, idx) => renderCustomerRow(c, idx))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <Card className="border-border/70 shadow-xs overflow-hidden">
          <CardContent className="p-0">
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                {customers.length === 0 ? (
                  <>
                    <div className="mb-3 rounded-full bg-muted p-4">
                      <Trash2 className="h-8 w-8 text-muted-foreground/60" />
                    </div>
                    <h3 className="text-base font-semibold">ยังไม่มีข้อมูลผู้ประกอบการในระบบ</h3>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      สามารถนำเข้าข้อมูลจากไฟล์ Excel หรือกดลงทะเบียนผู้ใช้ใหม่
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button asChild size="sm">
                        <Link to="/import">
                          <FileSpreadsheet className="mr-1.5 h-4 w-4" /> ไปหน้านำเข้า Excel
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddOpen(true)}
                      >
                        <UserPlus className="mr-1.5 h-4 w-4" /> ลงทะเบียนผู้ใช้ใหม่
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-3 rounded-full bg-muted p-3">
                      <Search className="h-6 w-6 text-muted-foreground/60" />
                    </div>
                    <h3 className="text-sm font-semibold">ไม่พบผู้ประกอบการที่ค้นหา</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองที่เลือกไว้
                    </p>
                    {isFiltered ? (
                      <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={resetFilters}>
                        <RotateCcw className="mr-1 h-3 w-3" /> ล้างตัวกรองทั้งหมด
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeaderBlock />
                    <TableBody>
                      {paginatedList.map((c, i) =>
                        renderCustomerRow(c, (pageSize === "all" ? 0 : currentPage * (pageSize as number)) + i),
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-muted/10 px-5 py-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>
                      {pageSize === "all"
                        ? `แสดงผู้ประกอบการทั้งหมด ${list.length.toLocaleString()} ราย`
                        : `แสดง ${currentPage * (pageSize as number) + 1} - ${Math.min((currentPage + 1) * (pageSize as number), list.length)} จาก ${list.length.toLocaleString()} ราย`}
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
      )}

      {/* รายละเอียดผู้ประกอบการ (Dialog) */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.name}
                  <Badge variant="outline" className={displayStatus(detail.id).cls}>
                    {displayStatus(detail.id).label}
                  </Badge>
                  <Badge variant="outline" className={getCustomerMeterCategory(detail).badgeCls}>
                    {getCustomerMeterCategory(detail).label}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="font-mono text-xs">{detail.code}</DialogDescription>
              </DialogHeader>

              {/* ข้อมูลทั่วไปและหมวดหมู่มิเตอร์ */}
              <div className="divide-y divide-border">
                <Row label="เบอร์โทร" value={detail.phone || "—"} />
                <Row label="Line ID" value={detail.lineId || "—"} />
                <Row label="สถานที่" value={detail.shop} />
                
                {/* หมวดมิเตอร์ไฟฟ้า */}
                <Row
                  label="หมายเลขเครื่องวัดไฟฟ้า"
                  value={
                    detail.elecMeter ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{detail.elecMeter}</span>
                        {getCustomerMeterCategory(detail).elecPrefix && (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px]">
                            ⚡ หมวด {getCustomerMeterCategory(detail).elecPrefix}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  }
                />

                {/* หมวดมาตรวัดน้ำประปา */}
                <Row
                  label="เลขมาตรวัดน้ำประปา"
                  value={
                    detail.waterMeter ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{detail.waterMeter}</span>
                        {getCustomerMeterCategory(detail).waterPrefix && (
                          <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[11px]">
                            💧 หมวด {getCustomerMeterCategory(detail).waterPrefix}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )
                  }
                />

                <Row label="ค่าประกันมิเตอร์" value={`฿${thb(detail.depositPaid)}`} />
                <Row label="วันที่เริ่มสัญญา" value={detail.contractStart || "ไม่ระบุ"} />
              </div>

              <Separator />

              {/* สรุปยอดเรียกเก็บงวดปัจจุบันและยอดค้างชำระ */}
              <div className="space-y-4">
                {/* 1. ยอดเรียกเก็บงวดปัจจุบัน */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>ยอดเรียกเก็บงวดปัจจุบัน (งวด {periodLabel(period)})</span>
                    </div>
                    <span className="font-mono text-base font-bold text-foreground">
                      ฿{thb(currentPeriodInfo?.currentTotal ?? 0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {/* ค่าไฟฟ้า (งวดปัจจุบัน) */}
                    <div
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        (currentPeriodInfo?.elecAmount ?? 0) > 0
                          ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
                          : "border-border/60 bg-muted/20",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          <Zap className="h-3.5 w-3.5" />
                          <span>ค่าไฟฟ้า (งวด {periodLabel(period)})</span>
                        </div>
                        {currentPeriodInfo?.elecStatus === "paid" ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0"
                          >
                            ชำระแล้ว
                          </Badge>
                        ) : (currentPeriodInfo?.elecAmount ?? 0) > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0"
                          >
                            รอชำระ
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-sans">ไม่มีการใช้</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="font-mono text-lg font-bold text-foreground">
                          ฿{thb(currentPeriodInfo?.elecAmount ?? 0)}
                        </span>
                        {(currentPeriodInfo?.elecUsage ?? 0) > 0 && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {currentPeriodInfo?.elecUsage.toLocaleString()} หน่วย
                          </span>
                        )}
                      </div>
                      {currentPeriodInfo?.elecBillNo && (
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          เลขที่บิล: {currentPeriodInfo.elecBillNo}
                        </p>
                      )}
                    </div>

                    {/* ค่าน้ำประปา (งวดปัจจุบัน) */}
                    <div
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        (currentPeriodInfo?.waterAmount ?? 0) > 0
                          ? "border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10"
                          : "border-border/60 bg-muted/20",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                          <Droplets className="h-3.5 w-3.5" />
                          <span>ค่าน้ำประปา (งวด {periodLabel(period)})</span>
                        </div>
                        {currentPeriodInfo?.waterStatus === "paid" ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0"
                          >
                            ชำระแล้ว
                          </Badge>
                        ) : (currentPeriodInfo?.waterAmount ?? 0) > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[10px] px-1.5 py-0"
                          >
                            รอชำระ
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-sans">ไม่มีการใช้</span>
                        )}
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="font-mono text-lg font-bold text-foreground">
                          ฿{thb(currentPeriodInfo?.waterAmount ?? 0)}
                        </span>
                        {(currentPeriodInfo?.waterUsage ?? 0) > 0 && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {currentPeriodInfo?.waterUsage.toLocaleString()} หน่วย
                          </span>
                        )}
                      </div>
                      {currentPeriodInfo?.waterBillNo && (
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          เลขที่บิล: {currentPeriodInfo.waterBillNo}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. ยอดค้างชำระสะสม (ยอดยกมาก่อนงวดปัจจุบัน) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4",
                          (currentPeriodInfo?.pastArrearsTotal ?? 0) > 0
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      />
                      <span>ยอดค้างชำระสะสม (ยกมาก่อนงวด {periodLabel(period)})</span>
                      {arrears.length > 0 && (
                        <Badge
                          variant="outline"
                          className="border-destructive/40 bg-destructive/10 text-destructive text-[10px] px-1.5 py-0"
                        >
                          {arrears.length} เดือน
                        </Badge>
                      )}
                    </div>
                    <span
                      className={cn(
                        "font-mono text-base font-bold",
                        (currentPeriodInfo?.pastArrearsTotal ?? 0) > 0
                          ? "text-destructive"
                          : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      ฿{thb(currentPeriodInfo?.pastArrearsTotal ?? 0)}
                    </span>
                  </div>

                  {arrears.length > 0 ? (
                    <div className="rounded-lg border border-border overflow-hidden">
                      {arrears.map((a) => (
                        <div
                          key={`${a.period}-${a.division || "electric"}`}
                          className="flex items-center justify-between border-b border-border bg-card px-3 py-2 text-sm last:border-0 hover:bg-muted/20"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground font-medium">
                              ค้างชำระเดือน {periodLabel(a.period)}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                a.division === "water"
                                  ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                  : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                              )}
                            >
                              {a.division === "water" ? "💧 ค่าน้ำประปา" : "⚡ ค่าไฟฟ้า"}
                            </Badge>
                          </div>
                          <span className="font-mono font-bold text-destructive">฿{thb(a.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">ไม่มียอดค้างชำระสะสมย้อนหลัง</p>
                  )}
                </div>

                {/* 3. สรุปยอดรวมที่ต้องชำระทั้งสิ้น */}
                <div
                  className={cn(
                    "rounded-lg border p-3.5 transition-all shadow-xs",
                    (currentPeriodInfo?.grandTotal ?? 0) > 0
                      ? "border-destructive/30 bg-destructive/5 dark:bg-destructive/10"
                      : "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        ยอดรวมที่ต้องชำระทั้งสิ้น (ณ งวด {periodLabel(period)})
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        (งวดปัจจุบัน ฿{thb(currentPeriodInfo?.currentUnpaid ?? 0)} + ค้างสะสม ฿{thb(currentPeriodInfo?.pastArrearsTotal ?? 0)})
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-mono text-xl font-extrabold",
                          (currentPeriodInfo?.grandTotal ?? 0) > 0
                            ? "text-destructive"
                            : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        ฿{thb(currentPeriodInfo?.grandTotal ?? 0)}
                      </p>
                      <div className="mt-0.5 flex justify-end">
                        {(currentPeriodInfo?.grandTotal ?? 0) > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/40 bg-destructive/15 text-destructive text-[10px] px-1.5 py-0"
                          >
                            ค้างชำระ
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0"
                          >
                            ชำระครบถ้วน (ปกติ)
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />
              {/* ทะเบียนคุมรายรับและประวัติการชำระเงิน */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-semibold text-foreground">
                      ประวัติการจัดเก็บรายได้และการชำระเงิน
                    </p>
                  </div>
                  {customerPayments.length > 0 && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs"
                    >
                      รวมรับชำระ ฿{thb(totalPaidAmount)} ({customerPayments.length} รายการ)
                    </Badge>
                  )}
                </div>

                {customerPayments.length ? (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="py-2 text-xs">ใบเสร็จรับเงิน (เลขที่ / เล่มที่)</TableHead>
                          <TableHead className="py-2 text-xs">ประเภทบริการ</TableHead>
                          <TableHead className="py-2 text-xs">ประจำงวด</TableHead>
                          <TableHead className="py-2 text-xs text-right">ยอดรับชำระ</TableHead>
                          <TableHead className="py-2 text-xs">ช่องทาง</TableHead>
                          <TableHead className="py-2 text-xs">วันที่ชำระเงิน</TableHead>
                          <TableHead className="py-2 text-xs text-center">สถานะ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerPayments.map((p) => {
                          const div: "electric" | "water" =
                            p.division === "electric" || p.division === "water"
                              ? p.division
                              : p.billNo?.endsWith("W")
                              ? "water"
                              : p.billNo?.endsWith("E")
                              ? "electric"
                              : detail?.elecMeter && !detail?.waterMeter
                              ? "electric"
                              : detail?.waterMeter && !detail?.elecMeter
                              ? "water"
                              : "electric";
                          const receiptText = p.receiptNo || p.ref || "—";
                          const hasBook = Boolean(p.bookNo);
                          return (
                            <TableRow key={p.id} className="text-xs hover:bg-muted/30">
                              <TableCell className="font-mono font-medium text-foreground">
                                <div className="font-semibold text-foreground">
                                  {receiptText.includes("เลขที่") || receiptText.includes("เล่มที่") || receiptText.startsWith("RC-")
                                    ? receiptText
                                    : `เลขที่ ${receiptText}`}
                                </div>
                                {hasBook && !receiptText.includes("เล่มที่") && (
                                  <div className="text-[11px] text-muted-foreground font-sans">
                                    เล่มที่ {p.bookNo}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 whitespace-nowrap",
                                    div === "water"
                                      ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                  )}
                                >
                                  {div === "water" ? "💧 ค่าน้ำประปา" : "⚡ ค่าไฟฟ้า"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">
                                {p.periods?.map(periodLabel).join(", ") || (p.paidDate ? p.paidDate.slice(0, 7) : "—")}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                ฿{thb(p.amount)}
                              </TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap">
                                {p.method === "online" ? "โอนเงิน/QR" : "เคาน์เตอร์"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <div className="font-semibold text-foreground">
                                  {formatThaiDate(p.paidDate || p.paidAt)}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {p.paidDate || p.paidAt?.slice(0, 10) || "—"}
                                </div>
                              </TableCell>
                              <TableCell className="text-center whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className="border-success/40 bg-success/15 text-success text-[10px] px-1.5 py-0.5"
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> ชำระแล้ว
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      ยังไม่มีประวัติการจัดเก็บรายได้/ชำระเงินที่บันทึกไว้ในระบบ
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      สามารถนำเข้าไฟล์ Excel ทะเบียนคุมรายรับได้จากเมนู &quot;นำข้อมูลเข้า Excel&quot;
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between w-full">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const target = detail;
                    setDetailId(null);
                    setDeleteConfirmCust(target);
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> ลบผู้ประกอบการ
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      startEdit(detail);
                      setDetailId(null);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="mr-1 h-4 w-4" /> แก้ไขข้อมูล
                  </Button>
                  <Button onClick={() => setDetailId(null)}>ปิด</Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ลงทะเบียนผู้ใช้ใหม่ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>ลงทะเบียนผู้ขอใช้บริการใหม่</DialogTitle>
            <DialogDescription>
              รับเงินประกันมิเตอร์ (ค่าเริ่มต้นรวม ฿
              {thb(settings.depositElectric + settings.depositWater)}) → ออกใบเสร็จ →
              ส่งกองช่างติดตั้งมิเตอร์
            </DialogDescription>
          </DialogHeader>
          <CustomerForm form={form} set={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              <X className="mr-1 h-4 w-4" /> ยกเลิก
            </Button>
            <Button
              disabled={!form.name || !form.shop}
              onClick={() => {
                addCustomer({
                  name: form.name,
                  shop: form.shop,
                  phone: form.phone,
                  lineId: form.lineId,
                  elecMeter: form.elecMeter,
                  waterMeter: form.waterMeter,
                  depositPaid: Number(form.depositPaid) || 0,
                  contractStart: form.noContractDate ? "" : form.contractStart,
                });
                setForm(emptyForm);
                setAddOpen(false);
              }}
            >
              <Save className="mr-1 h-4 w-4" /> บันทึกและรับเงินประกัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* แก้ไขข้อมูล: ค้นหาก่อน แล้วจึงแก้ไข */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `แก้ไขข้อมูล · ${editing.name}` : "แก้ไขข้อมูลผู้ประกอบการ"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `รหัส ${editing.code}`
                : "ค้นหาชื่อผู้ประกอบการหรือชื่อร้านค้าที่ต้องการแก้ไข"}
            </DialogDescription>
          </DialogHeader>

          {!editing ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  className="pl-9"
                  placeholder="ค้นหาชื่อ / ร้านค้า"
                  value={editQ}
                  onChange={(e) => setEditQ(e.target.value)}
                />
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                {editList.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    ไม่พบผู้ประกอบการที่ค้นหา
                  </p>
                ) : (
                  editList.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => startEdit(c)}
                      className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted"
                    >
                      <span>
                        <span className="block text-sm font-medium">{c.name}</span>
                        <span className="block text-xs text-muted-foreground">{c.shop}</span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <CustomerForm form={form} set={setForm} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  ค้นหาใหม่
                </Button>
                <Button
                  onClick={() => {
                    updateCustomer({
                      ...editing,
                      name: form.name,
                      shop: form.shop,
                      phone: form.phone,
                      lineId: form.lineId,
                      elecMeter: form.elecMeter,
                      waterMeter: form.waterMeter,
                      depositPaid: Number(form.depositPaid) || 0,
                      contractStart: form.noContractDate ? "" : form.contractStart,
                    });
                    setEditing(null);
                    setEditOpen(false);
                  }}
                >
                  <Save className="mr-1 h-4 w-4" /> บันทึก
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ยืนยันการล้างข้อมูล */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-destructive">ยืนยันการล้างข้อมูลผู้ประกอบการ?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1 text-sm text-foreground">
                <p>
                  คุณต้องการลบข้อมูลผู้ประกอบการทั้งหมดจำนวน{" "}
                  <span className="font-semibold text-destructive">{customers.length} รายการ</span>{" "}
                  ใช่หรือไม่?
                </p>
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-destructive mb-1">ผลกระทบจากการล้างข้อมูล:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>ข้อมูลผู้ประกอบการทั้งหมดจะถูกลบออกจากระบบ</li>
                    <li>ประวัติการจดมิเตอร์ไฟฟ้าและประปาจะถูกล้าง</li>
                    <li>ใบแจ้งหนี้และประวัติการจัดเก็บรายรับที่เชื่อมโยงจะถูกล้าง</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  * สามารถนำเข้าข้อมูลผู้ประกอบการใหม่จากไฟล์ Excel หรือลงทะเบียนใหม่ได้ตลอดเวลา
                </p>
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
                clearCustomers();
                setClearOpen(false);
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> ยืนยันล้างข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ยืนยันการลบผู้ประกอบการรายเดี่ยว */}
      <Dialog open={!!deleteConfirmCust} onOpenChange={(o) => !o && setDeleteConfirmCust(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-destructive">ยืนยันการลบผู้ประกอบการ?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1 text-sm text-foreground">
                <p>
                  คุณต้องการลบข้อมูลผู้ประกอบการ{" "}
                  <span className="font-semibold text-foreground">{deleteConfirmCust?.name}</span> (รหัส{" "}
                  <span className="font-mono font-semibold">{deleteConfirmCust?.code}</span>) ใช่หรือไม่?
                </p>
                <p className="text-xs text-muted-foreground">
                  ข้อมูลเลขมิเตอร์และประวัติการใช้บริการที่เกี่ยวข้องกับผู้ประกอบการรายนี้จะถูกลบออกจากระบบ
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmCust(null)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmCust) {
                  deleteCustomer(deleteConfirmCust.id);
                  setDeleteConfirmCust(null);
                }
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> ยืนยันลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
