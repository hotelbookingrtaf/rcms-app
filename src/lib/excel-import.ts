import * as XLSX from "xlsx";
import type { Division } from "./rcms-types";

export interface ImportRow {
  name: string;
  shop: string;
  meter: string;
  meterType?: string | number | undefined;
  prev?: number | undefined;
  curr?: number | undefined;
  prevRaw?: string | undefined;
  currRaw?: string | undefined;
  used?: number | undefined;
  baseAmount?: number | undefined;
  ftAmount?: number | undefined;
  serviceFee?: number | undefined;
  subtotal?: number | undefined;
  vatAmount?: number | undefined;
  totalAmount?: number | undefined;
  amount?: number | undefined;
  sheet: string;
  division?: Division | undefined;
  monthTitle?: string | undefined;
  dateRange?: string | undefined;
  ftRate?: number | undefined;
  vatRate?: number | undefined;
}

export interface CustomerImportRow {
  code?: string | undefined;
  name: string;
  shop: string;
  phone: string;
  lineId: string;
  elecMeter?: string | undefined;
  waterMeter?: string | undefined;
  depositPaid?: number | undefined;
  sheet: string;
}

export interface RevenueImportRow {
  receiptNo: string;
  bookNo?: string | undefined;
  name: string;
  shop: string;
  meter?: string | undefined;
  period: string;
  amount: number;
  method: "online" | "counter";
  ref: string;
  paidDate: string;
  division?: Division | undefined;
  sheet: string;
}

export interface MonthlyArrearsItem {
  period: string;
  monthLabel: string;
  amount: number;
}

export interface MonthlyPaidItem {
  period: string;
  monthLabel: string;
  amount: number;
  receiptNo?: string | undefined;
  bookNo?: string | undefined;
  paidDate?: string | undefined;
}

export interface ArrearsLedgerRow {
  code?: string | undefined;
  name: string;
  shop: string;
  meter: string;
  monthlyArrears: MonthlyArrearsItem[];
  monthlyPaid?: MonthlyPaidItem[] | undefined;
  totalArrears: number;
  division?: Division | undefined;
  sheet: string;
}

export type WorkbookSchema =
  | "UTILITY_READING_V1"
  | "REVENUE_LEDGER_V1"
  | "ARREARS_LEDGER_V1"
  | "CUSTOMER_PROFILE_V1"
  | "UNKNOWN";
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export function validateWorkbookFile(file: File): string | null {
  if (!/\.(xlsx|xls)$/i.test(file.name)) return "รองรับเฉพาะไฟล์ .xlsx หรือ .xls";
  if (file.size > MAX_IMPORT_BYTES) return "ไฟล์ต้องมีขนาดไม่เกิน 10 MB";
  if (file.size === 0) return "ไฟล์ว่างเปล่า";
  return null;
}

export async function workbookFingerprint(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return `SHA256-${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** จำแนกไฟล์ก่อน commit เพื่อไม่ให้ตารางรายรับหรือตารางผู้ประกอบการถูกตีความผิด */
export async function classifyWorkbook(file: File): Promise<WorkbookSchema> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  let hasReadingColumns = false;
  let hasRevenueColumns = false;
  let hasCustomerColumns = false;

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" })
      .slice(0, 20);
    const headerText = rows.flat().map(txt).join("|").replace(/\s+/g, "");
    if (/(จดครั้งก่อน|จดครั้งหลัง|หน่วยที่ใช้)/.test(headerText)) hasReadingColumns = true;
    if (/(ใบเสร็จรับเงิน|ยอดรับชำระ|การจัดเก็บรายรับ)/.test(headerText)) hasRevenueColumns = true;
    if (/(รหัสผู้ประกอบการ|ทะเบียนผู้ประกอบการ|เงินประกัน|เบอร์โทร)/.test(headerText))
      hasCustomerColumns = true;
  });

  if (hasReadingColumns) return "UTILITY_READING_V1";
  if (hasRevenueColumns) return "REVENUE_LEDGER_V1";
  if (hasCustomerColumns) return "CUSTOMER_PROFILE_V1";
  return "UNKNOWN";
}

const txt = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v: unknown) => {
  const n = Number(txt(v).replace(/[, ฿]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

type ColMap = Partial<
  Record<
    | "name"
    | "shop"
    | "meter"
    | "meterType"
    | "prev"
    | "curr"
    | "used"
    | "baseAmount"
    | "ftAmount"
    | "serviceFee"
    | "subtotal"
    | "vatAmount"
    | "totalAmount"
    | "amount",
    number
  >
>;

/** ตรวจสอบทั้ง Workbook ว่าเป็นข้อมูลของกองไฟฟ้า หรือ กองประปา โดยอ่านทุกชีตและเซลล์ */
export function detectWorkbookDivision(wb: XLSX.WorkBook): Division | undefined {
  let electricScore = 0;
  let waterScore = 0;

  wb.SheetNames.forEach((sheetName) => {
    const cleanSheetName = sheetName.toLowerCase();
    if (/(ไฟ|ไฟฟ้า|elec|กฟภ|kwh|กองไฟฟ้า)/i.test(cleanSheetName)) electricScore += 10;
    if (/(น้ำ|ประปา|water|กปภ|สุขาภิบาล|กองประปา)/i.test(cleanSheetName)) waterScore += 10;

    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" })
      .slice(0, 30);
    const sheetText = rows.flat().map(txt).join(" ").toLowerCase();

    // Electricity keywords
    if (
      /(ค่าไฟฟ้าประจำเดือน|ค่ากระแสไฟฟ้า|ค่าไฟฟ้า|การไฟฟ้า|กองไฟฟ้า|ค่าใช้ไฟ|ผู้ใช้ไฟฟ้า|ลูกค้าไฟฟ้า|ทะเบียนไฟ|มิเตอร์ไฟฟ้า|เลขมิเตอร์ไฟฟ้า|มิเตอร์ไฟ|ค่าไฟ|กิโลวัตต์-ชั่วโมง|กิโลวัตต์|kwh|หน่วยไฟ|วัตต์|แรงต่ำ|แรงสูง|หม้อแปลง|เครื่องวัด|หมายเลขเครื่องวัด)/i.test(
        sheetText,
      )
    ) {
      electricScore += 15;
    }
    // Water keywords
    if (
      /(ค่าน้ำประปาประจำเดือน|ค่าน้ำประปา|ค่าน้ำ|น้ำประปา|การประปา|กองประปา|ค่าใช้น้ำ|ผู้ใช้น้ำ|ลูกค้าน้ำ|ทะเบียนน้ำ|มาตรวัดน้ำ|เลขมาตรวัดน้ำ|มาตรประปา|มิเตอร์น้ำ|ลบ\.ม|ลูกบาศก์เมตร|หน่วยน้ำ|คิว)/i.test(
        sheetText,
      )
    ) {
      waterScore += 15;
    }

    if (/(50\d{3}|72\d{3}|38\d{3}|38944|72793|50365|20177|20\d{3})[-\/]?\d*/i.test(sheetText)) electricScore += 15;
  });

  if (electricScore > waterScore && electricScore > 0) return "electric";
  if (waterScore > electricScore && waterScore > 0) return "water";
  if (electricScore > 0) return "electric";
  if (waterScore > 0) return "water";
  return undefined;
}

/** ฟังก์ชันจำแนกประเภทสาธารณูปโภค (ไฟฟ้า vs น้ำประปา) จากชื่อ Sheet และข้อความในหัวตาราง */
export function detectDivisionFromSheet(
  sheetName: string,
  rows: unknown[][],
  defaultDivision?: Division,
): Division | undefined {
  const scanRows = rows.slice(0, 30);
  const sheetText = scanRows.flat().map(txt).join(" ").toLowerCase();
  const cleanSheetName = sheetName.toLowerCase();

  let waterScore = 0;
  let electricScore = 0;

  // 1. Sheet name checks
  if (/(น้ำ|ประปา|water|กปภ|สุขาภิบาล|กองประปา|มาตรวัดน้ำ|มาตรประปา)/i.test(cleanSheetName)) waterScore += 10;
  if (/(ไฟ|ไฟฟ้า|elec|กฟภ|kwh|กองไฟฟ้า|เครื่องวัด)/i.test(cleanSheetName)) electricScore += 10;

  // 2. Header and cell keywords
  if (/(ผู้ใช้น้ำ|ลูกค้าน้ำ|ทะเบียนน้ำ)/i.test(sheetText)) waterScore += 10;
  if (/(ผู้ใช้ไฟฟ้า|ลูกค้าไฟฟ้า|ทะเบียนไฟ)/i.test(sheetText)) electricScore += 10;

  if (/(มาตรวัดน้ำ|เลขมาตรวัดน้ำ|มาตรประปา|มิเตอร์น้ำ)/i.test(sheetText))
    waterScore += 10;
  if (/(มิเตอร์ไฟฟ้า|เลขมิเตอร์ไฟฟ้า|มิเตอร์ไฟ|กิโลวัตต์-ชั่วโมง|ค่าไฟ|เครื่องวัด|หมายเลขเครื่องวัด)/i.test(sheetText))
    electricScore += 10;

  if (/(ค่าน้ำประปาประจำเดือน|ค่าน้ำประปา|ค่าน้ำ|น้ำประปา|การประปา|กองประปา|ค่าใช้น้ำ)/i.test(sheetText))
    waterScore += 12;
  if (/(ค่าไฟฟ้าประจำเดือน|ค่ากระแสไฟฟ้า|ค่าไฟฟ้า|การไฟฟ้า|กองไฟฟ้า|ค่าใช้ไฟ|ค่าไฟ)/i.test(sheetText))
    electricScore += 12;

  if (/(50\d{3}|72\d{3}|38\d{3}|38944|72793|50365|20177|20\d{3})[-\/]?\d*/i.test(sheetText)) electricScore += 10;

  if (/(ลบ\.ม|ลูกบาศก์เมตร|หน่วยน้ำ|คิว)/i.test(sheetText)) waterScore += 5;
  if (/(กิโลวัตต์|kwh|หน่วยไฟ|วัตต์|หม้อแปลง)/i.test(sheetText)) electricScore += 5;

  if (electricScore > waterScore && electricScore > 0) return "electric";
  if (waterScore > electricScore && waterScore > 0) return "water";
  if (defaultDivision) return defaultDivision;
  if (electricScore > 0) return "electric";
  if (waterScore > 0) return "water";
  return undefined;
}

export const RANK_PREFIX_REGEX =
  /^(นาย|นาง|น\.ส\.|นางสาว|คุณ|ว่าที่|พล\.อ\.|พล\.ท\.|พล\.ต\.|พ\.อ\.|น\.อ\.|น\.ท\.|น\.ต\.|ร\.อ\.|ร\.ท\.|ร\.ต\.|พ\.ต\.|พ\.อ\.อ\.|พ\.อ\.ท\.|พ\.อ\.ต\.|จ\.อ\.|จ\.ท\.|จ\.ต\.|ร\.ต\.อ\.|ร\.ต\.ท\.|ร\.ต\.ต\.|ด\.ต\.|ส\.ต\.อ\.|ส\.ต\.ท\.|ส\.ต\.ต\.|จ\.ส\.อ\.|จ\.ส\.ท\.|จ\.ส\.ต\.|ส\.อ\.|ส\.ท\.|ส\.ต\.|พลฯ|พลทหาร|อส\.|อ\.ส\.|ดร\.|ด\.ร\.|ศ\.|รศ\.|ผศ\.|นพ\.|พญ\.|ทพ\.|บจก\.|หจก\.|ร้าน|ช่าง)/i;

export const SHOP_KEYWORD_REGEX =
  /(ร้าน|อาคาร|รร\.จอ\.|สพ\.ทอ\.|สนาม|สก\.ทอ\.|บก\.|ห้อง|ตู้|สหกรณ์|แผนก|กอง|ฝ่าย|บ้านพัก|ศภษ|ยศ\.ทอ|ชย\.ทอ|บน\.\d+|ศูนย์|แฟลต|โรงอาหาร|สโมสร)/i;

export const METER_PATTERN_REGEX =
  /^([A-Za-z0-9]{2,12}[-\/][A-Za-z0-9]+|\d{4,12})$/;

export function isLikelyDataRow(
  row: unknown[],
  nameCol?: number,
  meterCol?: number,
): boolean {
  if (!row || !row.length) return false;
  const c0 = txt(row[0]).trim();
  const c1 = txt(row[1]).trim();
  const c2 = txt(row[2]).trim();

  // If column 0 is a sequence number like 1, 2, 3...
  if (/^[1-9]\d*$/.test(c0) && !/(รวม|ยอดรวม|ลำดับ|หมายเหตุ|เฉลี่ย)/.test(c0)) {
    return true;
  }
  // If meter column or name column has valid data
  if (nameCol !== undefined && RANK_PREFIX_REGEX.test(txt(row[nameCol]))) {
    return true;
  }
  if (meterCol !== undefined && METER_PATTERN_REGEX.test(txt(row[meterCol]))) {
    return true;
  }
  if (RANK_PREFIX_REGEX.test(c1) || RANK_PREFIX_REGEX.test(c2)) {
    return true;
  }
  return false;
}

/** ตรวจสอบว่าแถวนี้เป็นแถวหัวตารางหรือแถวสรุปยอดรวมหรือไม่ โดยไม่ตัดชื่อร้านค้าที่ขึ้นต้นด้วย 'ร้านค้า...' ทิ้ง */
export function isHeaderOrSummaryRow(
  rawFirst: string,
  shop: string,
  row?: unknown[],
): boolean {
  const f = (rawFirst || "").trim().replace(/\s+/g, "");
  const s = (shop || "").trim().replace(/\s+/g, "");

  // ถ้าแถวมีลำดับตัวเลข 1, 2, 3... ในคอลัมน์แรก ถือเป็นแถวข้อมูลแน่นอน ไม่ใช่หัวตาราง
  if (row && row.length > 0) {
    const c0 = txt(row[0]).trim();
    if (/^[1-9]\d*$/.test(c0) && !/(รวม|ยอดรวม|ลำดับ|หมายเหตุ|เฉลี่ย)/.test(c0)) {
      return false;
    }
  }

  // แถวสรุปผลรวมท้ายตาราง
  if (/^(รวม|ยอดรวม|รวมทั้งสิ้น|ยอดรวมทั้งสิ้น|รวมสุทธิ|ยอดสุทธิ|เฉลี่ย|หมายเหตุ|รวมเงิน)$/i.test(f)) {
    return true;
  }
  if (/^(รวม|ยอดรวม|รวมทั้งสิ้น|ยอดรวมทั้งสิ้น|รวมสุทธิ|ยอดสุทธิ|เฉลี่ย|หมายเหตุ|รวมเงิน)$/i.test(s)) {
    return true;
  }

  // แถวหัวตาราง (เฉพาะคำที่เป็นหัวตารางตรงตัว ไม่รวมชื่อร้านค้า เช่น "ร้านค้าสนามแบด")
  if (
    /^(ลำดับ|รายชื่อ|ชื่อผู้ประกอบการ|ชื่อผู้เช่า|ชื่อผู้ใช้|ผู้ใช้ไฟฟ้า|ผู้ใช้น้ำ|ชื่อ-สกุล|ยศ-นาม|ชื่อ|Customer|Name|CustomerName)$/i.test(
      f,
    )
  ) {
    return true;
  }
  if (
    /^(ลำดับ|ร้านค้า|สถานที่|จุดจำหน่าย|จุดขาย|ที่ตั้ง|อาคาร|ห้อง|ล็อค|ล็อก|รายการ|Shop|Location|ShopName)$/i.test(
      s,
    )
  ) {
    return true;
  }

  return false;
}

/** หาแถวหัวตารางและจับคู่คอลัมน์จากคำสำคัญภาษาไทยสำหรับเลขจดมิเตอร์ */
function detectColumns(rows: unknown[][]): {
  cols: ColMap;
  headerEnd: number;
  monthTitle?: string | undefined;
  dateRange?: string | undefined;
  ftRate?: number | undefined;
  vatRate?: number | undefined;
} {
  const cols: ColMap = {};
  let headerEnd = 0;
  let monthTitle: string | undefined;
  let dateRange: string | undefined;
  let ftRate: number | undefined;
  let vatRate: number | undefined;

  const scan = Math.min(rows.length, 15);
  for (let r = 0; r < scan; r++) {
    const row = rows[r] ?? [];
    const nextRow = r + 1 < scan ? rows[r + 1] ?? [] : [];

    // Scan for header metadata in top rows
    const rowText = row.map(txt).join(" ");
    if (!monthTitle) {
      const mMatch = rowText.match(/(?:รายการคำนวณ|ตารางคำนวณ|ค่าไฟฟ้า|ค่าน้ำประปา).*(?:ประจำเดือน|งวด|เดือน)\s*([^\n\r]+)/i);
      if (mMatch) monthTitle = mMatch[0].trim();
    }
    if (!dateRange) {
      const dMatch = rowText.match(/ระหว่างวันที่\s*([0-9\sก-๙a-zA-Z./-]+)/i);
      if (dMatch?.[1]) dateRange = dMatch[1].trim();
    }
    if (ftRate === undefined) {
      const ftMatch = rowText.match(/FT\s*=\s*([0-9.]+)/i);
      if (ftMatch?.[1]) ftRate = Number(ftMatch[1]);
    }
    if (vatRate === undefined) {
      const vatMatch = rowText.match(/ภาษีมูลค่าเพิ่ม(?:ร้อยละ)?\s*([0-9.]+)/i);
      if (vatMatch?.[1]) vatRate = Number(vatMatch[1]);
    }

    if (
      isLikelyDataRow(row, cols.name, cols.meter) &&
      (cols.name !== undefined ||
        cols.meter !== undefined ||
        cols.prev !== undefined ||
        cols.curr !== undefined)
    ) {
      break;
    }

    row.forEach((cell, c) => {
      const cellText = txt(cell).trim();
      const nextCellText = txt(nextRow[c]).trim();
      const combinedText = `${cellText} ${nextCellText}`.replace(/\s+/g, "");
      const t = cellText.replace(/\s+/g, "");
      if (!t && !combinedText) return;

      const hit = (k: keyof ColMap) => {
        if (cols[k] === undefined) cols[k] = c;
        headerEnd = Math.max(headerEnd, r);
      };

      // Check combined text or single cell text
      const checkText = (pattern: RegExp) => pattern.test(t) || pattern.test(combinedText);

      if (
        checkText(/^(รายชื่อ|รายนาม|ผู้ใช้ไฟฟ้า|ผู้ใช้น้ำ|ชื่อผู้ประกอบการ|ผู้ประกอบการ|ชื่อ-สกุล|ชื่อ-นามสกุล|ชื่อ - สกุล|ยศ-นาม|ยศ-ชื่อ-สกุล|ยศชื่อสกุล|ผู้เช่า|ผู้ขอใช้|ผู้ใช้|ชื่อผู้เช่า|ชื่อผู้ใช้|ชื่อร้านค้า|ชื่อ|Owner|Customer|Name)$/i)
      ) {
        hit("name");
      } else if (
        checkText(/^(สถานที่|ที่ตั้ง|รายการ|ร้านค้า|ชื่อร้าน|จุดจำหน่าย|จุดขาย|อาคาร|ห้อง|ล็อค|ล็อก|หน่วยงาน|สังกัด|ตำแหน่ง|Shop|Location|Room|Building)$/i)
      ) {
        hit("shop");
      } else if (
        checkText(/^(ประเภทมิเตอร์|ประเภทมิเตอร์ฯ|ประเภทเครื่องวัด|ประเภทมาตร|ประเภท|ชนิดมิเตอร์|MeterType|Type)$/i)
      ) {
        hit("meterType");
      } else if (
        checkText(/^(หมายเลขเครื่องวัด|หมายเลขเครื่องวัดฯ|หมายเลขเครื่องวัด ฯ|เลขเครื่องวัด|เลขที่เครื่องวัด|เครื่องวัดฯ|เครื่องวัด ฯ|เครื่องวัด|หมายเลขมิเตอร์|หมายเลขมิเตอร์ฯ|หมายเลขมิเตอร์ ฯ|หมายเลข|เลขมิเตอร์|เลขที่มิเตอร์|รหัสมิเตอร์|หมายเลขมาตร|หมายเลขมาตรฯ|หมายเลขมาตร ฯ|เลขมาตร|เลขที่มาตร|มาตรวัดน้ำ|เลขมาตรวัดน้ำ|มาตรวัดฯ|มาตรวัด ฯ|มาตรวัด|มิเตอร์น้ำ|มิเตอร์ไฟฟ้า|เลขมิเตอร์ไฟฟ้า|มิเตอร์ไฟ|มิเตอร์ฯ|มิเตอร์ ฯ|มิเตอร์|มาตร|Meter|MeterNo|MeterId)$/i)
      ) {
        if (c !== cols.meterType) {
          hit("meter");
        }
      } else if (
        checkText(/^(จดครั้งก่อน|ครั้งก่อน|เลขครั้งก่อน|อ่านครั้งก่อน|จดก่อน|เลขเดิม|เดือนก่อน|ก่อน|Previous|Prev)$/i)
      ) {
        hit("prev");
      } else if (
        checkText(/^(จดครั้งหลัง|ครั้งหลัง|เลขครั้งหลัง|อ่านครั้งหลัง|จดหลัง|เลขใหม่|เดือนนี้|หลัง|Current|Curr|เลขจดปัจจุบัน|จดครั้งล่าสุด)$/i)
      ) {
        hit("curr");
      } else if (
        checkText(/^(หน่วยที่ใช้|รวมหน่วยที่ใช้|หน่วยใช้|จำนวนหน่วย|หน่วย|ยูนิต|ผลต่าง|ปริมาณการใช้|Unit|Units|Used|Usage)$/i)
      ) {
        hit("used");
      } else if (
        checkText(/^(เป็นเงินบาท|เป็นเงิน|ค่าพลังงานไฟฟ้า|ค่าไฟฐาน|ค่าไฟฟ้าฐาน|BaseAmount|BaseEnergy)$/i)
      ) {
        hit("baseAmount");
      } else if (
        checkText(/^(ค่าftบาท|ค่าft|ค่าเอฟทีบาท|ค่าเอฟที|ftบาท|ft|ftamount)$/i)
      ) {
        hit("ftAmount");
      } else if (
        checkText(/^(ค่าบริการบาท|ค่าบริการ|servicefee|servicecharge)$/i)
      ) {
        hit("serviceFee");
      } else if (
        checkText(/^(รวมเป็นเงินบาท|รวมเป็นเงิน|รวมเงินบาท|subtotal)$/i)
      ) {
        hit("subtotal");
      } else if (
        checkText(/^(ภาษีบาท|ภาษี|ภาษีมูลค่าเพิ่มบาท|ภาษีมูลค่าเพิ่ม|vatบาท|vat|vatamount)$/i)
      ) {
        hit("vatAmount");
      } else if (
        checkText(/^(จำนวนเงินที่ต้องชำระ|เงินที่ต้องชำระ|ยอดที่ต้องชำระ|ยอดรวมที่ต้องชำระ|จำนวนเงินทั้งสิ้น|ยอดสุทธิ)$/i)
      ) {
        hit("totalAmount");
      } else if (
        checkText(/^(จำนวนเงิน|ยอดเงิน|ยอดชำระ|ยอดรวม|รวมทั้งสิ้น|Amount|Total|TotalAmount|AmountDue|Price)$/i)
      ) {
        hit("amount");
      }
    });
  }

  // Fallback content scan across first 25 rows
  if (
    cols.name === undefined ||
    cols.meter === undefined ||
    cols.shop === undefined ||
    cols.prev === undefined ||
    cols.curr === undefined
  ) {
    const scanRows = rows.slice(0, 25);
    for (const r of scanRows) {
      r.forEach((cell, c) => {
        const val = txt(cell).trim();
        if (!val) return;
        if (cols.meter === undefined && METER_PATTERN_REGEX.test(val) && c !== cols.meterType) {
          cols.meter = c;
        } else if (cols.name === undefined && RANK_PREFIX_REGEX.test(val)) {
          cols.name = c;
        } else if (
          cols.shop === undefined &&
          SHOP_KEYWORD_REGEX.test(val) &&
          c !== cols.name
        ) {
          cols.shop = c;
        }
      });
    }
  }

  return { cols, headerEnd, monthTitle, dateRange, ftRate, vatRate };
}

export async function parseReadingWorkbook(
  file: File,
  defaultDivision?: Division,
): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const fileDivision = detectWorkbookDivision(wb) || defaultDivision;
  const out: ImportRow[] = [];

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (!rows.length) return;

    const { cols, headerEnd, monthTitle, dateRange, ftRate, vatRate } = detectColumns(rows);
    if (cols.meter === undefined && cols.name === undefined && cols.shop === undefined)
      return;

    const sheetDivision = detectDivisionFromSheet(sheetName, rows, fileDivision);

    for (let r = headerEnd + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const name = cols.name !== undefined ? txt(row[cols.name]) : "";
      const shop = cols.shop !== undefined ? txt(row[cols.shop]) : "";
      let meter = cols.meter !== undefined ? txt(row[cols.meter]) : "";
      let meterType = cols.meterType !== undefined ? txt(row[cols.meterType]) : undefined;

      // Smart meter detection: if meter is a single digit (e.g. "2") or empty, look for actual meter number in row
      if (!meter || /^[0-9]$/.test(meter)) {
        for (let c = 0; c < row.length; c++) {
          if (
            c === cols.prev ||
            c === cols.curr ||
            c === cols.used ||
            c === cols.amount ||
            c === cols.totalAmount ||
            c === cols.baseAmount
          )
            continue;
          const cellVal = txt(row[c]).trim();
          if (METER_PATTERN_REGEX.test(cellVal)) {
            meter = cellVal;
            if (!meterType && cols.meter !== undefined && /^[0-9]$/.test(txt(row[cols.meter]))) {
              meterType = txt(row[cols.meter]);
            }
            break;
          }
        }
      }

      if (!name && !meter && !shop) continue;
      if (isHeaderOrSummaryRow(name, shop, row)) continue;

      const prev = cols.prev !== undefined ? num(row[cols.prev]) : undefined;
      const curr = cols.curr !== undefined ? num(row[cols.curr]) : undefined;
      const prevRaw =
        cols.prev !== undefined && /^0\d+/.test(txt(row[cols.prev]))
          ? txt(row[cols.prev])
          : undefined;
      const currRaw =
        cols.curr !== undefined && /^0\d+/.test(txt(row[cols.curr]))
          ? txt(row[cols.curr])
          : undefined;
      const used = cols.used !== undefined ? num(row[cols.used]) : undefined;
      const baseAmount = cols.baseAmount !== undefined ? num(row[cols.baseAmount]) : undefined;
      const ftAmount = cols.ftAmount !== undefined ? num(row[cols.ftAmount]) : undefined;
      const serviceFee = cols.serviceFee !== undefined ? num(row[cols.serviceFee]) : undefined;
      const subtotal = cols.subtotal !== undefined ? num(row[cols.subtotal]) : undefined;
      const vatAmount = cols.vatAmount !== undefined ? num(row[cols.vatAmount]) : undefined;
      const totalAmount = cols.totalAmount !== undefined ? num(row[cols.totalAmount]) : undefined;
      const amount = cols.amount !== undefined ? num(row[cols.amount]) : undefined;

      if (
        prev === undefined &&
        curr === undefined &&
        used === undefined &&
        totalAmount === undefined &&
        amount === undefined &&
        baseAmount === undefined
      )
        continue;

      out.push({
        name: name || shop || "ผู้ประกอบการ",
        shop: shop || (name ? "" : "ร้านค้า"),
        meter,
        ...(meterType !== undefined ? { meterType } : {}),
        prev,
        curr:
          curr ?? (prev !== undefined && used !== undefined ? prev + used : undefined),
        ...(prevRaw !== undefined ? { prevRaw } : {}),
        ...(currRaw !== undefined ? { currRaw } : {}),
        used:
          used ??
          (prev !== undefined && curr !== undefined && curr >= prev
            ? curr - prev
            : undefined),
        ...(baseAmount !== undefined ? { baseAmount } : {}),
        ...(ftAmount !== undefined ? { ftAmount } : {}),
        ...(serviceFee !== undefined ? { serviceFee } : {}),
        ...(subtotal !== undefined ? { subtotal } : {}),
        ...(vatAmount !== undefined ? { vatAmount } : {}),
        ...(totalAmount !== undefined ? { totalAmount } : {}),
        amount: totalAmount ?? amount ?? baseAmount,
        sheet: sheetName,
        ...(sheetDivision ? { division: sheetDivision } : {}),
        ...(monthTitle ? { monthTitle } : {}),
        ...(dateRange ? { dateRange } : {}),
        ...(ftRate !== undefined ? { ftRate } : {}),
        ...(vatRate !== undefined ? { vatRate } : {}),
      });
    }
  });

  return out;
}

type CustomerColMap = Partial<
  Record<
    | "code"
    | "name"
    | "shop"
    | "phone"
    | "lineId"
    | "elecMeter"
    | "waterMeter"
    | "depositPaid",
    number
  >
>;

/** ตรวจจับคอลัมน์ของตารางผู้ประกอบการ */
function detectCustomerColumns(
  rows: unknown[][],
): { cols: CustomerColMap; headerEnd: number } {
  const cols: CustomerColMap = {};
  let headerEnd = 0;
  const scan = Math.min(rows.length, 15);
  for (let r = 0; r < scan; r++) {
    const row = rows[r] ?? [];
    if (
      isLikelyDataRow(row, cols.name, cols.elecMeter || cols.waterMeter) &&
      (cols.name !== undefined || cols.shop !== undefined || cols.code !== undefined)
    ) {
      break;
    }

    row.forEach((cell, c) => {
      const t = txt(cell).replace(/\s+/g, "");
      if (!t) return;
      const hit = (k: keyof CustomerColMap) => {
        if (cols[k] === undefined) cols[k] = c;
        headerEnd = Math.max(headerEnd, r);
      };
      if (/^(รหัสผู้ประกอบการ|รหัสลูกค้า|รหัส|CustomerID|Code)/i.test(t)) hit("code");
      else if (
        /^(ชื่อผู้ประกอบการ|ชื่อ-สกุล|ยศ-นาม|รายชื่อ|ชื่อ|รายนาม|Customer|Name)/i.test(t)
      )
        hit("name");
      else if (
        /^(ร้านค้า|ชื่อร้าน|สถานที่|รายการ|จุดจำหน่าย|ที่ตั้ง|อาคาร|ห้อง|Shop|Location)/i.test(
          t,
        )
      )
        hit("shop");
      else if (/^(เบอร์โทรศัพท์|เบอร์โทร|โทรศัพท์|โทร|Phone|Tel|Mobile)/i.test(t))
        hit("phone");
      else if (/^(LineID|LINE|ไลน์)/i.test(t)) hit("lineId");
      else if (
        /(หมายเลขเครื่องวัด|หมายเลขเครื่องวัดฯ|เลขเครื่องวัด|เลขที่เครื่องวัด|เครื่องวัดฯ|เครื่องวัด|มิเตอร์ไฟฟ้า|เลขมิเตอร์ไฟฟ้า|มิเตอร์ไฟ|ElecMeter)/i.test(
          t,
        )
      )
        hit("elecMeter");
      else if (
        /(มาตรวัดน้ำ|เลขมาตรวัดน้ำ|มิเตอร์น้ำ|WaterMeter|เลขมาตร|หมายเลขมาตร)/i.test(t)
      )
        hit("waterMeter");
      else if (/(เงินประกัน|เงินค้ำประกัน|ยอดประกัน|Deposit)/i.test(t))
        hit("depositPaid");
    });
  }

  // Fallback content scan
  if (cols.name === undefined || cols.shop === undefined) {
    const scanRows = rows.slice(0, 25);
    for (const r of scanRows) {
      r.forEach((cell, c) => {
        const val = txt(cell).trim();
        if (!val) return;
        if (cols.name === undefined && RANK_PREFIX_REGEX.test(val)) {
          cols.name = c;
        } else if (
          cols.shop === undefined &&
          SHOP_KEYWORD_REGEX.test(val) &&
          c !== cols.name
        ) {
          cols.shop = c;
        }
      });
    }
  }

  return { cols, headerEnd };
}

export async function parseCustomerWorkbook(
  file: File,
): Promise<CustomerImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: CustomerImportRow[] = [];

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (!rows.length) return;

    const { cols, headerEnd } = detectCustomerColumns(rows);
    if (cols.name === undefined && cols.shop === undefined) return;

    for (let r = headerEnd + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const name = cols.name !== undefined ? txt(row[cols.name]) : "";
      const shop = cols.shop !== undefined ? txt(row[cols.shop]) : "";
      if (!name && !shop) continue;
      if (isHeaderOrSummaryRow(name, shop, row)) continue;

      const code = cols.code !== undefined ? txt(row[cols.code]) : "";
      const phone = cols.phone !== undefined ? txt(row[cols.phone]) : "";
      const lineId = cols.lineId !== undefined ? txt(row[cols.lineId]) : "";
      const elecMeter =
        cols.elecMeter !== undefined ? txt(row[cols.elecMeter]) : "";
      const waterMeter =
        cols.waterMeter !== undefined ? txt(row[cols.waterMeter]) : "";
      const depositPaid =
        cols.depositPaid !== undefined ? num(row[cols.depositPaid]) : undefined;

      out.push({
        code: code || undefined,
        name: name || shop,
        shop: shop || "ร้านค้า",
        phone: phone || "081-000-0000",
        lineId: lineId || "-",
        elecMeter: elecMeter || undefined,
        waterMeter: waterMeter || undefined,
        depositPaid,
        sheet: sheetName,
      });
    }
  });

  return out;
}

export const THAI_MONTH_LOOKUP: Record<string, string> = {
  // มกราคม (01)
  "ม.ค.": "01",
  "ม.ค": "01",
  "มค.": "01",
  "มค": "01",
  "มกราคม": "01",
  "มกรา": "01",
  jan: "01",
  january: "01",

  // กุมภาพันธ์ (02)
  "ก.พ.": "02",
  "ก.พ": "02",
  "กพ.": "02",
  "กพ": "02",
  "กุมภาพันธ์": "02",
  "กุมภา": "02",
  feb: "02",
  february: "02",

  // มีนาคม (03)
  "มี.ค.": "03",
  "มี.ค": "03",
  "มีค.": "03",
  "มีค": "03",
  "มีนาคม": "03",
  "มีนา": "03",
  mar: "03",
  march: "03",

  // เมษายน (04)
  "เม.ย.": "04",
  "เม.ย": "04",
  "เมย.": "04",
  "เมย": "04",
  "เมษายน": "04",
  "เมษา": "04",
  apr: "04",
  april: "04",

  // พฤษภาคม (05)
  "พ.ค.": "05",
  "พ.ค": "05",
  "พค.": "05",
  "พค": "05",
  "พฤษภาคม": "05",
  "พฤษภา": "05",
  may: "05",

  // มิถุนายน (06)
  "มิ.ย.": "06",
  "มิ.ย": "06",
  "มิย.": "06",
  "มิย": "06",
  "มิถุนายน": "06",
  "มิถุนา": "06",
  jun: "06",
  june: "06",

  // กรกฎาคม (07)
  "ก.ค.": "07",
  "ก.ค": "07",
  "กค.": "07",
  "กค": "07",
  "กรกฎาคม": "07",
  "กรกฎา": "07",
  jul: "07",
  july: "07",

  // สิงหาคม (08)
  "ส.ค.": "08",
  "ส.ค": "08",
  "สค.": "08",
  "สค": "08",
  "สิงหาคม": "08",
  "สิงหา": "08",
  aug: "08",
  august: "08",

  // กันยายน (09)
  "ก.ย.": "09",
  "ก.ย": "09",
  "กย.": "09",
  "กย": "09",
  "กันยายน": "09",
  "กันยา": "09",
  sep: "09",
  september: "09",

  // ตุลาคม (10)
  "ต.ค.": "10",
  "ต.ค": "10",
  "ตค.": "10",
  "ตค": "10",
  "ตุลาคม": "10",
  "ตุลา": "10",
  oct: "10",
  october: "10",

  // พฤศจิกายน (11)
  "พ.ย.": "11",
  "พ.ย": "11",
  "พย.": "11",
  "พย": "11",
  "พฤศจิกายน": "11",
  "พฤศจิกา": "11",
  nov: "11",
  november: "11",

  // ธันวาคม (12)
  "ธ.ค.": "12",
  "ธ.ค": "12",
  "ธค.": "12",
  "ธค": "12",
  "ธันวาคม": "12",
  "ธันวา": "12",
  dec: "12",
  december: "12",
};

export const MONTH_DISPLAY_LABELS: Record<string, string> = {
  "01": "ม.ค.",
  "02": "ก.พ.",
  "03": "มี.ค.",
  "04": "เม.ย.",
  "05": "พ.ค.",
  "06": "มิ.ย.",
  "07": "ก.ค.",
  "08": "ส.ค.",
  "09": "ก.ย.",
  "10": "ต.ค.",
  "11": "พ.ย.",
  "12": "ธ.ค.",
};

/** แปลงสตริงวันที่ภาษาไทย เช่น "14 พ.ค.69", "27 เม.ย.69", "2 มิ.ย.69", "14/05/69" ให้เป็น ISO "YYYY-MM-DD" */
export function parseThaiDateString(s: string): string | null {
  if (!s) return null;
  const clean = s.trim();

  // 1. Check standard ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // 2. Check Thai month string (e.g. "14 พ.ค.69", "14 พ.ค. 69", "27 เม.ย.69", "2 มิ.ย.69", "14 พฤษภาคม 2569")
  const sortedKeys = Object.keys(THAI_MONTH_LOOKUP).sort((a, b) => b.length - a.length);

  for (const abbr of sortedKeys) {
    const mNum = THAI_MONTH_LOOKUP[abbr]!;
    const escapedAbbr = abbr.replace(/\./g, "\\.");
    const regex = new RegExp(
      `(?:^|\\s|\\/|-|\\.)(\\d{1,2})[\\s\\/._-]*${escapedAbbr}\\.?[\\s\\/._-]*(\\d{2,4})?(?:$|\\s)`,
      "i",
    );
    const match = clean.match(regex);
    if (match) {
      const day = String(parseInt(match[1]!, 10)).padStart(2, "0");
      let year = 2026;
      if (match[2]) {
        let yNum = parseInt(match[2], 10);
        if (yNum < 100) yNum += 2500;
        if (yNum > 2400) year = yNum - 543;
        else year = yNum;
      }
      return `${year}-${mNum}-${day}`;
    }
  }

  // 3. Check numeric date format (e.g. "14/5/69", "14/05/2569", "14-05-69", "14.5.69")
  const slashMatch = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
  if (slashMatch) {
    const day = String(parseInt(slashMatch[1]!, 10)).padStart(2, "0");
    const month = String(parseInt(slashMatch[2]!, 10)).padStart(2, "0");
    let yNum = parseInt(slashMatch[3]!, 10);
    if (yNum < 100) yNum += 2500;
    const year = yNum > 2400 ? yNum - 543 : yNum;
    return `${year}-${month}-${day}`;
  }

  return null;
}

/** จัดรูปแบบวันที่ให้อ่านง่ายเป็นภาษาไทย เช่น "2026-05-14" -> "14 พ.ค.69" */
export function formatThaiDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.slice(0, 10).split("-");
    const y = parseInt(parts[0]!, 10);
    const m = parts[1]!;
    const d = parseInt(parts[2]!, 10);
    const beYear = y < 2400 ? y + 543 : y;
    const mLabel = MONTH_DISPLAY_LABELS[m] || m;
    return `${d} ${mLabel}${beYear.toString().slice(-2)}`;
  }
  return clean;
}

export function parseExcelDate(v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number" && v > 20000 && v < 60000) {
    const date = new Date((v - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const thaiParsed = parseThaiDateString(s);
  if (thaiParsed) return thaiParsed;

  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const parts = s.split("/");
    let y = parseInt(parts[2] ?? "2026", 10);
    if (y > 2400) y -= 543;
    const m = String(parseInt(parts[1] ?? "1", 10)).padStart(2, "0");
    const d = String(parseInt(parts[0] ?? "1", 10)).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return s;
}

type RevenueColMap = Partial<
  Record<
    | "receiptNo"
    | "bookNo"
    | "name"
    | "shop"
    | "meter"
    | "period"
    | "amount"
    | "method"
    | "ref"
    | "paidDate",
    number
  >
>;

/** ตรวจจับคอลัมน์ของตารางจัดเก็บรายได้/การชำระเงิน */
function detectRevenueColumns(
  rows: unknown[][],
): { cols: RevenueColMap; headerEnd: number } {
  const cols: RevenueColMap = {};
  let headerEnd = 0;
  const scan = Math.min(rows.length, 15);
  for (let r = 0; r < scan; r++) {
    const row = rows[r] ?? [];
    if (
      isLikelyDataRow(row, cols.name, cols.meter) &&
      (cols.name !== undefined || cols.receiptNo !== undefined || cols.amount !== undefined)
    ) {
      break;
    }

    row.forEach((cell, c) => {
      const t = txt(cell).replace(/\s+/g, "");
      if (!t) return;
      const hit = (k: keyof RevenueColMap) => {
        if (cols[k] === undefined) cols[k] = c;
        headerEnd = Math.max(headerEnd, r);
      };
      if (/^(เล่มที่|เล่ม|^เล่ม$|BookNo|Vol)/i.test(t)) hit("bookNo");
      else if (
        /^(เลขที่ใบเสร็จ|เลขที่|ใบเสร็จรับเงิน|ReceiptNo|เลขใบเสร็จ|เลขที่บิล|เลขที่เอกสาร|เลขที่คุม)/i.test(
          t,
        )
      )
        hit("receiptNo");
      else if (
        /^(ชื่อผู้ประกอบการ|ชื่อ-สกุล|ยศ-นาม|ผู้ชำระเงิน|รายชื่อ|ชื่อผู้ใช้|ผู้เช่า|ผู้ขอใช้|ชื่อ|Customer|Name)/i.test(
          t,
        )
      )
        hit("name");
      else if (
        /^(ร้านค้า|สถานที่|จุดขาย|ชื่อร้าน|ล็อค|ล็อก|ห้อง|ที่ตั้ง|อาคาร|Shop|Location)/i.test(
          t,
        )
      )
        hit("shop");
      else if (
        /^(หมายเลขเครื่องวัด|หมายเลขเครื่องวัดฯ|เลขเครื่องวัด|เลขที่เครื่องวัด|เครื่องวัดฯ|เครื่องวัด|หมายเลขมิเตอร์|เลขมิเตอร์|เลขมาตร|มิเตอร์|Meter)/i.test(
          t,
        )
      )
        hit("meter");
      else if (
        /^(งวดบิล|ประจำงวด|รอบเดือน|งวด|ประจำเดือน|เดือน|Period|Month)/i.test(t)
      )
        hit("period");
      else if (
        /^(จำนวนเงิน|ยอดชำระ|ยอดรับชำระ|รวมเป็นเงิน|ยอดรวม|จำนวน|ค่าบริการ|รวมเงิน|Amount|Total|รับเงิน)/i.test(
          t,
        )
      )
        hit("amount");
      else if (
        /^(ช่องทาง|วิธีชำระ|ประเภทการชำระ|Method|ชำระโดย|ช่องทางการชำระ|ประเภทเงิน)/i.test(
          t,
        )
      )
        hit("method");
      else if (
        /^(เลขอ้างอิง|รหัสอ้างอิง|Ref|Reference|หลักฐาน|เลขที่อ้างอิง|สลิป)/i.test(t)
      )
        hit("ref");
      else if (
        /^(วันที่ชำระ|วันที่รับชำระ|วันที่|Date|วันเดือนปี|วดป)/i.test(t)
      )
        hit("paidDate");
    });
  }

  // Fallback content scan
  if (cols.name === undefined || cols.meter === undefined || cols.shop === undefined) {
    const scanRows = rows.slice(0, 25);
    for (const r of scanRows) {
      r.forEach((cell, c) => {
        const val = txt(cell).trim();
        if (!val) return;
        if (cols.meter === undefined && METER_PATTERN_REGEX.test(val)) {
          cols.meter = c;
        } else if (cols.name === undefined && RANK_PREFIX_REGEX.test(val)) {
          cols.name = c;
        } else if (
          cols.shop === undefined &&
          SHOP_KEYWORD_REGEX.test(val) &&
          c !== cols.name
        ) {
          cols.shop = c;
        }
      });
    }
  }

  return { cols, headerEnd };
}

export function matchThaiMonthHeader(
  cellText: string,
): { period: string; label: string } | null {
  const clean = cellText.replace(/\s+/g, "");
  if (
    !clean ||
    clean.includes("รวม") ||
    clean.includes("หมายเลข") ||
    clean.includes("มิเตอร์") ||
    clean.includes("ลำดับ") ||
    clean.includes("เงินประกัน")
  )
    return null;

  const sortedKeys = Object.keys(THAI_MONTH_LOOKUP).sort((a, b) => b.length - a.length);

  for (const abbr of sortedKeys) {
    const monthNum = THAI_MONTH_LOOKUP[abbr]!;
    const lowerClean = clean.toLowerCase();
    const idx = lowerClean.indexOf(abbr.toLowerCase());
    if (idx !== -1) {
      const afterText = clean.slice(idx + abbr.length);

      let year = 2569;
      const yearAfter = afterText.match(/^[\/._-]?(\d{2,4})/);
      const fourDigitYear = clean.match(/(25\d{2}|20\d{2})/);
      const anyTwoDigit = clean.match(/(?:^|[^\d])(\d{2})(?:[^\d]|$)/);

      if (yearAfter?.[1]) {
        const yNum = parseInt(yearAfter[1], 10);
        if (yNum < 100) year = 2500 + yNum;
        else if (yNum < 2500) year = yNum + 543;
        else year = yNum;
      } else if (fourDigitYear?.[1]) {
        const yNum = parseInt(fourDigitYear[1], 10);
        if (yNum < 2500) year = yNum + 543;
        else year = yNum;
      } else if (anyTwoDigit?.[1]) {
        const yNum = parseInt(anyTwoDigit[1], 10);
        year = 2500 + yNum;
      }

      const displayMonth = MONTH_DISPLAY_LABELS[monthNum] || abbr;
      return {
        period: `${year}-${monthNum}`,
        label: `${displayMonth}${year.toString().slice(-2)}`,
      };
    }
  }
  return null;
}

export interface MonthGroupInfo {
  period: string;
  label: string;
  startCol: number;
  chargeCols: number[];
  arrearsCols: number[];
  receiptCols: number[];
  receiptNoCols: number[];
  bookCols: number[];
  paidDateCols: number[];
  allCols: number[];
}

/** ตรวจจับโครงสร้างตารางค้างชำระ/ทะเบียนคุมรายได้แบบหลายงวด (เช่น DATA22ส.ค.69) */
function detectArrearsColumns(
  rows: unknown[][],
  ws?: XLSX.WorkSheet,
): {
  nameCol?: number | undefined;
  lastNameCol?: number | undefined;
  shopCol?: number | undefined;
  meterCol?: number | undefined;
  monthGroups: MonthGroupInfo[];
  generalPaidDateCols?: number[];
  totalCol?: number | undefined;
  headerEnd: number;
} {
  let nameCol: number | undefined;
  let lastNameCol: number | undefined;
  let shopCol: number | undefined;
  let meterCol: number | undefined;
  let totalCol: number | undefined;
  let headerEnd = 0;
  const monthHitsByCol = new Map<number, { period: string; label: string; text: string }>();

  // 1. Determine actual first data row and header boundary
  let firstDataRowIdx = -1;
  const maxScanRows = Math.min(rows.length, 12);
  for (let r = 0; r < maxScanRows; r++) {
    const row = rows[r] ?? [];
    if (isLikelyDataRow(row, nameCol, meterCol)) {
      firstDataRowIdx = r;
      break;
    }
  }
  const scanLimit = firstDataRowIdx > 0 ? firstDataRowIdx : Math.min(rows.length, 6);
  headerEnd = firstDataRowIdx > 0 ? firstDataRowIdx - 1 : 0;

  // Scan all header rows up to first data row
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r] ?? [];

    row.forEach((cell, c) => {
      const t = txt(cell).trim();
      if (!t) return;
      const clean = t.replace(/\s+/g, "");

      // Check standard profile columns
      if (
        /^(รายชื่อ|ชื่อผู้ประกอบการ|ผู้ประกอบการ|ชื่อ-สกุล|ผู้ใช้ไฟฟ้า|ผู้ใช้น้ำ|ชื่อผู้ใช้|ผู้เช่า|ผู้ขอใช้|ยศ-นาม|ชื่อร้าน|ชื่อผู้เช่า|ผู้รับบริการ|รายนาม|ชื่อ|^ชื่อ$|Name|Customer)/i.test(
          clean,
        ) &&
        nameCol === undefined
      ) {
        nameCol = c;
      } else if (
        /^(นามสกุล|สกุล|^สกุล$|LastName|Surname)/i.test(clean) &&
        lastNameCol === undefined
      ) {
        lastNameCol = c;
      } else if (
        /^(รายการ|ร้านค้า|สถานที่|จุดจำหน่าย|จุดขาย|ที่ตั้ง|อาคาร|ห้อง|ล็อค|ล็อก|หน่วยงาน|สังกัด|ตำแหน่ง|Shop|Location|Room|Building)/i.test(
          clean,
        ) &&
        shopCol === undefined
      ) {
        shopCol = c;
      } else if (
        /^(หมายเลขเครื่องวัด|หมายเลขมิเตอร์|เลขมิเตอร์|เลขมาตร|หมายเลข|มิเตอร์|เลขที่เครื่องวัด|เครื่องวัดฯ|เครื่องวัด|มาตรวัดน้ำ|เลขมาตรวัดน้ำ|มิเตอร์ไฟฟ้า|เลขมิเตอร์ไฟฟ้า|มาตร|Meter|MeterNo|MeterId)/i.test(
          clean,
        ) &&
        meterCol === undefined
      ) {
        meterCol = c;
      } else if (
        /^(ยอดค้างชำระรวม|รวมยอดค้างชำระ|ค้างชำระรวม|รวมค้างชำระ|รวมทั้งสิ้น|ยอดรวมทั้งสิ้น|ยอดค้างชำระทั้งหมด|ยอดรวมค้างชำระ|รวมค้าง|ค้างรวม|ยอดรวม|รวมเป็นเงิน|ยอดสุทธิ|รวมสุทธิ)$/i.test(
          clean,
        ) ||
        (/^(รวม|ยอดรวม|รวมเป็นเงิน)$/i.test(clean) && c > 5)
      ) {
        totalCol = totalCol !== undefined ? Math.max(totalCol, c) : c;
      }

      // Check for month header match on cell or stacked cells in column
      const stackedText = Array.from({ length: scanLimit }, (_, rowIdx) => txt(rows[rowIdx]?.[c]))
        .filter(Boolean)
        .join(" ");

      const m = matchThaiMonthHeader(clean) || matchThaiMonthHeader(stackedText);
      if (m) {
        const isSubCol =
          /(ลดค้างชำระ|ค้างชำระ|ยอดค้าง|คงค้าง|ใบเสร็จ|เลขที่|เล่มที่|วันที่|รับชำระ)/i.test(
            clean,
          ) ||
          /(ลดค้างชำระ|ค้างชำระ|ยอดค้าง|คงค้าง|ใบเสร็จ|เลขที่|เล่มที่|วันที่|รับชำระ)/i.test(
            stackedText,
          );
        const alreadyHasPeriod = Array.from(monthHitsByCol.values()).some(
          (h) => h.period === m.period,
        );

        if (!monthHitsByCol.has(c)) {
          if (!alreadyHasPeriod && !isSubCol) {
            monthHitsByCol.set(c, { period: m.period, label: m.label, text: stackedText || t });
          } else if (!alreadyHasPeriod) {
            monthHitsByCol.set(c, { period: m.period, label: m.label, text: stackedText || t });
          }
        }
      }
    });
  }

  // Scan for all paidDate columns across the entire sheet
  const generalPaidDateCols: number[] = [];
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r] ?? [];
    row.forEach((cell, c) => {
      const t = txt(cell).trim();
      const stacked = Array.from({ length: scanLimit }, (_, rowIdx) => txt(rows[rowIdx]?.[c]))
        .filter(Boolean)
        .join(" ");
      if (
        /(วันที่|วันที่รับชำระ|paiddate|date|วดป)/i.test(t) ||
        /(วันที่|วันที่รับชำระ|paiddate|date|วดป)/i.test(stacked)
      ) {
        if (!generalPaidDateCols.includes(c)) {
          generalPaidDateCols.push(c);
        }
      }
    });
  }

  // Fallback content scan across first 25 rows if name/shop/meter not found
  if (nameCol === undefined || meterCol === undefined || shopCol === undefined) {
    const scanRows = rows.slice(0, 25);
    for (const r of scanRows) {
      r.forEach((cell, c) => {
        const val = txt(cell).trim();
        if (!val) return;
        if (meterCol === undefined && METER_PATTERN_REGEX.test(val)) {
          meterCol = c;
        } else if (nameCol === undefined && RANK_PREFIX_REGEX.test(val)) {
          nameCol = c;
        } else if (
          shopCol === undefined &&
          SHOP_KEYWORD_REGEX.test(val) &&
          c !== nameCol
        ) {
          shopCol = c;
        }
      });
    }
  }

  if (
    nameCol !== undefined &&
    lastNameCol === undefined &&
    shopCol !== undefined &&
    shopCol > nameCol + 1
  ) {
    lastNameCol = nameCol + 1;
  }

  // 2. Build Month Groups and attach subcolumns (charge, receipt, arrears, paidDate)
  const sortedMonthCols = Array.from(monthHitsByCol.keys()).sort((a, b) => a - b);
  const monthGroups: MonthGroupInfo[] = [];

  sortedMonthCols.forEach((startCol, idx) => {
    const hit = monthHitsByCol.get(startCol)!;
    const nextStartCol =
      idx < sortedMonthCols.length - 1
        ? sortedMonthCols[idx + 1]!
        : totalCol !== undefined && totalCol > startCol
          ? totalCol
          : rows[0]?.length ?? startCol + 10;

    const group: MonthGroupInfo = {
      period: hit.period,
      label: hit.label,
      startCol,
      chargeCols: [],
      arrearsCols: [],
      receiptCols: [],
      receiptNoCols: [],
      bookCols: [],
      paidDateCols: [],
      allCols: [],
    };

    // Scan all columns from startCol up to nextStartCol - 1
    for (let c = startCol; c < nextStartCol; c++) {
      if (totalCol !== undefined && c >= totalCol) break;

      const colText = Array.from({ length: headerEnd + 1 }, (_, rowIdx) => txt(rows[rowIdx]?.[c]))
        .filter(Boolean)
        .join(" ");

      if (
        /(ยอดค้างชำระรวม|รวมยอดค้างชำระ|ค้างชำระรวม|รวมค้างชำระ|รวมทั้งสิ้น|ยอดรวมทั้งสิ้น|ยอดค้างชำระทั้งหมด|ยอดรวมค้างชำระ)/i.test(
          colText.replace(/\s+/g, ""),
        )
      ) {
        // Skip grand total columns
        continue;
      }

      group.allCols.push(c);

      if (/(วันที่|วันที่รับชำระ|paiddate|date|วดป)/i.test(colText)) {
        group.paidDateCols.push(c);
      } else if (/(เล่มที่|เล่ม|^เล่ม$|book|vol)/i.test(colText)) {
        group.bookCols.push(c);
        group.receiptCols.push(c);
      } else if (/(ใบเสร็จ|เลขที่|เลขใบเสร็จ|receipt|no\.)/i.test(colText)) {
        group.receiptNoCols.push(c);
        group.receiptCols.push(c);
      } else if (/(ค้างชำระ|ยอดค้าง|คงค้าง)/i.test(colText)) {
        group.arrearsCols.push(c);
      } else if (
        /(ค่าไฟ|ค่าน้ำ|จำนวนเงิน|ยอดใช้|ยอดเงิน|amount|charge)/i.test(colText) ||
        c === startCol
      ) {
        group.chargeCols.push(c);
      } else {
        group.chargeCols.push(c);
      }
    }

    if (group.chargeCols.length === 0 && group.arrearsCols.length === 0) {
      group.chargeCols.push(startCol);
    }

    monthGroups.push(group);
  });

  return {
    nameCol,
    lastNameCol,
    shopCol,
    meterCol,
    monthGroups,
    generalPaidDateCols,
    totalCol,
    headerEnd,
  };
}

export async function parseArrearsWorkbook(
  file: File,
  defaultDivision?: Division,
): Promise<ArrearsLedgerRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const fileDivision = detectWorkbookDivision(wb) || defaultDivision;
  const out: ArrearsLedgerRow[] = [];

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (!rows.length) return;

    const {
      nameCol,
      lastNameCol,
      shopCol,
      meterCol,
      monthGroups,
      generalPaidDateCols,
      totalCol,
      headerEnd,
    } = detectArrearsColumns(rows, ws);

    if (nameCol === undefined && meterCol === undefined && shopCol === undefined)
      return;

    // Auto-detect division per sheet, defaulting to the overall file division
    const sheetDivision = detectDivisionFromSheet(
      sheetName,
      rows,
      fileDivision,
    );

    for (let r = headerEnd + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const rawFirst = nameCol !== undefined ? txt(row[nameCol]) : "";
      const rawLast = lastNameCol !== undefined ? txt(row[lastNameCol]) : "";
      const shop = shopCol !== undefined ? txt(row[shopCol]) : "";
      const meter = meterCol !== undefined ? txt(row[meterCol]) : "";

      if (!rawFirst && !shop && !meter) continue;
      if (isHeaderOrSummaryRow(rawFirst, shop, row)) continue;

      const name =
        rawLast && !rawFirst.includes(rawLast)
          ? `${rawFirst} ${rawLast}`.trim()
          : rawFirst || shop;

      const monthlyArrears: MonthlyArrearsItem[] = [];
      const monthlyPaid: MonthlyPaidItem[] = [];

      monthGroups.forEach((mg) => {
        // 1. อ่านค่าไฟฟ้า หรือ ค่าน้ำประปาก่อน (Monthly charge amount)
        const chargeVal = mg.chargeCols
          .map((c) => num(row[c]))
          .find((v) => v !== undefined && v > 0);

        // 2. ไปอ่านยอดค้างชำระ / ลดค้างชำระ (Arrears & status column)
        const arrearsText = mg.arrearsCols
          .map((c) => txt(row[c]).trim())
          .find((val) => /(จ่ายแล้ว|ชำระแล้ว|จ่ายครบ|ชำระครบ|เรียบร้อย|^จ่าย$|^ชำระ$)/i.test(val));
        const hasPaidWord = Boolean(arrearsText);

        const isExplicitZeroArrears = mg.arrearsCols.some((c) => {
          const s = txt(row[c]).trim();
          return s === "0" || s === "0.00" || s === "0.0";
        });

        const arrearsVal = mg.arrearsCols
          .map((c) => num(row[c]))
          .find((v) => v !== undefined && v > 0);

        // 3. อ่านเลขที่ใบเสร็จ และ เล่มที่ (ถ้ามี)
        let receiptNo = mg.receiptNoCols
          .map((c) => txt(row[c]).trim())
          .find((val) => val !== "" && val !== "-" && !/^(ยังไม่|ค้าง|ไม่ชำระ|รอ|0)$/i.test(val));

        let bookNo = mg.bookCols
          .map((c) => txt(row[c]).trim())
          .find((val) => val !== "" && val !== "-" && !/^(ยังไม่|ค้าง|ไม่ชำระ|รอ|0)$/i.test(val));

        if (!receiptNo) {
          receiptNo = mg.receiptCols
            .map((c) => txt(row[c]).trim())
            .find((val) => val !== "" && val !== "-" && val !== bookNo && !/^(ยังไม่|ค้าง|ไม่ชำระ|รอ|0)$/i.test(val));
        }

        // 4. อ่านวันที่รับชำระ (ถ้ามี)
        const rawPaidDate = mg.paidDateCols
          .map((c) => row[c])
          .find((val) => {
            const s = txt(val).trim();
            return s !== "" && s !== "-" && !/^(ยังไม่|ค้าง|ไม่ชำระ|รอ|0)$/i.test(s);
          });
        const paidDate = rawPaidDate ? parseExcelDate(rawPaidDate) : undefined;

        const hasReceipt = Boolean(receiptNo || bookNo);
        const hasPaidDate = Boolean(paidDate);

        // Case 1: ยอดค้างชำระมีคำว่า "จ่ายแล้ว" หรือระบุ 0.00 -> ชำระครบตามยอดเต็ม
        if (hasPaidWord || isExplicitZeroArrears) {
          const paidAmount = chargeVal ?? (arrearsVal !== undefined && arrearsVal > 0 ? arrearsVal : 0);
          if (paidAmount > 0) {
            monthlyPaid.push({
              period: mg.period,
              monthLabel: mg.label,
              amount: +paidAmount.toFixed(2),
              receiptNo: receiptNo || "จ่ายแล้ว",
              bookNo: bookNo || undefined,
              paidDate: paidDate || undefined,
            });
          }
        }
        // Case 2: มียอดค้างชำระเป็นตัวเลข (arrearsVal > 0) -> ยังมียอดหนี้ค้างชำระอยู่!
        else if (arrearsVal !== undefined && arrearsVal > 0) {
          // บันทึกยอดหนี้ค้างชำระ
          monthlyArrears.push({
            period: mg.period,
            monthLabel: mg.label,
            amount: +arrearsVal.toFixed(2),
          });

          // ถ้ามีการจ่ายเงินบางส่วน (chargeVal > arrearsVal) หรือมีใบเสร็จ -> บันทึกส่วนที่จ่ายไปแล้ว
          if (chargeVal !== undefined && chargeVal > arrearsVal) {
            const partialPaid = +(chargeVal - arrearsVal).toFixed(2);
            if (partialPaid > 0 && (hasReceipt || hasPaidDate)) {
              monthlyPaid.push({
                period: mg.period,
                monthLabel: mg.label,
                amount: partialPaid,
                receiptNo: receiptNo || undefined,
                bookNo: bookNo || undefined,
                paidDate: paidDate || undefined,
              });
            }
          }
        }
        // Case 3: ช่องยอดค้างชำระเป็นช่องว่าง (ไม่มีตัวเลขค้างชำระ)
        else {
          if (hasReceipt || hasPaidDate) {
            // มีใบเสร็จ/วันที่ชำระ และช่องค้างชำระว่าง -> ถือว่าชำระครบเต็มจำนวน
            const paidAmount = chargeVal ?? 0;
            if (paidAmount > 0) {
              monthlyPaid.push({
                period: mg.period,
                monthLabel: mg.label,
                amount: +paidAmount.toFixed(2),
                receiptNo: receiptNo || undefined,
                bookNo: bookNo || undefined,
                paidDate: paidDate || undefined,
              });
            }
          } else {
            // ไม่มีใบเสร็จ ไม่มีวันที่ชำระ และช่องค้างชำระว่าง -> ยังไม่ได้จ่าย ให้ยกยอดค่าไฟฟ้า/ค่าน้ำเป็นยอดหนี้
            const debtAmount = chargeVal ?? 0;
            if (debtAmount > 0) {
              monthlyArrears.push({
                period: mg.period,
                monthLabel: mg.label,
                amount: +debtAmount.toFixed(2),
              });
            }
          }
        }
      });

      // Deduplicate by period (keep latest/highest if duplicate period)
      const uniqueMonthlyArrearsMap = new Map<string, MonthlyArrearsItem>();
      monthlyArrears.forEach((item) => {
        if (!uniqueMonthlyArrearsMap.has(item.period)) {
          uniqueMonthlyArrearsMap.set(item.period, item);
        }
      });
      const uniqueMonthlyArrears = Array.from(uniqueMonthlyArrearsMap.values()).sort(
        (a, b) => a.period.localeCompare(b.period),
      );

      const uniqueMonthlyPaidMap = new Map<string, MonthlyPaidItem>();
      monthlyPaid.forEach((item) => {
        if (!uniqueMonthlyPaidMap.has(item.period)) {
          uniqueMonthlyPaidMap.set(item.period, item);
        }
      });
      const uniqueMonthlyPaid = Array.from(uniqueMonthlyPaidMap.values()).sort(
        (a, b) => a.period.localeCompare(b.period),
      );

      // Extract any row-level paid date from generalPaidDateCols or row cells
      const rowFallbackPaidDate = (generalPaidDateCols ?? [])
        .map((c: number) => row[c])
        .map((val: unknown) => parseExcelDate(val))
        .find((d: string | undefined): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d)));

      const firstKnownPaidDate =
        uniqueMonthlyPaid.find((p) => p.paidDate)?.paidDate || rowFallbackPaidDate;

      // Propagate paidDate if multiple months share receiptNo/bookNo or within the same row
      uniqueMonthlyPaid.forEach((p) => {
        if (!p.paidDate) {
          const sameReceipt = uniqueMonthlyPaid.find(
            (other) =>
              other.paidDate &&
              ((p.receiptNo && other.receiptNo === p.receiptNo) ||
                (p.bookNo && other.bookNo === p.bookNo)),
          );
          if (sameReceipt?.paidDate) {
            p.paidDate = sameReceipt.paidDate;
          } else if (firstKnownPaidDate) {
            p.paidDate = firstKnownPaidDate;
          }
        }
      });

      const explicitTotal = totalCol !== undefined ? num(row[totalCol]) : undefined;
      const computedTotal = uniqueMonthlyArrears.reduce(
        (sum, item) => sum + item.amount,
        0,
      );
      const totalArrears =
        explicitTotal !== undefined ? explicitTotal : +computedTotal.toFixed(2);

      out.push({
        name,
        shop: shop || "ร้านค้า",
        meter,
        monthlyArrears: uniqueMonthlyArrears,
        monthlyPaid: uniqueMonthlyPaid,
        totalArrears,
        division: sheetDivision || defaultDivision || "electric",
        sheet: sheetName,
      });
    }
  });

  return out;
}

export async function parseRevenueWorkbook(
  file: File,
  defaultDivision?: Division,
): Promise<RevenueImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const fileDivision = detectWorkbookDivision(wb) || defaultDivision;
  const out: RevenueImportRow[] = [];

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (!rows.length) return;

    const { cols, headerEnd } = detectRevenueColumns(rows);
    if (
      cols.amount === undefined &&
      cols.name === undefined &&
      cols.receiptNo === undefined
    )
      return;

    // Auto-detect division per sheet, defaulting to the overall file division
    const sheetDivision = detectDivisionFromSheet(
      sheetName,
      rows,
      fileDivision,
    );

    for (let r = headerEnd + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const name = cols.name !== undefined ? txt(row[cols.name]) : "";
      const shop = cols.shop !== undefined ? txt(row[cols.shop]) : "";
      const meter = cols.meter !== undefined ? txt(row[cols.meter]) : "";
      const receiptNo = cols.receiptNo !== undefined ? txt(row[cols.receiptNo]) : "";
      const bookNo = cols.bookNo !== undefined ? txt(row[cols.bookNo]) : undefined;
      const amount = cols.amount !== undefined ? num(row[cols.amount]) : undefined;

      if (!name && !shop && !receiptNo && !meter && amount === undefined)
        continue;
      if (isHeaderOrSummaryRow(name, shop, row)) continue;
      if (amount === undefined || isNaN(amount)) continue;

      const period = cols.period !== undefined ? txt(row[cols.period]) : "";
      const methodStr =
        cols.method !== undefined ? txt(row[cols.method]).toLowerCase() : "";
      const method: "online" | "counter" =
        methodStr.includes("counter") ||
        methodStr.includes("เคาน์เตอร์") ||
        methodStr.includes("สด")
          ? "counter"
          : "online";
      const ref = cols.ref !== undefined ? txt(row[cols.ref]) : "";
      const paidDate =
        cols.paidDate !== undefined ? parseExcelDate(row[cols.paidDate]) : "";

      out.push({
        receiptNo: receiptNo || `REC-${Date.now().toString().slice(-4)}-${r}`,
        bookNo: bookNo || undefined,
        name: name || shop || "ผู้ประกอบการ",
        shop: shop || (name ? "" : "ร้านค้า"),
        meter: meter || undefined,
        period,
        amount,
        method,
        ref: ref || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        paidDate: paidDate || new Date().toISOString().slice(0, 10),
        division: sheetDivision || defaultDivision || "electric",
        sheet: sheetName,
      });
    }
  });

  return out;
}




