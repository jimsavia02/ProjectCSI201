# คู่มืออ่านโค้ด – Smart Watch Family Monitor (PINK STUDIO)

> เอกสารนี้สรุปโค้ดทั้งโปรเจคให้อ่านง่าย ใช้ประกอบการนำเสนออาจารย์
> คลิกชื่อไฟล์/เลขบรรทัดเพื่อเปิดดูโค้ดจริงได้เลย

---

## 1. โปรเจคนี้ทำอะไร

เว็บแอปสำหรับ **ติดตามสุขภาพสมาชิกในครอบครัวผ่าน Smart Watch**
ผู้ใช้ 1 คน (เช่น ลูก) สมัครบัญชี → เพิ่มสมาชิกครอบครัว (พ่อ แม่ ปู่ ย่า) → ดู **ชีพจร / ก้าวเดิน / การนอน / ความเครียด** ของแต่ละคน, ดูรายงานย้อนหลัง, บันทึกนัดหมอ และเบอร์ติดต่อฉุกเฉิน

มีผู้ใช้ 2 บทบาท (role):

| Role | เข้าได้ที่ | ทำอะไรได้ |
|---|---|---|
| `user` | `/dashboard`, `/data`, `/report`, `/party`, `/setting`, `/appointments` | ดูแลสมาชิกครอบครัวของตัวเอง |
| `admin` | `/admin/dashboard` | ดูภาพรวมระบบ (จำนวนผู้ใช้ทั้งหมด, ผู้สมัครใหม่ 7 วัน) |

> ตอนนี้ **ยังไม่ได้เชื่อม Garmin API จริง** — ข้อมูลสุขภาพเป็นค่าสุ่มที่ "จำลอง" ให้เหมือนนาฬิกาส่งมา (ดูหัวข้อ 7)

---

## 2. เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี | ใช้ทำอะไร |
|---|---|---|
| Frontend | **React 19** + **Vite** | สร้างหน้าเว็บ (SPA – หน้าเดียว เปลี่ยนหน้าไม่ต้องโหลดใหม่) |
| | **React Router** | จัดการ URL / เปลี่ยนหน้า |
| | **Tailwind CSS** | แต่งหน้าตาด้วย class เช่น `bg-pink-400 rounded-xl` |
| | **Axios** | ส่ง request ไปหา server |
| | **Recharts** | วาดกราฟ (ชีพจร, ก้าวเดิน, การนอน) |
| | **lucide-react** | ไอคอน |
| Backend | **Node.js** + **Express 5** | เป็น API server รับ/ส่งข้อมูล JSON |
| | **mysql2** | ต่อฐานข้อมูล MySQL |
| | **bcrypt** | เข้ารหัส (hash) รหัสผ่านก่อนเก็บ |
| | **jsonwebtoken (JWT)** | สร้าง "บัตรผ่าน" หลังล็อกอิน |
| | **cookie-parser** | อ่าน cookie ที่เก็บ JWT |
| Database | **MySQL** (ผ่าน XAMPP / phpMyAdmin) | เก็บข้อมูลทั้งหมด |

---

## 3. ภาพรวมสถาปัตยกรรม (วาดบนสไลด์ได้เลย)

```
┌──────────────────────┐   HTTP + Cookie(token)   ┌──────────────────────┐    SQL    ┌──────────────┐
│  Frontend (React)    │ ───────────────────────▶ │  Backend (Express)   │ ────────▶ │    MySQL     │
│  localhost:5173      │ ◀─────────────────────── │  localhost:8081      │ ◀──────── │ signup_login │
│  frontend/src/...    │        JSON response      │  server/index.js     │           │              │
└──────────────────────┘                           └──────────────────────┘           └──────────────┘
                                                            ▲
                                                            │ เรียกใช้
                                                   server/mockHealth.js  (จำลองข้อมูลนาฬิกา)
                                                   server/seed-health.js (สร้างข้อมูลย้อนหลัง 90 วัน)
```

**หลักการ:** หน้าเว็บ (React) ไม่ได้คุยกับฐานข้อมูลตรงๆ — ต้องส่ง request ไปที่ Express ก่อนเสมอ
Express ตรวจว่าล็อกอินแล้วหรือยัง → ไปดึง/แก้ข้อมูลใน MySQL → ส่ง JSON กลับมาให้หน้าเว็บแสดง

---

## 4. โครงสร้างไฟล์

```
ProjectCSI201/
├── server/                     ← ฝั่งหลังบ้าน (Backend)
│   ├── index.js                ← ไฟล์หลัก: ตั้งค่า server + API ทุกตัว (731 บรรทัด)
│   ├── mockHealth.js           ← ฟังก์ชันสุ่มข้อมูลสุขภาพ (ชีพจร ก้าว การนอน ความเครียด)
│   ├── seed-health.js          ← สคริปต์สร้างข้อมูลย้อนหลัง (npm run seed:health)
│   ├── schema.sql              ← สร้างฐานข้อมูล + ตารางครั้งแรก
│   ├── migration.sql           ← เพิ่มคอลัมน์/ตารางใหม่ให้ฐานข้อมูลเดิม
│   └── .env                    ← ค่าลับ (PORT, Garmin keys) ห้ามแชร์
│
└── frontend/src/               ← ฝั่งหน้าบ้าน (Frontend)
    ├── main.jsx                ← จุดเริ่มต้น: เอา <App/> ไปแปะในหน้า HTML
    ├── App.jsx                 ← กำหนดว่า URL ไหน → แสดงหน้าไหน
    ├── ProtectedRoute.jsx      ← "ยาม" กันคนไม่ล็อกอิน / role ไม่ตรง
    ├── api.js                  ← ตั้งค่า axios (ที่อยู่ server + ส่ง cookie)
    └── pages/
        ├── Login.jsx           ← หน้าเข้าสู่ระบบ
        ├── Register.jsx        ← หน้าสมัครสมาชิก
        ├── Welcome.jsx         ← หน้าต้อนรับหลังสมัครสำเร็จ
        ├── Home.jsx            ← โครงหน้า user (แถบเมนูซ้าย + หัวบน) ครอบทุกหน้า user
        ├── dashboard.jsx       ← ภาพรวม: กราฟชีพจรเรียลไทม์, นัดหมายถัดไป, เบอร์ฉุกเฉิน
        ├── data.jsx            ← ข้อมูลสุขภาพรายครั้ง (ตาราง + แบ่งหน้า + ปุ่มซิงค์)
        ├── report.jsx          ← รายงานสุขภาพ 7 / 30 / 90 วัน (กราฟ + สรุป)
        ├── party.jsx           ← จัดการสมาชิก: เพิ่ม/ลบ/เชื่อมนาฬิกา/ดูรายละเอียด
        ├── Appointments.jsx    ← นัดหมายแพทย์ (เพิ่ม/ลบ)
        ├── setting.jsx         ← ตั้งค่าบัญชี + เปลี่ยนรหัสผ่าน
        └── admin/              ← หน้าฝั่งผู้ดูแลระบบทั้งหมด
            ├── adminHome.jsx       ← โครงหน้า admin (เมนูซ้าย + หัวบน)
            └── AdminDashboard.jsx  ← แดชบอร์ด admin (จำนวนผู้ใช้, กราฟผู้สมัครใหม่)
```

---

## 5. ฐานข้อมูล (Database)

ชื่อฐานข้อมูล: `signup_login` มี 5 ตาราง

```
users (บัญชีผู้ใช้)
  │ 1 คน มีสมาชิกได้หลายคน
  ▼
family_members (สมาชิกครอบครัว + ค่าสุขภาพล่าสุด)
  │ 1 สมาชิก มีข้อมูลได้หลายแถว
  ├──▶ health_readings  (ค่าที่นาฬิกาวัดได้แต่ละครั้ง – ตารางหลักของข้อมูลสุขภาพ)
  ├──▶ health_history   (สรุปรายวัน – ตารางเก่า ยังใช้บันทึกตอนซิงค์)
  └──▶ appointments     (นัดหมายแพทย์)
```

| ตาราง | คอลัมน์สำคัญ | หมายเหตุ |
|---|---|---|
| `users` | `id, name, email (UNIQUE), phone, password, role` | `password` เก็บเป็น **hash** ไม่ใช่รหัสจริง, `role` = `'user'` หรือ `'admin'` |
| `family_members` | `user_id, name, relation, device, heart_rate, steps, sleep, status, is_connected, emergency_contact_*` | `user_id` ชี้ไปที่ `users.id` — บอกว่าสมาชิกนี้เป็นของใคร |
| `health_readings` | `member_id, type, value, source, recorded_at` | `type` = `heart_rate / steps / sleep / stress`; `value = NULL` แปลว่า "ไม่มีข้อมูล" |
| `health_history` | `member_id, record_date, avg_hr, steps, sleep_hours` | 1 แถวต่อ 1 วัน |
| `appointments` | `member_id, appointment_date, appointment_time, doctor_name, hospital_name` | |

**จุดที่ควรพูด:**
- ใช้ **FOREIGN KEY ... ON DELETE CASCADE** → ลบสมาชิก ข้อมูลสุขภาพ/นัดหมายของคนนั้นหายไปด้วยอัตโนมัติ ([schema.sql](server/schema.sql))
- `health_readings` มี **INDEX** `(member_id, type, recorded_at)` → ค้นหาข้อมูลตามคน+ประเภท+เวลาได้เร็ว
- ข้อมูลเก็บย้อนหลังแค่ **90 วัน** เก่ากว่านั้นถูกลบอัตโนมัติ (`purgeOldReadings` ใน [mockHealth.js:36](server/mockHealth.js:36))

---

## 6. อธิบายโค้ดทีละเรื่อง

### 6.1 การสมัครสมาชิก (Register)

**Frontend** – [Register.jsx:346](frontend/src/pages/Register.jsx:346)
1. เช็กว่า "รหัสผ่าน" กับ "ยืนยันรหัสผ่าน" ตรงกันไหม
2. `api.post('/register', { name, email, password })` ส่งไป server
3. สำเร็จ → ไปหน้า `/welcome` พร้อมส่งชื่อไปแสดง

**Backend** – [index.js:100](server/index.js:100)
```js
app.post("/register", async (req, res) => {
  // 1. ตรวจข้อมูล: ต้องมีชื่อ/อีเมล/รหัส, รหัสยาว ≥ 8 ตัว
  // 2. เข้ารหัสรหัสผ่านด้วย bcrypt (ไม่เก็บรหัสจริงลงฐานข้อมูล)
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  // 3. บันทึกลงตาราง users
  await db.execute("INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)", [...]);
  // 4. ถ้าอีเมลซ้ำ (ER_DUP_ENTRY) → ตอบ 409 "This email is already registered"
});
```

### 6.2 การเข้าสู่ระบบ (Login) และ JWT

**Backend** – [index.js:127](server/index.js:127)
1. หา user จากอีเมล
2. `bcrypt.compare(รหัสที่พิมพ์, hash ในฐานข้อมูล)` → ตรงไหม
3. ตรง → สร้าง **JWT** (บัตรผ่าน) ที่มี `{ id, name, role }` อายุ 1 วัน
4. ใส่ JWT ไว้ใน **cookie ชื่อ `token`** แบบ `httpOnly` (JavaScript ในหน้าเว็บอ่านไม่ได้ → ปลอดภัยจาก XSS)

**Frontend** – [Login.jsx:172](frontend/src/pages/Login.jsx:172)
1. ส่ง email/password ไป `/login`
2. เก็บข้อมูล user (`id, name, role`) ไว้ใน `localStorage` ให้ `ProtectedRoute` ใช้
3. ถ้า `role === 'admin'` → ไป `/admin/dashboard` ไม่งั้นไป `/dashboard`

> 💡 อธิบายง่ายๆ: JWT เหมือน **สายรัดข้อมือคอนเสิร์ต** — ล็อกอินครั้งเดียว ได้สายรัดมา ทุกครั้งที่เรียก API browser จะแนบ cookie ไปเอง server แค่ตรวจสายรัด ไม่ต้องถามรหัสใหม่

### 6.3 การตรวจสิทธิ์ – 2 ชั้น

**ชั้นที่ 1: Backend middleware `verifyUser`** – [index.js:78](server/index.js:78)
```js
const verifyUser = (req, res, next) => {
  const token = req.cookies.token;              // อ่าน cookie
  if (!token) return res.status(401)...;        // ไม่มี = ยังไม่ล็อกอิน
  req.user = jwt.verify(token, JWT_SECRET);     // ตรวจลายเซ็น + วันหมดอายุ
  next();                                       // ผ่าน → ไปทำงาน API ต่อ
};
```
ทุก API ที่ต้องล็อกอินจะใส่ `verifyUser` ไว้ เช่น `app.get("/api/family-members", verifyUser, ...)`

**ชั้นที่ 2: Frontend `ProtectedRoute`** – [ProtectedRoute.jsx](frontend/src/ProtectedRoute.jsx)
```jsx
if (!user) return <Navigate to="/login" />;              // ยังไม่ล็อกอิน → ไปหน้า login
if (allowedRole && user.role !== allowedRole) { ... }   // role ไม่ตรง → ส่งกลับหน้าของ role ตัวเอง
```
และใน [App.jsx](frontend/src/App.jsx) ครอบหน้า user ด้วย `allowedRole="user"` และหน้า admin ด้วย `allowedRole="admin"`

นอกจากนี้ `Home.jsx` / `adminHome.jsx` เรียก `GET /me` ทุกครั้งที่เปิด เพื่อเช็กกับ server อีกรอบ (กันคนแก้ localStorage เอง)

### 6.4 ความปลอดภัยของข้อมูล (จุดที่อาจารย์ชอบถาม)

1. **ป้องกัน SQL Injection** – ใช้ `?` (prepared statement) ทุก query ไม่เอาค่าจากผู้ใช้ไปต่อ string ตรงๆ
   ```js
   db.execute("SELECT ... FROM family_members WHERE id = ? AND user_id = ?", [memberId, currentUserId])
   ```
2. **ไม่ให้ดูข้อมูลของคนอื่น** – ทุก query ของสมาชิกจะมี `AND user_id = ?` (id ของคนที่ล็อกอิน)
   → ถ้าเปลี่ยนเลข id ใน URL เป็นของบ้านอื่น จะได้ "ไม่พบสมาชิก" (404)
3. **รหัสผ่าน** – เก็บเป็น bcrypt hash, ตอนเปลี่ยนรหัสต้องใส่รหัสเดิมให้ถูกก่อน ([index.js:219](server/index.js:219))
4. **ตรวจเบอร์โทร** – ต้องเป็นตัวเลข ไม่เกิน 10 หลัก ทั้งฝั่งหน้าเว็บและฝั่ง server ([index.js:92](server/index.js:92))

### 6.5 การเรียก API จากหน้าเว็บ – [api.js](frontend/src/api.js)

```js
const api = axios.create({
  baseURL: 'http://localhost:8081',   // ที่อยู่ server
  withCredentials: true,              // ให้ browser แนบ cookie token ไปด้วยทุกครั้ง
})
```
ทุกหน้าใช้ `api.get(...)`, `api.post(...)` จากตัวนี้ ไม่ต้องเขียนที่อยู่ server ซ้ำ

### 6.6 รูปแบบโค้ด React ที่ใช้ซ้ำทุกหน้า

เกือบทุกหน้าเขียนตามแพทเทิร์นเดียวกัน (อธิบายครั้งเดียวใช้ได้ทุกหน้า):

```jsx
function Report() {
  const [members, setMembers] = useState([])     // useState = ตัวแปรที่เปลี่ยนแล้วหน้าจอวาดใหม่
  const [memberId, setMemberId] = useState(null)
  const [loading, setLoading] = useState(true)

  // useEffect #1: เปิดหน้าครั้งแรก → โหลดรายชื่อสมาชิก → เลือกคนแรก
  useEffect(() => { api.get('/api/family-members').then(...) }, [])

  // useEffect #2: เมื่อ memberId หรือช่วงเวลาเปลี่ยน → โหลดข้อมูลของคนนั้นใหม่
  useEffect(() => {
    let ignore = false                           // กันคำตอบเก่าที่มาช้ามาทับคำตอบใหม่
    api.get(`/api/family-members/${memberId}/report`, ...)
    return () => { ignore = true }
  }, [memberId, period])

  if (loading) return <p>กำลังโหลด...</p>
  return ( ...JSX แสดงผล... )
}
```

### 6.7 โครงหน้า (Layout) – `Home.jsx` + `<Outlet />`

[Home.jsx](frontend/src/pages/Home.jsx) คือ "กรอบ" ที่มี **เมนูซ้าย + แถบหัว + ปุ่ม Logout**
ตรงกลางมี `<Outlet />` = ช่องว่างที่ React Router จะเอาหน้าย่อย (dashboard, data, report ...) มาใส่
→ ทุกหน้าของ user จึงมีเมนูเหมือนกันโดยไม่ต้องเขียนซ้ำ (admin ก็ใช้หลักเดียวกันกับ `adminHome.jsx`)

---

## 7. ระบบข้อมูลสุขภาพจำลอง (หัวใจของโปรเจค)

เพราะยังไม่ได้ต่อ Garmin จริง จึงเขียน [mockHealth.js](server/mockHealth.js) จำลองว่า "นาฬิกาส่งข้อมูลมา"

**กติกาการสุ่ม (ทำให้ข้อมูลดูสมจริง):**

| ข้อมูล | วิธีสุ่ม |
|---|---|
| ชีพจร | ปกติ 62–95 bpm, มีโอกาส 10% สูง 101–125 (เพื่อให้เห็นการแจ้งเตือน) |
| ความเครียด | ปกติ 10–50, โอกาส 15% สูง 51–80 |
| การนอน | 5.5–8.8 ชม. วันละ 1 ค่า บันทึกตอน ~07:00 |
| ก้าวเดิน | **สะสม** ทั้งวัน กลางวัน (7–22 น.) เดินนาทีละ 5–12 ก้าว กลางคืนแทบไม่เดิน, ขึ้นวันใหม่เริ่มนับ 0 |

**ฟังก์ชันสำคัญ:**
- `syncMockReadings()` [mockHealth.js:84](server/mockHealth.js:84) – กด "ซิงค์" 1 ครั้ง = นาฬิกาส่งค่าที่สะสมตั้งแต่ซิงค์ครั้งก่อน (ย้อนไม่เกิน 8 ชม.) มา 3–4 ค่า
- `seed-health.js` – สร้างข้อมูลย้อนหลังทีเดียว 90 วัน ไว้ใช้ตอนพรีเซนต์
  ```bash
  npm run seed:health                        # ทุกคน 90 วัน
  npm run seed:health -- --reset             # ลบของเดิมแล้วสร้างใหม่
  npm run seed:health -- --member=10 --days=30
  ```

**ขั้นตอนเมื่อกดปุ่มซิงค์** (`POST /api/garmin/mock-sync/:memberId` – [index.js:480](server/index.js:480)):
1. เช็กว่าสมาชิกนี้เป็นของ user ที่ล็อกอิน
2. สุ่มค่าใหม่ใส่ตาราง `health_readings`
3. ดึงค่าล่าสุดมาอัปเดตตาราง `family_members` (ค่าที่โชว์บนการ์ด)
4. ตั้ง `status`: ชีพจร > 100 หรือ < 50 → **"อันตราย"** ไม่งั้น **"ปกติ"**

---

## 8. แต่ละหน้าของ user ทำอะไร + เรียก API อะไร

| หน้า | ไฟล์ | สิ่งที่ทำ | API ที่เรียก |
|---|---|---|---|
| ภาพรวม | [dashboard.jsx](frontend/src/pages/dashboard.jsx) | เลือกสมาชิก → การ์ดค่าล่าสุด, **กราฟชีพจรเรียลไทม์ (อัปเดตทุก 3 วินาทีด้วย `setInterval`)**, นัดหมายถัดไป, เบอร์ฉุกเฉิน | `GET /api/family-members`, `GET .../realtime-hr`, `GET .../appointments`, `PUT .../emergency-contact` |
| ข้อมูลสุขภาพ | [data.jsx](frontend/src/pages/data.jsx) | 4 แท็บ (ชีพจร/ก้าว/นอน/เครียด) ตารางรายครั้ง แบ่งหน้าละ 8 แถว พร้อมป้ายสถานะ | `GET .../readings?type=&page=&limit=`, `POST /api/garmin/mock-sync/:id` |
| รายงาน | [report.jsx](frontend/src/pages/report.jsx) | เลือก 7/30/90 วัน → กราฟรายวัน + สรุปค่าเฉลี่ย, ชีพจรสูงสุด, จำนวนครั้งที่แจ้งเตือน, เทียบก้าวเดินกับช่วงก่อน | `GET .../report?days=` |
| สมาชิก | [party.jsx](frontend/src/pages/party.jsx) | การ์ดสมาชิกทุกคน, เพิ่ม/ลบ, เชื่อมนาฬิกา, popup รายละเอียด | `GET/POST/DELETE /api/family-members`, `POST mock-sync`, `POST stop-mock` |
| นัดหมาย | [Appointments.jsx](frontend/src/pages/Appointments.jsx) | เพิ่ม/ลบนัดหมอ (ต้องเป็นวันพรุ่งนี้เป็นต้นไป) | `GET/POST .../appointments`, `DELETE /api/appointments/:id` |
| ตั้งค่า | [setting.jsx](frontend/src/pages/setting.jsx) | แก้ชื่อ/อีเมล/เบอร์, เปลี่ยนรหัสผ่าน (popup) | `GET/PUT /api/account`, `PUT /api/account/password` |

**ลูกเล่นซ่อน (โชว์อาจารย์ได้):** หน้าสมาชิกกด **Ctrl + Shift + D** เปิด *Dev Mode* → มีปุ่ม Auto Mock ให้ข้อมูลเปลี่ยนเองทุก 3 วินาที ([party.jsx:182](frontend/src/pages/party.jsx:182))

### เกณฑ์สถานะสุขภาพที่ใช้ในระบบ

| ข้อมูล | ปกติ | ผิดปกติ |
|---|---|---|
| ชีพจร | 60–100 bpm | > 100 สูง, < 60 ต่ำ (รายงาน: > 120 หรือ < 50 = ฉุกเฉิน) |
| ก้าวเดิน | ≥ 6,000 ก้าว = ถึงเป้า | < 6,000 = ยังไม่ถึงเป้า |
| การนอน | 7–9 ชม. | < 7 น้อยไป, > 9 มากไป |
| ความเครียด | 0–50 | > 50 สูง (รายงาน: > 70 = เตือน) |

---

## 9. รายการ API ทั้งหมด (server/index.js)

| Method | Path | ต้องล็อกอิน | หน้าที่ |
|---|---|:-:|---|
| POST | `/register` | | สมัครสมาชิก |
| POST | `/login` | | เข้าสู่ระบบ (ตั้ง cookie token) |
| POST | `/logout` | | ออกจากระบบ (ลบ cookie) |
| GET | `/me` | ✅ | ข้อมูลคนที่ล็อกอินอยู่ (id, name, role) |
| GET / PUT | `/api/account` | ✅ | ดู / แก้ข้อมูลบัญชี |
| PUT | `/api/account/password` | ✅ | เปลี่ยนรหัสผ่าน |
| GET / POST | `/api/family-members` | ✅ | รายชื่อ / เพิ่มสมาชิก |
| DELETE | `/api/family-members/:id` | ✅ | ลบสมาชิก |
| GET | `/api/family-members/:id/realtime-hr` | ✅ | ชีพจร 10 ค่าล่าสุด (เก็บใน memory) |
| GET / POST | `/api/family-members/:id/appointments` | ✅ | ดู / เพิ่มนัดหมาย |
| DELETE | `/api/appointments/:id` | ✅ | ลบนัดหมาย |
| PUT | `/api/family-members/:id/emergency-contact` | ✅ | บันทึกเบอร์ฉุกเฉิน |
| GET | `/api/family-members/:id/readings` | ✅ | ข้อมูลรายครั้ง (แบ่งหน้า) |
| GET | `/api/family-members/:id/report` | ✅ | รายงาน 7/30/90 วัน |
| GET | `/api/garmin/connect/:id` | ✅ | สร้างลิงก์ OAuth Garmin (ยังไม่ใช้งานจริง) |
| POST | `/api/garmin/mock-sync/:id` | ✅ | ซิงค์ข้อมูลจำลอง |
| POST | `/api/garmin/stop-mock/:id` | ✅ | หยุดจำลอง รีเซ็ตเป็น "ไม่มีข้อมูล" |

---

## 10. ⚠️ จุดที่ยังไม่เสร็จ / ควรรู้ก่อนพรีเซนต์

ตรวจจากโค้ดแล้วพบว่ามีบางจุดที่หน้าเว็บเรียก API ที่ **ยังไม่มีใน server** — ถ้าอาจารย์กดตรงนี้อาจไม่ทำงาน:

| จุด | ปัญหา | ผลที่เห็น |
|---|---|---|
| [AdminDashboard.jsx:12](frontend/src/pages/admin/AdminDashboard.jsx:12) | เรียก `GET /admin/dashboard-stats` แต่ server ยังไม่มี API นี้ | หน้า admin แสดงผู้ใช้ **0** และกราฟว่าง |
| [adminHome.jsx](frontend/src/pages/admin/adminHome.jsx) เมนู ผู้ใช้งาน / อุปกรณ์ / ซัพพอร์ต / รายงาน / ตั้งค่า | ยังไม่มี Route ใน `App.jsx` | กดแล้วเด้งไปหน้า login |
| [party.jsx](frontend/src/pages/party.jsx) `handleOpenDetailModal` | เรียก `GET /api/family-members/:id/history` ซึ่งยังไม่มี | ประวัติ 7 วันใน popup ว่าง (ไม่พัง แค่ไม่มีข้อมูล) |
| party.jsx `handleSync` | เรียก `POST /api/garmin/sync/:id` ซึ่งยังไม่มี | ขึ้น "ซิงค์ข้อมูลไม่สำเร็จ" |
| party.jsx `handleConfirmConnect` | อ่าน `res.data.url` แต่ server ส่งชื่อ `authUrl` | กดเชื่อม Garmin แล้วไม่ไปไหน |
| dashboard.jsx นัดหมายถัดไป | เอานัดแรกในรายการ ซึ่งอาจเป็นนัดที่ **ผ่านไปแล้ว** | อาจโชว์นัดเก่า |
| `JWT_SECRET` | ไม่ได้ตั้งใน `.env` จึงใช้ค่า default `"dev-secret-change-me"` | ใช้ได้ตอน dev แต่ถ้าถูกถามเรื่องความปลอดภัย ควรบอกว่าต้องตั้งค่าจริงตอนใช้งานจริง |

> ถ้าอยากให้แก้จุดไหน บอกได้เลย โดยเฉพาะ API `/admin/dashboard-stats` ที่ทำให้หน้า admin ใช้งานได้จริง

---

## 11. คำถามที่อาจารย์น่าจะถาม + แนวตอบ

**Q: แยก admin กับ user ยังไง?**
A: ตาราง `users` มีคอลัมน์ `role` ตอนล็อกอิน server ใส่ role ไว้ใน JWT → frontend ใช้ `ProtectedRoute` + `allowedRole` กันไม่ให้เข้าหน้าผิด role และ `Home` / `adminHome` ยังเช็ก `/me` กับ server อีกรอบ

**Q: ทำไมไม่เก็บรหัสผ่านตรงๆ?**
A: ใช้ bcrypt hash ซึ่งย้อนกลับไม่ได้ ถึงฐานข้อมูลหลุดก็ไม่รู้รหัสจริง ตอนล็อกอินใช้ `bcrypt.compare` เทียบ

**Q: ถ้าผู้ใช้ A เปลี่ยนเลข id ใน URL ไปดูสมาชิกบ้าน B ได้ไหม?**
A: ไม่ได้ ทุก query มี `WHERE ... AND user_id = ?` ใช้ id จาก JWT ซึ่งปลอมไม่ได้ (มีลายเซ็น)

**Q: ข้อมูลมาจากนาฬิกาจริงไหม?**
A: ตอนนี้เป็นข้อมูลจำลองที่ออกแบบให้สมจริง (ก้าวเดินสะสม, กลางคืนไม่เดิน, นอนวันละครั้ง, มีโอกาสชีพจรสูงเพื่อทดสอบแจ้งเตือน) โครงสร้างตาราง `health_readings` ออกแบบเผื่อรับข้อมูลจาก Garmin API จริงแล้ว (มีคอลัมน์ `garmin_access_token` ฯลฯ รอไว้)

**Q: กราฟเรียลไทม์ทำยังไง?**
A: หน้า dashboard ใช้ `setInterval` เรียก API ทุก 3 วินาที (polling) และ `clearInterval` ตอนออกจากหน้า เพื่อไม่ให้ทำงานค้าง

**Q: ทำไมต้องลบข้อมูลเก่ากว่า 90 วัน?**
A: ข้อมูลนาฬิกาเยอะมาก (หลายค่าต่อวันต่อคน) จำกัดไว้ให้ฐานข้อมูลไม่โตเกินไป และหน้ารายงานดูได้สูงสุด 3 เดือนพอดี

---

## 12. ลำดับการนำเสนอที่แนะนำ (ประมาณ 10 นาที)

1. **แนะนำปัญหา/แนวคิด** – ดูแลสุขภาพพ่อแม่ผ่าน Smart Watch (1 นาที)
2. **สถาปัตยกรรม + เทคโนโลยี** – ใช้รูปหัวข้อ 3 (1 นาที)
3. **ฐานข้อมูล** – ความสัมพันธ์ 5 ตาราง (1 นาที)
4. **Demo** – สมัคร → ล็อกอิน → เพิ่มสมาชิก → ซิงค์ → ดู Dashboard / ข้อมูล / รายงาน → นัดหมาย → ล็อกอิน admin (4 นาที)
5. **อธิบายโค้ด** – Login + JWT (6.2), การตรวจสิทธิ์ 2 ชั้น (6.3), ความปลอดภัย (6.4), ระบบจำลองข้อมูล (7) (2 นาที)
6. **สิ่งที่จะทำต่อ** – เชื่อม Garmin API จริง, หน้า admin เพิ่มเติม, แจ้งเตือนจริง (1 นาที)

**ก่อนพรีเซนต์อย่าลืม:** รัน `npm run seed:health -- --reset` ใน `server` เพื่อให้ข้อมูลตรงกับวันที่ปัจจุบัน
