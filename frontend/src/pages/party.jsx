import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  ChevronRight,
  User,
  ExternalLink,
  CalendarHeart,
  Phone,
  PhoneCall,
  Clock,
  Wifi,
  WifiOff
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

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateKey = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return key;
  return `${d} ${THAI_MONTHS[m - 1]} ${y}`;
};

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

function InfoRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-semibold text-slate-700">{children}</span>
    </div>
  );
}

export default function Party2() {
  const navigate = useNavigate();
  const location = useLocation();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [mockingId, setMockingId] = useState(null);
  const [isDevMode, setIsDevMode] = useState(false);
  
  const [autoMockMap, setAutoMockMap] = useState({});

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [selectedMember, setSelectedMember] = useState(null);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [memberDetail, setMemberDetail] = useState(null);

  const [selectedBrand, setSelectedBrand] = useState('garmin');

  const [viewMode, setViewMode] = useState('realtime');
  const [history7Days, setHistory7Days] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hrHistoryMap, setHrHistoryMap] = useState({});

  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('คู่สมรส');
  const [customRelation, setCustomRelation] = useState('');
  const [newDevice, setNewDevice] = useState('Garmin Smartwatch');

  const [nextAppointment, setNextAppointment] = useState(undefined);

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

  // ตรวจสอบว่ามีข้อมูลสุขภาพจริงหรือไม่
  const hasHealthData = (m) => {
    if (!m) return false;
    const hr = m.heart_rate || m.heartRate;
    return Boolean(m.is_connected || m.isConnected) && [hr, m.steps, m.sleep].some((v) => v && v !== '-');
  };

  const generateMockHealthData = (currentMember) => {
    const randomHr = Math.floor(Math.random() * (110 - 65 + 1)) + 65;
    const currentSteps = parseStepsNumber(currentMember?.steps);
    const newSteps = (currentSteps + Math.floor(Math.random() * 21) + 5).toLocaleString();
    const sleepVal = currentMember?.sleep && currentMember.sleep !== '-' 
      ? currentMember.sleep 
      : `${(7 + Math.random() * 0.5).toFixed(1)} ชม.`;
    const status = randomHr > 100 ? 'อันตราย' : 'ปกติ';

    return {
      heartRate: `${randomHr} bpm`,
      heartRateNum: randomHr,
      steps: `${newSteps} ก้าว`,
      sleep: sleepVal,
      status: status
    };
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/family-members');
      setMembers(res.data || []);
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

  useEffect(() => {
    return () => {
      Object.values(autoMockMap).forEach((intervalId) => clearInterval(intervalId));
    };
  }, [autoMockMap]);

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

  useEffect(() => {
    if (!memberDetail) return;
    let ignore = false;
    api.get(`/api/family-members/${memberDetail.id}/appointments`)
      .then((res) => {
        if (ignore) return;
        const today = todayKey();
        const upcoming = res.data
          .filter((a) => a.appointment_date >= today)
          .sort((a, b) => `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`));
        setNextAppointment(upcoming[0] ?? null);
      })
      .catch(() => !ignore && setNextAppointment(null));
    return () => { ignore = true; };
  }, [memberDetail]);

  const handleMockSync = async (member, customPayload = null) => {
    try {
      setMockingId(member.id);

      const dynamicData = customPayload ? {
        heartRate: customPayload.heart_rate || '145 bpm',
        heartRateNum: parseInt(customPayload.heart_rate) || 145,
        steps: member.steps && member.steps !== '-' ? member.steps : '5,200 ก้าว',
        sleep: member.sleep && member.sleep !== '-' ? member.sleep : '7.2 ชม.',
        status: customPayload.status || 'อันตราย'
      } : generateMockHealthData(member);

      api.post(`/api/garmin/mock-sync/${member.id}`, {
        heart_rate: dynamicData.heartRate,
        steps: dynamicData.steps,
        sleep: dynamicData.sleep,
        status: dynamicData.status,
        ...customPayload
      }).catch(e => console.warn('Backend sync optional:', e));

      const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setHrHistoryMap((prev) => {
        const currentList = prev[member.id] || [
          { time: '10:00:00', hr: 72 },
          { time: '10:00:03', hr: 75 },
        ];
        const updated = [...currentList, { time: timeStr, hr: dynamicData.heartRateNum }].slice(-12);
        return { ...prev, [member.id]: updated };
      });

      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? {
                ...m,
                heart_rate: dynamicData.heartRate,
                steps: dynamicData.steps,
                sleep: dynamicData.sleep,
                status: dynamicData.status,
                is_connected: true
              }
            : m
        )
      );

      if (memberDetail && memberDetail.id === member.id) {
        setMemberDetail((prev) => ({
          ...prev,
          heart_rate: dynamicData.heartRate,
          steps: dynamicData.steps,
          sleep: dynamicData.sleep,
          status: dynamicData.status,
          is_connected: true
        }));
      }

    } catch (err) {
      console.error('Failed to mock data:', err);
    } finally {
      setMockingId(null);
    }
  };

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
              ? { ...m, heart_rate: '-', steps: '-', sleep: '-', status: 'ไม่มีข้อมูล', is_connected: 0 }
              : m
          )
        );
        if (memberDetail && memberDetail.id === memberId) {
          setMemberDetail((prev) => ({
            ...prev,
            heart_rate: '-', steps: '-', sleep: '-', status: 'ไม่มีข้อมูล', is_connected: 0
          }));
        }
      } catch (e) {
        console.error(e);
      }
      return;
    }

    handleMockSync(member);
    const newInterval = setInterval(() => {
      setMembers((latestMembers) => {
        const latestM = latestMembers.find(m => m.id === memberId) || member;
        handleMockSync(latestM);
        return latestMembers;
      });
    }, 3000);

    setAutoMockMap((prev) => ({
      ...prev,
      [memberId]: newInterval,
    }));
  };

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
            setMembers((latestMembers) => {
              const latestM = latestMembers.find(item => item.id === m.id) || m;
              handleMockSync(latestM);
              return latestMembers;
            });
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
      setHistory7Days(res.data || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const relation = newRelation === 'อื่นๆ' ? customRelation.trim() : newRelation;
    if (!newName.trim() || !relation) return;

    try {
      await api.post('/api/family-members', {
        name: newName.trim(),
        relation: relation,
        device: newDevice || 'Garmin Smartwatch'
      });

      setNewName('');
      setNewRelation('คู่สมรส');
      setCustomRelation('');
      setNewDevice('Garmin Smartwatch');
      setIsAddModalOpen(false);

      await fetchMembers();
    } catch (err) {
      console.error('Failed to add family member:', err);
      alert('ไม่สามารถเพิ่มสมาชิกได้');
    }
  };

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
        const authUrl = res.data?.authUrl || res.data?.url;
        if (authUrl) {
          window.location.href = authUrl;
        } else {
          alert('ไม่ได้รับลิงก์สำหรับเชื่อมต่อ Garmin Connect จากเซิร์ฟเวอร์');
        }
      } catch (err) {
        alert(err.response?.data?.error || 'ไม่สามารถเริ่มการเชื่อมต่อได้');
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

  const noDataReason = (m) =>
    m.is_connected || m.isConnected
      ? 'ยังไม่ได้ซิงค์กับนาฬิกา'
      : 'ยังไม่ได้เชื่อมต่อ Smart Watch';

  const goTo = (path, memberId) => navigate(path, { state: { memberId } });

  if (loading) {
    return <div className="w-full min-h-full bg-white p-10 flex justify-center items-center text-slate-400">กำลังโหลด...</div>;
  }

  return (
    <div className="w-full min-h-full bg-slate-50 p-6 md:p-10 font-sans text-slate-700">
      
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8 w-full">
        <div>
          <h2 
            onDoubleClick={() => setIsDevMode(!isDevMode)}
            className="text-3xl font-extrabold text-slate-800 tracking-tight cursor-pointer select-none transition-colors hover:text-slate-700"
            title="Double click หรือกด Ctrl+Shift+D เพื่อสลับ Dev Mode"
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
            className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md shadow-pink-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> เพิ่มสมาชิก
          </button>
        </div>
      </div>

      {/* Member Cards List */}
      <div className="space-y-4 w-full">
        {members.map((member) => {
          const displayName = member.name && String(member.name).trim() !== '' ? member.name : 'สมาชิกใหม่';
          const avatarLetter = member.avatar_text || member.avatarText || (displayName !== 'สมาชิกใหม่' ? displayName.charAt(0) : 'U');

          return (
            <div 
              key={member.id} 
              className={`bg-white border rounded-[28px] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between transition w-full gap-4 hover:border-pink-200 ${
                member.status === 'อันตราย' ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100'
              }`}
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-pink-100/60 rounded-2xl flex items-center justify-center text-pink-500 font-extrabold text-xl shrink-0 shadow-inner">
                  {avatarLetter}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-lg">{displayName}</h3>
                    <span className="bg-pink-50 text-pink-500 text-xs px-2.5 py-0.5 rounded-full font-medium">
                      {member.relation || 'สมาชิก'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-0.5 font-light">
                    {member.is_connected || member.isConnected 
                      ? (member.device || 'Garmin Smartwatch') 
                      : 'ยังไม่ได้เชื่อมต่ออุปกรณ์'}
                  </p>

                  {hasHealthData(member) ? (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <span className="bg-rose-50 text-rose-500 text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 font-semibold">
                        <Heart className="w-3.5 h-3.5 fill-rose-500" /> {member.heart_rate || member.heartRate || '-'}
                      </span>
                      <span className="bg-purple-50 text-purple-500 text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 font-semibold">
                        <Activity className="w-3.5 h-3.5" /> {member.steps || '-'}
                      </span>
                      <span className="bg-indigo-50 text-indigo-500 text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 font-semibold">
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

              <div className="flex flex-col items-end gap-3 shrink-0 w-full md:w-auto">
                {renderStatusBadge(member.status)}

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button 
                    onClick={() => handleOpenDetailModal(member)}
                    className="bg-pink-50 hover:bg-pink-100 text-pink-500 text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> ดูรายละเอียด
                  </button>

                  <button
                    onClick={() => handleOpenDeleteModal(member)}
                    className="bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-500 text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
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
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingId === member.id ? 'animate-spin' : ''}`} />
                        {syncingId === member.id ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูล'}
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleOpenConnect(member)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Watch className="w-3.5 h-3.5" /> เชื่อมต่อ Smart Watch
                    </button>
                  )}
                </div>

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
          );
        })}

        <div 
          onClick={() => setIsAddModalOpen(true)}
          className="border-2 border-dashed border-pink-200 hover:border-pink-400 rounded-[28px] p-6 flex items-center gap-5 cursor-pointer bg-pink-50/30 hover:bg-pink-50/60 transition group w-full"
        >
          <div className="w-14 h-14 bg-pink-400 group-hover:bg-pink-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-pink-200 transition shrink-0">
            <Plus className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-base">เพิ่มสมาชิกใหม่</h4>
            <p className="text-xs text-slate-400 mt-0.5">จัดคู่ Smart watch และตั้งผู้ติดต่อฉุกเฉิน</p>
          </div>
        </div>

        {members.length === 0 && (
          <div className="text-center py-10">
            <p className="text-slate-400 text-sm">ยังไม่มีสมาชิกในครอบครัว</p>
          </div>
        )}
      </div>

      {/* MODAL 1: เพิ่มสมาชิกใหม่ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-pink-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-pink-500" /> เพิ่มสมาชิกครอบครัวใหม่
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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

      {/* MODAL 4: รายละเอียดข้อมูลสุขภาพเชิงลึก และข้อมูลทั่วไป */}
      {isDetailModalOpen && memberDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-4xl w-full shadow-2xl border border-pink-100 max-h-[90vh] overflow-y-auto font-sans">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-pink-100 text-pink-500 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-inner shrink-0">
                  {memberDetail.avatar_text || (memberDetail.name ? memberDetail.name.charAt(0) : 'U')}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-xl">{memberDetail.name || 'สมาชิก'}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-pink-500 bg-pink-50 px-2.5 py-0.5 rounded-full font-medium">
                      {memberDetail.relation || 'สมาชิก'}
                    </span>
                    {renderStatusBadge(memberDetail.status)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-pink-50 p-1.5 rounded-full">
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

                <button onClick={() => setIsDetailModalOpen(false)} className="w-9 h-9 bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full flex items-center justify-center cursor-pointer transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-400 font-medium">{viewMode === 'realtime' ? 'ชีพจรปัจจุบัน' : 'ชีพจรเฉลี่ย (7 วัน)'}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-800">
                    {viewMode === 'realtime' 
                      ? (hasHealthData(memberDetail) ? memberDetail.heart_rate : 'ไม่มีข้อมูล')
                      : (() => {
                          const validHrs = history7Days.filter(d => d.hr > 0);
                          if (validHrs.length === 0) return '0 bpm';
                          return `${Math.round(validHrs.reduce((acc, curr) => acc + curr.hr, 0) / validHrs.length)} bpm`;
                        })()
                    }
                  </span>
                </div>
                <span className={`text-[11px] font-medium mt-2 inline-block px-2.5 py-0.5 rounded-full ${memberDetail.status === 'อันตราย' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {memberDetail.status || 'ไม่มีข้อมูล'}
                </span>
              </div>

              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-400 font-medium">{viewMode === 'realtime' ? 'ก้าววันนี้' : 'ก้าวเฉลี่ย / วัน'}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-800">
                    {viewMode === 'realtime' 
                      ? (hasHealthData(memberDetail) ? parseStepsNumber(memberDetail?.steps).toLocaleString() : '0')
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

              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-400 font-medium">{viewMode === 'realtime' ? 'การนอนล่าสุด' : 'การนอนเฉลี่ย (7 วัน)'}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-extrabold text-slate-800">
                    {viewMode === 'realtime' 
                      ? (hasHealthData(memberDetail) ? memberDetail.sleep : 'ไม่มีข้อมูล')
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="md:col-span-2 bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-pink-500" />
                      {viewMode === 'realtime' ? 'แนวโน้มชีพจร Real-time' : 'แนวโน้มชีพจร 7 วันย้อนหลัง'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">{viewMode === 'realtime' ? 'ข้อมูลอัปเดตแบบเรียลไทม์' : 'ค่าเฉลี่ยรายวัน (bpm)'}</p>
                  </div>
                  <span className="bg-pink-100/60 text-pink-500 text-xs px-3 py-1 rounded-full font-bold">
                    {viewMode === 'realtime' ? `ล่าสุด: ${hasHealthData(memberDetail) ? memberDetail.heart_rate : 'ไม่มีข้อมูล'}` : 'ประวัติ 7 วัน'}
                  </span>
                </div>

                <div className="w-full h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={viewMode === 'realtime' ? getRealtimeHrData(memberDetail.id) : history7Days}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey={viewMode === 'realtime' ? 'time' : 'day'} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', shadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(val) => [`${val} bpm`, 'ชีพจร']} />
                      <Line type="monotone" dataKey="hr" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} isAnimationActive={viewMode !== 'realtime'} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
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
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', shadow: '0 4px 12px rgba(0,0,0,0.08)' }} formatter={(val) => [`${val} ชม.`, 'เวลานอน']} />
                        <Bar dataKey="sleep" fill="#fb7185" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <section className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">ข้อมูลอุปกรณ์</h3>
                <div className="divide-y divide-slate-100">
                  <InfoRow label="อุปกรณ์">
                    <span className="inline-flex items-center gap-1.5">
                      <Watch className="w-4 h-4 text-pink-400" /> {memberDetail.device || 'ยังไม่ได้ระบุ'}
                    </span>
                  </InfoRow>
                  <InfoRow label="การเชื่อมต่อ">
                    {memberDetail.is_connected || memberDetail.isConnected ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600">
                        <Wifi className="w-4 h-4" /> เชื่อมต่อแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <WifiOff className="w-4 h-4" /> ยังไม่ได้เชื่อมต่อ
                      </span>
                    )}
                  </InfoRow>
                  <InfoRow label="ซิงค์ล่าสุด">{formatSyncTime(memberDetail.last_synced_at) || 'ยังไม่เคยซิงค์'}</InfoRow>
                </div>
              </section>

              <div className="space-y-4">
                <section className="rounded-2xl bg-pink-50/60 border border-pink-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarHeart className="w-4 h-4 text-pink-500" />
                    <h3 className="text-sm font-bold text-slate-800">นัดหมายถัดไป</h3>
                  </div>
                  {nextAppointment === undefined ? (
                    <p className="text-xs text-slate-400">กำลังโหลด...</p>
                  ) : nextAppointment ? (
                    <div>
                      <p className="text-pink-500 font-extrabold text-sm">
                        {formatDateKey(nextAppointment.appointment_date)} • {nextAppointment.appointment_time} น.
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
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

                <section className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <PhoneCall className="w-4 h-4 text-pink-500" />
                    <h3 className="text-sm font-bold text-slate-800">ผู้ติดต่อฉุกเฉิน</h3>
                  </div>
                  {memberDetail.emergency_contact_phone ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{memberDetail.emergency_contact_name || '-'}</p>
                        <p className="text-xs text-slate-500">{memberDetail.emergency_contact_phone}</p>
                      </div>
                      <a
                        href={`tel:${memberDetail.emergency_contact_phone}`}
                        className="bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-md shadow-pink-200 transition flex items-center gap-1 flex-shrink-0"
                      >
                        <Phone className="w-3 h-3 fill-white" /> โทร
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">ยังไม่มีข้อมูลผู้ติดต่อฉุกเฉิน</p>
                  )}
                </section>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => goTo('/data', memberDetail.id)}
                className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold shadow-md shadow-pink-200 transition cursor-pointer"
              >
                <span className="flex items-center gap-2"><Heart className="w-4 h-4" /> ดูข้อมูลสุขภาพเชิงลึก</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => goTo('/appointments', memberDetail.id)}
                className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border border-pink-200 hover:bg-pink-50 text-pink-500 text-sm font-bold transition cursor-pointer"
              >
                <span className="flex items-center gap-2"><CalendarHeart className="w-4 h-4" /> จัดการตารางนัดหมาย</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}