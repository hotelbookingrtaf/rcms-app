import type {
  AppUser,
  AuditLog,
  Bill,
  Customer,
  Payment,
  Reading,
  ServiceTask,
  Settings,
} from "./rcms-types";

export const DEFAULT_SETTINGS: Settings = {
  meterMaintenanceFee: 33.29,
  penaltyDisconnectionFee: 100,
  depositElectric: 1500,
  depositWater: 1500,
  dueDayOffset: 10,
  graceDays: 3,
  serviceFee: 33.29,
  vatPercent: 7,
  ft: 0.1623,
  electricRate: 3.2484,
  waterRate: 9.5,
  fetchDay: 25,
  retentionMonths: 120,
  suspendCutoffDay: 20,
  bankName: "ธนาคารทหารไทยธนชาต",
  bankAccountNo: "057-1-07053-1",
  bankAccountName: "เงินนอกงบประมาณ กรมช่างโยธาทหารอากาศ",
  paymentHours: "รับชำระเงินวันทำการ ตั้งแต่เวลา 0800–1500 น.",
  contactPhone: "02-534-2557",
  contactFax: "02-523-9470",
  lineContact: "LINE ฝ่ายจัดเก็บรายได้ ชย.ทอ. · ID LINE: rddce2020",
  qrCodeUrl: "",
};

export const PERIODS = ["2569-03", "2569-04", "2569-05", "2569-06", "2569-07", "2569-08", "2569-09"];
export const CURRENT_PERIOD = "2569-09";

export const todayISO = () => new Date().toISOString().slice(0, 10);

const rawCustomers: Array<{
  code: string;
  name: string;
  shop: string;
  phone: string;
  lineId: string;
  elecMeter?: string;
  waterMeter?: string;
}> = [
  {
    code: "C-101",
    name: "นางพะเยาว์ จันทร์อวยพร",
    shop: "ร้านอาหาร สพ.ทอ. 6-7",
    phone: "081-234-5601",
    lineId: "payao",
    elecMeter: "20177-093",
  },
  {
    code: "C-102",
    name: "นายเดชทัต เมืองศรี",
    shop: "ร้านอาหาร สพ.ทอ. 8",
    phone: "081-234-5602",
    lineId: "detchatat",
    elecMeter: "20177-094",
  },
  {
    code: "C-103",
    name: "พ.อ.อ.สมพงษ์ แย้มขยาย",
    shop: "ร้านอาหาร สพ.ทอ. 9",
    phone: "081-234-5603",
    lineId: "sompong",
    elecMeter: "72793-061",
  },
  {
    code: "C-104",
    name: "น.อ.ทศพล กวักทรัพย์",
    shop: "ร้านกาแฟสวัสดิการ สพ.ทอ.",
    phone: "081-234-5604",
    lineId: "todsapol",
    elecMeter: "50365-68",
  },
  {
    code: "C-105",
    name: "นายสมคิด จงรัตน์",
    shop: "เครื่องซักผ้า อาคารนอน 1 รร.จอ.",
    phone: "081-234-5605",
    lineId: "somkid1",
    elecMeter: "50365-69",
  },
  {
    code: "C-106",
    name: "นายสมคิด จงรัตน์",
    shop: "เครื่องซักผ้า อาคารนอน 1 รร.จอ.",
    phone: "081-234-5606",
    lineId: "somkid2",
    elecMeter: "38944-012",
  },
  {
    code: "C-107",
    name: "นายสมคิด จงรัตน์",
    shop: "เครื่องซักผ้า อาคารนอน 9 รร.จอ.",
    phone: "081-234-5607",
    lineId: "somkid3",
    elecMeter: "20177-099",
  },
  {
    code: "C-108",
    name: "นายสมคิด จงรัตน์",
    shop: "เครื่องซักผ้า อาคารนอน 9 รร.จอ.",
    phone: "081-234-5608",
    lineId: "somkid4",
    elecMeter: "20177-100",
  },
  {
    code: "C-109",
    name: "นายสมคิด จงรัตน์",
    shop: "เครื่องซักผ้า อาคารนอน 4 รร.จอ.",
    phone: "081-234-5609",
    lineId: "somkid5",
    elecMeter: "20177-101",
  },
  {
    code: "C-110",
    name: "พ.อ.อ.ณรงค์ศักดิ์ จันทะมาลา",
    shop: "ร้านค้าห้องบริการ รร.จอ.ร้านที่ 1 ส้มตำ",
    phone: "081-234-5610",
    lineId: "narongsak",
    elecMeter: "72793-070",
  },
  {
    code: "C-111",
    name: "นางเบญจา ศรีนา",
    shop: "ร้านค้าห้องบริการ รร.จอ.ร้านที่ 2 ข้าวแกง",
    phone: "081-234-5611",
    lineId: "benja",
    elecMeter: "72793-071",
  },
  {
    code: "C-112",
    name: "นางอรภิญญา มากเจริญ",
    shop: "ร้านค้าห้องบริการ รร.จอ.ร้านที่ 4 ลูกชิ้นทอด",
    phone: "081-234-5612",
    lineId: "orrapinya",
    elecMeter: "20177-105",
  },
  {
    code: "C-113",
    name: "นายเชิดชัย ดำขำ",
    shop: "ร้านค้าห้องบริการ รร.จอ.ร้านที่ 5 ข้าวโพดฯ",
    phone: "081-234-5613",
    lineId: "cherdchai",
    elecMeter: "38944-015",
  },
  {
    code: "C-114",
    name: "นางกัญยารัศมี นันทณัฐปิติโภคิน",
    shop: "ร้านค้าห้องบริการ รร.จอ.ร้านที่ 7 ผลไม้",
    phone: "081-234-5614",
    lineId: "kanyarasmee",
    elecMeter: "38944-016",
  },
  {
    code: "C-115",
    name: "พ.อ.อ.สราวุธ เอี่ยมเขียว",
    shop: "ร้านค้าห้องบริการ รร.จอ.ร้านที่ 8 น้ำปั่น",
    phone: "081-234-5615",
    lineId: "sarawut",
    elecMeter: "20177-109",
  },
  {
    code: "C-116",
    name: "ร.อ.ไพศาล ปิลวี",
    shop: "ร้านค้าห้องบริการ รร.จอ.ร้านที่ 10 ตู้เครื่องดื่ม",
    phone: "081-234-5616",
    lineId: "paisarn",
    elecMeter: "72793-080",
  },
  {
    code: "C-117",
    name: "น.ส.อภิชญา แสงอินทร์",
    shop: "ร้านค้าห้องบริการ รร.จอ.",
    phone: "081-234-5617",
    lineId: "apichaya",
  },
];

export function makeCustomers(): Customer[] {
  return rawCustomers.map((c, i) => {
    const hasElec = Boolean(c.elecMeter);
    const hasWater = Boolean(c.waterMeter);
    return {
      id: c.code,
      code: c.code,
      name: c.name,
      shop: c.shop,
      phone: c.phone,
      lineId: c.lineId,
      elecMeter: c.elecMeter,
      waterMeter: c.waterMeter,
      status: i === 5 ? "disconnected" : i === 9 ? "installment" : i === 16 ? "registered" : "active",
      serviceStates: {
        electric: !hasElec ? "closed" : i === 5 ? "suspended" : i === 16 ? "closed" : "active",
        water: !hasWater ? "closed" : i === 5 ? "suspended" : i === 16 ? "closed" : "active",
      },
      siteId: `SITE-${String(i + 1).padStart(3, "0")}`,
      siteCode: `CHY-${String(i + 1).padStart(3, "0")}`,
      depositPaid: i === 16 ? 0 : (hasElec ? DEFAULT_SETTINGS.depositElectric : 0) + (hasWater ? DEFAULT_SETTINGS.depositWater : 0),
      createdAt: "2566-05-01",
      contractStart: i % 3 === 0 ? "" : `2566-0${(i % 9) + 1}-01`,
    };
  });
}

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

export function makeReadings(customers: Customer[]): Reading[] {
  const r = rnd(42);
  const out: Reading[] = [];
  customers.forEach((c, ci) => {
    let elec = 1000 + ci * 137;
    let water = 20 + ci * 3;
    PERIODS.forEach((p) => {
      const useE = c.status === "registered" || !c.elecMeter ? 0 : Math.round(r() * 260 + (ci % 5 === 0 ? 0 : 20));
      const useW = c.status === "registered" || !c.waterMeter ? 0 : Math.round(r() * 12);
      const sourceVersion = `SEED-${p}-v1`;
      if (c.elecMeter) {
        out.push({
          id: `R-E-${c.id}-${p}`,
          customerId: c.id,
          division: "electric",
          period: p,
          prev: elec,
          curr: elec + useE,
          usageUnits: useE,
          amountDue: +(
            useE > 0 ? useE * 3.4107 * 1.07 : DEFAULT_SETTINGS.meterMaintenanceFee
          ).toFixed(2),
          sourceDataVersion: sourceVersion,
          sourceRecordId: `SRC-E-${c.id}-${p}`,
          validationState: useE === 0 ? "yellow" : "green",
          validationCodes: useE === 0 ? ["ZERO_USAGE_MONITOR"] : [],
          source: "api",
        });
      }
      if (c.waterMeter) {
        out.push({
          id: `R-W-${c.id}-${p}`,
          customerId: c.id,
          division: "water",
          period: p,
          prev: water,
          curr: water + useW,
          usageUnits: useW,
          amountDue: +(useW > 0 ? useW * 9.5 * 1.07 : DEFAULT_SETTINGS.meterMaintenanceFee).toFixed(
            2,
          ),
          sourceDataVersion: sourceVersion,
          sourceRecordId: `SRC-W-${c.id}-${p}`,
          validationState: useW === 0 ? "yellow" : "green",
          validationCodes: useW === 0 ? ["ZERO_USAGE_MONITOR"] : [],
          source: "excel",
        });
      }
      elec += useE;
      water += useW;
    });
  });
  return out;
}

export const SEED_TASKS: ServiceTask[] = [
  {
    id: "T-001",
    customerId: "C-106",
    division: "electric",
    type: "reconnect",
    amountDue: 100,
    status: "approved",
    createdAt: "2569-08-18",
  },
  {
    id: "T-002",
    customerId: "C-113",
    division: "water",
    type: "disconnect",
    amountDue: 1870.5,
    status: "waiting_approval",
    createdAt: "2569-08-24",
  },
];

export const SEED_PAYMENTS: Payment[] = [];

export const SEED_USERS: AppUser[] = [
  {
    id: "U-001",
    rank: "น.อ.",
    firstName: "ธนกฤต",
    lastName: "ชัยวัฒน์",
    email: "admin@rcms.rtaf.mi.th",
    password: "admin1234",
    role: "admin",
    status: "active",
    createdAt: "2568-10-01",
  },
  {
    id: "U-002",
    rank: "น.ท.",
    firstName: "ประเสริฐ",
    lastName: "ศรีสุวรรณ",
    email: "boss@rcms.rtaf.mi.th",
    password: "boss1234",
    role: "supervisor",
    status: "active",
    createdAt: "2568-10-01",
  },
  {
    id: "U-003",
    rank: "พ.อ.อ.",
    firstName: "โยธา",
    lastName: "รายได้",
    email: "staff@rcms.rtaf.mi.th",
    password: "staff1234",
    role: "revenue_officer",
    status: "active",
    createdAt: "2568-10-05",
  },
  {
    id: "U-004",
    rank: "จ.ท.",
    firstName: "ณัฐพล",
    lastName: "แก้วมณี",
    email: "newstaff@rcms.rtaf.mi.th",
    password: "new12345",
    role: "utility_field_officer",
    status: "pending",
    createdAt: "2569-08-24",
  },
];

const REAL_ARREARS_MAP: Record<string, Record<string, number>> = {
  "C-101": { "2569-07": 338.52, "2569-06": 353.12, "2569-05": 331.23, "2569-04": 314.84 },
  "C-102": { "2569-07": 864.5, "2569-06": 592.42 },
  "C-103": {
    "2569-07": 192.55,
    "2569-06": 196.2,
    "2569-05": 174.3,
    "2569-04": 193.13,
    "2569-03": 361.38,
  },
  "C-104": { "2569-07": 3354.78, "2569-06": 84.0 },
  "C-105": { "2569-07": 39.27, "2569-06": 35.62 },
  "C-106": { "2569-07": 57.52, "2569-06": 57.52 },
  "C-107": { "2569-07": 134.16, "2569-06": 97.66 },
  "C-108": { "2569-07": 156.05, "2569-06": 137.8 },
  "C-109": { "2569-07": 35.62, "2569-06": 61.17 },
  "C-110": { "2569-07": 455.31, "2569-06": 422.46, "2569-05": 433.41, "2569-04": 483.09 },
  "C-111": { "2569-07": 272.83, "2569-06": 210.79 },
  "C-112": { "2569-07": 382.32, "2569-06": 360.42, "2569-05": 389.62, "2569-04": 361.38 },
  "C-113": { "2569-07": 225.39, "2569-06": 236.34 },
  "C-114": {
    "2569-07": 418.81,
    "2569-06": 342.17,
    "2569-05": 393.27,
    "2569-04": 390.02,
    "2569-03": 425.82,
  },
  "C-115": {
    "2569-07": 502.75,
    "2569-06": 455.31,
    "2569-05": 458.96,
    "2569-04": 418.66,
    "2569-03": 551.11,
    "2569-02": 511.73,
  },
  "C-116": { "2569-07": 1117.81, "2569-06": 1084.97 },
};

/** สร้างบิลทั้งย้อนหลังและงวดปัจจุบัน เพื่อให้มีข้อมูลสถานะทั้ง ชำระแล้ว / ปกติ / ค้างชำระ ตรงตามไฟล์ Excel */
export function makeHistoryBills(customers: Customer[], readings: Reading[]): Bill[] {
  const out: Bill[] = [];
  customers.forEach((c) => {
    if (c.status === "registered") return;
    const customArrears = REAL_ARREARS_MAP[c.id];

    PERIODS.forEach((p) => {
      const isCurrent = p === CURRENT_PERIOD;
      const re = readings.find(
        (r) => r.customerId === c.id && r.division === "electric" && r.period === p,
      );
      const rw = readings.find(
        (r) => r.customerId === c.id && r.division === "water" && r.period === p,
      );

      let billStatus: Bill["status"] = "paid";
      let customAmount: number | undefined;

      if (customArrears) {
        if (customArrears[p] !== undefined) {
          billStatus = "overdue";
          customAmount = customArrears[p];
        } else if (isCurrent) {
          billStatus = "unpaid";
        } else {
          billStatus = "paid";
        }
      } else if (isCurrent) {
        billStatus = "unpaid";
      }

      ([re, rw] as const).forEach((reading) => {
        if (!reading) return;
        const type = reading.division;
        const kind = type;
        const label = type === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา";
        const amount = customAmount !== undefined ? customAmount : reading.amountDue;
        const finalStatus = billStatus;

        out.push({
          id: isCurrent ? `B-${type}-${c.id}-${p}` : `HB-${type}-${c.id}-${p}`,
          no: `${p.replace("-", "")}-${c.code.slice(2)}${type === "electric" ? "E" : "W"}`,
          customerId: c.id,
          period: p,
          type,
          serviceAccountId: `SA-${type}-${c.siteId}`,
          sourceDataVersion: reading.sourceDataVersion,
          lines: [
            {
              label: `${label} (ตามทะเบียนคุมรายได้)`,
              amount,
              kind,
            },
          ],
          total: amount,
          issuedAt: `${p}-26`,
          dueAt: `ภายใน ${DEFAULT_SETTINGS.dueDayOffset} วัน`,
          status: finalStatus,
        });
      });
    });
  });
  return out;
}

export function makeSeedPayments(bills: Bill[], customers: Customer[]): Payment[] {
  const targetBills = bills.filter(
    (b) => (b.status === "paid" || b.status === "pending_review") && b.period === CURRENT_PERIOD,
  );
  return targetBills.map((b, idx) => {
    const cust = customers.find((c) => c.id === b.customerId);
    const isPending = b.status === "pending_review";
    const ref = `TMB${Math.floor(100000 + idx * 7919) % 900000 + 100000}`;
    return {
      id: `P-${idx + 1}`,
      billId: b.id,
      billNo: b.no,
      customerId: b.customerId,
      division: b.type === "water" || b.no.endsWith("W") ? "water" : "electric",
      amount: b.total,
      method: idx % 2 === 0 ? "online" : "counter",
      ref,
      paidAt: `${b.period}-28 10:30`,
      paidDate: todayISO(),
      status: isPending ? "pending" : "verified",
      ocrConfidence: isPending ? 88 : 99,
      receiptNo: isPending ? undefined : `REC-${b.no}`,
      periods: [b.period],
      targetBillIds: [b.id],
      allocations: [{ billId: b.id, amount: b.total }],
      unallocatedAmount: 0,
      slip: {
        bank: "ธนาคารทหารไทยธนชาต",
        payerName: cust?.name ?? "ผู้ประกอบการ",
        payerAccount: `xxx-x-x${Math.floor(Math.random() * 9000 + 1000)}-x`,
        amount: b.total,
        dateTime: `${b.period}-28 10:30`,
        ref,
      },
    };
  });
}

export const SEED_LOGS: AuditLog[] = [
  {
    id: "L-001",
    at: "25/08/69 09:12",
    date: todayISO(),
    actor: "ระบบอัตโนมัติ",
    action: "ดึงข้อมูลหน่วยใช้จาก API กองไฟฟ้า (20 รายการ)",
    target: "Data Ingestion",
  },
  {
    id: "L-002",
    at: "25/08/69 09:15",
    date: todayISO(),
    actor: "พ.อ.อ.โยธา รายได้ (เจ้าหน้าที่)",
    action: "อัปโหลด Excel หน่วยใช้น้ำ (20 รายการ)",
    target: "Data Ingestion",
  },
];
