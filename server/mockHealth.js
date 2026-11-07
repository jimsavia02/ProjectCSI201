// ------------------------------------------
// ระบบจำลองข้อมูลสุขภาพจาก Smart Watch (ใช้แทน Garmin API จริงไปก่อน)
// ใช้ร่วมกันระหว่างปุ่ม "ซิงค์" (index.js) และสคริปต์สร้างข้อมูลย้อนหลัง (seed-health.js)
// ------------------------------------------

export const READING_TYPES = ["heart_rate", "steps", "sleep", "stress"];
export const RETENTION_DAYS = 90; // เก็บข้อมูลย้อนหลัง 90 วัน (หน้ารายงานดูย้อนหลังได้สูงสุด 3 เดือน)

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// ชีพจร: ส่วนใหญ่ปกติ 62-95 bpm มีโอกาส 10% ที่จะสูงเกิน 100
export const randomHeartRate = () =>
  Math.random() < 0.1 ? randInt(101, 125) : randInt(62, 95);

// ความเครียด (สเกล 0-100 แบบ Garmin): ส่วนใหญ่ 10-50 มีโอกาส 15% ที่จะสูง
export const randomStress = () =>
  Math.random() < 0.15 ? randInt(51, 80) : randInt(10, 50);

// ชั่วโมงการนอนเมื่อคืน: 5.5 - 8.8 ชม. (ทศนิยม 1 ตำแหน่ง)
export const randomSleepHours = () => randInt(55, 88) / 10;

// จำนวนก้าวที่เพิ่มขึ้นในช่วงเวลาหนึ่ง: เดินเยอะช่วงกลางวัน แทบไม่เดินตอนกลางคืน
export const stepsGained = (minutes, hour) =>
  Math.round(minutes * (hour >= 7 && hour < 22 ? randInt(5, 12) : randInt(0, 1)));

export const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ลบข้อมูลที่เก่ากว่า RETENTION_DAYS วันทิ้ง
export async function purgeOldReadings(db) {
  await db.execute(
    `DELETE FROM health_readings WHERE recorded_at < NOW() - INTERVAL ${RETENTION_DAYS} DAY`
  );
}

// สร้างแถวข้อมูลชีพจร/ก้าวเดิน/ความเครียด ณ เวลาที่กำหนด
// stepsSoFar = จำนวนก้าวสะสมของวันนั้นก่อนถึงเวลาแรก, prevTime = เวลาของค่าก่อนหน้า
export function buildReadings(memberId, source, times, stepsSoFar, prevTime) {
  const rows = [];
  let steps = stepsSoFar;
  let prev = prevTime;

  for (const time of times) {
    // ขึ้นวันใหม่ = ก้าวเดินเริ่มนับ 0 ใหม่
    if (startOfDay(time).getTime() !== startOfDay(prev).getTime()) {
      steps = 0;
      prev = startOfDay(time);
    }
    steps += stepsGained((time - prev) / MINUTE, time.getHours());
    prev = time;

    rows.push(
      [memberId, "heart_rate", randomHeartRate(), source, time],
      [memberId, "steps", steps, source, time],
      [memberId, "stress", randomStress(), source, time]
    );
  }
  return rows;
}

// ข้อมูลการนอน 1 ค่าต่อวัน บันทึกตอนตื่นราว 07:00-07:40
export const sleepReadingFor = (memberId, source, day) => {
  const time = startOfDay(day);
  time.setHours(7, randInt(0, 40));
  return [memberId, "sleep", randomSleepHours(), source, time];
};

export async function insertReadings(db, rows) {
  if (rows.length === 0) return;
  await db.query(
    "INSERT INTO health_readings (member_id, type, value, source, recorded_at) VALUES ?",
    [rows]
  );
}

// จำลองการซิงค์ 1 ครั้ง: นาฬิกาส่งค่าที่เก็บไว้ตั้งแต่ซิงค์ครั้งก่อนมาทีเดียว 3-4 ค่า
// (ถ้าเพิ่งซิงค์ไปไม่นาน จะได้น้อยกว่านั้น เวลาจะไม่ซ้ำกับของเดิม)
export async function syncMockReadings(db, memberId, source) {
  const now = new Date();
  now.setSeconds(0, 0);

  const [[{ last }]] = await db.execute(
    "SELECT MAX(recorded_at) AS last FROM health_readings WHERE member_id = ? AND type = 'heart_rate'",
    [memberId]
  );
  // ย้อนหลังไม่เกิน 8 ชม. และไม่ทับช่วงที่เคยซิงค์ไปแล้ว
  const windowStart = new Date(Math.max(last ? new Date(last).getTime() : 0, now - 8 * HOUR));
  const gapMinutes = (now - windowStart) / MINUTE;

  if (gapMinutes >= 1) {
    // ปกติได้ 3-4 ค่า ห่างกันอย่างน้อย 20 นาที (ถ้าช่วงเวลาสั้นกว่านั้นจะได้น้อยลง)
    const count = Math.max(1, Math.min(randInt(3, 4), Math.floor(gapMinutes / 20)));
    const step = (now - windowStart) / count;
    const times = [];
    for (let i = 1; i <= count; i++) {
      const jitter = i === count ? 0 : (Math.random() - 0.5) * step * 0.3; // ให้เวลาดูไม่เป๊ะเกินไป
      const t = new Date(windowStart.getTime() + i * step + jitter);
      t.setSeconds(0, 0);
      times.push(t);
    }

    // ก้าวสะสมล่าสุดของวันนี้ (ใช้ต่อยอด ไม่ให้ก้าวลดลง)
    const [[todaySteps]] = await db.execute(
      `SELECT value FROM health_readings
       WHERE member_id = ? AND type = 'steps' AND recorded_at >= ?
       ORDER BY recorded_at DESC LIMIT 1`,
      [memberId, startOfDay(now)]
    );
    const rows = buildReadings(memberId, source, times, Number(todaySteps?.value ?? 0), windowStart);

    // ยังไม่มีข้อมูลการนอนของคืนที่ผ่านมา และตอนนี้เลย 8 โมงแล้ว -> เพิ่มให้ (บันทึกเป็นเวลา 7 โมงกว่า)
    const [[todaySleep]] = await db.execute(
      "SELECT id FROM health_readings WHERE member_id = ? AND type = 'sleep' AND recorded_at >= ? LIMIT 1",
      [memberId, startOfDay(now)]
    );
    if (!todaySleep && now.getHours() >= 8) rows.push(sleepReadingFor(memberId, source, now));

    await insertReadings(db, rows);
  }

  await purgeOldReadings(db);
  return getLatestValues(db, memberId);
}

// ค่าล่าสุดของแต่ละประเภท (ใช้อัปเดตสรุปในตาราง family_members)
export async function getLatestValues(db, memberId) {
  const latest = {};
  for (const type of READING_TYPES) {
    const [[row]] = await db.execute(
      `SELECT value FROM health_readings
       WHERE member_id = ? AND type = ? AND value IS NOT NULL
       ORDER BY recorded_at DESC LIMIT 1`,
      [memberId, type]
    );
    latest[type] = row ? Number(row.value) : null;
  }
  return latest;
}
