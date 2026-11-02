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

// Garmin Credentials (OAuth 2.0 PKCE)
const GARMIN_CLIENT_ID = process.env.GARMIN_CLIENT_ID?.trim();
const GARMIN_CLIENT_SECRET = process.env.GARMIN_CLIENT_SECRET?.trim();
const GARMIN_REDIRECT_URI = process.env.GARMIN_REDIRECT_URI?.trim();

const GARMIN_TOKEN_URL = "https://connectapi.garmin.com/di-oauth2-service/oauth/token";
const GARMIN_API_BASE = "https://apis.garmin.com/wellness-api/rest";

// ------------------------------------------
// Helper: PKCE Code Generation (SHA-256)
// ------------------------------------------
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier) {
  return crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
}

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

const verifyAdmin = (req, res, next) => {
  verifyUser(req, res, () => {
    if (req.user.role === "admin") {
      next();
    } else {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
  });
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
// 5. Family Members Routes & History API
// ------------------------------------------
app.get("/api/family-members", verifyUser, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const [rows] = await db.execute(
      "SELECT id, name, relation, avatar_text, device, heart_rate, steps, sleep, status, is_connected FROM family_members WHERE user_id = ? ORDER BY id DESC",
      [currentUserId]
    );
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching family members:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/family-members/:memberId/history", verifyUser, async (req, res) => {
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
      `SELECT DATE_FORMAT(record_date, '%Y-%m-%d') as record_date, sleep_hours, avg_hr, steps 
       FROM health_history 
       WHERE member_id = ? AND record_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       ORDER BY record_date ASC`,
      [memberId]
    );

    const dataMap = {};
    rows.forEach(row => {
      dataMap[row.record_date] = row;
    });

    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const full7DaysData = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = dayNames[d.getDay()];

      const existingRecord = dataMap[dateStr];

      if (existingRecord) {
        full7DaysData.push({
          day: dayName,
          date: dateStr,
          sleep: parseFloat(existingRecord.sleep_hours) || 0,
          hr: Number(existingRecord.avg_hr) || 0,
          steps: Number(existingRecord.steps) || 0,
        });
      } else {
        full7DaysData.push({
          day: dayName,
          date: dateStr,
          sleep: 0,
          hr: 0,
          steps: 0,
        });
      }
    }

    return res.json(full7DaysData);
  } catch (err) {
    console.error("Fetch history error:", err);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลประวัติได้" });
  }
});

app.post("/api/family-members", verifyUser, async (req, res) => {
  const { name, relation } = req.body ?? {};
  if (!name || !relation) {
    return res.status(400).json({ error: "Name and relation are required" });
  }

  try {
    const currentUserId = req.user.id;
    const avatarText = name.charAt(0);

    const [result] = await db.execute(
      "INSERT INTO family_members (user_id, name, relation, avatar_text) VALUES (?, ?, ?, ?)",
      [currentUserId, name, relation, avatarText]
    );

    const [newMember] = await db.execute(
      "SELECT id, name, relation, avatar_text, device, heart_rate, steps, sleep, status, is_connected FROM family_members WHERE id = ? AND user_id = ?",
      [result.insertId, currentUserId]
    );

    return res.status(201).json(newMember[0]);
  } catch (err) {
    console.error("Error creating family member:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/family-members/:id", verifyUser, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { id } = req.params;

    const [result] = await db.execute(
      "DELETE FROM family_members WHERE id = ? AND user_id = ?",
      [id, currentUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Member not found or unauthorized" });
    }

    return res.json({ message: "Member deleted successfully", id: Number(id) });
  } catch (err) {
    console.error("Error deleting family member:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------
// 6. Real Garmin OAuth 2.0 PKCE Routes
// ------------------------------------------

// 1) สั่งสร้าง PKCE Challenge แล้วส่ง Auth URL ของ Garmin Connect กลับไปให้ Frontend Redirect
app.get("/api/garmin/connect/:memberId", verifyUser, async (req, res) => {
  const { memberId } = req.params;

  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // เก็บ Code Verifier ไว้ใน Session ชั่วคราวเพื่อรอใช้แลก Token ตอน Callback
    req.session.garminPKCE = {
      codeVerifier,
      memberId,
    };

    const garminAuthUrl = `https://connect.garmin.com/oauthConfirm?` +
      `response_type=code` +
      `&client_id=${GARMIN_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(GARMIN_REDIRECT_URI)}` +
      `&code_challenge=${codeChallenge}` +
      `&code_challenge_method=S256` +
      `&state=${memberId}`;

    return res.json({ url: garminAuthUrl });
  } catch (err) {
    console.error("Garmin Auth Connect Error:", err);
    return res.status(500).json({ error: "ไม่สามารถสร้าง URL เชื่อมต่อ Garmin ได้" });
  }
});

// 2) Callback เมื่อผู้ใช้กด ยินยอม/เข้าสู่ระบบ ที่ Garmin แล้วเด้งกลับมาที่ระบบของคุณ
app.get("/api/garmin/callback", verifyUser, async (req, res) => {
  const { code, state: memberId } = req.query;
  const pkceData = req.session.garminPKCE;

  if (!code || !pkceData || pkceData.memberId !== memberId) {
    return res.status(400).json({ error: "Invalid OAuth session state" });
  }

  try {
    // แลกเปลี่ยน Authorization Code เป็น Access Token กับ Garmin Server
    const tokenResponse = await axios.post(
      GARMIN_TOKEN_URL,
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: GARMIN_CLIENT_ID,
        client_secret: GARMIN_CLIENT_SECRET,
        code: String(code),
        redirect_uri: GARMIN_REDIRECT_URI,
        code_verifier: pkceData.codeVerifier,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // ยิง API ดึง garmin_user_id เพิ่มเติม
    let garminUserId = null;
    try {
      const userProfileRes = await axios.get(
        `${GARMIN_API_BASE}/user/id`,
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        }
      );
      garminUserId = userProfileRes.data.userId || userProfileRes.data.userAccessToken || null;
    } catch (profileErr) {
      console.error("Failed to fetch Garmin User ID:", profileErr?.response?.data || profileErr.message);
    }

    // อัปเดตสถานะเชื่อมต่อและบันทึก garmin_user_id ลง Database
    await db.execute(
      `UPDATE family_members 
       SET is_connected = 1, 
           garmin_access_token = ?, 
           garmin_refresh_token = ?,
           garmin_user_id = ?
       WHERE id = ? AND user_id = ?`,
      [access_token, refresh_token, garminUserId, memberId, req.user.id]
    );

    delete req.session.garminPKCE;
    return res.redirect(`${CLIENT_ORIGIN}/party`);
  } catch (err) {
    console.error("Garmin OAuth Token Error:", err?.response?.data || err.message);
    return res.status(500).json({ error: "Failed to exchange token with Garmin" });
  }
});

// ------------------------------------------
// 7. Mock Sync Data (ใช้ทดสอบส่งข้อมูลเข้าระบบ)
// ------------------------------------------
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
      return res.status(404).json({ error: "ไม่พบสมาชิก หรือไม่มีสิทธิ์เข้าถึง" });
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

    const mockData = { heartRate, steps, sleep, status };

    await db.execute(
      `UPDATE family_members 
       SET heart_rate = ?, steps = ?, sleep = ?, status = ?, last_synced_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [mockData.heartRate, mockData.steps, mockData.sleep, mockData.status, memberId, currentUserId]
    );

    const sleepHoursNum = parseFloat(String(sleep).replace(/[^0-9.]/g, "")) || 7.5;
    await saveHealthHistory(memberId, randomHr, newStepsNum, sleepHoursNum);

    return res.json({
      message: `จำลองข้อมูลของ ${member.name} สำเร็จ!`,
      data: mockData,
    });
  } catch (err) {
    console.error("Mock Sync Error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการสร้าง Mock Data" });
  }
});

app.post("/api/garmin/stop-mock/:memberId", verifyUser, async (req, res) => {
  const { memberId } = req.params;
  const currentUserId = req.user.id;

  try {
    await db.execute(
      `UPDATE family_members 
       SET heart_rate = '-', steps = '-', sleep = '-', status = 'ไม่มีข้อมูล', last_synced_at = NULL
       WHERE id = ? AND user_id = ?`,
      [memberId, currentUserId]
    );

    return res.json({ message: "หยุดการซิงค์ข้อมูลชั่วคราวแล้ว" });
  } catch (err) {
    console.error("Stop Mock Error:", err);
    return res.status(500).json({ error: "ไม่สามารถหยุดการซิงค์ได้" });
  }
});

// ------------------------------------------
// 8. Start Server
// ------------------------------------------
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});