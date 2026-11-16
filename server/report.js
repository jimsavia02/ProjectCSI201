// ------------------------------------------
// สรุปรายงานสุขภาพของสมาชิก 1 คน (ใช้ร่วมกันระหว่างหน้า "รายงาน" บนเว็บ และปุ่ม "รายงาน" ใน LINE)
// ------------------------------------------
import { purgeOldReadings, startOfDay } from "./mockHealth.js";

export const REPORT_PERIODS = [7, 30, 90];
export const SLEEP_GOAL = 7;

export const toDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// member ต้องเป็นสมาชิกที่ตรวจสิทธิ์แล้ว (เป็นของผู้ใช้ที่ขอดู) ฟังก์ชันนี้ไม่ตรวจซ้ำ
export async function buildMemberReport(db, member, days) {
  await purgeOldReadings(db);

  const memberId = member.id;
  const today = startOfDay(new Date());
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  const prevFrom = new Date(from);
  prevFrom.setDate(prevFrom.getDate() - days);

  const [rows] = await db.execute(
    `SELECT DATE_FORMAT(recorded_at, '%Y-%m-%d') AS day, type,
            AVG(value) AS avg_value, MAX(value) AS max_value
     FROM health_readings
     WHERE member_id = ? AND recorded_at >= ? AND value IS NOT NULL
     GROUP BY day, type`,
    [memberId, from]
  );

  const byDay = {};
  for (const r of rows) {
    const d = (byDay[r.day] ??= {});
    if (r.type === "heart_rate") {
      d.avg_hr = Math.round(Number(r.avg_value));
      d.max_hr = Number(r.max_value);
    } else if (r.type === "steps") {
      d.steps = Number(r.max_value);
    } else if (r.type === "sleep") {
      d.sleep = Number(r.max_value);
    }
  }

  const daily = [];
  for (let d = new Date(from); d <= today; d.setDate(d.getDate() + 1)) {
    const key = toDateKey(d);
    const v = byDay[key] ?? {};
    daily.push({
      date: key,
      avg_hr: v.avg_hr ?? null,
      max_hr: v.max_hr ?? null,
      steps: v.steps ?? null,
      sleep: v.sleep ?? null,
    });
  }

  const average = (values) => {
    const list = values.filter((v) => v !== null);
    return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
  };
  const avgHr = average(daily.map((d) => d.avg_hr));
  const avgSteps = average(daily.map((d) => d.steps));
  const avgSleep = average(daily.map((d) => d.sleep));

  const [[prev]] = await db.execute(
    `SELECT AVG(daily_steps) AS avg_steps FROM (
       SELECT MAX(value) AS daily_steps FROM health_readings
       WHERE member_id = ? AND type = 'steps' AND value IS NOT NULL
         AND recorded_at >= ? AND recorded_at < ?
       GROUP BY DATE(recorded_at)
     ) t`,
    [memberId, prevFrom, from]
  );

  const [[maxHr]] = await db.execute(
    `SELECT value, recorded_at FROM health_readings
     WHERE member_id = ? AND type = 'heart_rate' AND value IS NOT NULL AND recorded_at >= ?
     ORDER BY value DESC, recorded_at DESC LIMIT 1`,
    [memberId, from]
  );

  const [[alerts]] = await db.execute(
    `SELECT
       SUM(type = 'heart_rate' AND (value > 120 OR value < 50)) AS emergency,
       SUM((type = 'heart_rate' AND ((value > 100 AND value <= 120) OR (value >= 50 AND value < 60)))
           OR (type = 'stress' AND value > 70)) AS warning
     FROM health_readings
     WHERE member_id = ? AND recorded_at >= ? AND value IS NOT NULL`,
    [memberId, from]
  );

  return {
    member,
    days,
    from: toDateKey(from),
    to: toDateKey(today),
    daily,
    summary: {
      avg_hr: avgHr === null ? null : Math.round(avgHr),
      avg_steps: avgSteps === null ? null : Math.round(avgSteps),
      prev_avg_steps: prev.avg_steps === null ? null : Math.round(Number(prev.avg_steps)),
      avg_sleep: avgSleep === null ? null : Math.round(avgSleep * 10) / 10,
      sleep_goal: SLEEP_GOAL,
      sleep_days: daily.filter((d) => d.sleep !== null).length,
      short_sleep_days: daily.filter((d) => d.sleep !== null && d.sleep < SLEEP_GOAL).length,
      max_hr: maxHr ? { value: Number(maxHr.value), recorded_at: maxHr.recorded_at } : null,
      alerts: {
        warning: Number(alerts.warning ?? 0),
        emergency: Number(alerts.emergency ?? 0),
      },
    },
  };
}
