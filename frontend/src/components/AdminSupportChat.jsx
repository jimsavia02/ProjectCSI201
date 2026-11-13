import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import api, { getErrorMessage } from "../api.js";
import ChatBox from "./ChatBox.jsx";
import FloatingChat from "./FloatingChat.jsx";

const POLL_MS = 3000; // ตอนเปิดหน้าต่าง ดึงรายการแชท/ข้อความใหม่ทุก 3 วินาที
const UNREAD_POLL_MS = 5000; // เช็กข้อความใหม่ (จุดแดงบนปุ่ม) ทุก 5 วินาที แม้ปิดหน้าต่างอยู่

// เวลาข้อความล่าสุดในรายการแชท: วันนี้แสดงเวลา วันอื่นแสดงวันที่
const shortTime = (value) => {
  const d = new Date(value);
  return d.toDateString() === new Date().toDateString()
    ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    : `${d.getDate()}/${d.getMonth() + 1}`;
};

// แชทซัพพอร์ต (ฝั่ง admin) : ปุ่มวงกลมมุมขวาล่าง + จุดแดงเมื่อมีข้อความใหม่จากผู้ใช้
// หน้าต่างมี 2 มุมมอง: รายการห้องแชท -> กดเข้าไปคุยกับผู้ใช้ทีละคน (มีปุ่มย้อนกลับ)
function AdminSupportChat() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [chat, setChat] = useState(null); // { user, messages }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUnread = useCallback(() => {
    api
      .get("/admin/support/unread-count")
      .then((res) => setUnread(res.data.unread))
      .catch(() => {});
  }, []);

  const fetchConversations = useCallback(
    () =>
      api
        .get("/admin/support/conversations")
        .then((res) => {
          setConversations(res.data);
          setError("");
        })
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setLoading(false)),
    []
  );

  // เปิดห้องแชท = server ทำเครื่องหมายว่าอ่านแล้ว -> อัปเดตจุดแดงด้วย
  const fetchChat = useCallback(
    (userId) =>
      api
        .get(`/admin/support/conversations/${userId}`)
        .then((res) => {
          setChat(res.data);
          fetchUnread();
        })
        .catch((err) => setError(getErrorMessage(err))),
    [fetchUnread]
  );

  // จุดแดงบนปุ่ม: เช็กตลอดเวลา ไม่ว่า admin จะอยู่หน้าไหน
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // รายการห้องแชท: ดึงเฉพาะตอนเปิดหน้าต่างและยังไม่ได้เลือกห้อง
  useEffect(() => {
    if (!open || selectedId) return;
    fetchConversations();
    const interval = setInterval(fetchConversations, POLL_MS);
    return () => clearInterval(interval);
  }, [open, selectedId, fetchConversations]);

  // ห้องที่เลือก: ดึงข้อความใหม่เรื่อยๆ ตอนเปิดหน้าต่างอยู่
  useEffect(() => {
    if (!open || !selectedId) return;
    fetchChat(selectedId);
    const interval = setInterval(() => fetchChat(selectedId), POLL_MS);
    return () => clearInterval(interval);
  }, [open, selectedId, fetchChat]);

  const openConversation = (userId) => {
    setChat(null);
    setSelectedId(userId);
  };

  const backToList = () => {
    setSelectedId(null);
    setChat(null);
  };

  const handleSend = async (message) => {
    try {
      await api.post(`/admin/support/conversations/${selectedId}`, { message });
      await fetchChat(selectedId);
    } catch (err) {
      alert(getErrorMessage(err));
      throw err; // ให้ ChatBox เก็บข้อความที่พิมพ์ไว้
    }
  };

  const toggle = useCallback(() => setOpen((o) => !o), []);

  const inChat = selectedId && chat;

  return (
    <FloatingChat
      open={open}
      onToggle={toggle}
      badge={unread}
      title={inChat ? chat.user.name : "ซัพพอร์ต"}
      subtitle={inChat ? chat.user.email : "ข้อความจากผู้ใช้งาน"}
      headerLeft={
        selectedId && (
          <button onClick={backToList} aria-label="กลับไปรายการแชท" className="rounded-full p-1 hover:bg-white/20 cursor-pointer">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )
      }
    >
      {error && <p className="bg-red-50 px-4 py-2 text-xs text-red-600">{error}</p>}

      {selectedId ? (
        chat ? (
          <ChatBox
            messages={chat.messages}
            mySide="admin"
            otherName={chat.user.name}
            emptyText="ยังไม่มีข้อความ"
            onSend={handleSend}
          />
        ) : (
          <p className="p-6 text-center text-sm text-slate-400">กำลังโหลด...</p>
        )
      ) : loading ? (
        <p className="p-6 text-center text-sm text-slate-400">กำลังโหลดข้อความ...</p>
      ) : conversations.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-400">ยังไม่มีข้อความจากผู้ใช้</p>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map((c) => (
            <button
              key={c.user_id}
              onClick={() => openConversation(c.user_id)}
              className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-pink-50 cursor-pointer"
            >
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink-100 font-bold text-pink-500">
                {c.name.charAt(0)}
                {/* จุดแดง: มีข้อความใหม่ที่ยังไม่อ่าน */}
                {c.unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${c.unread > 0 ? "font-bold text-slate-800" : "font-semibold text-slate-700"}`}>
                    {c.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">{shortTime(c.last_at)}</span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className={`truncate text-xs ${c.unread > 0 ? "font-semibold text-slate-700" : "text-slate-400"}`}>
                    {c.last_sender === "admin" ? "คุณ: " : ""}
                    {c.last_message}
                  </span>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">{c.unread}</span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </FloatingChat>
  );
}

export default AdminSupportChat;
