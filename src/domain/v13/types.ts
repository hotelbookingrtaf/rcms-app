/**
 * RCMS v1.3 canonical domain types.
 *
 * These types intentionally separate business, data and workflow state.
 * The legacy UI store may project them into simpler view models, but financial
 * decisions must be made from these canonical records.
 */

export const SERVICE_TYPES = ["ELECTRICITY", "WATER"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const ROLES = [
  "ADMIN",
  "SUPERVISOR",
  "REVENUE_OFFICER",
  "UTILITY_FIELD_OFFICER",
  "AUDITOR",
  "ENTREPRENEUR",
] as const;
export type CanonicalRole = (typeof ROLES)[number];

export type RiskLevel = "GREEN" | "YELLOW" | "RED";
export type DecisionSource = "AUTO" | "RULE" | "MANUAL";

export type TenantState = "REGISTERED" | "ACTIVE" | "SUSPENDED" | "TERMINATED";
export type SiteState = "REGISTERED" | "ACTIVE" | "SUSPENDED" | "TERMINATED";
export type ServiceAccountState =
  | "REGISTERED"
  | "ACTIVE"
  | "SUSPENSION_PENDING"
  | "SUSPENDED"
  | "RECONNECTION_PENDING"
  | "TERMINATED";
export type MeterState =
  "UNASSIGNED" | "REGISTERED" | "ACTIVE" | "SUSPENDED" | "REMOVED" | "REPLACED";
export type ReadingState =
  "RECEIVED" | "VALIDATING" | "VALID" | "EXCEPTION" | "LOCKED" | "SUPERSEDED";
export type BillingPeriodState =
  "OPEN" | "IMPORTING" | "VALIDATING" | "READY_TO_BILL" | "BILLING" | "ISSUED" | "CLOSED";
export type BillingRunState =
  "DRAFT" | "READY" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type InvoiceState =
  "DRAFT" | "VALIDATED" | "ISSUED" | "SENT" | "PAID" | "OVERDUE" | "VOID" | "CANCELLED";
export type PaymentState =
  "RECEIVED" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "REVERSED";
export type PaymentIntentState =
  "DRAFT" | "SUBMITTED" | "PARTIALLY_FULFILLED" | "FULFILLED" | "EXPIRED" | "CANCELLED";
export type SlipState =
  "RECEIVED" | "PROCESSING" | "OCR_COMPLETED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED";
export type WorkOrderState = "CREATED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type WorkOrderType =
  "INSTALL" | "DISCONNECT" | "RECONNECT" | "REMOVE" | "REPLACE" | "INSPECT";
export type InspectionState = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
export type NotificationState =
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "DELIVERY_FAILED"
  | "BLOCKED"
  | "QUOTA_LIMIT"
  | "INVALID_RECIPIENT"
  | "RATE_LIMITED"
  | "RETRYING"
  | "CANCELLED";

export interface DecisionProvenance {
  decisionSource: DecisionSource;
  actorId: string;
  decidedAt: string;
  reason: string;
}

export interface Tenant {
  tenantId: string;
  customerCode: string;
  customerName: string;
  phone?: string;
  lineUserId?: string;
  status: TenantState;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  siteId: string;
  tenantId: string;
  siteCode: string;
  siteName: string;
  location: string;
  status: SiteState;
  effectiveAt: string;
}

export interface ServiceAccount {
  serviceAccountId: string;
  siteId: string;
  serviceType: ServiceType;
  status: ServiceAccountState;
  startDate: string;
  endDate?: string;
}

export interface Meter {
  meterId: string;
  serviceAccountId: string;
  meterNumber: string;
  status: MeterState;
  installationDate: string;
  removalDate?: string;
}

export interface SourceTrace {
  sourceSystem: string;
  sourceRecordId: string;
  sourceReference?: string;
  sourceDataVersion: string;
  importBatchId?: string;
  sourceFileName?: string;
  sourceRowNo?: number;
}

export interface CanonicalReading extends SourceTrace {
  readingId: string;
  meterId: string;
  serviceAccountId: string;
  billingPeriodId: string;
  previousReading: number;
  currentReading: number;
  usageUnits: number;
  readingDate: string;
  amountDue: number;
  status: ReadingState;
  validationCodes: ExceptionCode[];
}

export type ExceptionCode =
  | "MISSING_REQUIRED_FIELD"
  | "MISSING_READING"
  | "NEGATIVE_READING"
  | "NEGATIVE_AMOUNT"
  | "USAGE_MISMATCH"
  | "ZERO_USAGE"
  | "ZERO_USAGE_2_MONTHS"
  | "ZERO_AMOUNT"
  | "ZERO_BOTH"
  | "USAGE_AMOUNT_MISMATCH"
  | "METER_CHANGE"
  | "SITE_MISMATCH"
  | "DUPLICATE"
  | "SOURCE_CONFLICT"
  | "USAGE_ANOMALY";

export interface ValidationIssue {
  code: ExceptionCode;
  risk: RiskLevel;
  message: string;
}

export interface ImportBatch {
  importBatchId: string;
  idempotencyKey: string;
  sourceSystem: string;
  sourceFileName: string;
  templateVersion: string;
  sourceDataVersion: string;
  status:
    "RECEIVED" | "VALIDATING" | "COMMITTED" | "COMMITTED_WITH_ERRORS" | "REJECTED" | "SUPERSEDED";
  rowCount: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  supersedesBatchId?: string;
  importedAt: string;
  importedBy: string;
}

export interface ExceptionItem {
  exceptionId: string;
  importBatchId?: string;
  entityType: "READING" | "METER" | "SITE" | "PAYMENT" | "SLIP" | "NOTIFICATION";
  entityId?: string;
  code: ExceptionCode;
  risk: RiskLevel;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  message: string;
  provenance?: DecisionProvenance;
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  siteId: string;
  serviceAccountId: string;
  billingPeriodId: string;
  sourceDataVersion: string;
  issueDate: string;
  dueDate: string;
  amountDue: number;
  status: InvoiceState;
  snapshot: Record<string, unknown>;
}

export interface Payment {
  paymentId: string;
  tenantId: string;
  siteId: string;
  serviceAccountId: string;
  amount: number;
  paymentDate: string;
  postingDate: string;
  financialPeriod: string;
  reference: string;
  idempotencyKey: string;
  status: PaymentState;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface PaymentAllocation {
  allocationId: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  status: "ACTIVE" | "REVERSED";
  createdAt: string;
}

export interface CreditLedgerEvent {
  creditEventId: string;
  tenantId: string;
  siteId: string;
  serviceAccountId: string;
  paymentId?: string;
  eventType: "CREDIT_ADDED" | "CREDIT_APPLIED" | "CREDIT_HELD" | "CREDIT_REFUNDED" | "REVERSAL";
  amount: number;
  effectiveAt: string;
  recordedAt: string;
  reversalOfId?: string;
}

export interface FinancialEvent {
  financialEventId: string;
  eventType:
    | "CHARGE"
    | "PAYMENT"
    | "ALLOCATION"
    | "CREDIT_ADDED"
    | "CREDIT_APPLIED"
    | "ADJUSTMENT"
    | "REVERSAL"
    | "DEPOSIT_EVENT";
  entityId: string;
  amount: number;
  effectiveAt: string;
  recordedAt: string;
  postingPeriod: string;
  reversalOfId?: string;
  provenance: DecisionProvenance;
}

export interface MeterReplacementEvent {
  replacementEventId: string;
  siteId: string;
  serviceAccountId: string;
  oldMeterId: string;
  newMeterId: string;
  replacementDate: string;
  reason: "DAMAGED" | "MALFUNCTION" | "CALIBRATION" | "UPGRADE" | "LOST" | "MAINTENANCE" | "OTHER";
  oldFinalReading: number;
  newInitialReading: number;
  source: string;
  status: "DETECTED" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  verifiedBy?: string;
  verifiedAt?: string;
  note?: string;
}

export interface InspectionCase {
  inspectionCaseId: string;
  siteId: string;
  serviceAccountId: string;
  meterId: string;
  triggerPeriod1: string;
  triggerPeriod2: string;
  assignedTo?: string;
  status: InspectionState;
  inspectionDate?: string;
  result?:
    | "NORMAL_NO_USAGE"
    | "SHOP_CLOSED"
    | "SERVICE_SUSPENDED"
    | "METER_ISSUE"
    | "READING_ERROR"
    | "DATA_ERROR"
    | "OTHER";
  note?: string;
}

export interface WorkOrder {
  workOrderId: string;
  serviceAccountId: string;
  type: WorkOrderType;
  status: WorkOrderState;
  assignedTo?: string;
  effectiveAt?: string;
  recordedAt: string;
  evidenceRefs: string[];
}
