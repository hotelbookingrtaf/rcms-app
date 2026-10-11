# คู่มือนำ RCMS ไปใช้งานจริง

## ลำดับที่แนะนำ

1. **Freeze specification** — ให้เจ้าของงาน การเงิน กองไฟฟ้า กองประปา ผู้ตรวจสอบ และ IT ลงนาม State Dictionary, ERD, Transition Matrix, Business Rules, API Contract, Fixtures และ UI State Map ใน `docs/v1.3/` กำหนดผู้อนุมัติแต่ละเอกสาร
2. **ตั้ง Git และ CI** — เก็บ source ใน private repository, เปิด branch protection และให้ workflow `.github/workflows/ci.yml` ผ่านก่อน merge ทุกครั้ง
3. **เตรียมเครื่องนักพัฒนา** — ติดตั้ง Git, Node.js 22 LTS และ Docker/Podman จากนั้น `cp .env.example .env`, เปลี่ยน secret, `docker compose up -d`, `npm ci`, `npm run db:validate`
4. **สร้าง backend จริง** — ทำ authentication/session, authorization, use-case services และ REST API จาก contract ห้าม route เขียนฐานข้อมูลโดยตรง
5. **ทำฐานข้อมูล** — เติม relation/index/constraints, สร้าง Prisma migration ที่ review ได้, seed เฉพาะ reference data และทดสอบ migrate/rollback บนสำเนาข้อมูล
6. **สร้าง Import staging** — upload object storage → virus scan → SHA-256 → classify → parse → staging → exception review → approve → transaction commit → reconciliation report ห้าม import เข้า production table โดยตรง
7. **เชื่อมระบบภายนอก** — ใช้ LINE sandbox/webhook signature, OCR confidence threshold, dead-letter queue และ idempotency; QR/Payment reference ต้องตรวจจากแหล่งธุรกรรมจริง
8. **เพิ่มการทดสอบ** — unit, API integration กับ PostgreSQL, contract, E2E 6 roles, accessibility, responsive, print, load และ OWASP security scan
9. **ตั้งสภาพแวดล้อม** — แยก Development/UAT/Production คนละ DB/secrets/domain; เปิด TLS, firewall/VPN, least privilege, encrypted backup และ central logs
10. **ย้ายข้อมูลแบบซ้อม** — ทำ dry-run อย่างน้อย 2 รอบ เปรียบเทียบจำนวนราย ยอดรวมรายบริการ/งวด รายการซ้ำ รายการ unmatched และให้การเงินลงนาม
11. **UAT และอบรม** — ทดสอบ happy path/exception/reversal/ตัด-ต่อบริการตาม role พร้อมคู่มือและช่องทางแจ้งเหตุ
12. **Go-live แบบควบคุม** — freeze ข้อมูลเดิม, final import, reconcile, เปิดใช้กลุ่มเล็ก, monitor 24–72 ชม., มี rollback decision และ hypercare

## ทดลองรุ่นนี้บนเครื่อง (Demo เท่านั้น)

```bash
unzip "rcms-app-main (v1.3).zip"
cd rcms-app-main
npm ci
npm run check
npm run dev -- --host 0.0.0.0
```

เปิด `http://localhost:3000` (ถ้า terminal แจ้ง port อื่นให้ใช้ URL ที่ Vite แสดง) และใช้เฉพาะข้อมูลจำลอง ห้ามเปิด port นี้สู่อินเทอร์เน็ต

## เครื่องมือฟรีที่เหมาะสม

| งาน | เครื่องมือ | หมายเหตุ |
|---|---|---|
| Source/CI | Git + GitHub Actions หรือ GitLab CE | ฟรีตาม license/quota; private government code ต้องตั้งสิทธิ์และ retention |
| Runtime/DB | Node.js, PostgreSQL, Prisma | Open source; ค่าเครื่อง/ดูแลระบบยังมี |
| Container/TLS | Podman หรือ Docker Engine, Caddy | เหมาะกับ self-host; Caddy จัด TLS reverse proxy |
| Test | Vitest/Node Test, Playwright, axe-core | unit/E2E/accessibility |
| Security | OWASP ZAP, Semgrep Community, Gitleaks, Trivy, ClamAV | DAST/SAST/secrets/container/file scan |
| Observability | OpenTelemetry, Prometheus, Grafana, Loki, Uptime Kuma | metrics/logs/uptime แบบ self-host |
| Object storage/backup | MinIO, Restic | ต้องทดสอบ restore และแยก backup account |
| Local email/queue | Mailpit, Redis หรือ RabbitMQ | Mailpit ใช้ dev เท่านั้น |

คำว่า “ฟรี” หมายถึงค่า license หรือ free quota ไม่ได้แปลว่าไม่มีค่าบุคลากร เครื่องสำรอง ความปลอดภัย และการบำรุงรักษา สำหรับข้อมูลการเงินของหน่วยงาน ควรเลือก self-host หรือผู้ให้บริการที่ผ่านการอนุมัติ มากกว่าตัดสินจาก free tier

## เกณฑ์อนุมัติ Go-live

- ไม่มี P0 เปิดค้าง; P1 มีผู้รับความเสี่ยงลงนาม
- tests/CI/security scan ผ่าน และไม่มี Critical/High ที่ไม่ยอมรับ
- restore backup สำเร็จตาม RPO/RTO ที่กำหนด
- reconciliation ข้อมูลและยอดเงิน 100%; unmatched มีเจ้าของและแนวทางแก้
- RBAC/UAT ครบทุก role และ audit log ตรวจย้อนกลับได้
- runbook incident/rollback/LINE outage/OCR failure พร้อมผู้รับผิดชอบ
