# ลำดับนำ RCMS ไปใช้งานจริง

## ระยะ 0 — ตัดสินใจก่อนเขียน backend

1. แต่งตั้ง Product Owner, Data Owner, Security Owner และผู้อนุมัติทางบัญชี
2. ยืนยัน Water Site Code, abnormal thresholds, credit/refund policy, closing calendar และเลขเอกสารทางการ
3. เปิด Change Request หากคำตอบขัดกับ Data State Pack v1.3
4. ทำ data classification/retention และ threat model สำหรับข้อมูลส่วนบุคคล การเงิน และสลิป

## ระยะ 1 — ฐานข้อมูลและ API

1. สร้าง PostgreSQL แยก dev/staging/production
2. ตรวจ `prisma/schema.prisma` กับ DBA แล้วสร้าง migration แบบ versioned
3. เพิ่ม partial/functional indexes, foreign keys และ immutable financial event ledger
4. Implement API ตาม `docs/architecture/05-api-contract.yaml`
5. ทุก command ใช้ transaction, idempotency key, optimistic locking และ audit provenance
6. ห้ามให้ frontend เขียน invoice/payment/service state โดยตรง

## ระยะ 2 — Security

1. ย้ายบัญชีออกจาก frontend; hash ด้วย Argon2id
2. ใช้ secure `__Host-` cookie, CSRF protection, session rotation และ lockout
3. เปิด MFA สำหรับ Admin/Supervisor/Auditor
4. ใช้ permission matrix 6 roles พร้อม row/site scope
5. เก็บ secret ใน secret manager และเข้ารหัสข้อมูล/backup
6. ทำ SAST, dependency scan, penetration test และ privacy review

## ระยะ 3 — Data migration และ integration

1. Freeze template versions และสร้าง mapping registry ของทุกต้นทาง
2. นำเข้า staging ก่อนเสมอ; validate → exception review → commit
3. แยก `UTILITY_READING_V1` และ `REVENUE_LEDGER_V1`
4. Reconcile จำนวนแถว ยอดเงิน และ hash ของไฟล์ต้นทาง
5. เชื่อม API กองไฟฟ้า/ประปา, LINE webhook, payment provider และ OCR จริง
6. ทดสอบ retry, duplicate webhook, out-of-order event และ provider outage

## ระยะ 4 — UAT และควบคุมบัญชี

1. รัน fixture A–G และ acceptance matrix ทั้งหมด
2. ทดสอบหลาย Site, สองบริการ, short/overpayment, credit, reversal และ meter replacement
3. เทียบยอด RCMS กับไฟล์ต้นทางและบัญชีธนาคารแบบ 100%
4. ทดสอบสิทธิ์ทุก route/action รวม separation of duties
5. ทดสอบ backup restore และ disaster recovery ตาม RPO/RTO ที่อนุมัติ
6. ให้ Product/Data/Security/Accounting Owners ลงนาม UAT

## ระยะ 5 — Pilot และ Go-live

1. Pilot 20–50 ผู้ประกอบการอย่างน้อย 1–2 รอบบิล
2. รันคู่ขนานกับระบบเดิมและ reconcile รายวัน
3. เตรียม runbook, rollback, on-call และ help desk
4. เปิด production ด้วย least privilege และ monitoring/alerting
5. หลัง go-live ทำ daily reconciliation ช่วงแรก แล้วทบทวนสิทธิ์/ช่องโหว่ตามรอบ

## เกณฑ์ Go/No-Go ขั้นต่ำ

- ไม่มี Critical/High ที่ยังเปิด
- Financial totals ตรงต้นทางและธนาคาร
- Restore backup สำเร็จตาม RPO/RTO
- UAT และ security sign-off ครบ
- มี rollback plan และผู้มีอำนาจตัดสินใจชัดเจน
- LINE/OCR ล่มแล้วงานหลักยังทำต่อผ่าน fallback queue ได้
