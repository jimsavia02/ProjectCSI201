import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Clock, Trash2 } from 'lucide-react';
import api from '../api.js';

// ตัวเลือกเวลานัด แยกชั่วโมง (00-23) กับนาที (ทุก 5 นาที) ให้ผู้ใช้เลือกจากรายการ ไม่ต้องพิมพ์เอง
const pad2 = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad2(i * 5));

// คลิกช่องวันที่แล้วเปิดปฏิทินทันที (showPicker ไม่มีในเบราว์เซอร์เก่าบางตัว จึงครอบ try ไว้)
const openPicker = (e) => {
  try {
    e.currentTarget.showPicker();
  } catch {
    // เบราว์เซอร์ไม่รองรับ: ผู้ใช้ยังกดไอคอนปฏิทินในช่องได้ตามปกติ
  }
};

// กันการพิมพ์วันที่เอง (ยังกด Tab เพื่อเลื่อนช่อง และกด Enter/Space เพื่อเปิดปฏิทินได้)
const blockTyping = (e) => {
  if (e.key === 'Tab') return;
  e.preventDefault();
  if (e.key === 'Enter' || e.key === ' ') openPicker(e);
};

// เงื่อนไขการแจ้งเตือนรายสมาชิก (key ตรงกับ API /alert-settings) — บันทึกลงฐานข้อมูล และ server ใช้ตัดสินว่าจะแจ้ง LINE หรือไม่
const ALERT_OPTIONS = [
  { key: 'hrHigh', label: 'ชีพจรสูงผิดปกติ', desc: 'มากกว่า 120 bpm' },
  { key: 'hrLow', label: 'ชีพจรต่ำผิดปกติ', desc: 'น้อยกว่า 50 bpm' },
  { key: 'stress', label: 'ระดับความเครียดสูง', desc: 'มากกว่า 80 ต่อเนื่องเกิน 30 นาที' },
  { key: 'fall', label: 'ตรวจพบการล้ม', desc: 'แจ้งเตือนทันที พร้อมเบอร์ผู้ติดต่อฉุกเฉิน' },
];

function Appointments() {
  const location = useLocation();
  const [preferredId] = useState(() => location.state?.memberId ?? null);
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);

  // คำนวณหา "วันพรุ่งนี้" ในรูปแบบ YYYY-MM-DD
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [alertSettings, setAlertSettings] = useState(null); // null = กำลังโหลด
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertNote, setAlertNote] = useState({ type: '', text: '' });

  const [channels, setChannels] = useState({
    line: true
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newAppoint, setNewAppoint] = useState({
    date: '',
    time: '',
    doctor: '',
    hospital: '',
    reminder: 'ล่วงหน้า 1 วัน'
  });

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await api.get('/api/family-members');
        setMembers(res.data);
        if (res.data.length > 0) {
          // เลือกสมาชิกที่ส่งมาจากหน้าอื่น (เช่น popup รายละเอียดในหน้าสมาชิก) ถ้าไม่มีเลือกคนแรก
          const preferred = res.data.find((m) => m.id === preferredId);
          setSelectedMemberId(preferred ? preferred.id : res.data[0].id);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error fetching members:", err);
        setLoading(false);
      }
    };
    fetchMembers();
  }, [preferredId]);

  useEffect(() => {
    if (!selectedMemberId) return;

    const fetchAppointments = async () => {
      try {
        const res = await api.get(`/api/family-members/${selectedMemberId}/appointments`);
        setAppointments(res.data);
      } catch (err) {
        console.error("Error fetching appointments:", err);
      }
    };

    fetchAppointments();
  }, [selectedMemberId]);

  // เข้ามาจากปุ่ม "เงื่อนไขการแจ้งเตือน" ในหน้าตั้งค่า (#alert-conditions) -> เลื่อนไปที่การ์ดนั้น
  useEffect(() => {
    if (loading || location.hash !== '#alert-conditions') return;
    document.getElementById('alert-conditions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, location.hash]);

  // โหลดเงื่อนไขการแจ้งเตือนของสมาชิกที่เลือก
  useEffect(() => {
    if (!selectedMemberId) return;
    let ignore = false;
    setAlertSettings(null);
    setAlertNote({ type: '', text: '' });
    api
      .get(`/api/family-members/${selectedMemberId}/alert-settings`)
      .then((res) => !ignore && setAlertSettings(res.data))
      .catch((err) => {
        if (ignore) return;
        setAlertNote({ type: 'error', text: err.response?.data?.error || 'โหลดเงื่อนไขการแจ้งเตือนไม่สำเร็จ' });
      });
    return () => { ignore = true; };
  }, [selectedMemberId]);

  const selectedMember = members.find(m => m.id === selectedMemberId);

  const handleToggleAlert = (key) => {
    setAlertSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setAlertNote({ type: '', text: '' });
  };

  const handleToggleChannel = (key) => {
    setChannels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddAppointment = async (e) => {
    e.preventDefault();
    if (!newAppoint.date || !newAppoint.doctor) return;

    const selectedDate = new Date(newAppoint.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
      alert('กรุณาเลือกวันนัดหมายตั้งแต่ "วันพรุ่งนี้" เป็นต้นไป');
      return;
    }

    try {
      await api.post(`/api/family-members/${selectedMemberId}/appointments`, {
        appointment_date: newAppoint.date,
        appointment_time: newAppoint.time || '09:00',
        doctor_name: newAppoint.doctor,
        hospital_name: newAppoint.hospital || 'โรงพยาบาล',
        reminder_note: newAppoint.reminder
      });

      const res = await api.get(`/api/family-members/${selectedMemberId}/appointments`);
      setAppointments(res.data);

      setShowAddForm(false);
      setNewAppoint({ date: '', time: '', doctor: '', hospital: '', reminder: 'ล่วงหน้า 1 วัน' });
    } catch (err) {
      console.error("Error saving appointment:", err);
      alert("ไม่สามารถบันทึกนัดหมายได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleDeleteAppointment = async (appointmentId) => {
    if (!window.confirm("คุณต้องการลบรายการนัดหมายนี้ใช่หรือไม่?")) return;

    try {
      await api.delete(`/api/appointments/${appointmentId}`);
      setAppointments(appointments.filter(item => item.id !== appointmentId));
    } catch (err) {
      console.error("Error deleting appointment:", err);
      alert("ไม่สามารถลบนัดหมายได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleSaveSettings = async () => {
    if (!alertSettings) return;
    setSavingAlerts(true);
    try {
      const { hrHigh, hrLow, stress, fall } = alertSettings;
      const res = await api.put(`/api/family-members/${selectedMemberId}/alert-settings`, { hrHigh, hrLow, stress, fall });
      setAlertSettings({ hrHigh: res.data.hrHigh, hrLow: res.data.hrLow, stress: res.data.stress, fall: res.data.fall });
      setAlertNote({ type: 'success', text: `${res.data.message} (${selectedMember?.name || 'สมาชิก'})` });
    } catch (err) {
      setAlertNote({ type: 'error', text: err.response?.data?.error || 'บันทึกเงื่อนไขการแจ้งเตือนไม่สำเร็จ' });
    } finally {
      setSavingAlerts(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-slate-400">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="p-6 md:p-10 bg-slate-50 min-h-screen font-sans text-slate-700">
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">นัดหมายแพทย์ & การแจ้งเตือน</h1>
        <p className="text-sm text-slate-400 mt-1">
          ตั้งนัดหมายและกำหนดเงื่อนไขแจ้งเตือนของแต่ละคนที่ monitor
        </p>
      </div>

      <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
        {members.map(member => {
          const isSelected = member.id === selectedMemberId;
          return (
            <button
              key={member.id}
              onClick={() => setSelectedMemberId(member.id)}
              className={`px-5 py-2 rounded-full text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-200'
                  : 'bg-white text-pink-400 hover:bg-pink-50 border border-pink-100'
              }`}
            >
              {member.name} ({member.relation})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">ตารางนัดหมายแพทย์</h2>
                <p className="text-xs text-slate-400">ระบบแจ้งเตือนก่อนถึงวันนัด</p>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-pink-400 hover:bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm shadow-pink-200 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> เพิ่ม
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleAddAppointment} className="mb-6 p-4 bg-pink-50/50 border border-pink-100 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-pink-600 mb-2">เพิ่มนัดหมายใหม่ (ต้องเลือกวันถัดจากวันนี้เท่านั้น!)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">วันที่</label>
                    <input
                      type="date"
                      required
                      autoFocus
                      min={tomorrowStr}
                      value={newAppoint.date}
                      onClick={openPicker}
                      onKeyDown={blockTyping}
                      onChange={(e) => setNewAppoint({ ...newAppoint, date: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">เวลา</label>
                    {(() => {
                      // newAppoint.time เก็บเป็น "HH:MM" แยกออกมาเป็นชั่วโมงกับนาที
                      const [hour = '', minute = ''] = newAppoint.time.split(':');
                      // เลือกชั่วโมงก่อน -> นาทีเริ่มที่ 00 ให้อัตโนมัติ
                      const setTime = (h, m) => setNewAppoint({ ...newAppoint, time: `${h}:${m}` });
                      const selectClass = (value) =>
                        `flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-300 ${
                          value ? 'text-slate-700' : 'text-slate-400'
                        }`;

                      return (
                        <div className="flex items-center gap-1.5">
                          <select
                            required
                            aria-label="ชั่วโมง"
                            value={hour}
                            onChange={(e) => setTime(e.target.value, minute || '00')}
                            className={selectClass(hour)}
                          >
                            <option value="" disabled>ชม.</option>
                            {HOURS.map((h) => (
                              <option key={h} value={h} className="text-slate-700">{h}</option>
                            ))}
                          </select>
                          <span className="text-xs font-bold text-slate-400">:</span>
                          <select
                            required
                            aria-label="นาที"
                            value={minute}
                            onChange={(e) => setTime(hour, e.target.value)}
                            className={selectClass(minute)}
                          >
                            <option value="" disabled>นาที</option>
                            {MINUTES.map((m) => (
                              <option key={m} value={m} className="text-slate-700">{m}</option>
                            ))}
                          </select>
                          <span className="text-xs text-slate-400">น.</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <input
                  type="text"
                  required
                  placeholder="ชื่อแพทย์ เช่น พญ. สุพิชชา ใจดี"
                  value={newAppoint.doctor}
                  onChange={(e) => setNewAppoint({ ...newAppoint, doctor: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <input
                  type="text"
                  placeholder="แผนก / โรงพยาบาล เช่น รพ.ศิริราช"
                  value={newAppoint.hospital}
                  onChange={(e) => setNewAppoint({ ...newAppoint, hospital: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <div className="flex justify-between items-center pt-1">
                  <select
                    value={newAppoint.reminder}
                    onChange={(e) => setNewAppoint({ ...newAppoint, reminder: e.target.value })}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="ล่วงหน้า 1 ชั่วโมง">ล่วงหน้า 1 ชั่วโมง</option>
                    <option value="ล่วงหน้า 1 วัน">ล่วงหน้า 1 วัน</option>
                    <option value="ล่วงหน้า 2 วัน">ล่วงหน้า 2 วัน</option>
                    <option value="ล่วงหน้า 1 สัปดาห์">ล่วงหน้า 1 สัปดาห์</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600">ยกเลิก</button>
                    <button type="submit" className="px-4 py-1.5 bg-pink-500 text-white text-xs font-bold rounded-xl shadow-sm">บันทึก</button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-4">
              {appointments.length > 0 ? (
                appointments.map((item) => {
                  const d = new Date(item.appointment_date);
                  const day = !isNaN(d.getDate()) ? String(d.getDate()).padStart(2, '0') : '--';
                  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                  const month = !isNaN(d.getMonth()) ? thaiMonths[d.getMonth()] : '';

                  return (
                    <div key={item.id} className="bg-pink-50/40 border border-pink-100 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-pink-200 transition">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-pink-400 rounded-2xl flex flex-col items-center justify-center text-white shadow-sm flex-shrink-0">
                          <span className="text-xl font-extrabold leading-none">{day}</span>
                          <span className="text-[10px] font-medium mt-0.5">{month}</span>
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-800 text-sm">{item.doctor_name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{item.hospital_name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-bold text-pink-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {item.appointment_time}
                            </span>
                            <span className="bg-pink-100 text-pink-500 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                              {item.reminder_note}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteAppointment(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                        title="ลบนัดหมาย"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              ) : (
                // ซ่อนกล่องนี้ตอนเปิดฟอร์มอยู่ ให้ฟอร์มขึ้นมาแทนที่
                !showAddForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    disabled={!selectedMemberId}
                    className="group w-full text-center py-10 border-2 border-dashed border-pink-100 rounded-2xl bg-pink-50/20 transition cursor-pointer hover:border-pink-300 hover:bg-pink-50/60 disabled:cursor-default disabled:hover:border-pink-100 disabled:hover:bg-pink-50/20"
                  >
                    <p className="text-xs text-slate-400 mb-2">ยังไม่มีรายการนัดหมายสำหรับสมาชิกคนนี้</p>
                    <span className="text-xs text-pink-500 font-bold group-hover:underline">
                      + คลิกเพื่อสร้างนัดหมายแรก
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div id="alert-conditions" className="scroll-mt-6 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-800">เงื่อนไขการแจ้งเตือน</h2>
              <p className="text-xs text-slate-400">สำหรับ {selectedMember?.name || 'สมาชิก'}</p>
            </div>

            {!alertSettings ? (
              <p className="text-xs text-slate-400">{alertNote.type === 'error' ? '' : 'กำลังโหลด...'}</p>
            ) : (
              <div className="space-y-5 divide-y divide-slate-100">
                {ALERT_OPTIONS.map((option, i) => (
                  <div key={option.key} className={`flex items-center justify-between ${i === 0 ? 'pt-1' : 'pt-4'}`}>
                    <div>
                      <p className="font-bold text-slate-800 text-xs">{option.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{option.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={alertSettings[option.key]}
                      aria-label={option.label}
                      onClick={() => handleToggleAlert(option.key)}
                      className={`w-11 h-6 shrink-0 rounded-full transition-colors p-0.5 cursor-pointer ${
                        alertSettings[option.key] ? 'bg-pink-500' : 'bg-slate-200'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        alertSettings[option.key] ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 border-t border-slate-100 pt-6">
              <h4 className="font-bold text-slate-800 text-xs mb-3">ช่องทางแจ้งเตือน</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleChannel('line')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    channels.line ? 'bg-pink-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  LINE
                </button>
              </div>
            </div>

            {alertNote.text && (
              <p
                role={alertNote.type === 'error' ? 'alert' : 'status'}
                className={`mt-6 rounded-xl px-4 py-2.5 text-xs ${
                  alertNote.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {alertNote.text}
              </p>
            )}

            <div className="mt-6">
              <button
                onClick={handleSaveSettings}
                disabled={!alertSettings || savingAlerts}
                className="w-full py-3 bg-pink-500 hover:bg-pink-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-md shadow-pink-200 transition cursor-pointer"
              >
                {savingAlerts ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

export default Appointments;