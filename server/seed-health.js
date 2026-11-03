// ------------------------------------------
// สร้างข้อมูลสุขภาพจำลองย้อนหลัง 7 วัน ให้สมาชิกครอบครัวทุกคน (ไว้ใช้ทดสอบ/พรีเซนต์)
// วิธีใช้:  npm run seed:health            -> สร้างให้เฉพาะสมาชิกที่ยังไม่มีข้อมูล
//          npm run seed:health -- --reset  -> ลบข้อมูลเดิมทั้งหมดแล้วสร้างใหม่
// หมายเหตุ: ข้อมูลเก่ากว่า 7 วันจะถูกลบอัตโนมัติ ถ้าข้อมูลหายก็รันสคริปต์นี้ใหม่ได้
// ------------------------------------------
import mysql from "mysql2/promise";
import "dotenv/config";
import {
  RETENTION_DAYS,
  buildReadings,
  sleepReadingFor,
  insertReadings,
  getLatestValues,
  startOfDay,
} from "./mockHealth.js";

const reset = process.argv.includes("--reset");

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "signup_login",
});

// ช่วงเวลาที่นาฬิกาซิงค์ในแต่ละวัน (สุ่มเลือกวันละ 4-5 ช่วง แล้วสุ่มนาทีภายในช่วง)
const DAY_SLOTS = [6, 9, 12, 13, 16, 18, 21, 22];

function randomTimesOfDay(day) {
  const slots = [...DAY_SLOTS].sort(() => Math.random() - 0.5).slice(0, 4 + Math.round(Math.random()));
  return slots
    .sort((a, b) => a - b)
    .map((hour) => {
      const t = new Date(day);
      t.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
      return t;
    });
}

const [members] = await db.query("SELECT id, name, device FROM family_members");

for (const member of members) {
  if (reset) {
    await db.execute("DELETE FROM health_readings WHERE member_id = ?", [member.id]);
  } else {
    const [[{ n }]] = await db.execute(
      "SELECT COUNT(*) AS n FROM health_readings WHERE member_id = ?",
      [member.id]
    );
    if (n > 0) {
      console.log(`ข้าม ${member.name} (มีข้อมูลอยู่แล้ว ${n} แถว)`);
      continue;
    }
  }

  const source = member.device || "Smart Watch";
  const now = new Date();
  const rows = [];

  for (let daysAgo = RETENTION_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const day = startOfDay(now);
    day.setDate(day.getDate() - daysAgo);

    const times = randomTimesOfDay(day).filter((t) => t < now); // วันนี้ไม่เอาเวลาในอนาคต
    rows.push(...buildReadings(member.id, source, times, 0, day));

    const sleep = sleepReadingFor(member.id, source, day);
    if (sleep[4] < now) rows.push(sleep);

    // เมื่อวาน 09:40 นาฬิกาไม่ได้เชื่อมต่อ -> บันทึกเป็น "ไม่มีข้อมูล"
    if (daysAgo === 1) {
      const gap = new Date(day);
      gap.setHours(9, 40);
      for (const type of ["heart_rate", "steps", "stress"]) {
        rows.push([member.id, type, null, null, gap]);
      }
    }
  }

  await insertReadings(db, rows);

  // อัปเดตค่าสรุปในหน้าสมาชิกให้ตรงกับข้อมูลล่าสุด
  const latest = await getLatestValues(db, member.id);
  await db.execute(
    `UPDATE family_members
     SET heart_rate = ?, steps = ?, sleep = ?, status = ?,
         last_synced_at = (SELECT MAX(recorded_at) FROM health_readings WHERE member_id = ?)
     WHERE id = ?`,
    [
      `${latest.heart_rate} bpm`,
      latest.steps.toLocaleString("en-US"),
      `${latest.sleep} ชม.`,
      latest.heart_rate > 100 || latest.heart_rate < 50 ? "อันตราย" : "ปกติ",
      member.id,
      member.id,
    ]
  );

  console.log(`สร้างข้อมูลให้ ${member.name} แล้ว ${rows.length} แถว`);
}

await db.end();
