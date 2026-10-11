import type {
  BillingPeriodState,
  BillingRunState,
  InspectionState,
  InvoiceState,
  MeterState,
  NotificationState,
  PaymentIntentState,
  PaymentState,
  ReadingState,
  ServiceAccountState,
  SlipState,
  WorkOrderState,
} from "./types";

type TransitionMap<T extends string> = Readonly<Record<T, readonly T[]>>;

export const SERVICE_ACCOUNT_TRANSITIONS: TransitionMap<ServiceAccountState> = {
  REGISTERED: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["SUSPENSION_PENDING", "TERMINATED"],
  SUSPENSION_PENDING: ["ACTIVE", "SUSPENDED"],
  SUSPENDED: ["RECONNECTION_PENDING", "TERMINATED"],
  RECONNECTION_PENDING: ["SUSPENDED", "ACTIVE"],
  TERMINATED: [],
};

export const METER_TRANSITIONS: TransitionMap<MeterState> = {
  UNASSIGNED: ["REGISTERED"],
  REGISTERED: ["ACTIVE", "REMOVED"],
  ACTIVE: ["SUSPENDED", "REMOVED", "REPLACED"],
  SUSPENDED: ["ACTIVE", "REMOVED", "REPLACED"],
  REMOVED: [],
  REPLACED: [],
};

export const READING_TRANSITIONS: TransitionMap<ReadingState> = {
  RECEIVED: ["VALIDATING"],
  VALIDATING: ["VALID", "EXCEPTION"],
  VALID: ["LOCKED", "SUPERSEDED"],
  EXCEPTION: ["VALIDATING", "SUPERSEDED"],
  LOCKED: ["SUPERSEDED"],
  SUPERSEDED: [],
};

export const BILLING_PERIOD_TRANSITIONS: TransitionMap<BillingPeriodState> = {
  OPEN: ["IMPORTING"],
  IMPORTING: ["VALIDATING"],
  VALIDATING: ["IMPORTING", "READY_TO_BILL"],
  READY_TO_BILL: ["BILLING"],
  BILLING: ["READY_TO_BILL", "ISSUED"],
  ISSUED: ["CLOSED"],
  CLOSED: [],
};

export const BILLING_RUN_TRANSITIONS: TransitionMap<BillingRunState> = {
  DRAFT: ["READY", "CANCELLED"],
  READY: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["READY", "CANCELLED"],
  CANCELLED: [],
};

export const INVOICE_TRANSITIONS: TransitionMap<InvoiceState> = {
  DRAFT: ["VALIDATED", "CANCELLED"],
  VALIDATED: ["ISSUED", "CANCELLED"],
  ISSUED: ["SENT", "PAID", "OVERDUE", "VOID"],
  SENT: ["PAID", "OVERDUE", "VOID"],
  PAID: ["VOID"],
  OVERDUE: ["PAID", "VOID"],
  VOID: [],
  CANCELLED: [],
};

export const PAYMENT_TRANSITIONS: TransitionMap<PaymentState> = {
  RECEIVED: ["PENDING_VERIFICATION", "REJECTED"],
  PENDING_VERIFICATION: ["VERIFIED", "REJECTED"],
  VERIFIED: ["REVERSED"],
  REJECTED: [],
  REVERSED: [],
};

export const PAYMENT_INTENT_TRANSITIONS: TransitionMap<PaymentIntentState> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["PARTIALLY_FULFILLED", "FULFILLED", "EXPIRED", "CANCELLED"],
  PARTIALLY_FULFILLED: ["FULFILLED", "EXPIRED", "CANCELLED"],
  FULFILLED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export const SLIP_TRANSITIONS: TransitionMap<SlipState> = {
  RECEIVED: ["PROCESSING"],
  PROCESSING: ["OCR_COMPLETED", "REJECTED"],
  OCR_COMPLETED: ["PENDING_REVIEW", "REJECTED"],
  PENDING_REVIEW: ["VERIFIED", "REJECTED"],
  VERIFIED: [],
  REJECTED: [],
};

export const WORK_ORDER_TRANSITIONS: TransitionMap<WorkOrderState> = {
  CREATED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const INSPECTION_TRANSITIONS: TransitionMap<InspectionState> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED", "CANCELLED"],
  RESOLVED: [],
  CANCELLED: [],
};

export const NOTIFICATION_TRANSITIONS: TransitionMap<NotificationState> = {
  QUEUED: ["SENDING", "CANCELLED"],
  SENDING: [
    "SENT",
    "DELIVERY_FAILED",
    "BLOCKED",
    "QUOTA_LIMIT",
    "INVALID_RECIPIENT",
    "RATE_LIMITED",
  ],
  SENT: [],
  DELIVERY_FAILED: ["RETRYING", "CANCELLED"],
  BLOCKED: ["CANCELLED"],
  QUOTA_LIMIT: ["RETRYING", "CANCELLED"],
  INVALID_RECIPIENT: ["CANCELLED"],
  RATE_LIMITED: ["RETRYING", "CANCELLED"],
  RETRYING: ["SENDING", "CANCELLED"],
  CANCELLED: [],
};

export function canTransition<T extends string>(map: TransitionMap<T>, from: T, to: T): boolean {
  return map[from].includes(to);
}

export function assertTransition<T extends string>(map: TransitionMap<T>, from: T, to: T): void {
  if (!canTransition(map, from, to)) {
    throw new Error(`INVALID_STATE_TRANSITION: ${from} -> ${to}`);
  }
}
