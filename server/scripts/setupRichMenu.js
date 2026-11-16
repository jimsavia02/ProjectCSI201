// ------------------------------------------
// สร้าง Rich Menu ของบอท 2 ชุด (รันครั้งเดียว หรือรันใหม่เมื่อเปลี่ยนรูป/ปุ่ม)
//   cd server
//   node scripts/setupRichMenu.js
//
// 1. linked   : 6 ปุ่ม (รูป assets/richmenu-linked.png 2500×1686)   ให้คนที่เชื่อมบัญชีแล้ว
// 2. unlinked : 2 ปุ่ม (รูป assets/richmenu-unlinked.png 2500×843) เป็นเมนู default ของทุกคน
//
// เสร็จแล้วจะพิมพ์ LINE_RICHMENU_LINKED / LINE_RICHMENU_UNLINKED ให้คัดลอกไปใส่ใน .env แล้วรีสตาร์ท server
// คนที่เชื่อมบัญชีอยู่แล้วจะถูกสลับไปใช้เมนู linked ชุดใหม่ให้ทันที และเมนูชุดเก่าของบอทจะถูกลบ
// ------------------------------------------
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(SERVER_DIR, ".env") });

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL?.trim().replace(/\/+$/, "");
const API = "https://api.line.me/v2/bot";
const DATA_API = "https://api-data.line.me/v2/bot";
const headers = { Authorization: `Bearer ${ACCESS_TOKEN}` };

const MENU_NAMES = { linked: "PulsePanda – linked", unlinked: "PulsePanda – unlinked" };
const MAX_IMAGE_BYTES = 1024 * 1024; // LINE รับรูป rich menu ไม่เกิน 1MB

const postback = (action, displayText) => ({ type: "postback", data: `action=${action}`, displayText });

// พื้นที่กด 2 แถว × 3 คอลัมน์ (คอลัมน์สุดท้ายกว้าง 834 ให้ครบ 2500)
const cell = (col, row) => ({ x: col * 833, y: row * 843, width: col === 2 ? 834 : 833, height: 843 });

const linkedMenu = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: MENU_NAMES.linked,
  chatBarText: "เมนูผู้ดูแล",
  areas: [
    { bounds: cell(0, 0), action: postback("status", "สถานะตอนนี้") },
    { bounds: cell(1, 0), action: postback("emergency", "โทรฉุกเฉิน") },
    { bounds: cell(2, 0), action: { type: "message", text: "ปลอดภัย" } },
    { bounds: cell(0, 1), action: postback("appointments", "นัดหมาย") },
    { bounds: cell(1, 1), action: postback("report", "รายงาน") },
    { bounds: cell(2, 1), action: postback("web", "เปิดเว็บ") },
  ],
};

const unlinkedMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: MENU_NAMES.unlinked,
  chatBarText: "เริ่มต้นใช้งาน",
  areas: [
    { bounds: { x: 0, y: 0, width: 1250, height: 843 }, action: postback("howto", "วิธีเชื่อมบัญชี") },
    { bounds: { x: 1250, y: 0, width: 1250, height: 843 }, action: { type: "uri", uri: `${PUBLIC_WEB_URL}/login` } },
  ],
};

function readImage(file) {
  const full = path.join(SERVER_DIR, "assets", file);
  if (!fs.existsSync(full)) throw new Error(`ไม่พบรูป ${full}`);
  const buf = fs.readFileSync(full);
  if (buf.length > MAX_IMAGE_BYTES) throw new Error(`${file} ใหญ่ ${(buf.length / 1024).toFixed(0)}KB เกิน 1MB`);
  const type = /\.jpe?g$/i.test(file) ? "image/jpeg" : "image/png";
  return { buf, type };
}

async function createMenu(menu, image) {
  const { data } = await axios.post(`${API}/richmenu`, menu, { headers });
  await axios.post(`${DATA_API}/richmenu/${data.richMenuId}/content`, image.buf, {
    headers: { ...headers, "Content-Type": image.type },
    maxBodyLength: Infinity,
  });
  console.log(`✓ สร้าง "${menu.name}" -> ${data.richMenuId}`);
  return data.richMenuId;
}

async function main() {
  if (!ACCESS_TOKEN) throw new Error("ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN ใน .env");
  if (!PUBLIC_WEB_URL || /localhost|127\.0\.0\.1/.test(PUBLIC_WEB_URL)) {
    throw new Error("ตั้ง PUBLIC_WEB_URL ใน .env เป็นที่อยู่ที่มือถือเปิดได้ก่อน (เช่น https://xxx.trycloudflare.com)");
  }

  // ตรวจรูปให้ครบก่อน จะได้ไม่สร้างเมนูค้างไว้ครึ่งเดียว
  const linkedImage = readImage("richmenu-linked.png");
  const unlinkedImage = readImage("richmenu-unlinked.png");

  // ตรวจรูปแบบ JSON กับ LINE ก่อนสร้างจริง
  await axios.post(`${API}/richmenu/validate`, linkedMenu, { headers });
  await axios.post(`${API}/richmenu/validate`, unlinkedMenu, { headers });

  const { data: old } = await axios.get(`${API}/richmenu/list`, { headers });
  const oldIds = old.richmenus.filter((m) => Object.values(MENU_NAMES).includes(m.name)).map((m) => m.richMenuId);

  const linkedId = await createMenu(linkedMenu, linkedImage);
  const unlinkedId = await createMenu(unlinkedMenu, unlinkedImage);

  await axios.post(`${API}/user/all/richmenu/${unlinkedId}`, null, { headers });
  console.log("✓ ตั้งเมนู unlinked เป็นเมนู default");

  // คนที่เชื่อมบัญชีไว้แล้ว -> ใช้เมนู linked ชุดใหม่
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "signup_login",
  });
  try {
    const [rows] = await db.execute("SELECT line_user_id FROM users WHERE line_user_id IS NOT NULL");
    for (const { line_user_id } of rows) {
      try {
        await axios.post(`${API}/user/${line_user_id}/richmenu/${linkedId}`, null, { headers });
      } catch (err) {
        console.warn("  สลับเมนูไม่สำเร็จ:", line_user_id.slice(0, 8) + "…", err.response?.data?.message || err.message);
      }
    }
    console.log(`✓ สลับเมนู linked ให้ผู้ใช้ที่เชื่อมอยู่ ${rows.length} คน`);
  } finally {
    await db.end();
  }

  for (const id of oldIds) {
    await axios.delete(`${API}/richmenu/${id}`, { headers }).catch(() => {});
  }
  if (oldIds.length) console.log(`✓ ลบเมนูชุดเก่า ${oldIds.length} ชุด`);

  console.log("\nคัดลอก 2 บรรทัดนี้ไปใส่ใน server/.env แล้วรีสตาร์ท server:\n");
  console.log(`LINE_RICHMENU_LINKED=${linkedId}`);
  console.log(`LINE_RICHMENU_UNLINKED=${unlinkedId}`);
}

main().catch((err) => {
  console.error("✗ ตั้งค่า Rich Menu ไม่สำเร็จ:", err.response?.data ? JSON.stringify(err.response.data) : err.message);
  process.exit(1);
});
