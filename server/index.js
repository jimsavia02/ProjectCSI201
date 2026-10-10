import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SALT_ROUNDS = 10;
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
};

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(cookieParser());

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "signup_login",
});

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

app.get("/me", verifyUser, (req, res) => {
  return res.json({ id: req.user.id, name: req.user.name });
});

app.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  return res.json({ message: "Logged out" });
});

app.listen(8081, () => {
  console.log("Server is running....");
});
