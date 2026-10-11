# 7. UI State Map

| หน้าจอ          | Business/Data state ที่แสดง                              | Action                    | สิทธิ์หลัก                 | Empty/Error/Blocked state                       |
| --------------- | -------------------------------------------------------- | ------------------------- | -------------------------- | ----------------------------------------------- |
| Dashboard       | Exceptions, payments, debt, meter changes, LINE failures | drill-down                | ตาม route scope            | แยก “ไม่มีข้อมูล” กับ “โหลดไม่สำเร็จ”           |
| Customer 360    | Tenant → Sites → Services → Meters → invoices/debt       | view/edit scoped data     | Revenue/Admin/Auditor read | ห้ามใช้ customer badge เดียวแทนทุก service      |
| Import          | Batch, source version, canonical rows                    | upload/validate/commit    | Revenue/Utility            | duplicate, obsolete template, partial batch     |
| Exception Queue | RED/YELLOW issues                                        | assign/review/resolve     | Revenue/Utility ตาม scope  | reason/evidence บังคับเมื่อ manual decision     |
| Readings        | source usage/amount + delta                              | manual entry/validate     | Revenue/Utility            | zero monitoring ไม่แสดงเป็น error เดือนแรก      |
| Billing Run     | period/run/source version                                | validate/issue/cancel     | Revenue                    | block เฉพาะ affected service ไม่ block ทั้ง run |
| Statement       | service invoices grouped by Site/Period                  | print/send                | Revenue                    | version/superseded ต้องมองเห็น                  |
| Payments        | intent/slip/OCR/payment                                  | verify/reject             | Revenue                    | OCR low confidence และ duplicate แยกกัน         |
| Allocation      | coverage/remaining/unallocated                           | allocate/hold             | Revenue                    | ห้าม cross service โดยเงียบ                     |
| Credit          | service-scoped ledger                                    | apply/hold/refund request | Revenue/Auditor            | balance derived from events                     |
| Collection      | service outstanding                                      | request disconnect        | Revenue                    | pending request cancel เมื่อยอดเหลือ 0          |
| Work Orders     | assigned/in progress/evidence                            | start/complete            | Field Officer              | scope conflict ต้อง block                       |
| Reports/Audit   | financial events/history                                 | export                    | Supervisor/Auditor         | closed periods read-only                        |
| Settings        | policy/integration/RBAC                                  | configure                 | Admin                      | ไม่แสดง password plaintext/hash                 |
| Entrepreneur    | eBill/intent/slip/receipt/service status                 | submit/view               | Entrepreneur scoped link   | secure token expiry/invalid recipient           |

## Responsive rules

- Desktop: sidebar + data grid + detail panel
- Tablet: collapsible sidebar, two-column cards, horizontal data grid whenจำเป็น
- Mobile: one-column task cards, sticky primary action, detail full-screen sheet
- ทุก asynchronous action ต้องมี `idle/loading/success/error/retry` และป้องกันกดซ้ำด้วย idempotency key
- สีใช้บอก severity ร่วมกับ icon+ข้อความเสมอ ไม่ใช้สีเพียงอย่างเดียว
