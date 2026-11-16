// ------------------------------------------
// ตัวสร้าง Flex Message สำหรับตอบปุ่มใน Rich Menu (ฟังก์ชันล้วน รับข้อมูลแล้วคืน JSON ไม่แตะฐานข้อมูล)
// ธีมเดียวกับเว็บ: หัวการ์ดชมพู #f05289, ตัวอักษร #3c3038 / #8e7c87, ขอบ #f1dce5
// ------------------------------------------

const C = {
  pink: "#f05289",
  pinkSoft: "#ffe3ed",
  bg: "#fff0f5",
  text: "#3c3038",
  muted: "#8e7c87",
  line: "#f1dce5",
};

// สีป้ายสถานะ ให้ตรงกับ family_members.status
const STATUS_STYLE = {
  ปกติ: { bg: "#e6f9ee", color: "#0f9d58" },
  อันตราย: { bg: "#ffe3e3", color: "#d93025" },
};
const NO_DATA_STYLE = { bg: "#f3eef1", color: C.muted };

const TZ = "Asia/Bangkok";
const MAX_BUBBLES = 12; // carousel ของ LINE รับได้ไม่เกิน 12 การ์ด

const isEmpty = (v) => v == null || v === "" || v === "-";
const show = (v, fallback = "-") => (isEmpty(v) ? fallback : String(v));

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString("th-TH", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }) : "-";

// "2026-11-20" -> "ศ. 20 พ.ย. 2569" (ถ้าแปลงไม่ได้ก็แสดงตามที่เก็บไว้)
const formatThaiDate = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return show(dateStr);
  return d.toLocaleDateString("th-TH", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

// ---------- ชิ้นส่วนพื้นฐาน ----------

const text = (t, opts = {}) => ({ type: "text", text: String(t), wrap: true, color: C.text, size: "sm", ...opts });

const header = (title, subtitle) => ({
  type: "box",
  layout: "vertical",
  backgroundColor: C.pink,
  paddingAll: "16px",
  contents: [
    text(title, { color: "#ffffff", weight: "bold", size: "lg" }),
    ...(subtitle ? [text(subtitle, { color: C.pinkSoft, size: "xs", margin: "xs" })] : []),
  ],
});

// แถว "หัวข้อ ........ ค่า"
const row = (label, value) => ({
  type: "box",
  layout: "horizontal",
  spacing: "md",
  contents: [
    text(label, { color: C.muted, flex: 2 }),
    text(value, { weight: "bold", flex: 3, align: "end" }),
  ],
});

const separator = () => ({ type: "separator", color: C.line, margin: "md" });

const badge = (status) => {
  const label = STATUS_STYLE[status] ? status : "ไม่มีข้อมูล";
  const style = STATUS_STYLE[status] ?? NO_DATA_STYLE;
  return {
    type: "box",
    layout: "vertical",
    flex: 0,
    backgroundColor: style.bg,
    cornerRadius: "12px",
    paddingTop: "4px",
    paddingBottom: "4px",
    paddingStart: "10px",
    paddingEnd: "10px",
    contents: [text(label, { color: style.color, size: "xs", weight: "bold", wrap: false })],
  };
};

const uriButton = (label, uri, primary = true) => ({
  type: "button",
  style: primary ? "primary" : "secondary",
  color: primary ? C.pink : C.pinkSoft,
  height: "sm",
  action: { type: "uri", label, uri },
});

const bubble = ({ title, subtitle, body, footer }) => ({
  type: "bubble",
  header: header(title, subtitle),
  body: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", contents: body },
  ...(footer?.length
    ? { footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px", contents: footer } }
    : {}),
  styles: { footer: { separator: true, separatorColor: C.line } },
});

const carousel = (bubbles) =>
  bubbles.length === 1 ? bubbles[0] : { type: "carousel", contents: bubbles.slice(0, MAX_BUBBLES) };

// ปุ่มไปเว็บ ถ้ายังไม่ได้ตั้ง PUBLIC_WEB_URL (link = null) ให้แสดงเป็นข้อความแทน
const webFooter = (label, link) =>
  link ? [uriButton(label, link)] : [text("ยังไม่ได้ตั้งค่าที่อยู่เว็บ (PUBLIC_WEB_URL)", { color: C.muted, size: "xs", align: "center" })];

// ---------- การ์ดของแต่ละปุ่ม ----------

// สถานะตอนนี้: การ์ดละ 1 สมาชิก (ไม่แสดงความเครียด/SpO2 เพราะบน dashboard ยังเป็นค่าตายตัว)
export function statusFlex(members) {
  return carousel(
    members.map((m) =>
      bubble({
        title: m.name,
        subtitle: m.relation,
        body: [
          {
            type: "box",
            layout: "horizontal",
            alignItems: "center",
            contents: [
              text(`❤️ ${show(m.heart_rate, "ไม่มีข้อมูล")}`, { size: "xl", weight: "bold", flex: 1 }),
              badge(m.status),
            ],
          },
          separator(),
          row("ก้าววันนี้", show(m.steps)),
          row("การนอน", show(m.sleep)),
          row("ซิงค์ล่าสุด", formatDateTime(m.last_synced_at)),
        ],
      })
    )
  );
}

// โทรฉุกเฉิน: รายชื่อผู้ติดต่อฉุกเฉินของสมาชิกแต่ละคน + ปุ่ม 1669 เสมอ
export function emergencyFlex(members) {
  const body = [];
  members.forEach((m, i) => {
    const phone = String(m.emergency_contact_phone ?? "").replace(/\D/g, "");
    if (i > 0) body.push(separator());
    body.push(text(`${m.name} (${m.relation})`, { weight: "bold", margin: i ? "md" : "none" }));
    if (phone) {
      body.push(text(`${show(m.emergency_contact_name, "ผู้ติดต่อฉุกเฉิน")} · ${phone}`, { color: C.muted, size: "xs" }));
      body.push({ ...uriButton(`📞 โทร ${phone}`, `tel:${phone}`, false), margin: "sm" });
    } else {
      body.push(text("ยังไม่ได้ตั้งเบอร์ฉุกเฉิน", { color: C.muted, size: "xs" }));
    }
  });
  if (!members.length) body.push(text("ยังไม่มีสมาชิก เพิ่มสมาชิกและเบอร์ฉุกเฉินได้บนเว็บ", { color: C.muted }));

  return bubble({
    title: "โทรฉุกเฉิน",
    subtitle: "แตะเพื่อโทรออกทันที",
    body,
    footer: [{ ...uriButton("🚑 โทร 1669 (สายด่วนฉุกเฉิน)", "tel:1669"), color: "#d93025" }],
  });
}

// นัดหมาย: นัดที่ใกล้ที่สุด (ตั้งแต่วันนี้) ของสมาชิกแต่ละคน
export function appointmentsFlex(items, link) {
  const body = [];
  items.forEach(({ member, appt }, i) => {
    if (i > 0) body.push(separator());
    body.push(text(`${member.name} (${member.relation})`, { weight: "bold", margin: i ? "md" : "none" }));
    if (appt) {
      body.push(row("วันที่", formatThaiDate(appt.appointment_date)));
      body.push(row("เวลา", `${show(appt.appointment_time)} น.`));
      body.push(row("แพทย์", show(appt.doctor_name)));
      body.push(row("โรงพยาบาล", show(appt.hospital_name)));
    } else {
      body.push(text("ไม่มีนัดหมายที่กำลังจะถึง", { color: C.muted, size: "xs" }));
    }
  });

  return bubble({
    title: "นัดหมายถัดไป",
    subtitle: "นัดหมอครั้งถัดไปของแต่ละคน",
    body,
    footer: webFooter("จัดการนัดหมาย", link),
  });
}

// รายงาน: สรุป 7 วันต่อสมาชิก (ข้อมูลจาก buildMemberReport ตัวเดียวกับหน้าเว็บ)
export function reportFlex(reports, link) {
  return carousel(
    reports.map(({ member, from, to, summary: s }) =>
      bubble({
        title: member.name,
        subtitle: `สรุปสุขภาพ 7 วัน (${from} – ${to})`,
        body: [
          row("ชีพจรเฉลี่ย", s.avg_hr == null ? "-" : `${s.avg_hr} bpm`),
          row("ก้าวเฉลี่ย/วัน", s.avg_steps == null ? "-" : s.avg_steps.toLocaleString("en-US")),
          row("การนอนเฉลี่ย", s.avg_sleep == null ? "-" : `${s.avg_sleep} ชม.`),
          separator(),
          text("ชีพจรผิดปกติ", { color: C.muted, margin: "md" }),
          row("อันตราย", `${s.alerts.emergency} ครั้ง`),
          row("เฝ้าระวัง", `${s.alerts.warning} ครั้ง`),
        ],
        footer: webFooter("ดูกราฟเต็ม", link),
      })
    )
  );
}

// เปิดเว็บ
export function webFlex(link) {
  return bubble({
    title: "PINK STUDIO",
    subtitle: "แดชบอร์ดสุขภาพครอบครัว",
    body: [text("แตะปุ่มด้านล่างเพื่อเข้าแดชบอร์ดได้ทันที ไม่ต้องล็อกอิน (ลิงก์ใช้ได้ครั้งเดียว ภายใน 5 นาที)", { color: C.muted })],
    footer: webFooter("เปิดแดชบอร์ด", link),
  });
}
