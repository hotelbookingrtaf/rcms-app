# RCMS v1.3 Architecture Baseline

เอกสารชุดนี้แปลง `RCMS Consolidated Data State Pack v1.3` ให้เป็นข้อกำหนดที่นำไปพัฒนาและทดสอบได้ โดย Pack เป็น Source of Truth หาก requirement ใหม่ขัดกันต้องเปิด Change Request ก่อนแก้ Core Logic

1. [State Dictionary](01-state-dictionary.md)
2. [Database ERD](02-database-erd.md)
3. [State Transition Matrix](03-state-transition-matrix.md)
4. [Business Rule Catalog](04-business-rule-catalog.md)
5. [API Contract](05-api-contract.yaml)
6. [Test Fixtures](06-test-fixtures.md)
7. [UI State Map](07-ui-state-map.md)
8. [Gap Analysis and Roadmap](08-gap-analysis-and-roadmap.md)
9. [Verification Report](09-verification-report-th.md)

โค้ดกฎกลางอยู่ที่ `src/domain/v13` และแบบจำลองฐานข้อมูลอยู่ที่ `prisma/schema.prisma`
