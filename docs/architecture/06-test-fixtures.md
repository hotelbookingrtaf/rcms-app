# 6. Test Fixtures

Fixtures หลักอยู่ใน `fixtures/compound-edge-cases.json` และ unit tests อยู่ใน `tests/domain-v13.test.ts`

การจำแนก schema ของ Excel ทดสอบใน `tests/excel-classification.test.ts` และตรวจไฟล์จริงแล้ว: ไฟล์กองไฟฟ้าเป็น `UTILITY_READING_V1` จำนวน 547 แถว ส่วนไฟล์จัดเก็บรายได้เป็น `REVENUE_LEDGER_V1`

## Minimum acceptance suite

| Scenario                             | Expected invariant                                               |
| ------------------------------------ | ---------------------------------------------------------------- |
| Normal billing                       | Invoice amount เท่ากับ source amount และ snapshot source version |
| Both services                        | สร้าง 2 financial invoices; Statement รวมได้เฉพาะ presentation   |
| Multiple sites                       | Payment Intent/Allocation ไม่ข้าม Site                           |
| Short payment 700 + 300              | Invoice ยัง ISSUED หลัง 700 และ PAID หลัง coverage ครบ 1,000     |
| Oldest-first 1,500 กับหนี้ 1,000/800 | ปิดใบเก่า 1,000; เงิน 500 hold/unallocated ตาม policy            |
| Overpayment                          | allocate debt แล้วสร้าง credit เฉพาะ service                     |
| Reversal after credit used           | สร้าง reverse chain และ restore outstanding ไม่ลบ event          |
| Duplicate slip/webhook/import        | idempotency key เดิมไม่สร้าง financial record ซ้ำ                |
| Zero usage 2 เดือน meter เดิม        | สร้าง Inspection Case หนึ่งรายการ                                |
| Zero usage แล้วเปลี่ยน meter         | ไม่ถือเป็น 2 เดือนต่อเนื่อง                                      |
| Payment during pending disconnect    | ยอด service เป็นศูนย์แล้ว cancel request                         |
| Reconnect                            | Service active หลัง Work Order complete เท่านั้น                 |
| Correction after close               | สร้าง Adjustment ใน posting period ปัจจุบัน                      |
| LINE failure                         | Invoice ยังคง issued และรายการเข้า fallback queue                |

## Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
