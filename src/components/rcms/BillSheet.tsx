import { thb, periodLabel, periodFullThai, thaiBahtText, useRcms } from "@/lib/rcms-store";
import type { Bill, Customer } from "@/lib/rcms-types";
import { RCMS_LOGO_URL } from "@/lib/branding";

export interface SheetArrears {
  period: string;
  amount: number;
}

/** ใบแจ้งหนี้รูปแบบงานสารบรรณราชการ ชย.ทอ. (ขนาด A4 พอดี 1 หน้า และพอดีหน้าจอ) */
export function BillSheet({
  bill,
  customer,
  arrears,
  reconnectFee,
  bankInfo,
}: {
  bill: Bill;
  customer?: Customer | undefined;
  arrears: SheetArrears[];
  reconnectFee: number;
  bankInfo?: {
    bankName?: string;
    bankAccountNo?: string;
    bankAccountName?: string;
    paymentHours?: string;
    contactPhone?: string;
    contactFax?: string;
    lineContact?: string;
    qrCodeUrl?: string;
  };
}) {
  const { settings } = useRcms();
  const info = bankInfo ?? settings;

  const bankName = info?.bankName || "ธนาคารทหารไทยธนชาต";
  const accountNo = info?.bankAccountNo || "057-1-07053-1";
  const accountName = info?.bankAccountName || "เงินนอกงบประมาณ กรมช่างโยธาทหารอากาศ";
  const paymentHours = info?.paymentHours || "รับชำระเงินวันทำการ ตั้งแต่เวลา 0800–1500 น.";
  const phone = info?.contactPhone || "02-534-2557";
  const fax = info?.contactFax || "02-523-9470";
  const lineContact = info?.lineContact || "LINE ฝ่ายจัดเก็บรายได้ ชย.ทอ. · ID LINE: rddce2020";
  const qrCodeUrl = info?.qrCodeUrl;

  const title =
    bill.type === "water"
      ? "ใบแจ้งค่าน้ำประปา"
      : bill.type === "electric"
        ? "ใบแจ้งค่ากระแสไฟฟ้า"
        : "ใบแจ้งค่าสาธารณูปโภค";

  const meter = bill.type === "water" ? customer?.waterMeter : customer?.elecMeter;
  const arrearsTotal = arrears.reduce((s, a) => s + a.amount, 0);
  const grandTotal = bill.total + arrearsTotal;

  return (
    <div
      className="bill-sheet relative mx-auto w-full max-w-[740px] box-border break-inside-avoid overflow-hidden rounded-md border border-slate-300 bg-white p-3.5 sm:p-5 text-black shadow-sm print:m-0 print:max-w-none print:border print:border-slate-800 print:p-3.5 print:shadow-none"
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

      {/* ตราประทับ "ชำระแล้ว" ขนาดใหญ่ สีแดงเด่นชัดเมื่อสถานะชำระแล้ว */}
      {bill.status === "paid" && (
        <div className="pointer-events-none absolute right-4 top-16 sm:right-10 sm:top-20 z-20 flex rotate-[-14deg] select-none flex-col items-center justify-center rounded-xl border-[4px] sm:border-[5px] border-double border-red-600 bg-red-50/90 px-5 py-1.5 sm:px-9 sm:py-2.5 shadow-lg ring-2 ring-red-600/30 backdrop-blur-[1px] print:border-red-600 print:bg-transparent print:shadow-none print:ring-0">
          <span className="text-[20pt] sm:text-[24pt] font-black tracking-widest text-red-600 print:text-[22pt]">
            ชำระแล้ว
          </span>
          <span className="text-[10pt] sm:text-[12pt] font-black tracking-[0.3em] text-red-600/90 print:text-[11pt]">
            PAID
          </span>
        </div>
      )}

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
                โทร. {phone} {fax ? `· แฟกซ์ ${fax}` : ""}
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right text-[12.5pt] sm:text-[13.5pt] leading-snug text-slate-800 print:text-[13pt] shrink-0">
            <p>
              <span className="font-semibold text-slate-900">เลขที่บิล:</span>{" "}
              <span className="font-bold text-slate-900">{bill.no}</span>
            </p>
            <p className="mt-0.5">
              <span className="text-slate-700">ประจำงวด:</span>{" "}
              <span className="font-medium text-slate-900">{periodFullThai(bill.period)}</span>
            </p>
            <p className="mt-0.5 text-slate-600">
              (งวด {periodLabel(bill.period)})
            </p>
          </div>
        </div>

        {/* ชื่อเอกสารกึ่งกลาง ตามระเบียบงานสารบรรณ 18pt หนา */}
        <div className="mt-1 text-center print:mt-1">
          <h1 className="text-[16pt] sm:text-[18pt] font-bold tracking-wide text-slate-900 print:text-[17pt]">
            {title}
          </h1>
        </div>
      </div>

      {/* 2. ข้อมูลผู้ใช้บริการ (จัดกระชับและสบายตา) */}
      <div className="relative mt-2 rounded-sm border border-slate-300 bg-slate-50/70 px-2.5 sm:px-3 py-1.5 text-[12.5pt] sm:text-[13.5pt] leading-tight text-slate-800 print:mt-1.5 print:border-slate-400 print:bg-transparent print:py-1 print:text-[13pt]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">ชื่อผู้ใช้บริการ:</span>
            <span className="font-semibold text-slate-900 break-words">{customer?.name ?? "—"}</span>
          </div>
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">สถานที่ / ร้านค้า:</span>
            <span className="font-semibold text-slate-900 break-words">{customer?.shop ?? "—"}</span>
          </div>
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">รหัสผู้ประกอบการ:</span>
            <span className="font-medium text-slate-900">{customer?.code ?? "—"}</span>
          </div>
          <div className="flex">
            <span className="w-24 sm:w-28 shrink-0 text-slate-700">
              {bill.type === "water" ? "เลขมาตรวัดน้ำ:" : "เลขมิเตอร์ไฟฟ้า:"}
            </span>
            <span className="font-medium text-slate-900">
              {meter || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. ตารางแสดงรายการคำนวณและยอดค้างชำระ */}
      <div className="relative mt-2 overflow-x-auto print:mt-1.5 print:overflow-visible">
        <table className="w-full min-w-[320px] border-collapse text-[12.5pt] sm:text-[13.5pt] print:text-[13pt]">
          <thead>
            <tr className="border-y-2 border-slate-800 bg-slate-100 font-bold text-slate-900 print:bg-slate-100">
              <th className="w-10 sm:w-12 border-x border-slate-300 px-1.5 sm:px-2 py-1 text-center print:border-slate-400">
                ลำดับ
              </th>
              <th className="border-x border-slate-300 px-2 sm:px-3 py-1 text-left print:border-slate-400">
                รายการ
              </th>
              <th className="w-32 sm:w-40 border-x border-slate-300 px-2 sm:px-3 py-1 text-right print:border-slate-400">
                จำนวนเงิน (บาท)
              </th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-200 print:border-slate-300">
                <td className="border-x border-slate-200 px-1.5 sm:px-2 py-0.5 text-center text-slate-700 print:border-slate-300">
                  {i + 1}
                </td>
                <td className="border-x border-slate-200 px-2 sm:px-3 py-0.5 font-medium text-slate-900 print:border-slate-300">
                  {l.label}
                </td>
                <td className="border-x border-slate-200 px-2 sm:px-3 py-0.5 text-right font-medium text-slate-900 print:border-slate-300">
                  {thb(l.amount)}
                </td>
              </tr>
            ))}
            {arrears.length > 0 && (
              <tr className="border-b border-slate-200 text-rose-700 print:border-slate-300 print:text-rose-900">
                <td className="border-x border-slate-200 px-1.5 sm:px-2 py-0.5 text-center print:border-slate-300">
                  {bill.lines.length + 1}
                </td>
                <td className="border-x border-slate-200 px-2 sm:px-3 py-0.5 font-medium print:border-slate-300">
                  {bill.type === "electric"
                    ? "ยอดค้างชำระค่ากระแสไฟฟ้าสะสม"
                    : bill.type === "water"
                    ? "ยอดค้างชำระค่าน้ำประปาสะสม"
                    : "ยอดค้างชำระค่าสาธารณูปโภคสะสม"}{" "}
                  <span className="font-normal text-rose-600 print:text-rose-800">
                    (ค้างชำระ {arrears.length} เดือน)
                  </span>
                </td>
                <td className="border-x border-slate-200 px-2 sm:px-3 py-0.5 text-right font-medium print:border-slate-300">
                  {thb(arrearsTotal)}
                </td>
              </tr>
            )}
            {/* แถวยอดรวมทั้งสิ้น */}
            <tr className="border-y-2 border-slate-800 bg-slate-50 font-bold text-slate-900 print:bg-slate-50">
              <td
                colSpan={2}
                className="border-x border-slate-300 px-2 sm:px-3 py-1 text-left print:border-slate-400"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                  <span className="text-[13pt] sm:text-[14pt]">รวมเงินทั้งสิ้นที่ต้องชำระ (Total Amount Due)</span>
                  <span className="text-[11pt] sm:text-[12pt] font-normal text-slate-700 print:text-[11.5pt]">
                    ({thaiBahtText(grandTotal)})
                  </span>
                </div>
              </td>
              <td className="border-x border-slate-300 px-2 sm:px-3 py-1 text-right font-bold text-[13.5pt] sm:text-[15pt] text-slate-900 print:border-slate-400 print:text-[14pt] whitespace-nowrap">
                ฿{thb(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 4. รายละเอียดการชำระเงิน และช่องทางติดต่อ */}
      <div className="relative mt-2 rounded-sm border border-slate-300 bg-slate-50/50 p-2 text-[11.5pt] sm:text-[12.5pt] leading-snug text-slate-800 print:mt-1.5 print:border-slate-400 print:bg-transparent print:p-1.5 print:text-[12pt]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1 space-y-0.5">
            <p className="font-bold text-slate-900">
              📌 ช่องทางการชำระเงิน:
            </p>
            <p>
              • โอนเข้าบัญชี: <span className="font-semibold text-slate-900">{bankName}</span> เลขที่บัญชี{" "}
              <span className="font-bold text-slate-900">{accountNo}</span>
            </p>
            <p>
              • ชื่อบัญชี: <span className="font-medium text-slate-900">“{accountName}”</span>
            </p>
            <p>
              • เวลาทำการ: <span className="text-slate-800">{paymentHours}</span>
            </p>
            <p>
              • ส่งสลิปการโอนเงิน: <span className="text-slate-800">{lineContact}</span>
            </p>
            <p className="pt-0.5 text-[10.5pt] sm:text-[11.5pt] font-medium text-rose-700 print:text-[11pt] print:text-rose-900">
              * โปรดชำระภายในกำหนด หากถูกระงับสัญญาณ/ประสานมิเตอร์ มีค่าธรรมเนียม {thb(reconnectFee)} บาท
            </p>
          </div>

          {/* QR Code */}
          <div className="flex sm:flex-col items-center gap-2 sm:gap-0 shrink-0 text-center self-center sm:self-auto">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="QR Code สำหรับชำระเงิน"
                className="h-12 w-12 sm:h-14 sm:w-14 rounded border border-slate-300 bg-white object-contain p-0.5 print:h-12 print:w-12"
              />
            ) : (
              <div className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded border border-slate-300 bg-slate-100 text-[9pt] sm:text-[10pt] font-bold text-slate-700 print:h-12 print:w-12">
                QR PAY
              </div>
            )}
            <span className="mt-0.5 text-[9.5pt] sm:text-[10.5pt] text-slate-600">สแกนชำระเงิน</span>
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
        </div>
      </div>
    </div>
  );
}
