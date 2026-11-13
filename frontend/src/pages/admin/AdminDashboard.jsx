import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../../api.js";

function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMembers: 0,
    connectedDevices: 0,
    weeklyGrowth: 0,
    weeklyData: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // โหลดสถิติจาก server: ผู้ใช้ทั้งหมด + ผู้สมัครใหม่ 7 วันล่าสุด
  useEffect(() => {
    api
      .get("/admin/dashboard-stats")
      .then((res) => setStats(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const maxCount = Math.max(...stats.weeklyData.map((d) => d.count), 1);

  if (loading) {
    return <div className="p-6 text-slate-500">กำลังโหลดข้อมูลสถิติ...</div>;
  }

  if (error) {
    return (
      <p role="alert" className="max-w-md rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
      {/* 1. การ์ดผู้ใช้ทั้งหมด */}
      <section className="relative overflow-hidden rounded-3xl border border-pink-100 bg-white p-5 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-sm font-light text-slate-400">ผู้ใช้ทั้งหมด</span>
            <h2 className="mt-1 text-3xl font-bold text-slate-800">
              {stats.totalUsers.toLocaleString()}
            </h2>
            <div className="mt-2 flex items-center text-sm font-medium text-emerald-500">
              <svg className="mr-1 h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              +{stats.weeklyGrowth} สัปดาห์นี้
            </div>
          </div>
        </div>
      </section>

      {/* 2. การ์ดนาฬิกาที่เชื่อมต่อ */}
      <section className="rounded-3xl border border-pink-100 bg-white p-5 shadow-xs">
        <span className="text-sm font-light text-slate-400">นาฬิกาที่เชื่อมต่อ</span>
        <h2 className="mt-1 text-3xl font-bold text-slate-800">
          {stats.connectedDevices.toLocaleString()}
          <span className="ml-1 text-base font-medium text-slate-400">
            / {stats.totalMembers.toLocaleString()} คน
          </span>
        </h2>
        <p className="mt-2 text-sm font-medium text-pink-500">
          ยังไม่เชื่อมต่อ {(stats.totalMembers - stats.connectedDevices).toLocaleString()} คน
        </p>
      </section>
      </div>

      {/* 3. การ์ดแสดงผู้ใช้ใหม่ 7 วันล่าสุด */}
      <section className="rounded-3xl border border-pink-100 bg-white p-6 shadow-xs">
        <h3 className="text-lg font-bold text-slate-800">ผู้ใช้ใหม่ 7 วันล่าสุด</h3>
        <p className="mt-0.5 text-xs font-light text-slate-400">จำนวนผู้สมัครรายวัน</p>

        <div className="mt-8 flex h-52 items-end justify-between gap-2 px-1">
          {stats.weeklyData.map((item, index) => {
            const isMax = item.count === maxCount && item.count > 0;
            const heightPercent =
              maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;

            return (
              <div key={index} className="group flex flex-1 flex-col items-center">
                {/* ตัวเลขบนยอดแท่ง */}
                <span
                  className={`mb-2 text-xs font-semibold ${
                    isMax ? "text-pink-500" : "text-slate-400"
                  }`}
                >
                  {item.count}
                </span>

                {/* แท่งกราฟ */}
                <div className="relative flex h-36 w-full items-end justify-center">
                  <div
                    style={{ height: `${heightPercent > 0 ? heightPercent : 6}%` }}
                    className={`w-full max-w-[36px] rounded-2xl transition-all duration-300 ${
                      isMax
                        ? "bg-gradient-to-t from-pink-500 to-pink-400 shadow-md shadow-pink-200"
                        : "bg-pink-100 group-hover:bg-pink-200"
                    }`}
                  />
                </div>

                {/* แสดงชื่อวันครบทั้ง 7 วัน */}
                <span className="mt-3 text-xs font-medium text-slate-400">
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;