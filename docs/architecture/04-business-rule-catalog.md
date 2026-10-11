# 4. Business Rule Catalog

| ID           | Rule                                                              | ระดับ    | สถานะในชุดนี้                                 |
| ------------ | ----------------------------------------------------------------- | -------- | --------------------------------------------- |
| BR-ID-001    | Tenant, Site, Service Account และ Meter เป็นคนละ Entity           | Critical | ERD/Domain พร้อม; UI เดิมยังใช้ projection    |
| BR-ID-002    | Site ID คงที่ แต่ Site Code มี history/effective date             | Critical | ERD พร้อม                                     |
| BR-SVC-001   | Electricity และ Water มี state/financial scope แยกกัน             | Critical | Domain/ERD พร้อม; UI ปรับบางส่วน              |
| BR-SRC-001   | RCMS ไม่คำนวณ Utility; ใช้ Source `USAGE_UNITS`/`AMOUNT_DUE`      | Critical | Store/หน้า Reading ปรับแล้ว                   |
| BR-IMP-001   | Excel/Manual/API เข้า canonical pipeline เดียว                    | High     | Parser/validator foundation พร้อม             |
| BR-IMP-002   | Batch/record idempotency และ source version ห้าม overwrite        | Critical | Contract/ERD พร้อม; backend รอพัฒนา           |
| BR-IMP-003   | Partial Batch commit valid rows และ queue errors                  | High     | Contract/Domain พร้อม                         |
| BR-READ-001  | Delta ใช้ Validation เท่านั้น                                     | Critical | Unit test พร้อม                               |
| BR-READ-002  | Zero 2 เดือนต้องเป็น Meter เดิม                                   | High     | Rule/test พร้อม                               |
| BR-READ-003  | Meter ใหม่ใน Site เดิมสร้าง replacement review                    | High     | Model พร้อม; UI รอพัฒนา                       |
| BR-BILL-001  | Billing Run ระบุ source data version                              | Critical | ERD/Contract พร้อม                            |
| BR-BILL-002  | Invoice เป็น service-specific; Statement รวมได้เฉพาะ presentation | Critical | Billing store/UI ปรับแล้ว                     |
| BR-BILL-003  | Invoice issue แล้ว snapshot ไม่เปลี่ยนตาม settings ใหม่           | Critical | Model/Contract พร้อม                          |
| BR-PAY-001   | OCR ไม่ใช่ verification authority                                 | Critical | UI ระบุและ workflow คง pending                |
| BR-PAY-002   | Invoice เป็น PAID เมื่อ active allocations ครบยอด                 | Critical | Rule/test พร้อม; adapter store ปรับแล้ว       |
| BR-PAY-003   | Oldest debt first และไม่ cross Site/Service                       | Critical | Rule/test พร้อม                               |
| BR-PAY-004   | หลาย Payment สะสม coverage ได้โดยไม่มี PARTIALLY_PAID state       | Critical | Rule/test พร้อม                               |
| BR-CRD-001   | เงินเกินเข้า Credit Ledger หลัง verify+allocate                   | Critical | Domain/ERD พร้อม; backend/UI รอพัฒนา          |
| BR-CRD-002   | Credit ไม่ cross service อัตโนมัติ                                | Critical | Domain/test fixture พร้อม                     |
| BR-REV-001   | ห้ามลบ financial fact; ใช้ reversal chain                         | Critical | Domain/ERD/Contract พร้อม                     |
| BR-DEBT-001  | Carry-forward debt ไม่ใช่ revenue ใหม่                            | Critical | Report specification พร้อม                    |
| BR-DISC-001  | Disconnection target ได้หนึ่ง Service Account                     | Critical | Domain/UI workflow ปรับแล้ว                   |
| BR-DISC-002  | ยอด target service <= 0 ยกเลิก pending disconnection              | Critical | Rule/test พร้อม                               |
| BR-RECON-001 | Payment verified ไม่ทำ Service active; ต้อง WO complete           | Critical | Transition/role guard พร้อม                   |
| BR-AUD-001   | Manual decision เก็บ source, actor, time, reason                  | High     | Type/Contract พร้อม                           |
| BR-CLOSE-001 | Closed history ห้าม mutate; adjustment post งวดปัจจุบัน           | Critical | Contract/fixture พร้อม                        |
| BR-LINE-001  | LINE fail ไม่ block billing และมี fallback queue                  | High     | UI state map/contract พร้อม                   |
| BR-SEC-001   | Authorization ต้องบังคับฝั่ง Server, password ต้อง hash           | Critical | ระบุ blocker; frontend demo ยังไม่ production |

คำว่า “พร้อม” ในตารางหมายถึงมีข้อกำหนดหรือ foundation ที่ทดสอบได้ ไม่ได้แปลว่า production backend เสร็จแล้ว รายการรอพัฒนาดูในเอกสาร 08
