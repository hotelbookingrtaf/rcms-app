import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CURRENT_PERIOD,
  DEFAULT_SETTINGS,
  SEED_LOGS,
  SEED_TASKS,
  SEED_USERS,
  makeCustomers,
  makeHistoryBills,
  makeReadings,
  makeSeedPayments,
  todayISO,
} from "./rcms-seed";
import type {
  AppUser,
  AuditLog,
  Bill,
  BillLine,
  BillSend,
  Customer,
  Division,
  Payment,
  Reading,
  Role,
  ServiceTask,
  TaskStatus,
  Settings,
  SlipData,
} from "./rcms-types";
import { ROLE_LABEL, fullName } from "./rcms-types";
import { canPerform } from "./permissions";
import { validateSettlementSelection } from "./prototype-rules";
import { validateReading } from "@/domain/v13";
import { type ArrearsLedgerRow, formatThaiDate } from "./excel-import";
export { formatThaiDate };

export const thb = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const periodLabel = (p: string) => {
  const [y = "", m = "1"] = p.split("-");
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  return `${months[Number(m) - 1]} ${y.slice(2)}`;
};

export const periodFullThai = (p: string) => {
  const [y = "", m = "1"] = p.split("-");
  const monthsFull = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  const monthName = monthsFull[Number(m) - 1] ?? "";
  const yearStr = y.length === 4 ? (Number(y) < 2500 ? String(Number(y) + 543) : y) : y;
  return `${monthName} ${yearStr}`;
};

export const thaiBahtText = (num: number): string => {
  if (isNaN(num) || num === 0) return "ศูนย์บาทถ้วน";
  const isNegative = num < 0;
  num = Math.abs(num);
  const formatted = num.toFixed(2);
  const parts = formatted.split(".");
  const intStr = parts[0] ?? "0";
  const decStr = parts[1] ?? "00";

  const digitWords = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const posWords = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  const convertGroup = (digits: string): string => {
    let res = "";
    const len = digits.length;
    for (let i = 0; i < len; i++) {
      const char = digits[i] ?? "0";
      const d = parseInt(char, 10);
      const pos = len - i - 1;
      const prevChar = len > 1 ? (digits[len - 2] ?? "") : "";
      const dWord = digitWords[d] ?? "";
      const pWord = posWords[pos] ?? "";

      if (d !== 0) {
        if (pos === 0 && d === 1 && len > 1 && prevChar !== "0") {
          res += "เอ็ด";
        } else if (pos === 1 && d === 1) {
          res += "สิบ";
        } else if (pos === 1 && d === 2) {
          res += "ยี่สิบ";
        } else {
          res += dWord + (pos === 1 ? "สิบ" : pWord);
        }
      }
    }
    return res;
  };

  let intText = "";
  if (intStr === "0" || intStr === "") {
    intText = "";
  } else {
    let len = intStr.length;
    let groupIndex = 0;
    while (len > 0) {
      const start = Math.max(0, len - 6);
      const chunk = intStr.substring(start, len);
      let chunkText = convertGroup(chunk);
      if (groupIndex > 0 && chunkText) {
        chunkText += "ล้าน";
      }
      intText = chunkText + intText;
      len = start;
      groupIndex++;
    }
  }

  let text = (intText || (decStr && decStr !== "00" ? "" : "ศูนย์")) + "บาท";
  if (!decStr || decStr === "00") {
    text += "ถ้วน";
  } else {
    let satangText = "";
    const d1 = parseInt(decStr[0] ?? "0", 10);
    const d2 = parseInt(decStr[1] ?? "0", 10);
    const d1Word = digitWords[d1] ?? "";
    const d2Word = digitWords[d2] ?? "";

    if (d1 === 1) satangText += "สิบ";
    else if (d1 === 2) satangText += "ยี่สิบ";
    else if (d1 > 2) satangText += d1Word + "สิบ";

    if (d2 === 1 && d1 > 0) satangText += "เอ็ด";
    else if (d2 > 0) satangText += d2Word;

    text += satangText + "สตางค์";
  }

  return (isNegative ? "ลบ" : "") + text;
};

import {
  normalizeThaiName,
  normalizeMeterNo,
  findMatchingCustomer,
} from "./customer-matching.ts";

export {
  normalizeThaiName,
  normalizeMeterNo,
  findMatchingCustomer,
};

export interface ElectricCalculationBreakdown {
  units: number;
  baseEnergy: number;
  ftAmount: number;
  serviceFee: number;
  subtotal: number;
  vatAmount: number;
  totalDue: number;
}

export function calculateElectricBill(
  units: number,
  settings: Partial<Settings> = {},
): ElectricCalculationBreakdown {
  const u = Math.max(0, units);
  const ftRate = settings.ft ?? 0.1623;
  const serviceFee = settings.serviceFee ?? 33.29;
  const vatRate = (settings.vatPercent ?? 7) / 100;

  let baseEnergy = 0;
  if (u > 0) {
    if (u <= 150) {
      baseEnergy = u * (settings.electricRate ?? 3.2484);
    } else if (u <= 400) {
      baseEnergy = 150 * (settings.electricRate ?? 3.2484) + (u - 150) * 4.2218;
    } else {
      baseEnergy =
        150 * (settings.electricRate ?? 3.2484) + 250 * 4.2218 + (u - 400) * 4.4217;
    }
  }
  const baseEnergyRounded = +baseEnergy.toFixed(2);
  const ftAmountRounded = +(u * ftRate).toFixed(2);
  const serviceFeeRounded = serviceFee;
  const subtotalRounded = +(baseEnergyRounded + ftAmountRounded + serviceFeeRounded).toFixed(2);
  const vatAmountRounded = +(subtotalRounded * vatRate).toFixed(2);
  const totalDueRounded = +(subtotalRounded + vatAmountRounded).toFixed(2);

  return {
    units: u,
    baseEnergy: baseEnergyRounded,
    ftAmount: ftAmountRounded,
    serviceFee: serviceFeeRounded,
    subtotal: subtotalRounded,
    vatAmount: vatAmountRounded,
    totalDue: totalDueRounded,
  };
}

export function calculateReadingAmount(
  division: Division,
  usageUnits: number,
  settings: Settings,
): number {
  if (division === "electric") {
    return calculateElectricBill(usageUnits, settings).totalDue;
  } else {
    if (usageUnits <= 0) {
      return settings.serviceFee ?? settings.meterMaintenanceFee ?? 33.29;
    }
    const rate = settings.waterRate ?? 9.5;
    const vatMult = 1 + (settings.vatPercent ?? 7) / 100;
    return +(usageUnits * rate * vatMult).toFixed(2);
  }
}

export const DISPLAY_STATUS = {
  normal: {
    key: "normal" as const,
    label: "ปกติ",
    cls: "bg-success/15 text-success border-success/30",
  },
  arrears: {
    key: "arrears" as const,
    label: "ค้างชำระ",
    cls: "bg-destructive/15 text-destructive border-destructive/30",
  },
  suspended: {
    key: "suspended" as const,
    label: "ระงับบริการ",
    cls: "bg-muted text-muted-foreground border-border",
  },
  maintenance: {
    key: "maintenance" as const,
    label: "รักษามิเตอร์",
    cls: "bg-warning/20 text-warning border-warning/30",
  },
};

export interface SettleInput {
  billIds: string[];
  method: "online" | "counter";
  ref: string;
  slipAttached: boolean;
  reconnectFee?: number;
}

interface Ctx {
  /** ผู้ใช้งานที่ล็อกอินอยู่ (null = ยังไม่ได้เข้าสู่ระบบ) */
  me: AppUser | null;
  role: Role;
  users: AppUser[];
  login: (email: string, password: string) => boolean;
  logout: () => void;
  register: (u: Omit<AppUser, "id" | "status" | "createdAt" | "role">) => boolean;
  addUser: (u: Omit<AppUser, "id" | "createdAt">) => boolean;
  approveUser: (id: string) => void;
  updateUser: (u: AppUser) => void;
  deleteUser: (id: string) => void;
  can: (path: string) => boolean;

  period: string;
  setPeriod: (p: string) => void;
  settings: Settings;
  saveSettings: (s: Settings) => void;
  customers: Customer[];
  readings: Reading[];
  bills: Bill[];
  payments: Payment[];
  tasks: ServiceTask[];
  logs: AuditLog[];
  billSends: BillSend[];

  addCustomer: (
    c: Omit<
      Customer,
      "id" | "code" | "status" | "serviceStates" | "siteId" | "siteCode" | "createdAt"
    >,
  ) => void;
  updateCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
  clearCustomers: () => void;
  resetCustomers: () => void;
  clearReadings: (targetPeriod?: string, targetDivision?: Division) => void;
  resetReadings: () => void;
  clearAllData: () => void;
  resetAllData: () => void;
  importReadings: (
    division: "electric" | "water",
    rows: Array<{
      name?: string | undefined;
      shop?: string | undefined;
      meter?: string | undefined;
      prev?: number | undefined;
      curr?: number | undefined;
      used?: number | undefined;
      amount?: number | undefined;
      sheet?: string | undefined;
      division?: Division | undefined;
    }>,
    sourceDataVersion?: string,
    targetPeriod?: string,
  ) => { matched: number; skipped: number; warnings: number; rejected: number; duplicate: boolean };
  importCustomers: (
    rows: Array<{
      code?: string | undefined;
      name: string;
      shop?: string | undefined;
      phone?: string | undefined;
      lineId?: string | undefined;
      elecMeter?: string | undefined;
      waterMeter?: string | undefined;
      depositPaid?: number | undefined;
    }>,
  ) => { added: number; updated: number };
  importRevenueLedger: (
    rows: Array<{
      receiptNo?: string | undefined;
      bookNo?: string | undefined;
      name: string;
      shop?: string | undefined;
      meter?: string | undefined;
      period?: string | undefined;
      amount: number;
      method?: "online" | "counter" | undefined;
      ref?: string | undefined;
      paidDate?: string | undefined;
      division?: Division | undefined;
    }>,
    targetPeriod?: string,
    division?: Division,
  ) => { matched: number; skipped: number; totalAmount: number };
  importArrearsLedger: (
    rows: ArrearsLedgerRow[],
    division?: Division,
  ) => { updatedCount: number; addedCount: number; totalArrearsImported: number };
  setReading: (
    customerId: string,
    division: "electric" | "water",
    period: string,
    curr: number,
  ) => void;
  generateBills: (period: string, mode?: "combined" | "split" | "electric" | "water") => number;
  sendBill: (billId: string, customTargetId?: string) => Promise<void> | void;
  sendsOf: (billId: string) => BillSend[];
  sendReceipt: (paymentId: string, customTargetId?: string) => Promise<void> | void;
  receiptSendsOf: (paymentId: string) => BillSend[];

  /** ดึงสลิปจาก Line OA แล้วอ่านด้วย OCR */
  fetchLineSlips: () => { ok: number; problem: number };
  /** บันทึกการชำระ (เคาน์เตอร์/โอน) พร้อมแนบสลิป */
  settle: (input: SettleInput) => boolean;
  verifyPayment: (paymentId: string, ok: boolean) => void;
  updatePayment: (
    paymentId: string,
    patch: Partial<Pick<Payment, "ref" | "receiptNo" | "bookNo" | "paidDate" | "paidAt" | "method" | "amount" | "division">>,
  ) => boolean;

  createTask: (
    customerId: string,
    type: "disconnect" | "reconnect",
    division: "electric" | "water",
    amountDue: number,
    options?: {
      note?: string;
      referenceNo?: string;
      reconnectFee?: number;
      autoApprove?: boolean;
    },
  ) => void;
  decideTask: (taskId: string, ok: boolean) => void;
  batchDecideTasks: (taskIds: string[], ok: boolean) => void;
  completeTask: (taskId: string) => void;
  cancelTask: (taskId: string, reason?: string) => void;
  cancelSuspension: (customerId: string, division: Division) => void;

  customerOf: (id: string) => Customer | undefined;
  billsOf: (id: string) => Bill[];
  unpaidBillsOf: (id: string) => Bill[];
  outstanding: (id: string, division?: Division, beforePeriod?: string) => number;
  arrearsOf: (
    id: string,
    division?: Division | undefined,
    beforePeriod?: string | undefined,
  ) => Array<{ period: string; amount: number; division?: Division | undefined }>;
  displayStatus: (id: string) => {
    key: "normal" | "arrears" | "suspended" | "maintenance";
    label: string;
    cls: string;
  };
}

const RcmsContext = createContext<Ctx | null>(null);

let seq = 100;
const nid = (p: string) => `${p}-${++seq}`;
const now = () =>
  new Date().toLocaleString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const BANKS = ["ธนาคารทหารไทยธนชาต", "ธนาคารกรุงไทย", "ธนาคารกสิกรไทย", "ธนาคารไทยพาณิชย์"];

/** สิทธิ์เข้าถึงเมนูตามบทบาท */
export const ROUTE_ACCESS: Record<string, Role[]> = {
  "/": [
    "admin",
    "supervisor",
    "revenue_officer",
    "utility_field_officer",
    "auditor",
    "entrepreneur",
  ],
  "/customers": ["admin", "supervisor", "revenue_officer"],
  "/readings": ["admin", "supervisor", "revenue_officer", "utility_field_officer", "auditor"],
  "/import": ["admin", "supervisor", "revenue_officer", "utility_field_officer", "auditor"],
  "/billing": ["admin", "supervisor", "revenue_officer", "auditor"],
  "/payments": ["admin", "supervisor", "revenue_officer", "auditor"],
  "/history": ["admin", "supervisor", "revenue_officer", "auditor"],
  "/service": ["admin", "supervisor", "revenue_officer", "utility_field_officer", "auditor"],
  "/approvals": ["admin", "supervisor", "revenue_officer", "auditor"],
  "/tasks": ["admin", "supervisor", "revenue_officer", "utility_field_officer", "auditor"],
  "/reports": ["admin", "supervisor", "revenue_officer", "auditor"],
  "/audit": ["admin", "supervisor", "auditor"],
  "/users": ["admin"],
  "/settings": ["admin"],
};

function makeSlip(customerName: string, amount: number, ref: string, ok: boolean): SlipData {
  const bank = BANKS[Math.floor(Math.random() * BANKS.length)] ?? BANKS[0]!;
  return {
    bank,
    payerName: customerName,
    payerAccount: `xxx-x-x${Math.floor(Math.random() * 9000 + 1000)}-x`,
    amount: ok ? amount : +(amount - Math.round(Math.random() * 300 + 20)).toFixed(2),
    dateTime: now(),
    ref,
  };
}

function loadStorage<T>(key: string, fallback: () => T): T {
  try {
    if (typeof window === "undefined") return fallback();
    const item = localStorage.getItem(key);
    if (item !== null && item !== undefined) {
      return JSON.parse(item) as T;
    }
  } catch (e) {
    console.error(`Failed to load ${key} from localStorage`, e);
  }
  return fallback();
}

export function RcmsProvider({ children }: { children: ReactNode }) {
  const isCleared = typeof window !== "undefined" && localStorage.getItem("rcms_cleared") === "true";

  const [users, setUsers] = useState<AppUser[]>(() =>
    loadStorage("rcms_users", () => SEED_USERS)
  );
  const [me, setMe] = useState<AppUser | null>(() =>
    loadStorage("rcms_auth_user", () => null)
  );
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [settings, setSettings] = useState<Settings>(() =>
    loadStorage("rcms_settings", () => DEFAULT_SETTINGS)
  );
  const [customers, setCustomers] = useState<Customer[]>(() =>
    loadStorage("rcms_customers", () => (isCleared ? [] : makeCustomers()))
  );
  const [readings, setReadings] = useState<Reading[]>(() =>
    loadStorage("rcms_readings", () => (isCleared ? [] : makeReadings(makeCustomers())))
  );
  const [bills, setBills] = useState<Bill[]>(() =>
    loadStorage("rcms_bills", () => {
      if (isCleared) return [];
      const cs = makeCustomers();
      return makeHistoryBills(cs, makeReadings(cs));
    })
  );
  const [payments, setPayments] = useState<Payment[]>(() =>
    loadStorage("rcms_payments", () => {
      if (isCleared) return [];
      const cs = makeCustomers();
      const bs = makeHistoryBills(cs, makeReadings(cs));
      return makeSeedPayments(bs, cs);
    })
  );
  const [tasks, setTasks] = useState<ServiceTask[]>(() => {
    const raw = loadStorage("rcms_tasks", () => (isCleared ? [] : SEED_TASKS));
    const seen = new Set<string>();
    return (raw || []).filter((t: ServiceTask) => {
      if (!t || !t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  });
  const [logs, setLogs] = useState<AuditLog[]>(() =>
    loadStorage("rcms_logs", () => (isCleared ? [] : SEED_LOGS))
  );
  const [billSends, setBillSends] = useState<BillSend[]>(() =>
    loadStorage("rcms_bill_sends", () => [])
  );

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("rcms_customers", JSON.stringify(customers));
      if (customers.length > 0) localStorage.removeItem("rcms_cleared");
    } catch {}
  }, [customers]);

  useEffect(() => {
    try {
      localStorage.setItem("rcms_readings", JSON.stringify(readings));
    } catch {}
  }, [readings]);

  useEffect(() => {
    try {
      localStorage.setItem("rcms_bills", JSON.stringify(bills));
    } catch {}
  }, [bills]);

  useEffect(() => {
    try {
      localStorage.setItem("rcms_payments", JSON.stringify(payments));
    } catch {}
  }, [payments]);

  useEffect(() => {
    try {
      localStorage.setItem("rcms_tasks", JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem("rcms_logs", JSON.stringify(logs));
    } catch {}
  }, [logs]);

  useEffect(() => {
    try {
      localStorage.setItem("rcms_bill_sends", JSON.stringify(billSends));
    } catch {}
  }, [billSends]);

  useEffect(() => {
    try {
      localStorage.setItem("rcms_settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // 1. Auto-deduplicate duplicate customers and auto-correct misplaced meter series (20177, 72793, 50365, 38944 are ELECTRIC)
  useEffect(() => {
    if (!customers.length) return;
    const remap = new Map<string, string>(); // oldId -> canonicalId
    const uniqueCustomers: Customer[] = [];
    let custChanged = false;

    customers.forEach((c) => {
      // Auto-correct misplaced meter series: 20177, 72793, 50365, 38944 are ELECTRICITY meters
      if (
        c.waterMeter &&
        (c.waterMeter.startsWith("20177-") ||
          c.waterMeter.startsWith("72793-") ||
          c.waterMeter.startsWith("50365-") ||
          c.waterMeter.startsWith("38944-"))
      ) {
        if (!c.elecMeter || c.elecMeter === "—" || c.elecMeter === "-") {
          c.elecMeter = c.waterMeter;
          c.waterMeter = undefined;
        } else if (c.waterMeter.startsWith("20177-") || c.waterMeter === c.elecMeter) {
          c.waterMeter = undefined;
        }
        custChanged = true;
      }

      const bySameId = uniqueCustomers.find(
        (u) => u.id === c.id || (Boolean(c.code) && u.code === c.code),
      );
      if (bySameId) {
        if (!bySameId.elecMeter && c.elecMeter) bySameId.elecMeter = c.elecMeter;
        if (!bySameId.waterMeter && c.waterMeter) bySameId.waterMeter = c.waterMeter;
        if (!bySameId.phone && c.phone) bySameId.phone = c.phone;
        if (!bySameId.lineId && c.lineId) bySameId.lineId = c.lineId;
        custChanged = true;
      } else {
        const canonical = findMatchingCustomer(
          uniqueCustomers,
          c.elecMeter || c.waterMeter,
          c.name,
          c.shop,
        );

        if (canonical && canonical.id !== c.id) {
          remap.set(c.id, canonical.id);
          // Merge missing fields into canonical
          if (!canonical.elecMeter && c.elecMeter) {
            canonical.elecMeter = c.elecMeter;
            custChanged = true;
          }
          if (!canonical.waterMeter && c.waterMeter) {
            canonical.waterMeter = c.waterMeter;
            custChanged = true;
          }
          if (!canonical.phone && c.phone) {
            canonical.phone = c.phone;
            custChanged = true;
          }
          if (!canonical.lineId && c.lineId) {
            canonical.lineId = c.lineId;
            custChanged = true;
          }
        } else {
          uniqueCustomers.push(c);
        }
      }
    });

    if (custChanged || uniqueCustomers.length !== customers.length) {
      setCustomers(uniqueCustomers);
      if (remap.size > 0) {
        setReadings((prev) =>
          prev.map((r) => (remap.has(r.customerId) ? { ...r, customerId: remap.get(r.customerId)! } : r)),
        );
        setBills((prev) =>
          prev.map((b) => (remap.has(b.customerId) ? { ...b, customerId: remap.get(b.customerId)! } : b)),
        );
        setPayments((prev) =>
          prev.map((p) => (remap.has(p.customerId) ? { ...p, customerId: remap.get(p.customerId)! } : p)),
        );
        setTasks((prev) =>
          prev.map((t) => (remap.has(t.customerId) ? { ...t, customerId: remap.get(t.customerId)! } : t)),
        );
      }
    }

    // Auto-repair any readings or bills attached to 20177 that were saved as water
    setReadings((prevReadings) => {
      let rChanged = false;
      const nextReadings = prevReadings.map((r) => {
        if (
          r.division === "water" &&
          (r.id.includes("20177") ||
            r.sourceRecordId?.includes("20177") ||
            customers.some((c) => c.id === r.customerId && c.elecMeter?.startsWith("20177-") && !c.waterMeter))
        ) {
          rChanged = true;
          return { ...r, division: "electric" as const };
        }
        return r;
      });
      return rChanged ? nextReadings : prevReadings;
    });

    setBills((prevBills) => {
      let bChanged = false;
      const nextBills = prevBills.map((b) => {
        if (
          b.type === "water" &&
          (b.id.includes("20177") ||
            b.lines.some((l) => l.label.includes("20177")) ||
            customers.some((c) => c.id === b.customerId && c.elecMeter?.startsWith("20177-") && !c.waterMeter))
        ) {
          bChanged = true;
          return {
            ...b,
            type: "electric" as const,
            lines: b.lines.map((l) => ({
              ...l,
              kind: "electric" as const,
              label: l.label.replace("ค่าน้ำประปา", "ค่าไฟฟ้า"),
            })),
          };
        }
        return b;
      });
      return bChanged ? nextBills : prevBills;
    });
  }, [customers]);

  // Auto-repair any corrupted meter fields where elecMeter or waterMeter is a single digit (e.g. "2" or "1")
  useEffect(() => {
    setCustomers((prev) => {
      let changed = false;
      const seed = makeCustomers();
      const next = prev.map((c) => {
        if (c.elecMeter && c.elecMeter.length <= 2 && /^\d+$/.test(c.elecMeter)) {
          changed = true;
          const orig = seed.find((s) => s.id === c.id);
          return {
            ...c,
            elecMeter: orig?.elecMeter ?? undefined,
            name: orig?.id === c.id && c.name.includes("ตลาดต้นไม้") ? orig.name : c.name,
            shop: orig?.id === c.id && c.name.includes("ตลาดต้นไม้") ? orig.shop : c.shop,
          };
        }
        if (c.waterMeter && c.waterMeter.length <= 2 && /^\d+$/.test(c.waterMeter)) {
          changed = true;
          const orig = seed.find((s) => s.id === c.id);
          return { ...c, waterMeter: orig?.waterMeter ?? undefined };
        }
        return c;
      });
      return changed ? next : prev;
    });
  }, []);

  // Auto-fill missing seed readings for any active period (such as 2569-09) if customers exist
  useEffect(() => {
    if (!customers.length) return;
    setReadings((prevReadings) => {
      const existingKeys = new Set(
        prevReadings.map((r) => `${r.customerId}_${r.division}_${r.period}`),
      );
      const demoReadings = makeReadings(customers);
      const toAdd = demoReadings.filter(
        (r) => !existingKeys.has(`${r.customerId}_${r.division}_${r.period}`),
      );
      if (toAdd.length === 0) return prevReadings;
      return [...prevReadings, ...toAdd];
    });
  }, [customers]);

  // Auto-sync missing bills from existing readings (so any loaded/imported readings immediately generate bills and show in customers/billing)
  useEffect(() => {
    if (!readings.length || !customers.length) return;
    setBills((prevBills) => {
      let changed = false;
      const nextBills = [...prevBills];

      readings.forEach((r) => {
        if (r.validationState === "red" || !r.amountDue) return;
        const cust = customers.find((c) => c.id === r.customerId);
        if (!cust) return;

        const existingIdx = nextBills.findIndex(
          (b) => b.customerId === r.customerId && b.period === r.period && b.type === r.division,
        );

        if (existingIdx === -1) {
          const serviceLabel = r.division === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา";
          const billNo = `${r.period.replace("-", "")}-${cust.code.slice(2)}${r.division === "water" ? "W" : "E"}`;
          nextBills.push({
            id: `B-${r.division}-${cust.id}-${r.period}`,
            no: billNo,
            customerId: cust.id,
            period: r.period,
            type: r.division,
            serviceAccountId: `SA-${r.division}-${cust.siteId}`,
            sourceDataVersion: r.sourceDataVersion,
            lines: [
              {
                label: `${serviceLabel} ${r.usageUnits} หน่วย (งวด ${periodLabel(r.period)})`,
                amount: r.amountDue,
                kind: r.division,
              },
            ],
            total: r.amountDue,
            issuedAt: `${r.period}-26`,
            dueAt: `ภายใน ${settings.dueDayOffset} วัน`,
            status: "unpaid",
          });
          changed = true;
        } else {
          const eb = nextBills[existingIdx]!;
          if (eb.status !== "paid" && (eb.total === 0 || !eb.lines.length) && r.amountDue > 0) {
            const serviceLabel = r.division === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา";
            nextBills[existingIdx] = {
              ...eb,
              total: r.amountDue,
              lines: [
                {
                  label: `${serviceLabel} ${r.usageUnits} หน่วย (งวด ${periodLabel(r.period)})`,
                  amount: r.amountDue,
                  kind: r.division,
                },
              ],
            };
            changed = true;
          }
        }
      });

      return changed ? nextBills : prevBills;
    });
  }, [readings, customers, settings.dueDayOffset]);

  const actorName = me ? `${fullName(me)} (${ROLE_LABEL[me.role]})` : "ระบบ";
  const role: Role = me?.role ?? "entrepreneur";

  const log = (action: string, target: string) =>
    setLogs((l) => [
      { id: nid("L"), at: now(), date: todayISO(), actor: actorName, action, target },
      ...l,
    ]);

  const value: Ctx = useMemo(() => {
    const customerOf = (id: string) => customers.find((c) => c.id === id);
    const billsOf = (id: string) => bills.filter((b) => b.customerId === id);
    const unpaidBillsOf = (id: string) =>
      bills
        .filter((b) => b.customerId === id && b.status !== "paid" && b.status !== "cancelled")
        .sort((a, b) => a.period.localeCompare(b.period));
    const outstanding = (id: string, division?: Division, beforePeriod?: string) => {
      const unpaid = unpaidBillsOf(id).filter((b) => !beforePeriod || b.period <= beforePeriod);
      let billSum = 0;
      if (!division) {
        billSum = +unpaid.reduce((s, b) => s + b.total, 0).toFixed(2);
      } else {
        billSum = +unpaid.reduce((s, b) => {
          if (b.type === division) return s + b.total;
          if (b.type === "combined") {
            const divLines = b.lines.filter((l) => l.kind === division);
            return s + divLines.reduce((ls, l) => ls + l.amount, 0);
          }
          return s;
        }, 0).toFixed(2);
      }

      // Also include any readings that have amountDue but don't have a bill yet
      const missingReadings = readings.filter(
        (r) =>
          r.customerId === id &&
          (!division || r.division === division) &&
          (!beforePeriod || r.period <= beforePeriod) &&
          r.amountDue > 0 &&
          r.validationState !== "red" &&
          !bills.some((b) => b.customerId === id && b.period === r.period && b.type === r.division),
      );
      const readingSum = missingReadings.reduce((s, r) => s + r.amountDue, 0);

      return +(billSum + readingSum).toFixed(2);
    };
    const arrearsOf = (id: string, division?: Division, beforePeriod?: string) => {
      const map = new Map<string, { period: string; amount: number; division?: Division | undefined }>();
      unpaidBillsOf(id)
        .filter(
          (b) =>
            (!division ||
              b.type === division ||
              (b.type === "combined" && b.lines.some((l) => l.kind === division))) &&
            (!beforePeriod || b.period < beforePeriod),
        )
        .forEach((b) => {
          let amt = b.total;
          if (division && b.type === "combined") {
            amt = b.lines.filter((l) => l.kind === division).reduce((s, l) => s + l.amount, 0);
          }
          if (amt > 0) {
            const div: Division | undefined =
              division || (b.type === "electric" || b.type === "water" ? b.type : undefined);
            const key = `${b.period}-${div || "electric"}`;
            const existing = map.get(key);
            map.set(key, {
              period: b.period,
              amount: +((existing?.amount ?? 0) + amt).toFixed(2),
              division: div,
            });
          }
        });

      readings
        .filter(
          (r) =>
            r.customerId === id &&
            (!division || r.division === division) &&
            (!beforePeriod || r.period < beforePeriod) &&
            r.amountDue > 0 &&
            r.validationState !== "red" &&
            !bills.some((b) => b.customerId === id && b.period === r.period && b.type === r.division),
        )
        .forEach((r) => {
          const key = `${r.period}-${r.division}`;
          const existing = map.get(key);
          map.set(key, {
            period: r.period,
            amount: +((existing?.amount ?? 0) + r.amountDue).toFixed(2),
            division: r.division,
          });
        });

      return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
    };
    const displayStatus = (id: string) => {
      const c = customers.find((x) => x.id === id);
      if (!c) return DISPLAY_STATUS.normal;
      if (Object.values(c.serviceStates).some((state) => state === "suspended"))
        return DISPLAY_STATUS.suspended;
      if (outstanding(id) > 0) return DISPLAY_STATUS.arrears;
      const rs = readings.filter((r) => r.customerId === id && r.period === period);
      if (rs.length > 0 && rs.every((r) => r.curr - r.prev === 0))
        return DISPLAY_STATUS.maintenance;
      return DISPLAY_STATUS.normal;
    };

    const markPaid = (billIds: string[]) =>
      setBills((prev) => prev.map((b) => (billIds.includes(b.id) ? { ...b, status: "paid" } : b)));

    return {
      me,
      role,
      users,
      login: (email, password) => {
        const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u || u.password !== password) {
          toast.error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
          return false;
        }
        if (u.status !== "active") {
          toast.error("บัญชีนี้รอผู้ดูแลระบบอนุมัติสิทธิ์การใช้งาน");
          return false;
        }
        setMe(u);
        if (typeof window !== "undefined") {
          localStorage.setItem("rcms_auth_user", JSON.stringify(u));
        }
        setLogs((l) => [
          {
            id: nid("L"),
            at: now(),
            date: todayISO(),
            actor: `${fullName(u)} (${ROLE_LABEL[u.role]})`,
            action: "เข้าสู่ระบบ",
            target: "Auth",
          },
          ...l,
        ]);
        toast.success(`ยินดีต้อนรับ ${fullName(u)}`);
        return true;
      },
      logout: () => {
        log("ออกจากระบบ", "Auth");
        setMe(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("rcms_auth_user");
        }
      },
      register: (u) => {
        if (users.some((x) => x.email.toLowerCase() === u.email.trim().toLowerCase())) {
          toast.error("อีเมลนี้ถูกใช้ลงทะเบียนแล้ว");
          return false;
        }
        const created: AppUser = {
          ...u,
          id: nid("U"),
          role: "entrepreneur",
          status: "pending",
          createdAt: now(),
        };
        setUsers((prev) => [...prev, created]);
        setLogs((l) => [
          {
            id: nid("L"),
            at: now(),
            date: todayISO(),
            actor: fullName(created),
            action: "ลงทะเบียนขอใช้งานระบบ",
            target: created.email,
          },
          ...l,
        ]);
        toast.success("ลงทะเบียนแล้ว — รอผู้ดูแลระบบอนุมัติสิทธิ์");
        return true;
      },
      addUser: (u) => {
        if (!canPerform(role, "user.manage")) {
          toast.error("ไม่มีสิทธิ์จัดการผู้ใช้งาน");
          return false;
        }
        if (users.some((x) => x.email.toLowerCase() === u.email.trim().toLowerCase())) {
          toast.error("อีเมลนี้ถูกใช้ในระบบแล้ว");
          return false;
        }
        const created: AppUser = {
          ...u,
          id: nid("U"),
          createdAt: now(),
        };
        setUsers((prev) => [...prev, created]);
        log(`เพิ่มผู้ใช้งานใหม่ ${fullName(created)} (${ROLE_LABEL[created.role]})`, created.email);
        toast.success(`เพิ่มผู้ใช้งาน "${fullName(created)}" เรียบร้อยแล้ว`);
        return true;
      },
      approveUser: (id) => {
        if (!canPerform(role, "user.manage")) return void toast.error("ไม่มีสิทธิ์จัดการผู้ใช้งาน");
        const u = users.find((x) => x.id === id);
        setUsers((prev) => prev.map((x) => (x.id === id ? { ...x, status: "active" } : x)));
        log(`อนุมัติสิทธิ์ผู้ใช้งาน ${u ? fullName(u) : id}`, u?.email ?? id);
        toast.success("อนุมัติสิทธิ์การใช้งานแล้ว");
      },
      updateUser: (u) => {
        if (!canPerform(role, "user.manage")) return void toast.error("ไม่มีสิทธิ์จัดการผู้ใช้งาน");
        setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)));
        setMe((cur) => (cur && cur.id === u.id ? u : cur));
        log(`แก้ไขข้อมูล/สิทธิ์ผู้ใช้งาน ${fullName(u)} → ${ROLE_LABEL[u.role]}`, u.email);
        toast.success("บันทึกข้อมูลผู้ใช้งานแล้ว");
      },
      deleteUser: (id) => {
        if (!canPerform(role, "user.manage")) return void toast.error("ไม่มีสิทธิ์จัดการผู้ใช้งาน");
        if (id === me?.id) return void toast.error("ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่");
        const u = users.find((x) => x.id === id);
        if (
          u?.role === "admin" &&
          users.filter((x) => x.role === "admin" && x.status === "active").length <= 1
        )
          return void toast.error("ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 บัญชี");
        setUsers((prev) => prev.filter((x) => x.id !== id));
        log(`ลบผู้ใช้งาน ${u ? fullName(u) : id}`, u?.email ?? id);
        toast.success("ลบผู้ใช้งานแล้ว");
      },
      can: (path) => (ROUTE_ACCESS[path] ?? ["admin"]).includes(role),

      period,
      setPeriod,
      settings,
      saveSettings: (s) => {
        if (!canPerform(role, "settings.manage"))
          return void toast.error("ไม่มีสิทธิ์แก้ไขการตั้งค่า");
        setSettings(s);
        log("แก้ไขการตั้งค่าระบบ", "Settings");
        toast.success("บันทึกการตั้งค่าเรียบร้อย");
      },
      customers,
      readings,
      bills,
      payments,
      tasks,
      logs,
      billSends,
      customerOf,
      billsOf,
      unpaidBillsOf,
      outstanding,
      arrearsOf,
      displayStatus,

      addCustomer: (c) => {
        const code = `C-${101 + customers.length}`;
        setCustomers((prev) => [
          ...prev,
          {
            ...c,
            id: code,
            code,
            status: "registered",
            serviceStates: { electric: "closed", water: "closed" },
            siteId: `SITE-${String(customers.length + 1).padStart(3, "0")}`,
            siteCode: `CHY-${String(customers.length + 1).padStart(3, "0")}`,
            depositPaid: c.depositPaid || settings.depositElectric + settings.depositWater,
            createdAt: now(),
          },
        ]);
        log(`ลงทะเบียนผู้ประกอบการใหม่ ${c.name} + รับเงินประกัน`, code);
        toast.success(`ลงทะเบียน ${c.name} สำเร็จ`);
      },

      updateCustomer: (c) => {
        setCustomers((prev) => prev.map((x) => (x.id === c.id ? c : x)));
        log(`แก้ไขข้อมูลผู้ประกอบการ ${c.name}`, c.code);
        toast.success(`บันทึกข้อมูล ${c.name} เรียบร้อย`);
      },

      deleteCustomer: (id: string) => {
        const target = customers.find((c) => c.id === id);
        const name = target ? target.name : id;
        const code = target ? target.code : id;
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        setReadings((prev) => prev.filter((r) => r.customerId !== id));
        setBills((prev) => prev.filter((b) => b.customerId !== id));
        setPayments((prev) => prev.filter((p) => p.customerId !== id));
        setTasks((prev) => prev.filter((t) => t.customerId !== id));
        log(`ลบข้อมูลผู้ประกอบการ ${name}`, code);
        toast.success(`ลบข้อมูลผู้ประกอบการ ${name} เรียบร้อยแล้ว`);
      },

      clearCustomers: () => {
        try {
          localStorage.setItem("rcms_cleared", "true");
          localStorage.setItem("rcms_customers", JSON.stringify([]));
          localStorage.setItem("rcms_readings", JSON.stringify([]));
          localStorage.setItem("rcms_bills", JSON.stringify([]));
          localStorage.setItem("rcms_payments", JSON.stringify([]));
          localStorage.setItem("rcms_tasks", JSON.stringify([]));
          localStorage.setItem("rcms_bill_sends", JSON.stringify([]));
        } catch {}
        setCustomers([]);
        setReadings([]);
        setBills([]);
        setPayments([]);
        setTasks([]);
        setBillSends([]);
        log("ล้างข้อมูลทะเบียนผู้ประกอบการและข้อมูลทั้งหมด", "Customers");
        toast.success("ล้างข้อมูลผู้ประกอบการและข้อมูลทั้งหมดเรียบร้อยแล้ว");
      },

      resetCustomers: () => {
        const cs = makeCustomers();
        const rs = makeReadings(cs);
        const bs = makeHistoryBills(cs, rs);
        const ps = makeSeedPayments(bs, cs);
        setCustomers(cs);
        setReadings(rs);
        setBills(bs);
        setPayments(ps);
        log("คืนค่าข้อมูลผู้ประกอบการเริ่มต้น (Seed Data)", "Customers");
        toast.success("คืนค่าข้อมูลผู้ประกอบการเริ่มต้นเรียบร้อยแล้ว");
      },

      clearReadings: (targetPeriod?: string, targetDivision?: Division) => {
        setReadings((prev) => {
          const next = !targetPeriod && !targetDivision
            ? []
            : prev.filter(
                (r) =>
                  (targetPeriod ? r.period !== targetPeriod : false) ||
                  (targetDivision ? r.division !== targetDivision : false),
              );
          try {
            localStorage.setItem("rcms_readings", JSON.stringify(next));
          } catch {}
          return next;
        });
        const scope = targetPeriod
          ? `งวด ${periodLabel(targetPeriod)} (${targetDivision === "electric" ? "ค่าไฟฟ้า" : targetDivision === "water" ? "ค่าน้ำประปา" : "ทั้งหมด"})`
          : "ทั้งหมด";
        log(`ล้างข้อมูลเลขจดมิเตอร์ ${scope}`, "Meter Readings");
        toast.success(`ล้างข้อมูลเลขจดมิเตอร์ ${scope} เรียบร้อยแล้ว`);
      },

      resetReadings: () => {
        const cs = customers.length > 0 ? customers : makeCustomers();
        const rs = makeReadings(cs);
        setReadings(rs);
        log("คืนค่าข้อมูลตัวอย่างเลขจดมิเตอร์ (Demo Data)", "Meter Readings");
        toast.success("คืนค่าข้อมูลตัวอย่างเลขจดมิเตอร์เรียบร้อยแล้ว");
      },

      clearAllData: () => {
        try {
          localStorage.setItem("rcms_cleared", "true");
          localStorage.setItem("rcms_customers", JSON.stringify([]));
          localStorage.setItem("rcms_readings", JSON.stringify([]));
          localStorage.setItem("rcms_bills", JSON.stringify([]));
          localStorage.setItem("rcms_payments", JSON.stringify([]));
          localStorage.setItem("rcms_tasks", JSON.stringify([]));
          localStorage.setItem("rcms_bill_sends", JSON.stringify([]));
        } catch {}
        setCustomers([]);
        setReadings([]);
        setBills([]);
        setPayments([]);
        setTasks([]);
        setBillSends([]);
        log("ล้างฐานข้อมูลนำเข้าทั้งหมดออกจากระบบ", "Database");
        toast.success("ล้างฐานข้อมูลนำเข้าทั้งหมดเรียบร้อยแล้ว (ข้อมูลถูกล้างหมดจด)");
      },

      resetAllData: () => {
        const cs = makeCustomers();
        const rs = makeReadings(cs);
        const bs = makeHistoryBills(cs, rs);
        const ps = makeSeedPayments(bs, cs);
        setCustomers(cs);
        setReadings(rs);
        setBills(bs);
        setPayments(ps);
        setTasks(SEED_TASKS);
        setBillSends([]);
        log("คืนค่าฐานข้อมูลเริ่มต้นทั้งหมด (Demo Seed Data)", "Database");
        toast.success("คืนค่าฐานข้อมูลเริ่มต้นทั้งหมดเรียบร้อยแล้ว");
      },

      importReadings: (division, rows, sourceDataVersion, targetPeriod) => {
        let matched = 0;
        let skipped = 0;
        let warnings = 0;
        let rejected = 0;
        const p = targetPeriod || period;
        const batchVersion = sourceDataVersion || `EXCEL-${p}-${Date.now()}`;
        if (
          readings.some(
            (r) =>
              r.period === p &&
              r.division === division &&
              r.sourceDataVersion === batchVersion,
          )
        ) {
          toast.info(`ไฟล์นี้ถูกนำเข้าในงวด ${periodLabel(p)} และประเภทบริการนี้แล้ว`);
          return { matched, skipped, warnings, rejected, duplicate: true };
        }
        const next = [...readings];
        const nextCustomers = [...customers];
        const nextBills = [...bills];
        let customersUpdated = false;
        let billsUpdated = false;

        rows.forEach((row, rowIndex) => {
          const rowDiv = row.division || division;
          const meter = (row.meter ?? "").toString().trim();
          const name = (row.name ?? "").toString().trim();
          const shop = (row.shop ?? "").toString().trim();

          let c = findMatchingCustomer(nextCustomers, meter, name, shop, rowDiv);

          if (!c && (name || shop || meter)) {
            const newCode = `C-${101 + nextCustomers.length}`;
            c = {
              id: newCode,
              code: newCode,
              name: name || shop || `ผู้ประกอบการ ${newCode}`,
              shop: shop || "ร้านค้า",
              phone: "",
              lineId: "",
              status: "active",
              serviceStates: { electric: "active", water: "active" },
              siteId: `SITE-${String(nextCustomers.length + 1).padStart(3, "0")}`,
              siteCode: `CHY-${String(nextCustomers.length + 1).padStart(3, "0")}`,
              depositPaid: settings.depositElectric + settings.depositWater,
              createdAt: now(),
            };
            if (meter && meter.length >= 2 && !/^\d$/.test(meter)) {
              if (rowDiv === "water") c.waterMeter = meter;
              else c.elecMeter = meter;
            }
            nextCustomers.push(c);
            customersUpdated = true;
          } else if (c) {
            let updated = false;
            if (name && (!c.name || c.name.startsWith("ผู้ประกอบการ C-") || c.name === "ร้านค้า")) {
              c.name = name;
              updated = true;
            }
            if (shop && (!c.shop || c.shop === "ร้านค้า" || c.shop === "—" || c.shop === "-")) {
              c.shop = shop;
              updated = true;
            }
            if (meter && meter.length >= 2 && !/^\d$/.test(meter)) {
              if (rowDiv === "water" && (!c.waterMeter || c.waterMeter === "—" || c.waterMeter === "-" || c.waterMeter.length <= 2)) {
                c.waterMeter = meter;
                updated = true;
              } else if (rowDiv === "electric" && (!c.elecMeter || c.elecMeter === "—" || c.elecMeter === "-" || c.elecMeter.length <= 2)) {
                c.elecMeter = meter;
                updated = true;
              }
            }
            if (updated) {
              customersUpdated = true;
            }
          }

          if (!c || row.curr === undefined || Number.isNaN(row.curr)) {
            skipped++;
            return;
          }
          const idx = next.findIndex(
            (r) => r.customerId === c!.id && r.division === rowDiv && r.period === p,
          );
          const prevVal = row.prev ?? (idx >= 0 ? next[idx]!.prev : 0);
          const usageUnits = row.used ?? Math.max(0, row.curr - prevVal);
          const amountDue =
            row.amount !== undefined && row.amount > 0
              ? row.amount
              : calculateReadingAmount(rowDiv, usageUnits, settings);
          const previousPeriod = next
            .filter((r) => r.customerId === c!.id && r.division === rowDiv && r.period < p)
            .sort((a, b) => b.period.localeCompare(a.period))[0];
          const validation = validateReading({
            serviceType: rowDiv === "electric" ? "ELECTRICITY" : "WATER",
            meterId: meter || (rowDiv === "electric" ? c.elecMeter : c.waterMeter) || c.id,
            previousReading: prevVal,
            currentReading: row.curr,
            usageUnits,
            amountDue,
            ...(previousPeriod
              ? {
                  previousPeriodReading: {
                    meterId:
                      rowDiv === "electric" ? (c.elecMeter ?? c.id) : (c.waterMeter ?? c.id),
                    usageUnits: previousPeriod.usageUnits,
                  },
                }
              : {}),
          });
          const validationState = validation.some((issue) => issue.risk === "RED")
            ? "red"
            : validation.some((issue) => issue.risk === "YELLOW")
              ? "yellow"
              : "green";
          if (validationState === "red") rejected++;
          if (validationState === "yellow") warnings++;
          const record: Reading = {
            id: idx >= 0 ? next[idx]!.id : `R-${rowDiv}-${c.id}-${p}`,
            customerId: c.id,
            division: rowDiv,
            period: p,
            prev: prevVal,
            curr: row.curr,
            usageUnits,
            amountDue,
            sourceDataVersion: batchVersion,
            sourceRecordId: `${row.sheet ?? "Sheet"}:${rowIndex + 1}:${meter || c.id}`,
            validationState,
            validationCodes: validation.map((issue) => issue.code),
            source: "excel",
          };
          if (idx >= 0) next[idx] = record;
          else next.push(record);

          // Automatically generate / update invoice bill for billing page and arrears calculation
          const billId = `B-${rowDiv}-${c.id}-${p}`;
          const billNo = `${p.replace("-", "")}-${c.code.slice(2)}${rowDiv === "water" ? "W" : "E"}`;
          const serviceLabel = rowDiv === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา";
          const existingBillIdx = nextBills.findIndex(
            (b) => b.customerId === c!.id && b.period === p && b.type === rowDiv,
          );

          if (existingBillIdx >= 0) {
            const eb = nextBills[existingBillIdx]!;
            if (eb.status !== "paid") {
              nextBills[existingBillIdx] = {
                ...eb,
                total: amountDue,
                lines: [
                  {
                    label: `${serviceLabel} ${usageUnits} หน่วย (งวด ${periodLabel(p)})`,
                    amount: amountDue,
                    kind: rowDiv,
                  },
                ],
                sourceDataVersion: batchVersion,
              };
              billsUpdated = true;
            }
          } else {
            nextBills.push({
              id: billId,
              no: billNo,
              customerId: c.id,
              period: p,
              type: rowDiv,
              serviceAccountId: `SA-${rowDiv}-${c.siteId}`,
              sourceDataVersion: batchVersion,
              lines: [
                {
                  label: `${serviceLabel} ${usageUnits} หน่วย (งวด ${periodLabel(p)})`,
                  amount: amountDue,
                  kind: rowDiv,
                },
              ],
              total: amountDue,
              issuedAt: `${p}-26`,
              dueAt: `ภายใน ${settings.dueDayOffset} วัน`,
              status: "unpaid",
            });
            billsUpdated = true;
          }

          matched++;
        });
        if (customersUpdated) {
          setCustomers(nextCustomers);
        }
        if (billsUpdated) {
          setBills(nextBills);
        }
        setReadings(next);
        log(
          `Import Excel หน่วยใช้${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"} งวด ${p} ${rows.length} แถว (ประมวลผลใบแจ้งหนี้อัตโนมัติ)`,
          "Data Ingestion",
        );
        return { matched, skipped, warnings, rejected, duplicate: false };
      },

      importCustomers: (rows) => {
        let added = 0;
        let updated = 0;
        setCustomers((prev) => {
          const next = [...prev];
          rows.forEach((row) => {
            const name = (row.name ?? "").trim();
            const shop = (row.shop ?? "").trim();
            const code = (row.code ?? "").trim();
            const elecMeter = (row.elecMeter ?? "").trim();
            const waterMeter = (row.waterMeter ?? "").trim();
            if (!name && !shop && !code && !elecMeter && !waterMeter) return;

            let existing: Customer | undefined = undefined;
            if (code) {
              existing = next.find(
                (c) =>
                  c.code.toLowerCase() === code.toLowerCase() ||
                  c.id.toLowerCase() === code.toLowerCase(),
              );
            }
            if (!existing && elecMeter) {
              existing = findMatchingCustomer(next, elecMeter, name, shop, "electric");
            }
            if (!existing && waterMeter) {
              existing = findMatchingCustomer(next, waterMeter, name, shop, "water");
            }
            if (!existing && (name || shop)) {
              existing = findMatchingCustomer(next, undefined, name, shop);
            }

            if (existing) {
              if (name && (!existing.name || existing.name.startsWith("ผู้ประกอบการ C-"))) {
                existing.name = name;
              } else if (name) {
                existing.name = name;
              }
              if (shop && (!existing.shop || existing.shop === "ร้านค้า" || existing.shop === "—")) {
                existing.shop = shop;
              } else if (shop) {
                existing.shop = shop;
              }
              if (row.phone) existing.phone = row.phone;
              if (row.lineId) existing.lineId = row.lineId;
              if (elecMeter) existing.elecMeter = elecMeter;
              if (waterMeter) existing.waterMeter = waterMeter;
              if (row.depositPaid !== undefined && !isNaN(row.depositPaid)) {
                existing.depositPaid = row.depositPaid;
              }
              updated++;
            } else {
              const newCode = code || `C-${101 + next.length}`;
              const newCustomer: Customer = {
                id: newCode,
                code: newCode,
                name: name || shop || `ผู้ประกอบการ ${newCode}`,
                shop: shop || "ร้านค้า",
                phone: row.phone || "",
                lineId: row.lineId || "",
                status: "active",
                serviceStates: { electric: "active", water: "active" },
                siteId: `SITE-${String(next.length + 1).padStart(3, "0")}`,
                siteCode: `CHY-${String(next.length + 1).padStart(3, "0")}`,
                depositPaid:
                  row.depositPaid !== undefined && !isNaN(row.depositPaid)
                    ? row.depositPaid
                    : settings.depositElectric + settings.depositWater,
                createdAt: now(),
              };
              if (elecMeter) newCustomer.elecMeter = elecMeter;
              if (waterMeter) newCustomer.waterMeter = waterMeter;
              next.push(newCustomer);
              added++;
            }
          });
          return next;
        });

        log(`นำเข้าข้อมูลผู้ประกอบการ Excel (เพิ่มใหม่ ${added}, ปรับปรุง ${updated})`, "Customer Management");
        return { added, updated };
      },

      importRevenueLedger: (rows, targetPeriod, division = "electric") => {
        const p = targetPeriod || period;
        let matched = 0;
        let skipped = 0;
        let totalAmount = 0;

        // Auto-register any new customer from the revenue ledger so they appear on the entrepreneur page
        const updatedCustomers = [...customers];
        let customersUpdated = false;
        rows.forEach((row) => {
          const name = (row.name ?? "").trim();
          const shop = (row.shop ?? "").trim();
          const meter = (row.meter ?? "").trim();
          if (!name && !shop && !meter) return;
          const rowDiv =
            row.division ||
            (meter.startsWith("20177-") ||
            meter.startsWith("72793-") ||
            meter.startsWith("50365-") ||
            meter.startsWith("38944-")
              ? "electric"
              : division || "electric");

          const found = findMatchingCustomer(updatedCustomers, meter, name, shop, rowDiv);
          if (!found) {
            const newCode = `C-${101 + updatedCustomers.length}`;
            const newCust: Customer = {
              id: newCode,
              code: newCode,
              name: name || shop || `ผู้ประกอบการ ${newCode}`,
              shop: shop || "ร้านค้า",
              phone: "",
              lineId: "",
              status: "active",
              serviceStates: { electric: "active", water: "active" },
              siteId: `SITE-${String(updatedCustomers.length + 1).padStart(3, "0")}`,
              siteCode: `CHY-${String(updatedCustomers.length + 1).padStart(3, "0")}`,
              depositPaid: settings.depositElectric + settings.depositWater,
              createdAt: now(),
            };
            if (meter && meter.length >= 2 && !/^\d$/.test(meter)) {
              if (rowDiv === "water") newCust.waterMeter = meter;
              else newCust.elecMeter = meter;
            }
            updatedCustomers.push(newCust);
            customersUpdated = true;
          } else {
            let updated = false;
            if (name && (!found.name || found.name.startsWith("ผู้ประกอบการ C-") || found.name === "ร้านค้า")) {
              found.name = name;
              updated = true;
            }
            if (shop && (!found.shop || found.shop === "ร้านค้า" || found.shop === "—" || found.shop === "-")) {
              found.shop = shop;
              updated = true;
            }
            if (meter && meter.length >= 2 && !/^\d$/.test(meter)) {
              if (rowDiv === "water" && (!found.waterMeter || found.waterMeter === "—" || found.waterMeter === "-" || found.waterMeter.length <= 2)) {
                found.waterMeter = meter;
                updated = true;
              } else if (rowDiv === "electric" && (!found.elecMeter || found.elecMeter === "—" || found.elecMeter === "-" || found.elecMeter.length <= 2)) {
                found.elecMeter = meter;
                updated = true;
              }
            }
            if (updated) {
              customersUpdated = true;
            }
          }
        });
        if (customersUpdated) {
          setCustomers(updatedCustomers);
        }

        setPayments((prevPayments) => {
          const nextPayments = [...prevPayments];
          rows.forEach((row, i) => {
            const name = (row.name ?? "").trim();
            const shop = (row.shop ?? "").trim();
            const meter = (row.meter ?? "").trim();
            const rowPeriod = row.period?.trim() || p;
            const amount = Number(row.amount);
            if (!name || isNaN(amount) || amount <= 0) {
              skipped++;
              return;
            }

            const rowDiv =
              row.division ||
              (meter.startsWith("20177-") ||
              meter.startsWith("72793-") ||
              meter.startsWith("50365-") ||
              meter.startsWith("38944-")
                ? "electric"
                : division || "electric");

            const cust = findMatchingCustomer(updatedCustomers, meter, name, shop, rowDiv);

            const custId = cust?.id ?? `C-${101 + i}`;
            const receiptNo =
              row.receiptNo ||
              `REC-${rowPeriod.replace("-", "")}-${String(1000 + nextPayments.length).slice(-4)}`;
            const ref = row.ref || `TMB${Math.floor(100000 + Math.random() * 900000)}`;

            const relatedBill = bills.find(
              (b) => b.customerId === custId && b.period === rowPeriod && b.type === rowDiv,
            );
            const billId = relatedBill?.id ?? `B-IMPORT-${rowDiv}-${custId}-${rowPeriod}`;

            const newPayment: Payment = {
              id: nid("P"),
              billId,
              billNo: relatedBill?.no ?? `BILL-${rowPeriod.replace("-", "")}-${custId}${rowDiv === "electric" ? "E" : "W"}`,
              customerId: custId,
              amount,
              method: row.method ?? "counter",
              ref,
              paidAt: `${row.paidDate || todayISO()} 10:00`,
              paidDate: row.paidDate || todayISO(),
              status: "verified",
              ocrConfidence: 100,
              receiptNo,
              bookNo: row.bookNo,
              division: rowDiv,
              periods: [rowPeriod],
              targetBillIds: relatedBill ? [relatedBill.id] : [],
              allocations: [{ billId, amount }],
              unallocatedAmount: 0,
              slip: {
                bank: settings.bankName || "ธนาคารทหารไทยธนชาต",
                payerName: cust?.name ?? name,
                payerAccount: "xxx-x-x0000-x",
                amount,
                dateTime: `${row.paidDate || todayISO()} 10:00`,
                ref,
              },
            };

            nextPayments.unshift(newPayment);
            matched++;
            totalAmount += amount;
          });
          return nextPayments;
        });

        // Also mark matching bills as paid if any
        setBills((prevBills) =>
          prevBills.map((b) => {
            const matchingRow = rows.find((r) => {
              const rowDiv = r.division || division || "electric";
              const rMeter = (r.meter ?? "").trim();
              const c = updatedCustomers.find((cust) => cust.id === b.customerId);
              if (!c) return false;
              const isMatchMeter = rMeter
                ? (rowDiv === "electric" ? c.elecMeter === rMeter : c.waterMeter === rMeter)
                : (c.name === r.name && (!r.shop || c.shop === r.shop));
              const isMatchPeriod = r.period ? b.period === r.period : b.period === p;
              const isMatchDiv = b.type === rowDiv;
              return isMatchMeter && isMatchPeriod && isMatchDiv;
            });
            if (matchingRow) {
              return { ...b, status: "paid" };
            }
            return b;
          }),
        );

        log(
          `นำเข้าทะเบียนจัดเก็บรายได้ Excel (${division === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"} งวด ${p} รับชำระ ${matched} รายการ ยอดรวม ฿${totalAmount.toLocaleString()})`,
          "Revenue Ledger",
        );
        return { matched, skipped, totalAmount };
      },

      importArrearsLedger: (rows, division = "electric") => {
        let updatedCount = 0;
        let addedCount = 0;
        let totalArrearsImported = 0;

        const updatedCustomers = [...customers];
        let customersUpdated = false;
        const newBills = [...bills];
        let nextPayments = [...payments];

        rows.forEach((row) => {
          const name = row.name.trim();
          const shop = row.shop.trim();
          const meter = row.meter.trim();
          if (!name && !shop && !meter) return;

          const rowDiv =
            row.division ||
            (meter.startsWith("20177-") ||
            meter.startsWith("72793-") ||
            meter.startsWith("50365-") ||
            meter.startsWith("38944-")
              ? "electric"
              : division || "electric");

          let cust = findMatchingCustomer(updatedCustomers, meter, name, shop, rowDiv);

          if (!cust) {
            const newCode = `C-${101 + updatedCustomers.length}`;
            cust = {
              id: newCode,
              code: newCode,
              name: name || shop || `ผู้ประกอบการ ${newCode}`,
              shop: shop || "ร้านค้า",
              phone: "",
              lineId: "",
              status: "active",
              serviceStates: { electric: "active", water: "active" },
              siteId: `SITE-${String(updatedCustomers.length + 1).padStart(3, "0")}`,
              siteCode: `CHY-${String(updatedCustomers.length + 1).padStart(3, "0")}`,
              depositPaid: settings.depositElectric + settings.depositWater,
              createdAt: now(),
            };
            if (meter && meter.length >= 2 && !/^\d$/.test(meter)) {
              if (rowDiv === "water") cust.waterMeter = meter;
              else cust.elecMeter = meter;
            }
            updatedCustomers.push(cust);
            addedCount++;
            customersUpdated = true;
          } else {
            let updated = false;
            if (name && (!cust.name || cust.name.startsWith("ผู้ประกอบการ C-") || cust.name === "ร้านค้า")) {
              cust.name = name;
              updated = true;
            }
            if (shop && (!cust.shop || cust.shop === "ร้านค้า" || cust.shop === "—" || cust.shop === "-")) {
              cust.shop = shop;
              updated = true;
            }
            if (meter && meter.length >= 2 && !/^\d$/.test(meter)) {
              if (rowDiv === "water" && (!cust.waterMeter || cust.waterMeter === "—" || cust.waterMeter === "-" || cust.waterMeter.length <= 2)) {
                cust.waterMeter = meter;
                updated = true;
              } else if (rowDiv === "electric" && (!cust.elecMeter || cust.elecMeter === "—" || cust.elecMeter === "-" || cust.elecMeter.length <= 2)) {
                cust.elecMeter = meter;
                updated = true;
              }
            }
            if (updated) {
              customersUpdated = true;
            }
            updatedCount++;
          }

          const custId = cust.id;
          const serviceLabel = rowDiv === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา";
          const suffix = rowDiv === "electric" ? "E" : "W";

          // 1. Process paid monthly items from ledger (monthlyPaid)
          if (row.monthlyPaid && row.monthlyPaid.length > 0) {
            row.monthlyPaid.forEach((pItem) => {
              const paymentId = `PAY-${rowDiv}-${custId}-${pItem.period}`;
              const billNo = `${pItem.period.replace("-", "")}-${cust!.code.slice(2)}${suffix}`;
              const billId = `HB-${rowDiv}-${custId}-${pItem.period}`;

              const receiptDisplay = [
                pItem.bookNo ? `เล่มที่ ${pItem.bookNo}` : "",
                pItem.receiptNo ? `เลขที่ ${pItem.receiptNo}` : "",
              ].filter(Boolean).join(" ") || pItem.receiptNo || `RC-${pItem.period.replace("-", "")}-${cust!.code}`;

              const paymentRecord: Payment = {
                id: paymentId,
                billId,
                billNo,
                customerId: custId,
                amount: pItem.amount,
                method: "counter",
                ref: pItem.receiptNo || receiptDisplay,
                paidAt: pItem.paidDate ? `${pItem.paidDate} 10:00` : now(),
                paidDate: pItem.paidDate || todayISO(),
                status: "verified",
                ocrConfidence: 100,
                receiptNo: pItem.receiptNo || receiptDisplay,
                bookNo: pItem.bookNo,
                division: rowDiv,
                periods: [pItem.period],
                targetBillIds: [billId],
                allocations: [{ billId, amount: pItem.amount }],
                unallocatedAmount: 0,
                slip: {
                  bank: settings.bankName || "กองการเงิน กรมช่างโยธาทหารอากาศ",
                  payerName: cust!.name,
                  payerAccount: "ทะเบียนคุมรายรับ",
                  amount: pItem.amount,
                  dateTime: pItem.paidDate ? `${pItem.paidDate} 10:00` : now(),
                  ref: pItem.receiptNo || receiptDisplay,
                },
              };

              const existingPayIdx = nextPayments.findIndex(
                (p) =>
                  p.id === paymentId ||
                  (p.customerId === custId && p.periods?.includes(pItem.period) && p.division === rowDiv),
              );

              if (existingPayIdx >= 0) {
                nextPayments[existingPayIdx] = paymentRecord;
              } else {
                nextPayments = [paymentRecord, ...nextPayments];
              }

              // Update or add bill with paid status
              const existingBillIdx = newBills.findIndex(
                (b) => b.customerId === custId && b.period === pItem.period && b.type === rowDiv,
              );
              if (existingBillIdx >= 0) {
                newBills[existingBillIdx] = {
                  ...newBills[existingBillIdx]!,
                  status: "paid",
                  total: pItem.amount > 0 ? pItem.amount : newBills[existingBillIdx]!.total,
                };
              } else {
                newBills.push({
                  id: billId,
                  no: billNo,
                  customerId: custId,
                  period: pItem.period,
                  type: rowDiv,
                  serviceAccountId: `SA-${rowDiv}-${cust!.siteId}`,
                  sourceDataVersion: `EXCEL-PAID-${Date.now()}`,
                  lines: [
                    {
                      label: `${serviceLabel} ${pItem.monthLabel} (ชำระแล้ว - ทะเบียนคุมรายรับ)`,
                      amount: pItem.amount,
                      kind: rowDiv,
                    },
                  ],
                  total: pItem.amount,
                  issuedAt: `${pItem.period}-26`,
                  dueAt: `ภายใน ${settings.dueDayOffset} วัน`,
                  status: "paid",
                });
              }
            });
          }

          // 2. Process monthly arrears bills
          if (row.monthlyArrears && row.monthlyArrears.length > 0) {
            row.monthlyArrears.forEach((item) => {
              totalArrearsImported += item.amount;
              const existingBillIdx = newBills.findIndex(
                (b) => b.customerId === custId && b.period === item.period && b.type === rowDiv,
              );

              if (existingBillIdx >= 0) {
                const b = newBills[existingBillIdx]!;
                newBills[existingBillIdx] = {
                  ...b,
                  total: item.amount,
                  type: rowDiv,
                  lines: [
                    {
                      label: `${serviceLabel} ${item.monthLabel} (ตามทะเบียนคุมรายได้)`,
                      amount: item.amount,
                      kind: rowDiv,
                    },
                  ],
                  status: "overdue",
                };
              } else {
                const billNo = `${item.period.replace("-", "")}-${cust!.code.slice(2)}${suffix}`;
                newBills.push({
                  id: `HB-${rowDiv}-${custId}-${item.period}`,
                  no: billNo,
                  customerId: custId,
                  period: item.period,
                  type: rowDiv,
                  serviceAccountId: `SA-${rowDiv}-${cust!.siteId}`,
                  sourceDataVersion: `EXCEL-ARREARS-${Date.now()}`,
                  lines: [
                    {
                      label: `${serviceLabel} ${item.monthLabel} (ตามทะเบียนคุมรายได้)`,
                      amount: item.amount,
                      kind: rowDiv,
                    },
                  ],
                  total: item.amount,
                  issuedAt: `${item.period}-26`,
                  dueAt: `ภายใน ${settings.dueDayOffset} วัน`,
                  status: "overdue",
                });
              }
            });
          } else if (row.totalArrears > 0) {
            // Lump sum arrears without monthly breakdown
            totalArrearsImported += row.totalArrears;
            const targetP = period;
            const existingBillIdx = newBills.findIndex(
              (b) => b.customerId === custId && b.period === targetP && b.type === rowDiv,
            );

            if (existingBillIdx >= 0) {
              const b = newBills[existingBillIdx]!;
              newBills[existingBillIdx] = {
                ...b,
                total: row.totalArrears,
                type: rowDiv,
                lines: [
                  {
                    label: `${serviceLabel} ยอดค้างชำระ (ตามทะเบียนคุมรายได้)`,
                    amount: row.totalArrears,
                    kind: rowDiv,
                  },
                ],
                status: "overdue",
              };
            } else {
              const billNo = `${targetP.replace("-", "")}-${cust!.code.slice(2)}${suffix}`;
              newBills.push({
                id: `HB-${rowDiv}-${custId}-${targetP}`,
                no: billNo,
                customerId: custId,
                period: targetP,
                type: rowDiv,
                serviceAccountId: `SA-${rowDiv}-${cust!.siteId}`,
                sourceDataVersion: `EXCEL-ARREARS-${Date.now()}`,
                lines: [
                  {
                    label: `${serviceLabel} ยอดค้างชำระ (ตามทะเบียนคุมรายได้)`,
                    amount: row.totalArrears,
                    kind: rowDiv,
                  },
                ],
                total: row.totalArrears,
                issuedAt: `${targetP}-26`,
                dueAt: `ภายใน ${settings.dueDayOffset} วัน`,
                status: "overdue",
              });
            }
          }
        });

        setCustomers(updatedCustomers);
        setBills(newBills);
        setPayments(nextPayments);

        log(
          `นำเข้าตารางค้างชำระ/ทะเบียนคุมรายได้ Excel (${division === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"} ปรับปรุง ${updatedCount} ราย, เพิ่มใหม่ ${addedCount} ราย, ยอดค้างรวม ฿${totalArrearsImported.toLocaleString()})`,
          "Arrears Ledger",
        );

        return { updatedCount, addedCount, totalArrearsImported };
      },

      setReading: (customerId, division, p, curr) => {
        setReadings((prev) => {
          const idx = prev.findIndex(
            (r) => r.customerId === customerId && r.division === division && r.period === p,
          );
          const target = prev[idx];
          if (!target) return prev;
          if (curr < target.prev) {
            toast.error("ค่าหน่วยใช้ติดลบ — ตรวจสอบเลขจดครั้งหลัง");
            return prev;
          }
          const next = [...prev];
          const usageUnits = Math.max(0, curr - target.prev);
          const amountDue = calculateReadingAmount(division, usageUnits, settings);
          const validation = validateReading({
            serviceType: division === "electric" ? "ELECTRICITY" : "WATER",
            meterId: `${division}-${customerId}`,
            previousReading: target.prev,
            currentReading: curr,
            usageUnits,
            amountDue,
          });
          const validationState = validation.some((issue) => issue.risk === "RED")
            ? "red"
            : validation.some((issue) => issue.risk === "YELLOW")
              ? "yellow"
              : "green";
          next[idx] = {
            ...target,
            curr,
            usageUnits,
            amountDue,
            validationState,
            validationCodes: validation.map((issue) => issue.code),
            source: "manual",
          };
          setBills((prevBills) => {
            const bIdx = prevBills.findIndex(
              (b) => b.customerId === customerId && b.period === p && b.type === division,
            );
            if (bIdx >= 0 && prevBills[bIdx]!.status !== "paid") {
              const nb = [...prevBills];
              const serviceLabel = division === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา";
              nb[bIdx] = {
                ...nb[bIdx]!,
                total: amountDue,
                lines: [
                  {
                    label: `${serviceLabel} ${usageUnits} หน่วย (งวด ${periodLabel(p)})`,
                    amount: amountDue,
                    kind: division,
                  },
                ],
              };
              return nb;
            }
            return prevBills;
          });
          return next;
        });
        log(`คีย์หน่วยใช้ ${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"} งวด ${p}`, customerId);
      },

      generateBills: (p, mode) => {
        if (!canPerform(role, "billing.issue")) {
          toast.error("ไม่มีสิทธิ์ประมวลผลรอบบิล");
          return 0;
        }
        const created: Bill[] = [];
        const targetTypes: Division[] =
          mode === "electric"
            ? ["electric"]
            : mode === "water"
              ? ["water"]
              : ["electric", "water"];

        customers.forEach((c) => {
          if (c.status === "registered") return;
          targetTypes.forEach((type) => {
            if (c.serviceStates[type] === "closed") return;
            if (bills.some((b) => b.customerId === c.id && b.period === p && b.type === type))
              return;
            const reading = readings.find(
              (r) => r.customerId === c.id && r.division === type && r.period === p,
            );
            if (!reading || reading.validationState === "red") return;
            const kind: BillLine["kind"] = type;
            const label = type === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา";
            const lines: BillLine[] = [
              {
                label: `${label} ${reading.usageUnits} หน่วย (ยอดจากระบบต้นทาง)`,
                amount: reading.amountDue,
                kind,
              },
            ];
            created.push({
              id: nid("B"),
              no: `${p.replace("-", "")}-${c.code.slice(2)}${type === "water" ? "W" : "E"}`,
              customerId: c.id,
              period: p,
              type,
              serviceAccountId: `SA-${type}-${c.siteId}`,
              sourceDataVersion: reading.sourceDataVersion,
              lines,
              total: reading.amountDue,
              issuedAt: now(),
              dueAt: `ภายใน ${settings.dueDayOffset} วัน`,
              status: "unpaid",
            });
          });
        });
        if (created.length) {
          setBills((prev) => [...created, ...prev]);
          const modeLabel =
            mode === "electric"
              ? "ค่าไฟฟ้า"
              : mode === "water"
                ? "ค่าน้ำประปา"
                : mode === "combined"
                  ? "รวม"
                  : "แยก";
          log(
            `ประมวลผลใบแจ้งหนี้การเงินแยกบริการงวด ${p} จำนวน ${created.length} ใบ · Statement ${modeLabel}`,
            "Billing",
          );
        }
        return created.length;
      },

      sendBill: async (billId, customTargetId) => {
        if (!canPerform(role, "billing.send")) return void toast.error("ไม่มีสิทธิ์ส่งใบแจ้งหนี้");
        const b = bills.find((x) => x.id === billId);
        if (!b) return void toast.error("ไม่พบใบแจ้งหนี้");
        if (b.status === "paid") {
          return void toast.error(`ใบแจ้งหนี้ ${b.no} ชำระเงินแล้ว ไม่สามารถส่งบิลได้`);
        }
        const c = b ? customerOf(b.customerId) : undefined;
        const attempt = billSends.filter((s) => s.billId === billId).length + 1;

        const effectiveTarget = customTargetId?.trim() !== undefined ? customTargetId.trim() : (c?.lineId?.trim() || "");
        const cleanLineId = effectiveTarget.replace(/^@/, "");

        if (customTargetId !== undefined && c && c.lineId !== effectiveTarget) {
          setCustomers((prev) =>
            prev.map((item) => (item.id === c.id ? { ...item, lineId: effectiveTarget } : item)),
          );
        }

        toast.success(`บันทึกประวัติการส่งบิล ${b.no} เรียบร้อยแล้ว`);

        setBillSends((prev) => [
          {
            id: nid("S"),
            billId,
            at: now(),
            to: cleanLineId || c?.lineId || "-",
            channel: "line",
            status: "sent",
            attempt,
          },
          ...prev,
        ]);
        log(`ส่งบิล ${b?.no} ไปยัง ${cleanLineId || c?.lineId || "-"} (ครั้งที่ ${attempt})`, b?.customerId ?? "-");
      },
      sendsOf: (billId) => billSends.filter((s) => s.billId === billId && s.type !== "receipt"),

      sendReceipt: async (paymentId, customTargetId) => {
        if (!canPerform(role, "billing.send") && !canPerform(role, "payment.record")) {
          toast.error("ไม่มีสิทธิ์ส่งเอกสารผ่าน LINE");
          return;
        }
        const p = payments.find((x) => x.id === paymentId);
        if (!p) {
          toast.error("ไม่พบรายการชำระเงินที่ต้องการส่งใบเสร็จ");
          return;
        }
        const c = customerOf(p.customerId);
        const receiptNumber = p.receiptNo || p.ref;
        const attempt = billSends.filter((s) => s.paymentId === paymentId && s.type === "receipt").length + 1;

        const effectiveTarget = customTargetId?.trim() !== undefined ? customTargetId.trim() : (c?.lineId?.trim() || "");
        const cleanLineId = effectiveTarget.replace(/^@/, "");

        if (customTargetId !== undefined && c && c.lineId !== effectiveTarget) {
          setCustomers((prev) =>
            prev.map((item) => (item.id === c.id ? { ...item, lineId: effectiveTarget } : item)),
          );
        }

        toast.success(`บันทึกประวัติการส่งใบเสร็จ ${receiptNumber} เรียบร้อยแล้ว`);

        setBillSends((prev) => [
          {
            id: nid("S"),
            billId: p.billId || p.targetBillIds[0] || "",
            paymentId,
            at: now(),
            to: cleanLineId || c?.lineId || "-",
            channel: "line",
            type: "receipt",
            status: "sent",
            attempt,
            detail: `ใบเสร็จรับเงิน ${receiptNumber} ยอด ฿${thb(p.amount)}`,
          },
          ...prev,
        ]);
        log(`ส่งใบเสร็จรับเงิน ${receiptNumber} ไปยัง ${cleanLineId || c?.lineId || "-"} (ครั้งที่ ${attempt})`, p.customerId);
      },

      receiptSendsOf: (paymentId: string) =>
        billSends.filter((s) => s.paymentId === paymentId && s.type === "receipt"),

      fetchLineSlips: () => {
        if (!canPerform(role, "payment.record")) {
          toast.error("ไม่มีสิทธิ์รับข้อมูลการชำระเงิน");
          return { ok: 0, problem: 0 };
        }
        const open = bills.filter(
          (b) =>
            (b.status === "unpaid" || b.status === "overdue") &&
            !payments.some((p) => p.billId === b.id && p.status !== "rejected"),
        );
        if (!open.length) {
          toast.info("ไม่พบสลิปใหม่ใน Line OA");
          return { ok: 0, problem: 0 };
        }
        const take = open.slice(0, Math.min(5, open.length));
        const created: Payment[] = [];
        take.forEach((b, i) => {
          const c = customerOf(b.customerId);
          const good = i % 4 !== 3;
          const conf = good
            ? Math.round(90 + Math.random() * 9)
            : Math.round(52 + Math.random() * 30);
          const ref = `TMB${Math.floor(Math.random() * 900000 + 100000)}`;
          const slip = makeSlip(c?.name ?? "-", b.total, ref, good);
          const dupe = payments.some((p) => p.ref === ref);
          const issue = dupe
            ? "พบเลขที่อ้างอิงซ้ำกับรายการเดิม"
            : !good && slip.amount !== b.total
              ? `ยอดเงินในสลิป ฿${thb(slip.amount)} ไม่ตรงกับยอดตามใบแจ้งหนี้ ฿${thb(b.total)}`
              : !good
                ? "ภาพสลิปไม่ชัดเจน อ่านข้อมูลได้ไม่ครบถ้วน"
                : undefined;
          created.push({
            id: nid("P"),
            billId: b.id,
            billNo: b.no,
            customerId: b.customerId,
            division: b.type === "water" || b.no.endsWith("W") ? "water" : "electric",
            amount: b.total,
            method: "online",
            ref,
            paidAt: now(),
            paidDate: todayISO(),
            status: issue ? "problem" : "pending",
            ocrConfidence: conf,
            slip,
            ...(issue ? { issue } : {}),
            periods: [b.period],
            targetBillIds: [b.id],
            allocations: [],
            unallocatedAmount: 0,
          });
        });
        setPayments((prev) => [...created, ...prev]);
        setBills((prev) =>
          prev.map((b) =>
            created.some((p) => p.billId === b.id && p.status === "pending")
              ? { ...b, status: "pending_review" }
              : b,
          ),
        );
        const problem = created.filter((p) => p.status === "problem").length;
        log(`ดึงสลิปจาก Line OA และอ่านด้วย OCR ${created.length} รายการ`, "Payment OCR");
        toast.success(
          `ดึงสลิปจาก Line ${created.length} รายการ · ผ่าน OCR ${created.length - problem} · มีปัญหา ${problem}`,
        );
        return { ok: created.length - problem, problem };
      },

      settle: ({ billIds, method, ref, slipAttached, reconnectFee = 0 }) => {
        if (!canPerform(role, "payment.record")) {
          toast.error("ไม่มีสิทธิ์บันทึกการชำระเงิน");
          return false;
        }
        const validation = validateSettlementSelection(bills, payments, billIds, ref);
        if (!validation.ok) {
          toast.error(validation.message);
          return false;
        }
        const target = validation.bills;
        const billsSum = +target.reduce((s, b) => s + b.total, 0).toFixed(2);
        const fee = +(reconnectFee || 0).toFixed(2);
        const amount = +(billsSum + fee).toFixed(2);
        const c = customerOf(target[0]!.customerId);
        const conf = slipAttached ? Math.round(92 + Math.random() * 7) : 88;
        const targetDiv = target[0]?.type === "water" || target[0]?.no.endsWith("W") ? "water" : "electric";
        const p: Payment = {
          id: nid("P"),
          billId: target[0]!.id,
          billNo: target.map((b) => b.no).join(", "),
          customerId: target[0]!.customerId,
          division: targetDiv,
          amount,
          method,
          ref: ref.trim().toUpperCase(),
          paidAt: now(),
          paidDate: todayISO(),
          status: slipAttached ? "verified" : "pending",
          ocrConfidence: conf,
          slip: makeSlip(c?.name ?? "-", amount, ref, true),
          ...(slipAttached ? { receiptNo: `RCT-${Date.now().toString().slice(-6)}` } : {}),
          periods: target.map((b) => b.period),
          targetBillIds: target.map((b) => b.id),
          allocations: slipAttached ? target.map((b) => ({ billId: b.id, amount: b.total })) : [],
          unallocatedAmount: fee,
          reconnectFee: fee > 0 ? fee : undefined,
        };
        setPayments((prev) => [p, ...prev]);
        if (slipAttached) markPaid(billIds);
        else
          setBills((prev) =>
            prev.map((b) => (billIds.includes(b.id) ? { ...b, status: "pending_review" } : b)),
          );
        log(
          `รับชำระ ${target.length} บิล${fee > 0 ? ` + ค่าประสานมิเตอร์ ฿${thb(fee)}` : ""} รวม ฿${thb(amount)} (${method === "online" ? "โอน/Line" : "เคาน์เตอร์"})`,
          target[0]!.customerId,
        );
        toast.success(
          slipAttached
            ? `ตรวจสลิปผ่าน ${conf}% — ยืนยันและออกใบเสร็จแล้ว`
            : "บันทึกแล้ว — รอตรวจสอบสลิป",
        );
        return true;
      },

      verifyPayment: (paymentId, ok) => {
        if (!canPerform(role, "payment.verify"))
          return void toast.error("ไม่มีสิทธิ์ตรวจสอบการชำระเงิน");
        const p = payments.find((x) => x.id === paymentId);
        if (!p) return;
        if (p.status !== "pending" && p.status !== "problem")
          return void toast.error("รายการนี้ได้รับการตัดสินแล้ว");
        const receiptNo = ok ? `RCT-${Date.now().toString().slice(-6)}` : p.receiptNo;
        setPayments((prev) =>
          prev.map((x) =>
            x.id === paymentId
              ? {
                  ...x,
                  status: ok ? "verified" : "rejected",
                  allocations: ok
                    ? p.targetBillIds.flatMap((id) => {
                        const bill = bills.find((b) => b.id === id);
                        return bill ? [{ billId: id, amount: bill.total }] : [];
                      })
                    : [],
                  receiptNo,
                }
              : x,
          ),
        );
        setBills((prev) =>
          prev.map((b) =>
            p.targetBillIds.includes(b.id) ? { ...b, status: ok ? "paid" : "unpaid" } : b,
          ),
        );

        log(`${ok ? "ยืนยัน" : "ปฏิเสธ"}การชำระเงิน ${p.ref}`, p.customerId);
        toast[ok ? "success" : "error"](
          ok
            ? "ยืนยันการชำระเงินและออกใบเสร็จเรียบร้อยแล้ว"
            : "ปฏิเสธสลิปการชำระเงิน",
        );
      },

      updatePayment: (paymentId, patch) => {
        const p = payments.find((x) => x.id === paymentId);
        if (!p) {
          toast.error("ไม่พบรายการชำระเงินที่ต้องการแก้ไข");
          return false;
        }
        setPayments((prev) =>
          prev.map((item) => (item.id === paymentId ? { ...item, ...patch } : item)),
        );
        log(`แก้ไขข้อมูลการชำระเงิน/ใบเสร็จ ${p.ref} (${Object.keys(patch).join(", ")})`, p.customerId);
        toast.success("บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว");
        return true;
      },

      createTask: (customerId, type, division, amountDue, options) => {
        if (!canPerform(role, "service.request")) return void toast.error("ไม่มีสิทธิ์สร้างใบงาน");
        if (
          tasks.some(
            (t) =>
              t.customerId === customerId &&
              t.division === division &&
              t.type === type &&
              !["done", "rejected", "cancelled"].includes(t.status),
          )
        )
          return void toast.error("มีใบงานประเภทเดียวกันที่ยังเปิดอยู่แล้ว");

        const dept =
          division === "electric"
            ? "กองไฟฟ้า กรมช่างโยธาทหารอากาศ"
            : "กองน้ำประปา กรมช่างโยธาทหารอากาศ";

        const isReconnect = type === "reconnect";
        const autoApprove = options?.autoApprove ?? isReconnect;
        const taskStatus: TaskStatus = autoApprove ? "approved" : "waiting_approval";

        const defaultNote = isReconnect
          ? options?.referenceNo
            ? `รับชำระยอดค้างและค่าประสานมิเตอร์แล้ว (อ้างอิง: ${options.referenceNo}) — มอบหมายกอง${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"} ลงพื้นที่ต่อระบบ`
            : `รับชำระยอดค้างแล้ว — มอบหมายกอง${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"} ลงพื้นที่ต่อระบบ`
          : `ขออนุมัติระงับบริการ${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"} มอบหมายกอง${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"}`;

        const newTask: ServiceTask = {
          id: nid("T"),
          customerId,
          division,
          type,
          amountDue,
          status: taskStatus,
          createdAt: now(),
          assignedDepartment: dept,
          note: options?.note || defaultNote,
          referenceNo: options?.referenceNo,
          reconnectFee: options?.reconnectFee,
        };

        setTasks((prev) => [newTask, ...prev]);

        if (isReconnect) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId
                ? {
                    ...c,
                    serviceStates: {
                      ...c.serviceStates,
                      [division]: "pending_reconnect" as const,
                    },
                  }
                : c,
            ),
          );
          log(
            `รับชำระเงินและส่งมอบหมายใบงานต่อระบบให้เจ้าหน้าที่กอง${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"} ชย.ทอ. (รหัสใบงาน ${newTask.id})`,
            customerId,
          );
          toast.success(
            `ส่งการแจ้งมอบหมายใบงานต่อระบบไปยังเจ้าหน้าที่กอง${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"} ชย.ทอ. เรียบร้อยแล้ว`,
          );
        } else {
          log(`สร้างใบงานขออนุมัติระงับบริการ${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"}`, customerId);
          toast.success("ส่งใบงานให้ผู้บังคับบัญชาอนุมัติแล้ว");
        }
      },

      decideTask: (taskId, ok) => {
        if (!canPerform(role, "service.decide")) {
          toast.error("เฉพาะผู้บังคับบัญชาหรือผู้ดูแลระบบเท่านั้นที่อนุมัติใบงานได้");
          return;
        }
        const t = tasks.find((x) => x.id === taskId);
        if (!t) return;
        setTasks((prev) =>
          prev.map((x) => (x.id === taskId ? { ...x, status: ok ? "approved" : "rejected" } : x)),
        );
        log(
          `${ok ? "อนุมัติ" : "ไม่อนุมัติ"}ใบงาน${t.type === "disconnect" ? "ระงับบริการ" : "ต่อระบบ"}`,
          t.customerId,
        );
        toast[ok ? "success" : "error"](
          ok ? "อนุมัติแล้ว — ส่งใบงานให้กองช่างดำเนินการ" : "ไม่อนุมัติใบงาน",
        );
      },

      batchDecideTasks: (taskIds, ok) => {
        if (!canPerform(role, "service.decide")) {
          toast.error("เฉพาะผู้บังคับบัญชาหรือผู้ดูแลระบบเท่านั้นที่อนุมัติใบงานได้");
          return;
        }
        const targetSet = new Set(taskIds);
        setTasks((prev) =>
          prev.map((x) =>
            targetSet.has(x.id) && x.status === "waiting_approval"
              ? { ...x, status: ok ? "approved" : "rejected" }
              : x,
          ),
        );
        taskIds.forEach((id) => {
          const t = tasks.find((x) => x.id === id);
          if (t) {
            log(
              `${ok ? "อนุมัติ" : "ไม่อนุมัติ"}ใบงาน${t.type === "disconnect" ? "ระงับบริการ" : "ต่อระบบ"} (${t.division === "electric" ? "ไฟฟ้า" : "น้ำประปา"})`,
              t.customerId,
            );
          }
        });
        toast[ok ? "success" : "error"](
          ok
            ? `อนุมัติคำขอ ${taskIds.length} รายการเรียบร้อย — ส่งต่อไปยังหน้ามอบหมายใบงานแล้ว`
            : `ปฏิเสธคำขอ ${taskIds.length} รายการแล้ว`,
        );
      },

      completeTask: (taskId) => {
        if (!canPerform(role, "work_order.complete")) {
          toast.error("เฉพาะเจ้าหน้าที่ภาคสนามหรือผู้ดูแลระบบเท่านั้นที่ปิดใบงานได้");
          return;
        }
        const t = tasks.find((x) => x.id === taskId);
        if (!t) return;
        if (t.status !== "approved" && t.status !== "in_progress") {
          toast.error("ใบงานยังไม่ได้รับอนุมัติ");
          return;
        }
        setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, status: "done" } : x)));
        setCustomers((prev) =>
          prev.map((c) => {
            if (c.id !== t.customerId) return c;
            const serviceStates = {
              ...c.serviceStates,
              [t.division]: t.type === "disconnect" ? ("suspended" as const) : ("active" as const),
            };
            return {
              ...c,
              serviceStates,
              status: Object.values(serviceStates).some((state) => state === "suspended")
                ? "disconnected"
                : "active",
            };
          }),
        );
        log(`ปิดใบงาน${t.type === "disconnect" ? "ระงับบริการ" : "ต่อระบบ"}ภาคสนาม`, t.customerId);
        toast.success("ปิดงานเรียบร้อย — เก็บรายการไว้ในประวัติใบงาน");
      },

      cancelTask: (taskId, reason) => {
        const t = tasks.find((x) => x.id === taskId);
        if (!t) return;
        if (t.status === "cancelled") {
          toast.error("ใบงานนี้ถูกยกเลิกแล้ว");
          return;
        }
        setTasks((prev) =>
          prev.map((x) => (x.id === taskId ? { ...x, status: "cancelled" } : x)),
        );
        if (t.status === "done" && t.type === "disconnect") {
          setCustomers((prev) =>
            prev.map((c) => {
              if (c.id !== t.customerId) return c;
              const serviceStates = {
                ...c.serviceStates,
                [t.division]: "active" as const,
              };
              return {
                ...c,
                serviceStates,
                status: Object.values(serviceStates).some((state) => state === "suspended")
                  ? "disconnected"
                  : "active",
              };
            }),
          );
        }
        log(
          `ยกเลิกใบงาน${t.type === "disconnect" ? "ระงับบริการ" : "ต่อระบบ"} (${t.division === "electric" ? "ไฟฟ้า" : "น้ำประปา"})${reason ? ` เหตุผล: ${reason}` : ""}`,
          t.customerId,
        );
        toast.success(`ยกเลิกใบงาน${t.type === "disconnect" ? "ระงับบริการ" : ""}เรียบร้อยแล้ว`);
      },

      cancelSuspension: (customerId, division) => {
        setTasks((prev) =>
          prev.map((t) =>
            t.customerId === customerId &&
            t.division === division &&
            !["done", "rejected", "cancelled"].includes(t.status)
              ? { ...t, status: "cancelled" }
              : t,
          ),
        );
        setCustomers((prev) =>
          prev.map((c) => {
            if (c.id !== customerId) return c;
            const serviceStates = {
              ...c.serviceStates,
              [division]: "active" as const,
            };
            return {
              ...c,
              serviceStates,
              status: Object.values(serviceStates).some((state) => state === "suspended")
                ? "disconnected"
                : "active",
            };
          }),
        );
        log(
          `ยกเลิกระงับบริการ (${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"})`,
          customerId,
        );
        toast.success(`ยกเลิกระงับ${division === "electric" ? "ไฟฟ้า" : "น้ำประปา"}เรียบร้อยแล้ว`);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    me,
    role,
    users,
    period,
    settings,
    customers,
    readings,
    bills,
    payments,
    tasks,
    logs,
    billSends,
  ]);

  return <RcmsContext.Provider value={value}>{children}</RcmsContext.Provider>;
}

export function useRcms() {
  const c = useContext(RcmsContext);
  if (!c) throw new Error("useRcms must be used inside RcmsProvider");
  return c;
}
