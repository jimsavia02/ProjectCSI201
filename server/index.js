import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";

// ---------------------------------------------------------------------------
// Config
// Every value can be overridden with an environment variable; the defaults
// match a local XAMPP/MySQL install and the Vite dev server.
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 8081;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SALT_ROUNDS = 10;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000, // 1 day, same as the JWT lifetime
};

// ---------------------------------------------------------------------------
// App and database
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
// credentials: true lets the browser send the login cookie from the frontend
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());

// Tables are created by schema.sql
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "signup_login",
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Put this in front of any route that needs a logged-in user.
// It reads the JWT from the "token" cookie and stores its payload in req.user.
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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /register  { name, email, password }  ->  201 { message }
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
      [name, email, hash],
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

// POST /login  { email, password }  ->  sets the "token" cookie, { id, name, email }
app.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const [rows] = await db.execute(
      "SELECT id, name, email, password FROM users WHERE email = ?",
      [email],
    );
    const user = rows[0];
    // Same message for both cases so nobody can tell which emails exist
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Email or password is incorrect" });
    }
    const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, {
      expiresIn: "1d",
    });
    res.cookie("token", token, COOKIE_OPTIONS);
    return res.json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /me  ->  { id, name } of the logged-in user (401 if not logged in)
app.get("/me", verifyUser, (req, res) => {
  return res.json({ id: req.user.id, name: req.user.name });
});

// POST /logout  ->  clears the "token" cookie
app.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  return res.json({ message: "Logged out" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
