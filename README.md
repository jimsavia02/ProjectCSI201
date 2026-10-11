วิธีใช้เปิด server

สิ่งที่ต้องมี
Node.js
XAMPP (หรือ MySQL/MariaDB ตัวอื่น)

ดึงโค้ดจาก GitHub:

git clone https://github.com/jimsavia02/ProjectCSI201.git
เปิด XAMPP แล้วกด Start ที่ MySQL และ Apache
เปิด http://localhost/phpmyadmin ไปที่แท็บ SQL แล้ววางเนื้อหาจาก server/schema.sql กด Go
ติดตั้งแพ็กเกจและรันเซิร์ฟเวอร์:

cd server
npm install
npm start
เปิดอีกเทอร์มินัลสำหรับหน้าเว็บ:

cd frontend
npm install
npm run dev
เปิด http://localhost:5173/register
