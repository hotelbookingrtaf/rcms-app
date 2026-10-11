# RCMS — Consolidated Data State Pack v1.3
## Simulation-Hardened / Pre-ERD Master Context Lock

> **สถานะ:** Revised, Simulation-Hardened Baseline
>
> เอกสารนี้รวบรวมการ brainstorm, การจำลองใช้งานจริง, การโต้แย้ง/ทบทวน และ Decision ล่าสุดของ RCMS ก่อนเข้าสู่ State Dictionary, Database ERD, State Transition Matrix, API Contract และ Vibe Coding
>
> หาก requirement ใหม่ขัดกับเอกสารนี้ ให้ถือเป็น **Change Request** และอัปเดต Pack ก่อน ไม่เปลี่ยน Core Logic เงียบ ๆ

---

# 0. Executive Summary

RCMS = Revenue Collection Management System สำหรับศูนย์กลางงานจัดเก็บรายได้และติดตามหนี้ของ **Electricity** และ **Water**

RCMS ทำหน้าที่:

- รับข้อมูลผู้ประกอบการ / ร้าน / จุดใช้บริการ
- รับ Meter / Reading / Amount Due จากต้นทาง
- รองรับ Excel / Manual / API
- Identify / Validate / Exception Review / Commit
- ออก Invoice
- ติดตาม Debt รายเดือนและราย Service
- รับ Payment
- Verify Slip / OCR
- Full-Invoice Settlement
- รองรับ Short Payment และ Overpayment
- Credit Ledger / Reversal
- Receipt / E-Receipt
- LINE OA
- Disconnection / Reconnection
- Work Order
- Meter Replacement
- Inspection กรณี Usage = 0 ต่อเนื่อง 2 เดือน
- Financial History 120 เดือน
- Audit / Reporting

**RCMS ไม่ใช่ Utility Calculation Engine**

ระบบต้นทาง เช่น Electricity Web App / Water Web App เป็นผู้คำนวณรายละเอียด Utility เช่น Rate, FT, VAT, Service Charge, Tier และค่าใช้จ่ายย่อยตามกติกาของแต่ละกอง

RCMS รับยอดที่คำนวณเสร็จแล้วใน `AMOUNT_DUE`

---

# 1. Context Lock — Core Decisions

## 1.1 Electricity / Water แยก Service

```text
Tenant
 ├── Electricity Service
 └── Water Service
```

สถานะไฟฟ้าและประปาเปลี่ยนแยกกันได้

```text
Electricity = SUSPENDED
Water       = ACTIVE
```

---

## 1.2 Tenant ≠ Site

ผู้ประกอบการหนึ่งคนมีหลายร้านได้

```text
Customer
 ├── Site A
 ├── Site B
 └── Site C
```

**Customer และ Site ต้องเป็นคนละ Entity**

---

## 1.3 Site ID ≠ Site Code

```text
SITE_ID
= Internal immutable identity

SITE_CODE
= Operational / Business identifier
```

Site ID ไม่เปลี่ยนเมื่อเปลี่ยน Meter
Site Code อาจเปลี่ยนตาม Meter ตาม Policy

---

## 1.4 Electricity Site Code

กองไฟฟ้าใช้เลขมิเตอร์รูปแบบ:

```text
XXXXX-XXX
```

โดย:

```text
XXXXX = Zone
XXX   = Meter
```

RCMS ใช้:

```text
EM + XXXXX-XXX
```

ตัวอย่าง:

```text
Meter = 100531-002
Site Code = EM100531-002
```

---

## 1.5 Water Site Code

ใช้แนวคิด:

```text
WM + <numeric pattern>
```

Numeric Pattern ของกองประปายังไม่ล็อกจนกว่าจะได้รับรูปแบบจริง

---

# 2. System Boundary

```text
┌───────────────────────────┐
│ Electricity / Water       │
│ Source Systems            │
│                           │
│ Meter                     │
│ Reading                   │
│ Utility Calculation       │
│ Rate / FT / VAT / etc.    │
└─────────────┬─────────────┘
              │
              │ Source Data + Amount Due
              ▼
┌───────────────────────────┐
│            RCMS           │
│                           │
│ Customer / Site           │
│ Service / Meter Ref       │
│ Invoice / Debt            │
│ Payment / Allocation      │
│ Credit / Receipt          │
│ Collection / Work Order   │
│ Financial History / Audit │
└───────────────────────────┘
```

RCMS **ไม่คำนวณใหม่**:

- ค่าไฟ
- ค่าน้ำ
- FT
- VAT
- Tier Rate
- Service Charge
- Meter Maintenance
- Utility Calculation อื่น ๆ

ข้อมูล Utility เชิงลึกอยู่ใน Source System และโปรเจกต์ Web App ของกอง

---

# 3. Financial History

RCMS ต้องรองรับประวัติด้านการเงินย้อนหลัง **120 เดือน** อย่างเป็นระบบ

เน้น:

```text
Invoice
Debt
Payment
Payment Allocation
Credit Ledger
Receipt
Collection
Financial Events
Audit
```

ควรเก็บ `source_system`, `source_record_id`, `source_reference` เพื่อ trace กลับต้นทาง โดยไม่ copy Utility Calculation Model ทั้งชุดเข้า RCMS

---

# 4. 3-Layer State Model

```text
BUSINESS STATE
     ↓
DATA STATE
     ↓
WORKFLOW STATE
```

### Business State
ความจริงทางธุรกิจ เช่น:

```text
Tenant Active
Electricity Suspended
Water Active
Debt Overdue
Payment Verified
```

### Data State
หลักฐาน เช่น:

```text
Tenant
Site
Service
Meter
Reading
Invoice
Payment
Allocation
Credit
Receipt
```

### Workflow State
ขั้นตอนปฏิบัติงาน เช่น:

```text
Validating
Pending Review
Pending Approval
Work Order Open
Inspection Required
Retrying
```

**ห้ามใช้ field เดียวแทนทั้ง 3 มิติ**

---

# 5. Role Model

```text
ADMIN
SUPERVISOR
REVENUE_OFFICER
UTILITY_FIELD_OFFICER
AUDITOR
ENTREPRENEUR
```

## ADMIN

- User / Role / Permission
- Settings
- Integration
- Import Template
- Audit
- System Configuration

## SUPERVISOR

หน้าที่หลัก:

> อนุมัติ / ปฏิเสธการระงับบริการ

**ไม่มี Special Case Approval ใน V1**

ไม่สร้าง workflow สำหรับ:

- ยกเว้นค่าปรับ
- แก้ยอดแบบ Special Case
- Credit Note Approval
- Debit Note Approval
- Payment Plan Approval
- เลื่อนตัดบริการแบบ Special Case

## REVENUE_OFFICER

- Customer / Site
- Excel Import
- Manual Reading
- Reading Validation
- Billing
- Invoice
- Payment
- Slip / OCR Verification
- Allocation
- Receipt
- Debt / Collection
- Disconnection Request
- Export

**สามารถ Import Reading ได้ทั้ง Excel และ Manual ทั้ง Electricity / Water ตาม Permission / Scope**

## UTILITY_FIELD_OFFICER

รวม Utility Operator + Technician

### Utility
- Reading Import
- Manual Reading
- Validation
- Meter Management
- Meter Replacement Review

### Field
- Work Order
- Install
- Disconnect
- Reconnect
- Remove
- Replace
- Inspect
- Evidence
- Complete

Scope:

```text
ELECTRICITY
WATER
ELECTRICITY + WATER
```

## AUDITOR

Read Only:

- History
- Financial History
- Audit
- Import / Reading / Invoice / Payment / Work Order History

## ENTREPRENEUR

ผ่าน:

```text
LINE OA
+
Secure Web Link เมื่อจำเป็น
```

- รับ eBill
- ดูยอดปัจจุบัน/ค้าง
- เลือก Invoice
- รับ Payment Intent
- ชำระ
- ส่ง Slip
- รับ E-Receipt
- ดู Service Status

---

# 6. Permission Model

```text
USER
 ↓
ROLE
 ↓
PERMISSION
 ↓
RESOURCE
 ↓
ACTION
 ↓
SCOPE
```

Actions หลัก:

```text
VIEW CREATE EDIT IMPORT VALIDATE VERIFY ISSUE SEND PRINT EXPORT APPROVE VOID REVERSE COMPLETE
```

---

# 7. Core Domain Model

```text
Tenant
  ↓
Site
  ↓
Service Account
  ↓
Meter
  ↓
Monthly Reading
```

```text
Billing Period
  ↓
Billing Run
  ↓
Invoice
  ↓
Debt
```

```text
Payment
  ↓
Payment Allocation
  ↓
Receipt
```

```text
Payment
  ↓
Credit Ledger (เมื่อมีเงินเกิน/เครดิต)
```

```text
Approval
  ↓
Work Order
  ↓
Field Action
  ↓
Service State
```

---

# 8. Tenant

ข้อมูลหลัก:

```text
tenant_id
customer_code
customer_name
phone
line_user_id
status
created_at
updated_at
```

State:

```text
REGISTERED
ACTIVE
SUSPENDED
TERMINATED
```

การถูกตัดไฟไม่ควรทำให้ Tenant ทั้งรายกลายเป็น SUSPENDED หาก Water ยัง Active

---

# 9. Site

```text
site_id
tenant_id
site_code
site_name
location
status
```

Site เป็นตัวสำคัญสำหรับ:

- Billing
- Debt
- Payment Intent
- Service
- Meter
- Invoice

---

# 10. Service Account

```text
service_account_id
site_id
service_type
status
start_date
end_date
```

Service Type:

```text
ELECTRICITY
WATER
```

State:

```text
REGISTERED
ACTIVE
SUSPENSION_PENDING
SUSPENDED
RECONNECTION_PENDING
TERMINATED
```

---

# 11. Meter

```text
meter_id
service_account_id
meter_number
status
installation_date
removal_date
```

State:

```text
UNASSIGNED
REGISTERED
ACTIVE
SUSPENDED
REMOVED
REPLACED
```

---

# 12. Meter Replacement

การเปลี่ยน Meter ไม่ทำให้ Site ใหม่โดยอัตโนมัติ

```text
Site
 ├── Meter A
 │    └── Historical Readings
 │
 └── Meter B
      └── Historical Readings
```

Replacement Event ต้องเก็บ:

```text
replacement_event_id
site_id
service_account_id
old_meter_id
new_meter_id
replacement_date
reason
old_final_reading
new_initial_reading
source
status
verified_by
verified_at
note
```

Reason:

```text
DAMAGED
MALFUNCTION
CALIBRATION
UPGRADE
LOST
MAINTENANCE
OTHER
```

---

# 13. Meter Change Detection

หาก Import พบ Meter ใหม่ใน Site/Service เดิม:

```text
METER_CHANGE_DETECTED
```

ต้องตรวจ:

```text
Site
Service
Meter History
Time
Reading
Source Replacement Event
```

หากหลักฐานไม่พอ:

```text
Replacement Verification
```

ห้ามสร้าง Site ใหม่อัตโนมัติ

---

# 14. Site Code เมื่อ Meter เปลี่ยน

```text
SITE_ID = เดิม
SITE_CODE = เปลี่ยนได้ตาม Meter
```

เช่น:

```text
ก่อน:
SITE_ID = SITE-001
SITE_CODE = EM100531-002

หลัง:
SITE_ID = SITE-001
SITE_CODE = EM100531-009
```

ต้องมีประวัติ Old / New / Effective Date / Reason

---

# 15. Reading

Reading เป็นข้อมูลจาก Source:

```text
reading_id
meter_id
billing_period_id
previous_reading
current_reading
usage_units
reading_date
amount_due
source_system
source_record_id
status
```

หลัก:

```text
USAGE_UNITS = Source Value
AMOUNT_DUE  = Source Value
```

---

# 16. Reading Delta Validation

RCMS สามารถตรวจ:

```text
CURRENT - PREVIOUS
```

เพื่อ Validation เท่านั้น

ตัวอย่าง:

```text
Previous = 1,138
Current  = 1,194
Usage    = 56
Delta    = 56
→ PASS
```

ถ้าไม่ตรง:

```text
USAGE_MISMATCH
→ Exception Queue
```

ห้ามแก้ Source Usage อัตโนมัติ

---

# 17. Zero Usage — Rule ใหม่

ถ้า:

```text
Usage = 0
```

1 เดือน:

```text
ZERO_USAGE_MONITORING
```

2 เดือนติดต่อกันของ **Service Account + Meter เดิม**:

```text
CREATE INSPECTION CASE
+
NOTIFY STAFF
```

ไม่เปลี่ยน Reading เป็น Error อัตโนมัติ

---

# 18. Zero Usage + Meter Replacement

```text
July
Meter A = 0

August
Meter B = 0
```

ไม่ถือเป็น Zero Usage 2 เดือนของ Meter เดิมโดยอัตโนมัติ

Zero Counter ต้องพิจารณา Meter Identity

---

# 19. Inspection Case

```text
inspection_case_id
site_id
service_account_id
meter_id
trigger_period_1
trigger_period_2
assigned_to
status
inspection_date
result
note
```

Result:

```text
NORMAL_NO_USAGE
SHOP_CLOSED
SERVICE_SUSPENDED
METER_ISSUE
READING_ERROR
DATA_ERROR
OTHER
```

สำหรับ `Site + Service + Meter` เดิม:

> มี Open Inspection Case ได้ไม่เกิน 1 รายการ

หากยัง 0 ต่อไปให้เพิ่ม Evidence/Update Case เดิม ไม่สร้างงานซ้ำ

---

# 20. Import Architecture

ทุกช่องทางใช้ Logic กลาง:

```text
Excel
Manual
API
  ↓
INGESTION ADAPTER
  ↓
CANONICAL DATA
  ↓
IDENTIFY
  ↓
VALIDATE
  ↓
EXCEPTION QUEUE
  ↓
COMMIT
```

ไม่ให้แต่ละช่องทางมี Business Logic แยกกัน

---

# 21. Canonical Import Columns

| Column | ความหมาย |
|---|---|
| UTILITY_TYPE | ELECTRICITY / WATER |
| CUSTOMER_CODE | รหัสผู้ประกอบการ |
| CUSTOMER_NAME | ชื่อผู้ประกอบการ |
| SITE_CODE | รหัสร้าน/จุดบริการ |
| SITE_NAME | สถานที่ |
| METER_NUMBER | เลขมิเตอร์/มาตร |
| METER_TYPE | ประเภทมิเตอร์ถ้ามี |
| READING_DATE | วันที่จด |
| PREVIOUS_READING | จดครั้งก่อน |
| CURRENT_READING | จดครั้งหลัง |
| USAGE_UNITS | หน่วยที่ใช้จากต้นทาง |
| AMOUNT_DUE | ยอดที่ต้องชำระจากต้นทาง |
| SOURCE_STATUS | สถานะต้นทาง |
| SOURCE_NOTE | หมายเหตุ |

Metadata ที่ระบบเติม:

```text
IMPORT_BATCH_ID
SOURCE_FILE_NAME
SOURCE_ROW_NO
IMPORTED_AT
IMPORTED_BY
SOURCE_SYSTEM
SOURCE_RECORD_ID
```

---

# 22. Official Excel Template

ระบบมี Template กลาง:

```text
RCMS-READING-TEMPLATE-v1.0.xlsx
```

Sheet:

```text
READING_DATA
VALIDATION_GUIDE
REFERENCE
SAMPLE_DATA
README
```

ต้องมี Template Version

Template เก่า:

```text
TEMPLATE_OBSOLETE
```

---

# 23. Import Matching

ลำดับ:

```text
1. SOURCE_SYSTEM + SOURCE_RECORD_ID
2. SITE_CODE + METER_NUMBER
3. METER_NUMBER + SITE
4. CUSTOMER + SITE + METER
5. Fuzzy Match
6. Manual Review
```

Fuzzy Match เป็นตัวช่วย ไม่ใช่ Financial Authority

---

# 24. Import Duplicate / Re-file

Upload เดิมซ้ำ:

```text
Idempotency / Duplicate Detection
```

Source ส่งไฟล์ใหม่แทนไฟล์เดิม:

```text
Batch V2
→ SUPERSEDES
Batch V1
```

ห้าม overwrite history แบบเงียบ ๆ

---

# 25. Partial Batch

ตัวอย่าง:

```text
1,000 rows
985 valid
15 errors
```

Default ที่แนะนำ:

```text
COMMITTED_WITH_ERRORS
```

แถวที่ผ่าน Commit ได้
แถวผิดอยู่ Exception Queue

---

# 26. Exception Queue

รวม:

```text
ZERO_USAGE_2_MONTHS
METER_CHANGE
MISSING_READING
USAGE_ANOMALY
SITE_MISMATCH
DUPLICATE
AMOUNT_ZERO
SOURCE_CONFLICT
USAGE_MISMATCH
```

Risk:

```text
GREEN → Auto
YELLOW → Warning
RED → Mandatory Review
```

ไม่สร้าง Approval ทุก Reading

---

# 27. Zero Amount / Usage Rules

แยก:

```text
ZERO_USAGE
ZERO_AMOUNT
ZERO_BOTH
USAGE_AMOUNT_MISMATCH
```

ตัวอย่าง:

```text
Usage = 0 / Amount > 0
→ ใช้ Source Amount

Usage = 0 / Amount = 0
→ Review

Usage > 0 / Amount = 0
→ High Priority Review
```

---

# 28. Missing Reading

V1:

```text
Missing
→ HOLD EXCEPTION
```

ไม่ Estimate เอง

Hold เฉพาะ Site + Service ที่มีปัญหา ไม่ Block Billing Run ทั้งระบบ

---

# 29. Abnormal Usage

ใช้ Rule Set:

```text
Percentage Delta
+
Absolute Unit Delta
+
Amount Impact
```

Threshold เป็น Configurable Policy

---

# 30. Billing Period / Billing Run

Billing Period State:

```text
OPEN
IMPORTING
VALIDATING
READY_TO_BILL
BILLING
ISSUED
CLOSED
```

Billing Run ต้องรู้ว่าใช้:

```text
source_data_version
```

State:

```text
DRAFT
READY
PROCESSING
COMPLETED
FAILED
CANCELLED
```

---

# 31. Source Data Version

หากเดือนเดียวกันมี Source Version ใหม่:

```text
August V1
→ Billing Run

August V2
→ Source Correction
```

ห้าม overwrite V1

Correction ต้องเข้าสู่ Controlled Correction / Financial Adjustment ตาม Invoice Lifecycle

---

# 32. Invoice Model

```text
invoice_id
invoice_number
tenant_id
site_id
service_account_id
billing_period_id
issue_date
due_date
amount_due
status
```

Invoice Status:

```text
DRAFT
VALIDATED
ISSUED
SENT
PAID
OVERDUE
VOID
CANCELLED
```

ไม่มี `PARTIALLY_PAID` เป็น Settlement State ปกติ

---

# 33. Full-Invoice Settlement

หลัก:

> Invoice ต้องได้รับ Coverage ครบเต็มยอดจึงเป็น PAID

```text
Invoice = 1,000
Payment = 700
```

ผล:

```text
Invoice ≠ PAID
Payment Exception = SHORT_PAYMENT
```

---

# 34. Multiple Payments

```text
Invoice = 1,000

P1 = 700
P2 = 300

Total Coverage = 1,000
→ Invoice = PAID
```

Payment แต่ละรายการเป็น Financial Transaction แยกกัน

---

# 35. Month-by-Month Allocation

Default:

```text
Oldest Debt First
```

และต้องปิด Invoice เก่าเต็มก่อนจึงไป Invoice ใหม่

ตัวอย่าง:

```text
July = 1,000
August = 800
September = 700

Payment = 1,500
```

ผล:

```text
July = PAID
Remaining = 500
August = NOT PAID
```

ไม่สร้าง Partial Settlement ของ August

---

# 36. Short Payment Accumulation

```text
Invoice = 1,000

P1 = 700
P2 = 300
```

700 + 300 = 1,000

→ Invoice PAID

แต่ P1 / P2 ยังเป็นคนละ Payment

---

# 37. Payment Intent

Payment Intent ใช้ระบุ “เงินกำลังจะชำระอะไร”

```text
payment_intent_id
tenant_id
site_id
service_scope
target_invoice_set
intended_amount
status
created_at
expires_at
```

State:

```text
DRAFT
SUBMITTED
PARTIALLY_FULFILLED
FULFILLED
EXPIRED
CANCELLED
```

**Intent Partially Fulfilled ไม่ได้ทำให้ Invoice เป็น Partial Settlement**

Payment Intent ควรผูกอย่างน้อยกับ Customer + Site + Service + Invoice Set เพื่อรองรับหลายร้าน

---

# 38. Short Payment vs Unallocated

ต้องแยกความหมาย:

### SHORT_PAYMENT
Payment ไม่พอปิด Invoice Target

### UNALLOCATED
มีเงิน Verified แล้ว แต่ยังมีส่วนที่ยังไม่ได้ใช้เพื่อปิด Invoice ตาม Rule

ตัวอย่าง:

```text
Invoice A = 1,000
Invoice B = 800
Payment = 1,500
```

```text
A = PAID
Remaining = 500
B = NOT PAID
500 = Unallocated / Credit ตาม Policy
```

---

# 39. Overpayment / Credit

```text
Debt = 2,000
Payment = 2,500
```

ผล:

```text
Allocated = 2,000
Credit = 500
```

Credit ต้องเกิดหลัง:

```text
Payment Verified
+
Allocation Completed
```

---

# 40. Credit Scope

Default:

```text
Credit → Service Account
```

ดังนั้น:

```text
Electricity Credit ≠ Water Credit
```

Cross-Service Transfer ไม่ทำอัตโนมัติใน V1

หากอนาคตต้องทำ ให้สร้าง Explicit Financial Event เช่น:

```text
CREDIT_TRANSFERRED_CROSS_SERVICE
```

พร้อม Actor / Reason / Audit

---

# 41. Credit Ledger

Events:

```text
CREDIT_ADDED
CREDIT_APPLIED
CREDIT_HELD
CREDIT_REFUNDED (Controlled Process)
```

Balance มาจาก Ledger ไม่ใช่ field เดียวที่แก้ทับ

---

# 42. Credit Refund

Automatic Credit Refund ไม่ใช่ Core Workflow V1

Default:

```text
Credit Carry Forward
```

หากคืนเงินจริง:

```text
Controlled Financial Process
+
Dual Control ตามนโยบายหน่วยงาน
```

ไม่สร้าง Special Case Approval Module กลับมา

---

# 43. Payment Reversal

ห้ามลบ Payment / Allocation / Credit Event

ใช้:

```text
Original Event
+
Reversal Event
```

และต้อง Re-evaluate:

```text
Allocation
Credit
Invoice
Debt
Collection
```

---

# 44. Reverse Chain

ถ้า Payment สร้าง Credit และ Credit ถูกใช้ไปแล้ว:

```text
Payment Reversal
 ↓
Allocation Reversal
 ↓
Credit Creation Reversal
 ↓
Credit Application Reversal
 ↓
Restore Outstanding
```

ต้องบันทึกเป็น Financial Event Chain ไม่ mutate historical fact ให้เหมือนว่าไม่เคยเกิด

---

# 45. Paid Ratio / UI Progress

ไม่เพิ่ม `PARTIALLY_PAID` ใน Invoice Status

UI ใช้ Derived View / Query เช่น:

```text
paid_ratio
has_short_payment
verified_amount
remaining_amount
```

ค่ากลุ่มนี้ไม่ควรเป็น Financial Truth ที่ต้องแก้เองหลายจุด

---

# 46. Slip / OCR

Slip State:

```text
RECEIVED
PROCESSING
OCR_COMPLETED
PENDING_REVIEW
VERIFIED
REJECTED
```

OCR Extract:

```text
Amount
Date
Reference
Sender
Receiver
```

หลัก:

```text
OCR ≠ Verification
```

---

# 47. Duplicate Slip

ตรวจ:

```text
Reference Match
Image / Perceptual Fingerprint
Composite Heuristic
Manual Review
```

ไม่ใช้ amount + date อย่างเดียวในการ Block

---

# 48. Counter Payment

Fast Path:

```text
Payment Entry
↓
Evidence
↓
Officer Verify
↓
Allocation
↓
Receipt
```

ข้าม OCR ได้หากเจ้าหน้าที่ตรวจหลักฐานเอง

แต่ต้องมี Verified By / Verified At / Evidence / Provenance

---

# 49. Debt Model

Debt = ยอดที่ยังไม่ชำระ ไม่ใช่ Invoice

ต้องรู้:

```text
Invoice
Billing Period
Service
Original Amount
Verified Payments
Active Allocations
Outstanding
```

---

# 50. Carry Forward Debt

ตัวอย่าง:

```text
Current Charges = 700
Old Debt = 500
Total Due = 1,200
```

แต่:

```text
Revenue Current = 700
Old Debt = 500
```

ห้ามนับ Old Debt เป็น Revenue ใหม่

---

# 51. Disconnection

Request หนึ่งรายการ target:

```text
Exactly One Service Account
```

ตัวอย่าง:

```text
Electricity = Pending Disconnection
Water = Active
```

Outstanding ที่ใช้ตัดสินคือของ Target Service

---

# 52. Disconnection Workflow

```text
OVERDUE
 ↓
NOTICE / GRACE
 ↓
DISCONNECTION ELIGIBLE
 ↓
REVENUE OFFICER REQUEST
 ↓
SUPERVISOR APPROVE
 ↓
WORK ORDER
 ↓
UTILITY_FIELD_OFFICER
 ↓
FIELD DISCONNECT
 ↓
SERVICE = SUSPENDED
```

---

# 53. Payment During Pending Disconnection

ตรวจ:

```text
Outstanding(Target Service)
```

ถ้า:

```text
<= 0
```

→ Cancel Pending Disconnection

ถ้า:

```text
> 0
```

→ Continue Collection

---

# 54. Work Order

Types:

```text
INSTALL
DISCONNECT
RECONNECT
REMOVE
REPLACE
INSPECT
```

State:

```text
CREATED
ASSIGNED
IN_PROGRESS
COMPLETED
CANCELLED
```

Scope ต้องตรวจอย่างน้อย:

```text
ASSIGN
START
COMPLETE
```

---

# 55. Reconnection

```text
Payment Verified
 ↓
Check Target Outstanding
 ↓
Reconnection Eligible
 ↓
Work Order
 ↓
Field Reconnect
 ↓
Complete
 ↓
Service = ACTIVE
```

Payment Verified ≠ Service Active

---

# 56. Final Settlement / Termination

```text
ACTIVE
 ↓
TERMINATION_PENDING
 ↓
FINAL_SETTLEMENT
 ↓
SERVICE_CLOSED
 ↓
TERMINATED
```

ต้องพิจารณา:

```text
Outstanding
+
Valid Final Source Charges
-
Eligible Deposit
-
Eligible Credit
```

Credit/Deposit ข้าม Service ไม่ Auto ใน V1

---

# 57. Deposit

Ledger Events:

```text
DEPOSIT_RECEIVED
DEPOSIT_APPLIED
DEPOSIT_ADJUSTMENT
DEPOSIT_REFUND
```

ต้องมี Service Scope

---

# 58. Source Correction / Reading Correction

ถ้า Reading/Source ผิดหลัง Lock / Close:

```text
Original Fact
 ↓
Correction Event
 ↓
Controlled Review
 ↓
Financial Adjustment ตาม Invoice Lifecycle
```

รองรับ:

```text
CREDIT_ADJUSTMENT
DEBIT_ADJUSTMENT
```

### ก่อน Invoice Paid

Correction ใช้ Replace / Adjust Invoice ตาม lifecycle

### หลัง Invoice Paid

ยอดลด:

```text
Credit Adjustment → Credit Ledger
```

ยอดเพิ่ม:

```text
Debit Adjustment → Current Financial Period
```

ห้ามแก้ Invoice Paid เดิมตรง ๆ

---

# 59. Source Version / Billing Version

ถ้า Source เดือนเดิมเปลี่ยน:

```text
V1
V2
```

ต้องไม่ overwrite V1

Billing Run ต้องระบุ Source Version ที่ใช้

ถ้า Invoice ออกไปแล้ว:

```text
Source Correction
→ Controlled Correction
→ Financial Adjustment
→ Statement Version ใหม่เมื่อจำเป็น
```

---

# 60. Financial Snapshot

เมื่อ Invoice ถูก Issue:

> จำนวนเงินและข้อมูลสำคัญของเอกสารต้อง Snapshot

การเปลี่ยน Source หรือ Setting ในอนาคตไม่เปลี่ยน Invoice เก่าโดยเงียบ ๆ

---

# 61. Financial Event Model

Event หลัก:

```text
CHARGE
PAYMENT
ALLOCATION
CREDIT_ADDED
CREDIT_APPLIED
ADJUSTMENT
REVERSAL
DEPOSIT_EVENT
```

Financial Event ไม่ลบ

ใช้ Reversal / Adjustment แทน

---

# 62. Financial Closing / Posting

ต้องแยก:

```text
Billing Period
Payment Date
Posting Date
Financial Period
Effective Date
Recorded Date
```

ตัวอย่าง:

```text
Invoice Billing Period = Aug
Payment Date = 03 Sep
Posting Period = Sep
```

Monthly Closing ปิดการแก้ไขทางบัญชีของงวด แต่ไม่ปิดรับ Payment ใหม่

Payment หลัง Closing:

```text
Receive
→ Verify
→ Allocate Old Invoice
→ Post Current Financial Period
```

---

# 63. Effective Date

สำหรับ:

- Meter Replacement
- Disconnect
- Reconnect
- Reading Correction
- Service Change

ต้องมี:

```text
effective_at
recorded_at
```

---

# 64. Idempotency

ต้องป้องกัน Event ซ้ำจาก:

- LINE Webhook
- API Retry
- Payment Event
- Notification Retry
- Excel Re-import

ใช้:

```text
event_id
message_id
idempotency_key
source_record_id
```

Event เดิมซ้ำ:

```text
Ignore Duplicate
+
Log
```

---

# 65. Decision Provenance

ทุก Manual Decision สำคัญเก็บ:

```text
decision_source
actor
timestamp
reason
```

ใช้:

```text
AUTO
RULE
MANUAL
```

---

# 66. Rate / Tax Boundary

RCMS V1 ไม่คำนวณ Utility Rate / FT / VAT / Service Charge

แต่ Invoice ต้องไม่เปลี่ยนย้อนหลังเพราะ Source Rate เปลี่ยน

RCMS เก็บ Source Reference ที่จำเป็นสำหรับ Audit โดยไม่จำลอง Calculation Engine ของกอง

---

# 67. LINE OA

ใช้สำหรับ:

```text
eBill
Payment Intent
Reminder
Slip Submission
E-Receipt
Service Notice
```

Notification State:

```text
QUEUED
SENDING
SENT
DELIVERY_FAILED
BLOCKED
QUOTA_LIMIT
INVALID_RECIPIENT
RATE_LIMITED
RETRYING
CANCELLED
```

LINE Failure ไม่ควรหยุด Billing Workflow

Fallback:

```text
LINE Fail
 ├── Secure Web Link
 ├── Print Queue
 └── Manual Contact Queue
```

---

# 68. Webhook

Webhook ต้องรองรับ:

```text
RECEIVED
VERIFIED
PROCESSED
```

และ Idempotency / Signature Validation ตาม Integration Policy

---

# 69. Invoice Presentation

Internal Financial Model:

```text
Electricity Invoice
Water Invoice
```

แยกกัน

Presentation:

```text
Billing Statement
 ├── Electricity Invoice
 └── Water Invoice
```

Combined เป็น Presentation เท่านั้น

หนึ่ง Statement ควรผูกกับ:

```text
Customer + Site + Billing Period
```

รองรับ Statement Version:

```text
V1
V2
SUPERSEDED
```

---

# 70. Invoice Design Requirement

ใบแจ้งหนี้ใหม่:

```text
A5 Landscape
210 × 148 mm
```

พิมพ์ A4:

```text
┌───────────────┬───────────────┐
│     A5 Bill   │     A5 Bill   │
└───────────────┴───────────────┘
```

ต้องอ่านง่าย / ทันสมัย / ข้อมูลครบ

แสดง:

- Logo หน่วยงาน
- Watermark Logo แบบจาง
- Invoice Number
- Billing Period
- Customer
- Site
- Site Code
- Meter
- Previous Reading
- Current Reading
- Usage
- Current Amount
- Outstanding รายเดือน
- Total Due
- Due Date
- QR Payment
- LINE OA

---

# 71. Dashboard / Customer 360

Dashboard เน้นงาน:

```text
Exceptions
Payments
Disconnections
Meter Changes
LINE Failures
Debt
```

Customer 360:

```text
Customer
 ├── Sites
 │    ├── Service
 │    ├── Meter History
 │    ├── Current Bill
 │    ├── Debt
 │    └── Service State
 ├── Payments
 ├── Credit
 ├── Receipts
 ├── Work Orders
 └── Communication History
```

---

# 72. Risk-Based Operations

ไม่ให้เจ้าหน้าที่ตรวจทุกแถว

```text
GREEN
→ Auto

YELLOW
→ Warning

RED
→ Mandatory Review
```

Normal Reading ไม่ต้องมี Approval ทุกครั้ง

Exception Queue เป็นจุดกลางของ Data Quality

---

# 73. Financial Safety Rules

ห้าม:

1. ลบ Payment
2. ลบ Invoice ที่ออกแล้ว
3. แก้ Locked Reading ตรง ๆ
4. ให้ OCR เป็น Financial Authority
5. ให้ Partial Payment ทำให้ Invoice เป็น Paid
6. ให้เงินส่วนเกินสูญหาย
7. ให้ Reconnection จาก Payment อย่างเดียว
8. ใช้ Tenant Status แทน Service State
9. แก้ยอดย้อนหลังโดยไม่มี Event / Audit
10. ให้ Carry Forward Debt กลายเป็น Revenue ซ้ำ
11. ให้ Low-confidence Fuzzy Match สร้าง Financial Record อัตโนมัติ
12. ให้ Duplicate Event สร้าง Payment ซ้ำ

---

# 74. Core Edge Cases

อย่างน้อยต้องทดสอบ:

```text
Normal Billing
Electricity Only
Water Only
Both Services
Customer Multiple Sites
Multi-month Debt
Full Payment
Short Payment
Multiple Payments Complete Invoice
Overpayment
Credit Applied Next Month
Payment Reversal
Payment Reversal after Credit Application
Payment Intent
Payment Intent Multiple Sites
Duplicate Slip
OCR Low Confidence
Counter Payment
Payment during Pending Disconnection
Service-specific Disconnection
Work Order Scope Conflict
Scope Changed after Assignment
Reconnection
Meter Replacement
Meter Replacement Mid-Month
Zero Usage One Month
Zero Usage Two Months
Meter Changed after Zero Month
Reading Correction after Close
Correction Credit
Correction Debit
Missing Reading
Abnormal Usage
LINE Failure
Duplicate Webhook
Payment after Closing
Termination + Settlement
Deposit + Debt
Current Bill + Old Debt
Import Re-file
Source Version Correction
```

---

# 75. Compound Business Attack Scenarios

## A. Multiple Sites + Debt + Intent

ต้องไม่ให้ Payment ของ Site 1 ไปแตะ Site 2

## B. Credit + Service Separation + Termination

Electricity Credit ไม่ Cross-Apply Water โดยอัตโนมัติ

## C. Reversal + Credit + Closed Period

Reverse ต้องสร้าง Event ใหม่ใน Current Posting Period โดยไม่ mutate Closed History

## D. Meter Replacement + Zero Usage

เปลี่ยน Meter แล้วไม่ถือเป็น 0 ต่อเนื่องของ Meter เดิมโดยอัตโนมัติ

## E. Late Source Correction

ไม่ overwrite Invoice เดิม
ใช้ Correction / Adjustment

## F. Billing Run + Source V2

Run ต้องรู้ Version ที่ใช้

## G. Short Payment Multiple Times

หลาย Payment สามารถสะสมเพื่อ Full Settlement ได้

---

# 76. จุดที่ถูกตัดออกจาก V1 เพื่อความกระชับ

```text
Utility Calculation Engine
Special Case Approval Module
Automatic Missing Reading Estimation
Automatic Cross-Service Credit Transfer
Automatic Credit Refund
AI/LLM as Financial Decision Maker
Native Mobile App
Full Accounting System
Microservice-first Architecture
```

---

# 77. สิ่งที่ควรเพิ่มให้ V1 แบบไม่ทำให้ระบบบวม

```text
Import Versioning
Exception Queue
Risk-based Validation
Payment Intent
Financial Event Chain
Meter Replacement Event
Inspection Case
Posting Period
Effective Date
Idempotency
Decision Provenance
Statement Version
```

---

# 78. Recommended Technical Direction

```text
Frontend
Next.js + TypeScript
Tailwind CSS

Backend
Next.js API / Server Actions
หรือ Node.js API

Database
PostgreSQL

ORM
Prisma

Validation
Zod

Excel
SheetJS

OCR
Tesseract.js

LINE
LINE Messaging API + Webhook

Deployment
Docker
VPS / On-Premise
```

เลือก Open Source / Low-Cost เป็นหลัก

---

# 79. Recommended Build Order

```text
M01 Auth / RBAC
        ↓
M02 Tenant / Site / Service / Meter
        ↓
M03 Import / Matching / Validation
        ↓
M04 Reading / Exception Queue
        ↓
M05 Billing / Invoice / Statement
        ↓
M06 Debt
        ↓
M07 Payment / Intent / Slip / OCR
        ↓
M08 Allocation / Credit / Reversal
        ↓
M09 Collection / Disconnection
        ↓
M10 Work Order / Reconnection / Inspection
        ↓
M11 LINE / Notification
        ↓
M12 Deposit / Termination
        ↓
M13 Reports / Audit / Closing
        ↓
M14 Electricity / Water Integration
```

---

# 80. Next Design Sequence

เมื่อ Pack นี้ผ่านการตรวจ/ยืนยัน:

```text
RCMS Data State Pack v1.3
        ↓
RCMS State Dictionary v1
        ↓
RCMS Database ERD v1
        ↓
RCMS State Transition Matrix v1
        ↓
RCMS Business Rule Catalog v1
        ↓
RCMS API Contract v1
        ↓
RCMS Test Fixtures v1
        ↓
RCMS UI State Map v1
        ↓
Vibe Coding
```

---

# 81. Pre-ERD Decision Gate

ต้องยืนยัน:

```text
[ ] Customer ≠ Site
[ ] Site ID ≠ Site Code
[ ] Electricity Site Code = EMXXXXX-XXX
[ ] Water Site Code = WM + pattern (รอยืนยัน)
[ ] Electricity / Water แยก Service
[ ] RCMS ไม่คำนวณ Utility
[ ] AMOUNT_DUE จาก Source
[ ] Usage จาก Source / Delta ใช้ Validation
[ ] Zero 2 Months → Inspection Case
[ ] Meter Replacement Model
[ ] Import Versioning
[ ] Exception Queue
[ ] Full-Invoice Settlement
[ ] Short Payment Accumulation
[ ] Payment Intent
[ ] Overpayment / Credit
[ ] Credit Service Scope
[ ] Payment Reversal Chain
[ ] Invoice Snapshot
[ ] Source Correction
[ ] Missing Reading Policy
[ ] Posting Period
[ ] Effective Date
[ ] Idempotency
[ ] Role / Permission / Scope
[ ] LINE Fallback
[ ] Financial Audit
```

---

# 82. Final Master Flow

```text
SOURCE
Excel / Manual / API / Utility Systems
                │
                ▼
            IMPORT
                │
                ▼
       IDENTIFY CUSTOMER/SITE
                │
                ▼
        MATCH SERVICE/METER
                │
                ▼
            VALIDATE
                │
        ┌───────┴────────┐
        ▼                ▼
   EXCEPTION           PASS
        │                │
        ▼                ▼
      REVIEW       MONTHLY DATA
                         │
                         ▼
                 SOURCE AMOUNT DUE
                         │
                         ▼
                      INVOICE
                         │
                    ┌────┴────┐
                    ▼         ▼
                  CURRENT    DEBT
                    │         │
                    └────┬────┘
                         ▼
                  PAYMENT INTENT
                         │
                         ▼
                         QR
                         │
                         ▼
                      PAYMENT
                         │
                   VERIFY / OCR
                         │
                         ▼
                      ALLOCATE
                  ┌──────┼──────┐
                  ▼      ▼      ▼
                FULL   SHORT   EXCESS
                  │      │      │
                  ▼      ▼      ▼
                PAID   WAIT   CREDIT
                  │      │      │
                  └──────┴──────┘
                         │
                         ▼
                    DEBT UPDATE
                         │
                   Outstanding?
                    ┌────┴────┐
                    ▼         ▼
                   NO        YES
                    │         │
                    ▼         ▼
                 NORMAL   COLLECTION
                              │
                              ▼
                       DISCONNECTION
                              │
                          SUPERVISOR
                              │
                              ▼
                         WORK ORDER
                              │
                              ▼
                      FIELD OPERATION
                              │
                              ▼
                        SERVICE STATE
                              │
                              ▼
                          RECONNECT
```

---

# 83. Vibe Coding Context Recovery Rule

ทุก Development Session ต้องอ่าน Pack นี้ก่อนแก้ Domain ที่เกี่ยวข้อง

หากพบ Conflict:

```text
NEW REQUIREMENT
       ↓
COMPARE PACK
       ↓
CONFLICT?
   ┌───┴────┐
   NO      YES
   ↓        ↓
CONTINUE  CHANGE REQUEST
```

Sensitive Core Logic:

```text
Role
Permission
Scope
Site / Meter Identity
Payment
Allocation
Credit
Reversal
Invoice
Debt
Disconnection
Closing
```

---

# 84. Final Principles

RCMS V1 ควรเป็น:

```text
IMPORT
+
IDENTIFY
+
VALIDATE
+
BILL
+
COLLECT
+
RECONCILE
+
CONTROL
+
AUDIT
```

ไม่ใช่:

```text
IMPORT
+
RECALCULATE UTILITY
+
FULL ACCOUNTING SYSTEM
```

หัวใจ:

```text
Customer
↓
Site
↓
Service
↓
Meter
↓
Reading / Source Amount
↓
Invoice
↓
Debt
↓
Payment
↓
Allocation
↓
Credit / Reversal / Adjustment
↓
Collection
↓
Service Action
↓
Financial History
```

---

# END

**RCMS Consolidated Data State Pack v1.3**  
**Simulation-Hardened / Pre-ERD Master Context Lock**
