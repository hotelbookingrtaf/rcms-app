import { CheckCircle2, AlertTriangle } from "lucide-react";
import { thb } from "@/lib/rcms-store";
import type { Payment } from "@/lib/rcms-types";

/** ภาพจำลองสลิปโอนเงินที่ระบบดึงมาจาก Line OA / เจ้าหน้าที่แนบเข้าระบบ */
export function SlipView({ payment }: { payment: Payment }) {
  const s = payment.slip;
  const bad = payment.status === "problem";
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-dashed border-border pb-2">
        <p className="text-xs font-semibold text-primary">{s.bank}</p>
        {bad ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-success" />
        )}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">โอนเงินสำเร็จ</p>
      <p className="text-center font-display text-2xl font-bold">฿{thb(s.amount)}</p>
      <p className="text-center text-[11px] text-muted-foreground">{s.dateTime}</p>
      <div className="mt-3 space-y-1.5 rounded-lg bg-muted p-3 text-[11px]">
        <p className="flex justify-between gap-2">
          <span className="text-muted-foreground">จาก</span>
          <span className="text-right font-medium">{s.payerName}</span>
        </p>
        <p className="flex justify-between gap-2">
          <span className="text-muted-foreground">เลขที่บัญชี</span>
          <span className="font-mono">{s.payerAccount}</span>
        </p>
        <p className="flex justify-between gap-2">
          <span className="text-muted-foreground">ไปยัง</span>
          <span className="text-right font-medium">เงินนอกงบประมาณ ชย.ทอ.</span>
        </p>
        <p className="flex justify-between gap-2">
          <span className="text-muted-foreground">รหัสอ้างอิง</span>
          <span className="font-mono">{s.ref}</span>
        </p>
      </div>
      <p
        className={`mt-3 text-center text-[11px] ${bad ? "font-semibold text-destructive" : "text-muted-foreground"}`}
      >
        {bad ? payment.issue : `OCR อ่านข้อมูลครบถ้วน · ค่าความเชื่อมั่น ${payment.ocrConfidence}%`}
      </p>
    </div>
  );
}
