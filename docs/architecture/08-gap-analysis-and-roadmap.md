# 8. Gap Analysis and Development Roadmap

## ข้อผิดพลาดที่พบในโค้ดต้นฉบับ

| Severity | จุดผิดพลาด                                         | ผลกระทบ                                          | การแก้ในชุดนี้                                                   |
| -------- | -------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Critical | Customer รวม Tenant+Site+2 Services                | หลายร้านและสถานะแยก service ผิด                  | เพิ่ม canonical domain/ERD; UI เดิมเป็น projection ชั่วคราว      |
| Critical | RCMS คำนวณ rate/FT/VAT เอง                         | ยอดต่างจาก source และ invoice ย้อนหลังเปลี่ยนได้ | Billing/Reading ใช้ `amountDue` จาก source                       |
| Critical | Combined bill เป็น financial record                | ชำระ/ตัดบริการข้าม service ได้                   | สร้าง invoice แยก service; combined เป็น presentation mode       |
| Critical | Settle ทำ invoice paid โดยไม่มี allocation ledger  | short/over/reversal ผิด                          | เพิ่ม allocation rule และ coverage derived state                 |
| Critical | Disconnection เปลี่ยน Customer ทั้งราย             | ตัดไฟแล้วน้ำถูกตัดตาม                            | เพิ่ม service state และ target division                          |
| Critical | อนุมัติและปิดงานใช้ guard `role !== staff`         | Admin ทำ field work และสิทธิ์ไม่ตรง              | แยก Supervisor approve / Field Officer complete                  |
| Critical | Password plaintext ใน frontend/seed                | ใช้งานจริงไม่ได้                                 | แสดงคำเตือนและกำหนด server auth/hash เป็น blocker                |
| High     | Import จับคู่ด้วยชื่อ fuzzy โดยสร้าง record ทันที  | ผูกผิดคน/ผิดมิเตอร์                              | canonical validation + RED exception foundation                  |
| High     | Re-import overwrite reading เดิม                   | สูญเสีย source history                           | เพิ่ม batch/source version/idempotency design                    |
| High     | Zero usage เดือนเดียวเป็น “รักษามิเตอร์”           | เปิด case/คิดค่าผิด                              | แยก monitoring กับ zero 2 เดือน meter เดิม                       |
| High     | OCR mock และ random ref                            | ผลทดสอบไม่ repeatable                            | test fixtures deterministic; production integration เป็น blocker |
| High     | LINE ส่งสำเร็จตลอด                                 | ไม่มี retry/fallback                             | เพิ่ม notification state/UI contract                             |
| High     | Audit เป็นข้อความ ไม่มี immutable event/provenance | ตรวจสอบย้อนหลังไม่พอ                             | เพิ่ม provenance/financial event model                           |
| High     | ไม่มี persistence/database                         | refresh แล้วข้อมูลหายและใช้หลายเครื่องไม่ได้     | PostgreSQL/Prisma schema draft; backend เป็นเฟสถัดไป             |
| Medium   | ไม่มี test script                                  | regression สูง                                   | เพิ่ม Node test suite                                            |
| Medium   | ESLint เดิมมี 263 errors ส่วนใหญ่ Prettier         | CI ใช้ไม่ได้                                     | รัน formatter และแก้ lint blockers                               |
| Medium   | Bundle หลักเกิน 500 kB                             | โหลดช้าบนมือถือ                                  | แนะนำ lazy-load xlsx/recharts ในเฟส performance                  |

## สิ่งที่พัฒนาแล้วใน revision นี้

1. Canonical types แยก Tenant/Site/Service/Meter และ 3-layer state
2. State transition guards สำหรับ Reading, Billing, Invoice, Payment, Service, Work Order, Inspection และ Notification
3. Reading validation ที่รักษา source truth และตรวจ zero usage/meter identity
4. Payment allocation rules สำหรับ full-invoice settlement, short payment accumulation และ service isolation
5. Roles 6 กลุ่มและ route permission ที่ละเอียดขึ้น
6. Source amount billing และ service-specific invoice projection
7. Import metadata/validation result ที่แสดง warning/error ได้
8. Prisma ERD draft, OpenAPI contract, fixtures และ automated tests

## Roadmap ที่ต้องทำเพิ่มก่อนใช้งานจริง

### P0 — Production safety

1. สร้าง PostgreSQL migrations จาก Prisma พร้อม unique/partial indexes
2. ย้าย Auth/RBAC ไป Server ใช้ Argon2id, secure cookie, MFA สำหรับ privileged roles และ lockout
3. ย้าย business commands ทั้งหมดไป transactional API; UI ห้าม mutate financial state โดยตรง
4. ทำ immutable Financial Event/Credit/Deposit ledgers และ reversal chain
5. ทำ import staging, malware/file limit, batch versioning, rollback และ exception review
6. ทำ backup/restore, encryption, secret management และ disaster recovery test

### P1 — Operational completeness

1. Customer 360 รองรับหลาย Site/Service/Meter history
2. Billing Period/Run UI พร้อม source version และ invoice snapshot
3. Payment Intent, real QR, bank reconciliation, duplicate slip fingerprint
4. Disconnection approval และ Work Order evidence แบบ service-specific
5. Meter replacement/inspection UI
6. LINE Messaging API/webhook พร้อม signature, retry และ fallback queues
7. Closing/posting/effective date และรายงานที่ไม่นับหนี้เก่าเป็นรายได้ใหม่

### P2 — Quality and scale

1. UAT จาก edge cases ทั้งหมดใน Pack
2. Access-control/security/performance/backup-restore tests
3. Lazy-load spreadsheet/chart modules และ virtualize ตารางใหญ่
4. Monitoring, structured logs, alerting และ audit export
5. Pilot 20–50 ผู้ประกอบการ 1–2 รอบบิลก่อนเปิดเต็มระบบ

## Decision ที่ยังต้องขอหน่วยงานยืนยัน

- Water Site Code pattern
- Abnormal usage thresholds แยก Electricity/Water
- Policy เงินที่เหลือหลังปิด invoice เก่า: hold, unallocated หรือ credit เมื่อใด
- ผู้มีอำนาจ void/reverse/refund และวงเงิน dual control
- Closing calendar, posting period และเลขเอกสารทางการ
- LINE OA/payment provider และ retention/privacy policy
