import type {
  CanonicalReading,
  ExceptionCode,
  Invoice,
  PaymentAllocation,
  RiskLevel,
  ServiceType,
  ValidationIssue,
} from "./types";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface ReadingValidationInput {
  serviceType: ServiceType;
  meterId: string;
  previousReading?: number;
  currentReading?: number;
  usageUnits?: number;
  amountDue?: number;
  previousPeriodReading?: Pick<CanonicalReading, "meterId" | "usageUnits">;
}

const issue = (code: ExceptionCode, risk: RiskLevel, message: string): ValidationIssue => ({
  code,
  risk,
  message,
});

/** BR-IMP/READ: Source values are preserved; deltas are validation evidence only. */
export function validateReading(input: ReadingValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { previousReading, currentReading, usageUnits, amountDue } = input;

  if (
    previousReading === undefined ||
    currentReading === undefined ||
    usageUnits === undefined ||
    amountDue === undefined
  ) {
    issues.push(
      issue("MISSING_REQUIRED_FIELD", "RED", "ข้อมูลเลขจด หน่วยใช้ หรือยอดจากต้นทางไม่ครบ"),
    );
    return issues;
  }
  if (currentReading < previousReading)
    issues.push(issue("NEGATIVE_READING", "RED", "เลขจดครั้งหลังน้อยกว่าครั้งก่อน"));
  if (usageUnits < 0) issues.push(issue("NEGATIVE_READING", "RED", "หน่วยใช้ติดลบ"));
  if (amountDue < 0) issues.push(issue("NEGATIVE_AMOUNT", "RED", "ยอดที่ต้องชำระจากต้นทางติดลบ"));

  const delta = money(currentReading - previousReading);
  if (delta !== money(usageUnits))
    issues.push(
      issue(
        "USAGE_MISMATCH",
        "RED",
        `ผลต่างเลขจด ${delta} ไม่ตรงกับหน่วยใช้จากต้นทาง ${usageUnits}`,
      ),
    );

  if (usageUnits === 0 && amountDue === 0)
    issues.push(issue("ZERO_BOTH", "YELLOW", "หน่วยใช้และยอดจากต้นทางเป็นศูนย์"));
  else if (usageUnits === 0)
    issues.push(issue("ZERO_USAGE", "GREEN", "หน่วยใช้เป็นศูนย์ ให้ติดตามต่อเนื่อง"));
  else if (amountDue === 0)
    issues.push(issue("USAGE_AMOUNT_MISMATCH", "RED", "มีหน่วยใช้แต่ยอดจากต้นทางเป็นศูนย์"));

  if (
    usageUnits === 0 &&
    input.previousPeriodReading?.meterId === input.meterId &&
    input.previousPeriodReading.usageUnits === 0
  ) {
    issues.push(
      issue(
        "ZERO_USAGE_2_MONTHS",
        "RED",
        "มิเตอร์เดิมมีหน่วยใช้เป็นศูนย์ติดต่อกัน 2 เดือน ต้องสร้าง Inspection Case",
      ),
    );
  }

  return issues;
}

export interface AllocationInput {
  paymentId: string;
  paymentAmount: number;
  serviceAccountId: string;
  invoices: Array<
    Pick<Invoice, "invoiceId" | "serviceAccountId" | "billingPeriodId" | "amountDue" | "status">
  >;
  existingAllocated?: Record<string, number>;
  targetInvoiceIds?: string[];
  accumulateShortPayment?: boolean;
  createdAt: string;
}

export interface AllocationResult {
  allocations: PaymentAllocation[];
  fullySettledInvoiceIds: string[];
  shortPaymentInvoiceId?: string;
  unallocatedAmount: number;
}

/**
 * BR-PAY-003/004: allocate oldest debt first and only close an invoice when its
 * remaining balance is fully covered. A short payment remains unallocated for
 * the target invoice until later payments complete the coverage.
 */
export function allocateOldestFullInvoiceFirst(input: AllocationInput): AllocationResult {
  let available = money(input.paymentAmount);
  const allocations: PaymentAllocation[] = [];
  const fullySettledInvoiceIds: string[] = [];
  let shortPaymentInvoiceId: string | undefined;

  const candidates = input.invoices
    .filter((invoice) => invoice.serviceAccountId === input.serviceAccountId)
    .filter(
      (invoice) => !input.targetInvoiceIds || input.targetInvoiceIds.includes(invoice.invoiceId),
    )
    .filter(
      (invoice) =>
        invoice.status !== "PAID" && invoice.status !== "VOID" && invoice.status !== "CANCELLED",
    )
    .sort((a, b) => a.billingPeriodId.localeCompare(b.billingPeriodId));

  for (const invoice of candidates) {
    const already = money(input.existingAllocated?.[invoice.invoiceId] ?? 0);
    const remaining = money(Math.max(0, invoice.amountDue - already));
    if (remaining === 0) {
      fullySettledInvoiceIds.push(invoice.invoiceId);
      continue;
    }
    if (available < remaining) {
      shortPaymentInvoiceId = invoice.invoiceId;
      if (input.accumulateShortPayment && available > 0) {
        allocations.push({
          allocationId: `ALLOC-${input.paymentId}-${invoice.invoiceId}`,
          paymentId: input.paymentId,
          invoiceId: invoice.invoiceId,
          amount: available,
          status: "ACTIVE",
          createdAt: input.createdAt,
        });
        available = 0;
      }
      break;
    }
    allocations.push({
      allocationId: `ALLOC-${input.paymentId}-${invoice.invoiceId}`,
      paymentId: input.paymentId,
      invoiceId: invoice.invoiceId,
      amount: remaining,
      status: "ACTIVE",
      createdAt: input.createdAt,
    });
    available = money(available - remaining);
    fullySettledInvoiceIds.push(invoice.invoiceId);
  }

  const result: AllocationResult = {
    allocations,
    fullySettledInvoiceIds,
    unallocatedAmount: available,
  };
  if (shortPaymentInvoiceId) result.shortPaymentInvoiceId = shortPaymentInvoiceId;
  return result;
}

export function invoiceCoverage(amountDue: number, activeAllocatedAmount: number) {
  const verifiedAmount = money(Math.max(0, activeAllocatedAmount));
  const remainingAmount = money(Math.max(0, amountDue - verifiedAmount));
  return {
    verifiedAmount,
    remainingAmount,
    paidRatio: amountDue <= 0 ? 1 : Math.min(1, verifiedAmount / amountDue),
    isPaid: remainingAmount === 0,
    hasShortPayment: verifiedAmount > 0 && remainingAmount > 0,
  };
}

export function shouldCancelPendingDisconnection(targetServiceOutstanding: number): boolean {
  return money(targetServiceOutstanding) <= 0;
}

export function isDuplicateIdempotencyKey(key: string, existingKeys: readonly string[]): boolean {
  return existingKeys.includes(key);
}

export function electricitySiteCode(meterNumber: string): string {
  const normalized = meterNumber.trim();
  if (!/^\d{5,6}-\d{3}$/.test(normalized)) throw new Error("INVALID_ELECTRICITY_METER_PATTERN");
  return `EM${normalized}`;
}
