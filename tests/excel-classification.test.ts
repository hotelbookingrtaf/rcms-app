import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { classifyWorkbook, parseReadingWorkbook } from "../src/lib/excel-import.ts";

function workbookFile(name: string, rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "20177");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new File([bytes], name);
}

test("classifies and parses utility reading schema", async () => {
  const file = workbookFile("utility.xlsx", [
    [
      "ชื่อผู้ประกอบการ",
      "รายการ",
      "หมายเลขมิเตอร์",
      "จดครั้งก่อน",
      "จดครั้งหลัง",
      "หน่วยที่ใช้",
      "จำนวนเงิน",
    ],
    ["ตัวอย่าง", "ร้าน 1", "M-001", 100, 125, 25, 250.5],
  ]);

  assert.equal(await classifyWorkbook(file), "UTILITY_READING_V1");
  const rows = await parseReadingWorkbook(file);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    name: "ตัวอย่าง",
    shop: "ร้าน 1",
    meter: "M-001",
    prev: 100,
    curr: 125,
    used: 25,
    amount: 250.5,
    sheet: "20177",
  });
});

test("keeps historical revenue ledger out of reading import", async () => {
  const file = workbookFile("revenue.xlsx", [
    ["รายชื่อ", "รายการ", "หมายเลขมิเตอร์", "ค่าน้ำประปา ก.ค.69", "ใบเสร็จรับเงิน", "ค้างชำระ"],
    ["ตัวอย่าง", "ร้าน 1", "M-001", 250.5, "12/69", 0],
  ]);

  assert.equal(await classifyWorkbook(file), "REVENUE_LEDGER_V1");
});

test("accurately routes electric vs water revenue ledger to respective division", async () => {
  const { parseRevenueWorkbook, parseArrearsWorkbook } = await import("../src/lib/excel-import.ts");

  // Electricity file
  const elecWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    elecWb,
    XLSX.utils.aoa_to_sheet([
      ["ใบเสร็จรับเงิน", "รายชื่อผู้ใช้ไฟฟ้า", "ร้านค้า", "หมายเลขมิเตอร์ไฟฟ้า", "จำนวนเงิน", "ประจำเดือน", "วันที่ชำระ"],
      ["REC-001", "นายสมชาย ใจดี", "ร้านกาแฟ", "50123-1", 1500, "2569-08", "2026-08-15"],
    ]),
    "ค่าไฟฟ้า",
  );
  const elecBytes = XLSX.write(elecWb, { type: "array", bookType: "xlsx" });
  const elecFile = new File([elecBytes], "electric_revenue.xlsx");

  const elecRows = await parseRevenueWorkbook(elecFile);
  assert.equal(elecRows.length, 1);
  assert.equal(elecRows[0]?.division, "electric");

  // Water file
  const waterWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    waterWb,
    XLSX.utils.aoa_to_sheet([
      ["เลขที่ใบเสร็จ", "ผู้ใช้น้ำ", "สถานที่", "เลขมาตรวัดน้ำ", "ยอดรับชำระ", "งวดบิล", "วันที่รับชำระ"],
      ["REC-002", "นางสมศรี มีสุข", "ร้านอาหาร", "20177-5", 800, "2569-08", "2026-08-15"],
    ]),
    "ค่าน้ำประปา",
  );
  const waterBytes = XLSX.write(waterWb, { type: "array", bookType: "xlsx" });
  const waterFile = new File([waterBytes], "water_revenue.xlsx");

  const waterRows = await parseRevenueWorkbook(waterFile);
  assert.equal(waterRows.length, 1);
  assert.equal(waterRows[0]?.division, "water");
});

test("parses complex multi-column monthly electricity ledger with all months", async () => {
  const { parseArrearsWorkbook } = await import("../src/lib/excel-import.ts");

  const wb = XLSX.utils.book_new();
  const rows = [
    // Header Row 1
    [
      "ลำดับ",
      "รายชื่อ",
      "",
      "สถานที่",
      "หมายเลขมิเตอร์",
      "ค่าไฟฟ้า ก.ค.69",
      "ใบเสร็จรับเงิน",
      "",
      "ยอดค้างชำระ",
      "วันที่รับชำระ",
      "ค่าไฟฟ้า ส.ค.69",
      "ใบเสร็จรับเงิน",
      "",
      "ยอดค้างชำระ",
      "วันที่รับชำระ",
      "ยอดค้างชำระรวม",
    ],
    // Header Row 2
    [
      "",
      "",
      "",
      "",
      "",
      "",
      "เลขที่",
      "เล่มที่",
      "",
      "",
      "",
      "เลขที่",
      "เล่มที่",
      "",
      "",
      "",
    ],
    // Data Row 1 (ก.ค. unpaid, ส.ค. paid)
    [
      "1",
      "พ.อ.อ.ธำรงศักดิ์",
      "เก่งแก้ว",
      "ร้านที่ 3 กรม ตอ.รอ.อย.",
      "919-099999-005",
      163.35,
      "", // no receipt
      "",
      "", // empty arrears column -> should use charge 163.35
      "",
      200.0,
      "REC-99", // has receipt -> paid!
      "1",
      "",
      "2026-08-20",
      163.35,
    ],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "919-099999");
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const file = new File([bytes], "ledger_multi_month.xlsx");

  const parsed = await parseArrearsWorkbook(file);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.name, "พ.อ.อ.ธำรงศักดิ์ เก่งแก้ว");
  assert.equal(parsed[0]?.division, "electric");
  assert.equal(parsed[0]?.monthlyArrears.length, 1);
  assert.equal(parsed[0]?.monthlyArrears[0]?.period, "2569-07");
  assert.equal(parsed[0]?.monthlyArrears[0]?.amount, 163.35);
  assert.equal(parsed[0]?.totalArrears, 163.35);

  assert.equal(parsed[0]?.monthlyPaid?.length, 1);
  assert.equal(parsed[0]?.monthlyPaid?.[0]?.period, "2569-08");
  assert.equal(parsed[0]?.monthlyPaid?.[0]?.receiptNo, "REC-99");
  assert.equal(parsed[0]?.monthlyPaid?.[0]?.bookNo, "1");
  assert.equal(parsed[0]?.monthlyPaid?.[0]?.paidDate, "2026-08-20");
  assert.equal(parsed[0]?.monthlyPaid?.[0]?.amount, 200.0);
});

test("accurately parses Thai date strings and propagates payment dates across multi-month receipts", async () => {
  const { parseArrearsWorkbook, parseThaiDateString, formatThaiDate } = await import("../src/lib/excel-import.ts");

  // Test individual Thai date string formats
  assert.equal(parseThaiDateString("14 พ.ค.69"), "2026-05-14");
  assert.equal(parseThaiDateString("27 เม.ย.69"), "2026-04-27");
  assert.equal(parseThaiDateString("2 มิ.ย.69"), "2026-06-02");
  assert.equal(parseThaiDateString("10 มิ.ย.69"), "2026-06-10");
  assert.equal(parseThaiDateString("29 พ.ค.69"), "2026-05-29");

  assert.equal(formatThaiDate("2026-05-14"), "14 พ.ค.69");
  assert.equal(formatThaiDate("2026-04-27"), "27 เม.ย.69");

  // Test multi-month Excel ledger with Thai date in column 'วันที่รับชำระ'
  const wb = XLSX.utils.book_new();
  const rows = [
    // Header Row 1
    [
      "ลำดับ",
      "รายชื่อ",
      "",
      "สถานที่",
      "หมายเลขมิเตอร์",
      "ค่าไฟฟ้า ก.พ.69",
      "ใบเสร็จรับเงิน",
      "",
      "ลดค้างชำระ ก.พ.69",
      "วันที่รับชำระ",
      "ค่าไฟฟ้า ม.ค.69",
      "ใบเสร็จรับเงิน",
      "",
      "ลดค้างชำระ ม.ค.69",
      "ยอดค้างชำระรวม",
    ],
    // Header Row 2
    [
      "",
      "",
      "",
      "",
      "",
      "",
      "เลขที่",
      "เล่มที่",
      "",
      "",
      "",
      "เลขที่",
      "เล่มที่",
      "",
      "",
    ],
    // Row 1: พ.อ.อ.รังสรรค์ (paid 14 พ.ค.69 for both ก.พ. and ม.ค.)
    [
      "1",
      "พ.อ.อ.รังสรรค์",
      "แสงสว่าง",
      "ร้านที่ 1",
      "919-099999-001",
      623.42,
      "09/69",
      "63",
      "",
      "14 พ.ค.69", // Thai date string!
      490.25,
      "09/69",
      "63",
      "จ่ายแล้ว",
      0,
    ],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "919-099999");
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const file = new File([bytes], "ledger_thai_dates.xlsx");

  const parsed = await parseArrearsWorkbook(file);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.name, "พ.อ.อ.รังสรรค์ แสงสว่าง");
  assert.equal(parsed[0]?.monthlyPaid?.length, 2);

  // Check ก.พ. 69
  const feb = parsed[0]?.monthlyPaid?.find((p) => p.period === "2569-02");
  assert.equal(feb?.amount, 623.42);
  assert.equal(feb?.receiptNo, "09/69");
  assert.equal(feb?.bookNo, "63");
  assert.equal(feb?.paidDate, "2026-05-14");

  // Check ม.ค. 69 (propagated from receipt 09/69 on 14 พ.ค.69)
  const jan = parsed[0]?.monthlyPaid?.find((p) => p.period === "2569-01");
  assert.equal(jan?.amount, 490.25);
  assert.equal(jan?.receiptNo, "09/69");
  assert.equal(jan?.bookNo, "63");
  assert.equal(jan?.paidDate, "2026-05-14");
});

test("completely parses all customer rows without skipping shops named 'ร้านค้า...' (e.g. 38944.xlsx)", async () => {
  const { parseArrearsWorkbook } = await import("../src/lib/excel-import.ts");

  const wb = XLSX.utils.book_new();
  const rows = [
    // Header Row 1
    ["", "รายชื่อ", "", "รายการ", "ค่าไฟฟ้า ก.ค.69"],
    // Header Row 2
    ["", "", "", "", ""],
    // Data Row 1 (ร.ต.กิตติ คลังกลาง, shop starts with 'ร้านค้า')
    ["1", "ร.ต.กิตติ", "คลังกลาง", "ร้านค้าสนามแบด เขต 3", 500.0],
    // Data Row 2 (พล.อ.ท.สมณะ เข็มทอง, shop starts with 'ร้านกาแฟ')
    ["2", "พล.อ.ท.สมณะ", "เข็มทอง", "ร้านกาแฟ ที่ สนามแบดมินตัน ทอ.", 1094.36],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "38944");
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const file = new File([bytes], "38944.xlsx");

  const parsed = await parseArrearsWorkbook(file);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.name, "ร.ต.กิตติ คลังกลาง");
  assert.equal(parsed[0]?.shop, "ร้านค้าสนามแบด เขต 3");
  assert.equal(parsed[0]?.monthlyArrears[0]?.amount, 500.0);

  assert.equal(parsed[1]?.name, "พล.อ.ท.สมณะ เข็มทอง");
  assert.equal(parsed[1]?.shop, "ร้านกาแฟ ที่ สนามแบดมินตัน ทอ.");
  assert.equal(parsed[1]?.monthlyArrears[0]?.amount, 1094.36);
});

test("evaluates monthly charge first, 'จ่ายแล้ว' as full payment, and blank/number as debt", async () => {
  const { parseArrearsWorkbook } = await import("../src/lib/excel-import.ts");

  const wb = XLSX.utils.book_new();
  const rows = [
    // Header
    [
      "ลำดับ",
      "รายชื่อ",
      "สถานที่",
      "ค่าไฟฟ้า มิ.ย.69",
      "ยอดค้าง มิ.ย.69",
      "ค่าไฟฟ้า ก.ค.69",
      "ยอดค้าง ก.ค.69",
      "ค่าไฟฟ้า ส.ค.69",
      "ยอดค้าง ส.ค.69",
    ],
    // Data Row 1:
    // - มิ.ย.69: charge 500, arrears "จ่ายแล้ว" -> paid 500
    // - ก.ค.69: charge 600, arrears "" (blank) -> arrears 600
    // - ส.ค.69: charge 700, arrears 200 (partial) -> arrears 200
    [
      "1",
      "นายทดสอบ ระบบดี",
      "ร้านทดสอบ",
      500.0,
      "จ่ายแล้ว",
      600.0,
      "",
      700.0,
      200.0,
    ],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "TEST-SHEET");
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const file = new File([bytes], "test_rules.xlsx");

  const parsed = await parseArrearsWorkbook(file);
  assert.equal(parsed.length, 1);
  const row = parsed[0]!;

  // 1. มิ.ย.69 -> Paid in full
  const junPaid = row.monthlyPaid?.find((p) => p.period === "2569-06");
  assert.equal(junPaid?.amount, 500.0);
  assert.equal(row.monthlyArrears.find((a) => a.period === "2569-06"), undefined);

  // 2. ก.ค.69 -> Blank arrears, so full 600 becomes debt
  const julArrears = row.monthlyArrears.find((a) => a.period === "2569-07");
  assert.equal(julArrears?.amount, 600.0);

  // 3. ส.ค.69 -> Numeric arrears 200 becomes debt
  const augArrears = row.monthlyArrears.find((a) => a.period === "2569-08");
  assert.equal(augArrears?.amount, 200.0);

  // Total Arrears = 600 + 200 = 800
  assert.equal(row.totalArrears, 800.0);
});

test("accurately records partial payment and keeps remaining arrears when receipt exists but arrears has balance (e.g. Row 22 ร.อ.หญิง ธนวรรณ)", async () => {
  const { parseArrearsWorkbook } = await import("../src/lib/excel-import.ts");

  const wb = XLSX.utils.book_new();
  const rows = [
    // Header Row 1
    [
      "ลำดับ",
      "รายชื่อ",
      "สถานที่",
      "หมายเลขมิเตอร์",
      "ค่าไฟฟ้า ก.พ.69",
      "ใบเสร็จรับเงิน",
      "",
      "ยอดค้างชำระ ก.พ.69",
      "วันที่รับชำระ",
      "ค่าไฟฟ้า ม.ค.69",
      "ใบเสร็จรับเงิน",
      "",
      "ยอดค้างชำระ ม.ค.69",
    ],
    // Header Row 2
    [
      "",
      "",
      "",
      "",
      "",
      "เลขที่",
      "เล่มที่",
      "",
      "",
      "",
      "เลขที่",
      "เล่มที่",
      "",
    ],
    // Data Row 22: ร.อ.หญิง ธนวรรณ (paid only 35.62, still owes 15965.88 and 14239.71)
    [
      "22",
      "ร.อ.หญิง ธนวรรณ อำนรรฆสรเดช",
      "ขายต้นไม้",
      "72793-059",
      16001.50,
      "64/69",
      "52",
      15965.88,
      "7 เม.ย.69",
      14275.33,
      "64/69",
      "52",
      14239.71,
    ],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "24655");
  const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const file = new File([bytes], "partial_arrears_row22.xlsx");

  const parsed = await parseArrearsWorkbook(file);
  assert.equal(parsed.length, 1);
  const r = parsed[0]!;

  // Check remaining debt (monthlyArrears)
  const febArrears = r.monthlyArrears.find((a) => a.period === "2569-02");
  assert.equal(febArrears?.amount, 15965.88);

  const janArrears = r.monthlyArrears.find((a) => a.period === "2569-01");
  assert.equal(janArrears?.amount, 14239.71);

  assert.equal(r.totalArrears, 30205.59);

  // Check partial payment records (monthlyPaid)
  const febPaid = r.monthlyPaid?.find((p) => p.period === "2569-02");
  assert.equal(febPaid?.amount, 35.62); // 16001.50 - 15965.88
  assert.equal(febPaid?.receiptNo, "64/69");
  assert.equal(febPaid?.bookNo, "52");
  assert.equal(febPaid?.paidDate, "2026-04-07");

  const janPaid = r.monthlyPaid?.find((p) => p.period === "2569-01");
  assert.equal(janPaid?.amount, 35.62); // 14275.33 - 14239.71
  assert.equal(janPaid?.receiptNo, "64/69");
  assert.equal(janPaid?.bookNo, "52");
  assert.equal(janPaid?.paidDate, "2026-04-07");
});





