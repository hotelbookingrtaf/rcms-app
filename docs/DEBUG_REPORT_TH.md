# รายงาน Debug และความพร้อมใช้งาน RCMS v1.3

วันที่ตรวจ: 4 กันยายน 2569 · ขอบเขต: source code, dependency, state/workflow, Prisma schema, Excel import, RBAC, test/build

> ผลสรุป: รุ่นนี้เหมาะสำหรับสาธิตและทดสอบ workflow เท่านั้น ยังไม่ควรรับข้อมูลการเงินจริงจนกว่าจะมี server API, authentication, database transaction, migration และ security test ตามหัวข้อ P0 ด้านล่าง

## จุดผิดพลาดที่แก้แล้ว

| ระดับ | จุดผิดพลาด | ผลกระทบ | การแก้ไข |
|---|---|---|---|
| Critical | `package-lock.json` ไม่ตรง `package.json`; `npm ci` ติดตั้งใหม่ไม่ได้ | CI/deploy ล้ม | สร้าง lockfile ที่ตรง dependency และทดสอบ `npm ci` |
| Critical | Prisma enum เขียนบรรทัดเดียว 41 จุดผิดไวยากรณ์ | สร้าง DB client/migration ไม่ได้ | แยก enum เป็นรูปแบบ Prisma ที่ถูกต้องและเพิ่ม `SiteStatus` |
| Critical | รับชำระหลายบิลข้ามผู้ประกอบการ/ไฟฟ้า/น้ำได้ | ลงบัญชีผิดและเปิดบริการผิดบัญชี | เพิ่ม invariant guard: tenant เดียวและ service account เดียว |
| Critical | ผู้ตรวจสอบมีปุ่มและ function เปลี่ยนสถานะการเงิน | ขัดหลัก read-only/segregation of duties | เพิ่ม action-level RBAC ทั้ง UI และ prototype store |
| High | ผู้ประกอบการเห็น dashboard รวมของทุกคน | ข้อมูลส่วนบุคคลและการเงินรั่ว | แสดงหน้า self-service placeholder และตัดเมนูข้อมูลรวม |
| High | หน้าต่อระบบถือว่าสลิปผ่านทันทีและสร้างใบงานทันที | ต่อระบบก่อนยืนยันเงินจริง | เปลี่ยนเป็น pending review; ไม่สร้าง reconnect จนกว่าจะ verify |
| High | เลขอ้างอิงการชำระซ้ำได้ | รับเงินซ้ำ/กระทบ reconciliation | normalize และตรวจ duplicate active reference |
| High | ยืนยัน/ปฏิเสธ payment ซ้ำหรือย้อนผลเดิมได้ | state ไม่แน่นอน | อนุญาตเฉพาะ `pending/problem` และใช้ bill IDs แทน parse เลขบิล |
| High | pending payment มี allocation เสมือนลงบัญชีแล้ว | รายงานยอดอาจคลาดเคลื่อน | แยก `targetBillIds`; สร้าง allocation หลัง verify เท่านั้น |
| High | Import คืน counters ก่อน React state updater ทำงาน | ตัวเลขผลนำเข้าไม่แน่นอน | คำนวณ batch ก่อนแล้ว commit state ครั้งเดียว |
| High | ชื่อ/มิเตอร์ตรงหลายรายเลือก record แรกเงียบ ๆ | ผูกหน่วยใช้ผิดลูกค้า | ambiguous match ถูกข้ามเพื่อ manual review |
| Medium | นำเข้าไฟล์เดิมซ้ำไม่รู้ตัว | overwrite/provenance ซ้ำ | SHA-256 fingerprint ต่อไฟล์/งวด/บริการ |
| Medium | ไม่จำกัดชนิดและขนาด Excel | memory/DoS และไฟล์ผิดประเภท | รับ `.xlsx/.xls`, ไม่เกิน 10 MB, กันไฟล์ว่าง |
| Medium | Send All แสดง toast แต่ไม่ได้ส่ง/บันทึก audit | ผู้ใช้เข้าใจผิด | เรียก `sendBill` ทุกใบจริงใน prototype |
| Medium | ลบผู้ดูแลตัวเองหรือ admin คนสุดท้ายได้ | ระบบไม่มีผู้ดูแล | กัน self-delete และ last-active-admin |
| Medium | สร้างใบงานซ้ำได้ | งานภาคสนามซ้ำ | กัน open task ประเภท/ผู้ใช้/บริการเดียวกัน |
| Low | ข้อความปิดงานบอกว่าลบ แต่ record ยังอยู่ | ผู้ใช้สับสน | เปลี่ยนข้อความให้ตรงกับการเก็บประวัติ |

## จุดที่ยังต้องแก้ก่อน Production

### P0 — ห้ามเปิดใช้เงินจริงหากยังไม่เสร็จ

1. State อยู่ใน React memory; refresh แล้วข้อมูลหาย และทุก business rule ถูก bypass จาก client ได้ ต้องสร้าง server-side API/use cases และ PostgreSQL transaction
2. รหัสผ่านตัวอย่างอยู่ใน frontend และเทียบ plaintext ต้องใช้ OIDC/SSO หรือ password hash (Argon2id), secure HttpOnly session, MFA สำหรับ admin
3. Prisma schema ยังเป็น draft ไม่มี migration, seed ที่ปลอดภัย, relation/foreign key ครบ, immutable audit/event ledger และ row-level authorization
4. LINE OA, OCR, QR และ sync ต้นทางเป็น mock/สุ่ม (`Math.random`) ต้องใช้ webhook ที่ตรวจ signature, idempotency key, retry queue และ sandbox ของผู้ให้บริการ
5. การ reconnect หลัง verify ยังต้องออกแบบ server orchestration: ตรวจยอดคงเหลือของ service account เป็นศูนย์ → ยกเลิกใบงานตัดที่ pending → สร้าง reconnect request → supervisor approve → field evidence → activate
6. Excel parser ทำงานใน browser และเชื่อถือค่าจากไฟล์มากเกินไป Production ต้อง quarantine, malware scan, limits ต่อ sheets/rows/cells, staging table, mapping review และ atomic commit
7. ใบเสร็จ/รายงานยังไม่ได้ใช้ immutable financial event และเลขเอกสารแบบ concurrency-safe ต้องกำหนด sequence/void/reversal ตามระเบียบการเงิน

### P1 — ต้องเสร็จก่อน UAT

- ทำ data migration/reconciliation ของไฟล์เก่า พร้อม control totals และ exception report
- เพิ่ม API contract implementation, OpenAPI validation, error codes และ optimistic concurrency/version column
- เพิ่ม Playwright E2E สำหรับ 6 roles, responsive viewport, print/PDF golden tests และ accessibility (WCAG 2.2 AA)
- กำหนด date/time เป็น ISO-8601 ในฐานข้อมูล; format ภาษาไทยเฉพาะ presentation layer
- เพิ่ม backup/restore drill, retention, encryption, secret rotation, monitoring และ incident runbook
- แยก component utility exports เพื่อล้าง ESLint Fast Refresh warnings 12 จุด
- แยก lazy chunks สำหรับ Recharts/XLSX; build ปัจจุบันเตือน client bundle ใหญ่

## ผลตรวจอัตโนมัติ

- TypeScript: ผ่าน
- Unit/invariant tests: 11/11 ผ่าน
- ESLint: 0 errors, 12 development warnings
- Prisma schema validation: ผ่านหลังแก้
- Production build: ผ่าน (มี bundle-size warning)

## ข้อเสนอเชิงออกแบบ

- ใช้ “append-only financial events + projections” สำหรับรับเงิน/ยกเลิก/คืนเงิน แทนแก้ยอดเดิมโดยตรง
- ใช้ staging import: Upload → Classify → Validate → Preview exceptions → Approve → Commit → Reconcile
- ใช้ policy function เดียวบน server และ test matrix ตาม role/action; UI guard มีไว้เพื่อ UX ไม่ใช่ security boundary
- แยก service account ไฟฟ้า/น้ำโดยเด็ดขาด แม้ Statement จะแสดงรวมได้
