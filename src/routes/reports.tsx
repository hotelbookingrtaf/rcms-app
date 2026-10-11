import { createFileRoute } from "@tanstack/react-router";
import { Printer, Search, CalendarDays } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRcms, thb, periodLabel, periodFullThai } from "@/lib/rcms-store";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "สรุปรายงาน · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "สรุปรายได้แยกกองไฟฟ้าและกองประปา ตรวจสอบกับ statement ธนาคาร และส่งออกรายงานเป็น PDF",
      },
      { property: "og:title", content: "สรุปรายงาน · RCMS" },
      { property: "og:description", content: "Financial Handover & Export" },
    ],
  }),
  component: Reports,
});

function Reports() {
  const { payments, bills, customerOf, period } = useRcms();
  const [q, setQ] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const verified = payments.filter((p) => p.status === "verified");
  const rows = verified.map((p) => {
    const b = bills.find((x) => x.id === p.billId);
    const elec =
      b?.lines
        .filter((l) => l.kind === "electric" || l.kind === "service")
        .reduce((s, l) => s + l.amount, 0) ?? 0;
    const water = b?.lines.filter((l) => l.kind === "water").reduce((s, l) => s + l.amount, 0) ?? 0;
    const maint =
      b?.lines.filter((l) => l.kind === "maintenance").reduce((s, l) => s + l.amount, 0) ?? 0;
    return {
      id: p.id,
      date: p.paidAt,
      paidDate: p.paidDate,
      cust: customerOf(p.customerId),
      billType: b?.type === "combined" ? "Combined" : b?.type === "water" ? "Water" : "Electricity",
      elec,
      water,
      maint,
      total: p.amount,
      method: p.method === "online" ? "Online" : "Counter",
      category: water > elec ? "กองประปา" : "กองไฟฟ้า",
      ref: p.ref,
    };
  });

  const filtered = rows
    .filter((r) => (date ? r.paidDate === date : true))
    .filter(
      (r) =>
        (r.cust?.name ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (r.cust?.code ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (r.cust?.shop ?? "").toLowerCase().includes(q.toLowerCase()) ||
        r.ref.toLowerCase().includes(q.toLowerCase()),
    );
  const elecTotal = rows.reduce((s, r) => s + r.elec + r.maint / 2, 0);
  const waterTotal = rows.reduce((s, r) => s + r.water + r.maint / 2, 0);

  const exportPdf = () => window.print();

  const pie = [
    { name: "กองไฟฟ้า", value: Math.max(elecTotal, 0.01) },
    { name: "กองประปา", value: Math.max(waterTotal, 0.01) },
  ];

  return (
    <>
      <PageHeader
        title="สรุปรายงาน"
        desc={`งวด ${periodLabel(period)} · รายการที่ยืนยันการชำระแล้ว ${verified.length} รายการ`}
        actions={
          <Button onClick={exportPdf} disabled={!filtered.length}>
            <Printer className="mr-1 h-4 w-4" /> Export PDF (สั่งพิมพ์ / บันทึกเป็น PDF)
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">รายได้กองไฟฟ้า</p>
            <p className="font-display text-2xl font-bold text-gold-foreground">
              ฿{thb(elecTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ค่าไฟ + ค่าบริการ + ค่ารักษามิเตอร์ไฟฟ้า
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">รายได้กองประปา</p>
            <p className="font-display text-2xl font-bold text-info">฿{thb(waterTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">ค่าน้ำ + ค่ารักษามิเตอร์น้ำ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="h-40 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" innerRadius={35} outerRadius={60} paddingAngle={3}>
                  <Cell fill="oklch(0.79 0.14 84)" />
                  <Cell fill="oklch(0.45 0.12 230)" />
                </Pie>
                <Tooltip formatter={(v: number) => `฿${thb(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            สรุปรายการประจำวัน (ตรวจสอบกับ Statement ธนาคาร)
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                className="w-44 pl-9"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="ค้นหาผู้ประกอบการ / รหัส / อ้างอิง"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              ยังไม่มีรายการชำระที่ยืนยันแล้วในระบบ
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>วันเวลา</TableHead>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ผู้ประกอบการ</TableHead>
                    <TableHead>Bill Type</TableHead>
                    <TableHead className="text-right">ค่าไฟ</TableHead>
                    <TableHead className="text-right">ค่าน้ำ</TableHead>
                    <TableHead className="text-right">ค่ารักษามิเตอร์</TableHead>
                    <TableHead className="text-right">รวม</TableHead>
                    <TableHead>หมวดรายได้</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                      <TableCell className="text-xs">{r.date}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{r.cust?.code ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium">{r.cust?.name}</p>
                        <p className="text-xs text-muted-foreground">{r.cust?.shop}</p>
                      </TableCell>
                      <TableCell className="text-xs">{r.billType}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{thb(r.elec)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{thb(r.water)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{thb(r.maint)}</TableCell>
                      <TableCell className="text-right font-semibold">฿{thb(r.total)}</TableCell>
                      <TableCell className="text-sm">{r.category}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direct Body Portal สำหรับการพิมพ์รายงาน */}
      {typeof document !== "undefined" && filtered.length > 0
        ? createPortal(
            <div
              id="print-root"
              className="p-6 text-black"
              style={{
                fontFamily: "'TH SarabunPSK', 'THSarabunPSK', 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif",
              }}
            >
              <div className="mb-3 text-center">
                <h2 className="text-[16pt] font-bold text-black">
                  กรมช่างโยธาทหารอากาศ — สรุปรายงานรายรับประจำวัน
                </h2>
                <p className="text-[14pt] text-slate-800">
                  งวด {periodLabel(period)} {date ? `· ประจำวันที่ ${periodFullThai(date)}` : ""}
                </p>
              </div>
              <table className="w-full border-collapse text-[13pt] text-black">
                <thead>
                  <tr className="border-t-2 border-b-2 border-black bg-slate-100 text-center font-bold">
                    <th className="border-x border-slate-400 p-1.5 text-center">ลำดับ</th>
                    <th className="border-x border-slate-400 p-1.5 text-center">Transaction</th>
                    <th className="border-x border-slate-400 p-1.5 text-center">วันเวลา</th>
                    <th className="border-x border-slate-400 p-1.5 text-center">รหัส</th>
                    <th className="border-x border-slate-400 p-1.5 text-left">ผู้ประกอบการ (ร้านค้า)</th>
                    <th className="border-x border-slate-400 p-1.5 text-right">ค่าไฟ (บาท)</th>
                    <th className="border-x border-slate-400 p-1.5 text-right">ค่าน้ำ (บาท)</th>
                    <th className="border-x border-slate-400 p-1.5 text-right">ค่าบริการ (บาท)</th>
                    <th className="border-x border-slate-400 p-1.5 text-right">รวม (บาท)</th>
                    <th className="border-x border-slate-400 p-1.5 text-center">หมวด</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => (
                    <tr key={r.id} className="border-b border-slate-300">
                      <td className="border-x border-slate-300 p-1 text-center">{idx + 1}</td>
                      <td className="border-x border-slate-300 p-1 text-center">{r.ref}</td>
                      <td className="border-x border-slate-300 p-1 text-center">{r.date}</td>
                      <td className="border-x border-slate-300 p-1 text-center font-medium">{r.cust?.code ?? "—"}</td>
                      <td className="border-x border-slate-300 p-1 text-left">{r.cust?.name} ({r.cust?.shop || "—"})</td>
                      <td className="border-x border-slate-300 p-1 text-right">{thb(r.elec)}</td>
                      <td className="border-x border-slate-300 p-1 text-right">{thb(r.water)}</td>
                      <td className="border-x border-slate-300 p-1 text-right">{thb(r.maint)}</td>
                      <td className="border-x border-slate-300 p-1 text-right font-bold">{thb(r.total)}</td>
                      <td className="border-x border-slate-300 p-1 text-center">{r.category}</td>
                    </tr>
                  ))}
                  {/* แถวยอดรวมทั้งสิ้น */}
                  <tr className="border-t-2 border-b-2 border-black bg-slate-50 font-bold text-[13.5pt]">
                    <td colSpan={5} className="border-x border-slate-400 p-1.5 text-center">
                      รวมทั้งสิ้น ({filtered.length} รายการ)
                    </td>
                    <td className="border-x border-slate-400 p-1.5 text-right">
                      {thb(filtered.reduce((s, r) => s + r.elec, 0))}
                    </td>
                    <td className="border-x border-slate-400 p-1.5 text-right">
                      {thb(filtered.reduce((s, r) => s + r.water, 0))}
                    </td>
                    <td className="border-x border-slate-400 p-1.5 text-right">
                      {thb(filtered.reduce((s, r) => s + r.maint, 0))}
                    </td>
                    <td className="border-x border-slate-400 p-1.5 text-right font-bold text-[14pt]">
                      {thb(filtered.reduce((s, r) => s + r.total, 0))}
                    </td>
                    <td className="border-x border-slate-400 p-1.5 text-center">—</td>
                  </tr>
                </tbody>
              </table>

              {/* ลายมือชื่อผู้จัดทำรายงาน */}
              <div className="mt-8 flex justify-end text-[13pt] text-black">
                <div className="text-center w-64">
                  <div className="border-b border-dotted border-black pb-4 mb-1"></div>
                  <p className="font-medium">(เจ้าหน้าที่ฝ่ายจัดเก็บรายได้ ชย.ทอ.)</p>
                  <p className="text-[12pt] text-slate-700">ผู้ตรวจสอบและส่งมอบรายงาน</p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
