import {
  Send,
  Copy,
  ExternalLink,
  Clock,
  Receipt,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRcms, thb, formatThaiDate } from "@/lib/rcms-store";
import { cn } from "@/lib/utils";
import type { Payment } from "@/lib/rcms-types";

interface LineSendReceiptDialogProps {
  paymentId: string | null;
  open: boolean;
  onClose: () => void;
  onViewReceiptSheet?: (payment: Payment) => void;
}

export function LineSendReceiptDialog({
  paymentId,
  open,
  onClose,
  onViewReceiptSheet,
}: LineSendReceiptDialogProps) {
  const {
    payments,
    customerOf,
    sendReceipt,
    receiptSendsOf,
  } = useRcms();

  const payment = payments.find((p) => p.id === paymentId);
  const customer = payment ? customerOf(payment.customerId) : undefined;
  const sendHistory = payment ? receiptSendsOf(payment.id) : [];

  if (!payment) return null;

  const receiptNo = payment.receiptNo || payment.ref || "RCT-PENDING";
  const bookNo = payment.bookNo || "01/2569";
  const meterNo = payment.division === "water" ? customer?.waterMeter : customer?.elecMeter;

  const handleCopyMessage = () => {
    const text = `🧾 ใบเสร็จรับเงิน กรมช่างโยธาทหารอากาศ (ชย.ทอ.)
━━━━━━━━━━━━━━━━━━
📄 เลขที่ใบเสร็จ: ${receiptNo} (เล่มที่: ${bookNo})
👤 ผู้ประกอบการ: ${customer?.name || "ผู้ประกอบการ"} (${customer?.shop || "—"})
🆔 รหัสผู้ประกอบการ: ${customer?.code || "—"}
${payment.division === "water" ? "💧 เลขมาตรวัดน้ำ" : "⚡ เลขมิเตอร์ไฟ"}: ${meterNo || "—"}
📅 วันที่รับชำระ: ${formatThaiDate(payment.paidDate || payment.paidAt)}
💳 ช่องทางชำระ: ${payment.method === "online" ? "โอนเงินผ่านธนาคาร / LINE" : "เคาน์เตอร์การเงิน ชย.ทอ."}
🔖 เลขที่อ้างอิง: ${payment.ref}
━━━━━━━━━━━━━━━━━━
💵 ยอดเงินที่ชำระ: ฿${thb(payment.amount)} บาท
${payment.reconnectFee && payment.reconnectFee > 0 ? `• รวมค่าประสานมิเตอร์ต่อระบบ: ฿${thb(payment.reconnectFee)}\n` : ""}📌 สถานะ: ชำระเงินเรียบร้อยและออกใบเสร็จสมบูรณ์
━━━━━━━━━━━━━━━━━━
🏢 กรมช่างโยธาทหารอากาศ (กองจัดเก็บรายได้)
ขอบคุณที่ชำระค่าบริการตรงเวลา`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success("คัดลอกข้อความใบเสร็จรับเงินสำหรับส่ง LINE เรียบร้อยแล้ว");
    }
  };

  const handleShareLine = () => {
    const text = `🧾 ใบเสร็จรับเงิน ${receiptNo} ยอด ฿${thb(payment.amount)} (${customer?.name}) - กรมช่างโยธาทหารอากาศ`;
    const url = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleSendLine = () => {
    sendReceipt(payment.id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#06C755] text-white shadow-xs">
              <Receipt className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg">
                ส่งใบเสร็จรับเงินผ่าน LINE
              </DialogTitle>
              <DialogDescription className="text-xs">
                แชร์ข้อความและส่งเอกสารใบเสร็จรับเงินทางการให้ผู้ประกอบการผ่าน LINE
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5">
          {/* Customer Info Card */}
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">{customer?.name}</span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {customer?.code}
                </Badge>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs">
                ชำระแล้ว
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1.5 border-t border-border/50">
              <p>ร้านค้า: <span className="font-medium text-foreground">{customer?.shop || "—"}</span></p>
              <p>เบอร์โทร: <span className="font-medium font-mono text-foreground">{customer?.phone || "—"}</span></p>
              <p>{payment.division === "water" ? "💧 มาตรวัดน้ำ" : "⚡ มิเตอร์ไฟ"}: <span className="font-medium font-mono text-foreground">{meterNo || "—"}</span></p>
              <p>เลขที่ใบเสร็จ: <span className="font-medium font-mono text-foreground">{receiptNo}</span></p>
            </div>
          </div>

          {/* LINE Sending Action Bar */}
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5 text-primary" /> ช่องทางส่งข้อความใบเสร็จ:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareLine}
                className="h-10 text-xs text-[#06C755] hover:text-[#06C755] hover:bg-[#06C755]/10 border-[#06C755]/40 flex items-center justify-center gap-2 font-bold shadow-2xs"
              >
                <ExternalLink className="h-4 w-4" /> 🚀 แชร์ไปที่ LINE App
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyMessage}
                className="h-10 text-xs flex items-center justify-center gap-2 font-semibold shadow-2xs"
              >
                <Copy className="h-4 w-4" /> 📋 คัดลอกข้อความใบเสร็จ
              </Button>
            </div>
          </div>

          {/* LINE Receipt Preview Card */}
          <div className="rounded-xl border border-[#06C755]/30 bg-[#06C755]/5 p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-[#06C755]/20 pb-2">
              <span className="text-[11px] font-semibold text-[#06C755] flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#06C755] animate-pulse" />
                ตัวอย่างการ์ดใบเสร็จรับเงินใน LINE ผู้ประกอบการ
              </span>
            </div>

            <div className="rounded-lg bg-card border border-border p-3.5 space-y-2.5 text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="font-bold text-foreground">
                    ใบเสร็จรับเงิน · กรมช่างโยธาทหารอากาศ
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  ชำระเรียบร้อย
                </Badge>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-lg p-2.5 text-center space-y-0.5">
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">ยอดเงินที่ชำระแล้วทั้งสิ้น</p>
                <p className="text-2xl font-bold font-display text-emerald-700 dark:text-emerald-400">
                  ฿{thb(payment.amount)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  วันที่ชำระ: {formatThaiDate(payment.paidDate || payment.paidAt)} · ช่องทาง: {payment.method === "online" ? "โอนเงิน/LINE" : "เคาน์เตอร์การเงิน"}
                </p>
              </div>

              <div className="space-y-1.5 text-[11px] text-muted-foreground bg-muted/30 rounded p-2 border border-border/40">
                <div className="flex justify-between">
                  <span>เลขที่ใบเสร็จ:</span>
                  <strong className="font-mono text-foreground font-semibold">{receiptNo}</strong>
                </div>
                <div className="flex justify-between">
                  <span>ผู้ประกอบการ:</span>
                  <strong className="text-foreground">{customer?.name} ({customer?.shop})</strong>
                </div>
                <div className="flex justify-between">
                  <span>ประเภทบริการ:</span>
                  <span className="text-foreground font-medium">
                    {payment.division === "water" ? "💧 ค่าน้ำประปา" : "⚡ ค่าไฟฟ้า"} ({meterNo || "—"})
                  </span>
                </div>
                {payment.reconnectFee && payment.reconnectFee > 0 ? (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>ค่าประสานมิเตอร์ต่อระบบ:</span>
                    <strong className="font-mono">฿{thb(payment.reconnectFee)}</strong>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>เลขที่อ้างอิงสลิป:</span>
                  <span className="font-mono text-foreground">{payment.ref}</span>
                </div>
              </div>

              <div className="pt-1 border-t border-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (onViewReceiptSheet) onViewReceiptSheet(payment);
                  }}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="h-3 w-3" /> เปิดดูใบเสร็จฉบับเต็มทางการ (A4/PDF)
                </button>
                <span className="text-[10px] text-muted-foreground">ชย.ทอ.</span>
              </div>
            </div>
          </div>

          {/* Send History status */}
          <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {sendHistory.length > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ ส่งใบเสร็จให้ลูกค้ารายนี้แล้ว {sendHistory.length} ครั้ง (ล่าสุด: {sendHistory[0]?.at})
                </span>
              ) : (
                <span>ยังไม่เคยส่งใบเสร็จนี้ผ่าน LINE</span>
              )}
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 sm:justify-end">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs h-8">
              ปิด
            </Button>
            <Button
              size="sm"
              className={cn("bg-[#06C755] text-white hover:bg-[#06C755]/90 text-xs h-9 px-4 shadow-sm font-bold gap-1.5")}
              onClick={handleSendLine}
            >
              <Send className="h-4 w-4" />
              <span>⚡ บันทึกการส่งใบเสร็จ LINE</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
