import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Activity, 
  Moon, 
  Edit3, 
  Plus, 
  Watch, 
  X,
  Trash2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import api from '../api.js';

export default function FamilyMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [memberDetail, setMemberDetail] = useState(null);

  // Form State เพิ่มสมาชิกใหม่
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('บุตร');

  // 1. ดึงข้อมูลสมาชิกจาก MySQL เมื่อเปิดหน้าเว็บ หรือกด F5
  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/family-members');
      setMembers(res.data);
    } catch (err) {
      console.error('Failed to fetch family members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // 2. ฟังก์ชันเพิ่มสมาชิกใหม่ (ยิง POST ไปเซฟลง MySQL)
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    try {
      const res = await api.post('/api/family-members', {
        name: newMemberName,
        relation: newMemberRelation,
      });

      setMembers([res.data, ...members]);
      setNewMemberName('');
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Failed to add family member:', err);
      alert('ไม่สามารถเพิ่มสมาชิกได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  // 3. ฟังก์ชันเปิด Modal ยืนยันการลบ
  const handleOpenDeleteModal = (member) => {
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  // 4. ฟังก์ชันยืนยันลบสมาชิก (ยิง DELETE ไปยัง MySQL)
  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;

    try {
      await api.delete(`/api/family-members/${memberToDelete.id}`);
      setMembers(members.filter((m) => m.id !== memberToDelete.id));
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
    } catch (err) {
      console.error('Failed to delete member:', err);
      alert('ไม่สามารถลบสมาชิกได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  // 5. ฟังก์ชันเปิดดูรายละเอียดสมาชิก
  const handleOpenDetailModal = (member) => {
    setMemberDetail(member);
    setIsDetailModalOpen(true);
  };

  // ฟังก์ชันเปิด Modal เชื่อมต่อ Garmin
  const handleOpenConnect = (member) => {
    setSelectedMember(member);
    setIsConnectModalOpen(true);
  };

  const handleConfirmConnect = () => {
    window.location.href = `http://localhost:8081/api/auth/garmin?memberId=${selectedMember.id}`;
  };

  // Helper สำหรับ Render สีของ Status Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ปกติ':
        return <span className="bg-emerald-100 text-emerald-600 text-xs px-3.5 py-1 rounded-full font-medium">ปกติ</span>;
      case 'อันตราย':
        return <span className="bg-rose-100 text-rose-500 text-xs px-3.5 py-1 rounded-full font-medium">อันตราย</span>;
      default:
        return <span className="bg-slate-100 text-slate-400 text-xs px-3.5 py-1 rounded-full font-medium">ไม่มีข้อมูล</span>;
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-full bg-white p-10 flex justify-center items-center text-slate-400">
        กำลังโหลดข้อมูลสมาชิก...
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-white p-6 md:p-10 font-sans text-slate-700">
      
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8 w-full">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">สมาชิกครอบครัว</h2>
          <p className="text-sm text-slate-400 mt-1">จัดการคนที่คุณ monitor ({members.length} คน)</p>
        </div>

        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-pink-400 hover:bg-pink-500 text-white px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-1.5 shadow-md shadow-pink-200 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> เพิ่มสมาชิก
        </button>
      </div>

      {/* Member Cards List */}
      <div className="space-y-4 w-full">
        {members.map((member) => (
          <div 
            key={member.id} 
            className="bg-white border border-rose-100/80 rounded-[28px] p-6 shadow-sm flex items-center justify-between hover:shadow-md transition w-full"
          >
            {/* Left Side: Avatar + Details */}
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="w-16 h-16 bg-pink-100/60 rounded-full flex items-center justify-center text-pink-500 font-extrabold text-xl shrink-0">
                {member.avatar_text || member.avatarText || member.name.charAt(0)}
              </div>

              <div>
                {/* Name + Relation */}
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-lg">{member.name}</h3>
                  <span className="bg-pink-50 text-pink-400 text-[11px] px-2.5 py-0.5 rounded-full font-medium">
                    {member.relation}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-0.5 font-light">{member.device}</p>

                {/* Health Metric Pills */}
                <div className="flex gap-2 mt-3">
                  <span className="bg-rose-50/70 text-rose-500 text-xs px-3.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
                    <Heart className="w-3.5 h-3.5 fill-rose-500" /> {member.heart_rate || member.heartRate || '-'}
                  </span>
                  <span className="bg-rose-50/70 text-rose-500 text-xs px-3.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
                    <Activity className="w-3.5 h-3.5" /> {member.steps || '-'}
                  </span>
                  <span className="bg-rose-50/70 text-rose-500 text-xs px-3.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
                    <Moon className="w-3.5 h-3.5" /> {member.sleep || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Side: Status Badge + Buttons */}
            <div className="flex flex-col items-end gap-4 shrink-0">
              {renderStatusBadge(member.status)}

              <div className="flex items-center gap-2">
                {/* 🔍 ปุ่มดูรายละเอียด */}
                <button 
                  onClick={() => handleOpenDetailModal(member)}
                  className="bg-pink-400 hover:bg-pink-500 text-white text-xs font-medium px-4 py-2 rounded-full shadow-sm shadow-pink-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" /> ดูรายละเอียด
                </button>

                {/* ✏️ ปุ่มแก้ไข */}
                <button className="bg-rose-50 hover:bg-rose-100 text-pink-400 text-xs font-medium px-4 py-2 rounded-full flex items-center gap-1 transition cursor-pointer">
                  <Edit3 className="w-3.5 h-3.5" /> แก้ไข
                </button>

                {/* 🗑️ ปุ่มลบ */}
                <button 
                  onClick={() => handleOpenDeleteModal(member)}
                  className="bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-500 text-xs font-medium px-4 py-2 rounded-full flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> ลบ
                </button>

                {/* ⌚ ปุ่มเชื่อมต่อ Garmin (ถ้ายังไม่เชื่อมต่อ) */}
                {!(member.is_connected || member.isConnected) && (
                  <button 
                    onClick={() => handleOpenConnect(member)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-4 py-2 rounded-full shadow-sm shadow-emerald-200 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Watch className="w-3.5 h-3.5" /> เชื่อมต่อ Garmin
                  </button>
                )}
              </div>
            </div>

          </div>
        ))}

        {/* Add New Member Box */}
        <div 
          onClick={() => setIsAddModalOpen(true)}
          className="border-2 border-dashed border-pink-300 rounded-[28px] p-6 flex items-center gap-5 cursor-pointer bg-pink-50/20 hover:bg-pink-50/40 transition group w-full"
        >
          <div className="w-14 h-14 bg-pink-400 group-hover:bg-pink-500 text-white rounded-full flex items-center justify-center shadow-md shadow-pink-200 transition shrink-0">
            <Plus className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-base">เพิ่มสมาชิกใหม่</h4>
            <p className="text-xs text-slate-400 mt-0.5">จัดคู่ Smart watch และตั้งผู้ติดต่อฉุกเฉิน</p>
          </div>
        </div>

      </div>

      {/* ----------------- MODAL 1: เพิ่มสมาชิกใหม่ ----------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl border border-rose-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-lg">เพิ่มสมาชิกใหม่</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อ-นามสกุล หรือ ชื่อเรียก</label>
                <input 
                  type="text" 
                  required
                  placeholder="เช่น คุณแม่, น้อง B"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ความสัมพันธ์</label>
                <select 
                  value={newMemberRelation}
                  onChange={(e) => setNewMemberRelation(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="บิดา">บิดา</option>
                  <option value="มารดา">มารดา</option>
                  <option value="บุตร">บุตร</option>
                  <option value="คู่สมรส">คู่สมรส</option>
                  <option value="ญาติ">ญาติ</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-full text-xs font-medium hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-pink-400 text-white rounded-full text-xs font-medium hover:bg-pink-500 shadow-sm shadow-pink-200 cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 2: เชื่อมต่อ GARMIN ----------------- */}
      {isConnectModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl border border-rose-100 text-center">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Watch className="w-7 h-7" />
            </div>
            
            <h3 className="font-bold text-slate-800 text-lg">เชื่อมต่อ Garmin Connect</h3>
            <p className="text-xs text-slate-400 mt-1">
              สำหรับสมาชิก: <span className="font-bold text-pink-500">{selectedMember.name}</span>
            </p>

            <div className="bg-rose-50/50 p-3.5 rounded-2xl my-4 text-xs text-slate-600 text-left space-y-1.5 border border-rose-100/60">
              <p className="font-semibold text-slate-700">สิทธิ์ที่จะได้รับการเข้าถึง:</p>
              <p>• ดึงข้อมูลอัตราการเต้นของหัวใจ (Heart Rate)</p>
              <p>• จำนวนก้าวและการนอนหลับรายวัน</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setIsConnectModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-full text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleConfirmConnect}
                className="flex-1 py-2.5 bg-emerald-500 text-white rounded-full text-xs font-medium hover:bg-emerald-600 shadow-sm shadow-emerald-200 cursor-pointer"
              >
                Connect Garmin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 3: ยืนยันการลบสมาชิก ----------------- */}
      {isDeleteModalOpen && memberToDelete && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl border border-rose-100 text-center">
            <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <h3 className="font-bold text-slate-800 text-lg">ยืนยันการลบสมาชิก</h3>
            <p className="text-xs text-slate-400 mt-1">
              คุณต้องการลบคุณ <span className="font-bold text-rose-500">{memberToDelete.name}</span> ออกจากรายการใช่หรือไม่?
            </p>

            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-full text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-500 text-white rounded-full text-xs font-medium hover:bg-rose-600 shadow-sm shadow-rose-200 cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL 4: รายละเอียดข้อมูลสมาชิก ----------------- */}
      {isDetailModalOpen && memberDetail && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-rose-100">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-pink-100/60 rounded-full flex items-center justify-center text-pink-500 font-extrabold text-lg">
                  {memberDetail.avatar_text || memberDetail.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{memberDetail.name}</h3>
                  <span className="text-xs text-pink-400 bg-pink-50 px-2 py-0.5 rounded-full font-medium">
                    ความสัมพันธ์: {memberDetail.relation}
                  </span>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* รายละเอียดสุขภาพ */}
            <div className="space-y-3">
              <div className="bg-rose-50/40 p-4 rounded-2xl flex justify-between items-center border border-rose-100/50">
                <span className="text-xs text-slate-500 font-medium">อุปกรณ์ที่เชื่อมต่อ</span>
                <span className="text-xs font-bold text-slate-700">{memberDetail.device}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-rose-50/50 p-3 rounded-2xl text-center border border-rose-100/60">
                  <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1 fill-rose-500" />
                  <p className="text-[10px] text-slate-400">อัตราการเต้นหัวใจ</p>
                  <p className="text-sm font-bold text-rose-600 mt-0.5">{memberDetail.heart_rate || memberDetail.heartRate || '-'}</p>
                </div>

                <div className="bg-rose-50/50 p-3 rounded-2xl text-center border border-rose-100/60">
                  <Activity className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-400">จำนวนก้าวเดิน</p>
                  <p className="text-sm font-bold text-rose-600 mt-0.5">{memberDetail.steps || '-'}</p>
                </div>

                <div className="bg-rose-50/50 p-3 rounded-2xl text-center border border-rose-100/60">
                  <Moon className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-400">ระยะเวลานอน</p>
                  <p className="text-sm font-bold text-rose-600 mt-0.5">{memberDetail.sleep || '-'}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center mt-2">
                <span className="text-xs text-slate-500 font-medium">สถานะสุขภาพโดยรวม</span>
                {renderStatusBadge(memberDetail.status)}
              </div>
            </div>

            <button 
              onClick={() => setIsDetailModalOpen(false)}
              className="w-full mt-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-medium transition cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

    </div>
  );
}