import { useMemo } from "react";
import { thb, periodLabel, calculateElectricBill } from "@/lib/rcms-store";
import type { Customer, Division, Reading, Settings } from "@/lib/rcms-types";

export interface ReadingSheetProps {
  division: Division;
  period: string;
  items: Reading[];
  customers: Customer[];
  settings: Settings;
  seriesFilter?: string | undefined;
  itemsPerPage?: number | undefined;
}

function getUsagePeriodDateRange(periodStr: string): string {
  if (!periodStr) return "1 ก.ค.69 - 31 ก.ค.69";
  const parts = periodStr.split("-");
  const yearNum = Number(parts[0]) || 2026;
  const monthNum = Number(parts[1]) || 8;

  let prevMonth = monthNum - 1;
  let prevYear = yearNum < 2500 ? yearNum + 543 : yearNum;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const thaiShortMonths = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];

  const mName = thaiShortMonths[prevMonth - 1] || "ก.ค.";
  const yy = String(prevYear).slice(-2);

  let lastDay = 30;
  if ([1, 3, 5, 7, 8, 10, 12].includes(prevMonth)) {
    lastDay = 31;
  } else if (prevMonth === 2) {
    const ceYear = prevYear > 2400 ? prevYear - 543 : prevYear;
    const isLeap = (ceYear % 4 === 0 && ceYear % 100 !== 0) || (ceYear % 400 === 0);
    lastDay = isLeap ? 29 : 28;
  }

  return `1 ${mName}${yy} - ${lastDay} ${mName}${yy}`;
}

/**
 * แบบฟอร์มพิมพ์รายงานคำนวณหน่วยใช้และยอดเรียกเก็บ (ขนาด A4 แนวนอน - Landscape)
 * ตามรูปแบบใบคำนวณราชการ กองช่างโยธา กรมช่างโยธาทหารอากาศ
 */
export function ReadingSheet({
  division,
  period,
  items,
  customers,
  settings,
  seriesFilter,
  itemsPerPage = 26,
}: ReadingSheetProps) {
  const dateRangeStr = useMemo(() => getUsagePeriodDateRange(period), [period]);

  // คำนวณยอดรวมทั้งสิ้นของรายการทั้งหมด
  const grandTotals = useMemo(() => {
    let totalUnits = 0;
    let totalBase = 0;
    let totalFt = 0;
    let totalSvc = 0;
    let totalSubtotal = 0;
    let totalVat = 0;
    let totalAmountDue = 0;

    items.forEach((r) => {
      const usage = Math.max(0, r.curr - r.prev);
      totalUnits += usage;

      if (r.division === "electric") {
        const calc = calculateElectricBill(usage, settings);
        totalBase += calc.baseEnergy;
        totalFt += calc.ftAmount;
        totalSvc += calc.serviceFee;
        totalSubtotal += calc.subtotal;
        totalVat += calc.vatAmount;
        totalAmountDue += calc.totalDue;
      } else {
        const svc = settings.serviceFee ?? 33.29;
        const rate = settings.waterRate ?? 9.5;
        const base = usage > 0 ? usage * rate : svc;
        const vat = base * 0.07;
        totalBase += base;
        totalSvc += svc;
        totalSubtotal += base;
        totalVat += vat;
        totalAmountDue += base + vat;
      }
    });

    return {
      totalUnits,
      totalBase,
      totalFt,
      totalSvc,
      totalSubtotal,
      totalVat,
      totalAmountDue,
    };
  }, [items, settings]);

  // แบ่งรายการเป็นหน้าๆ ละ 26 รายการ
  const pages = useMemo(() => {
    const chunkList: Reading[][] = [];
    if (items.length === 0) return [[]];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      chunkList.push(items.slice(i, i + itemsPerPage));
    }
    return chunkList;
  }, [items, itemsPerPage]);

  const ftRateStr = settings.ft !== undefined ? settings.ft.toFixed(4) : "0.1623";

  return (
    <div
      className="reading-report-container text-black"
      style={{
        fontFamily: "'TH SarabunPSK', 'THSarabunPSK', 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif",
      }}
    >
      {pages.map((pageItems, pageIdx) => {
        const pageOffset = pageIdx * itemsPerPage;
        const isLastPage = pageIdx === pages.length - 1;

        // คำนวณผลรวมเฉพาะหน้านี้
        let pageUnits = 0;
        let pageBase = 0;
        let pageFt = 0;
        let pageSvc = 0;
        let pageSubtotal = 0;
        let pageVat = 0;
        let pageTotal = 0;

        return (
          <div
            key={`page-${pageIdx}`}
            className="reading-report-sheet bg-white p-5 mb-6 text-black print:p-0 print:m-0 print:bg-white"
            style={{
              fontFamily: "'TH SarabunPSK', 'THSarabunPSK', 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif",
            }}
          >
            {/* 1. ส่วนหัวรายงาน (Header Title) - ตามระเบียบงานสารบรรณ */}
            <div className="text-center font-bold text-[15pt] leading-tight mb-1 tracking-wide text-black">
              รายการคำนวณ{division === "electric" ? "ค่าไฟฟ้า" : "ค่าน้ำประปา"} ประจำเดือน {periodLabel(period)}{" "}
              {seriesFilter && seriesFilter !== "all" ? `(${seriesFilter})` : ""}
            </div>

            {/* 2. แถบข้อมูลประกอบ (Date range, FT, VAT) */}
            <div className="flex items-center justify-between text-[12.5pt] mb-1.5 px-0.5 text-black">
              <div className="w-1/3 text-left">
                ระหว่างวันที่ <span className="ml-3 font-medium">{dateRangeStr}</span>
              </div>
              <div className="w-1/3 text-center">
                {division === "electric" && (
                  <>
                    FT= <span className="ml-2 font-medium">{ftRateStr}</span> บาท/หน่วย
                  </>
                )}
              </div>
              <div className="w-1/3 text-right">
                ภาษีมูลค่าเพิ่มร้อยละ <span className="ml-3 font-medium">{settings.vatPercent ?? 7}</span>
              </div>
            </div>

            {/* 3. ตาราง 14 คอลัมน์รูปแบบ ทอ. (พอดี 26 แถว + แถวสรุปใน 1 หน้า A4 แนวนอน) */}
            <table className="w-full border-collapse text-[11pt] text-black">
              <thead>
                <tr className="border-t border-b border-black text-center font-bold leading-tight">
                  <th className="py-1 px-0.5 w-[36px] text-center font-bold">ลำดับ</th>
                  <th className="py-1 px-0.5 min-w-[140px] text-left font-bold">
                    {division === "electric" ? "ผู้ใช้ไฟฟ้า" : "ผู้ใช้น้ำประปา"}
                  </th>
                  <th className="py-1 px-0.5 min-w-[180px] text-left font-bold">สถานที่</th>
                  <th className="py-1 px-0.5 min-w-[95px] text-center font-bold">
                    หมายเลข
                    <br />
                    มิเตอร์ ฯ
                  </th>
                  <th className="py-1 px-0.5 w-[50px] text-center font-bold">
                    ประเภท
                    <br />
                    มิเตอร์
                  </th>
                  <th className="py-1 px-0.5 min-w-[60px] text-right font-bold">
                    จดครั้ง
                    <br />
                    ก่อน
                  </th>
                  <th className="py-1 px-0.5 min-w-[60px] text-right font-bold">
                    จดครั้ง
                    <br />
                    หลัง
                  </th>
                  <th className="py-1 px-0.5 min-w-[68px] text-right font-bold">
                    หน่วย
                    <br />
                    ที่ใช้
                  </th>
                  <th className="py-1 px-0.5 min-w-[68px] text-right font-bold">
                    เป็นเงิน
                    <br />
                    บาท
                  </th>
                  <th className="py-1 px-0.5 min-w-[58px] text-right font-bold">
                    ค่า FT
                    <br />
                    บาท
                  </th>
                  <th className="py-1 px-0.5 min-w-[62px] text-right font-bold">
                    ค่าบริการ
                    <br />
                    บาท
                  </th>
                  <th className="py-1 px-0.5 min-w-[72px] text-right font-bold">
                    รวมเป็นเงิน
                    <br />
                    บาท
                  </th>
                  <th className="py-1 px-0.5 min-w-[58px] text-right font-bold">
                    ภาษี
                    <br />
                    บาท
                  </th>
                  <th className="py-1 px-0.5 min-w-[80px] text-right font-bold">
                    จำนวนเงิน
                    <br />
                    ที่ต้องชำระ
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r, idx) => {
                  const rowNumber = pageOffset + idx + 1;
                  const c = customers.find((x) => x.id === r.customerId);
                  const meterNo = r.division === "electric" ? c?.elecMeter ?? "—" : c?.waterMeter ?? "—";
                  const usage = Math.max(0, r.curr - r.prev);

                  let baseEnergy = 0;
                  let ftAmount = 0;
                  let serviceFee = settings.serviceFee ?? 33.29;
                  let subtotal = 0;
                  let vatAmount = 0;
                  let totalDue = 0;

                  if (r.division === "electric") {
                    const calc = calculateElectricBill(usage, settings);
                    baseEnergy = calc.baseEnergy;
                    ftAmount = calc.ftAmount;
                    serviceFee = calc.serviceFee;
                    subtotal = calc.subtotal;
                    vatAmount = calc.vatAmount;
                    totalDue = calc.totalDue;
                  } else {
                    const rate = settings.waterRate ?? 9.5;
                    const base = usage > 0 ? usage * rate : serviceFee;
                    const vat = base * 0.07;
                    baseEnergy = base;
                    ftAmount = 0;
                    subtotal = base;
                    vatAmount = vat;
                    totalDue = base + vat;
                  }

                  pageUnits += usage;
                  pageBase += baseEnergy;
                  pageFt += ftAmount;
                  pageSvc += serviceFee;
                  pageSubtotal += subtotal;
                  pageVat += vatAmount;
                  pageTotal += totalDue;

                  return (
                    <tr key={r.id} className="text-[11pt] leading-[1.15] hover:bg-slate-50">
                      <td className="py-[1px] px-0.5 text-center">{rowNumber}</td>
                      <td className="py-[1px] px-0.5 text-left truncate max-w-[160px]">{c?.name ?? "ผู้ประกอบการ"}</td>
                      <td className="py-[1px] px-0.5 text-left truncate max-w-[200px]">{c?.shop ?? "—"}</td>
                      <td className="py-[1px] px-0.5 text-center">{meterNo}</td>
                      <td className="py-[1px] px-0.5 text-center">2</td>
                      <td className="py-[1px] px-0.5 text-right">{r.prev}</td>
                      <td className="py-[1px] px-0.5 text-right">{r.curr}</td>
                      <td className="py-[1px] px-0.5 text-right font-medium">
                        {usage.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-[1px] px-0.5 text-right">{thb(baseEnergy)}</td>
                      <td className="py-[1px] px-0.5 text-right">
                        {r.division === "electric" ? thb(ftAmount) : "—"}
                      </td>
                      <td className="py-[1px] px-0.5 text-right">{thb(serviceFee)}</td>
                      <td className="py-[1px] px-0.5 text-right">{thb(subtotal)}</td>
                      <td className="py-[1px] px-0.5 text-right">{thb(vatAmount)}</td>
                      <td className="py-[1px] px-0.5 text-right font-bold">{thb(totalDue)}</td>
                    </tr>
                  );
                })}

                {/* แถวสรุปผลรวมหน่วยประจำหน้า (อยู่ใต้คอลัมน์หน่วยที่ใช้ตรงตามแบบฟอร์ม ทอ.) */}
                <tr className="font-bold text-[11.5pt] leading-tight">
                  <td colSpan={7} className="py-1.5 px-0.5 text-left font-normal text-slate-500 text-[10.5pt]">
                    หน้า {pageIdx + 1} / {pages.length}
                  </td>
                  <td className="py-1.5 px-0.5 text-right font-bold">
                    {pageUnits.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={6} className="py-1.5 px-0.5"></td>
                </tr>

                {/* เมื่อเป็นหน้าสุดท้าย แสดงเส้นประและยอดรวมเงินทั้งสิ้น */}
                {isLastPage && (
                  <>
                    <tr>
                      <td colSpan={14} className="py-0.5 px-0">
                        <div className="border-t border-dotted border-black w-full my-0.5"></div>
                      </td>
                    </tr>
                    <tr className="font-bold text-[12.5pt] leading-tight">
                      <td colSpan={12} className="py-1 px-1 text-right pr-6 font-bold">
                        รวมเป็นเงิน
                      </td>
                      <td colSpan={2} className="py-1 px-0.5 text-right font-extrabold text-[13.5pt] text-black">
                        {thb(grandTotals.totalAmountDue)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
