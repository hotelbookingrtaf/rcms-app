import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateOldestFullInvoiceFirst,
  electricitySiteCode,
  invoiceCoverage,
  shouldCancelPendingDisconnection,
  validateReading,
} from "../src/domain/v13/rules.ts";
import {
  assertTransition,
  INVOICE_TRANSITIONS,
  SERVICE_ACCOUNT_TRANSITIONS,
} from "../src/domain/v13/states.ts";
import type { Invoice } from "../src/domain/v13/types.ts";

const invoice = (
  invoiceId: string,
  serviceAccountId: string,
  period: string,
  amountDue: number,
): Invoice => ({
  invoiceId,
  invoiceNumber: invoiceId,
  tenantId: "TEN-001",
  siteId: "SITE-001",
  serviceAccountId,
  billingPeriodId: period,
  sourceDataVersion: "v1",
  issueDate: "2026-09-01",
  dueDate: "2026-09-15",
  amountDue,
  status: "ISSUED",
  snapshot: {},
});

test("reading delta is validation evidence and does not overwrite source usage", () => {
  const result = validateReading({
    serviceType: "ELECTRICITY",
    meterId: "M-001",
    previousReading: 100,
    currentReading: 120,
    usageUnits: 18,
    amountDue: 200,
  });
  assert.equal(
    result.some((item) => item.code === "USAGE_MISMATCH" && item.risk === "RED"),
    true,
  );
});

test("zero usage creates inspection signal only for the same meter twice", () => {
  const sameMeter = validateReading({
    serviceType: "WATER",
    meterId: "WM-001",
    previousReading: 50,
    currentReading: 50,
    usageUnits: 0,
    amountDue: 25,
    previousPeriodReading: { meterId: "WM-001", usageUnits: 0 },
  });
  const replacedMeter = validateReading({
    serviceType: "WATER",
    meterId: "WM-002",
    previousReading: 0,
    currentReading: 0,
    usageUnits: 0,
    amountDue: 25,
    previousPeriodReading: { meterId: "WM-001", usageUnits: 0 },
  });
  assert.equal(
    sameMeter.some((item) => item.code === "ZERO_USAGE_2_MONTHS"),
    true,
  );
  assert.equal(
    replacedMeter.some((item) => item.code === "ZERO_USAGE_2_MONTHS"),
    false,
  );
});

test("oldest-first allocation never crosses service and holds remainder before the next invoice", () => {
  const result = allocateOldestFullInvoiceFirst({
    paymentId: "PAY-001",
    paymentAmount: 1_500,
    serviceAccountId: "SA-E",
    invoices: [
      invoice("INV-JUL", "SA-E", "2026-07", 1_000),
      invoice("INV-AUG", "SA-E", "2026-08", 800),
      invoice("INV-W", "SA-W", "2026-06", 100),
    ],
    createdAt: "2026-09-04T10:00:00Z",
  });
  assert.deepEqual(result.fullySettledInvoiceIds, ["INV-JUL"]);
  assert.equal(result.shortPaymentInvoiceId, "INV-AUG");
  assert.equal(result.unallocatedAmount, 500);
  assert.equal(
    result.allocations.some((item) => item.invoiceId === "INV-W"),
    false,
  );
});

test("multiple targeted short payments can accumulate without PARTIALLY_PAID state", () => {
  const first = allocateOldestFullInvoiceFirst({
    paymentId: "PAY-001",
    paymentAmount: 700,
    serviceAccountId: "SA-E",
    targetInvoiceIds: ["INV-001"],
    accumulateShortPayment: true,
    invoices: [invoice("INV-001", "SA-E", "2026-08", 1_000)],
    createdAt: "2026-09-01T10:00:00Z",
  });
  const second = allocateOldestFullInvoiceFirst({
    paymentId: "PAY-002",
    paymentAmount: 300,
    serviceAccountId: "SA-E",
    targetInvoiceIds: ["INV-001"],
    accumulateShortPayment: true,
    existingAllocated: { "INV-001": 700 },
    invoices: [invoice("INV-001", "SA-E", "2026-08", 1_000)],
    createdAt: "2026-09-02T10:00:00Z",
  });
  assert.equal(first.allocations[0]?.amount, 700);
  assert.deepEqual(second.fullySettledInvoiceIds, ["INV-001"]);
  assert.equal(invoiceCoverage(1_000, 700).hasShortPayment, true);
  assert.equal(invoiceCoverage(1_000, 1_000).isPaid, true);
});

test("state machine rejects shortcuts", () => {
  assertTransition(INVOICE_TRANSITIONS, "DRAFT", "VALIDATED");
  assert.throws(
    () => assertTransition(INVOICE_TRANSITIONS, "DRAFT", "PAID"),
    /INVALID_STATE_TRANSITION/,
  );
  assert.throws(
    () => assertTransition(SERVICE_ACCOUNT_TRANSITIONS, "SUSPENDED", "ACTIVE"),
    /INVALID_STATE_TRANSITION/,
  );
});

test("service operations and identity helpers follow v1.3 rules", () => {
  assert.equal(shouldCancelPendingDisconnection(0), true);
  assert.equal(shouldCancelPendingDisconnection(0.01), false);
  assert.equal(electricitySiteCode("100531-002"), "EM100531-002");
  assert.throws(() => electricitySiteCode("BAD"), /INVALID_ELECTRICITY_METER_PATTERN/);
});
