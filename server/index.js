import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";

const PORT = process.env.PORT || 8081;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SALT_ROUNDS = 10;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

const app = express();
app.use(express.json());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "signup_login",
});

// Middleware ตรวจสอบสิทธิ์การเข้าใช้งานทั่วไป
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

// Middleware สำหรับตรวจสิทธิ์ Admin เท่านั้น
const verifyAdmin = (req, res, next) => {
  verifyUser(req, res, () => {
    if (req.user.role === "admin") {
      next();
    } else {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }
  });
};

// Register
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email and password are required" });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
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
      return res
        .status(409)
        .json({ error: "This email is already registered" });
    }
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Login
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

// Get User Profile
app.get("/me", verifyUser, (req, res) => {
  return res.json({ id: req.user.id, name: req.user.name, role: req.user.role });
});

// Admin Route: ดึงรายชื่อผู้ใช้ทั้งหมด
app.get("/admin/users", verifyAdmin, async (req, res) => {
  try {
    const [users] = await db.execute("SELECT id, name, email, role, created_at FROM users");
    return res.json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Admin Route: ดึงข้อมูลสถิติสำหรับหน้า Dashboard
app.get("/admin/dashboard-stats", verifyAdmin, async (req, res) => {
  try {
    const [totalRows] = await db.execute(
      "SELECT COUNT(id) AS total FROM users WHERE role != 'admin' OR role IS NULL"
    );

    const [growthRows] = await db.execute(
      "SELECT COUNT(id) AS total FROM users WHERE (role != 'admin' OR role IS NULL) AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );

    const [chartRows] = await db.execute(`
      SELECT 
        DATE(created_at) AS date_val,
        COUNT(id) AS count
      FROM users
      WHERE (role != 'admin' OR role IS NULL)
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(created_at)
    `);

    const dbDataMap = {};
    chartRows.forEach((row) => {
      const d = new Date(row.date_val);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      dbDataMap[dateStr] = Number(row.count);
    });

    const dayMap = {
      Sun: "อา.", Mon: "จ.", Tue: "อ.",
      Wed: "พ.", Thu: "พฤ.", Fri: "ศ.", Sat: "ส."
    };

    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayEn = d.toLocaleDateString("en-US", { weekday: "short" });

      weeklyData.push({
        day: dayMap[dayEn] || dayEn,
        count: dbDataMap[dateStr] || 0
      });
    }

    return res.json({
      totalUsers: totalRows[0]?.total || 0,
      weeklyGrowth: growthRows[0]?.total || 0,
      weeklyData: weeklyData
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// 👨‍👩‍👧‍👦 Family Members Routes (แยกเฉพาะ User)
// ==========================================

// 1. ดึงสมาชิกเฉพาะของผู้ใช้งานที่ล็อกอินอยู่
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

// 2. เพิ่มสมาชิกใหม่ ผูกกับ user_id
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

// 3. ลบสมาชิกครอบครัว
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

// Logout
app.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  return res.json({ message: "Logged out" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});