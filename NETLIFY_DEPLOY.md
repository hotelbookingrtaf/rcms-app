# คู่มือการนำระบบ RCMS ขึ้นใช้งานออนไลน์บน Netlify (Deployment Guide)

ไฟล์โปรเจกต์นี้ได้รับการตั้งค่าพร้อมสำหรับการ Deploy บน **Netlify** เรียบร้อยแล้ว ด้วยไฟล์คอนฟิก `netlify.toml`

---

## วิธีที่ 1: Deploy ผ่าน GitHub / GitLab (แนะนำ - สะดวกและอัปเดตอัตโนมัติ)

1. **แตกไฟล์ Zip หรือ Push โปรเจกต์ขึ้น GitHub**:
   - นำไฟล์ทั้งหมดในโปรเจกต์นี้ขึ้น GitHub Repository ของคุณ (ทั้งแบบ Public หรือ Private)
   *(ไม่ต้องอัปโหลดโฟลเดอร์ `node_modules` หรือ `.output`)*

2. **เชื่อมต่อกับ Netlify**:
   - เข้าสู่ระบบ [https://app.netlify.com/](https://app.netlify.com/)
   - กดปุ่ม **"Add new site"** → เลือก **"Import an existing project"**
   - เลือก **GitHub** และค้นหา Repository โปรเจกต์ RCMS ของคุณ

3. **ตรวจสอบการตั้งค่า Build Settings**:
   Netlify จะอ่านค่าจากไฟล์ `netlify.toml` ให้อัตโนมัติ:
   - **Base directory**: *(ปล่อยว่าง)*
   - **Build command**: `npm run build`
   - **Publish directory**: `.output/public`
   - **Environment Variables**:
     - `NODE_VERSION`: `22` (หรือ `20`)

4. **กดปุ่ม "Deploy site"**:
   - รอระบบ Netlify รันกระบวนการสร้างประมาณ 1–2 นาที
   - เมื่อเสร็จแล้ว คุณจะได้ URL ออนไลน์ เช่น `https://rcms-rtaf.netlify.app` ใช้งานได้ทันที 🚀

---

## วิธีที่ 2: Deploy ด้วย Netlify CLI บนเครื่องคอมพิวเตอร์

หากคุณมี Node.js ติดตั้งอยู่ในเครื่อง สามารถรันคำสั่งเพื่อ Deploy ได้โดยตรง:

```bash
# 1. ติดตั้ง Netlify CLI (ครั้งแรก)
npm install -g netlify-cli

# 2. ทำการ Build โปรเจกต์
npm run build

# 3. เข้าสู่ระบบ Netlify
netlify login

# 4. ทำการ Deploy ขึ้น Netlify ทันที
netlify deploy --prod --dir=.output/public
```

---

## หมายเหตุสำคัญ
- ระบบถูกกำหนดค่าให้รองรับ Client Routing ทุกเส้นทาง (`/`, `/billing`, `/customers`, `/users`, `/login` ฯลฯ) ไม่มีปัญหาหน้าขาวหรือ 404 เมื่อกด Refresh
- ป้องกันการคัดลอก Source Code และซ่อน Source Maps ในระดับ Production ไว้อย่างปลอดภัย
