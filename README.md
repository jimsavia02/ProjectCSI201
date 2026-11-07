## สิ่งที่ต้องมี

- [Node.js]
- [XAMPP]

## ติดตั้งครั้งแรก

### 1. ดึงโค้ด

git clone https://github.com/jimsavia02/ProjectCSI201.git
cd ProjectCSI201

### 2. สร้างฐานข้อมูล

1. เปิด XAMPP กด Start ที่ **MySQL** และ **Apache**
2. เปิด <http://localhost/phpmyadmin> แล้วไปที่แท็บ **SQL**
3. วางเนื้อหาจาก `server/schema.sql` แล้วกด **Go**
4. วางเนื้อหาจาก `server/migration.sql` แล้วกด **Go** (ต้องทำทั้ง 2 ไฟล์ ตามลำดับนี้)

### 3. เปิดเซิร์ฟเวอร์ (เทอร์มินัลที่ 1 – เปิดค้างไว้)

cd server
npm install
npm start

### 4. เปิดหน้าเว็บ (เทอร์มินัลที่ 2 – เปิดค้างไว้)

cd frontend
npm install
npm run dev

### 5. ใช้งาน

1. เปิด <http://localhost:5173/register> สมัครสมาชิก แล้วเข้าสู่ระบบ
2. ไปหน้า **สมาชิก** เพิ่มสมาชิกครอบครัว
3. สร้างข้อมูลสุขภาพจำลองย้อนหลัง 90 วัน (เทอร์มินัลที่ 3):


cd server
npm run seed:health


## ทุกครั้งที่จะใช้งาน

เปิด XAMPP (MySQL) → `npm start` ใน `server` → `npm run dev` ใน `frontend`

## หลัง git pull โค้ดใหม่

1. รัน `server/migration.sql` ใน phpMyAdmin อีกครั้ง
2. รัน `npm install` ทั้งใน `server` และ `frontend`

## ข้อมูลสุขภาพจำลอง

ตอนนี้ยังไม่ได้เชื่อม Garmin API จริง ข้อมูลสุขภาพเป็นค่าสุ่ม และเก็บย้อนหลัง 90 วัน (หน้ารายงานดูได้ 7 วัน / 30 วัน / 3 เดือน)
ถ้าไม่ได้เปิดใช้หลายวัน ข้อมูลจะไม่ตรงกับวันที่ปัจจุบัน

cd server
npm run seed:health -- --reset


## เข้าหน้าแอดมิน

สมัครบัญชีใหม่ แล้วรันใน phpMyAdmin (แท็บ SQL):

UPDATE signup_login.users SET role = 'admin' WHERE email = 'อีเมลของบัญชีนั้น';

จากนั้นเข้าสู่ระบบด้วยบัญชีนั้น (บัญชีแอดมินจะเข้าหน้าฝั่งผู้ใช้ไม่ได้ แนะนำให้แยกบัญชี)

## วิธีเมคข้อมูล

npm run seed:health -- --member=10 --days=30
