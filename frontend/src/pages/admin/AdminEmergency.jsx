import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, HeartPulse, Phone, PhoneCall, Siren, TriangleAlert, UserCheck } from "lucide-react";
import api, { getErrorMessage } from "../../api.js";

// หน้าติดตามเหตุฉุกเฉิน (admin): เคสชีพจรผิดปกติจากนาฬิกาจริง
// ดึงรายการใหม่ทุก 5 วินาที ตัวจับเวลา "รอ mm:ss" เดินทุกวินาที

const POLL_MS = 5000;

// ประเภทเคส (ตอนนี้มีแค่ชีพจรผิดปกติ) — type ที่ไม่รู้จักใช้ค่า hr ไปก่อน หน้าจะได้ไม่พัง
const TYPES = {
  hr: { label: "HR", long: "ชีพจรผิดปกติ", tile: "bg-pink-500 text-white", pill: "bg-pink-500 text-white" },
};
const typeOf = (c) => TYPES[c.type] ?? TYPES.hr;

const STATUS = {
  open: { label: "ยังไม่มีผู้รับ", pill: "bg-red-50 text-red-500", time: "text-red-500" },
  in_progress: { label: "กำลังดูแล", pill: "bg-amber-50 text-amber-600", time: "text-amber-600" },
  closed: { label: "ปิดแล้ว", pill: "bg-emerald-50 text-emerald-600", time: "text-emerald-600" },
};

const FILTERS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "open", label: "ยังไม่รับ" },
  { value: "in_progress", label: "กำลังดูแล" },
  { value: "closed", label: "ปิดแล้ว" },
];

const hhmm = (v) =>
  v ? new Date(v).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }) : "-";

// ระยะเวลาเป็น "mm:ss" (เกิน 1 ชม. เป็น "ชม. นาที")
const duration = (from, now) => {
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)} ชม. ${Math.floor((s % 3600) / 60)} นาที`;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")} นาที`;
};

// ข้อความเวลาของเคสตามสถานะ: รอ / ผ่านไป / ปิดเคส
const timeText = (c, now) => {
  if (c.status === "open") return `รอ ${duration(c.created_at, now)}`;
  if (c.status === "in_progress") return `ผ่านไป ${duration(c.created_at, now)}`;
  return `ปิดเคส ${hhmm(c.closed_at)}`;
};

const caseSubtitle = (c) => {
  const parts = [];
  if (c.last_bpm) parts.push(`ชีพจร ${c.last_bpm} bpm`);
  parts.push(`ผู้ดูแล: ${c.caregiver_name}`);
  return parts.join(" • ");
};

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <section className="flex items-center gap-3 rounded-3xl border border-pink-100 bg-white p-4 shadow-xs">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </section>
  );
}

// แผงรายละเอียดเคสด้านขวา
function CaseDetail({ caseId, now, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api
        .get(`/admin/emergency/cases/${caseId}`)
        .then((res) => {
          setData(res.data);
          setError("");
        })
        .catch((err) => setError(getErrorMessage(err))),
    [caseId]
  );

  useEffect(() => {
    setData(null);
    setNoteOpen(false);
    setNote("");
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
      onChanged();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status) => run(() => api.patch(`/admin/emergency/cases/${caseId}`, { status }));
  const saveNote = (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    run(async () => {
      await api.post(`/admin/emergency/cases/${caseId}/notes`, { message: note });
      setNote("");
      setNoteOpen(false);
    });
  };

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-slate-400">กำลังโหลด...</p>;

  const c = data.case;
  const type = typeOf(c);
  const status = STATUS[c.status];
  const caregiverPhone = String(c.caregiver_phone ?? "").replace(/\D/g, "");
  const contactPhone = String(c.emergency_contact_phone ?? "").replace(/\D/g, "");

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${type.pill}`}>{type.label}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.pill}`}>
          {c.status === "closed" ? status.label : timeText(c, now)}
        </span>
      </div>

      <div>
        <h3 className="text-xl font-bold text-slate-800">{c.member_name}</h3>
        <p className="text-xs text-slate-400">
          {c.relation} • {c.device || "ยังไม่ได้เชื่อมต่ออุปกรณ์"} • {type.long} เมื่อ {hhmm(c.created_at)} น.
        </p>
      </div>

      {/* ข้อมูลที่มีจริงเท่านั้น (ไม่มี SpO2 / ตำแหน่ง / แบตเตอรี่ จากนาฬิกา) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-pink-50/70 p-3">
          <p className="text-xs text-slate-400">ชีพจรล่าสุด</p>
          <p className="text-lg font-bold text-pink-600">{c.last_bpm ?? "-"} bpm</p>
          {c.peak_bpm && <p className="text-[11px] text-slate-400">ผิดปกติสุด {c.peak_bpm} bpm</p>}
        </div>
        <div className="rounded-2xl bg-pink-50/70 p-3">
          <p className="text-xs text-slate-400">ผู้ดูแล</p>
          <p className="truncate text-sm font-bold text-slate-700">{c.caregiver_name}</p>
          <p className={`text-[11px] ${c.caregiver_line ? "text-emerald-600" : "text-red-500"}`}>
            {c.caregiver_line ? "เชื่อม LINE แล้ว" : "ยังไม่เชื่อม LINE"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-pink-100 p-3 text-xs">
        <p className="text-slate-400">ผู้ติดต่อฉุกเฉิน</p>
        <p className="mt-0.5 font-semibold text-slate-700">
          {contactPhone ? `${c.emergency_contact_name || "ไม่ระบุชื่อ"} · ${contactPhone}` : "ยังไม่ได้ตั้งเบอร์ฉุกเฉิน"}
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <p className="text-sm font-bold text-slate-700">ไทม์ไลน์</p>
        <ol className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
          {data.events.length === 0 && <li className="text-xs text-slate-400">ยังไม่มีเหตุการณ์</li>}
          {data.events.map((e) => (
            <li key={e.id} className="flex gap-2 text-xs">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  e.actor === "admin" ? "bg-pink-500" : e.actor === "caregiver" ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              <span className="w-10 shrink-0 font-bold text-slate-700">{hhmm(e.created_at)}</span>
              <span className="text-slate-500">
                {e.message}
                {e.admin_name && <span className="text-slate-400"> — {e.admin_name}</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {noteOpen && (
        <form onSubmit={saveNote} className="space-y-2">
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="เช่น โทรหาผู้ดูแลแล้ว กำลังเดินทางไปดู"
            className="w-full resize-none rounded-2xl border border-pink-100 bg-pink-50/40 px-3 py-2 text-sm outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setNoteOpen(false)} className="flex-1 rounded-full border border-slate-200 py-2 text-xs font-semibold text-slate-500 cursor-pointer">
              ยกเลิก
            </button>
            <button type="submit" disabled={busy || !note.trim()} className="flex-1 rounded-full bg-pink-500 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer">
              บันทึก
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {caregiverPhone ? (
          <a
            href={`tel:${caregiverPhone}`}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-[#ff83ad] to-[#f34c8c] py-3 text-sm font-semibold text-white shadow-md shadow-pink-200 hover:brightness-95"
          >
            <PhoneCall className="h-4 w-4" /> โทรหาผู้ดูแล ({c.caregiver_name})
          </a>
        ) : (
          <p className="rounded-full bg-slate-100 py-3 text-center text-xs text-slate-400">ผู้ดูแลยังไม่ได้ใส่เบอร์โทร</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setNoteOpen(true)}
            disabled={noteOpen}
            className="rounded-full border border-pink-200 bg-white py-2.5 text-xs font-semibold text-pink-500 hover:bg-pink-50 disabled:opacity-50 cursor-pointer"
          >
            บันทึกประสานงาน
          </button>
          <a href="tel:1669" className="flex items-center justify-center gap-1 rounded-full border border-red-200 bg-red-50 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-100">
            <Phone className="h-3.5 w-3.5" /> โทร 1669
          </a>
        </div>
        {/* เปลี่ยนสถานะเคส */}
        <div className="grid grid-cols-2 gap-2">
          {c.status === "open" && (
            <button onClick={() => setStatus("in_progress")} disabled={busy} className="rounded-full bg-amber-50 py-2.5 text-xs font-semibold text-amber-600 hover:bg-amber-100 disabled:opacity-50 cursor-pointer">
              รับเรื่อง
            </button>
          )}
          {c.status !== "closed" ? (
            <button
              onClick={() => setStatus("closed")}
              disabled={busy}
              className={`rounded-full bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer ${c.status === "open" ? "" : "col-span-2"}`}
            >
              ปิดเคส
            </button>
          ) : (
            <button onClick={() => setStatus("in_progress")} disabled={busy} className="col-span-2 rounded-full bg-slate-100 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 disabled:opacity-50 cursor-pointer">
              เปิดเคสอีกครั้ง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminEmergency() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(
    () =>
      api
        .get("/admin/emergency/cases")
        .then((res) => {
          setData(res.data);
          setUpdatedAt(new Date());
          setError("");
        })
        .catch((err) => setError(getErrorMessage(err))),
    []
  );

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  // ยังไม่ได้เลือก หรือเคสที่เลือกหายไปจากรายการ -> เลือกเคสแรก (เคสที่ยังไม่มีผู้รับอยู่บนสุด)
  useEffect(() => {
    if (!data?.cases.length) return;
    if (!data.cases.some((c) => c.id === selectedId)) setSelectedId(data.cases[0].id);
  }, [data, selectedId]);

  if (error && !data) {
    return <p role="alert" className="max-w-md rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  }
  if (!data) return <div className="p-6 text-slate-500">กำลังโหลดเหตุฉุกเฉิน...</div>;

  const { stats, cases } = data;
  const countOf = (s) => cases.filter((c) => c.status === s).length;
  const shown = cases.filter((c) => filter === "all" || c.status === filter);
  const firstOverdue = cases.find(
    (c) => c.status === "open" && now - new Date(c.created_at).getTime() > data.overdueMinutes * 60000
  );

  return (
    <div className="space-y-5">
      {/* หัวข้อ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ติดตามเหตุฉุกเฉิน</h2>
          <p className="text-sm text-slate-400">
            เคสแจ้งเตือนจากนาฬิกาแบบเรียลไทม์ • อัปเดตล่าสุด {updatedAt ? hhmm(updatedAt) : "-"} น.
            {error && <span className="text-red-500"> (เชื่อมต่อไม่ได้ ลองใหม่อัตโนมัติ)</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> LIVE
          </span>
          <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${stats.open ? "bg-red-500 text-white" : "bg-emerald-50 text-emerald-600"}`}>
            {stats.open ? `ยังไม่มีผู้รับ ${stats.open}` : "ไม่มีเคสค้าง"}
          </span>
        </div>
      </div>

      {/* แถบเตือนเคสค้างเกิน 5 นาที */}
      {stats.overdue > 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-red-200 bg-red-50 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-bold text-red-600">
                มี {stats.overdue} เคสที่ผู้ดูแลยังไม่กดรับเรื่องเกิน {data.overdueMinutes} นาที
              </p>
              <p className="text-xs text-red-400">แนะนำให้โทรประสานผู้ดูแล หรือผู้ติดต่อฉุกเฉินลำดับถัดไป</p>
            </div>
          </div>
          {firstOverdue && (
            <button
              onClick={() => {
                setFilter("open");
                setSelectedId(firstOverdue.id);
              }}
              className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 cursor-pointer"
            >
              ดูเคสที่รอ →
            </button>
          )}
        </div>
      )}

      {/* ตัวเลขสรุปวันนี้ */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={HeartPulse} label="ชีพจรผิดปกติวันนี้" value={stats.today.total} tone="bg-pink-50 text-pink-500" />
        <StatCard icon={Clock3} label="ยังไม่มีผู้รับ" value={stats.open} tone="bg-red-50 text-red-500" />
        <StatCard icon={UserCheck} label="กำลังดูแล" value={stats.inProgress} tone="bg-amber-50 text-amber-600" />
        <StatCard icon={Check} label="รับเรื่องแล้ววันนี้" value={`${stats.today.acknowledged} / ${stats.today.total}`} tone="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* รายการเคส */}
        <section className="overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-xs">
          <div className="p-5 pb-3">
            <h3 className="font-bold text-slate-800">เคสวันนี้ และเคสที่ยังไม่ปิด</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    filter === f.value ? "bg-pink-500 text-white shadow-xs" : "bg-pink-50 text-pink-500 hover:bg-pink-100"
                  }`}
                >
                  {f.label} {f.value === "all" ? cases.length : countOf(f.value)}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-[560px] overflow-y-auto">
            {shown.map((c) => {
              const t = typeOf(c);
              const s = STATUS[c.status];
              const active = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`flex w-full items-center gap-3 border-t border-pink-50 px-5 py-3.5 text-left transition cursor-pointer ${
                      active ? "border-l-4 border-l-red-400 bg-red-50/50" : "hover:bg-pink-50/40"
                    }`}
                  >
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-bold ${t.tile}`}>{t.label}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-bold text-slate-800">{c.member_name}</span>
                        <span className="shrink-0 text-xs text-slate-400">({c.relation})</span>
                      </span>
                      <span className="block truncate text-xs text-slate-400">{caseSubtitle(c)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`text-xs font-bold ${s.time}`}>{timeText(c, now)}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.pill}`}>{s.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-5 py-14 text-center text-sm text-slate-400">
                <Siren className="h-8 w-8 text-pink-200" />
                {cases.length === 0 ? "วันนี้ยังไม่มีเหตุฉุกเฉิน" : "ไม่มีเคสในหมวดนี้"}
              </li>
            )}
          </ul>
        </section>

        {/* รายละเอียดเคส */}
        <section className="rounded-3xl border border-pink-100 bg-white shadow-xs">
          {selectedId ? (
            <CaseDetail caseId={selectedId} now={now} onChanged={load} />
          ) : (
            <p className="p-10 text-center text-sm text-slate-400">เลือกเคสเพื่อดูรายละเอียด</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminEmergency;
