import { thb, periodLabel, periodFullThai, thaiBahtText } from "@/lib/rcms-store";
import type { Customer, Payment } from "@/lib/rcms-types";
import { RCMS_LOGO_URL } from "@/lib/branding";

/** ใบเสร็จรับเงินรูปแบบงานสารบรรณราชการ ชย.ทอ. (ขนาดเดียวกับใบแจ้งหนี้ พอดี 1 หน้ากระดาษ และพอดีหน้าจอ) */
export function ReceiptSheet({
  payment,
  customer,
}: {
  payment: Payment;
  customer?: Customer | undefined;
}) {
  const payerName = customer?.name || payment.slip?.payerName || "ผู้ประกอบการ";
  const shopName = customer?.shop || "—";
  
  const division: "electric" | "water" =
    payment.division === "electric" || payment.division === "water"
      ? payment.division
      : payment.billNo?.endsWith("W") || payment.billNo?.includes("-W") || payment.billNo?.includes("ประปา") || payment.billId?.includes("water")
        ? "water"
        : customer?.waterMeter && !customer?.elecMeter
          ? "water"
          : "electric";

  const divisionLabel = division === "electric" ? "ค่ากระแสไฟฟ้า" : "ค่าน้ำประปา";
  const meter = division === "water" ? customer?.waterMeter : customer?.elecMeter;

  const periods =
    payment.periods && payment.periods.length > 0
      ? payment.periods
      : payment.billNo?.match(/^(\d{4})(\d{2})/)
        ? [`${payment.billNo.match(/^(\d{4})(\d{2})/)![1]}-${payment.billNo.match(/^(\d{4})(\d{2})/)![2]}`]
        : [""];

  const dateText = payment.paidDate
    ? periodFullThai(payment.paidDate)
    : payment.paidAt
      ? payment.paidAt
      : "—";

  const receiptNumber = payment.receiptNo
    ? payment.receiptNo.includes("เลขที่") || payment.receiptNo.includes("เล่มที่") || payment.receiptNo.startsWith("RC-")
      ? payment.receiptNo
      : `เลขที่ ${payment.receiptNo}`
    : payment.ref;

  return (
    <div
      className="receipt-sheet relative mx-auto w-full max-w-[740px] box-border break-inside-avoid overflow-hidden rounded-md border border-slate-300 bg-white p-3.5 sm:p-5 text-black shadow-sm print:m-0 print:max-w-none print:border print:border-slate-800 print:p-3.5 print:shadow-none"
      style={{
        fontFamily: "'TH SarabunPSK', 'THSarabunPSK', 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif",
      }}
    >
      {/* ลายน้ำตราสัญลักษณ์ ชย.ทอ. ตรงกลางเอกสาร */}
      <img
        src={RCMS_LOGO_URL}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto h-48 w-48 sm:h-56 sm:w-56 object-contain opacity-[0.035] print:opacity-[0.035]"
      />

      {/* ตราประทับ "รับชำระแล้ว / OFFICIAL RECEIPT" */}
      <div className="pointer-events-none absolute right-4 top-16 sm:right-10 sm:top-20 z-20 flex rotate-[-12deg] select-none flex-col items-center justify-center rounded-xl border-[4px] border-double border-emerald-700 bg-emerald-50/90 px-4 py-1.5 sm:px-7 sm:py-2.5 shadow-lg ring-2 ring-emerald-600/20 backdrop-blur-[1px] print:border-emerald-700 print:bg-transparent print:shadow-none print:ring-0">
        <span className="text-[18pt] sm:text-[20pt] font-black tracking-widest text-emerald-700 print:text-[18pt]">
          รับชำระแล้ว
        </span>
        <span className="text-[9.5pt] sm:text-[11pt] font-black tracking-[0.25em] text-emerald-800/90 print:text-[10pt]">
          OFFICIAL RECEIPT
        </span>
      </div>

      {/* 1. หัวกระดาษตามระเบียบงานสารบรรณ */}
      <div className="relative border-b-2 border-slate-800 pb-2 print:pb-1.5">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src={RCMS_LOGO_URL}
              alt="ตราสัญลักษณ์ ชย.ทอ."
              className="h-10 w-10 sm:h-12 sm:w-12 object-contain print:h-11 print:w-11 shrink-0"
            />
            <div>
              <p className="text-[15pt] sm:text-[16pt] font-bold leading-tight text-slate-900 print:text-[15pt]">
                กรมช่างโยธาทหารอากาศ
              </p>
              <p className="text-[12pt] sm:text-[13pt] leading-tight text-slate-700 print:text-[12.5pt]">
                ฝ่ายจัดเก็บรายได้ กองธุรการและกำลังพล
              </p>
              <p className="text-[11pt] sm:text-[12pt] leading-tight text-slate-600 print:text-[11.5pt]">
                โทร. 02-534-2557 · แฟกซ์ 02-523-9470
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right text-[12.5pt] sm:text-[13.5pt] leading-snug text-slate-800 print:text-[13pt] shrink-0">
            <p>
              <span className="font-semibold text-slate-900">เลขที่ใบเสร็จ:</span>{" "}
              <span className="font-bold text-slate-900">{receiptNumber}</span>
              {payment.bookNo && !payment.receiptNo?.includes("เล่มที่") && (
                <span className="ml-1 text-slate-700">(เล่มที่ {payment.bookNo})</span>
              )}
            </p>
            <p className="mt-0.5">
              <span className="text-slate-700">วันที่รับชำระ:</span>{" "}
              <span className="font-medium text-slate-900">{dateText}</span>
            </p>
            <p className="mt-0.5">
              <span className="text-slate-700">อ้างอิงใบแจ้งหนี้:</span>{" "}
              <span className="font-medium text-slate-900">{payment.billNo || payment.ref}</span>
            </p>
          </div>
        </div>

        {/* ชื่อเอกสารกึ่งกลาง ตามระเบียบงานสารบรรณ 18pt หนา */}
        <div className="mt-1 text-center print:mt-1">
          <h1 className="text-[16pt] sm:text-[18pt] font-bold tracking-wide text-slate-900 print:text-[17pt]">
            ใบเสร็จรับเงิน (RECEIPT)
          </h1>
        </div>
      </div>

      {/* 2. ข้อมูลผู้ใช้บริการ / ผู้ชำระเงิน */}
      <div className="relative mt-2 rounded-sm border border-slate-300 bg-slate-50/70 px-2.5 sm:px-3 py-1.5 text-[12.5pt] sm:text-[13.5pt] leading-tight text-slate-800 print:mt-1.5 print:border-slate-400 print:bg-transparent print:py-1 print:text-[13pt]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">ได้รับเงินจาก:</span>
            <span className="font-semibold text-slate-900 break-words">{payerName}</span>
          </div>
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">สถานที่ / ร้านค้า:</span>
            <span className="font-semibold text-slate-900 break-words">{shopName}</span>
          </div>
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">รหัสผู้ประกอบการ:</span>
            <span className="font-medium text-slate-900">{customer?.code ?? "—"}</span>
          </div>
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">
              {payment.division === "water" ? "เลขมาตรวัดน้ำ:" : "เลขมิเตอร์ไฟฟ้า:"}
            </span>
            <span className="font-medium text-slate-900">
              {meter || "—"}
            </span>
          </div>
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">ช่องทางชำระเงิน:</span>
            <span className="font-medium text-slate-900">
              {payment.method === "online" ? "โอนเงินเข้าบัญชี (Line OA / QR Pay)" : "ชำระ ณ เคาน์เตอร์การเงิน ชย.ทอ."}
            </span>
          </div>
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">ประเภทสาธารณูปโภค:</span>
            <span className="font-medium text-slate-900">{divisionLabel}</span>
          </div>
        </div>
      </div>

      {/* 3. ตารางแสดงรายการรับชำระเงิน */}
      <div className="relative mt-2 overflow-x-auto print:mt-1.5 print:overflow-visible">
        <table className="w-full min-w-[320px] border-collapse text-[12.5pt] sm:text-[13.5pt] print:text-[13pt]">
          <thead>
            <tr className="border-y-2 border-slate-800 bg-slate-100 font-bold text-slate-900 print:bg-slate-100">
              <th className="w-10 sm:w-12 border-x border-slate-300 px-1.5 sm:px-2 py-1 text-center print:border-slate-400">
                ลำดับ
              </th>
              <th className="border-x border-slate-300 px-2 sm:px-3 py-1 text-left print:border-slate-400">
                รายการรับชำระ
              </th>
              <th className="w-32 sm:w-40 border-x border-slate-300 px-2 sm:px-3 py-1 text-right print:border-slate-400">
                จำนวนเงิน (บาท)
              </th>
            </tr>
          </thead>
          <tbody>
            {(payment.periods?.length ? payment.periods : [""]).map((p, i) => {
              const billsPortion = payment.amount - (payment.reconnectFee || 0);
              const perPeriod = billsPortion / (payment.periods?.length || 1);
              return (
                <tr key={i} className="border-b border-slate-200 print:border-slate-300">
                  <td className="border-x border-slate-200 px-1.5 sm:px-2 py-0.5 text-center text-slate-700 print:border-slate-300">
                    {i + 1}
                  </td>
                  <td className="border-x border-slate-200 px-2 sm:px-3 py-0.5 font-medium text-slate-900 print:border-slate-300">
                    {divisionLabel}
                    {p ? ` ประจำงวด ${periodFullThai(p)} (งวด ${periodLabel(p)})` : ""}
                  </td>
                  <td className="border-x border-slate-200 px-2 sm:px-3 py-0.5 text-right font-medium text-slate-900 print:border-slate-300">
                    {thb(perPeriod)}
                  </td>
                </tr>
              );
            })}
            {payment.reconnectFee && payment.reconnectFee > 0 ? (
              <tr className="border-b border-slate-200 print:border-slate-300 bg-amber-50/30 print:bg-transparent">
                <td className="border-x border-slate-200 px-1.5 sm:px-2 py-0.5 text-center text-slate-700 print:border-slate-300">
                  {(payment.periods?.length || 1) + 1}
                </td>
                <td className="border-x border-slate-200 px-2 sm:px-3 py-0.5 font-medium text-slate-900 print:border-slate-300">
                  ค่าประสานมิเตอร์ / ค่าธรรมเนียมต่อระบบ ({divisionLabel})
                </td>
                <td className="border-x border-slate-200 px-2 sm:px-3 py-0.5 text-right font-medium text-slate-900 print:border-slate-300">
                  {thb(payment.reconnectFee)}
                </td>
              </tr>
            ) : null}
            {/* แถวยอดรวมทั้งสิ้น */}
            <tr className="border-y-2 border-slate-800 bg-slate-50 font-bold text-slate-900 print:bg-slate-50">
              <td
                colSpan={2}
                className="border-x border-slate-300 px-2 sm:px-3 py-1 text-left print:border-slate-400"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                  <span className="text-[13pt] sm:text-[14pt]">รวมรับเงินทั้งสิ้น (Total Received Amount)</span>
                  <span className="text-[11pt] sm:text-[12pt] font-normal text-slate-700 print:text-[11.5pt]">
                    ({thaiBahtText(payment.amount)})
                  </span>
                </div>
              </td>
              <td className="border-x border-slate-300 px-2 sm:px-3 py-1 text-right font-bold text-[13.5pt] sm:text-[15pt] text-slate-900 print:border-slate-400 print:text-[14pt] whitespace-nowrap">
                ฿{thb(payment.amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 4. รายละเอียดธุรกรรมและการตรวจสอบ */}
      <div className="relative mt-2 rounded-sm border border-slate-300 bg-slate-50/50 p-2 text-[11.5pt] sm:text-[12.5pt] leading-snug text-slate-800 print:mt-1.5 print:border-slate-400 print:bg-transparent print:p-1.5 print:text-[12pt]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <p className="font-bold text-slate-900">📌 หลักฐานและข้อมูลการรับชำระเงิน:</p>
            <p>• รหัสอ้างอิงธุรกรรม: <span className="font-semibold text-slate-900">{payment.ref}</span></p>
            {payment.method === "online" ? (
              <>
                <p>• ธนาคารผู้โอน: <span className="font-medium text-slate-900">{payment.slip?.bank || "ธนาคารพาณิชย์"}</span></p>
                <p>• ผลการตรวจสลิป: <span className="text-slate-800">{payment.ocrConfidence ? `ตรวจสอบด้วยระบบ OCR ค่าความเชื่อมั่น ${payment.ocrConfidence}%` : "ตรวจสอบและยืนยันยอดเงินแล้ว"}</span></p>
              </>
            ) : (
              <>
                <p>• หน่วยงานรับชำระ: <span className="font-medium text-slate-900">{payment.slip?.bank || "กองการเงิน กรมช่างโยธาทหารอากาศ"}</span></p>
                <p>• ผู้นำฝาก/ชำระ: <span className="text-slate-800">{payment.slip?.payerName || payerName}</span></p>
              </>
            )}
          </div>
          <div className="text-left sm:text-right flex flex-col justify-between gap-2 sm:gap-0">
            <p className="text-[11.5pt] sm:text-[12pt] text-slate-800">
              สถานะ: <span className="font-bold text-emerald-700">✓ ยืนยันเงินเข้าระบบ ชย.ทอ. เรียบร้อยแล้ว</span>
            </p>
            <p className="text-[10.5pt] sm:text-[11pt] text-slate-500">
              * ใบเสร็จรับเงินอิเล็กทรอนิกส์ ออกโดยระบบ RCMS กรมช่างโยธาทหารอากาศ
            </p>
          </div>
        </div>
      </div>

      {/* 5. ท้ายเอกสาร / ลายมือชื่อตามระเบียบงานสารบรรณ */}
      <div className="relative mt-2.5 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-2.5 text-[11.5pt] sm:text-[12.5pt] text-slate-800 print:mt-2 print:flex-row print:text-[12pt]">
        <div className="text-[10.5pt] sm:text-[11.5pt] text-slate-600 print:text-[11pt] text-center sm:text-left">
          <p>* เอกสารนี้จัดทำโดยระบบบริหารจัดเก็บรายได้ ชย.ทอ. (RCMS)</p>
        </div>
        <div className="text-center">
          <div className="w-40 sm:w-48 border-b border-dotted border-slate-600 pb-2.5 print:pb-2"></div>
          <p className="mt-1 font-medium text-slate-900">(เจ้าหน้าที่ฝ่ายจัดเก็บรายได้ ชย.ทอ.)</p>
          <p className="text-[10.5pt] sm:text-[11.5pt] text-slate-600">ผู้รับเงิน / ผู้มีอำนาจออกใบเสร็จ</p>
        </div>
      </div>
    </div>
  );
}
