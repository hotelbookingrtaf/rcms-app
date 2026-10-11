export type Division = "electric" | "water";

export type CustomerStatus =
  "active" | "registered" | "disconnected" | "pending_reconnect" | "installment";

export interface Customer {
  id: string;
  code: string;
  name: string;
  shop: string;
  phone: string;
  lineId: string;
  elecMeter?: string | undefined;
  waterMeter?: string | undefined;
  status: CustomerStatus;
  /** สถานะบริการต้องแยกตาม service account; status ด้านบนคงไว้เป็น legacy display adapter */
  serviceStates: Record<Division, "active" | "suspended" | "pending_reconnect" | "closed">;
  /** Site ID เป็นรหัสภายในแบบคงที่ ส่วน siteCode เป็นรหัสธุรกิจที่เปลี่ยนย้อนหลังได้ */
  siteId: string;
  siteCode: string;
  depositPaid: number;
  createdAt: string;
  /** วันที่เริ่มสัญญา — ว่าง = ไม่ระบุ */
  contractStart?: string | undefined;
}

export interface Reading {
  id: string;
  customerId: string;
  division: Division;
  period: string; // YYYY-MM
  prev: number;
  curr: number;
  /** ค่าจากระบบต้นทาง ห้าม RCMS คำนวณอัตราค่าสาธารณูปโภคเอง */
  usageUnits: number;
  amountDue: number;
  sourceDataVersion: string;
  sourceRecordId: string;
  validationState: "green" | "yellow" | "red";
  validationCodes: string[];
  source: "api" | "excel" | "manual";
}

export type BillStatus = "unpaid" | "pending_review" | "paid" | "overdue" | "cancelled";

export interface BillLine {
  label: string;
  amount: number;
  kind: "electric" | "water" | "maintenance" | "penalty" | "deposit" | "service" | "vat";
}

export interface Bill {
  id: string;
  no: string;
  customerId: string;
  period: string;
  type: "combined" | "electric" | "water";
  serviceAccountId: string;
  sourceDataVersion: string;
  lines: BillLine[];
  total: number;
  issuedAt: string;
  dueAt: string;
  status: BillStatus;
}

/** ข้อมูลที่ OCR อ่านได้จากภาพสลิป */
export interface SlipData {
  bank: string;
  payerName: string;
  payerAccount: string;
  amount: number;
  dateTime: string;
  ref: string;
}

export type PaymentStatus = "pending" | "verified" | "rejected" | "problem";

export interface Payment {
  id: string;
  billId: string;
  billNo: string;
  customerId: string;
  amount: number;
  method: "online" | "counter";
  ref: string;
  paidAt: string;
  /** วันที่ในรูปแบบ YYYY-MM-DD (ค.ศ.) สำหรับการค้นหาย้อนหลัง */
  paidDate: string;
  status: PaymentStatus;
  ocrConfidence: number;
  slip: SlipData;
  /** เหตุผลกรณีสลิปมีปัญหา */
  issue?: string | undefined;
  receiptNo?: string | undefined;
  bookNo?: string | undefined;
  /** ประเภทสาธารณูปโภค เช่น ค่าไฟฟ้า หรือ น้ำประปา */
  division?: Division | undefined;
  /** งวดที่ชำระในรายการนี้ (กรณีชำระยอดค้างหลายเดือน) */
  periods?: string[] | undefined;
  /** ใบแจ้งหนี้เป้าหมาย; allocations จะเกิดขึ้นเมื่อยืนยันเงินจริงแล้ว */
  targetBillIds: string[];
  allocations: Array<{ billId: string; amount: number }>;
  unallocatedAmount: number;
  /** ค่าประสานมิเตอร์ (ต่อระบบ) กรณีเป็นรายการรับชำระเพื่อต่อระบบ */
  reconnectFee?: number | undefined;
}

export type TaskType = "disconnect" | "reconnect";
export type TaskStatus =
  "waiting_approval" | "approved" | "rejected" | "cancelled" | "in_progress" | "done";

export interface ServiceTask {
  id: string;
  customerId: string;
  division: Division;
  type: TaskType;
  amountDue: number;
  status: TaskStatus;
  createdAt: string;
  note?: string | undefined;
  /** หน่วยงานผู้รับมอบหมาย เช่น "กองไฟฟ้า กรมช่างโยธาทหารอากาศ" หรือ "กองน้ำประปา กรมช่างโยธาทหารอากาศ" */
  assignedDepartment?: string | undefined;
  /** เลขที่อ้างอิงการชำระเงินหรือใบเสร็จ */
  referenceNo?: string | undefined;
  /** ค่าประสานมิเตอร์ */
  reconnectFee?: number | undefined;
}

export interface AuditLog {
  id: string;
  at: string;
  /** YYYY-MM-DD (ค.ศ.) */
  date: string;
  actor: string;
  action: string;
  target: string;
}

export interface BillSend {
  id: string;
  billId: string;
  at: string;
  to: string;
  channel: "line";
  status: "sent" | "failed";
  attempt: number;
  /** ประเภทการส่ง: ใบแจ้งหนี้ (bill) หรือ ใบเสร็จรับเงิน (receipt) */
  type?: "bill" | "receipt";
  paymentId?: string;
  detail?: string;
}

export interface Settings {
  meterMaintenanceFee: number;
  penaltyDisconnectionFee: number;
  depositElectric: number;
  depositWater: number;
  dueDayOffset: number;
  graceDays: number;
  /** ค่าที่ยังใช้ในการคำนวณเบื้องหลัง (ไม่แสดงในหน้าตั้งค่า) */
  serviceFee: number;
  vatPercent: number;
  ft: number;
  electricRate: number;
  waterRate: number;
  fetchDay: number;
  retentionMonths: number;
  /** วันตัดรอบเข้าเงื่อนไขระงับบริการ */
  suspendCutoffDay: number;

  /** ข้อมูลบัญชีการโอนเงินและ QR Code */
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  paymentHours: string;
  contactPhone: string;
  contactFax: string;
  lineContact: string;
  qrCodeUrl?: string;
}

export type Role =
  "admin" | "supervisor" | "revenue_officer" | "utility_field_officer" | "auditor" | "entrepreneur";

export interface AppUser {
  id: string;
  rank: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  status: "pending" | "active";
  createdAt: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  supervisor: "ผู้บังคับบัญชา",
  revenue_officer: "เจ้าหน้าที่จัดเก็บรายได้",
  utility_field_officer: "เจ้าหน้าที่สาธารณูปโภค/ภาคสนาม",
  auditor: "ผู้ตรวจสอบ",
  entrepreneur: "ผู้ประกอบการ",
};

export const fullName = (u: AppUser) => `${u.rank}${u.firstName} ${u.lastName}`;
