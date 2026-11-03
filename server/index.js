import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import session from "express-session";
import crypto from "crypto";
import axios from "axios";
import "dotenv/config";

// ------------------------------------------
// 1. Environmental Variables Configuration
// ------------------------------------------
const PORT = process.env.PORT || 8081;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SALT_ROUNDS = 10;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

// Garmin Credentials (OAuth 2.0 PKCE / Webhook config)
const GARMIN_CLIENT_ID = process.env.GARMIN_CLIENT_ID?.trim();
const GARMIN_CLIENT_SECRET = process.env.GARMIN_CLIENT_SECRET?.trim();
const GARMIN_REDIRECT_URI = process.env.GARMIN_REDIRECT_URI?.trim();

// ------------------------------------------
// Helper: บันทึกข้อมูลสุขภาพลง Database
// ------------------------------------------
async function saveHealthHistory(memberId, hrNum, stepsNum, sleepHoursNum) {
  const todayStr = new Date().toISOString().split('T')[0];

  await db.execute(
    `INSERT INTO health_history (member_id, record_date, sleep_hours, avg_hr, steps)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       avg_hr = VALUES(avg_hr),
       steps = VALUES(steps),
       sleep_hours = IF(VALUES(sleep_hours) > 0, VALUES(sleep_hours), sleep_hours)`,
    [memberId, todayStr, sleepHoursNum || 7.5, hrNum || 75, stepsNum || 3500]
  );
}

// ------------------------------------------
// 2. App & Middleware Initialization
// ------------------------------------------
const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());

app.use(
  session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 15 * 60 * 1000 },
  })
);

// Database Pool Connection
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "signup_login",
});

// ------------------------------------------
// 3. Custom Middlewares
// ------------------------------------------
const verifyUser = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: "You are not logged in" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token is invalid or expired" });
  }
};

// ------------------------------------------
// 4. Auth & User Routes
// ------------------------------------------
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.execute(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hash]
    );
    return res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "This email is already registered" });
    }
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const [rows] = await db.execute(
      "SELECT id, name, email, password, role FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Email or password is incorrect" });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.cookie("token", token, COOKIE_OPTIONS);

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/me", verifyUser, (req, res) => {
  return res.json({ id: req.user.id, name: req.user.name, role: req.user.role });
});

app.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  return res.json({ message: "Logged out" });
});

// ------------------------------------------
// 5. Family Members & Management Routes
// ------------------------------------------
// ดึงรายชื่อสมาชิกครอบครัวทั้งหมดของผู้ใช้ที่ล็อกอินอยู่ (ใช้แสดงในหน้าสมาชิกครอบครัว)
// เรียงจากสมาชิกที่เพิ่มล่าสุดขึ้นก่อน
app.get("/api/family-members", verifyUser, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    // เลือกเฉพาะคอลัมน์ที่มีอยู่จริงในตาราง family_members
    // (ข้อมูลนัดหมายแพทย์แยกไปอยู่ที่ตาราง appointments แล้ว)
    const [rows] = await db.execute(
      `SELECT id, name, relation, avatar_text, device, heart_rate, steps, sleep, status, is_connected,
              emergency_contact_name, emergency_contact_phone
       FROM family_members WHERE user_id = ? ORDER BY id DESC`,
      [currentUserId]
    );
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching family members:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// เพิ่มสมาชิกครอบครัวใหม่
app.post("/api/family-members", verifyUser, async (req, res) => {
  const currentUserId = req.user.id;
  const { name, relation, device } = req.body;

  if (!name || !relation) {
    return res.status(400).json({ error: "กรุณากรอกชื่อและความสัมพันธ์" });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO family_members (user_id, name, relation, device, heart_rate, steps, sleep, status, is_connected)
       VALUES (?, ?, ?, ?, '75 bpm', '0', '7.5 ชม.', 'ปกติ', 0)`,
      [currentUserId, name, relation, device || 'Smart Watch']
    );

    return res.status(201).json({ message: "เพิ่มสมาชิกสำเร็จ", id: result.insertId });
  } catch (err) {
    console.error("Add family member error:", err);
    return res.status(500).json({ error: "ไม่สามารถเพิ่มสมาชิกได้" });
  }
});

// ลบสมาชิกครอบครัว
app.delete("/api/family-members/:id", verifyUser, async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.id;

  try {
    const [result] = await db.execute(
      "DELETE FROM family_members WHERE id = ? AND user_id = ?",
      [id, currentUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "ไม่พบสมาชิก หรือไม่มีสิทธิ์ลบ" });
    }

    return res.json({ message: "ลบสมาชิกสำเร็จ" });
  } catch (err) {
    console.error("Delete family member error:", err);
    return res.status(500).json({ error: "ไม่สามารถลบสมาชิกได้" });
  }
});

// Cache สำหรับเก็บประวัติ Real-time HR กราฟ
const liveHrCache = {};

app.get("/api/family-members/:memberId/realtime-hr", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const currentUserId = req.user.id;

  try {
    const [members] = await db.execute(
      "SELECT id, heart_rate FROM family_members WHERE id = ? AND user_id = ?",
      [memberId, currentUserId]
    );
    if (members.length === 0) {
      return res.status(404).json({ error: "ไม่พบสมาชิก" });
    }

    const rawHr = members[0].heart_rate;
    const currentBpm = rawHr && rawHr !== '-' ? parseInt(String(rawHr).replace(/[^0-9]/g, '')) : 72;
    const timeNow = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (!liveHrCache[memberId]) {
      liveHrCache[memberId] = [
        { time: '10:00:00', bpm: 72 },
        { time: '10:00:03', bpm: 75 }
      ];
    }

    liveHrCache[memberId].push({ time: timeNow, bpm: currentBpm || 72 });
    if (liveHrCache[memberId].length > 10) {
      liveHrCache[memberId].shift();
    }

    return res.json(liveHrCache[memberId]);
  } catch (err) {
    console.error("Fetch Realtime HR error:", err);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลเรียลไทม์ได้" });
  }
});

// ------------------------------------------
// 6. Appointments & Emergency Contact APIs
// ------------------------------------------

app.get("/api/family-members/:memberId/appointments", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const currentUserId = req.user.id;

  try {
    const [members] = await db.execute(
      "SELECT id FROM family_members WHERE id = ? AND user_id = ?",
      [memberId, currentUserId]
    );
    if (members.length === 0) {
      return res.status(404).json({ error: "ไม่พบสมาชิก" });
    }

    const [rows] = await db.execute(
      "SELECT * FROM appointments WHERE member_id = ? ORDER BY appointment_date ASC, appointment_time ASC",
      [memberId]
    );
    return res.json(rows);
  } catch (err) {
    console.error("Fetch appointments error:", err);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลนัดหมายได้" });
  }
});

app.post("/api/family-members/:memberId/appointments", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const { appointment_date, appointment_time, doctor_name, hospital_name, reminder_note } = req.body;
  const currentUserId = req.user.id;

  try {
    const [members] = await db.execute(
      "SELECT id FROM family_members WHERE id = ? AND user_id = ?",
      [memberId, currentUserId]
    );
    if (members.length === 0) {
      return res.status(404).json({ error: "ไม่พบสมาชิก" });
    }

    await db.execute(
      `INSERT INTO appointments (member_id, appointment_date, appointment_time, doctor_name, hospital_name, reminder_note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [memberId, appointment_date, appointment_time, doctor_name, hospital_name, reminder_note || 'ล่วงหน้า 1 วัน']
    );

    return res.status(201).json({ message: "สร้างนัดหมายสำเร็จ" });
  } catch (err) {
    console.error("Create appointment error:", err);
    return res.status(500).json({ error: "ไม่สามารถสร้างนัดหมายได้" });
  }
});

app.delete("/api/appointments/:id", verifyUser, async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.id;

  try {
    const [rows] = await db.execute(
      `SELECT a.id FROM appointments a
       JOIN family_members f ON a.member_id = f.id
       WHERE a.id = ? AND f.user_id = ?`,
      [id, currentUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "ไม่พบข้อมูลนัดหมาย หรือไม่มีสิทธิ์ลบ" });
    }

    await db.execute("DELETE FROM appointments WHERE id = ?", [id]);
    return res.json({ message: "ลบนัดหมายสำเร็จ" });
  } catch (err) {
    console.error("Delete appointment error:", err);
    return res.status(500).json({ error: "ไม่สามารถลบนัดหมายได้" });
  }
});

app.put("/api/family-members/:memberId/emergency-contact", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const { emergency_contact_name, emergency_contact_phone } = req.body;
  const currentUserId = req.user.id;

  try {
    const [result] = await db.execute(
      `UPDATE family_members 
       SET emergency_contact_name = ?, emergency_contact_phone = ?
       WHERE id = ? AND user_id = ?`,
      [emergency_contact_name, emergency_contact_phone, memberId, currentUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "ไม่พบสมาชิก หรือไม่มีสิทธิ์แก้ไข" });
    }
    return res.json({ message: "บันทึกข้อมูลผู้ติดต่อฉุกเฉินเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("Update emergency contact error:", err);
    return res.status(500).json({ error: "ไม่สามารถบันทึกข้อมูลผู้ติดต่อฉุกเฉินได้" });
  }
});

// ------------------------------------------
// 7. Garmin Integration & Mock Sync Data
// ------------------------------------------

// Endpoint สำหรับเริ่มต้นเชื่อมต่อ Garmin (รองรับการตั้งค่า OAuth ขั้นต้น)
app.get("/api/garmin/connect/:memberId", verifyUser, (req, res) => {
  const { memberId } = req.params;
  
  // หากยังไม่ได้ตั้งค่า Client ID ใน .env ให้แจ้งเตือน หรือใช้ระบบ Mock จำลองการเชื่อมต่อแทน
  if (!GARMIN_CLIENT_ID) {
    return res.status(400).json({ 
      error: "ยังไม่ได้กำหนดค่า Garmin Client ID ในระบบ (สามารถใช้ Mock Sync ทดแทนได้)",
      mockSupported: true 
    });
  }

  // ตัวอย่าง URL สำหรับ redirect ไปยัง Garmin OAuth 2.0
  const authUrl = `https://connect.garmin.com/oauth2/authorize?client_id=${GARMIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(GARMIN_REDIRECT_URI)}&response_type=code`;
  return res.json({ authUrl });
});

app.post("/api/garmin/mock-sync/:memberId", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const currentUserId = req.user.id;

  try {
    const [rows] = await db.execute(
      "SELECT id, name, steps, sleep FROM family_members WHERE id = ? AND user_id = ?",
      [memberId, currentUserId]
    );

    const member = rows[0];
    if (!member) {
      return res.status(404).json({ error: "ไม่พบสมาชิก" });
    }

    const body = req.body || {};
    const randomHr = Math.floor(Math.random() * (110 - 60 + 1)) + 60;
    const heartRate = body.heart_rate || `${randomHr} bpm`;

    let currentStepsNum = 3500;
    if (member.steps && member.steps !== '-' && member.steps !== '0') {
      currentStepsNum = Number(String(member.steps).replace(/,/g, "")) || 3500;
    }
    const addedSteps = Math.floor(Math.random() * 20) + 5;
    const newStepsNum = currentStepsNum + addedSteps;
    const steps = body.steps || newStepsNum.toLocaleString("en-US");
    const sleep = body.sleep || (member.sleep && member.sleep !== '-' ? member.sleep : "7.5 ชม.");

    let status = "ปกติ";
    if (randomHr > 100 || randomHr < 50) status = "อันตราย";
    if (body.status) status = body.status;

    // อัปเดตสถานะว่าเชื่อมต่ออุปกรณ์สำเร็จ (is_connected = 1)
    await db.execute(
      `UPDATE family_members 
       SET heart_rate = ?, steps = ?, sleep = ?, status = ?, is_connected = 1, last_synced_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [heartRate, steps, sleep, status, memberId, currentUserId]
    );

    const sleepHoursNum = parseFloat(String(sleep).replace(/[^0-9.]/g, "")) || 7.5;
    await saveHealthHistory(memberId, randomHr, newStepsNum, sleepHoursNum);

    return res.json({ message: "Garmin mock sync success", data: { heartRate, steps, sleep, status } });
  } catch (err) {
    console.error("Mock Sync Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------
// 8. Start Server
// ------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});