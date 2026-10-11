import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import {
  Save,
  RotateCcw,
  CreditCard,
  QrCode,
  Upload,
  Trash2,
  Sliders,
  Calendar,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRcms } from "@/lib/rcms-store";
import { DEFAULT_SETTINGS } from "@/lib/rcms-seed";
import type { Settings } from "@/lib/rcms-types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าระบบ · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "ตั้งค่าอัตราค่าธรรมเนียม เงินประกันมิเตอร์ รอบบิล ข้อมูลบัญชีธนาคาร และ QR Code สำหรับใบแจ้งหนี้",
      },
      { property: "og:title", content: "ตั้งค่าระบบ · RCMS" },
      { property: "og:description", content: "System Configuration" },
    ],
  }),
  component: SettingsPage,
});

const groups: Array<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: Array<{ k: keyof Settings; label: string; unit: string; step?: number }>;
}> = [
  {
    title: "ค่าธรรมเนียมและเงินประกัน",
    icon: Sliders,
    fields: [
      { k: "meterMaintenanceFee", label: "ค่ารักษามิเตอร์", unit: "บาท/เดือน/มิเตอร์", step: 0.01 },
      { k: "penaltyDisconnectionFee", label: "ค่าประสานมิเตอร์ (ต่อระบบ)", unit: "บาท" },
      { k: "depositElectric", label: "เงินประกันมิเตอร์ไฟฟ้า", unit: "บาท" },
      { k: "depositWater", label: "เงินประกันมิเตอร์น้ำ", unit: "บาท" },
    ],
  },
  {
    title: "รอบบิลและการเก็บข้อมูล",
    icon: Calendar,
    fields: [
      { k: "fetchDay", label: "วันดึงข้อมูลหน่วยใช้", unit: "วันที่ของเดือน" },
      { k: "dueDayOffset", label: "ครบกำหนดชำระ", unit: "วันหลังออกบิล" },
      { k: "suspendCutoffDay", label: "วันตัดยอดเข้าเงื่อนไขระงับบริการ", unit: "วันที่ของเดือน" },
      { k: "graceDays", label: "ผ่อนผันก่อนเสนอระงับ", unit: "วัน" },
      { k: "retentionMonths", label: "เก็บข้อมูลย้อนหลัง", unit: "เดือน" },
    ],
  },
];

function SettingsPage() {
  const { settings, saveSettings, role } = useRcms();
  const [draft, setDraft] = useState<Settings>(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = role === "admin";

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, SVG, WebP)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("ขนาดไฟล์รูปภาพไม่ควรเกิน 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDraft((prev) => ({ ...prev, qrCodeUrl: reader.result as string }));
        toast.success("อัปโหลดรูปภาพ QR Code เรียบร้อย (กดบันทึกการตั้งค่าเพื่อยืนยัน)");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <PageHeader
        title="ตั้งค่าระบบ"
        desc={
          isAdmin
            ? "กำหนดค่าตัวแปรการคำนวณ รอบบิล และข้อมูลบัญชีธนาคารสำหรับออกใบแจ้งหนี้ (บันทึกใน Audit Log)"
            : "ต้องใช้สิทธิ์ผู้ดูแลระบบ (Admin) เพื่อแก้ไขค่าตัวแปรระบบ"
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(DEFAULT_SETTINGS);
                toast.info("คืนค่าเริ่มต้นแล้ว (กดบันทึกการตั้งค่าเพื่อยืนยัน)");
              }}
              disabled={!isAdmin}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> ค่าเริ่มต้น
            </Button>
            <Button onClick={() => saveSettings(draft)} disabled={!isAdmin}>
              <Save className="mr-1.5 h-4 w-4" /> บันทึกการตั้งค่า
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.title} className="shadow-xs border-border">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <g.icon className="h-4 w-4 text-primary" /> {g.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {g.fields.map((f) => (
                <div key={f.k} className="grid gap-1.5">
                  <Label htmlFor={f.k} className="text-sm font-medium">{f.label}</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id={f.k}
                      type="number"
                      step={f.step ?? 1}
                      disabled={!isAdmin}
                      className="bg-background font-mono"
                      value={draft[f.k] as number}
                      onChange={(e) => setDraft({ ...draft, [f.k]: Number(e.target.value) })}
                    />
                    <span className="w-40 shrink-0 text-xs text-muted-foreground">{f.unit}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ข้อมูลบัญชีการโอนเงินและ QR Code สำหรับใบแจ้งหนี้ */}
      <Card className="mt-6 shadow-xs border-border">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <CreditCard className="h-4 w-4 text-primary" /> ข้อมูลบัญชีการโอนเงินและ QR Code สำหรับใบแจ้งหนี้
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            ข้อมูลส่วนนี้จะถูกนำไปแสดงที่ส่วนท้ายของใบแจ้งหนี้ (Bill & Statement) เพื่อให้ผู้ประกอบการสแกนหรือโอนชำระเงิน
          </p>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ข้อมูลธนาคารและบัญชี */}
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="bankName">ชื่อธนาคาร</Label>
                <Input
                  id="bankName"
                  disabled={!isAdmin}
                  className="bg-background"
                  placeholder="เช่น ธนาคารทหารไทยธนชาต"
                  value={draft.bankName || ""}
                  onChange={(e) => setDraft({ ...draft, bankName: e.target.value })}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="bankAccountNo">เลขที่บัญชี</Label>
                <Input
                  id="bankAccountNo"
                  disabled={!isAdmin}
                  className="bg-background font-mono"
                  placeholder="เช่น 057-1-07053-1"
                  value={draft.bankAccountNo || ""}
                  onChange={(e) => setDraft({ ...draft, bankAccountNo: e.target.value })}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="bankAccountName">ชื่อบัญชี</Label>
                <Input
                  id="bankAccountName"
                  disabled={!isAdmin}
                  className="bg-background"
                  placeholder="เช่น เงินนอกงบประมาณ กรมช่างโยธาทหารอากาศ"
                  value={draft.bankAccountName || ""}
                  onChange={(e) => setDraft({ ...draft, bankAccountName: e.target.value })}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="paymentHours">เวลาทำการรับชำระเงิน</Label>
                <Input
                  id="paymentHours"
                  disabled={!isAdmin}
                  className="bg-background"
                  placeholder="เช่น รับชำระเงินวันทำการ ตั้งแต่เวลา 0800–1500 น."
                  value={draft.paymentHours || ""}
                  onChange={(e) => setDraft({ ...draft, paymentHours: e.target.value })}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="contactPhone">เบอร์โทรศัพท์แจ้งชำระเงิน</Label>
                  <Input
                    id="contactPhone"
                    disabled={!isAdmin}
                    className="bg-background"
                    placeholder="เช่น 02-534-2557"
                    value={draft.contactPhone || ""}
                    onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="contactFax">เบอร์แฟกซ์</Label>
                  <Input
                    id="contactFax"
                    disabled={!isAdmin}
                    className="bg-background"
                    placeholder="เช่น 02-523-9470"
                    value={draft.contactFax || ""}
                    onChange={(e) => setDraft({ ...draft, contactFax: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lineContact">ช่องทางติดต่อเพิ่มเติม / ส่งสลิป</Label>
                <Input
                  id="lineContact"
                  disabled={!isAdmin}
                  className="bg-background"
                  placeholder="เช่น ฝ่ายจัดเก็บรายได้ กองการสงเคราะห์ ชย.ทอ."
                  value={draft.lineContact || ""}
                  onChange={(e) => setDraft({ ...draft, lineContact: e.target.value })}
                />
              </div>
            </div>

            {/* การจัดการ QR Code และ Preview */}
            <div className="flex flex-col justify-between space-y-4 rounded-xl border border-border bg-muted/20 p-5">
              <div>
                <Label className="mb-1.5 block font-semibold text-foreground">รูปภาพ QR Code สำหรับรับชำระเงิน</Label>
                <p className="mb-4 text-xs text-muted-foreground">
                  อัปโหลดรูปภาพ QR Code (พร้อมเพย์ หรือ QR เลขที่บัญชี) เพื่อนำไปแสดงบนใบแจ้งหนี้อัตโนมัติ
                </p>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleQrUpload}
                />

                {draft.qrCodeUrl ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative">
                      <img
                        src={draft.qrCodeUrl}
                        alt="QR Code สำหรับชำระเงิน"
                        className="h-36 w-36 rounded-xl border-2 border-primary/30 bg-white p-2 object-contain shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!isAdmin}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-1.5 h-3.5 w-3.5" /> เปลี่ยนรูปภาพ QR Code
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!isAdmin}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          setDraft((prev) => ({ ...prev, qrCodeUrl: "" }));
                          if (fileInputRef.current) fileInputRef.current.value = "";
                          toast.info("ลบรูปภาพ QR Code แล้ว (กดบันทึกการตั้งค่าเพื่อยืนยัน)");
                        }}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> ลบรูปภาพ QR Code
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => isAdmin && fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center transition ${
                      isAdmin ? "cursor-pointer hover:border-primary/50 hover:bg-muted/50" : "opacity-60"
                    }`}
                  >
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <QrCode className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">คลิกเพื่ออัปโหลด QR Code</p>
                    <p className="text-xs text-muted-foreground">
                      รองรับไฟล์ PNG, JPG, WebP ขนาดไม่เกิน 2MB
                    </p>
                  </div>
                )}
              </div>

              {/* ตัวอย่างการแสดงผลท้ายใบแจ้งหนี้จริง */}
              <div>
                <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  ตัวอย่างการแสดงผลส่วนท้ายใบแจ้งหนี้ (Live Preview):
                </Label>
                <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 text-[11px] leading-relaxed text-muted-foreground shadow-xs">
                  <div className="space-y-1">
                    {draft.paymentHours ? <p className="font-medium text-foreground">{draft.paymentHours}</p> : null}
                    <p>
                      โอนเข้าบัญชี{draft.bankName || "ธนาคารทหารไทยธนชาต"} เลขที่{" "}
                      <strong className="font-mono text-foreground">{draft.bankAccountNo || "057-1-07053-1"}</strong>
                    </p>
                    <p>ชื่อบัญชี “{draft.bankAccountName || "เงินนอกงบประมาณ กรมช่างโยธาทหารอากาศ"}”</p>
                    {draft.contactPhone || draft.contactFax ? (
                      <p>
                        แจ้งผลการชำระเงิน{" "}
                        {draft.contactPhone ? `โทร. ${draft.contactPhone}` : ""}
                        {draft.contactPhone && draft.contactFax ? " · " : ""}
                        {draft.contactFax ? `แฟกซ์ ${draft.contactFax}` : ""}
                      </p>
                    ) : null}
                    {draft.lineContact ? <p>{draft.lineContact}</p> : null}
                    <p className="font-medium text-destructive">
                      * โปรดชำระภายในกำหนด กรณีประสานมิเตอร์มีค่าธรรมเนียม {draft.penaltyDisconnectionFee || 100} บาท
                    </p>
                  </div>
                  <div className="grid shrink-0 gap-1 text-center">
                    {draft.qrCodeUrl ? (
                      <img
                        src={draft.qrCodeUrl}
                        alt="QR Code"
                        className="h-16 w-16 rounded-lg border border-border bg-white object-contain p-0.5 shadow-2xs"
                      />
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-lg bg-foreground/90 text-[9px] font-semibold text-background">
                        QR PAY
                      </div>
                    )}
                    <span className="text-[9px] font-medium text-muted-foreground">QR เลขที่บัญชี</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
