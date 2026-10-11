# รายงานตรวจสอบ RCMS Revision v1.3

วันที่ตรวจ: 4 กันยายน 2026

## ผลตรวจอัตโนมัติ

| รายการ | ผล |
| --- | --- |
| TypeScript strict type-check | ผ่าน |
| Domain/Excel automated tests | ผ่าน 8/8 |
| ESLint | ผ่าน; เหลือ 12 warnings จาก Fast Refresh export pattern |
| Production build | ผ่าน |
| Production dependency audit | ไม่พบรายงานช่องโหว่จากคำสั่ง audit |
| ไฟล์กองไฟฟ้าที่แนบ | `UTILITY_READING_V1`, อ่าน 547 แถว |
| ไฟล์จัดเก็บรายได้ที่แนบ | `REVENUE_LEDGER_V1`, ไม่ถูกอ่านเป็นเลขจด |

## สิ่งที่แก้ในโค้ดจริง

- เพิ่ม canonical domain/state/rule layer ใน `src/domain/v13`
- เพิ่ม service state แยกไฟฟ้า/น้ำ พร้อม Site ID/Site Code projection
- Reading เก็บ usage/amount/source version/source record และ validation state
- Billing ใช้ source amount และสร้าง financial invoice แยกบริการ
- Payment มี allocation projection และ unallocated amount
- เพิ่ม role 6 กลุ่มและ separation of duties ใน workflow ใบงาน
- เพิ่ม schema classifier ก่อน import Excel
- ฝังโลโก้จริงเป็น static production asset พร้อม watermark บนเอกสาร
- เพิ่ม Prisma schema, OpenAPI contract, fixtures, tests และเอกสารใช้งาน/นำขึ้นระบบ

## ความเสี่ยงที่ยังเปิด

รายการ P0–P2 และ decision ที่ต้องยืนยันอยู่ใน `08-gap-analysis-and-roadmap.md` โดยประเด็นที่ห้ามข้ามก่อน production คือ persistence, server auth/RBAC, transactional API, immutable ledger, migration/reconciliation, real integrations, backup/restore และ UAT/security sign-off

## ข้อโต้แย้งเชิงออกแบบ

ไม่ควรต่อยอด `useState` store ให้เป็น “ฐานข้อมูลจำลองที่ใหญ่ขึ้น” เพราะจะเพิ่มความซับซ้อนแต่ไม่เพิ่มความถูกต้องทางการเงิน ขั้นถัดไปที่คุ้มค่าคือสร้าง backend transaction boundary จาก OpenAPI/Prisma ชุดนี้ แล้วค่อยเปลี่ยน UI ให้เรียก command/query จริงเป็น vertical slice ทีละ workflow
