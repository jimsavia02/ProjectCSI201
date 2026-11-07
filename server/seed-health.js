// ------------------------------------------
// สร้างข้อมูลสุขภาพจำลองย้อนหลัง (ค่าเริ่มต้น 90 วัน) ให้สมาชิกครอบครัว (ไว้ใช้ทดสอบ/พรีเซนต์)
// วิธีใช้:  npm run seed:health                        -> เติมข้อมูลย้อนหลังให้ทุกคน (เฉพาะวันก่อนข้อมูลที่มีอยู่ ไม่ลบของเดิม)
//          npm run seed:health -- --reset              -> ลบข้อมูลเดิมทั้งหมดแล้วสร้างใหม่
//          npm run seed:health -- --days=30            -> ย้อนหลังแค่ 30 วัน
//          npm run seed:health -- --member=10          -> ทำเฉพาะสมาชิก id 10
// (ใช้ร่วมกันได้ เช่น npm run seed:health -- --member=10 --days=30)
// หมายเหตุ: ข้อมูลเก่ากว่า 90 วันจะถูกลบอัตโนมัติ ถ้าข้อมูลหายก็รันสคริปต์นี้ใหม่ได้
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
// อ่านค่าจาก --name=value
const argValue = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const days = Math.min(RETENTION_DAYS, Math.max(1, Number(argValue("days")) || RETENTION_DAYS));
const memberId = argValue("member") ? Number(argValue("member")) : null;

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

const [members] = memberId
  ? await db.query("SELECT id, name, device FROM family_members WHERE id = ?", [memberId])
  : await db.query("SELECT id, name, device FROM family_members");

if (members.length === 0) {
  console.log(memberId ? `ไม่พบสมาชิก id ${memberId}` : "ยังไม่มีสมาชิกในระบบ");
}

for (const member of members) {
  // วันแรกที่มีข้อมูลอยู่แล้ว: จะเติมเฉพาะวันก่อนหน้านั้น ไม่ทับ/ไม่ลบของเดิม
  let firstExistingDay = null;
  if (reset) {
    await db.execute("DELETE FROM health_readings WHERE member_id = ?", [member.id]);
  } else {
    const [[{ first }]] = await db.execute(
      "SELECT MIN(recorded_at) AS first FROM health_readings WHERE member_id = ?",
      [member.id]
    );
    if (first) firstExistingDay = startOfDay(first);
  }

  const source = member.device || "Smart Watch";
  const now = new Date();
  const rows = [];

  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const day = startOfDay(now);
    day.setDate(day.getDate() - daysAgo);
    if (firstExistingDay && day >= firstExistingDay) continue; // วันนี้มีข้อมูลอยู่แล้ว

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

  if (rows.length === 0) {
    console.log(`ข้าม ${member.name} (มีข้อมูลครบ ${days} วันอยู่แล้ว)`);
    continue;
  }

  await insertReadings(db, rows);

  // อัปเดตค่าสรุปในหน้าสมาชิกให้ตรงกับข้อมูลล่าสุด
  const latest = await getLatestValues(db, member.id);
  await db.execute(
    `UPDATE family_members
     SET heart_rate = ?, steps = ?, sleep = ?, status = ?, is_connected = 1,
         last_synced_at = (SELECT MAX(recorded_at) FROM health_readings WHERE member_id = ?)
     WHERE id = ?`,
    [
      latest.heart_rate == null ? "-" : `${latest.heart_rate} bpm`,
      latest.steps == null ? "-" : latest.steps.toLocaleString("en-US"),
      latest.sleep == null ? "-" : `${latest.sleep} ชม.`,
      latest.heart_rate == null ? "ไม่มีข้อมูล"
        : latest.heart_rate > 100 || latest.heart_rate < 50 ? "อันตราย" : "ปกติ",
      member.id,
      member.id,
    ]
  );

  console.log(`สร้างข้อมูลให้ ${member.name} แล้ว ${rows.length} แถว`);
}

await db.end();
