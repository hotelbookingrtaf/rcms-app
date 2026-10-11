# 3. State Transition Matrix

| Aggregate    | From                     | To                    | Actor / Guard                          | Side effect                       |
| ------------ | ------------------------ | --------------------- | -------------------------------------- | --------------------------------- |
| Reading      | RECEIVED                 | VALIDATING            | Import service                         | รัน canonical validation          |
| Reading      | VALIDATING               | VALID                 | ไม่มี RED exception                    | พร้อมใช้ใน Billing Run            |
| Reading      | VALIDATING               | EXCEPTION             | พบ RED exception                       | สร้าง Exception Item              |
| Reading      | VALID                    | LOCKED                | Billing Run issue สำเร็จ               | ห้ามแก้ตรง                        |
| Reading      | LOCKED                   | SUPERSEDED            | Controlled correction                  | สร้าง Reading version ใหม่        |
| Invoice      | DRAFT                    | VALIDATED             | source version พร้อมและ snapshot ครบ   | Freeze snapshot                   |
| Invoice      | VALIDATED                | ISSUED                | Revenue Officer                        | สร้าง CHARGE event                |
| Invoice      | ISSUED/SENT/OVERDUE      | PAID                  | Verified active allocation ครบยอด      | ออก Receipt ได้                   |
| Invoice      | ISSUED/SENT/OVERDUE/PAID | VOID                  | Controlled reversal                    | ห้ามลบ invoice                    |
| Payment      | RECEIVED                 | PENDING_VERIFICATION  | Evidence ครบ                           | ส่งตรวจ                           |
| Payment      | PENDING_VERIFICATION     | VERIFIED              | Revenue Officer                        | สร้าง PAYMENT event แล้ว allocate |
| Payment      | VERIFIED                 | REVERSED              | Authorized correction                  | Reverse allocation/credit chain   |
| Service      | ACTIVE                   | SUSPENSION_PENDING    | Overdue + grace + request              | รอ Supervisor                     |
| Service      | SUSPENSION_PENDING       | ACTIVE                | ยอด target service เหลือ 0 หรือ reject | ยกเลิก request                    |
| Service      | SUSPENSION_PENDING       | SUSPENDED             | Supervisor approve + WO complete       | บันทึก field evidence             |
| Service      | SUSPENDED                | RECONNECTION_PENDING  | ยอด target service 0                   | สร้าง reconnect WO                |
| Service      | RECONNECTION_PENDING     | ACTIVE                | Field Officer complete                 | effective/recorded time           |
| Work Order   | CREATED                  | ASSIGNED              | ผู้มีสิทธิ์ assign                     | ระบุ assignee/scope               |
| Work Order   | ASSIGNED                 | IN_PROGRESS           | Assignee                               | บันทึกเวลาเริ่ม                   |
| Work Order   | IN_PROGRESS              | COMPLETED             | Evidence ครบ                           | เปลี่ยน Service ตามประเภทงาน      |
| Import Batch | RECEIVED                 | VALIDATING            | Adapter สร้าง canonical rows           | Identify/validate                 |
| Import Batch | VALIDATING               | COMMITTED             | ทุกแถวผ่าน                             | Commit transaction                |
| Import Batch | VALIDATING               | COMMITTED_WITH_ERRORS | Partial batch policy                   | Commit valid + queue errors       |

โค้ด transition guard อยู่ที่ `src/domain/v13/states.ts` และต้องถูกเรียกฝั่ง Server ในระบบจริง ไม่ใช้ UI เป็นผู้คุมกฎเพียงชั้นเดียว
