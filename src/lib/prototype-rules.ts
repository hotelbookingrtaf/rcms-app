import type { Bill, Payment } from "./rcms-types";

export type SettlementValidation =
  | { ok: true; bills: Bill[] }
  | {
      ok: false;
      code:
        | "EMPTY_SELECTION"
        | "MISSING_BILL"
        | "CLOSED_BILL"
        | "CROSS_TENANT"
        | "CROSS_SERVICE"
        | "MISSING_REFERENCE"
        | "DUPLICATE_REFERENCE";
      message: string;
    };

const normalizedRef = (value: string) => value.trim().toUpperCase();

/** Prototype invariant guard; the production API must enforce this in one DB transaction. */
export function validateSettlementSelection(
  allBills: Bill[],
  payments: Payment[],
  billIds: string[],
  reference: string,
): SettlementValidation {
  const uniqueIds = [...new Set(billIds)];
  if (!uniqueIds.length)
    return { ok: false, code: "EMPTY_SELECTION", message: "กรุณาเลือกใบแจ้งหนี้" };

  const selected = uniqueIds.map((id) => allBills.find((bill) => bill.id === id));
  if (selected.some((bill) => !bill))
    return { ok: false, code: "MISSING_BILL", message: "ไม่พบใบแจ้งหนี้บางรายการ" };

  const target = selected as Bill[];
  if (target.some((bill) => bill.status === "paid" || bill.status === "cancelled"))
    return { ok: false, code: "CLOSED_BILL", message: "มีใบแจ้งหนี้ที่ไม่อยู่ในสถานะรอชำระ" };

  if (new Set(target.map((bill) => bill.customerId)).size !== 1)
    return { ok: false, code: "CROSS_TENANT", message: "ห้ามรับชำระข้ามผู้ประกอบการในรายการเดียว" };

  if (new Set(target.map((bill) => bill.serviceAccountId)).size !== 1)
    return {
      ok: false,
      code: "CROSS_SERVICE",
      message: "กรุณาแยกรับชำระไฟฟ้าและน้ำเป็นคนละรายการ",
    };

  const ref = normalizedRef(reference);
  if (!ref) return { ok: false, code: "MISSING_REFERENCE", message: "กรุณาระบุเลขอ้างอิง" };
  if (
    payments.some((payment) => payment.status !== "rejected" && normalizedRef(payment.ref) === ref)
  )
    return { ok: false, code: "DUPLICATE_REFERENCE", message: "เลขอ้างอิงนี้ถูกบันทึกแล้ว" };

  return { ok: true, bills: target };
}
