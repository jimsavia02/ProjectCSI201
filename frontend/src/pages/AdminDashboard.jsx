import React, { useEffect, useState } from "react";
import {
  Users,
  Watch,
  Wifi,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Download,
  Ticket,
  RefreshCw,
} from "lucide-react";
import api from "../api.js";

// ──────────────────────────────────────────────
// Stat Card
// ──────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, label, value, sub, subColor, loading }) {
  return (
    <div className="rounded-2xl bg-white border border-pink-100 px-5 py-4 shadow-xs flex items-start gap-4 min-w-0">
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 truncate">{label}</p>
        {loading ? (
          <div className="mt-1 h-7 w-20 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <p className="mt-0.5 text-2xl font-bold text-slate-800 leading-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        )}
        {!loading && sub && (
          <p className={`mt-1 text-xs font-semibold flex items-center gap-1 ${subColor || "text-slate-400"}`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Bar Chart
// ──────────────────────────────────────────────
function BarChart({ data, loading }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  if (loading) {
    return (
      <div className="flex h-40 items-end gap-2 px-1">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="w-full max-w-[36px] h-24 animate-pulse rounded-xl bg-pink-100" />
            <div className="h-3 w-4 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-6 flex h-44 items-end justify-between gap-2 px-1">
      {data.map((item, i) => {
        const isMax = item.count === maxCount && item.count > 0;
        const heightPct = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
        return (
          <div key={i} className="group flex flex-1 flex-col items-center">
            <span className={`mb-1 text-xs font-semibold ${isMax ? "text-pink-500" : "text-slate-400"}`}>
              {item.count}
            </span>
            <div className="relative flex h-32 w-full items-end justify-center">
              <div
                style={{ height: `${heightPct > 0 ? heightPct : 5}%` }}
                className={`w-full max-w-[36px] rounded-2xl transition-all duration-300 ${
                  isMax
                    ? "bg-gradient-to-t from-pink-500 to-pink-400 shadow-md shadow-pink-200"
                    : "bg-pink-100 group-hover:bg-pink-200"
                }`}
              />
            </div>
            <span className="mt-2 text-xs font-medium text-slate-400">{item.day}</span>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// Brand Progress Bar
// ──────────────────────────────────────────────
const brandColors = {
  "Apple Watch": "bg-pink-500",
  "Samsung Galaxy Watch": "bg-blue-400",
  "Garmin": "bg-rose-400",
  "Xiaomi / อื่นๆ": "bg-orange-400",
  "อื่นๆ": "bg-slate-300",
};

function BrandBar({ brand, pct, count, loading }) {
  const color = brandColors[brand] || "bg-slate-300";
  if (loading) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-8 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{brand}</span>
        <span className="font-bold text-slate-500">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStats = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/admin/dashboard-stats");
      setStats(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Admin dashboard error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const weeklyData = stats?.weeklyData || [
    { day: "จ.", count: 0 },
    { day: "อ.", count: 0 },
    { day: "พ.", count: 0 },
    { day: "พฤ.", count: 0 },
    { day: "ศ.", count: 0 },
    { day: "ส.", count: 0 },
    { day: "อา.", count: 0 },
  ];

  const deviceBrands = stats?.deviceBrands || [];
  const userDiff = stats ? stats.newUsersToday - stats.newUsersYesterday : 0;

  return (
    <div className="space-y-6">

      {/* ── Header row (ส่งออกรายงาน + refresh) ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ภาพรวมระบบ</h2>
          {lastUpdated && (
            <p className="text-xs text-slate-400 mt-0.5">
              อัปเดตล่าสุด {lastUpdated.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-xs font-semibold text-pink-500 hover:bg-pink-100 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            รีเฟรช
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-pink-600 transition cursor-pointer">
            <Download className="h-3.5 w-3.5" />
            ส่งออกรายงาน
          </button>
        </div>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          iconBg="bg-pink-50 text-pink-500"
          label="ผู้ใช้ทั้งหมด"
          value={stats?.totalUsers ?? 0}
          sub={
            <>
              <TrendingUp className="h-3 w-3" />
              +{stats?.weeklyUserGrowth ?? 0} สัปดาห์นี้
            </>
          }
          subColor="text-emerald-500"
          loading={loading}
        />
        <StatCard
          icon={Watch}
          iconBg="bg-blue-50 text-blue-500"
          label="อุปกรณ์ที่ใช้งาน"
          value={stats?.totalDevices ?? 0}
          sub={
            <>
              <TrendingUp className="h-3 w-3" />
              +{stats?.weeklyDeviceGrowth ?? 0} สัปดาห์นี้
            </>
          }
          subColor="text-emerald-500"
          loading={loading}
        />
        <StatCard
          icon={Wifi}
          iconBg="bg-emerald-50 text-emerald-500"
          label="ออนไลน์วันนี้"
          value={stats?.onlineToday ?? 0}
          sub={<>{stats?.onlinePct ?? 0}% ของอุปกรณ์</>}
          subColor="text-slate-400"
          loading={loading}
        />
        <StatCard
          icon={UserCheck}
          iconBg="bg-violet-50 text-violet-500"
          label="สมัครใหม่วันนี้"
          value={stats?.newUsersToday ?? 0}
          sub={
            userDiff === 0 ? (
              <>=เท่ากับเมื่อวาน</>
            ) : userDiff > 0 ? (
              <>
                <TrendingUp className="h-3 w-3" />+{userDiff} จากเมื่อวาน
              </>
            ) : (
              <>
                <TrendingDown className="h-3 w-3" />{userDiff} จากเมื่อวาน
              </>
            )
          }
          subColor={userDiff > 0 ? "text-emerald-500" : userDiff < 0 ? "text-rose-500" : "text-slate-400"}
          loading={loading}
        />
      </div>

      {/* ── Chart + Device Brand ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Bar Chart */}
        <div className="xl:col-span-3 rounded-2xl bg-white border border-pink-100 p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-800">ผู้ใช้ใหม่ 7 วันล่าสุด</h3>
          <p className="text-xs text-slate-400 mt-0.5">จำนวนผู้สมัครรายวัน</p>
          <BarChart data={weeklyData} loading={loading} />
        </div>

        {/* Device Brand */}
        <div className="xl:col-span-2 rounded-2xl bg-white border border-pink-100 p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-800">อุปกรณ์ตามยี่ห้อ</h3>
          <p className="text-xs text-slate-400 mt-0.5">เชื่อมต่อผ่าน API</p>

          {loading ? (
            <div className="mt-5 space-y-5">
              {[...Array(4)].map((_, i) => (
                <BrandBar key={i} loading />
              ))}
            </div>
          ) : deviceBrands.length === 0 ? (
            <div className="mt-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูลอุปกรณ์</div>
          ) : (
            <div className="mt-5 space-y-4">
              {deviceBrands.map((b) => (
                <BrandBar key={b.brand} brand={b.brand} pct={b.pct} count={b.count} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Ticket Section (Placeholder) ── */}
      <div className="rounded-2xl bg-white border border-pink-100 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">Ticket ล่าสุด</h3>
            <p className="text-xs text-slate-400 mt-0.5">ระบบ Ticket ยังไม่เปิดใช้งาน</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400">
            เร็วๆ นี้
          </span>
        </div>

        <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50">
            <Ticket className="h-7 w-7 text-pink-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">ยังไม่มี Ticket ในระบบ</p>
          <p className="text-xs text-slate-400 max-w-xs">
            เมื่อเพิ่มฟีเจอร์ให้ผู้ใช้ส่ง Ticket แล้ว รายการจะแสดงที่นี่
          </p>
        </div>
      </div>
    </div>
  );
}
