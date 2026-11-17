import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { BellRing, ChevronRight, KeyRound, MessageCircle } from "lucide-react";
import api, { getErrorMessage } from "../api.js";

// สวิตช์ "แจ้งเตือนผ่านแอป" = เปิด/ปิดแจ้งเตือนชีพจรทาง LINE อยู่ใน <LineConnect>

// สระบน/ล่าง ( ั ิ ี ึ ื ุ ู ฺ ) และวรรณยุกต์/เครื่องหมาย ( ็ ่ ้ ๊ ๋ ์ ํ ๎ )
// ตัวพวกนี้วางเดี่ยวๆ ไม่ได้ จึงต้องตัดออกก่อนเลือกตัวอักษรมาแสดง
const THAI_MARKS = /[-]/g;
const SPACES = /\s/g;

// ตัวอักษร 2 ตัวแรกของชื่อ ไว้แสดงในรูปโปรไฟล์ เช่น "อนุทิน" -> "อน"
const initialsOf = (name = "") =>
  name.replace(THAI_MARKS, "").replace(SPACES, "").slice(0, 2);

const inputClass =
  "w-full rounded-[14px] border border-[#f1dce5] bg-[#fff5f8] px-4 py-3 text-[#3c3038] outline-none placeholder:text-[#b8a4ae] focus:border-[#f66c9c] focus:ring-2 focus:ring-[#ffe3ed]";

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-linear-to-r from-[#ff83ad] to-[#f34c8c]" : "bg-[#ece3e7]"
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

// เชื่อม LINE รับแจ้งเตือนชีพจรผิดปกติของสมาชิกในบัญชีนี้
// ขั้นตอน: กดขอรหัส -> เพิ่มเพื่อนบอท -> พิมพ์รหัสในแชท -> หน้านี้เช็กสถานะเองทุก 3 วินาที
function LineConnect() {
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState(null); // { code, expiresAt }
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ type: "", text: "" });

  const loadStatus = () =>
    api
      .get("/api/line/status")
      .then((res) => {
        setStatus(res.data);
        return res.data;
      })
      .catch((err) => setNote({ type: "error", text: getErrorMessage(err) }));

  useEffect(() => {
    loadStatus();
  }, []);

  // ระหว่างรอผู้ใช้พิมพ์รหัสใน LINE: นับถอยหลัง + เช็กว่าเชื่อมสำเร็จหรือยัง
  useEffect(() => {
    if (!code) return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.round((code.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setCode(null);
    }, 1000);
    const poll = setInterval(async () => {
      const s = await loadStatus();
      if (s?.linked) {
        setCode(null);
        setNote({ type: "success", text: "เชื่อม LINE สำเร็จ" });
      }
    }, 3000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [code]);

  const run = async (fn) => {
    setBusy(true);
    setNote({ type: "", text: "" });
    try {
      await fn();
    } catch (err) {
      setNote({ type: "error", text: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const requestCode = () =>
    run(async () => {
      const res = await api.post("/api/line/link-code");
      setCode({
        code: res.data.code,
        expiresAt: Date.now() + res.data.expiresInSeconds * 1000,
      });
      setSecondsLeft(res.data.expiresInSeconds);
    });

  const sendTest = () =>
    run(async () => {
      const res = await api.post("/api/line/test");
      setNote({ type: "success", text: res.data.message });
    });

  // สวิตช์ "แจ้งเตือนผ่านแอป": เปิด/ปิดการส่งแจ้งเตือนชีพจรไป LINE (บันทึกลงฐานข้อมูล)
  const toggleAlerts = () =>
    run(async () => {
      const res = await api.put("/api/line/alerts", { enabled: !status.alertsEnabled });
      setStatus((s) => ({ ...s, alertsEnabled: res.data.alertsEnabled }));
      // เปิด = กล่องเขียว / ปิด = กล่องแดง
      setNote({ type: res.data.alertsEnabled ? "success" : "off", text: res.data.message });
    });

  const unlink = () =>
    run(async () => {
      if (!window.confirm("ยกเลิกการเชื่อม LINE? จะไม่ได้รับแจ้งเตือนอีก")) return;
      const res = await api.delete("/api/line/link");
      await loadStatus();
      setNote({ type: "success", text: res.data.message });
    });

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const smallBtn =
    "cursor-pointer rounded-[12px] border border-[#f1dce5] bg-white px-4 py-2 text-sm font-semibold text-[#f05289] transition hover:border-[#f66c9c] hover:bg-[#fff5f8] disabled:opacity-60";

  return (
    <div className="mt-3 border-b border-[#f6e6ed] py-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e6f9ee] text-[#06c755]">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">แจ้งเตือนผ่าน LINE</p>
          <p className="text-xs text-[#9d8994]">
            แจ้งเมื่อสมาชิกในบัญชีนี้เข้าเงื่อนไขการแจ้งเตือน (ชีพจรสูง/ต่ำ ความเครียดสูง การล้ม)
          </p>
        </div>
        {status?.linked && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            เชื่อมแล้ว
          </span>
        )}
      </div>

      {note.text && (
        <p
          role={note.type === "error" ? "alert" : "status"}
          className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${
            note.type === "error" || note.type === "off"
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {note.text}
        </p>
      )}

      {!status ? null : !status.enabled ? (
        <p className="mt-3 text-sm text-[#9d8994]">ระบบแจ้งเตือน LINE ยังไม่พร้อมใช้งาน</p>
      ) : status.linked ? (
        <>
        <p className="mt-3 text-xs text-[#9d8994]">
          {!status.alertsEnabled
            ? "🔕 ปิดการแจ้งเตือนชีพจรไว้ (ปุ่มเมนูในแชท LINE ยังใช้ได้ตามปกติ)"
            : status.snoozedUntil
            ? `🔕 พักการแจ้งเตือนอยู่ถึง ${new Date(status.snoozedUntil).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`
            : `ยังผิดปกติอยู่จะเตือนซ้ำทุก 10 นาที · พิมพ์ "${status.snoozeWord}" ใน LINE เพื่อพัก 10 นาที`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={sendTest} disabled={busy} className={smallBtn}>
            ส่งข้อความทดสอบ
          </button>
          <button
            type="button"
            onClick={unlink}
            disabled={busy}
            className="cursor-pointer rounded-[12px] px-4 py-2 text-sm font-semibold text-[#9d8994] transition hover:text-red-600 disabled:opacity-60"
          >
            ยกเลิกการเชื่อม
          </button>
        </div>
        </>
      ) : code ? (
        <div className="mt-3 rounded-2xl bg-[#fff5f8] p-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-[#786671]">
            <li>
              เพิ่มเพื่อนบอท
              {status.botName ? ` "${status.botName}"` : ""}
              {status.addFriendUrl && (
                <>
                  {" "}
                  <a
                    href={status.addFriendUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#06c755] underline"
                  >
                    เพิ่มเพื่อนที่นี่
                  </a>
                </>
              )}
            </li>
            <li>พิมพ์รหัสนี้ส่งในแชทบอท</li>
          </ol>
          <p className="mt-3 text-center font-mono text-3xl font-bold tracking-[0.3em] text-[#3c3038]">
            {code.code}
          </p>
          <p className="mt-1 text-center text-xs text-[#9d8994]">
            รหัสหมดอายุใน {mmss} นาที · กำลังรอการยืนยันจาก LINE...
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={requestCode}
          disabled={busy}
          className="mt-3 cursor-pointer rounded-[12px] bg-[#06c755] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
        >
          เชื่อม LINE
        </button>
      )}

      {/* สวิตช์เปิด/ปิดแจ้งเตือนทาง LINE (ต้องเชื่อม LINE ก่อนถึงจะกดได้) */}
      {status?.enabled && (
        <div className="-mb-4 mt-4 flex items-center justify-between gap-4 border-t border-[#f6e6ed] py-4">
          <div>
            <p className="font-semibold">แจ้งเตือนผ่านแอป</p>
            <p className="text-xs text-[#9d8994]">
              {status.linked
                ? "เปิด = ส่งแจ้งเตือนชีพจรผิดปกติไปที่ LINE ทันที"
                : "เชื่อม LINE ก่อน จึงจะเปิด/ปิดการแจ้งเตือนได้"}
            </p>
          </div>
          <Toggle
            label="แจ้งเตือนผ่านแอป"
            checked={status.linked && status.alertsEnabled}
            onChange={toggleAlerts}
            disabled={!status.linked || busy}
          />
        </div>
      )}
    </div>
  );
}

const EMPTY_PASSWORDS = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

// ช่องรหัสผ่าน พร้อมข้อความช่วยเหลือใต้ช่อง
function PasswordInput({ id, label, hint, hintTone = "muted", ...props }) {
  const hintColor = {
    muted: "text-[#9d8994]",
    ok: "text-emerald-600",
    error: "text-red-600",
  }[hintTone];

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-[#786671]"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClass}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className={`mt-1.5 text-xs ${hintColor}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

// popup เปลี่ยนรหัสผ่าน (export ไว้ให้หน้าตั้งค่าของ admin ใช้ร่วมกัน)
export function ChangePasswordModal({ onClose, onSuccess }) {
  const [values, setValues] = useState(EMPTY_PASSWORDS);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // กด Esc เพื่อปิด popup
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const handleChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (values.newPassword !== values.confirmPassword) {
      setError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
      return;
    }
    if (values.newPassword === values.currentPassword) {
      setError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน");
      return;
    }
    setSaving(true);
    try {
      const res = await api.put("/api/account/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      onSuccess(res.data.message);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3c3038]/40 p-4 backdrop-blur-sm"
      onClick={() => !saving && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-md rounded-[22px] border border-[#f1dce5] bg-white p-6 shadow-2xl shadow-pink-200/60 md:p-7"
      >
        <h2
          id="change-password-title"
          className="text-lg font-semibold text-[#3c3038]"
        >
          เปลี่ยนรหัสผ่าน
        </h2>
        <p className="mt-1 text-sm text-[#8e7c87]">
          รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <PasswordInput
            id="currentPassword"
            label="รหัสผ่านปัจจุบัน"
            autoComplete="current-password"
            required
            autoFocus
            value={values.currentPassword}
            onChange={handleChange}
          />
          <PasswordInput
            id="newPassword"
            label="รหัสผ่านใหม่"
            autoComplete="new-password"
            required
            minLength={8}
            value={values.newPassword}
            onChange={handleChange}
            hint={
              values.newPassword && values.newPassword.length >= 8
                ? "✓ ความยาวเพียงพอ"
                : "ต้องมีอย่างน้อย 8 ตัวอักษร"
            }
            hintTone={values.newPassword.length >= 8 ? "ok" : "muted"}
          />
          <PasswordInput
            id="confirmPassword"
            label="ยืนยันรหัสผ่านใหม่"
            autoComplete="new-password"
            required
            minLength={8}
            value={values.confirmPassword}
            onChange={handleChange}
            hint={
              values.confirmPassword
                ? values.confirmPassword === values.newPassword
                  ? "✓ รหัสผ่านตรงกัน"
                  : "รหัสผ่านไม่ตรงกัน"
                : undefined
            }
            hintTone={
              values.confirmPassword === values.newPassword ? "ok" : "error"
            }
          />
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 cursor-pointer rounded-[15px] border border-[#f1dce5] py-3 font-medium text-[#786671] transition hover:bg-[#fff5f8] disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 cursor-pointer rounded-[15px] bg-linear-to-r from-[#ff83ad] to-[#f34c8c] py-3 font-medium text-white shadow-md shadow-pink-200 transition hover:brightness-95 disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Setting() {
  const { setUser, onLogout } = useOutletContext();
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [savedName, setSavedName] = useState(""); // ชื่อ/อีเมลที่บันทึกแล้ว ใช้แสดงบนการ์ดโปรไฟล์
  const [savedEmail, setSavedEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // โหลดข้อมูลบัญชีปัจจุบันมาใส่ในฟอร์ม
  useEffect(() => {
    api
      .get("/api/account")
      .then((res) => {
        const { name, email, phone } = res.data;
        setValues({ name, email, phone: phone || "" });
        setSavedName(name);
        setSavedEmail(email);
      })
      .catch((err) => setMessage({ type: "error", text: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
  };

  // เบอร์โทรมีตัวอักษรอื่นนอกจากตัวเลข -> แสดงคำเตือนและกดบันทึกไม่ได้
  const phoneInvalid = /\D/.test(values.phone);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await api.put("/api/account", values);
      setSavedName(values.name.trim());
      setSavedEmail(values.email.trim());
      setUser((u) => ({ ...u, name: values.name.trim() })); // อัปเดตชื่อบนแถบด้านบนทันที
      setMessage({ type: "success", text: res.data.message });
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[#8e7c87]">กำลังโหลดข้อมูล...</p>;
  }

  return (
    <section className="text-[#3c3038]">
      <h1 className="text-3xl font-semibold">ตั้งค่า</h1>
      <p className="mt-1.5 text-[#8e7c87]">
        จัดการบัญชี การแจ้งเตือน และความเป็นส่วนตัว
      </p>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        {/* การ์ดซ้าย: ข้อมูลบัญชี */}
        <form
          onSubmit={handleSave}
          className="rounded-[22px] border border-[#f1dce5] bg-white p-6 md:p-7"
        >
          <h2 className="text-lg font-semibold">ข้อมูลบัญชี</h2>

          <div className="mt-5 flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-linear-to-br from-[#ff83ad] to-[#f34c8c] text-xl font-semibold text-white">
              {initialsOf(savedName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{savedName}</p>
              <p className="truncate text-sm text-[#8e7c87]">{savedEmail}</p>
            </div>
          </div>

          {message.text && (
            <p
              role={message.type === "error" ? "alert" : "status"}
              className={`mt-5 rounded-xl px-4 py-3 text-sm ${
                message.type === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-semibold text-[#786671]"
              >
                ชื่อ - นามสกุล
              </label>
              <input
                id="name"
                name="name"
                required
                maxLength={100}
                value={values.name}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-[#786671]"
              >
                อีเมล
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={values.email}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-sm font-semibold text-[#786671]"
              >
                เบอร์โทรศัพท์
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="081-234-5678 (ใส่เฉพาะตัวเลข)"
                value={values.phone}
                onChange={handleChange}
                aria-invalid={phoneInvalid}
                aria-describedby={phoneInvalid ? "phone-warning" : undefined}
                className={`${inputClass} ${phoneInvalid ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}`}
              />
              {phoneInvalid && (
                <p id="phone-warning" className="mt-1.5 text-sm text-red-600">
                  ควรใส่เฉพาะตัวเลข
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || phoneInvalid}
            className="mt-7 cursor-pointer disabled:cursor-not-allowed rounded-[15px] bg-linear-to-r from-[#ff83ad] to-[#f34c8c] px-10 py-3 font-medium text-white shadow-md shadow-pink-200 transition hover:brightness-95 disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>

          {/* ส่วนความปลอดภัย: แยกการเปลี่ยนรหัสผ่านออกจากฟอร์มข้อมูลบัญชี */}
          <div className="mt-7 border-t border-[#f6e6ed] pt-6">
            <h3 className="text-base font-semibold">ความปลอดภัย</h3>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffedf3] text-[#f05289]">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">รหัสผ่าน</p>
                  <p className="text-xs text-[#9d8994]">
                    ควรใช้รหัสผ่านที่คาดเดายากอย่างน้อย 8 ตัวอักษร
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessage({ type: "", text: "" });
                  setIsPasswordModalOpen(true);
                }}
                className="cursor-pointer rounded-[12px] border border-[#f1dce5] bg-white px-4 py-2 text-sm font-semibold text-[#f05289] transition hover:border-[#f66c9c] hover:bg-[#fff5f8]"
              >
                เปลี่ยนรหัสผ่าน
              </button>
            </div>
          </div>
        </form>

        {isPasswordModalOpen && (
          <ChangePasswordModal
            onClose={() => setIsPasswordModalOpen(false)}
            onSuccess={(text) => {
              setIsPasswordModalOpen(false);
              setMessage({ type: "success", text });
            }}
          />
        )}

        {/* การ์ดขวา: การแจ้งเตือน & ความเป็นส่วนตัว */}
        <div className="flex flex-col rounded-[22px] border border-[#f1dce5] bg-white p-6 md:p-7">
          <h2 className="text-lg font-semibold">
            การแจ้งเตือน &amp; ความเป็นส่วนตัว
          </h2>

          <LineConnect />

          {/* ไปการ์ด "เงื่อนไขการแจ้งเตือน" ในหน้านัดหมาย */}
          <Link
            to="/appointments#alert-conditions"
            className="group flex items-center gap-3 border-b border-[#f6e6ed] py-4"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffedf3] text-[#f05289]">
              <BellRing className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">เงื่อนไขการแจ้งเตือน</span>
              <span className="block text-xs text-[#9d8994]">
                ตั้งค่าชีพจร ความเครียด และการล้มของสมาชิกแต่ละคน
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#c9b3bd] transition group-hover:translate-x-0.5 group-hover:text-[#f05289]" />
          </Link>

          {/* ภาษา: ตอนนี้มีให้เลือกอย่างเดียว จึงแสดงเป็นข้อความ */}
          <dl className="mt-3">
            <div className="flex items-center justify-between py-4">
              <dt className="font-semibold">ภาษา</dt>
              <dd className="text-[#f05289]">ไทย</dd>
            </div>
          </dl>

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={onLogout}
              className="w-full cursor-pointer rounded-[15px] border-2 border-[#f05289] py-3 font-semibold text-[#f05289] transition hover:bg-[#fff5f8]"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Setting;
