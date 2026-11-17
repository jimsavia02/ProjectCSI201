// ------------------------------------------
// LINE Messaging API: เชื่อมบัญชี LINE กับผู้ใช้ และส่งแจ้งเตือนชีพจรผิดปกติ
//
// การจับคู่: ผู้ใช้กด "เชื่อม LINE" ในหน้าตั้งค่า -> ได้รหัส 6 หลัก -> พิมพ์รหัสในแชทบอท
// -> webhook ได้ userId ของ LINE คนนั้น -> บันทึกลง users.line_user_id
//
// การแจ้งเตือนจะส่งไปที่ LINE ของ "เจ้าของสมาชิก" (family_members.user_id) เท่านั้น
// และ 1 LINE ผูกได้แค่ 1 บัญชี (UNIQUE) จึงไม่มีทางได้แจ้งเตือนของสมาชิกผู้ใช้คนอื่น
//
// ปุ่มใน Rich Menu ส่ง postback มา (action=status/emergency/...) บอทตอบด้วย reply เสมอ (ไม่กินโควตา)
// ข้อมูลที่ตอบดึงเฉพาะ family_members ของบัญชีที่ผูกกับ LINE นั้น
// ------------------------------------------
import crypto from "crypto";
import axios from "axios";
import { buildMemberReport } from "./report.js";
import { statusFlex, emergencyFlex, appointmentsFlex, reportFlex, webFlex } from "./lineFlex.js";
import { acknowledgeByCaregiver } from "./emergency.js";

const LINE_API = "https://api.line.me/v2/bot";
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET?.trim();
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();

// ที่อยู่เว็บที่มือถือเปิดได้ (tunnel / โดเมนจริง) ใช้ทำปุ่ม magic link ห้ามเป็น localhost
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL?.trim().replace(/\/+$/, "") || null;
const RICHMENU_LINKED = process.env.LINE_RICHMENU_LINKED?.trim();
const RICHMENU_UNLINKED = process.env.LINE_RICHMENU_UNLINKED?.trim();
const LOGIN_TOKEN_MINUTES = 5; // magic link ใช้ได้ครั้งเดียว ภายใน 5 นาที

const LINK_CODE_MINUTES = 10; // รหัสจับคู่หมดอายุใน 10 นาที
const SNOOZE_MINUTES = 10; // พิมพ์ "ปลอดภัย" ใน LINE -> พักการแจ้งเตือน 10 นาที
const SNOOZE_WORD = "ปลอดภัย";
// เงื่อนไขการแจ้งเตือน (สมาชิกแต่ละคนเปิด/ปิดแต่ละข้อได้ในหน้านัดหมาย)
export const HR_HIGH = 120; // ชีพจรสูงกว่านี้แจ้งทันที
export const HR_LOW = 50; // ชีพจรต่ำกว่านี้แจ้งทันที
export const STRESS_HIGH = 80; // ความเครียดสูงกว่านี้...
export const STRESS_MINUTES = 30; // ...ต่อเนื่องเกินกี่นาทีถึงแจ้ง
const REMIND_MINUTES = 10; // ยังผิดปกติอยู่ -> เตือนซ้ำได้ไม่ถี่กว่าทุก 10 นาที

const lineHeaders = () => ({ Authorization: `Bearer ${ACCESS_TOKEN}` });

if (!CHANNEL_SECRET || !ACCESS_TOKEN) {
  console.warn("LINE: ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN ใน .env — ปิดการแจ้งเตือน LINE");
}

// ตรวจว่า request มาจาก LINE จริง: HMAC-SHA256 ของ body ดิบด้วย channel secret
function isValidSignature(rawBody, signature) {
  if (!CHANNEL_SECRET || !signature || !Buffer.isBuffer(rawBody)) return false;
  const expected = crypto.createHmac("sha256", CHANNEL_SECRET).update(rawBody).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function pushMessage(to, text, extra = {}) {
  await axios.post(
    `${LINE_API}/message/push`,
    { to, messages: [{ type: "text", text, ...extra }] },
    { headers: lineHeaders() }
  );
}

// ปุ่มลัดใต้ข้อความแจ้งเตือน กดแล้วเท่ากับพิมพ์ "ปลอดภัย"
const SNOOZE_QUICK_REPLY = {
  quickReply: {
    items: [{ type: "action", action: { type: "message", label: `✅ ${SNOOZE_WORD}`, text: SNOOZE_WORD } }],
  },
};

const bangkokTime = (date) =>
  new Date(date).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

async function replyMessage(replyToken, text) {
  await axios.post(
    `${LINE_API}/message/reply`,
    { replyToken, messages: [{ type: "text", text }] },
    { headers: lineHeaders() }
  );
}

// ตอบด้วย Flex Message (altText คือข้อความที่ขึ้นในแจ้งเตือน/รายการแชท)
async function replyFlex(replyToken, altText, contents) {
  await axios.post(
    `${LINE_API}/message/reply`,
    { replyToken, messages: [{ type: "flex", altText, contents }] },
    { headers: lineHeaders() }
  );
}

// ---------- Rich Menu รายคน: เชื่อมแล้วได้เมนู 6 ปุ่ม / ยังไม่เชื่อมใช้เมนู default ----------
// เรียกไม่สำเร็จแค่ log ไว้ ไม่ให้กระทบการผูกบัญชี
async function useLinkedRichMenu(lineUserId) {
  if (!ACCESS_TOKEN || !RICHMENU_LINKED) return;
  try {
    await axios.post(`${LINE_API}/user/${lineUserId}/richmenu/${RICHMENU_LINKED}`, null, { headers: lineHeaders() });
  } catch (err) {
    console.error("LINE link rich menu error:", err.response?.data || err.message);
  }
}

async function useDefaultRichMenu(lineUserId) {
  if (!ACCESS_TOKEN || !lineUserId) return;
  try {
    await axios.delete(`${LINE_API}/user/${lineUserId}/richmenu`, { headers: lineHeaders() });
  } catch (err) {
    console.error("LINE unlink rich menu error:", err.response?.data || err.message);
  }
}

// ---------- Magic link: ปุ่มในแชทพาเข้าเว็บได้โดยไม่ต้องล็อกอิน ----------
// เก็บเฉพาะ sha256 ของ token ในฐานข้อมูล ตัว token จริงอยู่ในลิงก์อย่างเดียว
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// สร้างลิงก์ใหม่ (ลิงก์เก่าที่ยังไม่ได้กดจะใช้ไม่ได้) คืน null ถ้ายังไม่ได้ตั้ง PUBLIC_WEB_URL
async function createLoginLink(db, userId, next) {
  if (!PUBLIC_WEB_URL) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  await db.execute(
    `UPDATE users SET line_login_token = ?, line_login_expires = NOW() + INTERVAL ${LOGIN_TOKEN_MINUTES} MINUTE WHERE id = ?`,
    [hashToken(token), userId]
  );
  return `${PUBLIC_WEB_URL}/auth/line?t=${token}&next=${encodeURIComponent(next)}`;
}

// ใช้ใน GET /auth/line: ตรวจ token แล้วลบทิ้งทันที (ใช้ได้ครั้งเดียว) คืน user หรือ null
export async function consumeLoginToken(db, token) {
  if (!token || token.length > 100) return null;
  const hash = hashToken(token);
  const [[user]] = await db.execute(
    "SELECT id, name, role, line_login_expires > NOW() AS valid FROM users WHERE line_login_token = ?",
    [hash]
  );
  if (!user) return null;

  // ลบโดยเช็ก hash ซ้ำ: ถ้ากดพร้อมกัน 2 ครั้ง จะมีแค่ครั้งแรกที่ affectedRows = 1
  const [result] = await db.execute(
    "UPDATE users SET line_login_token = NULL, line_login_expires = NULL WHERE id = ? AND line_login_token = ?",
    [user.id, hash]
  );
  if (result.affectedRows === 0 || !user.valid) return null;
  return { id: user.id, name: user.name, role: user.role };
}

// ---------- ตอบปุ่ม Rich Menu (postback) ----------
const HOWTO_TEXT =
  "วิธีเชื่อมบัญชี LINE กับ PINK STUDIO\n\n" +
  "1. เข้าเว็บแล้วล็อกอิน\n" +
  "2. ไปที่เมนู \"ตั้งค่า\" → กด \"เชื่อม LINE\"\n" +
  "3. จะได้รหัส 6 หลัก (ใช้ได้ 10 นาที)\n" +
  "4. พิมพ์รหัสนั้นส่งในแชทนี้\n\n" +
  "เชื่อมแล้วจะได้รับแจ้งเตือนชีพจรผิดปกติ และใช้เมนูด้านล่างดูข้อมูลได้ทันที";

const NO_MEMBERS_TEXT = "ยังไม่มีสมาชิกในบัญชีนี้ เพิ่มสมาชิกได้ที่หน้า \"สมาชิก\" บนเว็บครับ";

// สมาชิกทั้งหมดของบัญชีนี้เท่านั้น
async function membersOf(db, userId) {
  const [rows] = await db.execute(
    `SELECT id, name, relation, heart_rate, steps, sleep, status, last_synced_at,
            emergency_contact_name, emergency_contact_phone
     FROM family_members WHERE user_id = ? ORDER BY id ASC`,
    [userId]
  );
  return rows;
}

// วันนี้ตามเวลาไทย รูปแบบเดียวกับ appointments.appointment_date ("YYYY-MM-DD")
const todayInBangkok = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

const POSTBACK_HANDLERS = {
  async status(db, user, replyToken) {
    const members = await membersOf(db, user.id);
    if (!members.length) return replyMessage(replyToken, NO_MEMBERS_TEXT);
    return replyFlex(replyToken, "สถานะสุขภาพตอนนี้", statusFlex(members));
  },

  async emergency(db, user, replyToken) {
    const members = await membersOf(db, user.id);
    return replyFlex(replyToken, "เบอร์โทรฉุกเฉิน", emergencyFlex(members));
  },

  async appointments(db, user, replyToken) {
    const members = await membersOf(db, user.id);
    if (!members.length) return replyMessage(replyToken, NO_MEMBERS_TEXT);
    // นัดตั้งแต่วันนี้เป็นต้นไป ของสมาชิกในบัญชีนี้เท่านั้น เรียงจากใกล้สุด
    const [rows] = await db.execute(
      `SELECT a.member_id, a.appointment_date, a.appointment_time, a.doctor_name, a.hospital_name
       FROM appointments a JOIN family_members f ON f.id = a.member_id
       WHERE f.user_id = ? AND a.appointment_date >= ?
       ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
      [user.id, todayInBangkok()]
    );
    const items = members.map((member) => ({ member, appt: rows.find((r) => r.member_id === member.id) ?? null }));
    const link = await createLoginLink(db, user.id, "/appointments");
    return replyFlex(replyToken, "นัดหมายถัดไป", appointmentsFlex(items, link));
  },

  async report(db, user, replyToken) {
    const members = await membersOf(db, user.id);
    if (!members.length) return replyMessage(replyToken, NO_MEMBERS_TEXT);
    const reports = [];
    for (const m of members.slice(0, 12)) {
      reports.push(await buildMemberReport(db, { id: m.id, name: m.name, relation: m.relation }, 7));
    }
    const link = await createLoginLink(db, user.id, "/report");
    return replyFlex(replyToken, "สรุปสุขภาพ 7 วัน", reportFlex(reports, link));
  },

  async web(db, user, replyToken) {
    const link = await createLoginLink(db, user.id, "/dashboard");
    return replyFlex(replyToken, "เปิดแดชบอร์ด PINK STUDIO", webFlex(link));
  },
};

// ทำงานตามปุ่ม คืน false ถ้าไม่รู้จัก action นี้
async function runMenuAction(db, action, replyToken, lineUserId) {
  if (action === "howto") {
    await replyMessage(replyToken, HOWTO_TEXT);
    return true;
  }

  const handler = POSTBACK_HANDLERS[action];
  if (!handler) return false;

  // ทุกปุ่มต้องผูกบัญชีก่อน
  const [[user]] = await db.execute("SELECT id, name FROM users WHERE line_user_id = ?", [lineUserId]);
  if (!user) await replyMessage(replyToken, HOWTO_TEXT);
  else await handler(db, user, replyToken);
  return true;
}

async function handlePostback(db, event, lineUserId) {
  const action = new URLSearchParams(event.postback?.data ?? "").get("action");
  await runMenuAction(db, action, event.replyToken, lineUserId);
}

// Rich Menu ที่สร้างใน LINE Official Account Manager ส่ง postback ไม่ได้ ส่งได้แค่ข้อความ
// จึงรับข้อความที่ตรงกับชื่อปุ่มด้วย ให้ทำงานเหมือนกด postback
const MENU_TEXT_ACTIONS = {
  สถานะตอนนี้: "status",
  โทรฉุกเฉิน: "emergency",
  นัดหมาย: "appointments",
  รายงาน: "report",
  เปิดเว็บ: "web",
  วิธีเชื่อมบัญชี: "howto",
};

// ข้อมูลบอท (ชื่อ, basic ID) ใช้สร้างลิงก์เพิ่มเพื่อน — ดึงครั้งเดียวแล้วเก็บไว้
let botInfoPromise = null;
function getBotInfo() {
  if (!ACCESS_TOKEN) return Promise.resolve(null);
  botInfoPromise ??= axios
    .get(`${LINE_API}/info`, { headers: lineHeaders() })
    .then((r) => r.data)
    .catch((err) => {
      console.error("LINE bot info error:", err.response?.data || err.message);
      botInfoPromise = null; // ให้ลองใหม่ครั้งหน้า
      return null;
    });
  return botInfoPromise;
}

const nowText = () =>
  new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "medium" });

const logPushError = (err) => {
  if (err.response?.status === 429) {
    console.error("LINE notify error: โควตาข้อความของเดือนนี้หมดแล้ว (429) —", err.response.data?.message);
  } else {
    console.error("LINE notify error:", err.response?.data || err.message);
  }
};

// ผลการแจ้งเตือน (หน้าเหตุฉุกเฉินของ admin เอาไปลงไทม์ไลน์ของเคส)
//   "sent" ส่งแล้ว | "not_linked" ผู้ดูแลยังไม่เชื่อม LINE | "snoozed" ผู้ดูแลกดพักไว้
//   "muted" ผู้ดูแลปิดสวิตช์แจ้งเตือนในหน้าตั้งค่า | "throttled" เพิ่งเตือนไปไม่ถึง 10 นาที (เตือนซ้ำ)
//   "disabled" ยังไม่ได้ตั้งค่า LINE | "error" ส่งไม่สำเร็จ

// ส่งแจ้งเตือนเงื่อนไขที่ผิดปกติต่อเนื่อง (ชีพจร / ความเครียด) ไม่ throw
// reminder = true คือเคสเดิมยังผิดปกติอยู่ -> ส่งซ้ำได้ไม่ถี่กว่าทุก REMIND_MINUTES นาที
// หยุดชั่วคราวได้ด้วยการพิมพ์ "ปลอดภัย" ใน LINE (users.line_snooze_until)
async function sendConditionAlert(db, memberId, buildText, { reminder = false } = {}) {
  try {
    if (!ACCESS_TOKEN) return "disabled";

    // หา LINE ของเจ้าของสมาชิกคนนี้เท่านั้น
    const [[row]] = await db.execute(
      `SELECT f.name, u.line_user_id, u.line_alerts_enabled, (u.line_snooze_until > NOW()) AS snoozed,
              (f.last_alert_at > NOW() - INTERVAL ${REMIND_MINUTES} MINUTE) AS recent
       FROM family_members f JOIN users u ON u.id = f.user_id
       WHERE f.id = ?`,
      [memberId]
    );
    if (!row?.line_user_id) return "not_linked";
    if (!row.line_alerts_enabled) return "muted";
    if (row.snoozed) return "snoozed";
    if (reminder && row.recent) return "throttled";

    await db.execute("UPDATE family_members SET last_alert_at = NOW() WHERE id = ?", [memberId]);
    await pushMessage(
      row.line_user_id,
      buildText(row.name) +
        `\n🕒 ${nowText()}\n\n` +
        `กรุณาติดต่อหรือตรวจสอบอาการโดยเร็ว\n` +
        `พิมพ์ "${SNOOZE_WORD}" เพื่อพักการแจ้งเตือน ${SNOOZE_MINUTES} นาที`,
      SNOOZE_QUICK_REPLY
    );
    console.log(`LINE alert sent: member=${memberId}`);
    return "sent";
  } catch (err) {
    logPushError(err);
    return "error";
  }
}

// ชีพจรเข้าเงื่อนไข (สูงต่อเนื่อง หรือ ต่ำ) — ตัดสินว่าเข้าเงื่อนไขหรือไม่ที่ emergency.js
export const notifyHeartRate = (db, memberId, bpm, opts) =>
  sendConditionAlert(
    db,
    memberId,
    (name) =>
      `⚠️ แจ้งเตือนชีพจรผิดปกติ\n\n👤 ${name}\n❤️ ชีพจร ${bpm} bpm — ` +
      (bpm > HR_HIGH ? `สูงกว่า ${HR_HIGH} bpm` : `ต่ำกว่า ${HR_LOW} bpm`),
    opts
  );

// ความเครียดสูงต่อเนื่อง
export const notifyStress = (db, memberId, level, opts) =>
  sendConditionAlert(
    db,
    memberId,
    (name) =>
      `⚠️ แจ้งเตือนความเครียดสูง\n\n👤 ${name}\n😣 ระดับความเครียด ${level} — สูงกว่า ${STRESS_HIGH} ต่อเนื่องเกิน ${STRESS_MINUTES} นาที`,
    opts
  );

// แจ้งเตือนการล้ม: เป็นเหตุครั้งเดียวและอันตรายกว่า จึงส่งแม้กดพัก "ปลอดภัย" ไว้
// (ไม่ส่งเฉพาะตอนผู้ดูแลปิดสวิตช์แจ้งเตือนในหน้าตั้งค่า) คืนผลแบบเดียวกับ notifyHeartRate ไม่ throw
export async function notifyFall(db, memberId) {
  try {
    if (!ACCESS_TOKEN) return "disabled";
    const [[row]] = await db.execute(
      `SELECT f.name, f.emergency_contact_name, f.emergency_contact_phone, u.line_user_id, u.line_alerts_enabled
       FROM family_members f JOIN users u ON u.id = f.user_id
       WHERE f.id = ?`,
      [memberId]
    );
    if (!row?.line_user_id) return "not_linked";
    if (!row.line_alerts_enabled) return "muted";

    // LINE ทำเบอร์โทรในข้อความเป็นลิงก์กดโทรให้เอง
    const contact = row.emergency_contact_phone
      ? `📞 ผู้ติดต่อฉุกเฉิน: ${row.emergency_contact_name || "-"} ${row.emergency_contact_phone}\n\n`
      : "";
    await pushMessage(
      row.line_user_id,
      `🚨 ตรวจพบการล้ม\n\n` +
        `👤 ${row.name}\n` +
        `🕒 ${nowText()}\n\n` +
        contact +
        `กรุณาติดต่อหรือไปดูอาการโดยด่วน\n` +
        `ตอบ "${SNOOZE_WORD}" เมื่อตรวจสอบแล้วว่าปลอดภัย`,
      SNOOZE_QUICK_REPLY
    );
    console.log(`LINE fall alert sent: member=${memberId}`);
    return "sent";
  } catch (err) {
    logPushError(err);
    return "error";
  }
}

// จัดการ event จาก LINE (ทำหลังตอบ 200 ไปแล้ว)
async function handleEvent(db, event) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  // ผู้ใช้บล็อกบอท -> ยกเลิกการเชื่อม เพราะส่งข้อความหาไม่ได้แล้ว
  if (event.type === "unfollow") {
    await db.execute(
      "UPDATE users SET line_user_id = NULL, line_login_token = NULL, line_login_expires = NULL WHERE line_user_id = ?",
      [lineUserId]
    );
    await useDefaultRichMenu(lineUserId);
    return;
  }

  if (event.type === "follow") {
    await replyMessage(
      event.replyToken,
      "สวัสดีครับ 🐼 น้องบอทผู้ดูแลจาก PulsePanda\n\nพิมพ์รหัส 6 หลักจากหน้า \"ตั้งค่า\" บนเว็บ เพื่อรับแจ้งเตือนเมื่อชีพจรของสมาชิกผิดปกติ"
    );
    return;
  }

  if (event.type === "postback") {
    await handlePostback(db, event, lineUserId);
    return;
  }

  if (event.type !== "message" || event.message?.type !== "text") return;

  const code = event.message.text.trim();

  // "ปลอดภัย" -> พักการแจ้งเตือนของบัญชีที่ผูกกับ LINE นี้ 10 นาที
  if (code === SNOOZE_WORD) {
    const [result] = await db.execute(
      `UPDATE users SET line_snooze_until = NOW() + INTERVAL ${SNOOZE_MINUTES} MINUTE WHERE line_user_id = ?`,
      [lineUserId]
    );
    if (result.affectedRows === 0) {
      await replyMessage(event.replyToken, "LINE นี้ยังไม่ได้เชื่อมกับบัญชีใด พิมพ์รหัส 6 หลักจากหน้า \"ตั้งค่า\" ก่อนครับ");
      return;
    }
    // นับเป็นการ "รับเรื่อง" เคสฉุกเฉินที่ยังไม่มีผู้รับของบัญชีนี้ด้วย (หน้าเหตุฉุกเฉินของ admin)
    const acknowledged = await acknowledgeByCaregiver(db, lineUserId).catch((err) => {
      console.error("Emergency acknowledge error:", err);
      return 0;
    });
    const until = bangkokTime(Date.now() + SNOOZE_MINUTES * 60 * 1000);
    await replyMessage(
      event.replyToken,
      `🔕 พักการแจ้งเตือน ${SNOOZE_MINUTES} นาที (ถึง ${until} น.)\nหลังจากนั้นจะแจ้งเตือนต่อถ้าชีพจรยังผิดปกติ` +
        (acknowledged ? `\n\n✅ รับเรื่องเหตุฉุกเฉิน ${acknowledged} เคสแล้ว เจ้าหน้าที่จะเห็นว่าคุณกำลังดูแลอยู่` : "")
    );
    return;
  }

  if (MENU_TEXT_ACTIONS[code]) {
    await runMenuAction(db, MENU_TEXT_ACTIONS[code], event.replyToken, lineUserId);
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    const [[linked]] = await db.execute("SELECT id FROM users WHERE line_user_id = ?", [lineUserId]);
    await replyMessage(
      event.replyToken,
      linked
        ? "ใช้เมนูด้านล่างเพื่อดูสถานะ นัดหมาย หรือรายงานได้เลยครับ 🐼"
        : "พิมพ์รหัส 6 หลักจากหน้า \"ตั้งค่า\" บนเว็บ เพื่อเชื่อมการแจ้งเตือนครับ"
    );
    return;
  }

  const [[user]] = await db.execute(
    "SELECT id, name FROM users WHERE line_link_code = ? AND line_link_expires > NOW()",
    [code]
  );
  if (!user) {
    await replyMessage(event.replyToken, "❌ รหัสไม่ถูกต้องหรือหมดอายุแล้ว กรุณากดขอรหัสใหม่ในหน้าตั้งค่า");
    return;
  }

  // 1 LINE = 1 บัญชี: ถ้า LINE นี้เคยผูกกับบัญชีอื่น ให้ยกเลิกของเดิมก่อน
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("UPDATE users SET line_user_id = NULL WHERE line_user_id = ? AND id <> ?", [lineUserId, user.id]);
    await conn.execute(
      "UPDATE users SET line_user_id = ?, line_link_code = NULL, line_link_expires = NULL WHERE id = ?",
      [lineUserId, user.id]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await useLinkedRichMenu(lineUserId);
  await replyMessage(
    event.replyToken,
    `✅ เชื่อมกับบัญชี "${user.name}" สำเร็จ\n\nจะแจ้งเตือนทาง LINE นี้เมื่อสมาชิกในบัญชีนี้เข้าเงื่อนไขการแจ้งเตือน (ชีพจรสูง/ต่ำ ความเครียดสูง การล้ม) ตั้งค่าได้ในหน้านัดหมายบนเว็บ\nพิมพ์ "${SNOOZE_WORD}" เพื่อพักการแจ้งเตือน ${SNOOZE_MINUTES} นาที`
  );
}

// ต้องเรียกก่อน app.use(express.json()) เพราะ webhook ต้องใช้ body ดิบไปตรวจลายเซ็น
export function registerLineWebhook(app, express, db) {
  app.post("/api/line/webhook", express.raw({ type: "*/*" }), (req, res) => {
    if (!isValidSignature(req.body, req.get("x-line-signature"))) {
      return res.status(401).send("Invalid signature");
    }
    res.sendStatus(200); // ตอบ LINE ทันที แล้วค่อยประมวลผล

    let events = [];
    try {
      events = JSON.parse(req.body.toString("utf8")).events || [];
    } catch {
      return;
    }
    for (const event of events) {
      handleEvent(db, event).catch((err) => console.error("LINE webhook error:", err.response?.data || err.message));
    }
  });
}

// route สำหรับหน้าตั้งค่า (ต้องล็อกอิน)
export function registerLineRoutes(app, db, verifyUser) {
  // สถานะการเชื่อม + ลิงก์เพิ่มเพื่อนบอท
  app.get("/api/line/status", verifyUser, async (req, res) => {
    try {
      const [[user]] = await db.execute(
        `SELECT line_user_id, line_alerts_enabled,
                IF(line_snooze_until > NOW(), line_snooze_until, NULL) AS snooze_until
         FROM users WHERE id = ?`,
        [req.user.id]
      );
      const bot = await getBotInfo();
      return res.json({
        enabled: Boolean(ACCESS_TOKEN && CHANNEL_SECRET),
        linked: Boolean(user?.line_user_id),
        alertsEnabled: Boolean(user?.line_alerts_enabled ?? 1),
        snoozedUntil: user?.snooze_until ?? null,
        snoozeWord: SNOOZE_WORD,
        botName: bot?.displayName ?? null,
        addFriendUrl: bot?.basicId ? `https://line.me/R/ti/p/${encodeURIComponent(bot.basicId)}` : null,
        thresholds: { high: HR_HIGH, low: HR_LOW },
      });
    } catch (err) {
      console.error("LINE status error:", err);
      return res.status(500).json({ error: "โหลดสถานะ LINE ไม่สำเร็จ" });
    }
  });

  // ขอรหัสจับคู่ 6 หลัก (ขอใหม่ = รหัสเก่าใช้ไม่ได้)
  app.post("/api/line/link-code", verifyUser, async (req, res) => {
    try {
      let code;
      for (let i = 0; i < 5; i++) {
        const candidate = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
        const [[taken]] = await db.execute(
          "SELECT id FROM users WHERE line_link_code = ? AND line_link_expires > NOW()",
          [candidate]
        );
        if (!taken) {
          code = candidate;
          break;
        }
      }
      if (!code) return res.status(503).json({ error: "สร้างรหัสไม่สำเร็จ กรุณาลองใหม่" });

      await db.execute(
        `UPDATE users SET line_link_code = ?, line_link_expires = NOW() + INTERVAL ${LINK_CODE_MINUTES} MINUTE WHERE id = ?`,
        [code, req.user.id]
      );
      return res.json({ code, expiresInSeconds: LINK_CODE_MINUTES * 60 });
    } catch (err) {
      console.error("LINE link code error:", err);
      return res.status(500).json({ error: "สร้างรหัสไม่สำเร็จ" });
    }
  });

  // สวิตช์เปิด/ปิดแจ้งเตือนชีพจรทาง LINE (ยังเชื่อมบัญชีไว้เหมือนเดิม ปุ่มเมนูในแชทยังใช้ได้)
  app.put("/api/line/alerts", verifyUser, async (req, res) => {
    const enabled = req.body?.enabled;
    if (typeof enabled !== "boolean") return res.status(400).json({ error: "ค่าไม่ถูกต้อง" });
    try {
      await db.execute("UPDATE users SET line_alerts_enabled = ? WHERE id = ?", [enabled ? 1 : 0, req.user.id]);
      return res.json({
        alertsEnabled: enabled,
        message: enabled ? "เปิดการแจ้งเตือนทาง LINE แล้ว" : "ปิดการแจ้งเตือนทาง LINE แล้ว",
      });
    } catch (err) {
      console.error("LINE alerts toggle error:", err);
      return res.status(500).json({ error: "บันทึกการตั้งค่าไม่สำเร็จ" });
    }
  });

  // ยกเลิกการเชื่อม
  app.delete("/api/line/link", verifyUser, async (req, res) => {
    try {
      const [[user]] = await db.execute("SELECT line_user_id FROM users WHERE id = ?", [req.user.id]);
      await db.execute(
        `UPDATE users SET line_user_id = NULL, line_link_code = NULL, line_link_expires = NULL,
                          line_login_token = NULL, line_login_expires = NULL
         WHERE id = ?`,
        [req.user.id]
      );
      await useDefaultRichMenu(user?.line_user_id);
      return res.json({ message: "ยกเลิกการเชื่อม LINE แล้ว" });
    } catch (err) {
      console.error("LINE unlink error:", err);
      return res.status(500).json({ error: "ยกเลิกการเชื่อมไม่สำเร็จ" });
    }
  });

  // ส่งข้อความทดสอบไปที่ LINE ที่ผูกไว้
  app.post("/api/line/test", verifyUser, async (req, res) => {
    try {
      const [[user]] = await db.execute("SELECT line_user_id FROM users WHERE id = ?", [req.user.id]);
      if (!user?.line_user_id) return res.status(400).json({ error: "ยังไม่ได้เชื่อม LINE" });
      await pushMessage(user.line_user_id, "🔔 ทดสอบการแจ้งเตือนจาก PulsePanda — ระบบพร้อมใช้งาน");
      return res.json({ message: "ส่งข้อความทดสอบแล้ว ลองเช็กใน LINE" });
    } catch (err) {
      console.error("LINE test error:", err.response?.data || err.message);
      return res.status(502).json({ error: "ส่งข้อความไป LINE ไม่สำเร็จ" });
    }
  });
}
