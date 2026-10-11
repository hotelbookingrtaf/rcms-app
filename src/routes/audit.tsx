import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { History, Search } from "lucide-react";
import { PageHeader } from "@/components/rcms/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRcms } from "@/lib/rcms-store";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log · RCMS ชย.ทอ." },
      {
        name: "description",
        content:
          "บันทึกการใช้งานระบบทุกรายการ ใครทำอะไร เมื่อไหร่ กับข้อมูลใด สำหรับการตรวจสอบย้อนหลัง",
      },
      { property: "og:title", content: "Audit Log · RCMS" },
      { property: "og:description", content: "บันทึกการใช้งานระบบเพื่อการตรวจสอบย้อนหลัง" },
    ],
  }),
  component: Audit,
});

function Audit() {
  const { logs } = useRcms();
  const [q, setQ] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const list = logs
    .filter((l) => (date ? l.date === date : true))
    .filter((l) => (l.action + l.actor + l.target).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Audit Log"
        desc={`บันทึกทุกการกระทำในระบบ (ใคร ทำอะไร เมื่อไหร่ กับข้อมูลใด) · ${date ? `รายการวันที่ ${date}` : "ทุกวัน"}`}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          type="date"
          className="w-44 bg-card"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 text-sm text-muted-foreground"
          onClick={() => setDate("")}
        >
          ดูทั้งหมด
        </button>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="bg-card pl-9"
            placeholder="ค้นหาบันทึก / ชื่อผู้ใช้งาน"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> {list.length} รายการ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground">{l.at}</span>
              <Badge variant="secondary">{l.actor}</Badge>
              <span className="flex-1">{l.action}</span>
              <span className="font-mono text-xs text-muted-foreground">{l.target}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
