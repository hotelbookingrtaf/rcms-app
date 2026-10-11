# RCMS · ระบบบริหารงานจัดเก็บรายได้ ชย.ทอ.

Revision นี้ปรับโครงสร้างตาม **RCMS Consolidated Data State Pack v1.3** โดยมี canonical domain, state-transition guards, business rules, test fixtures, OpenAPI draft และ Prisma/PostgreSQL schema draft อยู่ใน repository เดียวกัน

> สถานะปัจจุบัน: **functional prototype + production architecture baseline** ยังไม่ควรใช้รับเงินจริงจนกว่างาน P0 ใน `docs/architecture/08-gap-analysis-and-roadmap.md` จะเสร็จ

## เริ่มใช้งานสำหรับนักพัฒนา

ต้องใช้ Node.js 22 ขึ้นไป

```bash
npm install
npm run dev
```

ตรวจคุณภาพก่อนส่งงาน:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## เอกสาร

- `docs/architecture/` — เอกสาร 1–9 ตามลำดับงาน v1.3
- `docs/reference/RCMS_Consolidated_Data_State_Pack_v1_3.md` — Source of Truth ที่ใช้ในการแก้ไข
- `docs/USER_GUIDE_TH.md` — คู่มือผู้ใช้งาน
- `docs/PRODUCTION_DEPLOYMENT_TH.md` — ขั้นตอนนำไปใช้งานจริง
- `prisma/schema.prisma` — database model draft
- `docs/architecture/05-api-contract.yaml` — OpenAPI 3.1 contract draft
- `src/domain/v13/` — canonical types, state guards และ rules
- `fixtures/compound-edge-cases.json` — test fixtures จาก compound scenarios

## หลักที่ห้ามละเมิด

- Tenant ไม่ใช่ Site และ Site ID ไม่ใช่ Site Code
- ไฟฟ้าและประปาเป็นคนละ Service Account และคนละ financial invoice
- RCMS เก็บ `usageUnits`/`amountDue` จากต้นทาง ห้ามคำนวณ tariff เอง
- Invoice เป็น `PAID` เมื่อ active allocation ครบยอดเท่านั้น
- ห้ามลบธุรกรรมการเงินเพื่อแก้ย้อนหลัง ให้สร้าง reversal/adjustment event
- การอนุมัติใบงานและการปิดงานภาคสนามเป็นคนละหน้าที่
