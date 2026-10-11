import assert from "node:assert/strict";
import test from "node:test";
import { canPerform } from "../src/lib/permissions.ts";
import { validateSettlementSelection } from "../src/lib/prototype-rules.ts";
import type { Bill, Payment } from "../src/lib/rcms-types.ts";

const bill = (id: string, customerId: string, serviceAccountId: string): Bill => ({
  id,
  no: id,
  customerId,
  serviceAccountId,
  period: "2026-09",
  type: "electric",
  sourceDataVersion: "v1",
  lines: [],
  total: 100,
  issuedAt: "now",
  dueAt: "later",
  status: "unpaid",
});

test("auditor and entrepreneur cannot mutate financial state", () => {
  assert.equal(canPerform("auditor", "payment.verify"), false);
  assert.equal(canPerform("auditor", "billing.issue"), false);
  assert.equal(canPerform("entrepreneur", "payment.record"), false);
});

test("settlement cannot cross tenant or service account", () => {
  const b1 = bill("B1", "C1", "SA-E1");
  assert.equal(
    validateSettlementSelection([b1, bill("B2", "C2", "SA-E2")], [], ["B1", "B2"], "REF").ok,
    false,
  );
  assert.equal(
    validateSettlementSelection([b1, bill("B3", "C1", "SA-W1")], [], ["B1", "B3"], "REF").ok,
    false,
  );
});

test("active payment reference must be unique", () => {
  const b1 = bill("B1", "C1", "SA-E1");
  const payment = { ref: " ref-1 ", status: "pending" } as Payment;
  const result = validateSettlementSelection([b1], [payment], ["B1"], "REF-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "DUPLICATE_REFERENCE");
});
