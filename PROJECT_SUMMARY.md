# RCMS · ระบบบริหารงานจัดเก็บรายได้ ชย.ทอ. (Package v1.3)

เอกสารสรุปภาพรวมและการติดตั้งใช้งานโครงการ **RCMS (Revenue Collection Management System)** กรมช่างโยธาทหารอากาศ

---

## 📦 โครงสร้างไฟล์ในแพ็กเกจ (Package Contents)

| โฟลเดอร์ / ไฟล์ | รายละเอียด |
| :--- | :--- |
| `src/` | ซอร์สโค้ดหลักของระบบ (React 19, TanStack Start, TypeScript, Tailwind CSS) |
| `src/routes/` | หน้าจอการทำงานหลักทั้งหมด (Dashboard, Customers, Readings, Billing, Payments, History, Service, Approvals, Tasks, Reports, Settings ฯลฯ) |
| `src/components/` | คอมโพเนนต์ UI, ใบแจ้งหนี้ (BillSheet), ใบเสร็จรับเงิน (ReceiptSheet), ตารางจดมิเตอร์ (ReadingSheet), Dialog ส่ง LINE |
| `src/domain/v13/` | Canonical types, State-transition guards, และ Business rules ตาม Consolidated Data State Pack v1.3 |
| `docs/` | เอกสารสถาปัตยกรรม (01-09), OpenAPI 3.1 API contract, คู่มือผู้ใช้งานภาษาไทย (USER_GUIDE_TH.md) |
| `fixtures/` | Test fixtures และ Compound edge-case scenarios |
| `prisma/` | Prisma Schema สำหรับ PostgreSQL Database |
| `tests/` | ชุด Unit Test ทั้ง 22 ชุด (Pass 100%) |
| `start.bat` | สคริปต์ 1-Click สำหรับรันระบบบน Windows อัตโนมัติ |
| `package.json` | รายการ Dependencies และคำสั่ง Build / Dev / Test / Typecheck |

---

## 🚀 วิธีการเปิดใช้งาน (Getting Started)

### วิธีที่ 1: ดับเบิลคลิกไฟล์ `start.bat` (ง่ายที่สุดสำหรับ Windows)
- เพียงดับเบิลคลิกไฟล์ `start.bat`
- ระบบจะตรวจสอบ dependencies และเปิดหน้าเว็บ `http://localhost:8080/` ในเบราว์เซอร์ให้อัตโนมัติ

### วิธีที่ 2: รันผ่าน Terminal / Command Prompt
```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. เริ่มต้นรันเซิร์ฟเวอร์สำหรับพัฒนา
npm run dev

# 3. ตรวจสอบคุณภาพโค้ดและการทดสอบ
npm run typecheck
npm test
npm run build
```

---

## 🌐 ลิงก์เข้าใช้งานระบบเมื่อรันเซิร์ฟเวอร์
- **Local:** [http://localhost:8080/](http://localhost:8080/)
- **Network:** `http://<IP-เครื่อง>:8080/`
