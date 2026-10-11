import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  ShieldCheck,
  UserCheck,
  Trash2,
  Search,
  Users,
  CheckCircle2,
  Clock,
  Shield,
  UserPlus,
  Info,
  Building,
  Briefcase,
  Zap,
  BadgeCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  KeyRound,
  Lock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRcms } from "@/lib/rcms-store";
import type { Role, AppUser } from "@/lib/rcms-types";
import { ROLE_LABEL, fullName } from "@/lib/rcms-types";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "กำหนดสิทธิ์ผู้ใช้งาน · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "จัดการรายชื่อผู้ใช้งาน ดูรหัสผ่าน กำหนดสิทธิ์ตามบทบาท (Role-based Access Control: RBAC) และอนุมัติการเข้าใช้งานระบบ RCMS",
      },
      { property: "og:title", content: "กำหนดสิทธิ์ผู้ใช้งาน · RCMS" },
      { property: "og:description", content: "User Roles & Permissions Management" },
    ],
  }),
  component: UsersPage,
});

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

const ROLES_LIST: Role[] = [
  "admin",
  "supervisor",
  "revenue_officer",
  "utility_field_officer",
  "auditor",
  "entrepreneur",
];

const ROLE_DESCRIPTIONS: Record<
  Role,
  { desc: string; icon: React.ComponentType<{ className?: string }>; badgeColor: string }
> = {
  admin: {
    desc: "สิทธิ์สูงสุด — จัดการผู้ใช้งาน กำหนดสิทธิ์ ตั้งค่าระบบ ออกบิล รับชำระ และเข้าถึงข้อมูลทุกส่วน",
    icon: Shield,
    badgeColor: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  },
  supervisor: {
    desc: "ผู้บังคับบัญชา / หัวหน้างาน — อนุมัติการระงับบริการ ตรวจสอบการเงิน และดูรายงานสรุปภาพรวม",
    icon: ShieldCheck,
    badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  revenue_officer: {
    desc: "เจ้าหน้าที่การเงินและจัดเก็บรายได้ — ออกใบแจ้งหนี้ ตรวจสอบสลิป รับชำระเงิน นำเข้า Excel",
    icon: Briefcase,
    badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  utility_field_officer: {
    desc: "เจ้าหน้าที่ภาคสนาม/ไฟฟ้า-ประปา — จดบันทึกหน่วยใช้มิเตอร์ ตรวจสอบมิเตอร์ รับใบงานตัด/ต่อระบบ",
    icon: Zap,
    badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  auditor: {
    desc: "ผู้ตรวจสอบ — ตรวจสอบรายการย้อนหลัง ดูรายงาน และตรวจสอบ Audit Log (อ่านข้อมูลอย่างเดียว)",
    icon: BadgeCheck,
    badgeColor: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  entrepreneur: {
    desc: "ผู้ประกอบการ / ผู้ใช้น้ำ-ไฟ — ตรวจสอบยอดหนี้ ดูใบแจ้งหนี้ และประวัติการชำระเงินของตนเอง",
    icon: Building,
    badgeColor: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30",
  },
};

const PERMISSIONS_MATRIX = [
  { feature: "แดชบอร์ดภาพรวม (Dashboard)", admin: true, supervisor: true, revenue: true, field: true, auditor: true, user: "ตนเอง" },
  { feature: "ข้อมูลผู้ประกอบการ (Customers)", admin: true, supervisor: true, revenue: true, field: false, auditor: "ดูเท่านั้น", user: false },
  { feature: "บันทึกหน่วยใช้มิเตอร์ (Readings)", admin: true, supervisor: true, revenue: true, field: true, auditor: "ดูเท่านั้น", user: false },
  { feature: "ออกใบแจ้งหนี้ (Billing)", admin: true, supervisor: true, revenue: true, field: false, auditor: "ดูเท่านั้น", user: false },
  { feature: "ตรวจสอบการชำระเงิน (Payments)", admin: true, supervisor: true, revenue: true, field: false, auditor: "ดูเท่านั้น", user: false },
  { feature: "ประวัติการชำระเงิน (History)", admin: true, supervisor: true, revenue: true, field: false, auditor: "ดูเท่านั้น", user: "ตนเอง" },
  { feature: "เสนอระงับบริการ (Service Action)", admin: true, supervisor: true, revenue: true, field: true, auditor: "ดูเท่านั้น", user: false },
  { feature: "อนุมัติระงับบริการ (Approvals)", admin: true, supervisor: true, revenue: false, field: false, auditor: "ดูเท่านั้น", user: false },
  { feature: "มอบหมายและปิดใบงานภาคสนาม (Tasks)", admin: true, supervisor: true, revenue: true, field: true, auditor: "ดูเท่านั้น", user: false },
  { feature: "นำเข้าข้อมูลจาก Excel (Import)", admin: true, supervisor: true, revenue: true, field: true, auditor: "ดูเท่านั้น", user: false },
  { feature: "รายงานสรุปรายได้ (Reports)", admin: true, supervisor: true, revenue: true, field: false, auditor: true, user: false },
  { feature: "บันทึกการใช้งาน (Audit Log)", admin: true, supervisor: true, revenue: false, field: false, auditor: true, user: false },
  { feature: "กำหนดสิทธิ์ผู้ใช้งาน (Users & RBAC)", admin: true, supervisor: false, revenue: false, field: false, auditor: false, user: false },
  { feature: "ตั้งค่าระบบและอัตราค่าบริการ (Settings)", admin: true, supervisor: false, revenue: false, field: false, auditor: false, user: false },
];

function UsersPage() {
  const { users, approveUser, updateUser, deleteUser, addUser, me, role } = useRcms();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // State สำหรับการดู/ซ่อนรหัสผ่าน
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal เปลี่ยน / รีเซ็ตรหัสผ่าน
  const [editingPasswordUser, setEditingPasswordUser] = useState<AppUser | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Modal เพิ่มผู้ใช้งานใหม่
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState<{
    rank: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: Role;
    status: "active" | "pending";
  }>({
    rank: "พ.อ.อ.",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "revenue_officer",
    status: "active",
  });
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        search === "" ||
        `${u.rank} ${u.firstName} ${u.lastName} ${u.email}`
          .toLowerCase()
          .includes(search.toLowerCase().trim());

      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "active").length;
    const pending = users.filter((u) => u.status === "pending").length;
    const admins = users.filter((u) => u.role === "admin" && u.status === "active").length;
    return { total, active, pending, admins };
  }, [users]);

  return (
    <>
      <PageHeader
        title="กำหนดสิทธิ์และรายชื่อผู้ใช้งาน"
        desc={
          isAdmin
            ? "จัดการรายชื่อผู้ใช้งาน ดูรหัสผ่าน กำหนดบทบาทสิทธิ์การเข้าถึง (Role-based Access Control: RBAC) และอนุมัติบัญชีผู้ใช้"
            : "ต้องใช้สิทธิ์ผู้ดูแลระบบ (Admin) เพื่อแก้ไขสิทธิ์และจัดการผู้ใช้งาน"
        }
      />

      {/* สรุปสถิติผู้ใช้งาน */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <Card className="border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ผู้ใช้ทั้งหมด</p>
              <p className="text-2xl font-black text-foreground font-mono mt-0.5">{stats.total}</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ใช้งานได้ปกติ</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{stats.active}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className={`border-border shadow-xs ${stats.pending > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">รออนุมัติ</p>
              <p className={`text-2xl font-black font-mono mt-0.5 ${stats.pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                {stats.pending}
              </p>
            </div>
            <div className={`rounded-xl p-2.5 ${stats.pending > 0 ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ผู้ดูแลระบบ</p>
              <p className="text-2xl font-black text-primary font-mono mt-0.5">{stats.admins}</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Shield className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* การ์ดตารางรายชื่อผู้ใช้งาน */}
      <Card className="border-border shadow-xs mb-6">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <ShieldCheck className="h-5 w-5 text-primary" /> รายชื่อผู้ใช้งานในระบบ ({filteredUsers.length})
              </CardTitle>
              <CardDescription className="mt-1">
                คลิกดูรหัสผ่าน เปลี่ยนรหัสผ่าน เปลี่ยนบทบาทสิทธิ์ (Role) หรืออนุมัติผู้ใช้งานใหม่
              </CardDescription>
            </div>

            {/* Filter controls & Action buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อ, ยศ, อีเมล..."
                  className="pl-9 h-9 text-xs bg-background"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-38 text-xs bg-background">
                  <SelectValue placeholder="ทุกบทบาทสิทธิ์" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกบทบาทสิทธิ์</SelectItem>
                  {ROLES_LIST.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-32 text-xs bg-background">
                  <SelectValue placeholder="ทุกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="active">ใช้งานได้</SelectItem>
                  <SelectItem value="pending">รออนุมัติ</SelectItem>
                </SelectContent>
              </Select>

              {/* ปุ่มแสดง / ซ่อนรหัสผ่านทั้งหมด */}
              <Button
                variant="outline"
                size="sm"
                className={`h-9 text-xs gap-1.5 transition-colors ${showAllPasswords ? "bg-primary/10 text-primary border-primary/40 font-bold" : "text-muted-foreground"}`}
                onClick={() => {
                  const next = !showAllPasswords;
                  setShowAllPasswords(next);
                  if (next) {
                    toast.info("เปิดแสดงรหัสผ่านของผู้ใช้งานทั้งหมด");
                  } else {
                    toast.info("ซ่อนรหัสผ่านทั้งหมดแล้ว");
                  }
                }}
              >
                {showAllPasswords ? <EyeOff className="h-3.5 w-3.5 text-primary" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showAllPasswords ? "ซ่อนรหัสผ่านทั้งหมด" : "ดูรหัสผ่านทั้งหมด"}</span>
              </Button>

              {/* ปุ่มเพิ่มผู้ใช้งานใหม่ (สำหรับ Admin) */}
              {isAdmin && (
                <Button
                  size="sm"
                  className="h-9 text-xs gap-1.5 font-bold shadow-xs"
                  onClick={() => {
                    setNewUserForm({
                      rank: "พ.อ.อ.",
                      firstName: "",
                      lastName: "",
                      email: "",
                      password: `rcms${Math.floor(1000 + Math.random() * 9000)}`,
                      role: "revenue_officer",
                      status: "active",
                    });
                    setAddUserOpen(true);
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>เพิ่มผู้ใช้ใหม่</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-12 text-center font-bold">ลำดับ</TableHead>
                  <TableHead className="font-bold">ยศ ชื่อ-นามสกุล</TableHead>
                  <TableHead className="font-bold">อีเมล / บัญชีผู้ใช้</TableHead>
                  <TableHead className="font-bold">รหัสผ่าน (Password)</TableHead>
                  <TableHead className="font-bold">สิทธิ์การใช้งาน (Role)</TableHead>
                  <TableHead className="font-bold">สถานะบัญชี</TableHead>
                  <TableHead className="text-right font-bold pr-6">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                      ไม่พบข้อมูลผู้ใช้งานที่ตรงกับเงื่อนไขการค้นหา
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u: AppUser, idx: number) => {
                    const isCurrentMe = u.id === me?.id;
                    const isVisible = showAllPasswords || showPasswords[u.id];

                    return (
                      <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-center text-xs font-mono text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-bold text-xs shadow-2xs">
                              {u.firstName.slice(0, 1)}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-foreground">
                                {fullName(u)}
                                {isCurrentMe && (
                                  <span className="ml-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                    (บัญชีของคุณ)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {u.role === "entrepreneur" ? "ผู้ประกอบการ" : "เจ้าหน้าที่ ชย.ทอ."}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {u.email}
                        </TableCell>

                        {/* แสดงรหัสผ่าน พร้อมปุ่มดู/ซ่อน คัดลอก และเปลี่ยนรหัสผ่าน */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-[125px] max-w-[180px] rounded-lg bg-muted/70 px-2.5 py-1 border border-border/80">
                              <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-mono text-xs font-semibold text-foreground truncate select-all">
                                {isVisible ? (u.password || "—") : "••••••••"}
                              </span>
                            </div>

                            {/* ปุ่มสลับ ดู/ซ่อน รหัสผ่านของคนนี้ */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title={isVisible ? "ซ่อนรหัสผ่าน" : "ดูรหัสผ่าน"}
                              onClick={() =>
                                setShowPasswords((prev) => ({
                                  ...prev,
                                  [u.id]: !isVisible,
                                }))
                              }
                            >
                              {isVisible ? (
                                <EyeOff className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>

                            {/* ปุ่มคัดลอกรหัสผ่าน */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="คัดลอกรหัสผ่าน"
                              onClick={() => {
                                navigator.clipboard.writeText(u.password || "");
                                setCopiedId(u.id);
                                toast.success(`คัดลอกรหัสผ่านของ ${fullName(u)} เรียบร้อย`);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                            >
                              {copiedId === u.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>

                            {/* ปุ่มเปลี่ยนรหัสผ่าน (Admin) */}
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                title="เปลี่ยน / รีเซ็ตรหัสผ่าน"
                                onClick={() => {
                                  setEditingPasswordUser(u);
                                  setNewPasswordVal(u.password || "");
                                  setShowNewPassword(true);
                                }}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={u.role}
                              disabled={!isAdmin}
                              onValueChange={(v) => updateUser({ ...u, role: v as Role })}
                            >
                              <SelectTrigger className="w-52 h-8 text-xs bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES_LIST.map((r) => (
                                  <SelectItem key={r} value={r} className="text-xs">
                                    <div className="flex items-center gap-2">
                                      <span>{ROLE_LABEL[r]}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.status === "active" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/20">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> ใช้งานได้
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/20">
                              <Clock className="mr-1 h-3 w-3" /> รออนุมัติ
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="space-x-2 text-right pr-6">
                          {u.status === "pending" ? (
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              disabled={!isAdmin}
                              onClick={() => approveUser(u.id)}
                            >
                              <UserCheck className="mr-1 h-3.5 w-3.5" /> อนุมัติสิทธิ์
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                            disabled={!isAdmin || isCurrentMe}
                            title={isCurrentMe ? "ไม่สามารถลบบัญชีตัวเองได้" : "ลบผู้ใช้งาน"}
                            onClick={() => {
                              if (confirm(`ยืนยันการลบผู้ใช้งาน "${fullName(u)}"?`)) {
                                deleteUser(u.id);
                              }
                            }}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> ลบ
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal เปลี่ยน / รีเซ็ตรหัสผ่าน */}
      <Dialog open={!!editingPasswordUser} onOpenChange={(open) => !open && setEditingPasswordUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <KeyRound className="h-5 w-5 text-primary" /> เปลี่ยน / รีเซ็ตรหัสผ่าน
            </DialogTitle>
            <DialogDescription>
              กำหนดรหัสผ่านใหม่สำหรับ {editingPasswordUser ? fullName(editingPasswordUser) : ""} ({editingPasswordUser?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">รหัสผ่านปัจจุบัน</Label>
              <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 border border-border">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-xs font-semibold select-all flex-1">
                  {editingPasswordUser?.password || "—"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    if (editingPasswordUser?.password) {
                      navigator.clipboard.writeText(editingPasswordUser.password);
                      toast.success("คัดลอกรหัสผ่านปัจจุบันแล้ว");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> คัดลอก
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-pw" className="text-xs font-bold text-foreground">
                  รหัสผ่านใหม่ <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs text-primary gap-1"
                  onClick={() => {
                    const randomPw = `rcms${Math.floor(1000 + Math.random() * 9000)}`;
                    setNewPasswordVal(randomPw);
                    setShowNewPassword(true);
                  }}
                >
                  <RefreshCw className="h-3 w-3" /> สุ่มรหัสผ่าน
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNewPassword ? "text" : "password"}
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อย่างน้อย 4 ตัวอักษร"
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingPasswordUser(null)}>
              ยกเลิก
            </Button>
            <Button
              disabled={!newPasswordVal || newPasswordVal.trim().length < 4}
              onClick={() => {
                if (!editingPasswordUser) return;
                updateUser({
                  ...editingPasswordUser,
                  password: newPasswordVal.trim(),
                });
                toast.success(`เปลี่ยนรหัสผ่านของ ${fullName(editingPasswordUser)} เรียบร้อยแล้ว`);
                setEditingPasswordUser(null);
              }}
            >
              <Check className="mr-1.5 h-4 w-4" /> บันทึกรหัสผ่านใหม่
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal เพิ่มผู้ใช้งานใหม่ */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <UserPlus className="h-5 w-5 text-primary" /> เพิ่มผู้ใช้งานใหม่ในระบบ
            </DialogTitle>
            <DialogDescription>
              สร้างบัญชีผู้ใช้งาน กำหนดบทบาทสิทธิ์ (Role) และรหัสผ่านเริ่มต้น
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">ยศ / คำนำหน้า</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  value={newUserForm.rank}
                  onChange={(e) => setNewUserForm({ ...newUserForm, rank: e.target.value })}
                >
                  {RANKS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">ชื่อ <span className="text-destructive">*</span></Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="ชื่อ"
                  value={newUserForm.firstName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">นามสกุล <span className="text-destructive">*</span></Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="นามสกุล"
                  value={newUserForm.lastName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">อีเมล / บัญชีผู้ใช้ (Email) <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                className="h-9 text-xs"
                placeholder="example@rcms.rtaf.mi.th"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">รหัสผ่านเริ่มต้น (Password) <span className="text-destructive">*</span></Label>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs text-primary gap-1"
                  onClick={() => {
                    setNewUserForm({
                      ...newUserForm,
                      password: `rcms${Math.floor(1000 + Math.random() * 9000)}`,
                    });
                    setShowAddUserPassword(true);
                  }}
                >
                  <RefreshCw className="h-3 w-3" /> สุ่มรหัสผ่าน
                </Button>
              </div>
              <div className="relative">
                <Input
                  type={showAddUserPassword ? "text" : "password"}
                  className="h-9 pr-10 font-mono text-xs"
                  placeholder="กำหนดรหัสผ่าน"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAddUserPassword(!showAddUserPassword)}
                >
                  {showAddUserPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">บทบาทสิทธิ์ (Role)</Label>
                <Select
                  value={newUserForm.role}
                  onValueChange={(v) => setNewUserForm({ ...newUserForm, role: v as Role })}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_LIST.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">สถานะบัญชี</Label>
                <Select
                  value={newUserForm.status}
                  onValueChange={(v) => setNewUserForm({ ...newUserForm, status: v as "active" | "pending" })}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active" className="text-xs">ใช้งานได้ทันที (Active)</SelectItem>
                    <SelectItem value="pending" className="text-xs">รออนุมัติ (Pending)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              disabled={
                !newUserForm.firstName.trim() ||
                !newUserForm.lastName.trim() ||
                !newUserForm.email.trim() ||
                !newUserForm.password.trim()
              }
              onClick={() => {
                const ok = addUser({
                  rank: newUserForm.rank,
                  firstName: newUserForm.firstName.trim(),
                  lastName: newUserForm.lastName.trim(),
                  email: newUserForm.email.trim(),
                  password: newUserForm.password.trim(),
                  role: newUserForm.role,
                  status: newUserForm.status,
                });
                if (ok) {
                  setAddUserOpen(false);
                }
              }}
            >
              <Check className="mr-1.5 h-4 w-4" /> บันทึกผู้ใช้งานใหม่
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* คู่มือและตารางกำหนดสิทธิ์ตามบทบาท (RBAC Matrix) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* รายละเอียดบทบาทแต่ละตำแหน่ง */}
        <div className="space-y-3 lg:col-span-1">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> คำอธิบายบทบาทสิทธิ์ (Roles)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {ROLES_LIST.map((r) => {
                const info = ROLE_DESCRIPTIONS[r];
                const Icon = info.icon;
                return (
                  <div key={r} className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-bold text-sm text-foreground">{ROLE_LABEL[r]}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed pl-6">{info.desc}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ตารางสิทธิ์เข้าถึงเมนูต่างๆ (Permissions Matrix) */}
        <div className="lg:col-span-2">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> ตารางสิทธิ์การเข้าถึงเมนูและฟังก์ชัน (Permissions Matrix)
              </CardTitle>
              <CardDescription>
                การควบคุมการเข้าถึงตามหลักการแบ่งแยกหน้าที่ (Segregation of Duties)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-[11px]">
                      <TableHead className="font-bold">ฟังก์ชัน / หน้าจอ</TableHead>
                      <TableHead className="text-center font-bold">Admin</TableHead>
                      <TableHead className="text-center font-bold">Supervisor</TableHead>
                      <TableHead className="text-center font-bold">การเงิน</TableHead>
                      <TableHead className="text-center font-bold">ภาคสนาม</TableHead>
                      <TableHead className="text-center font-bold">Auditor</TableHead>
                      <TableHead className="text-center font-bold">ผู้ประกอบการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {PERMISSIONS_MATRIX.map((row, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground py-2.5">
                          {row.feature}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.admin ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="เข้าถึงได้" />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.supervisor ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="เข้าถึงได้" />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.revenue ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="เข้าถึงได้" />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.field ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="เข้าถึงได้" />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.auditor === true ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="เข้าถึงได้" />
                          ) : row.auditor ? (
                            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              {row.auditor}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.user === true ? (
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" title="เข้าถึงได้" />
                          ) : row.user ? (
                            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                              {row.user}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
