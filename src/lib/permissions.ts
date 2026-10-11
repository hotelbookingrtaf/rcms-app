import type { Role } from "./rcms-types";

export type RcmsAction =
  | "billing.issue"
  | "billing.send"
  | "payment.record"
  | "payment.verify"
  | "service.request"
  | "service.decide"
  | "work_order.complete"
  | "user.manage"
  | "settings.manage";

const ACTION_ACCESS: Record<RcmsAction, readonly Role[]> = {
  "billing.issue": ["admin", "supervisor", "revenue_officer"],
  "billing.send": ["admin", "revenue_officer"],
  "payment.record": ["admin", "revenue_officer"],
  "payment.verify": ["admin", "supervisor", "revenue_officer"],
  "service.request": ["admin", "revenue_officer"],
  "service.decide": ["admin", "supervisor"],
  "work_order.complete": ["admin", "utility_field_officer"],
  "user.manage": ["admin"],
  "settings.manage": ["admin"],
};

/** UI guard only. Production must repeat the same authorization on the server. */
export function canPerform(role: Role, action: RcmsAction) {
  return ACTION_ACCESS[action].includes(role);
}
