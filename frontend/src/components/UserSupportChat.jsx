import { useCallback, useEffect, useState } from "react";
import api, { getErrorMessage } from "../api.js";
import ChatBox from "./ChatBox.jsx";
import FloatingChat from "./FloatingChat.jsx";

const POLL_MS = 3000; // ตอนเปิดหน้าต่างแชท ดึงข้อความใหม่ทุก 3 วินาที

// แชทติดต่อเจ้าหน้าที่ (ฝั่งผู้ใช้) : ปุ่มวงกลมมุมขวาล่าง แสดงทุกหน้าของ user
function UserSupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMessages = useCallback(
    () =>
      api
        .get("/api/support/messages")
        .then((res) => {
          setMessages(res.data);
          setError("");
        })
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setLoading(false)),
    []
  );

  // ดึงข้อความเฉพาะตอนเปิดหน้าต่างแชท (ปิดแล้วหยุด ไม่เปลืองการเรียก server)
  useEffect(() => {
    if (!open) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_MS);
    return () => clearInterval(interval);
  }, [open, fetchMessages]);

  const handleSend = async (message) => {
    try {
      await api.post("/api/support/messages", { message });
      await fetchMessages();
    } catch (err) {
      alert(getErrorMessage(err));
      throw err; // ให้ ChatBox เก็บข้อความที่พิมพ์ไว้
    }
  };

  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <FloatingChat
      open={open}
      onToggle={toggle}
      title="ติดต่อเจ้าหน้าที่"
      subtitle="สอบถามปัญหาการใช้งานได้เลย"
      label="ติดต่อฝ่ายดูแล"
    >
      {error && <p className="bg-red-50 px-4 py-2 text-xs text-red-600">{error}</p>}
      {loading ? (
        <p className="p-6 text-center text-sm text-slate-400">กำลังโหลดข้อความ...</p>
      ) : (
        <ChatBox
          messages={messages}
          mySide="user"
          otherName="เจ้าหน้าที่"
          emptyText="ยังไม่มีข้อความ พิมพ์คำถามของคุณได้เลย เจ้าหน้าที่จะตอบกลับโดยเร็ว"
          onSend={handleSend}
        />
      )}
    </FloatingChat>
  );
}

export default UserSupportChat;
