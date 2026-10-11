import { useState } from "react";
import { LogIn, UserPlus, Eye, EyeOff, Shield, ShieldCheck, Briefcase, Zap, KeyRound, Check } from "lucide-react";
import { RCMS_LOGO_URL } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useRcms } from "@/lib/rcms-store";
import { SEED_USERS } from "@/lib/rcms-seed";
import { ROLE_LABEL } from "@/lib/rcms-types";

const RANKS = [
  "น.อ.",
  "น.ท.",
  "น.ต.",
  "ร.อ.",
  "ร.ท.",
  "ร.ต.",
  "พ.อ.อ.",
  "พ.อ.ท.",
  "พ.อ.ต.",
  "จ.อ.",
  "จ.ท.",
  "จ.ต.",
  "นาย",
  "นาง",
  "น.ส.",
];

export function LoginScreen() {
  const { login, register, users } = useRcms();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [f, setF] = useState({
    rank: "พ.อ.อ.",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [showRegPassword, setShowRegPassword] = useState(false);

  // บัญชีทดสอบที่ใช้งานได้ (จาก SEED_USERS และ users ที่ active)
  const availableAccounts = users.filter((u) => u.status === "active").slice(0, 4);

  const handleQuickLogin = (userEmail: string, userPw: string) => {
    setEmail(userEmail);
    setPassword(userPw);
    login(userEmail, userPw);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-background font-sans">
      {/* ฝั่งซ้าย: โลโก้และเอกลักษณ์หน่วยงาน (Desktop) */}
      <div className="panel-gradient hidden flex-col justify-between p-12 text-sidebar-foreground lg:flex border-r border-sidebar-border/40">
        <div className="flex items-center gap-3.5">
          <img
            src={RCMS_LOGO_URL}
            alt="ตราสัญลักษณ์ กรมช่างโยธาทหารอากาศ"
            className="h-16 w-16 object-contain drop-shadow-md"
          />
          <div>
            <p className="font-display text-2xl font-extrabold text-sidebar-primary tracking-tight">RCMS</p>
            <p className="text-xs font-medium text-sidebar-foreground/90">ระบบบริหารจัดเก็บรายได้ ชย.ทอ.</p>
          </div>
        </div>

        <div className="space-y-4 my-auto max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-sidebar-primary/20 px-3 py-1 text-xs font-bold text-sidebar-primary border border-sidebar-primary/30">
            <span>กรมช่างโยธาทหารอากาศ · ชย.ทอ.</span>
          </div>
          <h1 className="font-display text-3xl xl:text-4xl font-extrabold leading-tight text-white tracking-tight">
            ระบบบริหารจัดเก็บรายได้
            <br />
            ค่ากระแสไฟฟ้าและน้ำประปา
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-sidebar-foreground/90 font-normal">
            ศูนย์กลางบริหารข้อมูลผู้ใช้น้ำ-ไฟ ออกใบแจ้งหนี้ ตรวจสอบสลิปด้วย AI OCR
            ติดตามงานระงับ/ต่อระบบ และรายงานสรุปส่งมอบเงินรายได้กองไฟฟ้าและกองประปา
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-sidebar-border/60 pt-4 text-xs text-sidebar-foreground/70">
          <span>ฝ่ายจัดเก็บรายได้ กรมช่างโยธาทหารอากาศ</span>
          <span>เวอร์ชัน 1.3</span>
        </div>
      </div>

      {/* ฝั่งขวา: แบบฟอร์มเข้าสู่ระบบ / ลงทะเบียน */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardContent className="p-7 sm:p-9">
            {/* โลโก้สำหรับ Mobile */}
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <img src={RCMS_LOGO_URL} alt="โลโก้ ชย.ทอ." className="h-11 w-11 object-contain" />
              <div>
                <p className="font-display text-lg font-bold text-foreground">RCMS ชย.ทอ.</p>
                <p className="text-xs text-muted-foreground">ระบบบริหารจัดเก็บรายได้</p>
              </div>
            </div>

            {/* สลับแท็บ เข้าสู่ระบบ / ลงทะเบียน */}
            <div className="mb-6 flex overflow-hidden rounded-xl border border-border bg-muted/40 p-1">
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                    tab === t
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "login" ? "เข้าสู่ระบบ (Login)" : "ลงทะเบียนผู้ใช้งานใหม่"}
                </button>
              ))}
            </div>

            {tab === "login" ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  login(email, password);
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-bold text-foreground">
                    อีเมลหรือชื่อบัญชีผู้ใช้
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@rcms.rtaf.mi.th"
                    autoComplete="username"
                    className="h-10 text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pw" className="text-xs font-bold text-foreground">
                      รหัสผ่าน (Password)
                    </Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="pw"
                      type={showPassword ? "text" : "password"}
                      placeholder="กรอกรหัสผ่าน"
                      autoComplete="current-password"
                      className="h-10 pr-10 text-sm font-mono"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-10 text-sm font-bold shadow-xs mt-2" disabled={!email || !password}>
                  <LogIn className="mr-2 h-4 w-4" /> เข้าสู่ระบบ
                </Button>

                {/* กล่องบัญชีทดสอบด่วน (Quick Test Logins) */}
                <div className="mt-6 rounded-2xl border border-dashed border-border/80 bg-muted/30 p-4">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-2.5">
                    <KeyRound className="h-3.5 w-3.5 text-primary" /> บัญชีทดสอบระบบ (คลิกเพื่อเข้าสู่ระบบทันที):
                  </p>
                  <div className="space-y-2">
                    {availableAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleQuickLogin(acc.email, acc.password)}
                        className="w-full text-left flex items-center justify-between rounded-xl bg-card p-2.5 border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-colors group cursor-pointer"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {acc.rank}{acc.firstName} {acc.lastName}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">
                            {acc.email} · รหัส: <span className="font-semibold text-foreground">{acc.password}</span>
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {ROLE_LABEL[acc.role]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              <form
                className="space-y-3.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (register(f)) {
                    setF({ rank: "พ.อ.อ.", firstName: "", lastName: "", email: "", password: "" });
                    setTab("login");
                  }
                }}
              >
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="rank" className="text-xs font-bold">ยศ / คำนำหน้า</Label>
                    <select
                      id="rank"
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      value={f.rank}
                      onChange={(e) => setF({ ...f, rank: e.target.value })}
                    >
                      {RANKS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fn" className="text-xs font-bold">ชื่อ <span className="text-destructive">*</span></Label>
                    <Input
                      id="fn"
                      className="h-9 text-xs"
                      placeholder="ชื่อ"
                      value={f.firstName}
                      onChange={(e) => setF({ ...f, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ln" className="text-xs font-bold">นามสกุล <span className="text-destructive">*</span></Label>
                    <Input
                      id="ln"
                      className="h-9 text-xs"
                      placeholder="นามสกุล"
                      value={f.lastName}
                      onChange={(e) => setF({ ...f, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="remail" className="text-xs font-bold">อีเมลสำหรับเข้าสู่ระบบ <span className="text-destructive">*</span></Label>
                  <Input
                    id="remail"
                    type="email"
                    className="h-9 text-xs"
                    placeholder="example@rcms.rtaf.mi.th"
                    value={f.email}
                    onChange={(e) => setF({ ...f, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="rpw" className="text-xs font-bold">กำหนดรหัสผ่าน (อย่างน้อย 4 ตัวอักษร) <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      id="rpw"
                      type={showRegPassword ? "text" : "password"}
                      className="h-9 pr-9 text-xs font-mono"
                      placeholder="รหัสผ่าน"
                      value={f.password}
                      onChange={(e) => setF({ ...f, password: e.target.value })}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                    >
                      {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-xs font-bold shadow-xs mt-2"
                  disabled={!f.firstName || !f.lastName || !f.email || f.password.length < 4}
                >
                  <UserPlus className="mr-1.5 h-4 w-4" /> ส่งคำขอลงทะเบียน
                </Button>

                <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
                  เมื่อลงทะเบียนแล้ว บัญชีจะอยู่ในสถานะ "รออนุมัติ" โดยผู้ดูแลระบบจะตรวจสอบและกำหนดสิทธิ์จากหน้ากำหนดสิทธิ์ผู้ใช้งาน
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
