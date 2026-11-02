import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Heart, 
  Activity, 
  Moon, 
  Plus, 
  Watch, 
  X,
  Trash2,
  AlertTriangle,
  FileText,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  Play,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import api from '../api.js';

export default function FamilyMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [mockingId, setMockingId] = useState(null);
  const [isDevMode, setIsDevMode] = useState(false);
  
  // Multi-Member Auto Mocking State { [memberId]: intervalId }
  const [autoMockMap, setAutoMockMap] = useState({});

  // Modal States
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [memberDetail, setMemberDetail] = useState(null);

  // Selected Brand State in Connect Modal
  const [selectedBrand, setSelectedBrand] = useState('garmin');

  // Dashboard Modes & History States
  const [viewMode, setViewMode] = useState('realtime');
  const [history7Days, setHistory7Days] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hrHistoryMap, setHrHistoryMap] = useState({});

  // Form State เพิ่มสมาชิกใหม่
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('บุตร');

  const location = useLocation();

  const parseStepsNumber = (val) => {
    if (!val || val === '-') return 0;
    const cleaned = String(val).replace(/,/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parseSleepNumber = (val) => {
    if (!val || val === '-') return 0;
    const parsed = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

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

    const queryParams = new URLSearchParams(location.search);
    const status = queryParams.get('status');

    if (status === 'success') {
      alert('🎉 เชื่อมต่อบัญชี Garmin Connect เรียบร้อยแล้ว!');
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchMembers();
    } else if (status === 'error') {
      alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ Garmin Connect กรุณาลองใหม่อีกครั้ง');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  // เคลียร์ Timer ทั้งหมดเมื่อ Unmount
  useEffect(() => {
    return () => {
      Object.values(autoMockMap).forEach((intervalId) => clearInterval(intervalId));
    };
  }, [autoMockMap]);

  // คีย์ลัด Ctrl + Shift + D สลับ Dev Mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDevMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Mock Data 1 ครั้ง
  const handleMockSync = async (member, customPayload = null) => {
    try {
      setMockingId(member.id);
      const res = await api.post(`/api/garmin/mock-sync/${member.id}`, customPayload || {});
      
      if (res.data && res.data.data) {
        const newHrStr = res.data.data.heartRate;
        const hrVal = parseInt(newHrStr) || 75;
        const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setHrHistoryMap((prev) => {
          const currentList = prev[member.id] || [
            { time: '10:00:00', hr: 72 },
            { time: '10:00:03', hr: 75 },
          ];
          const updated = [...currentList, { time: timeStr, hr: hrVal }].slice(-12);
          return { ...prev, [member.id]: updated };
        });

        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id
              ? {
                  ...m,
                  heart_rate: res.data.data.heartRate,
                  steps: res.data.data.steps,
                  sleep: res.data.data.sleep,
                  status: res.data.data.status,
                }
              : m
          )
        );

        if (memberDetail && memberDetail.id === member.id) {
          setMemberDetail((prev) => ({
            ...prev,
            heart_rate: res.data.data.heartRate,
            steps: res.data.data.steps,
            sleep: res.data.data.sleep,
            status: res.data.data.status,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to mock data:', err);
    } finally {
      setMockingId(null);
    }
  };

  // 2. Toggle Auto Mock รายคน
  const handleToggleAutoMock = async (member) => {
    const memberId = member.id;
    const existingInterval = autoMockMap[memberId];

    if (existingInterval) {
      clearInterval(existingInterval);
      setAutoMockMap((prev) => {
        const copy = { ...prev };
        delete copy[memberId];
        return copy;
      });

      try {
        await api.post(`/api/garmin/stop-mock/${memberId}`);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId
              ? { ...m, heart_rate: '-', steps: '-', sleep: '-', status: 'ไม่มีข้อมูล' }
              : m
          )
        );
      } catch (e) {
        console.error(e);
      }
      return;
    }

    handleMockSync(member);
    const newInterval = setInterval(() => {
      handleMockSync(member);
    }, 3000);

    setAutoMockMap((prev) => ({
      ...prev,
      [memberId]: newInterval,
    }));
  };

  // 3. Toggle Mock ทุกคนพร้อมกัน
  const handleToggleAllMock = () => {
    const isAllRunning = members.every((m) => autoMockMap[m.id]);

    if (isAllRunning) {
      members.forEach((m) => {
        if (autoMockMap[m.id]) clearInterval(autoMockMap[m.id]);
      });
      setAutoMockMap({});
    } else {
      const newMap = { ...autoMockMap };
      members.forEach((m) => {
        if (!newMap[m.id]) {
          handleMockSync(m);
          newMap[m.id] = setInterval(() => {
            handleMockSync(m);
          }, 3000);
        }
      });
      setAutoMockMap(newMap);
    }
  };

  const handleOpenDetailModal = async (member) => {
    setMemberDetail(member);
    setViewMode('realtime');
    setIsDetailModalOpen(true);
    setLoadingHistory(true);

    try {
      const res = await api.get(`/api/family-members/${member.id}/history`);
      setHistory7Days(res.data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // เพิ่มสมาชิกใหม่
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
      alert('ไม่สามารถเพิ่มสมาชิกได้');
    }
  };

  // ลบสมาชิก
  const handleOpenDeleteModal = (member) => {
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;

    try {
      await api.delete(`/api/family-members/${memberToDelete.id}`);
      setMembers(members.filter((m) => m.id !== memberToDelete.id));
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
    } catch (err) {
      console.error('Failed to delete member:', err);
      alert('ไม่สามารถลบสมาชิกได้');
    }
  };

  // Connect Smart Watch
  const handleOpenConnect = (member) => {
    setSelectedMember(member);
    setSelectedBrand('garmin');
    setIsConnectModalOpen(true);
  };

  const handleConfirmConnect = async () => {
    if (!selectedMember) return;

    if (selectedBrand === 'garmin') {
      try {
        const res = await api.get(`/api/garmin/connect/${selectedMember.id}`);
        if (res.data && res.data.url) {
          window.location.href = res.data.url;
        }
      } catch (err) {
        alert('ไม่สามารถเริ่มการเชื่อมต่อได้');
      }
    } else {
      alert(`การเชื่อมต่อกับ ${selectedBrand.toUpperCase()} ยังไม่เปิดให้บริการในขณะนี้`);
    }
  };

  const handleSync = async (member) => {
    try {
      setSyncingId(member.id);
      const res = await api.post(`/api/garmin/sync/${member.id}`);

      if (res.data.member) {
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, ...res.data.member } : m))
        );
      }
      if (res.data.message) alert(res.data.message);
    } catch (err) {
      alert(err.response?.data?.error || 'ซิงค์ข้อมูลไม่สำเร็จ');
    } finally {
      setSyncingId(null);
    }
  };

  const getRealtimeHrData = (memberId) => {
    return hrHistoryMap[memberId] || [
      { time: '10:00:00', hr: 72 },
      { time: 'ปัจจุบัน', hr: 76 }
    ];
  };

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

  const hasHealthData = (m) => [m.heart_rate, m.steps, m.sleep].some((v) => v && v !== '-');

  const noDataReason = (m) =>
    m.is_connected || m.isConnected
      ? 'ยังไม่ได้ซิงค์กับนาฬิกา'
      : 'ยังไม่ได้เชื่อมต่อ Smart Watch';

  if (loading) {
    return <div className="w-full min-h-full bg-white p-10 flex justify-center items-center text-slate-400">กำลังโหลด...</div>;
  }

  return (
    <div className="w-full min-h-full bg-white p-6 md:p-10 font-sans text-slate-700">
      
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8 w-full">
        <div>
          <h2 
            onDoubleClick={() => setIsDevMode(!isDevMode)}
            className="text-3xl font-extrabold text-slate-800 tracking-tight cursor-pointer select-none transition-colors hover:text-slate-700"
            title="Double click to toggle Dev Mode"
          >
            สมาชิกครอบครัว 
            {isDevMode && (
              <span className="text-xs ml-2 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-normal border border-amber-200 inline-block align-middle">
                🧪 Dev Mode Active
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-1">จัดการคนที่คุณ monitor ({members.length} คน)</p>
        </div>

        <div className="flex gap-2">
          {isDevMode && (
            <button 
              onClick={handleToggleAllMock}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-full text-sm font-medium flex items-center gap-1.5 shadow-md shadow-amber-200 transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              {members.length > 0 && members.every((m) => autoMockMap[m.id]) ? '⏹️ หยุด Mock ทุกคน' : '▶️ Mock ทุกคนพร้อมกัน'}
            </button>
          )}

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-pink-400 hover:bg-pink-500 text-white px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-1.5 shadow-md shadow-pink-200 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> เพิ่มสมาชิก
          </button>
        </div>
      </div>

      {/* Member Cards List */}
      <div className="space-y-4 w-full">
        {members.map((member) => (
          <div 
            key={member.id} 
            className={`bg-white border rounded-[28px] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between transition w-full gap-4 ${
              member.status === 'อันตราย' ? 'border-rose-300 bg-rose-50/20' : 'border-rose-100/80'
            }`}
          >
            {/* Left Side */}
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-pink-100/60 rounded-full flex items-center justify-center text-pink-500 font-extrabold text-xl shrink-0">
                {member.avatar_text || member.avatarText || member.name.charAt(0)}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-lg">{member.name}</h3>
                  <span className="bg-pink-50 text-pink-400 text-[11px] px-2.5 py-0.5 rounded-full font-medium">
                    {member.relation}
                  </span>
                </div>

                {/* แก้ไขส่วนแสดงชื่อนาฬิกาตรงนี้ */}
                <p className="text-xs text-slate-400 mt-0.5 font-light">
                  {member.is_connected || member.isConnected 
                    ? (member.device || 'Garmin Smartwatch') 
                    : 'ยังไม่ได้เชื่อมต่ออุปกรณ์'}
                </p>

                {hasHealthData(member) ? (
                  <div className="flex gap-2 mt-3 flex-wrap">
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
                ) : (
                  <div className="flex gap-2 mt-3">
                    <span className="bg-slate-100 text-slate-400 text-xs px-3.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
                      <Watch className="w-3.5 h-3.5" /> ไม่มีข้อมูล · {noDataReason(member)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side */}
            <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto">
              {renderStatusBadge(member.status)}

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button 
                  onClick={() => handleOpenDetailModal(member)}
                  className="bg-pink-400 hover:bg-pink-500 text-white text-xs font-medium px-4 py-2 rounded-full shadow-sm shadow-pink-200 transition flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" /> ดูรายละเอียด
                </button>

                <button 
                  onClick={() => handleOpenDeleteModal(member)}
                  className="bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-500 text-xs font-medium px-4 py-2 rounded-full flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> ลบ
                </button>

                {member.is_connected || member.isConnected ? (
                  <>
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> เชื่อมต่อแล้ว
                    </span>
                    <button
                      onClick={() => handleSync(member)}
                      disabled={syncingId === member.id}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-medium px-4 py-2 rounded-full shadow-sm shadow-emerald-200 transition flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingId === member.id ? 'animate-spin' : ''}`} />
                      {syncingId === member.id ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูล'}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => handleOpenConnect(member)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-4 py-2 rounded-full shadow-sm shadow-emerald-200 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Watch className="w-3.5 h-3.5" /> เชื่อมต่อ Smart Watch
                  </button>
                )}
              </div>

              {/* DEV MODE CONTROLS */}
              {isDevMode && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 bg-amber-50/80 p-2 rounded-2xl border-dashed border-amber-300">
                  <span className="text-[10px] font-bold text-amber-700 px-1">MOCK:</span>
                  
                  <button
                    onClick={() => handleToggleAutoMock(member)}
                    className={`text-[11px] font-medium px-3.5 py-1 rounded-full transition flex items-center gap-1 cursor-pointer shadow-sm ${
                      autoMockMap[member.id]
                        ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                        : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${autoMockMap[member.id] ? 'animate-spin' : ''}`} />
                    {autoMockMap[member.id] ? '⏹️ หยุด Auto Mock' : '▶️ เริ่ม Auto Mock (3s)'}
                  </button>

                  <button
                    onClick={() => handleMockSync(member, { heart_rate: '145 bpm', status: 'อันตราย' })}
                    disabled={mockingId === member.id}
                    className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-[11px] font-medium px-3 py-1 rounded-full transition flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <AlertTriangle className="w-3 h-3" /> จำลองอันตราย
                  </button>
                </div>
              )}

            </div>
          </div>
        ))}

        {/* ปุ่มการ์ดเส้นประเพิ่มสมาชิกใหม่ (ด้านล่างสุด) */}
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

      {/* MODAL 1: เพิ่มสมาชิกใหม่ */}
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

      {/* MODAL 2: เลือกแบรนด์และเชื่อมต่อ Smart Watch */}
      {isConnectModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50/95 rounded-[32px] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-rose-100 font-sans">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Watch className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-xl">เชื่อมต่อ Smart Watch</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    สำหรับสมาชิก: <span className="font-bold text-pink-500">{selectedMember.name}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsConnectModalOpen(false)} 
                className="w-9 h-9 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 rounded-full flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">เลือกแบรนด์นาฬิกาที่ต้องการเชื่อมต่อ</p>

            <div className="space-y-3 mb-6">
              <div 
                onClick={() => setSelectedBrand('garmin')}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  selectedBrand === 'garmin' 
                    ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-400/20' 
                    : 'bg-white/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xs tracking-tighter">
                    GARMIN
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Garmin Connect</h4>
                    <p className="text-[11px] text-slate-400">ซิงค์อัตราการเต้นหัวใจ ก้าวเดิน และการนอนหลับ</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedBrand === 'garmin' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                }`}>
                  {selectedBrand === 'garmin' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-100/60 opacity-60 flex items-center justify-between cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center font-bold text-xs">
                    🍎
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 text-sm">Apple Watch</h4>
                    <p className="text-[11px] text-slate-400">Apple HealthKit Integration</p>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-500 font-medium px-2 py-0.5 rounded-full">
                  เร็วๆ นี้
                </span>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-100/60 opacity-60 flex items-center justify-between cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center font-bold text-xs">
                    FITBIT
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 text-sm">Fitbit</h4>
                    <p className="text-[11px] text-slate-400">Fitbit Web API Integration</p>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-500 font-medium px-2 py-0.5 rounded-full">
                  เร็วๆ นี้
                </span>
              </div>
            </div>

            <div className="bg-rose-50/60 p-4 rounded-2xl mb-6 text-xs text-slate-600 space-y-1 border border-rose-100">
              <p className="font-semibold text-slate-700 mb-1">สิทธิ์การเข้าถึงข้อมูลเมื่อเชื่อมต่อ:</p>
              <p>• ดึงข้อมูลอัตราการเต้นของหัวใจ (Heart Rate) แบบ Real-time</p>
              <p>• ดึงข้อมูลสถิติจำนวนก้าวและชั่วโมงการนอนหลับรายวัน</p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsConnectModalOpen(false)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-full text-xs font-semibold hover:bg-white transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleConfirmConnect}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-semibold shadow-md shadow-emerald-200 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                ดำเนินการเชื่อมต่อ <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ยืนยันการลบสมาชิก */}
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

      {/* MODAL 4: รายละเอียดข้อมูลสุขภาพเชิงลึก */}
      {isDetailModalOpen && memberDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-50/90 rounded-[32px] p-6 md:p-8 max-w-4xl w-full shadow-2xl border border-rose-100 max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2 bg-pink-100/50 p-1.5 rounded-full w-fit">
                <button
                  onClick={() => setViewMode('realtime')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    viewMode === 'realtime' ? 'bg-pink-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  🔴 ปัจจุบัน (Real-time)
                </button>
                <button
                  onClick={() => setViewMode('7days')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    viewMode === '7days' ? 'bg-pink-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  📅 ย้อนหลัง 7 วัน
                </button>
              </div>

              <div className="flex items-center gap-3 self-end md:self-auto">
                <div className="text-right">
                  <h3 className="font-bold text-slate-800 text-lg">{memberDetail.name}</h3>
                  <span className="text-[11px] text-pink-500 bg-pink-50 px-2.5 py-0.5 rounded-full font-medium">
                    {memberDetail.relation}
                  </span>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="w-9 h-9 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 rounded-full flex items-center justify-center cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Top 3 Dynamic Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-5 rounded-3xl border border-pink-100 shadow-sm">
                <p className="text-xs text-slate-400 font-medium">{viewMode === 'realtime' ? 'ชีพจรปัจจุบัน' : 'ชีพจรเฉลี่ย (7 วัน)'}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-800">
                    {viewMode === 'realtime' 
                      ? (memberDetail.heart_rate || '76 bpm')
                      : (() => {
                          const validHrs = history7Days.filter(d => d.hr > 0);
                          if (validHrs.length === 0) return '0 bpm';
                          return `${Math.round(validHrs.reduce((acc, curr) => acc + curr.hr, 0) / validHrs.length)} bpm`;
                        })()
                    }
                  </span>
                </div>
                <span className={`text-[11px] font-medium mt-2 inline-block px-2.5 py-0.5 rounded-full ${memberDetail.status === 'อันตราย' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {memberDetail.status || 'ช่วงปกติ'}
                </span>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-pink-100 shadow-sm">
                <p className="text-xs text-slate-400 font-medium">{viewMode === 'realtime' ? 'ก้าววันนี้' : 'ก้าวเฉลี่ย / วัน'}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-800">
                    {viewMode === 'realtime' 
                      ? parseStepsNumber(memberDetail?.steps).toLocaleString()
                      : (() => {
                          const validSteps = history7Days.filter(d => d.steps > 0);
                          if (validSteps.length === 0) return '0';
                          return Math.round(validSteps.reduce((acc, curr) => acc + curr.steps, 0) / validSteps.length).toLocaleString();
                        })()
                    }
                  </span>
                </div>

                {(() => {
                  const validDays = history7Days.filter(d => d.steps > 0);
                  if (validDays.length <= 1) {
                    return <span className="text-[11px] text-slate-400 font-medium mt-2 inline-block">เป้าหมาย 10,000 ก้าว/วัน</span>;
                  }
                  const todaySteps = parseStepsNumber(memberDetail?.steps);
                  const prevAvg = validDays.reduce((acc, curr) => acc + curr.steps, 0) / validDays.length;
                  const diffPercent = prevAvg > 0 ? Math.round(((todaySteps - prevAvg) / prevAvg) * 100) : 0;
                  return (
                    <span className={`text-[11px] font-medium mt-2 inline-flex items-center gap-0.5 ${diffPercent >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      <ArrowUpRight className={`w-3.5 h-3.5 ${diffPercent < 0 ? 'rotate-90' : ''}`} /> 
                      {Math.abs(diffPercent)}% จากค่าเฉลี่ย
                    </span>
                  );
                })()}
              </div>

              <div className="bg-white p-5 rounded-3xl border border-pink-100 shadow-sm">
                <p className="text-xs text-slate-400 font-medium">{viewMode === 'realtime' ? 'การนอนล่าสุด' : 'การนอนเฉลี่ย (7 วัน)'}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-800">
                    {viewMode === 'realtime' 
                      ? (memberDetail.sleep && memberDetail.sleep !== '-' ? memberDetail.sleep : '0 ชม.')
                      : (() => {
                          const validSleeps = history7Days.filter(d => d.sleep > 0);
                          if (validSleeps.length === 0) return '0 ชม.';
                          return `${(validSleeps.reduce((acc, curr) => acc + curr.sleep, 0) / validSleeps.length).toFixed(1)} ชม.`;
                        })()
                    }
                  </span>
                </div>

                {(() => {
                  const sleepHours = viewMode === 'realtime'
                    ? parseSleepNumber(memberDetail?.sleep)
                    : (() => {
                        const valid = history7Days.filter(d => d.sleep > 0);
                        return valid.length > 0 ? valid.reduce((a, b) => a + b.sleep, 0) / valid.length : 0;
                      })();

                  if (sleepHours === 0) return <span className="text-[11px] text-slate-400 font-medium mt-2 inline-block">ไม่มีข้อมูลการนอน</span>;
                  return sleepHours >= 7 ? (
                    <span className="text-[11px] text-emerald-600 font-medium mt-2 inline-block">✓ ตามเป้าหมาย (≥ 7 ชม.)</span>
                  ) : (
                    <span className="text-[11px] text-amber-600 font-medium mt-2 inline-block">⚠ ต่ำกว่าเป้า 7 ชม.</span>
                  );
                })()}
              </div>
            </div>

            {/* Graphs Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-pink-100 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-pink-500" />
                      {viewMode === 'realtime' ? 'แนวโน้มชีพจร Real-time' : 'แนวโน้มชีพจร 7 วันย้อนหลัง'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">{viewMode === 'realtime' ? 'ข้อมูลอัปเดตแบบเรียลไทม์' : 'ค่าเฉลี่ยรายวัน (bpm)'}</p>
                  </div>
                  <span className="bg-pink-50 text-pink-500 text-xs px-3 py-1 rounded-full font-bold border border-pink-100">
                    {viewMode === 'realtime' ? `ล่าสุด: ${memberDetail.heart_rate || '76 bpm'}` : 'ประวัติ 7 วัน'}
                  </span>
                </div>

                <div className="w-full h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={viewMode === 'realtime' ? getRealtimeHrData(memberDetail.id) : history7Days}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey={viewMode === 'realtime' ? 'time' : 'day'} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(val) => [`${val} bpm`, 'ชีพจร']} />
                      <Line type="monotone" dataKey="hr" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} isAnimationActive={viewMode !== 'realtime'} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-pink-100 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-base">การนอนหลับ (ชม.)</h4>
                  <p className="text-xs text-slate-400 mt-0.5">เป้าหมาย 7 ชม./คืน</p>
                </div>

                <div className="w-full h-48 mt-4">
                  {loadingHistory ? (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">กำลังโหลด...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={history7Days}>
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis hide domain={[0, 10]} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(val) => [`${val} ชม.`, 'เวลานอน']} />
                        <Bar dataKey="sleep" fill="#fb7185" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <button onClick={() => setIsDetailModalOpen(false)} className="w-full mt-6 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-full text-xs font-semibold shadow-md cursor-pointer">
              ปิดหน้าต่างรายละเอียด
            </button>
          </div>
        </div>
      )}

    </div>
  );
}