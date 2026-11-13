import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { Printer, AlertTriangle, Siren, UserPlus, Users } from "lucide-react";
import api, { getErrorMessage } from "../../api.js";

const PERIODS = [
  { days: 7, label: "7 วัน" },
  { days: 30, label: "30 วัน" },
  { days: 90, label: "3 เดือน" },
];

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// "2026-11-14" -> "14/11" (ใช้บนแกนกราฟ)
const shortDate = (key) => {
  const [, m, d] = key.split("-");
  return `${Number(d)}/${Number(m)}`;
};

// "2026-11-14" -> "14 พ.ย. 2569"
const longDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
};

const fmt = (v, unit = "") => (v === null || v === undefined ? "-" : `${v.toLocaleString()}${unit}`);

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl border border-pink-100 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="break-inside-avoid rounded-3xl border border-pink-100 bg-white p-6 shadow-xs print:shadow-none">
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

// หน้ารายงานภาพรวมทั้งระบบ (ฝั่ง admin): แจ้งเตือนสุขภาพ / การเติบโตของผู้ใช้
function AdminReports() {
  const [period, setPeriod] = useState(PERIODS[1]); // เริ่มที่ 30 วัน
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // โหลดรายงานใหม่ทุกครั้งที่เปลี่ยนช่วงเวลา
  useEffect(() => {
    let ignore = false; // กันข้อมูลเก่าที่ตอบกลับช้ามาทับข้อมูลใหม่
    setLoading(true);
    api
      .get("/admin/report", { params: { days: period.days } })
      .then((res) => {
        if (!ignore) {
          setReport(res.data);
          setError("");
        }
      })
      .catch((err) => !ignore && setError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [period]);

  const s = report?.summary;

  return (
    <div className="space-y-6">
      {/* หัวรายงาน + เลือกช่วงเวลา + ปุ่มพิมพ์ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">รายงานภาพรวมระบบ</h2>
          {report && (
            <p className="text-sm text-slate-400">
              {longDate(report.from)} – {longDate(report.to)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <div className="flex rounded-full bg-pink-50 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  period.days === p.days ? "bg-pink-500 text-white shadow-xs" : "text-slate-500 hover:text-pink-500"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => window.print()}
            disabled={!report}
            className="flex items-center gap-1.5 rounded-full border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-500 hover:bg-pink-50 disabled:opacity-50 cursor-pointer"
          >
            <Printer className="h-4 w-4" /> พิมพ์รายงาน (PDF)
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading && !report ? (
        <p className="text-sm text-slate-400">กำลังโหลดรายงาน...</p>
      ) : (
        report && (
          <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
            {/* 1. การแจ้งเตือนสุขภาพ */}
            <Section
              title="การแจ้งเตือนสุขภาพ"
              subtitle="เตือน = ชีพจร 101–120 หรือ 50–59 bpm, ความเครียด > 70 · ฉุกเฉิน = ชีพจร > 120 หรือ < 50 bpm"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard icon={AlertTriangle} label="แจ้งเตือนระดับเตือน" value={fmt(s.warning, " ครั้ง")} tone="bg-amber-50 text-amber-600" />
                <StatCard icon={Siren} label="แจ้งเตือนระดับฉุกเฉิน" value={fmt(s.emergency, " ครั้ง")} tone="bg-rose-50 text-rose-500" />
              </div>

              <div className="mt-5">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={report.daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1e4ea" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={20} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip labelFormatter={longDate} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="warning" name="เตือน" stackId="a" fill="#fbbf24" />
                    <Bar dataKey="emergency" name="ฉุกเฉิน" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <h4 className="mb-2 mt-6 text-sm font-bold text-slate-700">สมาชิกที่ถูกแจ้งเตือนบ่อยที่สุด</h4>
              {report.topMembers.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">ไม่มีการแจ้งเตือนในช่วงนี้</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-400">
                    <tr className="border-b border-pink-100">
                      <th className="py-2 font-medium">#</th>
                      <th className="py-2 font-medium">สมาชิก</th>
                      <th className="py-2 font-medium">เจ้าของบัญชี</th>
                      <th className="py-2 text-right font-medium">เตือน</th>
                      <th className="py-2 text-right font-medium">ฉุกเฉิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topMembers.map((m, i) => (
                      <tr key={m.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2.5 text-slate-400">{i + 1}</td>
                        <td className="py-2.5 font-semibold text-slate-800">
                          {m.name} <span className="text-xs font-normal text-pink-500">({m.relation})</span>
                        </td>
                        <td className="py-2.5 text-slate-500">{m.owner_name}</td>
                        <td className="py-2.5 text-right text-amber-600">{m.warning}</td>
                        <td className="py-2.5 text-right font-semibold text-rose-500">{m.emergency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {/* 2. การเติบโตของผู้ใช้ */}
            <Section title="การเติบโตของผู้ใช้" subtitle="ผู้สมัครใหม่และสมาชิกครอบครัวที่ถูกเพิ่มในแต่ละวัน">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard icon={UserPlus} label="ผู้ใช้ใหม่" value={fmt(s.new_users, " คน")} tone="bg-pink-50 text-pink-500" />
                <StatCard icon={Users} label="สมาชิกครอบครัวใหม่" value={fmt(s.new_members, " คน")} tone="bg-emerald-50 text-emerald-600" />
              </div>
              <div className="mt-5">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={report.daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1e4ea" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={20} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip labelFormatter={longDate} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="new_users" name="ผู้ใช้ใหม่" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="new_members" name="สมาชิกครอบครัวใหม่" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>
        )
      )}
    </div>
  );
}

export default AdminReports;
