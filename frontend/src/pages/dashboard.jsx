import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { Phone, Plus, Edit3, X, PhoneCall, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

function Dashboard() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [realtimeHrData, setRealtimeHrData] = useState([]);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  // States สำหรับ Modal เบอร์ฉุกเฉิน
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const fetchMembers = async (isInitial = false) => {
    try {
      const res = await api.get('/api/family-members');
      setMembers(res.data);
      
      if (res.data.length > 0) {
        setSelectedMemberId(prevId => {
          const exists = res.data.find(m => m.id === prevId);
          if (!prevId || !exists) {
            setMemberData(res.data[0]);
            return res.data[0].id;
          } else {
            setMemberData(exists);
            return prevId;
          }
        });
      }
      if (isInitial) setLoading(false);
    } catch (err) {
      console.error("Error fetching members:", err);
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers(true);
  }, []);

  useEffect(() => {
    if (!selectedMemberId) return;

    const fetchDashboardData = async () => {
      try {
        const membersRes = await api.get('/api/family-members');
        const updatedMembers = membersRes.data;
        setMembers(updatedMembers);

        const currentMember = updatedMembers.find(m => m.id === Number(selectedMemberId));
        if (currentMember) {
          setMemberData(currentMember);
        }

        const hrRes = await api.get(`/api/family-members/${selectedMemberId}/realtime-hr`);
        setRealtimeHrData(hrRes.data);

        // ดึงรายการนัดหมายที่เรียงจากใกล้ปัจจุบันที่สุด (ตัวแรกสุดคือใกล้สุด)
        const appRes = await api.get(`/api/family-members/${selectedMemberId}/appointments`);
        if (appRes.data && appRes.data.length > 0) {
          setNextAppointment(appRes.data[0]);
        } else {
          setNextAppointment(null);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      }
    };

    fetchDashboardData();

    const interval = setInterval(fetchDashboardData, 3000);
    return () => clearInterval(interval);
  }, [selectedMemberId]);

  const handleMemberChange = (e) => {
    const memberId = Number(e.target.value);
    setSelectedMemberId(memberId);
    const found = members.find(m => m.id === memberId);
    if (found) setMemberData(found);
  };

  const handleOpenEmergencyModal = () => {
    setEmergencyName(memberData?.emergency_contact_name || '');
    setEmergencyPhone(memberData?.emergency_contact_phone || '');
    setIsEmergencyModalOpen(true);
  };

  const handleSaveEmergency = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/family-members/${selectedMemberId}/emergency-contact`, {
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone
      });

      setMemberData(prev => ({
        ...prev,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone
      }));

      setIsEmergencyModalOpen(false);
    } catch (err) {
      console.error("Save emergency contact error:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลเบอร์โทรฉุกเฉิน");
    }
  };

  if (loading) {
    return <div className="p-10 text-slate-400">กำลังโหลดข้อมูลแดชบอร์ด...</div>;
  }

  if (members.length === 0) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-bold text-slate-800">ยังไม่มีสมาชิกในครอบครัว</h2>
        <p className="text-slate-400 mt-2">กรุณาเพิ่มสมาชิกก่อนดูข้อมูลแดชบอร์ด</p>
      </div>
    );
  }

  return (
    <section className="p-6 md:p-10 bg-slate-50 min-h-screen font-sans">
      
      {/* ส่วนเลือกสมาชิก */}
      <div className="flex justify-between items-center mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{memberData?.name}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {memberData?.device || 'ยังไม่ได้เชื่อมต่ออุปกรณ์'} • ความสัมพันธ์: {memberData?.relation}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={selectedMemberId || ''} 
            onChange={handleMemberChange}
            className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-300 cursor-pointer"
          >
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.relation})
              </option>
            ))}
          </select>

          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
            memberData?.status === 'ปกติ' ? 'bg-emerald-100 text-emerald-600' :
            memberData?.status === 'อันตราย' ? 'bg-rose-100 text-rose-500' : 'bg-slate-100 text-slate-400'
          }`}>
            {memberData?.status || 'ไม่มีข้อมูล'}
          </span>
        </div>
      </div>

      {/* แผงแสดงค่าสุขภาพหลัก */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-pink-50/70 p-6 rounded-3xl border border-pink-100 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-slate-600 font-medium text-sm">ชีพจรปัจจุบัน</span>
            <span className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-pink-500 shadow-sm">❤️</span>
          </div>
          <div className="my-4">
            <span className="text-5xl font-extrabold text-slate-800">
              {memberData?.heart_rate && memberData.heart_rate !== '-' ? memberData.heart_rate.replace(' bpm', '') : '0'}
            </span>
            <span className="ml-2 text-slate-500 font-medium">BPM</span>
          </div>
          <span className="inline-block bg-white text-pink-600 text-xs px-3 py-1 rounded-full w-fit font-medium shadow-sm">
            ช่วงปกติ 60 – 100
          </span>
        </div>

        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400 font-medium">ก้าวเดิน</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{memberData?.steps || '0'} <span className="text-xs font-normal text-slate-500">ก้าว</span></p>
            </div>
            <div className="w-9 h-9 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center text-sm font-bold">👟</div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400 font-medium">การนอน</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{memberData?.sleep || '0'} <span className="text-xs font-normal text-slate-500">ชม.</span></p>
            </div>
            <div className="w-9 h-9 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center text-sm font-bold">🌙</div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400 font-medium">ความเครียด</p>
              <p className="text-xl font-bold text-slate-800 mt-1">42 <span className="text-xs font-normal text-slate-500">ระดับต่ำ</span></p>
            </div>
            <div className="w-9 h-9 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center text-sm font-bold">🧘</div>
          </div>

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400 font-medium">ออกซิเจนในเลือด</p>
              <p className="text-xl font-bold text-slate-800 mt-1">98 <span className="text-xs font-normal text-slate-500">%</span></p>
            </div>
            <div className="w-9 h-9 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center text-sm font-bold">⭕</div>
          </div>
        </div>
      </div>

      {/* กราฟชีพจร Real-time */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">ชีพจรปัจจุบัน (Real-time)</h3>
            <p className="text-xs text-slate-400 mt-0.5">อัปเดตอัตราการเต้นหัวใจแบบสดๆ ตามสมาชิกที่เลือก</p>
          </div>
          <span className="bg-pink-50 text-pink-500 text-xs px-3.5 py-1 rounded-full font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping"></span> Live Streaming
          </span>
        </div>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={realtimeHrData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(val) => [`${val} bpm`, 'ชีพจร']} />
              <Line type="monotone" dataKey="bpm" stroke="#ec4899" strokeWidth={3} dot={{ fill: '#ec4899', strokeWidth: 2, r: 5, stroke: '#fff' }} activeDot={{ r: 7 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ส่วนนัดหมายถัดไป และ ผู้ติดต่อฉุกเฉิน */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* การนัดหมายถัดไป */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1">
              <h4 className="font-bold text-slate-800 text-base">นัดหมายถัดไป</h4>
              <button 
                onClick={() => navigate('/appointments')} 
                className="text-xs text-pink-500 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                ดูทั้งหมด <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {nextAppointment ? (
              <div className="mt-4">
                <p className="text-pink-500 font-extrabold text-lg">
                  {nextAppointment.appointment_date} • {nextAppointment.appointment_time} น.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {nextAppointment.doctor_name} • {nextAppointment.hospital_name}
                </p>
              </div>
            ) : (
              <div className="mt-6 text-center py-6 border-2 border-dashed border-pink-200 rounded-2xl bg-pink-50/30">
                <p className="text-xs text-slate-400 mb-3">ยังไม่มีรายการนัดหมายแพทย์สำหรับสมาชิกคนนี้</p>
                <button 
                  onClick={() => navigate('/appointments')}
                  className="bg-pink-400 hover:bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> สร้างนัดหมายใหม่
                </button>
              </div>
            )}
          </div>

          {nextAppointment && (
            <div className="mt-6 flex justify-between items-center">
              <span className="inline-block bg-pink-50 text-pink-500 text-xs px-3.5 py-1 rounded-full font-medium">
                {nextAppointment.reminder_note}
              </span>
              <button 
                onClick={() => navigate('/appointments')} 
                className="text-xs text-slate-400 hover:text-pink-500 cursor-pointer flex items-center gap-1 font-medium"
              >
                <Edit3 className="w-3.5 h-3.5" /> จัดการนัดหมาย
              </button>
            </div>
          )}
        </div>

        {/* ผู้ติดต่อฉุกเฉิน */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-800 text-base mb-1">ผู้ติดต่อฉุกเฉิน</h4>
            {memberData?.emergency_contact_phone ? (
              <div className="mt-4">
                <p className="font-bold text-slate-800 text-base">
                  {memberData.emergency_contact_name}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {memberData.emergency_contact_phone}
                </p>
              </div>
            ) : (
              <div className="mt-6 text-center py-6 border-2 border-dashed border-pink-200 rounded-2xl bg-pink-50/30">
                <p className="text-xs text-slate-400 mb-3">ยังไม่มีข้อมูลเบอร์โทรฉุกเฉิน</p>
                <button 
                  onClick={handleOpenEmergencyModal}
                  className="bg-pink-400 hover:bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> เพิ่มเบอร์โทรฉุกเฉิน
                </button>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex justify-between items-center">
            {memberData?.emergency_contact_phone ? (
              <>
                <button onClick={handleOpenEmergencyModal} className="text-xs text-slate-400 hover:text-pink-500 cursor-pointer flex items-center gap-1 font-medium">
                  <Edit3 className="w-3.5 h-3.5" /> แก้ไขข้อมูล
                </button>
                <a 
                  href={`tel:${memberData.emergency_contact_phone}`}
                  className="bg-pink-400 hover:bg-pink-500 text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-md shadow-pink-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 fill-white" /> โทร
                </a>
              </>
            ) : (
              <div className="w-full flex justify-end">
                <button onClick={handleOpenEmergencyModal} className="text-xs text-slate-400 hover:text-pink-500 cursor-pointer flex items-center gap-1 font-medium">
                  <Edit3 className="w-3.5 h-3.5" /> เพิ่มข้อมูล
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL: เพิ่ม/แก้ไขเบอร์ฉุกเฉิน */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-pink-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-pink-500" /> เพิ่ม/แก้ไขเบอร์ฉุกเฉิน
              </h3>
              <button onClick={() => setIsEmergencyModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmergency} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ชื่อผู้ติดต่อ</label>
                <input type="text" required placeholder="เช่น คุณแม่ (ภรรยา)" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">เบอร์โทรศัพท์</label>
                <input type="tel" required placeholder="เช่น 081-234-5678" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsEmergencyModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-full text-xs font-semibold hover:bg-slate-50 cursor-pointer">ยกเลิก</button>
                <button type="submit" className="flex-1 py-2.5 bg-pink-400 hover:bg-pink-500 text-white rounded-full text-xs font-semibold shadow-md shadow-pink-200 cursor-pointer">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  );
}

export default Dashboard;