import assert from "node:assert/strict";
import test from "node:test";
import {
  findMatchingCustomer,
  normalizeMeterNo,
  normalizeThaiName,
} from "../src/lib/customer-matching.ts";
import type { Customer } from "../src/lib/rcms-types.ts";

const mockCustomers: Customer[] = [
  {
    id: "C-101",
    code: "C-101",
    name: "พล.อ.อ.สมชาย วงศ์สวัสดิ์",
    shop: "ร้านกาแฟสวัสดิการ",
    phone: "081-111-2222",
    lineId: "somchai1",
    status: "active",
    elecMeter: "72793-001",
    waterMeter: "50365-001",
    siteId: "SITE-001",
    siteCode: "CHY-001",
    depositPaid: 5000,
    serviceStates: { electric: "active", water: "active" },
    createdAt: "2026-01-01",
  },
  {
    id: "C-102",
    code: "C-102",
    name: "ร.อ.หญิง ธนวรรณ พุ่มพวง",
    shop: "ร้านอาหารตามสั่งป้าเพ็ญ",
    phone: "082-333-4444",
    lineId: "thanawan",
    status: "active",
    elecMeter: "20177-055",
    waterMeter: "WM-055",
    siteId: "SITE-002",
    siteCode: "CHY-002",
    depositPaid: 5000,
    serviceStates: { electric: "active", water: "active" },
    createdAt: "2026-01-01",
  },
  {
    id: "C-103",
    code: "C-103",
    name: "ผู้ประกอบการ C-103",
    shop: "ร้านค้า",
    phone: "",
    lineId: "",
    status: "active",
    elecMeter: "38944-012",
    waterMeter: "",
    siteId: "SITE-003",
    siteCode: "CHY-003",
    depositPaid: 5000,
    serviceStates: { electric: "active", water: "active" },
    createdAt: "2026-01-01",
  },
];

test("normalizeThaiName correctly strips military ranks, titles and spaces", () => {
  assert.equal(normalizeThaiName("พล.อ.อ. สมชาย วงศ์สวัสดิ์"), "สมชายวงศ์สวัสดิ์");
  assert.equal(normalizeThaiName("ร.อ.หญิง ธนวรรณ"), "ธนวรรณ");
  assert.equal(normalizeThaiName("นาย วิชัย การค้า"), "วิชัยการค้า");
  assert.equal(normalizeThaiName("นางสาว สุภาวดี"), "สุภาวดี");
  assert.equal(normalizeThaiName("ว่าที่ ร.ต. เอกพล"), "เอกพล");
});

test("findMatchingCustomer matches by exact and normalized meter number", () => {
  const matchElec = findMatchingCustomer(mockCustomers, "72793-001", "", "", "electric");
  assert.equal(matchElec?.id, "C-101");

  const matchNorm = findMatchingCustomer(mockCustomers, "72793001", "", "", "electric");
  assert.equal(matchNorm?.id, "C-101");

  const matchWater = findMatchingCustomer(mockCustomers, "WM-055", "", "", "water");
  assert.equal(matchWater?.id, "C-102");
});

test("findMatchingCustomer matches by Thai name without creating duplicates", () => {
  // Matching with different rank format or no rank
  const matchByName = findMatchingCustomer(
    mockCustomers,
    "",
    "สมชาย วงศ์สวัสดิ์",
    "ร้านกาแฟสวัสดิการ",
    "electric",
  );
  assert.equal(matchByName?.id, "C-101");

  const matchByNameOnly = findMatchingCustomer(
    mockCustomers,
    "",
    "ธนวรรณ พุ่มพวง",
    "",
    "electric",
  );
  assert.equal(matchByNameOnly?.id, "C-102");
});

test("Deduplication & Enrichment: updates existing customer if already in database", () => {
  const currentCustomers = [...mockCustomers];
  const newImportRow = {
    meter: "38944-012",
    name: "นาย มานพ แสงทอง",
    shop: "ร้านข้าวแกงป้ามานพ",
    division: "electric" as const,
  };

  const matched = findMatchingCustomer(
    currentCustomers,
    newImportRow.meter,
    newImportRow.name,
    newImportRow.shop,
    newImportRow.division,
  );
  assert.ok(matched);
  assert.equal(matched.id, "C-103");

  // Enrich existing customer
  if (matched) {
    if (newImportRow.name && matched.name.startsWith("ผู้ประกอบการ C-")) {
      matched.name = newImportRow.name;
    }
    if (newImportRow.shop && (matched.shop === "ร้านค้า" || matched.shop === "—")) {
      matched.shop = newImportRow.shop;
    }
  }

  assert.equal(matched.name, "นาย มานพ แสงทอง");
  assert.equal(matched.shop, "ร้านข้าวแกงป้ามานพ");
  assert.equal(currentCustomers.length, 3); // No duplicates created
});

test("Auto-creation: adds new customer profile when entrepreneur does not exist", () => {
  const currentCustomers = [...mockCustomers];
  const newRow = {
    meter: "72793-099",
    name: "นาย สมศักดิ์ รักดี",
    shop: "ร้านสะดวกซื้อ 24 ชม.",
    division: "electric" as const,
  };

  let matched = findMatchingCustomer(
    currentCustomers,
    newRow.meter,
    newRow.name,
    newRow.shop,
    newRow.division,
  );
  assert.equal(matched, undefined);

  // New customer creation
  const newCode = `C-${101 + currentCustomers.length}`;
  const newCust: Customer = {
    id: newCode,
    code: newCode,
    name: newRow.name || newRow.shop || `ผู้ประกอบการ ${newCode}`,
    shop: newRow.shop || "ร้านค้า",
    phone: "",
    lineId: "",
    status: "active",
    serviceStates: { electric: "active", water: "active" },
    siteId: `SITE-${String(currentCustomers.length + 1).padStart(3, "0")}`,
    siteCode: `CHY-${String(currentCustomers.length + 1).padStart(3, "0")}`,
    depositPaid: 5000,
    createdAt: "2026-09-15",
    elecMeter: newRow.meter,
  };
  currentCustomers.push(newCust);

  assert.equal(currentCustomers.length, 4);
  assert.equal(currentCustomers[3]?.code, "C-104");
  assert.equal(currentCustomers[3]?.name, "นาย สมศักดิ์ รักดี");
  assert.equal(currentCustomers[3]?.shop, "ร้านสะดวกซื้อ 24 ชม.");
  assert.equal(currentCustomers[3]?.elecMeter, "72793-099");
});
