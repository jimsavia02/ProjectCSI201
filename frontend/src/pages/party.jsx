import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Watch, User, Activity, Moon, Heart, ExternalLink, X, CalendarHeart, Phone, PhoneCall, Clock,
  ChevronRight, Wifi, WifiOff,
} from 'lucide-react';
import api from '../api.js';

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// วันนี้ในรูปแบบ "YYYY-MM-DD" ตามเวลาเครื่อง (ใช้เทียบกับวันนัดที่เก็บเป็นข้อความ)
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// "2026-11-20" -> "20 พ.ย. 2026"
const formatDateKey = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return key;
  return `${d} ${THAI_MONTHS[m - 1]} ${y}`;
};

// เวลาซิงค์ล่าสุด: "วันนี้ 09:42", "เมื่อวาน 21:15", "27 ต.ค. 22:10"
const formatSyncTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `วันนี้ ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `เมื่อวาน ${time}`;
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${time}`;
};

// แถวข้อมูลในการ์ด: ป้ายซ้าย ค่าขวา
function InfoRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-semibold text-slate-700">{children}</span>
    </div>
  );
}

// popup รายละเอียดสมาชิก
function MemberDetailModal({ member, onClose }) {
  const navigate = useNavigate();
  const [nextAppointment, setNextAppointment] = useState(undefined); // undefined = กำลังโหลด, null = ไม่มีนัด

  // โหลดนัดหมายของสมาชิก แล้วเลือกนัดแรกที่ยังไม่ผ่านไป
  useEffect(() => {
    let ignore = false;
    api.get(`/api/family-members/${member.id}/appointments`)
      .then((res) => {
        if (ignore) return;
        const today = todayKey();
        const upcoming = res.data
          .filter((a) => a.appointment_date >= today)
          .sort((a, b) => `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`));
        setNextAppointment(upcoming[0] ?? null);
      })
      .catch(() => !ignore && setNextAppointment(null));
    return () => {
      ignore = true;
    };
  }, [member.id]);

  // กด Esc เพื่อปิด
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const connected = Boolean(member.is_connected);
  const syncTime = formatSyncTime(member.last_synced_at);
  const statusClass =
    member.status === 'ปกติ' ? 'bg-emerald-100 text-emerald-600'
    : member.status === 'อันตราย' ? 'bg-rose-100 text-rose-500'
    : 'bg-slate-100 text-slate-400';

  // ไปหน้าอื่นพร้อมส่งสมาชิกที่เลือกไปด้วย หน้านั้นจะเลือกคนนี้ให้อัตโนมัติ
  const goTo = (path) => navigate(path, { state: { memberId: member.id } });

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-pink-100"
      >
        {/* ส่วนหัว: รูป ชื่อ ความสัมพันธ์ สถานะ */}
        <div className="flex items-start justify-between gap-4 p-6 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 bg-pink-100 text-pink-500 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-inner flex-shrink-0">
              {member.name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <h2 id="member-detail-title" className="font-bold text-slate-800 text-lg truncate">{member.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-pink-500 font-medium bg-pink-50 px-2.5 py-0.5 rounded-full">
                  {member.relation || 'สมาชิก'}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusClass}`}>
                  {member.status || 'ไม่มีข้อมูล'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* ข้อมูลทั่วไป + อุปกรณ์ */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">ข้อมูลทั่วไป & อุปกรณ์</h3>
            <div className="divide-y divide-slate-100">
              <InfoRow label="ชื่อ - นามสกุล">{member.name}</InfoRow>
              <InfoRow label="ความสัมพันธ์">{member.relation || '-'}</InfoRow>
              <InfoRow label="อุปกรณ์">
                <span className="inline-flex items-center gap-1.5">
                  <Watch className="w-4 h-4 text-pink-400" /> {member.device || 'ยังไม่ได้ระบุ'}
                </span>
              </InfoRow>
              <InfoRow label="การเชื่อมต่อ">
                {connected ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600">
                    <Wifi className="w-4 h-4" /> เชื่อมต่อแล้ว
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <WifiOff className="w-4 h-4" /> ยังไม่ได้เชื่อมต่อ
                  </span>
                )}
              </InfoRow>
              <InfoRow label="ซิงค์ล่าสุด">{syncTime || 'ยังไม่เคยซิงค์'}</InfoRow>
            </div>
          </section>

          {/* นัดหมายถัดไป */}
          <section className="rounded-2xl bg-pink-50/60 border border-pink-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarHeart className="w-4 h-4 text-pink-500" />
              <h3 className="text-sm font-bold text-slate-800">นัดหมายถัดไป</h3>
            </div>
            {nextAppointment === undefined ? (
              <p className="text-xs text-slate-400">กำลังโหลด...</p>
            ) : nextAppointment ? (
              <div>
                <p className="text-pink-500 font-extrabold text-base">
                  {formatDateKey(nextAppointment.appointment_date)} • {nextAppointment.appointment_time} น.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {nextAppointment.doctor_name} • {nextAppointment.hospital_name}
                </p>
                <span className="inline-flex items-center gap-1 mt-2 bg-white text-pink-500 text-[11px] px-2.5 py-0.5 rounded-full font-medium">
                  <Clock className="w-3 h-3" /> แจ้งเตือน{nextAppointment.reminder_note}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400">ยังไม่มีนัดหมายที่จะถึง</p>
            )}
          </section>

          {/* ผู้ติดต่อฉุกเฉิน */}
          <section className="rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <PhoneCall className="w-4 h-4 text-pink-500" />
              <h3 className="text-sm font-bold text-slate-800">ผู้ติดต่อฉุกเฉิน</h3>
            </div>
            {member.emergency_contact_phone ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{member.emergency_contact_name || '-'}</p>
                  <p className="text-sm text-slate-500">{member.emergency_contact_phone}</p>
                </div>
                <a
                  href={`tel:${member.emergency_contact_phone}`}
                  className="bg-pink-400 hover:bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-pink-200 transition flex items-center gap-1.5 flex-shrink-0"
                >
                  <Phone className="w-3.5 h-3.5 fill-white" /> โทร
                </a>
              </div>
            ) : (
              <p className="text-xs text-slate-400">ยังไม่มีข้อมูล (เพิ่มได้ที่หน้าภาพรวม)</p>
            )}
          </section>

          {/* ปุ่มลัด */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => goTo('/data')}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold shadow-md shadow-pink-200 transition cursor-pointer"
            >
              <span className="flex items-center gap-2"><Heart className="w-4 h-4" /> ดูข้อมูลสุขภาพ</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => goTo('/appointments')}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border border-pink-200 hover:bg-pink-50 text-pink-500 text-sm font-bold transition cursor-pointer"
            >
              <span className="flex items-center gap-2"><CalendarHeart className="w-4 h-4" /> จัดการนัดหมาย</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Party() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal สำหรับเพิ่มสมาชิกใหม่
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('คู่สมรส');
  const [customRelation, setCustomRelation] = useState('');
  const [newDevice, setNewDevice] = useState('Smart Watch');

  // สมาชิกที่กำลังเปิดดูรายละเอียดใน popup (null = ปิด)
  const [detailMember, setDetailMember] = useState(null);

  // ฟังก์ชันดึงข้อมูลสมาชิกทั้งหมด
  const fetchMembers = async () => {
    try {
      const res = await api.get('/api/family-members');
      setMembers(res.data || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching family members:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // ฟังก์ชันเพิ่มสมาชิกใหม่
  const handleAddMember = async (e) => {
    e.preventDefault();
    // ถ้าเลือก "อื่นๆ" ให้ใช้ข้อความที่ผู้ใช้กรอกเองแทน
    const relation = newRelation === 'อื่นๆ' ? customRelation.trim() : newRelation;
    if (!newName || !relation) return;

    try {
      await api.post('/api/family-members', {
        name: newName,
        relation,
        device: newDevice
      });

      setIsAddModalOpen(false);
      setNewName('');
      setNewRelation('คู่สมรส');
      setCustomRelation('');
      setNewDevice('Smart Watch');

      fetchMembers();
    } catch (err) {
      console.error("Error adding member:", err);
      alert("ไม่สามารถเพิ่มสมาชิกได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ฟังก์ชันลบสมาชิก
  const handleDeleteMember = async (id) => {
    if (!window.confirm("คุณต้องการลบสมาชิกคนนี้ใช่หรือไม่?")) return;

    try {
      await api.delete(`/api/family-members/${id}`);
      setMembers(members.filter(m => m.id !== id));
    } catch (err) {
      console.error("Error deleting member:", err);
      alert("ไม่สามารถลบสมาชิกได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // ฟังก์ชันจำลองการเชื่อมต่อ Smart Watch (Mock Sync)
  const handleMockSync = async (memberId) => {
    try {
      await api.post(`/api/garmin/mock-sync/${memberId}`);
      fetchMembers();
      alert("เชื่อมต่อและซิงค์ข้อมูลจาก Smart Watch สำเร็จ!");
    } catch (err) {
      console.error("Mock sync error:", err);
      alert("ไม่สามารถเชื่อมต่ออุปกรณ์ได้");
    }
  };

  if (loading) {
    return <div className="p-10 text-slate-400">กำลังโหลดข้อมูลสมาชิก...</div>;
  }

  return (
    <div className="p-6 md:p-10 bg-slate-50 min-h-screen font-sans text-slate-700">
      
      {/* ส่วนหัวข้อหน้า */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">สมาชิกครอบครัว</h1>
          <p className="text-sm text-slate-400 mt-1">
            จัดการคนที่คุณ monitor ({members.length} คน)
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-md shadow-pink-200 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> เพิ่มสมาชิก
        </button>
      </div>

      {/* รายการสมาชิก */}
      <div className="space-y-4">
        {members.map((member) => {
          const avatarLetter = member?.name && typeof member.name === 'string' && member.name.length > 0 
            ? member.name.charAt(0) 
            : 'U';

          return (
            <div 
              key={member.id} 
              className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-pink-200 transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-pink-100 text-pink-500 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-inner flex-shrink-0">
                  {avatarLetter}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-base">{member.name || 'ไม่มีชื่อ'}</h3>
                    <span className="text-xs text-pink-500 font-medium bg-pink-50 px-2.5 py-0.5 rounded-full">
                      {member.relation || 'สมาชิก'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {member.device || 'ยังไม่ได้เชื่อมต่ออุปกรณ์'}
                  </p>

                  {/* สรุปค่าสุขภาพย่อๆ */}
                  <div className="flex items-center gap-4 mt-3 text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1 bg-rose-50 text-rose-500 px-2.5 py-1 rounded-xl">
                      <Heart className="w-3.5 h-3.5 fill-rose-500" /> {member.heart_rate || '75 bpm'}
                    </span>
                    <span className="flex items-center gap-1 bg-purple-50 text-purple-500 px-2.5 py-1 rounded-xl">
                      <Activity className="w-3.5 h-3.5" /> {member.steps || '0'} ก้าว
                    </span>
                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-500 px-2.5 py-1 rounded-xl">
                      <Moon className="w-3.5 h-3.5" /> {member.sleep || '7.5 ชม.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ปุ่มจัดการครบถ้วน: สถานะ, ดูรายละเอียด, ลบ, เชื่อมต่อ Smart Watch */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  member.status === 'ปกติ' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'
                }`}>
                  {member.status || 'ปกติ'}
                </span>

                {/* ปุ่มดูรายละเอียด */}
                <button
                  onClick={() => setDetailMember(member)}
                  className="bg-pink-50 hover:bg-pink-100 text-pink-500 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> ดูรายละเอียด
                </button>

                {/* ปุ่มลบ */}
                <button
                  onClick={() => handleDeleteMember(member.id)}
                  className="bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-500 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  ลบ
                </button>

                {/* ปุ่มเชื่อมต่อ Smart Watch */}
                <button
                  onClick={() => handleMockSync(member.id)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Watch className="w-3.5 h-3.5" /> เชื่อมต่อ Smart Watch
                </button>
              </div>
            </div>
          );
        })}

        {/* การ์ดเพิ่มสมาชิกใหม่แบบกล่องประปะด้านล่าง */}
        <div 
          onClick={() => setIsAddModalOpen(true)}
          className="border-2 border-dashed border-pink-200 hover:border-pink-400 bg-pink-50/30 hover:bg-pink-50/60 p-6 rounded-3xl transition cursor-pointer flex items-center gap-4"
        >
          <div className="w-14 h-14 bg-pink-400 text-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">เพิ่มสมาชิกใหม่</h3>
            <p className="text-xs text-slate-400 mt-0.5">จัดคู่ Smart watch และตั้งค่าผู้ติดต่อฉุกเฉิน</p>
          </div>
        </div>

        {members.length === 0 && (
          <div className="text-center py-10">
            <p className="text-slate-400 text-sm">ยังไม่มีสมาชิกในครอบครัว</p>
          </div>
        )}
      </div>

      {/* MODAL: รายละเอียดสมาชิก */}
      {detailMember && (
        <MemberDetailModal member={detailMember} onClose={() => setDetailMember(null)} />
      )}

      {/* MODAL: เพิ่มสมาชิกใหม่ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-pink-100">
            <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-pink-500" /> เพิ่มสมาชิกครอบครัวใหม่
            </h3>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อ - นามสกุล</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น คุณแม่ สมศรี"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ความสัมพันธ์</label>
                <select
                  value={newRelation}
                  onChange={(e) => setNewRelation(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
                >
                  <option value="คู่สมรส">คู่สมรส</option>
                  <option value="คุณพ่อ">คุณพ่อ</option>
                  <option value="คุณแม่">คุณแม่</option>
                  <option value="คุณปู่/คุณย่า/คุณตา/คุณยาย">คุณปู่/คุณย่า/คุณตา/คุณยาย</option>
                  <option value="บุตร">บุตร</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
                {newRelation === 'อื่นๆ' && (
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={50}
                    placeholder="ระบุความสัมพันธ์ เช่น พี่ชาย, หลาน"
                    value={customRelation}
                    onChange={(e) => setCustomRelation(e.target.value)}
                    className="mt-2 w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">อุปกรณ์ที่เชื่อมต่อ</label>
                <input
                  type="text"
                  placeholder="เช่น Garmin Forerunner 55"
                  value={newDevice}
                  onChange={(e) => setNewDevice(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl text-xs font-bold shadow-md shadow-pink-200 cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Party;