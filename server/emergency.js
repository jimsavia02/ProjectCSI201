// ------------------------------------------
// เหตุฉุกเฉิน: เปิดเคสอัตโนมัติเมื่อชีพจรผิดปกติ ให้ admin ติดตาม
// (ตอนนี้มีแค่ type = 'hr' ถ้านาฬิกาส่งเหตุ SOS / ล้ม ได้ในอนาคต ให้เพิ่ม type ใหม่ในตารางเดียวกัน)
//
// สถานะเคส: open = ยังไม่มีผู้รับ -> in_progress = กำลังดูแล -> closed = ปิดแล้ว
// ผู้ดูแล (เจ้าของสมาชิก) รับเรื่องได้ด้วยการตอบ "ปลอดภัย" ใน LINE / admin เปลี่ยนสถานะและบันทึกการประสานงานได้
// ทุกการเปลี่ยนแปลงลงไทม์ไลน์ใน emergency_case_events
// ------------------------------------------
import { notifyHeartRate, HR_HIGH, HR_LOW } from "./line.js";

const STATUSES = ["open", "in_progress", "closed"];
const STATUS_LABEL = { open: "ยังไม่มีผู้รับ", in_progress: "กำลังดูแล", closed: "ปิดแล้ว" };
const OVERDUE_MINUTES = 5; // เคสที่ยังไม่มีผู้รับเกินเวลานี้ ขึ้นแถบเตือนสีแดง
const MAX_NOTE_LENGTH = 500;

// ผลการส่ง LINE -> ข้อความในไทม์ไลน์ (ไม่ลง "snoozed"/"normal" เพราะไม่ใช่เหตุการณ์ใหม่)
const NOTIFY_EVENT = {
  sent: "ส่งแจ้งเตือนทาง LINE ถึงผู้ดูแลแล้ว",
  not_linked: "ส่งแจ้งเตือน LINE ไม่ได้ — ผู้ดูแลยังไม่ได้เชื่อม LINE",
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

// เรียกทุกครั้งที่ได้ค่าชีพจรใหม่ (แทน notifyHeartRate เดิม) ไม่ throw
//   ผิดปกติ + ยังไม่มีเคสที่เปิดอยู่ -> เปิดเคสใหม่ / มีอยู่แล้ว -> อัปเดตค่าล่าสุด
//   กลับมาปกติ -> ลงไทม์ไลน์ครั้งเดียว แต่ไม่ปิดเคสเอง (ให้คนยืนยัน)
export async function handleHeartRate(db, memberId, bpm) {
  try {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    const abnormal = bpm > HR_HIGH || bpm < HR_LOW;

    const [[active]] = await db.execute(
      "SELECT id, recovered_at FROM emergency_cases WHERE member_id = ? AND type = 'hr' AND status <> 'closed' ORDER BY id DESC LIMIT 1",
      [memberId]
    );

    if (!abnormal) {
      if (active && !active.recovered_at) {
        await db.execute("UPDATE emergency_cases SET last_bpm = ?, last_bpm_at = NOW(), recovered_at = NOW() WHERE id = ?", [bpm, active.id]);
        await addEvent(db, active.id, "recovered", `ชีพจรกลับมาปกติ ${bpm} bpm`);
      }
      return;
    }

    let caseId = active?.id;
    if (caseId) {
      await db.execute(
        "UPDATE emergency_cases SET last_bpm = ?, last_bpm_at = NOW(), peak_bpm = IF(? > ?, GREATEST(COALESCE(peak_bpm, 0), ?), LEAST(COALESCE(peak_bpm, 999), ?)), recovered_at = NULL WHERE id = ?",
        [bpm, bpm, HR_HIGH, bpm, bpm, caseId]
      );
      if (active.recovered_at) await addEvent(db, caseId, "hr", `ชีพจรผิดปกติอีกครั้ง ${bpm} bpm`);
    } else {
      const [ins] = await db.execute(
        "INSERT INTO emergency_cases (member_id, type, bpm, peak_bpm, last_bpm, last_bpm_at) VALUES (?, 'hr', ?, ?, ?, NOW())",
        [memberId, bpm, bpm, bpm]
      );
      caseId = ins.insertId;
      const direction = bpm > HR_HIGH ? `สูงกว่าเกณฑ์ ${HR_HIGH}` : `ต่ำกว่าเกณฑ์ ${HR_LOW}`;
      await addEvent(db, caseId, "created", `นาฬิกาตรวจพบชีพจรผิดปกติ ${bpm} bpm (${direction})`);
    }

    await logFirstNotify(db, caseId, await notifyHeartRate(db, memberId, bpm));
  } catch (err) {
    console.error("Emergency heart rate error:", err);
  }
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
