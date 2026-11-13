import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { KeyRound, ShieldCheck } from "lucide-react";
import api, { getErrorMessage } from "../../api.js";
import { ChangePasswordModal } from "../setting.jsx";

const inputClass =
  "w-full rounded-2xl border border-pink-100 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-pink-300 focus:ring-4 focus:ring-pink-100";

// หน้าตั้งค่าของ admin: แก้โปรไฟล์ + เปลี่ยนรหัสผ่าน (ใช้ API /api/account เดียวกับฝั่งผู้ใช้)
function AdminSettings() {
  const { setAdminUser } = useOutletContext();
  const [values, setValues] = useState({ name: "", email: "", phone: "" });
  const [saved, setSaved] = useState({ name: "", email: "" }); // ค่าที่บันทึกแล้ว แสดงบนการ์ดโปรไฟล์
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // โหลดข้อมูลบัญชีปัจจุบันมาใส่ฟอร์ม
  useEffect(() => {
    api
      .get("/api/account")
      .then((res) => {
        const { name, email, phone } = res.data;
        setValues({ name, email, phone: phone || "" });
        setSaved({ name, email });
      })
      .catch((err) => setMessage({ type: "error", text: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setValues({ ...values, [e.target.name]: e.target.value });

  // เบอร์โทรต้องเป็นตัวเลขเท่านั้น (server ตรวจซ้ำอีกรอบ)
  const phoneInvalid = /\D/.test(values.phone);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: "", text: "" });
    try {
      const res = await api.put("/api/account", values);
      const name = values.name.trim();
      setSaved({ name, email: values.email.trim() });
      setAdminUser((u) => ({ ...u, name })); // อัปเดตชื่อบนแถบด้านบนทันที
      setMessage({ type: "success", text: res.data.message });
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-500">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">ตั้งค่า</h2>
        <p className="text-sm text-slate-400">จัดการบัญชีผู้ดูแลระบบของคุณ</p>
      </div>

      {message.text && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={`rounded-2xl px-4 py-3 text-sm ${
            message.type === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* การ์ดโปรไฟล์ */}
      <section className="flex items-center gap-4 rounded-3xl border border-pink-100 bg-white p-5 shadow-xs">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-pink-500 text-xl font-bold text-white">
          {saved.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-slate-800">{saved.name}</p>
          <p className="truncate text-sm text-slate-400">{saved.email}</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-600">
          <ShieldCheck className="h-3.5 w-3.5" /> ผู้ดูแลระบบ
        </span>
      </section>

      {/* ฟอร์มแก้โปรไฟล์ */}
      <form onSubmit={handleSave} className="space-y-4 rounded-3xl border border-pink-100 bg-white p-6 shadow-xs">
        <h3 className="font-bold text-slate-800">ข้อมูลส่วนตัว</h3>

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm text-slate-600">ชื่อ</label>
          <input id="name" name="name" required value={values.name} onChange={handleChange} className={inputClass} />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm text-slate-600">อีเมล</label>
          <input id="email" name="email" type="email" required value={values.email} onChange={handleChange} className={inputClass} />
        </div>

        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm text-slate-600">เบอร์โทรศัพท์</label>
          <input
            id="phone"
            name="phone"
            inputMode="numeric"
            maxLength={10}
            value={values.phone}
            onChange={handleChange}
            placeholder="ไม่บังคับ"
            className={inputClass}
          />
          {phoneInvalid && <p className="mt-1.5 text-xs text-red-500">เบอร์โทรศัพท์ต้องเป็นตัวเลขเท่านั้น</p>}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || phoneInvalid}
            className="rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-pink-600 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </form>

      {/* ความปลอดภัย */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-pink-100 bg-white p-6 shadow-xs">
        <div>
          <h3 className="font-bold text-slate-800">รหัสผ่าน</h3>
          <p className="text-sm text-slate-400">แนะนำให้เปลี่ยนรหัสผ่านเป็นระยะ เพื่อความปลอดภัยของบัญชีผู้ดูแล</p>
        </div>
        <button
          onClick={() => setIsPasswordModalOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-pink-200 px-5 py-2 text-sm font-semibold text-pink-500 hover:bg-pink-50 cursor-pointer"
        >
          <KeyRound className="h-4 w-4" /> เปลี่ยนรหัสผ่าน
        </button>
      </section>

      {isPasswordModalOpen && (
        <ChangePasswordModal
          onClose={() => setIsPasswordModalOpen(false)}
          onSuccess={(text) => {
            setIsPasswordModalOpen(false);
            setMessage({ type: "success", text });
          }}
        />
      )}
    </div>
  );
}

export default AdminSettings;
