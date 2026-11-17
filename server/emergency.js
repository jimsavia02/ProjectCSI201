// ------------------------------------------
// เหตุฉุกเฉิน: เปิดเคสอัตโนมัติเมื่อชีพจรผิดปกติ ให้ admin ติดตาม
// (ตอนนี้มีแค่ type = 'hr' ถ้านาฬิกาส่งเหตุ SOS / ล้ม ได้ในอนาคต ให้เพิ่ม type ใหม่ในตารางเดียวกัน)
//
// สถานะเคส: open = ยังไม่มีผู้รับ -> in_progress = กำลังดูแล -> closed = ปิดแล้ว
// ผู้ดูแล (เจ้าของสมาชิก) รับเรื่องได้ด้วยการตอบ "ปลอดภัย" ใน LINE / admin เปลี่ยนสถานะและบันทึกการประสานงานได้
// ทุกการเปลี่ยนแปลงลงไทม์ไลน์ใน emergency_case_events
// ------------------------------------------
import {
  notifyHeartRate,
  notifyStress,
  notifyFall,
  HR_HIGH,
  HR_LOW,
  STRESS_HIGH,
  STRESS_MINUTES,
} from "./line.js";

const STATUSES = ["open", "in_progress", "closed"];
const STATUS_LABEL = { open: "ยังไม่มีผู้รับ", in_progress: "กำลังดูแล", closed: "ปิดแล้ว" };
const OVERDUE_MINUTES = 5; // เคสที่ยังไม่มีผู้รับเกินเวลานี้ ขึ้นแถบเตือนสีแดง
const MAX_NOTE_LENGTH = 500;

// ผลการส่ง LINE -> ข้อความในไทม์ไลน์ (ไม่ลง "snoozed"/"normal" เพราะไม่ใช่เหตุการณ์ใหม่)
const NOTIFY_EVENT = {
  sent: "ส่งแจ้งเตือนทาง LINE ถึงผู้ดูแลแล้ว",
  not_linked: "ส่งแจ้งเตือน LINE ไม่ได้ — ผู้ดูแลยังไม่ได้เชื่อม LINE",
  muted: "ไม่ได้ส่งแจ้งเตือน LINE — ผู้ดูแลปิดการแจ้งเตือนไว้ในหน้าตั้งค่า",
  disabled: "ส่งแจ้งเตือน LINE ไม่ได้ — ระบบยังไม่ได้ตั้งค่า LINE",
  error: "ส่งแจ้งเตือน LINE ไม่สำเร็จ",
};

async function addEvent(db, caseId, kind, message, { actor = "system", adminId = null } = {}) {
  await db.execute(
    "INSERT INTO emergency_case_events (case_id, kind, actor, admin_id, message) VALUES (?, ?, ?, ?, ?)",
    [caseId, kind, actor, adminId, message]
  );
}

// ลงไทม์ไลน์ผลการแจ้ง LINE ครั้งแรกของเคสเท่านั้น (ชีพจรส่งซ้ำทุกไม่กี่วินาที ไม่ต้องลงทุกครั้ง)
async function logFirstNotify(db, caseId, result) {
  const message = NOTIFY_EVENT[result];
  if (!message) return;
  const [[seen]] = await db.execute(
    "SELECT id FROM emergency_case_events WHERE case_id = ? AND kind = 'line' LIMIT 1",
    [caseId]
  );
  if (!seen) await addEvent(db, caseId, "line", message);
}

// เปิด/อัปเดตเคสของเงื่อนไขต่อเนื่อง 1 ประเภท (hr / stress) แล้วแจ้ง LINE
//   เข้าเงื่อนไข + ยังไม่มีเคสที่เปิดอยู่ -> เปิดเคสใหม่ + แจ้ง LINE
//   มีเคสอยู่แล้ว -> อัปเดตค่าล่าสุด + เตือนซ้ำ (line.js จำกัดไม่ถี่กว่าทุก 10 นาที)
//   ไม่เข้าเงื่อนไขแล้ว -> ลงไทม์ไลน์ครั้งเดียว แต่ไม่ปิดเคสเอง (ให้คนยืนยัน)
// ค่า (ชีพจร หรือ ระดับเครียด) เก็บในคอลัมน์ bpm / peak_bpm / last_bpm ของเคส
// คืนผลการแจ้ง LINE ("sent", "not_linked", ...) หรือ null ถ้าไม่ได้แจ้ง
async function trackCase(db, memberId, type, value, abnormal, { higherIsWorse, notify, text }) {
  const [[active]] = await db.execute(
    "SELECT id, recovered_at FROM emergency_cases WHERE member_id = ? AND type = ? AND status <> 'closed' ORDER BY id DESC LIMIT 1",
    [memberId, type]
  );

  if (!abnormal) {
    if (active && !active.recovered_at) {
      await db.execute("UPDATE emergency_cases SET last_bpm = ?, last_bpm_at = NOW(), recovered_at = NOW() WHERE id = ?", [value, active.id]);
      await addEvent(db, active.id, "recovered", text.recovered);
    }
    return null;
  }

  let caseId = active?.id;
  let fresh = true; // เคสใหม่ หรือกลับมาผิดปกติอีกครั้ง = แจ้งทันที
  if (caseId) {
    await db.execute(
      `UPDATE emergency_cases SET last_bpm = ?, last_bpm_at = NOW(),
         peak_bpm = IF(?, GREATEST(COALESCE(peak_bpm, 0), ?), LEAST(COALESCE(peak_bpm, 999), ?)), recovered_at = NULL
       WHERE id = ?`,
      [value, higherIsWorse ? 1 : 0, value, value, caseId]
    );
    if (active.recovered_at) await addEvent(db, caseId, type, text.again);
    else fresh = false;
  } else {
    const [ins] = await db.execute(
      "INSERT INTO emergency_cases (member_id, type, bpm, peak_bpm, last_bpm, last_bpm_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [memberId, type, value, value, value]
    );
    caseId = ins.insertId;
    await addEvent(db, caseId, "created", text.created);
  }

  const result = await notify({ reminder: !fresh });
  await logFirstNotify(db, caseId, result);
  return result;
}

// อัปเดตเวลาที่ค่าเริ่มสูงต่อเนื่อง (คอลัมน์ *_since) คืน true ถ้าสูงต่อเนื่องครบ minutes นาทีแล้ว
// column มาจากโค้ดเท่านั้น (hr_high_since / stress_high_since) ไม่ได้มาจากผู้ใช้
async function sustainedHigh(db, memberId, column, isHigh, minutes) {
  if (!isHigh) {
    await db.execute(`UPDATE family_members SET ${column} = NULL WHERE id = ? AND ${column} IS NOT NULL`, [memberId]);
    return false;
  }
  await db.execute(`UPDATE family_members SET ${column} = COALESCE(${column}, NOW()) WHERE id = ?`, [memberId]);
  const [[row]] = await db.execute(
    `SELECT ${column} <= NOW() - INTERVAL ${minutes} MINUTE AS done FROM family_members WHERE id = ?`,
    [memberId]
  );
  return Boolean(row?.done);
}

// เรียกทุกครั้งที่ได้ค่าชีพจรใหม่ ไม่ throw
//   ชีพจรสูง: > 120 แจ้งทันที (ถ้าเปิด alert_hr_high)
//   ชีพจรต่ำ: < 50 แจ้งทันที (ถ้าเปิด alert_hr_low)
// คืนผลการแจ้ง LINE / "off" = เข้าเงื่อนไขแต่ปิดสวิตช์ไว้ / null = ไม่เข้าเงื่อนไข
export async function handleHeartRate(db, memberId, bpm) {
  try {
    if (!Number.isFinite(bpm) || bpm <= 0) return null;
    const [[m]] = await db.execute("SELECT alert_hr_high, alert_hr_low FROM family_members WHERE id = ?", [memberId]);
    if (!m) return null;

    const isHigh = bpm > HR_HIGH;
    const isLow = bpm < HR_LOW;
    const abnormal = (isHigh && m.alert_hr_high) || (isLow && m.alert_hr_low);
    const conditionMet = isHigh || isLow;

    const result = await trackCase(db, memberId, "hr", bpm, Boolean(abnormal), {
      higherIsWorse: bpm > HR_HIGH,
      notify: (opts) => notifyHeartRate(db, memberId, bpm, opts),
      text: {
        created: isLow
          ? `นาฬิกาตรวจพบชีพจรต่ำ ${bpm} bpm (ต่ำกว่า ${HR_LOW})`
          : `นาฬิกาตรวจพบชีพจรสูง ${bpm} bpm (สูงกว่า ${HR_HIGH})`,
        again: `ชีพจรผิดปกติอีกครั้ง ${bpm} bpm`,
        recovered: conditionMet ? `ปิดเงื่อนไขการแจ้งเตือนนี้แล้ว (ชีพจร ${bpm} bpm)` : `ชีพจรกลับมาปกติ ${bpm} bpm`,
      },
    });
    return result ?? (conditionMet ? "off" : null);
  } catch (err) {
    console.error("Emergency heart rate error:", err);
    return "error";
  }
}

// กดส่งแจ้งเตือนชีพจรล่าสุดซ้ำทันที (ไม่ต้องรอครบ 10 นาที) — ใช้จากปุ่มใน Dev Mode
// ส่งได้เฉพาะตอนมีเคสชีพจรที่ยังเปิดอยู่ และค่าล่าสุดยังผิดปกติ (ยังเคารพ "ปลอดภัย" / สวิตช์ปิดแจ้งเตือน)
// คืน { notify, bpm } โดย notify = ผลการส่ง LINE หรือ "no_case" / "normal"
export async function resendHeartRateAlert(db, memberId) {
  const [[m]] = await db.execute("SELECT heart_rate FROM family_members WHERE id = ?", [memberId]);
  const bpm = parseInt(String(m?.heart_rate ?? "").replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(bpm) || (bpm <= HR_HIGH && bpm >= HR_LOW)) return { notify: "normal", bpm };

  const [[active]] = await db.execute(
    "SELECT id FROM emergency_cases WHERE member_id = ? AND type = 'hr' AND status <> 'closed' AND recovered_at IS NULL ORDER BY id DESC LIMIT 1",
    [memberId]
  );
  if (!active) return { notify: "no_case", bpm };

  const notify = await notifyHeartRate(db, memberId, bpm); // ไม่ใช่ reminder = ไม่ติดเงื่อนไข 10 นาที
  if (notify === "sent") await addEvent(db, active.id, "line", `ส่งแจ้งเตือนซ้ำทาง LINE (ชีพจร ${bpm} bpm)`);
  return { notify, bpm };
}

// เรียกทุกครั้งที่ได้ค่าความเครียดใหม่ ไม่ throw
//   ความเครียด > 80 ต่อเนื่องเกิน 30 นาที (ถ้าเปิด alert_stress) คืนค่าแบบเดียวกับ handleHeartRate
export async function handleStress(db, memberId, level) {
  try {
    if (!Number.isFinite(level) || level < 0) return null;
    const [[m]] = await db.execute("SELECT alert_stress FROM family_members WHERE id = ?", [memberId]);
    if (!m) return null;

    const sustained = await sustainedHigh(db, memberId, "stress_high_since", level > STRESS_HIGH, STRESS_MINUTES);
    const result = await trackCase(db, memberId, "stress", level, Boolean(sustained && m.alert_stress), {
      higherIsWorse: true,
      notify: (opts) => notifyStress(db, memberId, level, opts),
      text: {
        created: `ตรวจพบความเครียดสูง ${level} (สูงกว่า ${STRESS_HIGH} ต่อเนื่องเกิน ${STRESS_MINUTES} นาที)`,
        again: `ความเครียดสูงอีกครั้ง ${level}`,
        recovered: sustained ? `ปิดเงื่อนไขการแจ้งเตือนนี้แล้ว (ความเครียด ${level})` : `ความเครียดลดลงเป็น ${level}`,
      },
    });
    return result ?? (sustained ? "off" : null);
  } catch (err) {
    console.error("Emergency stress error:", err);
    return "error";
  }
}

// ---------- สวิตช์เงื่อนไขการแจ้งเตือนรายสมาชิก (หน้านัดหมาย) ----------
const ALERT_COLUMNS = { hrHigh: "alert_hr_high", hrLow: "alert_hr_low", stress: "alert_stress", fall: "alert_fall" };

export function registerAlertSettingRoutes(app, db, verifyUser) {
  const loadSettings = async (memberId, userId) => {
    const [[row]] = await db.execute(
      `SELECT ${Object.values(ALERT_COLUMNS).join(", ")} FROM family_members WHERE id = ? AND user_id = ?`,
      [memberId, userId]
    );
    return row ? Object.fromEntries(Object.entries(ALERT_COLUMNS).map(([key, col]) => [key, Boolean(row[col])])) : null;
  };

  app.get("/api/family-members/:memberId/alert-settings", verifyUser, async (req, res) => {
    try {
      const settings = await loadSettings(req.params.memberId, req.user.id);
      if (!settings) return res.status(404).json({ error: "ไม่พบสมาชิก" });
      return res.json(settings);
    } catch (err) {
      console.error("Alert settings load error:", err);
      return res.status(500).json({ error: "โหลดเงื่อนไขการแจ้งเตือนไม่สำเร็จ" });
    }
  });

  app.put("/api/family-members/:memberId/alert-settings", verifyUser, async (req, res) => {
    const body = req.body ?? {};
    if (!Object.keys(ALERT_COLUMNS).every((key) => typeof body[key] === "boolean")) {
      return res.status(400).json({ error: "ค่าไม่ถูกต้อง" });
    }
    try {
      const [result] = await db.execute(
        `UPDATE family_members SET ${Object.values(ALERT_COLUMNS).map((col) => `${col} = ?`).join(", ")}
         WHERE id = ? AND user_id = ?`,
        [...Object.keys(ALERT_COLUMNS).map((key) => (body[key] ? 1 : 0)), req.params.memberId, req.user.id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: "ไม่พบสมาชิก" });
      return res.json({ ...(await loadSettings(req.params.memberId, req.user.id)), message: "บันทึกเงื่อนไขการแจ้งเตือนแล้ว" });
    } catch (err) {
      console.error("Alert settings save error:", err);
      return res.status(500).json({ error: "บันทึกเงื่อนไขการแจ้งเตือนไม่สำเร็จ" });
    }
  });
}

// ตรวจพบการล้ม: เปิดเคสใหม่ทุกครั้ง (ล้มแต่ละครั้งคือคนละเหตุการณ์) แล้วแจ้ง LINE
// source บอกที่มา เช่น "จำลองจาก Dev Mode" (อนาคตนาฬิกา/มือถือเรียกฟังก์ชันนี้แทนได้เลย)
// คืน { caseId, notify } ให้ route ตอบกลับหน้าเว็บ
export async function handleFall(db, memberId, source) {
  const [[member]] = await db.execute("SELECT heart_rate, alert_fall FROM family_members WHERE id = ?", [memberId]);
  if (!member?.alert_fall) return { caseId: null, notify: "off" }; // ปิดเงื่อนไข "ตรวจพบการล้ม" ไว้

  const bpm = parseInt(String(member?.heart_rate ?? "").replace(/[^0-9]/g, ""), 10) || null; // ชีพจรตอนล้ม (ถ้ามี)

  const [ins] = await db.execute(
    "INSERT INTO emergency_cases (member_id, type, bpm, last_bpm, last_bpm_at) VALUES (?, 'fall', ?, ?, IF(? IS NULL, NULL, NOW()))",
    [memberId, bpm, bpm, bpm]
  );
  const caseId = ins.insertId;
  await addEvent(db, caseId, "created", `ตรวจพบการล้ม${source ? ` (${source})` : ""}`);

  const notify = await notifyFall(db, memberId);
  const message = NOTIFY_EVENT[notify];
  if (message) await addEvent(db, caseId, "line", message);
  return { caseId, notify };
}

// ผู้ดูแลตอบ "ปลอดภัย" ใน LINE -> รับเรื่องเคสที่ยังไม่มีผู้รับของสมาชิกในบัญชีนั้น คืนจำนวนเคส
export async function acknowledgeByCaregiver(db, lineUserId) {
  const [rows] = await db.execute(
    `SELECT c.id FROM emergency_cases c
     JOIN family_members f ON f.id = c.member_id
     JOIN users u ON u.id = f.user_id
     WHERE u.line_user_id = ? AND c.status = 'open'`,
    [lineUserId]
  );
  for (const { id } of rows) {
    const [res] = await db.execute(
      "UPDATE emergency_cases SET status = 'in_progress', acknowledged_at = NOW() WHERE id = ? AND status = 'open'",
      [id]
    );
    if (res.affectedRows) await addEvent(db, id, "ack", 'ผู้ดูแลรับเรื่องแล้ว (ตอบ "ปลอดภัย" ทาง LINE)', { actor: "caregiver" });
  }
  return rows.length;
}

// ข้อมูลเคสพร้อมสมาชิกและผู้ดูแล (ใช้ทั้งรายการและหน้ารายละเอียด)
const CASE_SELECT = `
  SELECT c.id, c.member_id, c.type, c.status, c.bpm, c.peak_bpm, c.last_bpm, c.last_bpm_at, c.recovered_at,
         c.created_at, c.acknowledged_at, c.closed_at,
         f.name AS member_name, f.relation, f.device, f.heart_rate AS current_hr, f.last_synced_at,
         f.emergency_contact_name, f.emergency_contact_phone,
         u.id AS caregiver_id, u.name AS caregiver_name, u.phone AS caregiver_phone,
         (u.line_user_id IS NOT NULL) AS caregiver_line
  FROM emergency_cases c
  JOIN family_members f ON f.id = c.member_id
  JOIN users u ON u.id = f.user_id`;

export function registerEmergencyRoutes(app, db, verifyUser, verifyAdmin) {
  const guard = [verifyUser, verifyAdmin];

  // รายการเคสวันนี้ + เคสเก่าที่ยังไม่ปิด และตัวเลขสรุปของวันนี้
  app.get("/admin/emergency/cases", ...guard, async (req, res) => {
    try {
      const [cases] = await db.execute(
        `${CASE_SELECT}
         WHERE c.created_at >= CURDATE() OR c.status <> 'closed'
         ORDER BY c.status = 'open' DESC, c.status = 'in_progress' DESC,
                  CASE WHEN c.status = 'open' THEN c.created_at END ASC, -- เคสที่รอนานสุดอยู่บนสุด
                  c.created_at DESC
         LIMIT 200`
      );
      const [[today]] = await db.execute(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(status <> 'open'), 0) AS acknowledged,
                COALESCE(SUM(status = 'closed'), 0) AS closed
         FROM emergency_cases WHERE created_at >= CURDATE()`
      );
      const [[waiting]] = await db.execute(
        `SELECT COALESCE(SUM(status = 'open'), 0) AS open,
                COALESCE(SUM(status = 'in_progress'), 0) AS in_progress,
                COALESCE(SUM(status = 'open' AND created_at < NOW() - INTERVAL ${OVERDUE_MINUTES} MINUTE), 0) AS overdue
         FROM emergency_cases WHERE status <> 'closed'`
      );
      return res.json({
        serverTime: new Date(),
        overdueMinutes: OVERDUE_MINUTES,
        stats: {
          today: Object.fromEntries(Object.entries(today).map(([k, v]) => [k, Number(v)])),
          open: Number(waiting.open),
          inProgress: Number(waiting.in_progress),
          overdue: Number(waiting.overdue),
        },
        cases,
      });
    } catch (err) {
      console.error("Emergency list error:", err);
      return res.status(500).json({ error: "โหลดรายการเหตุฉุกเฉินไม่สำเร็จ" });
    }
  });

  // รายละเอียด + ไทม์ไลน์
  app.get("/admin/emergency/cases/:id", ...guard, async (req, res) => {
    try {
      const [[item]] = await db.execute(`${CASE_SELECT} WHERE c.id = ?`, [req.params.id]);
      if (!item) return res.status(404).json({ error: "ไม่พบเคสนี้" });
      const [events] = await db.execute(
        `SELECT e.id, e.kind, e.actor, e.message, e.created_at, a.name AS admin_name
         FROM emergency_case_events e LEFT JOIN users a ON a.id = e.admin_id
         WHERE e.case_id = ? ORDER BY e.created_at, e.id`,
        [req.params.id]
      );
      return res.json({ case: item, events });
    } catch (err) {
      console.error("Emergency detail error:", err);
      return res.status(500).json({ error: "โหลดรายละเอียดเคสไม่สำเร็จ" });
    }
  });

  // เปลี่ยนสถานะ (รับเรื่อง / ปิดเคส / เปิดเคสอีกครั้ง)
  app.patch("/admin/emergency/cases/:id", ...guard, async (req, res) => {
    const status = req.body?.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
    try {
      const [[item]] = await db.execute("SELECT status FROM emergency_cases WHERE id = ?", [req.params.id]);
      if (!item) return res.status(404).json({ error: "ไม่พบเคสนี้" });
      if (item.status === status) return res.json({ message: "สถานะเดิมอยู่แล้ว" });

      await db.execute(
        `UPDATE emergency_cases SET status = ?,
           acknowledged_at = IF(? <> 'open', COALESCE(acknowledged_at, NOW()), NULL),
           closed_at = IF(? = 'closed', NOW(), NULL)
         WHERE id = ?`,
        [status, status, status, req.params.id]
      );
      await addEvent(db, req.params.id, "status", `เปลี่ยนสถานะเป็น "${STATUS_LABEL[status]}"`, {
        actor: "admin",
        adminId: req.user.id,
      });
      return res.json({ message: `เปลี่ยนสถานะเป็น "${STATUS_LABEL[status]}" แล้ว` });
    } catch (err) {
      console.error("Emergency status error:", err);
      return res.status(500).json({ error: "เปลี่ยนสถานะไม่สำเร็จ" });
    }
  });

  // บันทึกการประสานงาน
  app.post("/admin/emergency/cases/:id/notes", ...guard, async (req, res) => {
    const message = req.body?.message?.trim();
    if (!message) return res.status(400).json({ error: "กรุณาพิมพ์บันทึก" });
    if (message.length > MAX_NOTE_LENGTH) return res.status(400).json({ error: `บันทึกยาวได้ไม่เกิน ${MAX_NOTE_LENGTH} ตัวอักษร` });
    try {
      const [[item]] = await db.execute("SELECT id FROM emergency_cases WHERE id = ?", [req.params.id]);
      if (!item) return res.status(404).json({ error: "ไม่พบเคสนี้" });
      await addEvent(db, item.id, "note", message, { actor: "admin", adminId: req.user.id });
      return res.status(201).json({ message: "บันทึกแล้ว" });
    } catch (err) {
      console.error("Emergency note error:", err);
      return res.status(500).json({ error: "บันทึกไม่สำเร็จ" });
    }
  });
}
