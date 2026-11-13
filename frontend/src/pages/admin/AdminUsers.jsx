import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Eye, Trash2, ShieldCheck, UserRound, X, Watch } from "lucide-react";
import api, { getErrorMessage } from "../../api.js";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// แปลงวันที่เป็นแบบไทย เช่น "7 พ.ย. 2569"
const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
};

const ROLE_FILTERS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "user", label: "ผู้ใช้" },
  { value: "admin", label: "ผู้ดูแล" },
];

function RoleBadge({ role }) {
  return role === "admin" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-600">
      <ShieldCheck className="h-3.5 w-3.5" /> admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-semibold text-pink-500">
      <UserRound className="h-3.5 w-3.5" /> user
    </span>
  );
}

function StatusBadge({ status }) {
  const style =
    status === "ปกติ"
      ? "bg-emerald-50 text-emerald-600"
      : status === "อันตราย"
        ? "bg-rose-50 text-rose-500"
        : "bg-slate-100 text-slate-400";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{status || "ไม่มีข้อมูล"}</span>;
}

// กรอบ popup ใช้ร่วมกันทั้งดูรายละเอียดและยืนยันการลบ
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="ปิด">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AdminUsers() {
  const { adminUser } = useOutletContext(); // admin ที่ล็อกอินอยู่ (ห้ามลบ/เปลี่ยน role ตัวเอง)
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [detail, setDetail] = useState(null); // { user, members } ของคนที่กดดูรายละเอียด
  const [detailLoading, setDetailLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null); // id ที่กำลังลบ/เปลี่ยน role อยู่

  const fetchUsers = () =>
    api
      .get("/admin/users")
      .then((res) => {
        setUsers(res.data);
        setError("");
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchUsers();
  }, []);

  // ค้นหาจากชื่อ อีเมล หรือเบอร์โทร + กรองตาม role (ทำในหน้าเว็บ ไม่ต้องเรียก server ใหม่)
  const keyword = search.trim().toLowerCase();
  const filteredUsers = users.filter(
    (u) =>
      (roleFilter === "all" || u.role === roleFilter) &&
      [u.name, u.email, u.phone].some((v) => v?.toLowerCase().includes(keyword))
  );

  const openDetail = async (user) => {
    setDetail({ user, members: [] });
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/users/${user.id}`);
      setDetail(res.data);
    } catch (err) {
      setDetail(null);
      alert(getErrorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const changeRole = async (user, newRole) => {
    if (newRole === user.role) return;
    const text = newRole === "admin" ? `ตั้ง ${user.name} เป็นผู้ดูแลระบบ (admin)?` : `ลดสิทธิ์ ${user.name} กลับเป็นผู้ใช้ทั่วไป (user)?`;
    if (!window.confirm(text)) return;

    setBusyId(user.id);
    try {
      await api.put(`/admin/users/${user.id}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const user = userToDelete;
    setBusyId(user.id);
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setUserToDelete(null);
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-500">กำลังโหลดรายชื่อผู้ใช้...</div>;
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
      {/* หัวข้อ + ค้นหา + กรอง role */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">ผู้ใช้งาน</h2>
          <p className="text-sm text-slate-400">ทั้งหมด {users.length} บัญชี</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร"
              className="w-64 rounded-full border border-pink-100 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
            />
          </div>
          <div className="flex rounded-full bg-pink-50 p-1">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setRoleFilter(f.value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  roleFilter === f.value ? "bg-pink-500 text-white shadow-xs" : "text-slate-500 hover:text-pink-500"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ตารางผู้ใช้ */}
      <div className="overflow-x-auto rounded-3xl border border-pink-100 bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-pink-100 text-xs text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">ผู้ใช้</th>
              <th className="px-5 py-3 font-medium">เบอร์โทร</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">สมาชิก / นาฬิกา</th>
              <th className="px-5 py-3 font-medium">วันที่สมัคร</th>
              <th className="px-5 py-3 text-right font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => {
              const isSelf = u.id === adminUser?.id;
              return (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-pink-50/30">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800">
                      {u.name} {isSelf && <span className="text-xs font-normal text-slate-400">(คุณ)</span>}
                    </p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{u.phone || "-"}</td>
                  <td className="px-5 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {u.member_count} คน · <Watch className="inline h-3.5 w-3.5" /> {u.connected_count}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      {/* เลือก role: เปลี่ยนแล้วถามยืนยันก่อนบันทึก (กดยกเลิก ค่าจะกลับเป็นเดิม) */}
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                        disabled={isSelf || busyId === u.id}
                        title={isSelf ? "เปลี่ยน role ของตัวเองไม่ได้" : "เปลี่ยน role"}
                        aria-label={`role ของ ${u.name}`}
                        className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1.5 text-xs font-semibold text-violet-600 outline-none hover:bg-violet-100 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                      <button
                        onClick={() => openDetail(u)}
                        className="flex items-center gap-1 rounded-lg bg-pink-50 px-2.5 py-1.5 text-xs font-semibold text-pink-500 hover:bg-pink-100 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> ดู
                      </button>
                      <button
                        onClick={() => setUserToDelete(u)}
                        disabled={isSelf || busyId === u.id}
                        title={isSelf ? "ลบบัญชีตัวเองไม่ได้" : ""}
                        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  ไม่พบผู้ใช้ที่ตรงกับการค้นหา
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* popup รายละเอียดผู้ใช้ + สมาชิกครอบครัว */}
      {detail && (
        <Modal title="รายละเอียดผู้ใช้" onClose={() => setDetail(null)}>
          <div className="rounded-2xl bg-pink-50/50 p-4 text-sm">
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-slate-800">{detail.user.name}</p>
              <RoleBadge role={detail.user.role} />
            </div>
            <p className="mt-1 text-slate-500">{detail.user.email}</p>
            <p className="text-slate-500">เบอร์โทร: {detail.user.phone || "-"}</p>
            <p className="text-slate-500">สมัครเมื่อ: {formatDate(detail.user.created_at)}</p>
          </div>

          <h4 className="mb-2 mt-5 text-sm font-bold text-slate-700">สมาชิกครอบครัว ({detail.members.length} คน)</h4>
          {detailLoading ? (
            <p className="text-sm text-slate-400">กำลังโหลด...</p>
          ) : detail.members.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">ยังไม่มีสมาชิกครอบครัว</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {detail.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {m.name} <span className="text-xs font-normal text-pink-500">({m.relation})</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      {m.is_connected ? m.device || "Smart Watch" : "ยังไม่ได้เชื่อมต่ออุปกรณ์"}
                      {m.is_connected && m.heart_rate !== "-" ? ` · ชีพจร ${m.heart_rate}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* popup ยืนยันการลบ */}
      {userToDelete && (
        <Modal title="ยืนยันการลบบัญชี" onClose={() => setUserToDelete(null)}>
          <p className="text-sm text-slate-600">
            ต้องการลบบัญชี <span className="font-bold text-slate-800">{userToDelete.name}</span> ({userToDelete.email}) ใช่หรือไม่?
          </p>
          <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            สมาชิกครอบครัว {userToDelete.member_count} คน รวมถึงข้อมูลสุขภาพและนัดหมายทั้งหมดของบัญชีนี้จะถูกลบด้วย และกู้คืนไม่ได้
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setUserToDelete(null)}
              className="rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              onClick={confirmDelete}
              disabled={busyId === userToDelete.id}
              className="rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60 cursor-pointer"
            >
              {busyId === userToDelete.id ? "กำลังลบ..." : "ลบบัญชี"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AdminUsers;
