# 1. State Dictionary

## หลักการตั้งชื่อ

- ID ภายในเป็น immutable UUID/CUID และไม่ใช้รหัสธุรกิจเป็น Primary Key
- ค่า state ใช้ `UPPER_SNAKE_CASE`
- เวลาเก็บ ISO-8601 UTC โดยแยก `effective_at` กับ `recorded_at`
- จำนวนเงินใช้ Decimal ห้ามใช้ floating point ในฐานข้อมูล
- ทุกข้อมูลจากต้นทางเก็บ `source_system`, `source_record_id`, `source_data_version`

## Business identity

| Entity            | Key                    | หน้าที่                         | ข้อห้าม                                        |
| ----------------- | ---------------------- | ------------------------------- | ---------------------------------------------- |
| Tenant            | `tenant_id`            | บุคคล/นิติบุคคลผู้ประกอบการ     | ห้ามใช้แทน Site หรือสถานะ Service              |
| Site              | `site_id`              | ร้าน/จุดให้บริการหนึ่งแห่ง      | เปลี่ยนมิเตอร์แล้วห้ามสร้าง Site ใหม่อัตโนมัติ |
| Site Code History | `site_code_history_id` | ประวัติรหัสธุรกิจของ Site       | ห้ามแก้ทับรหัสเดิมโดยไม่มี Effective Date      |
| Service Account   | `service_account_id`   | Electricity หรือ Water ของ Site | ห้ามรวมสถานะไฟฟ้าและประปา                      |
| Meter             | `meter_id`             | อุปกรณ์วัดของ Service Account   | เลขมิเตอร์ไม่ใช่ identity ถาวรของ Site         |

## Data states

| Aggregate       | States                                                                                          | ความหมายสำคัญ                                        |
| --------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Tenant          | `REGISTERED`, `ACTIVE`, `SUSPENDED`, `TERMINATED`                                               | Tenant ไม่ถูก suspend เพียงเพราะ Service หนึ่งถูกตัด |
| Service Account | `REGISTERED`, `ACTIVE`, `SUSPENSION_PENDING`, `SUSPENDED`, `RECONNECTION_PENDING`, `TERMINATED` | เป็นสถานะจริงของบริการแต่ละชนิด                      |
| Meter           | `UNASSIGNED`, `REGISTERED`, `ACTIVE`, `SUSPENDED`, `REMOVED`, `REPLACED`                        | เก็บประวัติมิเตอร์เดิมเสมอ                           |
| Reading         | `RECEIVED`, `VALIDATING`, `VALID`, `EXCEPTION`, `LOCKED`, `SUPERSEDED`                          | Delta ใช้ตรวจ ไม่แก้ Usage จาก Source                |
| Import Batch    | `RECEIVED`, `VALIDATING`, `COMMITTED`, `COMMITTED_WITH_ERRORS`, `REJECTED`, `SUPERSEDED`        | รองรับ Partial Batch และ Versioning                  |
| Exception       | `OPEN`, `IN_REVIEW`, `RESOLVED`, `DISMISSED`                                                    | RED ต้อง Review ก่อนใช้ทางการเงิน                    |
| Billing Period  | `OPEN`, `IMPORTING`, `VALIDATING`, `READY_TO_BILL`, `BILLING`, `ISSUED`, `CLOSED`               | Closing ห้ามแก้ history ตรง ๆ                        |
| Billing Run     | `DRAFT`, `READY`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`                              | ต้องอ้าง Source Data Version                         |
| Invoice         | `DRAFT`, `VALIDATED`, `ISSUED`, `SENT`, `PAID`, `OVERDUE`, `VOID`, `CANCELLED`                  | ไม่มี `PARTIALLY_PAID`                               |
| Payment         | `RECEIVED`, `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`, `REVERSED`                          | OCR ไม่ใช่ Verification                              |
| Payment Intent  | `DRAFT`, `SUBMITTED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `EXPIRED`, `CANCELLED`                | ผูก Tenant + Site + Service + Invoice Set            |
| Slip            | `RECEIVED`, `PROCESSING`, `OCR_COMPLETED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED`             | Duplicate check ต้องมากกว่า amount+date              |
| Work Order      | `CREATED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`                                  | Payment verified ไม่ทำให้ Service active เอง         |
| Inspection      | `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`                                      | หนึ่ง Meter มี Open case ได้ไม่เกินหนึ่งรายการ       |

## Financial ledgers

| Entity             | Event/State                                                                                                    | หลักการ                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Payment Allocation | `ACTIVE`, `REVERSED`                                                                                           | รวมหลาย Payment เพื่อให้ Invoice ครบยอดได้     |
| Credit Ledger      | `CREDIT_ADDED`, `CREDIT_APPLIED`, `CREDIT_HELD`, `CREDIT_REFUNDED`, `REVERSAL`                                 | Balance คำนวณจาก Ledger และจำกัด Service Scope |
| Deposit Ledger     | `DEPOSIT_RECEIVED`, `DEPOSIT_APPLIED`, `DEPOSIT_ADJUSTMENT`, `DEPOSIT_REFUND`                                  | แยกตาม Service                                 |
| Financial Event    | `CHARGE`, `PAYMENT`, `ALLOCATION`, `CREDIT_ADDED`, `CREDIT_APPLIED`, `ADJUSTMENT`, `REVERSAL`, `DEPOSIT_EVENT` | Append-only; ห้ามลบ fact                       |

## Risk and exception codes

`GREEN` ทำงานอัตโนมัติ, `YELLOW` เตือนแต่ดำเนินการต่อได้ตาม policy, `RED` ต้อง Review

รหัสหลัก: `MISSING_READING`, `USAGE_MISMATCH`, `ZERO_USAGE_2_MONTHS`, `METER_CHANGE`, `SITE_MISMATCH`, `DUPLICATE`, `SOURCE_CONFLICT`, `USAGE_ANOMALY`, `ZERO_AMOUNT`, `ZERO_BOTH`, `USAGE_AMOUNT_MISMATCH`
