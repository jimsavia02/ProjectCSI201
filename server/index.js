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
import { READING_TYPES, purgeOldReadings, syncMockReadings, startOfDay } from "./mockHealth.js";

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

const PHONE_ERROR = "เบอร์โทรศัพท์ต้องเป็นตัวเลขเท่านั้น และไม่เกิน 10 หลัก";
const isValidPhone = (phone) => {
  if (phone == null || phone === "") return true;
  return typeof phone === "string" && /^\d{1,10}$/.test(phone.trim());
};

const verifyAdmin = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "กรุณาล็อกอิน" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ error: "ไม่มีสิทธิ์เข้าถึง" });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token ไม่ถูกต้อง" });
  }
};

// ------------------------------------------
// 4. Auth & User Routes
// ------------------------------------------
app.post("/register", async (req, res) => {
  const { name, email, phone, password } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: PHONE_ERROR });
  }
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.execute(
      "INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)",
      [name, email, phone?.trim() || null, hash]
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
    return res.status(400).json({ error: "กรุณากรอก Email หรือ password" });
  }
  try {
    const [rows] = await db.execute(
      "SELECT id, name, email, password, role FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Email หรือ password ไม่ถูกต้อง" });
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
    return res.status(500).json({ error: "Server มีความผิดพลาด" });
  }
});

app.get("/me", verifyUser, (req, res) => {
  return res.json({ id: req.user.id, name: req.user.name, role: req.user.role });
});

app.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  return res.json({ message: "Logged out" });
});

app.get("/api/account", verifyUser, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, name, email, phone, role FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้" });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error("Fetch account error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/account", verifyUser, async (req, res) => {
  const { name, email, phone } = req.body ?? {};
  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "กรุณากรอกชื่อและอีเมล" });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: PHONE_ERROR });
  }

  try {
    await db.execute(
      "UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?",
      [name.trim(), email.trim(), phone?.trim() || null, req.user.id]
    );

    const [[{ role }]] = await db.execute("SELECT role FROM users WHERE id = ?", [req.user.id]);
    const token = jwt.sign(
      { id: req.user.id, name: name.trim(), role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.cookie("token", token, COOKIE_OPTIONS);

    return res.json({ message: "บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "อีเมลนี้ถูกใช้งานแล้ว" });
    }
    console.error("Update account error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/account/password", verifyUser, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "กรุณากรอกรหัสผ่านให้ครบ" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" });
  }

  try {
    const [[user]] = await db.execute("SELECT password FROM users WHERE id = ?", [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้" });
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.execute("UPDATE users SET password = ? WHERE id = ?", [hash, req.user.id]);
    return res.json({ message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------
// 5. Family Members & Management Routes
// ------------------------------------------

app.get("/api/family-members", verifyUser, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const [rows] = await db.execute(
      `SELECT id, name, relation, avatar_text, device, heart_rate, steps, sleep, status, is_connected,
              last_synced_at, emergency_contact_name, emergency_contact_phone
       FROM family_members WHERE user_id = ? ORDER BY id DESC`,
      [currentUserId]
    );
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching family members:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// เพิ่มสมาชิกใหม่: ตั้งค่าเริ่มต้นเป็น '-' และสถานะ 'ไม่มีข้อมูล'
app.post("/api/family-members", verifyUser, async (req, res) => {
  const currentUserId = req.user.id;
  const { name, relation, device } = req.body;

  if (!name || !relation) {
    return res.status(400).json({ error: "กรุณากรอกชื่อและความสัมพันธ์" });
  }

  try {
    const defaultDevice = device || 'Garmin Smartwatch';
    const [result] = await db.execute(
      `INSERT INTO family_members (user_id, name, relation, device, heart_rate, steps, sleep, status, is_connected)
       VALUES (?, ?, ?, ?, '-', '-', '-', 'ไม่มีข้อมูล', 0)`,
      [currentUserId, name, relation, defaultDevice]
    );

    const [newMemberRows] = await db.execute(
      `SELECT id, name, relation, avatar_text, device, heart_rate, steps, sleep, status, is_connected,
              last_synced_at, emergency_contact_name, emergency_contact_phone
       FROM family_members WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json(newMemberRows[0]);
  } catch (err) {
    console.error("Add family member error:", err);
    return res.status(500).json({ error: "ไม่สามารถเพิ่มสมาชิกได้" });
  }
});

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

  if (!emergency_contact_phone?.trim() || !isValidPhone(emergency_contact_phone)) {
    return res.status(400).json({ error: PHONE_ERROR });
  }

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

// Garmin OAuth 2.0 PKCE endpoints
const GARMIN_AUTH_URL = "https://connect.garmin.com/oauth2Confirm";
const GARMIN_TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const GARMIN_USER_ID_URL = "https://apis.garmin.com/wellness-api/rest/user/id";

// state -> { codeVerifier, memberId, userId, createdAt } (หมดอายุใน 10 นาที)
const garminPendingAuth = new Map();
const GARMIN_STATE_TTL_MS = 10 * 60 * 1000;

app.get("/api/garmin/connect/:memberId", verifyUser, async (req, res) => {
  const { memberId } = req.params;

  if (!GARMIN_CLIENT_ID || !GARMIN_REDIRECT_URI) {
    return res.status(400).json({
      error: "ยังไม่ได้กำหนดค่า Garmin Client ID ในระบบ (สามารถใช้ Mock Sync ทดแทนได้)",
      mockSupported: true,
    });
  }

  try {
    const [rows] = await db.execute(
      "SELECT id FROM family_members WHERE id = ? AND user_id = ?",
      [memberId, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "ไม่พบสมาชิก" });

    // ล้าง state ที่หมดอายุ
    const now = Date.now();
    for (const [key, value] of garminPendingAuth) {
      if (now - value.createdAt > GARMIN_STATE_TTL_MS) garminPendingAuth.delete(key);
    }

    const codeVerifier = crypto.randomBytes(48).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    const state = crypto.randomBytes(16).toString("hex");
    garminPendingAuth.set(state, { codeVerifier, memberId, userId: req.user.id, createdAt: now });

    const params = new URLSearchParams({
      client_id: GARMIN_CLIENT_ID,
      response_type: "code",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      redirect_uri: GARMIN_REDIRECT_URI,
      state,
    });
    return res.json({ authUrl: `${GARMIN_AUTH_URL}?${params}` });
  } catch (err) {
    console.error("Garmin connect error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Garmin จะ redirect กลับมาที่นี่หลังผู้ใช้กดอนุญาต
app.get("/api/garmin/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const backToParty = (status) => res.redirect(`${CLIENT_ORIGIN}/party?status=${status}`);

  const pending = state && garminPendingAuth.get(state);
  if (state) garminPendingAuth.delete(state);

  if (error || !code || !pending || Date.now() - pending.createdAt > GARMIN_STATE_TTL_MS) {
    console.error("Garmin callback rejected:", { error, hasCode: !!code, validState: !!pending });
    return backToParty("error");
  }

  try {
    const tokenRes = await axios.post(
      GARMIN_TOKEN_URL,
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: GARMIN_CLIENT_ID,
        client_secret: GARMIN_CLIENT_SECRET,
        code,
        code_verifier: pending.codeVerifier,
        redirect_uri: GARMIN_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const { access_token, refresh_token, expires_in } = tokenRes.data;

    let garminUserId = null;
    try {
      const idRes = await axios.get(GARMIN_USER_ID_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      garminUserId = idRes.data?.userId ?? null;
    } catch (e) {
      console.warn("Garmin user id fetch failed:", e.response?.status || e.message);
    }

    await db.execute(
      `UPDATE family_members
       SET garmin_user_id = ?, garmin_access_token = ?, garmin_refresh_token = ?,
           garmin_token_expires_at = ?, is_connected = 1
       WHERE id = ? AND user_id = ?`,
      [
        garminUserId,
        access_token,
        refresh_token ?? null,
        Date.now() + (Number(expires_in) || 0) * 1000,
        pending.memberId,
        pending.userId,
      ]
    );

    return backToParty("success");
  } catch (err) {
    console.error("Garmin token exchange failed:", err.response?.data || err.message);
    return backToParty("error");
  }
});

app.post("/api/garmin/mock-sync/:memberId", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const currentUserId = req.user.id;

  try {
    const [rows] = await db.execute(
      "SELECT id, name, device FROM family_members WHERE id = ? AND user_id = ?",
      [memberId, currentUserId]
    );

    const member = rows[0];
    if (!member) {
      return res.status(404).json({ error: "ไม่พบสมาชิก" });
    }

    const latest = await syncMockReadings(db, memberId, member.device || "Smart Watch");
    const randomHr = latest.heart_rate;
    const newStepsNum = latest.steps ?? 0;
    const sleepHours = latest.sleep ?? 7.5;

    const body = req.body || {};
    const heartRate = body.heart_rate || `${randomHr} bpm`;
    const steps = body.steps || newStepsNum.toLocaleString("en-US");
    const sleep = body.sleep || `${sleepHours} ชม.`;

    let status = "ปกติ";
    if (randomHr > 100 || randomHr < 50) status = "อันตราย";
    if (body.status) status = body.status;

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

// Endpoint หยุด Mock ข้อมูลและรีเซ็ตเป็นไม่มีข้อมูล
app.post("/api/garmin/stop-mock/:memberId", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const currentUserId = req.user.id;

  try {
    await db.execute(
      `UPDATE family_members 
       SET heart_rate = '-', steps = '-', sleep = '-', status = 'ไม่มีข้อมูล', is_connected = 0
       WHERE id = ? AND user_id = ?`,
      [memberId, currentUserId]
    );
    return res.json({ message: "Mock data stopped" });
  } catch (err) {
    console.error("Stop Mock Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------
// 7.1 ข้อมูลสุขภาพรายครั้ง (หน้า "ข้อมูลสุขภาพ")
// ------------------------------------------

app.get("/api/family-members/:memberId/readings", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const currentUserId = req.user.id;
  const type = req.query.type || "heart_rate";
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 8));

  if (!READING_TYPES.includes(type)) {
    return res.status(400).json({ error: "ประเภทข้อมูลไม่ถูกต้อง" });
  }

  try {
    const [members] = await db.execute(
      "SELECT id, name, relation, device, last_synced_at FROM family_members WHERE id = ? AND user_id = ?",
      [memberId, currentUserId]
    );
    const member = members[0];
    if (!member) {
      return res.status(404).json({ error: "ไม่พบสมาชิก" });
    }

    await purgeOldReadings(db);

    const [[{ total }]] = await db.execute(
      "SELECT COUNT(*) AS total FROM health_readings WHERE member_id = ? AND type = ?",
      [memberId, type]
    );
    const [items] = await db.query(
      `SELECT id, value, source, recorded_at FROM health_readings
       WHERE member_id = ? AND type = ?
       ORDER BY recorded_at DESC LIMIT ? OFFSET ?`,
      [memberId, type, limit, (page - 1) * limit]
    );

    return res.json({
      member,
      items: items.map((r) => ({ ...r, value: r.value === null ? null : Number(r.value) })),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error("Fetch readings error:", err);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลสุขภาพได้" });
  }
});

// ------------------------------------------
// 7.2 รายงานสุขภาพ (หน้า "รายงาน")
// ------------------------------------------
const REPORT_PERIODS = [7, 30, 90];
const SLEEP_GOAL = 7;

const toDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

app.get("/api/family-members/:memberId/report", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const days = Number(req.query.days) || 30;
  if (!REPORT_PERIODS.includes(days)) {
    return res.status(400).json({ error: "ช่วงเวลาไม่ถูกต้อง" });
  }

  try {
    const [members] = await db.execute(
      "SELECT id, name, relation, device FROM family_members WHERE id = ? AND user_id = ?",
      [memberId, req.user.id]
    );
    const member = members[0];
    if (!member) {
      return res.status(404).json({ error: "ไม่พบสมาชิก" });
    }

    await purgeOldReadings(db);

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

    return res.json({
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
    });
  } catch (err) {
    console.error("Fetch report error:", err);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลรายงานได้" });
  }
});

// ------------------------------------------
// 8. Admin Dashboard API
// ------------------------------------------

app.get("/admin/dashboard-stats", verifyAdmin, async (req, res) => {
  try {
    // ผู้ใช้ทั้งหมด
    const [[{ totalUsers }]] = await db.execute(
      "SELECT COUNT(*) AS totalUsers FROM users WHERE role = 'user'"
    );

    // ผู้ใช้ใหม่สัปดาห์นี้
    const [[{ weeklyUserGrowth }]] = await db.execute(
      "SELECT COUNT(*) AS weeklyUserGrowth FROM users WHERE role = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );

    // อุปกรณ์ทั้งหมด (family members)
    const [[{ totalDevices }]] = await db.execute(
      "SELECT COUNT(*) AS totalDevices FROM family_members"
    );

    // อุปกรณ์ใหม่สัปดาห์นี้
    const [[{ weeklyDeviceGrowth }]] = await db.execute(
      "SELECT COUNT(*) AS weeklyDeviceGrowth FROM family_members WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );

    // ออนไลน์วันนี้ (is_connected = 1)
    const [[{ onlineToday }]] = await db.execute(
      "SELECT COUNT(*) AS onlineToday FROM family_members WHERE is_connected = 1"
    );
    const onlinePct = totalDevices > 0 ? Math.round((onlineToday / totalDevices) * 100) : 0;

    // เข้าใช้วันนี้ (users ที่ล็อกอินในวันนี้ — ใช้ตาราง users ที่มีอยู่ โดยนับ user สมัครวันนี้แทน)
    const [[{ newUsersToday }]] = await db.execute(
      "SELECT COUNT(*) AS newUsersToday FROM users WHERE role = 'user' AND DATE(created_at) = CURDATE()"
    );
    const [[{ newUsersYesterday }]] = await db.execute(
      "SELECT COUNT(*) AS newUsersYesterday FROM users WHERE role = 'user' AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)"
    );

    // ผู้ใช้ใหม่รายวัน 7 วันล่าสุด
    const [weeklyRows] = await db.execute(`
      SELECT
        DATE_FORMAT(d.day, '%a') AS dayLabel,
        COALESCE(u.cnt, 0) AS count
      FROM (
        SELECT CURDATE() - INTERVAL n DAY AS day
        FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) nums
        ORDER BY n DESC
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) AS reg_date, COUNT(*) AS cnt
        FROM users WHERE role = 'user' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(created_at)
      ) u ON d.day = u.reg_date
    `);

    // แปลง dayLabel เป็นภาษาไทย
    const dayMap = { Mon: 'จ.', Tue: 'อ.', Wed: 'พ.', Thu: 'พฤ.', Fri: 'ศ.', Sat: 'ส.', Sun: 'อา.' };
    const weeklyData = weeklyRows.map((r) => ({
      day: dayMap[r.dayLabel] || r.dayLabel,
      count: Number(r.count),
    }));

    // อุปกรณ์ตามยี่ห้อ (จาก device column)
    const [deviceRows] = await db.execute(
      "SELECT device FROM family_members WHERE device IS NOT NULL AND device != ''"
    );
    const brandMap = {};
    deviceRows.forEach(({ device }) => {
      const d = (device || "").toLowerCase();
      let brand = "อื่นๆ";
      if (d.includes("apple") || d.includes("watch")) brand = "Apple Watch";
      else if (d.includes("samsung") || d.includes("galaxy")) brand = "Samsung Galaxy Watch";
      else if (d.includes("garmin")) brand = "Garmin";
      else if (d.includes("xiaomi") || d.includes("mi band") || d.includes("amazfit")) brand = "Xiaomi / อื่นๆ";
      brandMap[brand] = (brandMap[brand] || 0) + 1;
    });
    const totalBranded = Object.values(brandMap).reduce((a, b) => a + b, 0) || 1;
    const brandOrder = ["Apple Watch", "Samsung Galaxy Watch", "Garmin", "Xiaomi / อื่นๆ", "อื่นๆ"];
    const deviceBrands = brandOrder
      .filter((b) => brandMap[b])
      .map((b) => ({ brand: b, count: brandMap[b], pct: Math.round((brandMap[b] / totalBranded) * 100) }));

    return res.json({
      totalUsers: Number(totalUsers),
      weeklyUserGrowth: Number(weeklyUserGrowth),
      totalDevices: Number(totalDevices),
      weeklyDeviceGrowth: Number(weeklyDeviceGrowth),
      onlineToday: Number(onlineToday),
      onlinePct,
      newUsersToday: Number(newUsersToday),
      newUsersYesterday: Number(newUsersYesterday),
      weeklyData,
      deviceBrands,
    });
  } catch (err) {
    console.error("Admin dashboard stats error:", err);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลได้" });
  }
});

// ------------------------------------------
// 9. Start Server
// ------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});