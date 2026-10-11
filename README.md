# ProjectCSI201

เว็บแอป Smart Watch Dashboard ของวิชา CSI201 ตอนนี้ทำระบบสมาชิกเสร็จแล้ว คือ สมัครสมาชิก เข้าสู่ระบบ และออกจากระบบ ส่วนหน้า Dashboard ยังเป็นหน้าเปล่าที่แสดงชื่อผู้ใช้

## โครงสร้างโปรเจกต์

```
projectCSI201/
├── frontend/              React + Vite + Tailwind (หน้าเว็บ)
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx       จุดเริ่มต้นของ React
│       ├── App.jsx        กำหนดเส้นทางของแต่ละหน้า (router)
│       ├── api.js         ตัวเรียก API ไปที่ server (axios)
│       ├── index.css      โหลด Tailwind
│       └── pages/
│           ├── Home.jsx       หน้าแรก ต้องล็อกอินก่อน
│           ├── Login.jsx      หน้าเข้าสู่ระบบ
│           └── Register.jsx   หน้าสมัครสมาชิก
└── server/                Express + MySQL (API)
    ├── index.js           โค้ด server ทั้งหมด
    └── schema.sql         คำสั่งสร้างฐานข้อมูลและตาราง
```

## สิ่งที่ต้องมีในเครื่อง

- Node.js 20 ขึ้นไป
- MySQL เช่น จาก XAMPP

## วิธีรันครั้งแรก

1. สร้างฐานข้อมูล โดยเปิด MySQL แล้วรันไฟล์ `server/schema.sql` จะรันผ่าน phpMyAdmin (แท็บ Import) หรือใช้คำสั่งนี้ก็ได้

   ```
   mysql -u root < server/schema.sql
   ```

2. รัน server (พอร์ต 8081)

   ```
   cd server
   npm install
   npm start
   ```

3. เปิดอีกหน้าต่างหนึ่งแล้วรันหน้าเว็บ (พอร์ต 5173)

   ```
   cd frontend
   npm install
   npm run dev
   ```

4. เปิด http://localhost:5173

`node_modules` ไม่ได้เก็บไว้ใน git ทุกคนต้องรัน `npm install` เองทั้งใน `server/` และ `frontend/`

## การตั้งค่า server

ค่าเริ่มต้นใช้ได้กับ XAMPP ที่ยังไม่ได้ตั้งรหัสผ่าน ถ้าเครื่องใครตั้งค่าต่างออกไป ให้กำหนด environment variable ก่อนรัน ไม่ต้องแก้โค้ด

| ตัวแปร | ค่าเริ่มต้น | ใช้ทำอะไร |
| --- | --- | --- |
| `PORT` | `8081` | พอร์ตของ server |
| `CLIENT_ORIGIN` | `http://localhost:5173` | ที่อยู่ของหน้าเว็บที่อนุญาตให้เรียก API |
| `DB_HOST` | `localhost` | ที่อยู่ของ MySQL |
| `DB_USER` | `root` | ชื่อผู้ใช้ MySQL |
| `DB_PASSWORD` | ว่าง | รหัสผ่าน MySQL |
| `DB_NAME` | `signup_login` | ชื่อฐานข้อมูล |
| `JWT_SECRET` | `dev-secret-change-me` | กุญแจเซ็น token ต้องเปลี่ยนก่อนขึ้นใช้งานจริง |

ถ้าเปลี่ยน `PORT` ต้องแก้ `baseURL` ใน `frontend/src/api.js` ให้ตรงกันด้วย

## API

| Method | Path | ส่งอะไรไป | ได้อะไรกลับมา |
| --- | --- | --- | --- |
| POST | `/register` | `{ name, email, password }` | `201 { message }` |
| POST | `/login` | `{ email, password }` | `{ id, name, email }` และตั้ง cookie `token` |
| GET | `/me` | ไม่มี (ใช้ cookie) | `{ id, name }` |
| POST | `/logout` | ไม่มี | `{ message }` และลบ cookie |

เมื่อเกิดข้อผิดพลาด ทุกเส้นทางตอบกลับเป็น `{ error: "ข้อความ" }` โดยใช้รหัสดังนี้

- `400` ข้อมูลไม่ครบ หรือรหัสผ่านสั้นกว่า 8 ตัวอักษร
- `401` ยังไม่ได้ล็อกอิน token หมดอายุ หรืออีเมลกับรหัสผ่านไม่ถูกต้อง
- `409` อีเมลนี้สมัครไปแล้ว
- `500` server มีปัญหา ให้ดู log ในหน้าต่างที่รัน server

## ระบบล็อกอินทำงานอย่างไร

1. ตอนสมัคร server เข้ารหัสรหัสผ่านด้วย bcrypt ก่อนบันทึกลงตาราง `users` จึงไม่มีรหัสผ่านจริงอยู่ในฐานข้อมูล
2. ตอนล็อกอิน server ตรวจรหัสผ่าน แล้วสร้าง JWT อายุ 1 วัน ส่งกลับมาเป็น cookie ชื่อ `token`
3. cookie เป็นแบบ `httpOnly` โค้ด JavaScript ในหน้าเว็บจึงอ่าน token ไม่ได้ เบราว์เซอร์จะแนบไปกับทุกคำขอเอง เพราะ `api.js` ตั้ง `withCredentials: true` ไว้
4. หน้า Home เรียก `GET /me` ตอนเปิดหน้า ถ้าได้ `401` จะพาไปหน้า `/login`

## วิธีเพิ่มของใหม่

- เพิ่มหน้าใหม่: สร้างไฟล์ใน `frontend/src/pages/` แล้วเพิ่ม `<Route>` ใน `App.jsx`
- เรียก API จากหน้าเว็บ: ใช้ `api` จาก `src/api.js` และใช้ `getErrorMessage(err)` เพื่อดึงข้อความผิดพลาดมาแสดง
- เพิ่ม API ที่ต้องล็อกอินก่อน: ใส่ `verifyUser` ไว้หน้า handler แล้วอ่านผู้ใช้ได้จาก `req.user`

  ```js
  app.get("/steps", verifyUser, async (req, res) => {
    // req.user.id คือ id ของคนที่ล็อกอินอยู่
  });
  ```

- เพิ่มตารางใหม่: เขียนคำสั่ง `CREATE TABLE IF NOT EXISTS` ต่อท้ายใน `server/schema.sql` เพื่อให้ทุกคนในทีมสร้างฐานข้อมูลได้เหมือนกัน

## คำสั่งที่ใช้บ่อย

| ที่ไหน | คำสั่ง | ทำอะไร |
| --- | --- | --- |
| `server/` | `npm start` | รัน server และรีสตาร์ตเองเมื่อแก้โค้ด |
| `frontend/` | `npm run dev` | รันหน้าเว็บโหมดพัฒนา |
| `frontend/` | `npm run lint` | ตรวจโค้ดด้วย oxlint |
| `frontend/` | `npm run build` | สร้างไฟล์สำหรับใช้งานจริงไว้ใน `dist/` |
