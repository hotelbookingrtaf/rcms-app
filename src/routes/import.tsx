import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Droplets,
  RotateCcw,
  Search,
  Check,
  ArrowRight,
  Lock,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  findMatchingCustomer,
  calculateElectricBill,
} from "@/lib/rcms-store";
import { CURRENT_PERIOD } from "@/lib/rcms-seed";
import {
  validateWorkbookFile,
  workbookFingerprint,
  parseReadingWorkbook,
  parseRevenueWorkbook,
  parseArrearsWorkbook,
  MONTH_DISPLAY_LABELS,
  type ImportRow,
  type RevenueImportRow,
  type ArrearsLedgerRow,
} from "@/lib/excel-import";
import { cn } from "@/lib/utils";
import type { Division, Customer } from "@/lib/rcms-types";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "นำข้อมูลเข้า Excel · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "ระบบนำเข้าข้อมูล Excel: เลขจดมิเตอร์สาธารณูปโภค และ ทะเบียนจัดเก็บรายได้",
      },
      { property: "og:title", content: "นำข้อมูลเข้า Excel · RCMS" },
      { property: "og:description", content: "Excel Data Ingestion" },
    ],
  }),
  component: ImportExcelPage,
});

type ImportMode = "readings" | "revenue";

interface VerifiedReadingRow extends ImportRow {
  index: number;
  matchedCustomer?: Customer | undefined;
  status: "valid" | "warning" | "error";
  reasons: string[];
  calculatedUsed: number;
  meterTypeDisplay: string;
  prevDisplay: string;
  currDisplay: string;
  usedDisplay: string;
  baseAmountDisplay: string;
  ftAmountDisplay: string;
  serviceFeeDisplay: string;
  subtotalDisplay: string;
  vatAmountDisplay: string;
  totalAmountDisplay: string;
  rawBaseAmount: number;
  rawFtAmount: number;
  rawServiceFee: number;
  rawSubtotal: number;
  rawVatAmount: number;
  rawTotalAmount: number;
}

function getDateRangeFromPeriod(periodStr: string): string {
  if (!periodStr) return "";
  const [yStr, mStr] = periodStr.split("-");
  const year = parseInt(yStr ?? "2569", 10);
  const month = parseInt(mStr ?? "8", 10);
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMonthStr = String(prevMonth).padStart(2, "0");
  const monthName = MONTH_DISPLAY_LABELS[prevMonthStr] || `${prevMonth}`;
  const yearShort = prevYear.toString().slice(-2);
  const adYear = prevYear > 2400 ? prevYear - 543 : prevYear;
  const daysInMonth = new Date(adYear, prevMonth, 0).getDate();
  return `1 ${monthName}${yearShort} - ${daysInMonth} ${monthName}${yearShort}`;
}

interface VerifiedRevenueRow extends RevenueImportRow {
  index: number;
  matchedCustomer?: Customer | undefined;
  status: "valid" | "warning" | "error";
  reasons: string[];
}

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

/**
 * ปฏิทินเลือกเฉพาะเดือน (Month-only Calendar Picker)
 */
function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const currentYear = useMemo(() => {
    if (value && value.includes("-")) {
      const y = parseInt(value.split("-")[0] ?? "2569", 10);
      if (!isNaN(y)) return y;
    }
    return 2569;
  }, [value]);

  const [displayYear, setDisplayYear] = useState<number>(currentYear);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 w-full justify-between bg-card text-left font-normal border shadow-xs transition-all",
            value === "" && "border-dashed border-warning text-muted-foreground",
            open && "ring-2 ring-primary border-primary",
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
            {value ? (
              <span className="font-semibold text-foreground truncate">
                งวด {periodFullThai(value)} ({value})
              </span>
            ) : (
              <span className="text-muted-foreground">-- คลิกเพื่อเปิดปฏิทินเลือกเดือน --</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">ปฏิทินเดือน ▾</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4" align="start">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDisplayYear((y) => y - 1)}
            title="ปีก่อนหน้า"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-center">
            <p className="font-bold text-sm text-foreground">พ.ศ. {displayYear}</p>
            <p className="text-[11px] text-muted-foreground">(ค.ศ. {displayYear - 543})</p>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDisplayYear((y) => y + 1)}
            title="ปีถัดไป"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 py-3">
          {THAI_MONTHS.map((m) => {
            const periodKey = `${displayYear}-${m.num}`;
            const isSelected = value === periodKey;
            const isCurrent = CURRENT_PERIOD === periodKey;

            return (
              <button
                key={m.num}
                type="button"
                onClick={() => {
                  onChange(periodKey);
                  setOpen(false);
                }}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg p-2.5 text-xs transition-all cursor-pointer",
                  isSelected
                    ? "bg-primary text-primary-foreground font-bold shadow-xs scale-102"
                    : isCurrent
                      ? "border border-primary/50 bg-primary/10 text-primary font-semibold hover:bg-primary/20"
                      : "border border-transparent bg-muted/50 hover:bg-muted text-foreground",
                )}
              >
                <span className="text-sm font-semibold">{m.name}</span>
                <span className="text-[10px] opacity-75">{m.full}</span>
                {isCurrent && (
                  <span className="mt-0.5 text-[9px] font-medium text-primary">งวดปัจจุบัน</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary"
            onClick={() => {
              setDisplayYear(2569);
              onChange(CURRENT_PERIOD);
              setOpen(false);
            }}
          >
            เลือกงวดปัจจุบัน ({periodLabel(CURRENT_PERIOD)})
          </Button>

          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              ล้างค่า
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ImportExcelPage() {
  const {
    customers,
    setPeriod,
    importReadings,
    importRevenueLedger,
    importArrearsLedger,
    readings,
    bills,
    payments,
    clearAllData,
    clearReadings,
    settings,
  } = useRcms();

  // Mode Selection: "readings" | "revenue"
  const [importMode, setImportMode] = useState<ImportMode>("readings");

  // Clear Database Dialog State
  const [clearDbOpen, setClearDbOpen] = useState(false);
  const [clearDbOption, setClearDbOption] = useState<"all" | "readings">("all");

  // Mode 1: Utility Readings
  const [selectedDivision, setSelectedDivision] = useState<Division | "">("electric");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  // Mode 2: Revenue Ledger
  const [selectedRevenueDivision, setSelectedRevenueDivision] = useState<Division>("electric");
  const [selectedRevenuePeriod, setSelectedRevenuePeriod] = useState<string>("");

  // Common file and parsing state
  const [file, setFile] = useState<File | null>(null);
  const [fingerprint, setFingerprint] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "valid" | "warning" | "error">("all");
  const [selectedSheet, setSelectedSheet] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Specific parsed rows
  const [readingRows, setReadingRows] = useState<ImportRow[]>([]);
  const [revenueRows, setRevenueRows] = useState<RevenueImportRow[]>([]);
  const [arrearsRows, setArrearsRows] = useState<ArrearsLedgerRow[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableSheets = useMemo(() => {
    let list: string[] = [];
    if (importMode === "readings") {
      list = readingRows.map((r) => r.sheet).filter(Boolean);
    } else if (arrearsRows.length > 0) {
      list = arrearsRows.map((r) => r.sheet).filter(Boolean);
    } else if (revenueRows.length > 0) {
      list = revenueRows.map((r) => r.sheet).filter(Boolean);
    }
    const counts = new Map<string, number>();
    list.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [importMode, readingRows, arrearsRows, revenueRows]);

  // Switch import mode & reset
  const handleSwitchMode = (mode: ImportMode) => {
    setImportMode(mode);
    setFile(null);
    setFingerprint("");
    setReadingRows([]);
    setRevenueRows([]);
    setArrearsRows([]);
    setImportSuccess(false);
    setQ("");
    setSelectedSheet("all");
    setPage(0);
    setFilterStatus("all");
    setSelectedRevenuePeriod("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleResetFile = () => {
    setFile(null);
    setFingerprint("");
    setReadingRows([]);
    setRevenueRows([]);
    setArrearsRows([]);
    setImportSuccess(false);
    setQ("");
    setSelectedSheet("all");
    setPage(0);
    setFilterStatus("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Readiness check: reading mode requires utility & period; revenue mode requires period selection!
  const isReadingReady = selectedDivision !== "" && selectedPeriod !== "";
  const isRevenueReady = Boolean(selectedRevenueDivision) && selectedRevenuePeriod !== "";

  const isCurrentModeReady = importMode === "readings" ? isReadingReady : isRevenueReady;

  // 1. Verify Reading Rows with complete breakdown columns according to Image 2
  const verifiedReadingRows: VerifiedReadingRow[] = useMemo(() => {
    if (!readingRows.length || !selectedDivision || !selectedPeriod) return [];

    return readingRows.map((row, i) => {
      const targetDiv = row.division || selectedDivision;
      const meter = (row.meter ?? "").toString().trim();
      const name = (row.name ?? "").toString().trim();
      const shop = (row.shop ?? "").toString().trim();
      const reasons: string[] = [];
      let status: "valid" | "warning" | "error" = "valid";

      const matched = findMatchingCustomer(customers, meter, name, shop, targetDiv);

      if (!matched) {
        status = "warning";
        reasons.push(
          meter
            ? `ไม่พบมิเตอร์ ${meter} ในระบบ (จะลงทะเบียนผู้ใช้ใหม่อัตโนมัติ)`
            : `ไม่พบ ${name || shop} ในระบบ (จะลงทะเบียนผู้ใช้ใหม่อัตโนมัติ)`,
        );
      }

      if (row.curr === undefined || Number.isNaN(row.curr)) {
        status = "error";
        reasons.push("ไม่พบตัวเลขจดครั้งหลัง");
      }

      const existingReading = matched
        ? readings.find(
            (r) =>
              r.customerId === matched.id &&
              r.division === targetDiv &&
              r.period === selectedPeriod,
          )
        : undefined;

      const prevVal = row.prev ?? existingReading?.prev ?? 0;
      const currVal = row.curr ?? 0;
      const calculatedUsed = row.used !== undefined ? row.used : (currVal >= prevVal ? currVal - prevVal : 0);

      if (row.curr !== undefined && row.prev !== undefined && row.curr < row.prev) {
        status = "error";
        reasons.push(`เลขจดครั้งหลัง (${row.curr}) น้อยกว่าครั้งก่อน (${row.prev})`);
      } else if (calculatedUsed > 5000) {
        if (status !== "error") status = "warning";
        reasons.push(`หน่วยใช้สูงผิดปกติ (${calculatedUsed.toLocaleString()} หน่วย)`);
      }

      if (status === "valid" && !reasons.length) {
        reasons.push("ข้อมูลถูกต้อง ตรงกับฐานข้อมูล");
      }

      // Exact breakdown calculation & fallback according to Image 2
      let baseAmount = row.baseAmount;
      let ftAmount = row.ftAmount;
      let serviceFee = row.serviceFee;
      let subtotal = row.subtotal;
      let vatAmount = row.vatAmount;
      let totalAmount = row.totalAmount ?? row.amount;

      if (targetDiv === "electric") {
        const calc = calculateElectricBill(calculatedUsed, {
          ft: row.ftRate ?? settings.ft ?? 0.1623,
          serviceFee: settings.serviceFee ?? 33.29,
          vatPercent: row.vatRate ?? settings.vatPercent ?? 7,
          electricRate: settings.electricRate ?? 3.2484,
        });
        if (baseAmount === undefined) baseAmount = calc.baseEnergy;
        if (ftAmount === undefined) ftAmount = calc.ftAmount;
        if (serviceFee === undefined) serviceFee = calc.serviceFee;
        if (subtotal === undefined) subtotal = calc.subtotal;
        if (vatAmount === undefined) vatAmount = calc.vatAmount;
        if (totalAmount === undefined) totalAmount = calc.totalDue;
      } else {
        const waterRate = settings.waterRate ?? 10.0;
        if (baseAmount === undefined) baseAmount = +(calculatedUsed * waterRate).toFixed(2);
        if (ftAmount === undefined) ftAmount = 0;
        if (serviceFee === undefined) serviceFee = 0;
        if (subtotal === undefined) subtotal = baseAmount;
        if (vatAmount === undefined) vatAmount = +((subtotal * (settings.vatPercent ?? 7)) / 100).toFixed(2);
        if (totalAmount === undefined) totalAmount = +(subtotal + vatAmount).toFixed(2);
      }

      const prevDisplay = row.prevRaw || (row.prev !== undefined ? row.prev.toLocaleString() : "—");
      const currDisplay = row.currRaw || (row.curr !== undefined ? row.curr.toLocaleString() : "—");
      const usedDisplay = calculatedUsed.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const baseAmountDisplay = (baseAmount ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const ftAmountDisplay = (ftAmount ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const serviceFeeDisplay = (serviceFee ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subtotalDisplay = (subtotal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const vatAmountDisplay = (vatAmount ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const totalAmountDisplay = (totalAmount ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      return {
        ...row,
        index: i + 1,
        matchedCustomer: matched,
        status,
        reasons,
        calculatedUsed,
        meterTypeDisplay: row.meterType ? String(row.meterType) : "2",
        prevDisplay,
        currDisplay,
        usedDisplay,
        baseAmountDisplay,
        ftAmountDisplay,
        serviceFeeDisplay,
        subtotalDisplay,
        vatAmountDisplay,
        totalAmountDisplay,
        rawBaseAmount: baseAmount ?? 0,
        rawFtAmount: ftAmount ?? 0,
        rawServiceFee: serviceFee ?? 0,
        rawSubtotal: subtotal ?? 0,
        rawVatAmount: vatAmount ?? 0,
        rawTotalAmount: totalAmount ?? 0,
      };
    });
  }, [readingRows, customers, selectedDivision, selectedPeriod, readings, settings]);

  // 2. Verify Revenue Rows
  const verifiedRevenueRows: VerifiedRevenueRow[] = useMemo(() => {
    if (!revenueRows.length) return [];

    return revenueRows.map((row, i) => {
      const name = (row.name ?? "").trim();
      const shop = (row.shop ?? "").trim();
      const meter = (row.meter ?? "").trim();
      const rowDiv = row.division || selectedRevenueDivision || "electric";
      const reasons: string[] = [];
      let status: "valid" | "warning" | "error" = "valid";

      if (!row.amount || isNaN(row.amount) || row.amount <= 0) {
        status = "error";
        reasons.push("ยอดเงินไม่ถูกต้อง");
      }

      const matched = findMatchingCustomer(customers, meter, name, shop, rowDiv);

      if (!matched) {
        if (status !== "error") status = "warning";
        reasons.push("ไม่พบชื่อในฐานข้อมูล (จะบันทึกเป็นรายการรับทั่วไป)");
      } else {
        reasons.push(`จับคู่ผู้ประกอบการ ${matched.code} สำเร็จ`);
      }

      return {
        ...row,
        index: i + 1,
        matchedCustomer: matched,
        status,
        reasons,
      };
    });
  }, [revenueRows, customers, selectedRevenueDivision]);

  // 3. Verify Arrears Rows
  const verifiedArrearsRows = useMemo(() => {
    if (!arrearsRows.length) return [];

    return arrearsRows.map((row, i) => {
      const name = row.name.trim();
      const shop = row.shop.trim();
      const meter = row.meter.trim();
      const rowDiv = row.division || selectedRevenueDivision || "electric";

      const matched = findMatchingCustomer(customers, meter, name, shop, rowDiv);

      return {
        ...row,
        index: i + 1,
        matchedCustomer: matched,
      };
    });
  }, [arrearsRows, customers, selectedRevenueDivision]);

  // Handle File Process for different modes
  const handleFileProcess = async (selectedFile: File) => {
    if (!isCurrentModeReady) {
      toast.error(
        importMode === "revenue"
          ? "กรุณาเลือกเดือนที่ต้องการนำเข้าข้อมูลจากปฏิทินเดือนก่อนแนบไฟล์"
          : "กรุณาระบุเงื่อนไขที่จำเป็นก่อนนำเข้าไฟล์",
      );
      return;
    }

    setIsProcessing(true);
    setImportSuccess(false);
    try {
      const fileError = validateWorkbookFile(selectedFile);
      if (fileError) {
        toast.error(fileError);
        return;
      }

      const fp = await workbookFingerprint(selectedFile);

      if (importMode === "readings") {
        const parsed = await parseReadingWorkbook(selectedFile, (selectedDivision as Division) || "electric");
        if (!parsed.length) {
          toast.error("อ่านไฟล์ไม่พบข้อมูลเลขจดมิเตอร์ตามรูปแบบที่กำหนด");
          return;
        }
        const detectedDiv = parsed[0]?.division || (selectedDivision as Division) || "electric";
        if (selectedDivision !== detectedDiv) {
          setSelectedDivision(detectedDiv);
          toast.info(
            `ระบบตรวจพบข้อมูล${detectedDiv === "water" ? "💧 ค่าน้ำประปา" : "⚡ ค่าไฟฟ้า"} ในไฟล์ — ปรับระบบเป็น${detectedDiv === "water" ? "น้ำประปา" : "ไฟฟ้า"}อัตโนมัติ`,
          );
        }
        setReadingRows(parsed);
        const sheets = Array.from(new Set(parsed.map((r) => r.sheet).filter(Boolean)));
        toast.success(
          `อ่านข้อมูลเลขจดสำเร็จครบทุกหน้า (${sheets.length} แผ่นงาน: ${sheets.join(", ")}) รวม ${parsed.length} รายการ — เข้าสู่การตรวจสอบก่อนนำเข้า`,
        );
      } else if (importMode === "revenue") {
        const targetDiv: Division = selectedRevenueDivision || "electric";
        const parsedArrears = await parseArrearsWorkbook(selectedFile, targetDiv);
        if (parsedArrears.length > 0) {
          const finalArrears = parsedArrears.map((r) => ({
            ...r,
            division: r.division || targetDiv,
          }));
          setArrearsRows(finalArrears);
          setRevenueRows([]);
          const elecCount = finalArrears.filter((r) => r.division === "electric").length;
          const waterCount = finalArrears.filter((r) => r.division === "water").length;
          const detectedDiv: Division = elecCount >= waterCount ? "electric" : "water";
          setSelectedRevenueDivision(detectedDiv);
          const sheets = Array.from(new Set(finalArrears.map((r) => r.sheet).filter(Boolean)));
          toast.success(
            `อ่านข้อมูลตารางค้างชำระสำเร็จ (${sheets.length} แผ่นงาน: ${sheets.join(", ")}) รวม ${finalArrears.length} รายการ [จัดเก็บลง: ${detectedDiv === "electric" ? "⚡ กองไฟฟ้า (ค่าไฟฟ้า)" : "💧 กองประปา (ค่าน้ำประปา)"}]`,
          );
        } else {
          const parsed = await parseRevenueWorkbook(selectedFile, targetDiv);
          if (!parsed.length) {
            toast.error("อ่านไฟล์ไม่พบข้อมูลทะเบียนจัดเก็บรายได้ตามรูปแบบที่กำหนด");
            return;
          }
          const finalRevenue = parsed.map((r) => ({
            ...r,
            division: r.division || targetDiv,
          }));
          setRevenueRows(finalRevenue);
          setArrearsRows([]);
          const elecCount = finalRevenue.filter((r) => r.division === "electric").length;
          const waterCount = finalRevenue.filter((r) => r.division === "water").length;
          const detectedDiv: Division = elecCount >= waterCount ? "electric" : "water";
          setSelectedRevenueDivision(detectedDiv);
          const sheets = Array.from(new Set(finalRevenue.map((r) => r.sheet).filter(Boolean)));
          toast.success(
            `อ่านข้อมูลทะเบียนรายได้สำเร็จ (${sheets.length} แผ่นงาน: ${sheets.join(", ")}) รวม ${finalRevenue.length} รายการ [จัดเก็บลง: ${detectedDiv === "electric" ? "⚡ กองไฟฟ้า (ค่าไฟฟ้า)" : "💧 กองประปา (ค่าน้ำประปา)"}]`,
          );
        }
      }

      setFile(selectedFile);
      setFingerprint(fp);
    } catch {
      toast.error("เกิดข้อผิดพลาดในการอ่านไฟล์ Excel");
    } finally {
      setIsProcessing(false);
    }
  };

  // Commit Import actions
  const handleConfirmImport = () => {
    if (importMode === "readings") {
      if (!readingRows.length || !selectedDivision || !selectedPeriod) {
        toast.error("ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบระบบและงวดบิล");
        return;
      }
      const res = importReadings(selectedDivision, readingRows, fingerprint, selectedPeriod);
      if (res.duplicate) return;
      setImportSuccess(true);
      setPeriod(selectedPeriod);
      toast.success(
        `นำเข้าข้อมูลสำเร็จ! จัดเก็บลงในระบบ${selectedDivision === "electric" ? "ไฟฟ้า" : "น้ำประปา"} งวด ${periodLabel(selectedPeriod)} (จับคู่สำเร็จ ${res.matched} รายการ)`,
      );
    } else if (importMode === "revenue") {
      const targetDiv: Division = selectedRevenueDivision || "electric";
      if (arrearsRows.length > 0) {
        const rowsToImport = arrearsRows.map((r) => ({
          ...r,
          division: targetDiv,
        }));
        const res = importArrearsLedger(rowsToImport, targetDiv);
        setImportSuccess(true);
        if (selectedRevenuePeriod) {
          setPeriod(selectedRevenuePeriod);
        }
        toast.success(
          `นำเข้าและจัดเก็บข้อมูลลงใน${targetDiv === "electric" ? "⚡ กองไฟฟ้า (ค่าไฟฟ้า)" : "💧 กองประปา (ค่าน้ำประปา)"}สำเร็จ! (ปรับปรุง ${res.updatedCount} ราย, เพิ่มใหม่ ${res.addedCount} ราย, ยอดค้างรวม ฿${thb(res.totalArrearsImported)})`,
        );
      } else if (revenueRows.length > 0) {
        const rowsToImport = revenueRows.map((r) => ({
          ...r,
          division: targetDiv,
        }));
        const res = importRevenueLedger(
          rowsToImport,
          selectedRevenuePeriod || CURRENT_PERIOD,
          targetDiv,
        );
        setImportSuccess(true);
        if (selectedRevenuePeriod) {
          setPeriod(selectedRevenuePeriod);
        }
        toast.success(
          `นำเข้าทะเบียนจัดเก็บรายได้งวด ${periodLabel(selectedRevenuePeriod || CURRENT_PERIOD)} ลงใน${targetDiv === "electric" ? "⚡ กองไฟฟ้า (ค่าไฟฟ้า)" : "💧 กองประปา (ค่าน้ำประปา)"}สำเร็จ! (บันทึกรับชำระ ${res.matched} รายการ ยอดรวม ฿${thb(res.totalAmount)})`,
        );
      }
    }
  };

  // Filtered rows display
  const displayedReadingRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return verifiedReadingRows.filter((r) => {
      const matchSearch =
        !term ||
        r.name.toLowerCase().includes(term) ||
        r.shop.toLowerCase().includes(term) ||
        r.meter.toLowerCase().includes(term) ||
        r.sheet.toLowerCase().includes(term) ||
        (r.matchedCustomer?.code && r.matchedCustomer.code.toLowerCase().includes(term));
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      const matchSheet = selectedSheet === "all" || r.sheet === selectedSheet;
      return matchSearch && matchStatus && matchSheet;
    });
  }, [verifiedReadingRows, q, filterStatus, selectedSheet]);

  const displayedRevenueRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return verifiedRevenueRows.filter((r) => {
      const matchSearch =
        !term ||
        r.name.toLowerCase().includes(term) ||
        r.shop.toLowerCase().includes(term) ||
        r.receiptNo.toLowerCase().includes(term) ||
        r.ref.toLowerCase().includes(term) ||
        r.sheet.toLowerCase().includes(term);
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      const matchSheet = selectedSheet === "all" || r.sheet === selectedSheet;
      return matchSearch && matchStatus && matchSheet;
    });
  }, [verifiedRevenueRows, q, filterStatus, selectedSheet]);

  const displayedArrearsRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return verifiedArrearsRows.filter((r) => {
      const matchSearch =
        !term ||
        r.name.toLowerCase().includes(term) ||
        r.shop.toLowerCase().includes(term) ||
        r.meter.toLowerCase().includes(term) ||
        r.sheet.toLowerCase().includes(term) ||
        (r.matchedCustomer?.code && r.matchedCustomer.code.toLowerCase().includes(term));
      const matchSheet = selectedSheet === "all" || r.sheet === selectedSheet;
      return matchSearch && matchSheet;
    });
  }, [verifiedArrearsRows, q, selectedSheet]);

  return (
    <>
      <PageHeader
        title="นำข้อมูลเข้า Excel"
        desc="ระบบนำเข้าข้อมูลและตรวจสอบความถูกต้องก่อนบันทึก · เลขจดมิเตอร์สาธารณูปโภค และ ทะเบียนจัดเก็บรายได้"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-9"
              onClick={() => {
                setClearDbOption("all");
                setClearDbOpen(true);
              }}
              disabled={customers.length === 0 && readings.length === 0 && bills.length === 0 && payments.length === 0}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> ล้างฐานข้อมูลนำเข้าทั้งหมด
            </Button>
          </div>
        }
      />

      {/* Mode Selector Tabs / Buttons (2 Primary Modes) */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <button
          type="button"
          onClick={() => handleSwitchMode("readings")}
          className={cn(
            "flex items-start gap-4 p-5 rounded-xl border text-left transition-all cursor-pointer shadow-xs",
            importMode === "readings"
              ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
              : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 text-foreground",
          )}
        >
          <div
            className={cn(
              "grid h-12 w-12 shrink-0 place-items-center rounded-xl",
              importMode === "readings" ? "bg-primary text-primary-foreground font-bold" : "bg-primary/10 text-primary",
            )}
          >
            <Zap className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-base text-foreground">เลขจดมิเตอร์สาธารณูปโภค</p>
              {importMode === "readings" && (
                <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              นำเข้าเลขจดมิเตอร์ไฟฟ้าและน้ำประปา แยกตามประเภทและงวดบิล
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchMode("revenue")}
          className={cn(
            "flex items-start gap-4 p-5 rounded-xl border text-left transition-all cursor-pointer shadow-xs",
            importMode === "revenue"
              ? "border-emerald-600 bg-emerald-500/10 text-foreground ring-2 ring-emerald-500/30"
              : "border-border bg-card hover:border-emerald-500/40 hover:bg-muted/40 text-foreground",
          )}
        >
          <div
            className={cn(
              "grid h-12 w-12 shrink-0 place-items-center rounded-xl",
              importMode === "revenue"
                ? "bg-emerald-600 text-white font-bold"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
            )}
          >
            <Receipt className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-base text-foreground">ข้อมูลจัดเก็บรายได้</p>
              {importMode === "revenue" && (
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              นำเข้าทะเบียนคุมรายรับและรายการชำระเงิน ฝ่ายจัดเก็บรายได้
            </p>
          </div>
        </button>
      </div>

      {/* Step 1: Configuration according to active mode */}
      {importMode === "readings" && (
        <Card
          className={`mb-6 border-2 transition-all ${
            isReadingReady ? "border-primary/40 bg-card" : "border-warning/60 bg-warning/5"
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  1
                </span>
                <CardTitle className="text-base font-semibold">
                  ระบุระบบสาธารณูปโภคและงวดบิลที่ต้องการนำเข้า (จำเป็นต้องเลือกก่อน)
                </CardTitle>
              </div>
              {isReadingReady && (
                <Badge variant="outline" className="border-success/40 bg-success/15 text-success">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> เลือกเงื่อนไขครบถ้วนแล้ว
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              ระบบจะจัดเก็บข้อมูลที่นำเข้าลงในประเภทสาธารณูปโภคและรอบเดือนที่ท่านกำหนดไว้ในขั้นตอนนี้
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    1. เลือกระบบสาธารณูปโภค <span className="text-destructive">*</span>
                  </label>
                  {selectedDivision === "" && (
                    <span className="text-[11px] font-medium text-destructive">ยังไม่ได้เลือก</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDivision("electric");
                      if (file) handleResetFile();
                    }}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition-all cursor-pointer ${
                      selectedDivision === "electric"
                        ? "border-amber-600 bg-amber-600 text-white shadow-xs"
                        : "border-border bg-card hover:border-amber-500/50 hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                    <span>ระบบไฟฟ้า</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDivision("water");
                      if (file) handleResetFile();
                    }}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition-all cursor-pointer ${
                      selectedDivision === "water"
                        ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                        : "border-border bg-card hover:border-blue-500/50 hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <Droplets className="h-4 w-4" />
                    <span>ระบบน้ำประปา</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    2. เลือกงวดบิลที่ต้องการนำเข้า (ปฏิทินเดือน) <span className="text-destructive">*</span>
                  </label>
                  {selectedPeriod === "" && (
                    <span className="text-[11px] font-medium text-destructive">ยังไม่ได้เลือก</span>
                  )}
                </div>
                <MonthPicker
                  value={selectedPeriod}
                  onChange={(p) => {
                    setSelectedPeriod(p);
                    if (file) handleResetFile();
                  }}
                />
              </div>
            </div>

            {!isReadingReady && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                <span>
                  <strong>โปรดทราบ:</strong> ท่านต้องเลือกระบบสาธารณูปโภค (ไฟฟ้า/น้ำประปา) และงวดบิลจากปฏิทินให้ครบถ้วนก่อน จึงจะสามารถอัปโหลดไฟล์ Excel ได้
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {importMode === "revenue" && (
        <Card className="mb-6 border-2 border-emerald-500/40 bg-card">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  1
                </span>
                <CardTitle className="text-base font-semibold">
                  ระบุระบบสาธารณูปโภคและรอบเดือนที่ต้องการนำเข้า (ข้อมูลจัดเก็บรายได้)
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {selectedRevenuePeriod ? (
                  <Badge variant="outline" className="border-success/40 bg-success/15 text-success">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> เลือกงวดเดือนเรียบร้อยแล้ว ({periodLabel(selectedRevenuePeriod)})
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-destructive/40 bg-destructive/15 text-destructive font-medium"
                  >
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" /> ยังไม่ได้เลือกเดือน
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                >
                  <Receipt className="mr-1 h-3.5 w-3.5" /> ฝ่ายจัดเก็บรายได้ ชย.ทอ.
                </Badge>
              </div>
            </div>
            <CardDescription className="text-xs mt-1 text-muted-foreground">
              เลือกระบบสาธารณูปโภคและรอบเดือนที่ต้องการนำเข้า (ตารางค้างชำระ / ทะเบียนคุมรายรับ) ข้อมูลจะถูกจัดเก็บลงในระบบที่ท่านเลือก
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    1. เลือกระบบสาธารณูปโภคที่นำเข้า <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {selectedRevenueDivision === "electric" ? "⚡ กองไฟฟ้า (ค่าไฟฟ้า)" : "💧 กองประปา (ค่าน้ำประปา)"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRevenueDivision("electric");
                      if (file) {
                        setArrearsRows((prev) => prev.map((r) => ({ ...r, division: "electric" })));
                        setRevenueRows((prev) => prev.map((r) => ({ ...r, division: "electric" })));
                      }
                    }}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition-all cursor-pointer ${
                      selectedRevenueDivision === "electric"
                        ? "border-amber-600 bg-amber-600 text-white shadow-xs"
                        : "border-border bg-card hover:border-amber-500/50 hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                    <span>⚡ ค่าไฟฟ้า (กองไฟฟ้า)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRevenueDivision("water");
                      if (file) {
                        setArrearsRows((prev) => prev.map((r) => ({ ...r, division: "water" })));
                        setRevenueRows((prev) => prev.map((r) => ({ ...r, division: "water" })));
                      }
                    }}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition-all cursor-pointer ${
                      selectedRevenueDivision === "water"
                        ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                        : "border-border bg-card hover:border-blue-500/50 hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <Droplets className="h-4 w-4" />
                    <span>💧 ค่าน้ำประปา (กองประปา)</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>2. เลือกเดือนที่ต้องการนำเข้าข้อมูล (ปฏิทินเดือน)</span>
                    <span className="text-destructive">*</span>
                  </label>
                  {selectedRevenuePeriod === "" ? (
                    <span className="text-[11px] font-medium text-destructive">จำเป็นต้องเลือกก่อนแนบไฟล์</span>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      งวดที่เลือก: {periodLabel(selectedRevenuePeriod)}
                    </span>
                  )}
                </div>
                <MonthPicker
                  value={selectedRevenuePeriod}
                  onChange={(p) => {
                    setSelectedRevenuePeriod(p);
                    if (file) handleResetFile();
                  }}
                />
              </div>
            </div>

            {!isRevenueReady && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                <span>
                  <strong>โปรดทราบ:</strong> ท่านต้องเลือกเดือนที่ต้องการนำเข้าข้อมูลจากปฏิทินเดือนให้เรียบร้อยก่อน จึงจะสามารถอัปโหลดหรือแนบไฟล์ Excel ได้
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload Zone */}
      {!file ? (
        <Card
          className={`border-2 transition-all ${
            isCurrentModeReady
              ? "border-dashed border-border bg-card hover:border-primary/50"
              : "border-dashed border-muted bg-muted/30 opacity-70 cursor-not-allowed"
          }`}
          onDragOver={(e) => {
            if (!isCurrentModeReady) return;
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            if (!isCurrentModeReady) {
              toast.error(
                importMode === "revenue"
                  ? "กรุณาเลือกเดือนที่ต้องการนำเข้าข้อมูลจากปฏิทินเดือนก่อนแนบไฟล์"
                  : "กรุณาระบุเงื่อนไขที่จำเป็นก่อนนำเข้าไฟล์",
              );
              return;
            }
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFileProcess(f);
          }}
        >
          <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
            <div
              className={`mb-4 grid h-16 w-16 place-items-center rounded-full transition-transform ${
                isCurrentModeReady
                  ? "bg-primary/10 text-primary scale-105"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isCurrentModeReady ? <Upload className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
            </div>

            <h3 className="text-lg font-semibold">
              {importMode === "readings"
                ? "อัปโหลดไฟล์ Excel เลขจดมิเตอร์สาธารณูปโภค"
                : "อัปโหลดไฟล์ Excel ทะเบียนจัดเก็บรายได้ / ตารางค้างชำระ"}
            </h3>

            <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground">
              {isCurrentModeReady
                ? "ลากไฟล์มาวางที่นี่ หรือคลิกปุ่มด้านล่างเพื่อเลือกไฟล์จากคอมพิวเตอร์ (รองรับ .xlsx, .xls ขนาดไม่เกิน 10MB)"
                : importMode === "revenue"
                  ? "🔒 กรุณาเลือกเดือนที่ต้องการนำเข้าข้อมูลในขั้นตอนที่ 1 ด้านบนก่อน จึงจะสามารถแนบไฟล์ได้"
                  : "🔒 กรุณาเลือกระบบและงวดบิลในขั้นตอนที่ 1 ด้านบนให้ครบถ้วนก่อน จึงจะสามารถแนบไฟล์ได้"}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileProcess(f);
              }}
            />

            <Button
              className="mt-6"
              disabled={!isCurrentModeReady || isProcessing}
              onClick={() => {
                if (!isCurrentModeReady) {
                  toast.error(
                    importMode === "revenue"
                      ? "กรุณาเลือกเดือนที่ต้องการนำเข้าข้อมูลจากปฏิทินเดือนก่อนแนบไฟล์"
                      : "กรุณาระบุเงื่อนไขที่จำเป็นก่อนนำเข้าไฟล์",
                  );
                  return;
                }
                fileInputRef.current?.click();
              }}
            >
              {isProcessing ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4 animate-spin" /> กำลังประมวลผลไฟล์...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> เลือกไฟล์ Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Step 3: Staging / Verification View */
        <div className="space-y-6">
          {/* File Card info */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">{file.name}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    Fingerprint: {fingerprint.slice(0, 20)}...
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFile}
                  disabled={isProcessing}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> เปลี่ยนไฟล์
                </Button>

                {!importSuccess ? (
                  <Button
                    onClick={handleConfirmImport}
                    className="bg-primary text-primary-foreground font-semibold shadow-xs"
                  >
                    <Check className="mr-1.5 h-4 w-4" /> ยืนยันนำเข้าระบบ
                  </Button>
                ) : importMode === "readings" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="border-success/40 bg-card">
                      <Link to="/customers">
                        ดูทะเบียนผู้ประกอบการ
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="border-success/40 bg-card">
                      <Link to="/billing">
                        ดูใบแจ้งหนี้
                      </Link>
                    </Button>
                    <Button asChild className="bg-success text-success-foreground hover:bg-success/90">
                      <Link
                        to="/readings"
                        search={{
                          division: (selectedDivision as Division) || undefined,
                          period: selectedPeriod || undefined,
                        }}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> ตรวจสอบหน่วยใช้ล่าสุด{" "}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button asChild size="sm" variant="outline" className="border-success/40 bg-card">
                      <Link to="/customers">
                        ดูทะเบียนผู้ประกอบการ
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="border-success/40 bg-card">
                      <Link to="/payments">
                        ดูรายการรับชำระ
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            {availableSheets.length > 0 && (
              <CardContent className="pt-0 pb-3 px-4">
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-primary/20 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    อ่านข้อมูลครบทุกหน้า ({availableSheets.length} แผ่นงาน):
                  </span>
                  {availableSheets.map((s) => (
                    <Badge
                      key={s.name}
                      variant={selectedSheet === s.name ? "default" : "outline"}
                      className="cursor-pointer text-xs transition-all hover:scale-105"
                      onClick={() => {
                        setSelectedSheet(selectedSheet === s.name ? "all" : s.name);
                        setPage(0);
                      }}
                    >
                      📄 {s.name} ({s.count} รายการ)
                    </Badge>
                  ))}
                  {selectedSheet !== "all" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
                      onClick={() => {
                        setSelectedSheet("all");
                        setPage(0);
                      }}
                    >
                      ✕ แสดงทุกหน้า
                    </Button>
                  )}
                </div>
              </CardContent>
            )}
          </Card>



          {/* Success Banner */}
          {importSuccess && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  <strong>นำเข้าและจัดเก็บข้อมูลสำเร็จ!</strong> ข้อมูลถูกบันทึกเข้าระบบเรียบร้อยแล้ว
                </span>
              </div>
              <div className="flex gap-2">
                {importMode === "readings" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="border-success/40 bg-card">
                      <Link to="/customers">
                        ดูทะเบียนผู้ประกอบการ
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="border-success/40 bg-card">
                      <Link to="/billing">
                        ดูใบแจ้งหนี้
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="border-success/40 bg-card">
                      <Link
                        to="/readings"
                        search={{
                          division: (selectedDivision as Division) || undefined,
                          period: selectedPeriod || undefined,
                        }}
                      >
                        ตรวจสอบหน่วยใช้ล่าสุด
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <Button asChild size="sm" variant="outline" className="border-success/40 bg-card">
                    <Link to={arrearsRows.length > 0 ? "/customers" : "/payments"}>
                      ดูข้อมูลที่นำเข้า
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* TABLE VIEW FOR MODE 1: READINGS */}
          {importMode === "readings" && (() => {
            const firstRow = readingRows[0];
            const activeSheetLabel = selectedSheet !== "all" ? selectedSheet : (firstRow?.sheet || "72793");
            const reportTitle = firstRow?.monthTitle || `รายการคำนวณ${selectedDivision === "water" ? "ค่าน้ำประปา" : "ค่าไฟฟ้า"} ประจำเดือน ${selectedPeriod ? periodLabel(selectedPeriod) : ""} (${activeSheetLabel})`;
            const reportDateRange = firstRow?.dateRange || (selectedPeriod ? getDateRangeFromPeriod(selectedPeriod) : "1 ก.ค.69 - 31 ก.ค.69");
            const reportFtRate = firstRow?.ftRate !== undefined ? firstRow.ftRate : (settings.ft ?? 0.1623);
            const reportVatRate = firstRow?.vatRate !== undefined ? firstRow.vatRate : (settings.vatPercent ?? 7);

            const totalUnits = displayedReadingRows.reduce((sum, r) => sum + r.calculatedUsed, 0);
            const totalBaseAmount = displayedReadingRows.reduce((sum, r) => sum + r.rawBaseAmount, 0);
            const totalFtAmount = displayedReadingRows.reduce((sum, r) => sum + r.rawFtAmount, 0);
            const totalServiceFee = displayedReadingRows.reduce((sum, r) => sum + r.rawServiceFee, 0);
            const totalSubtotal = displayedReadingRows.reduce((sum, r) => sum + r.rawSubtotal, 0);
            const totalVatAmount = displayedReadingRows.reduce((sum, r) => sum + r.rawVatAmount, 0);
            const totalPayable = displayedReadingRows.reduce((sum, r) => sum + r.rawTotalAmount, 0);

            return (
              <Card className="overflow-hidden border shadow-xs bg-card">
                {/* Official Report Header Style matching Image 2 */}
                <div className="border-b bg-muted/20 p-5 text-center space-y-2">
                  <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    {reportTitle}
                  </h3>
                  <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-1 text-xs text-muted-foreground font-medium">
                    {reportDateRange && <span>ระหว่างวันที่ {reportDateRange}</span>}
                    {selectedDivision === "electric" && (
                      <span>FT= {reportFtRate} บาท/หน่วย</span>
                    )}
                    <span>ภาษีมูลค่าเพิ่มร้อยละ {reportVatRate}</span>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b bg-card">
                  <div>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      ผลการตรวจสอบข้อมูลเลขจดมิเตอร์ ({displayedReadingRows.length} รายการ)
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      อ่านข้อมูลครบทุกหน้าในไฟล์ Excel ({availableSheets.length} แผ่นงาน)
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full max-w-xs">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9 h-9 text-xs"
                        placeholder="ค้นหาชื่อ, ร้านค้า, เลขมิเตอร์, แผ่นงาน"
                        value={q}
                        onChange={(e) => {
                          setQ(e.target.value);
                          setPage(0);
                        }}
                      />
                    </div>
                    {availableSheets.length > 1 && (
                      <Select
                        value={selectedSheet}
                        onValueChange={(v) => {
                          setSelectedSheet(v);
                          setPage(0);
                        }}
                      >
                        <SelectTrigger className="h-9 w-44 text-xs">
                          <SelectValue placeholder="เลือกแผ่นงาน" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            ทุกแผ่นงาน ({availableSheets.reduce((s, x) => s + x.count, 0)})
                          </SelectItem>
                          {availableSheets.map((s) => (
                            <SelectItem key={s.name} value={s.name}>
                              📄 {s.name} ({s.count})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Select
                      value={filterStatus}
                      onValueChange={(v) => {
                        setFilterStatus(v as "all" | "valid" | "warning" | "error");
                        setPage(0);
                      }}
                    >
                      <SelectTrigger className="h-9 w-40 text-xs">
                        <SelectValue placeholder="สถานะตรวจสอบ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ผลตรวจสอบทั้งหมด</SelectItem>
                        <SelectItem value="valid">✅ พร้อมนำเข้า</SelectItem>
                        <SelectItem value="warning">⚠️ ข้อควรระวัง</SelectItem>
                        <SelectItem value="error">❌ ข้อผิดพลาด</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="whitespace-nowrap text-xs">
                      <TableHeader>
                        <TableRow className="bg-muted/40 font-semibold text-xs border-b">
                          <TableHead className="w-12 text-center text-foreground font-semibold">ลำดับ</TableHead>
                          <TableHead className="min-w-[180px] text-foreground font-semibold">
                            {selectedDivision === "water" ? "ผู้ใช้น้ำ" : "ผู้ใช้ไฟฟ้า"}
                          </TableHead>
                          <TableHead className="min-w-[200px] text-foreground font-semibold">สถานที่</TableHead>
                          <TableHead className="w-32 text-foreground font-semibold">
                            {selectedDivision === "water" ? "หมายเลขมาตร ฯ" : "หมายเลขมิเตอร์ ฯ"}
                          </TableHead>
                          <TableHead className="w-20 text-center text-foreground font-semibold">ประเภทมิเตอร์</TableHead>
                          <TableHead className="w-24 text-right text-foreground font-semibold">จดครั้งก่อน</TableHead>
                          <TableHead className="w-24 text-right text-foreground font-semibold">จดครั้งหลัง</TableHead>
                          <TableHead className="w-24 text-right text-foreground font-semibold">หน่วยที่ใช้</TableHead>
                          <TableHead className="w-28 text-right text-foreground font-semibold">เป็นเงิน บาท</TableHead>
                          <TableHead className="w-24 text-right text-foreground font-semibold">ค่า FT บาท</TableHead>
                          <TableHead className="w-24 text-right text-foreground font-semibold">ค่าบริการ บาท</TableHead>
                          <TableHead className="w-28 text-right text-foreground font-semibold">รวมเป็นเงิน บาท</TableHead>
                          <TableHead className="w-20 text-right text-foreground font-semibold">ภาษี บาท</TableHead>
                          <TableHead className="w-32 text-right text-foreground font-semibold">จำนวนเงินที่ต้องชำระ</TableHead>
                          <TableHead className="w-28 text-center text-foreground font-semibold">ผลการตรวจสอบ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedReadingRows
                          .slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
                          .map((r) => (
                            <TableRow
                              key={r.index}
                              className={
                                r.status === "error"
                                  ? "bg-destructive/5 hover:bg-destructive/10 text-xs"
                                  : r.status === "warning"
                                    ? "bg-warning/5 hover:bg-warning/10 text-xs"
                                    : "hover:bg-muted/50 text-xs"
                              }
                            >
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {r.index}
                              </TableCell>
                              <TableCell className="font-medium text-xs">
                                {r.matchedCustomer?.name ?? r.name}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.matchedCustomer?.shop ?? r.shop}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {r.meter || (r.matchedCustomer ? (selectedDivision === "water" ? r.matchedCustomer.waterMeter : r.matchedCustomer.elecMeter) : "—")}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs">
                                {r.meterTypeDisplay}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {r.prevDisplay}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold">
                                {r.currDisplay}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-primary">
                                {r.usedDisplay}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {r.baseAmountDisplay}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {r.ftAmountDisplay}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {r.serviceFeeDisplay}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-medium">
                                {r.subtotalDisplay}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {r.vatAmountDisplay}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                                {r.totalAmountDisplay}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[11px] px-2 py-0.5",
                                    r.status === "valid"
                                      ? "border-success/40 bg-success/15 text-success"
                                      : r.status === "warning"
                                        ? "border-warning/40 bg-warning/15 text-warning"
                                        : "border-destructive/40 bg-destructive/15 text-destructive",
                                  )}
                                  title={r.reasons.join(", ")}
                                >
                                  {r.status === "valid" ? "ผ่าน" : r.status === "warning" ? "เตือน" : "ไม่ผ่าน"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                      <tfoot className="border-t-2 bg-muted/20 font-semibold text-xs">
                        <TableRow>
                          <TableCell colSpan={7} className="text-right py-3 font-semibold text-foreground">
                            รวมทั้งสิ้น ({displayedReadingRows.length} รายการ):
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-primary py-3">
                            {totalUnits.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold py-3">
                            {totalBaseAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold py-3">
                            {totalFtAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold py-3">
                            {totalServiceFee.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold py-3">
                            {totalSubtotal.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold py-3">
                            {totalVatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground py-3">
                            {totalPayable.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </tfoot>
                    </Table>
                  </div>

                  {/* Pagination for Reading table */}
                  {displayedReadingRows.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
                      <span>
                        แสดง {page * PAGE_SIZE + 1} -{" "}
                        {Math.min((page + 1) * PAGE_SIZE, displayedReadingRows.length)} จาก{" "}
                        {displayedReadingRows.length} รายการ
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          disabled={page === 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
                        </Button>
                        <span className="px-2 font-medium">
                          หน้า {page + 1} / {Math.ceil(displayedReadingRows.length / PAGE_SIZE)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          disabled={(page + 1) * PAGE_SIZE >= displayedReadingRows.length}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          ถัดไป <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* TABLE VIEW FOR MODE 2: ARREARS LEDGER (ตารางค้างชำระ/ทะเบียนคุมรายได้) */}
          {importMode === "revenue" && arrearsRows.length > 0 && (
            <div className="space-y-4">
              {/* Summary Metrics Chips */}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <Card className="bg-card shadow-xs">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground">ผู้ประกอบการที่ตรวจพบ</p>
                    <p className="text-xl font-bold font-display">{arrearsRows.length} ราย</p>
                  </CardContent>
                </Card>
                <Card className="bg-card shadow-xs">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground">⚡ ค้างค่าไฟฟ้ารวม</p>
                    <p className="text-xl font-bold font-display text-amber-600 dark:text-amber-400">
                      ฿{thb(arrearsRows.filter((r) => r.division === "electric").reduce((s, r) => s + r.totalArrears, 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-card shadow-xs">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground">💧 ค้างค่าน้ำประปารวม</p>
                    <p className="text-xl font-bold font-display text-blue-600 dark:text-blue-400">
                      ฿{thb(arrearsRows.filter((r) => r.division === "water").reduce((s, r) => s + r.totalArrears, 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-card shadow-xs">
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground">ยอดค้างชำระทั้งหมด</p>
                    <p className="text-xl font-bold font-display text-destructive">
                      ฿{thb(arrearsRows.reduce((s, r) => s + r.totalArrears, 0))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      ผลการตรวจสอบตารางค้างชำระและทะเบียนผู้ประกอบการ ({displayedArrearsRows.length} รายการ)
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      อ่านข้อมูลครบทุกหน้าในไฟล์ Excel ({availableSheets.length} แผ่นงาน) · ตรวจพบชื่อ-นามสกุล, สถานที่, เลขมิเตอร์ และยอดค้างชำระรายเดือน
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full max-w-xs">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9 h-9"
                        placeholder="ค้นหาชื่อ, ร้านค้า, เลขมิเตอร์, แผ่นงาน"
                        value={q}
                        onChange={(e) => {
                          setQ(e.target.value);
                          setPage(0);
                        }}
                      />
                    </div>
                    {availableSheets.length > 1 && (
                      <Select
                        value={selectedSheet}
                        onValueChange={(v) => {
                          setSelectedSheet(v);
                          setPage(0);
                        }}
                      >
                        <SelectTrigger className="h-9 w-44">
                          <SelectValue placeholder="เลือกแผ่นงาน" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            ทุกแผ่นงาน ({availableSheets.reduce((s, x) => s + x.count, 0)})
                          </SelectItem>
                          {availableSheets.map((s) => (
                            <SelectItem key={s.name} value={s.name}>
                              📄 {s.name} ({s.count})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>รหัส</TableHead>
                          <TableHead>แผ่นงาน (Sheet)</TableHead>
                          <TableHead>ผู้ประกอบการ / ร้านค้า</TableHead>
                          <TableHead>ประเภทบริการ</TableHead>
                          <TableHead>หมายเลขเครื่องวัดฯ / มาตร</TableHead>
                          <TableHead>งวดที่ค้างชำระ</TableHead>
                          <TableHead className="text-right">รวมยอดค้างชำระ</TableHead>
                          <TableHead>สถานะ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedArrearsRows
                          .slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
                          .map((r) => {
                            const div = r.division || "electric";
                            return (
                              <TableRow key={r.index} className="hover:bg-muted/50">
                                <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                  {r.index}
                                </TableCell>
                                <TableCell className="font-mono text-xs font-semibold">
                                  {r.matchedCustomer?.code ?? "ลงทะเบียนใหม่"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[11px] font-mono">
                                    📄 {r.sheet || "Sheet1"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <p className="text-sm font-medium">{r.name}</p>
                                  <p className="text-xs text-muted-foreground">{r.shop}</p>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[11px] font-medium",
                                      div === "water"
                                        ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                        : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                    )}
                                  >
                                    {div === "water" ? "💧 ค่าน้ำประปา" : "⚡ ค่าไฟฟ้า"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{r.meter || "—"}</TableCell>
                                <TableCell>
                                  {r.monthlyArrears.length ? (
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                      {r.monthlyArrears.map((m) => (
                                        <Badge key={m.period} variant="secondary" className="text-[10px] font-mono">
                                          {m.monthLabel}: ฿{thb(m.amount)}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">ไม่มียอดค้าง</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {r.totalArrears > 0 ? (
                                    <span className="font-bold text-destructive">฿{thb(r.totalArrears)}</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {r.matchedCustomer ? (
                                    <Badge variant="outline" className="border-success/40 bg-success/15 text-success">
                                      <CheckCircle2 className="mr-1 h-3 w-3" /> ตรงฐานข้อมูล
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="border-info/40 bg-info/15 text-info">
                                      ลงทะเบียนใหม่
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination for Arrears table */}
                  {displayedArrearsRows.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
                      <span>
                        แสดง {page * PAGE_SIZE + 1} -{" "}
                        {Math.min((page + 1) * PAGE_SIZE, displayedArrearsRows.length)} จาก{" "}
                        {displayedArrearsRows.length} รายการ
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          disabled={page === 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
                        </Button>
                        <span className="px-2 font-medium">
                          หน้า {page + 1} / {Math.ceil(displayedArrearsRows.length / PAGE_SIZE)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          disabled={(page + 1) * PAGE_SIZE >= displayedArrearsRows.length}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          ถัดไป <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TABLE VIEW FOR MODE 2: REVENUE (ใบเสร็จรับเงิน/รับชำระ) */}
          {importMode === "revenue" && arrearsRows.length === 0 && (
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3 p-4">
                <CardTitle className="text-base font-semibold">
                  ผลการตรวจสอบข้อมูลจัดเก็บรายได้ ({displayedRevenueRows.length} รายการ)
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9 h-9"
                      placeholder="ค้นหาเลขที่ใบเสร็จ, ผู้ชำระ, ร้านค้า"
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                  {availableSheets.length > 1 && (
                    <Select
                      value={selectedSheet}
                      onValueChange={(v) => {
                        setSelectedSheet(v);
                        setPage(0);
                      }}
                    >
                      <SelectTrigger className="h-9 w-44">
                        <SelectValue placeholder="เลือกแผ่นงาน" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          ทุกแผ่นงาน ({availableSheets.reduce((s, x) => s + x.count, 0)})
                        </SelectItem>
                        {availableSheets.map((s) => (
                          <SelectItem key={s.name} value={s.name}>
                            📄 {s.name} ({s.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>เลขที่ใบเสร็จ</TableHead>
                        <TableHead>แผ่นงาน (Sheet)</TableHead>
                        <TableHead>ผู้ชำระเงิน / ผู้ประกอบการ</TableHead>
                        <TableHead>ประเภทบริการ</TableHead>
                        <TableHead>ร้านค้า / สถานที่</TableHead>
                        <TableHead className="text-right">ยอดรับชำระ</TableHead>
                        <TableHead>ช่องทาง</TableHead>
                        <TableHead>วันที่ชำระ</TableHead>
                        <TableHead>การจับคู่</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedRevenueRows
                        .slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
                        .map((r) => {
                          const div = r.division || "electric";
                          return (
                            <TableRow key={r.index} className="hover:bg-muted/50">
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {r.index}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-semibold">
                                {r.receiptNo}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[11px] font-mono">
                                  📄 {r.sheet || "Sheet1"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm font-medium">{r.name}</p>
                                {r.matchedCustomer && (
                                  <p className="text-xs text-primary">รหัส: {r.matchedCustomer.code}</p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[11px] font-medium",
                                    div === "water"
                                      ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                  )}
                                >
                                  {div === "water" ? "💧 ค่าน้ำประปา" : "⚡ ค่าไฟฟ้า"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {r.shop || r.matchedCustomer?.shop || "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                ฿{thb(r.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {r.method === "online" ? "โอนเงิน / QR" : "เคาน์เตอร์"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{r.paidDate}</TableCell>
                              <TableCell>
                                {r.matchedCustomer ? (
                                  <Badge variant="outline" className="border-success/40 bg-success/15 text-success">
                                    <CheckCircle2 className="mr-1 h-3 w-3" /> ตรงฐานข้อมูล
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning">
                                    รับชำระทั่วไป
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination for Revenue table */}
                {displayedRevenueRows.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
                    <span>
                      แสดง {page * PAGE_SIZE + 1} -{" "}
                      {Math.min((page + 1) * PAGE_SIZE, displayedRevenueRows.length)} จาก{" "}
                      {displayedRevenueRows.length} รายการ
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={page === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
                      </Button>
                      <span className="px-2 font-medium">
                        หน้า {page + 1} / {Math.ceil(displayedRevenueRows.length / PAGE_SIZE)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={(page + 1) * PAGE_SIZE >= displayedRevenueRows.length}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        ถัดไป <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Clearing Imported Database */}
      <Dialog open={clearDbOpen} onOpenChange={setClearDbOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              ยืนยันการล้างฐานข้อมูลนำเข้า
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2 text-foreground">
                <p className="text-sm">
                  เลือกรูปแบบการล้างข้อมูลที่ต้องการดำเนินการ:
                </p>
                <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="clearDbOption"
                      value="all"
                      checked={clearDbOption === "all"}
                      onChange={() => setClearDbOption("all")}
                      className="mt-0.5 accent-destructive"
                    />
                    <div>
                      <strong className="text-destructive font-semibold">
                        ล้างฐานข้อมูลทั้งหมด (ผู้ประกอบการ, เลขจดมิเตอร์, บิล, รายการชำระ)
                      </strong>
                      <p className="text-muted-foreground mt-0.5">
                        ล้างข้อมูลทุกอย่างออกจากระบบเพื่อเริ่มนำเข้าไฟล์ใหม่ทั้งหมดจากศูนย์
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-destructive/10">
                    <input
                      type="radio"
                      name="clearDbOption"
                      value="readings"
                      checked={clearDbOption === "readings"}
                      onChange={() => setClearDbOption("readings")}
                      className="mt-0.5 accent-destructive"
                    />
                    <div>
                      <strong className="text-foreground font-semibold">ล้างเฉพาะข้อมูลเลขจดมิเตอร์ทั้งหมด</strong>
                      <p className="text-muted-foreground mt-0.5">
                        ล้างเฉพาะข้อมูลการจดมิเตอร์ทุกงวด แต่คงรายชื่อผู้ประกอบการไว้
                      </p>
                    </div>
                  </label>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    ⚠️ ข้อมูลที่ถูกล้างจะไม่สามารถกู้คืนได้ กรุณาตรวจสอบก่อนยืนยัน
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setClearDbOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (clearDbOption === "all") {
                  clearAllData();
                } else {
                  clearReadings();
                }
                handleResetFile();
                setClearDbOpen(false);
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> ยืนยันล้างข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
