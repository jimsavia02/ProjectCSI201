import { useEffect, useState } from "react";
import { Search, Watch, Wifi, WifiOff, Clock3 } from "lucide-react";
import api, { getErrorMessage } from "../../api.js";

// สถานะการเชื่อมต่อที่ server ส่งมา -> ข้อความ / สี
const CONNECTION = {
  online: { label: "ออนไลน์", style: "bg-emerald-50 text-emerald-600" },
  stale: { label: "ขาดการซิงค์", style: "bg-amber-50 text-amber-600" },
  not_connected: { label: "ยังไม่เชื่อมต่อ", style: "bg-slate-100 text-slate-400" },
};

const FILTERS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "online", label: "ออนไลน์" },
  { value: "stale", label: "ขาดการซิงค์" },
  { value: "not_connected", label: "ยังไม่เชื่อมต่อ" },
];

// เวลาซิงค์ล่าสุดแบบอ่านง่าย: "5 นาทีที่แล้ว", "3 ชม.ที่แล้ว", "2 วันที่แล้ว"
const timeAgo = (value) => {
  if (!value) return "ยังไม่เคยซิงค์";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
};

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <section className="rounded-3xl border border-pink-100 bg-white p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-light text-slate-400">{label}</span>
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-800">{value.toLocaleString()}</p>
    </section>
  );
}

function AdminDevices() {
  const [devices, setDevices] = useState([]);
  const [staleHours, setStaleHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api
      .get("/admin/devices")
      .then((res) => {
        setDevices(res.data.devices);
        setStaleHours(res.data.staleHours);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  // นับจำนวนแต่ละสถานะ ใช้ทั้งการ์ดสรุปและตัวเลขบนปุ่มกรอง
  const countOf = (connection) => devices.filter((d) => d.connection === connection).length;

  // ค้นหาจากชื่อสมาชิก เจ้าของบัญชี หรือรุ่นนาฬิกา + กรองตามสถานะ
  const keyword = search.trim().toLowerCase();
  const filteredDevices = devices.filter(
    (d) =>
      (filter === "all" || d.connection === filter) &&
      [d.name, d.owner_name, d.owner_email, d.device].some((v) => v?.toLowerCase().includes(keyword))
  );

  if (loading) {
    return <div className="p-6 text-slate-500">กำลังโหลดข้อมูลอุปกรณ์...</div>;
  }

  if (error) {
    return (
      <p role="alert" className="max-w-md rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">อุปกรณ์</h2>
        <p className="text-sm text-slate-400">Smart Watch ของสมาชิกครอบครัวทุกคนในระบบ</p>
      </div>

      {/* การ์ดสรุป */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Watch} label="อุปกรณ์ทั้งหมด" value={devices.length} tone="bg-pink-50 text-pink-500" />
        <SummaryCard icon={Wifi} label="ออนไลน์" value={countOf("online")} tone="bg-emerald-50 text-emerald-600" />
        <SummaryCard icon={Clock3} label={`ขาดการซิงค์ (> ${staleHours} ชม.)`} value={countOf("stale")} tone="bg-amber-50 text-amber-600" />
        <SummaryCard icon={WifiOff} label="ยังไม่เชื่อมต่อ" value={countOf("not_connected")} tone="bg-slate-100 text-slate-500" />
      </div>

      {/* ค้นหา + กรองสถานะ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาสมาชิก เจ้าของ หรือรุ่นนาฬิกา"
            className="w-72 rounded-full border border-pink-100 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
          />
        </div>
        <div className="flex flex-wrap rounded-full bg-pink-50 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                filter === f.value ? "bg-pink-500 text-white shadow-xs" : "text-slate-500 hover:text-pink-500"
              }`}
            >
              {f.label} ({f.value === "all" ? devices.length : countOf(f.value)})
            </button>
          ))}
        </div>
      </div>

      {/* ตารางอุปกรณ์ */}
      <div className="overflow-x-auto rounded-3xl border border-pink-100 bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-pink-100 text-xs text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">สมาชิก</th>
              <th className="px-5 py-3 font-medium">เจ้าของบัญชี</th>
              <th className="px-5 py-3 font-medium">รุ่นนาฬิกา</th>
              <th className="px-5 py-3 font-medium">การเชื่อมต่อ</th>
              <th className="px-5 py-3 font-medium">ซิงค์ล่าสุด</th>
              <th className="px-5 py-3 font-medium">สุขภาพล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((d) => {
              const conn = CONNECTION[d.connection];
              const danger = d.status === "อันตราย";
              return (
                <tr key={d.id} className="border-b border-slate-50 last:border-0 hover:bg-pink-50/30">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800">{d.name}</p>
                    <p className="text-xs text-pink-500">{d.relation}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-slate-700">{d.owner_name}</p>
                    <p className="text-xs text-slate-400">{d.owner_email}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{d.device || "-"}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${conn.style}`}>{conn.label}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {d.connection === "not_connected" ? "-" : timeAgo(d.last_synced_at)}
                  </td>
                  <td className="px-5 py-3">
                    {d.connection === "not_connected" || !d.heart_rate || d.heart_rate === "-" ? (
                      <span className="text-slate-400">ไม่มีข้อมูล</span>
                    ) : (
                      <span className={danger ? "font-semibold text-rose-500" : "text-slate-600"}>
                        {d.heart_rate} · {d.status}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {filteredDevices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  {devices.length === 0 ? "ยังไม่มีอุปกรณ์ในระบบ" : "ไม่พบอุปกรณ์ที่ตรงกับการค้นหา"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminDevices;
