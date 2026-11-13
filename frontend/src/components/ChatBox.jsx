import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

// แปลงเวลาข้อความ: วันนี้แสดงแค่เวลา "14:05" วันอื่นแสดงวันที่ด้วย "12/11 14:05"
const formatTime = (value) => {
  const d = new Date(value);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return d.toDateString() === new Date().toDateString() ? time : `${d.getDate()}/${d.getMonth() + 1} ${time}`;
};

// กล่องแชทที่ใช้ร่วมกันทั้งฝั่งผู้ใช้และฝั่ง admin
//   messages = [{ id, sender_role, message, is_read, created_at }]
//   mySide   = 'user' หรือ 'admin' -> ข้อความฝั่งตัวเองชิดขวา (สีชมพู) อีกฝั่งชิดซ้าย (สีเทา)
//   onSend   = ฟังก์ชันส่งข้อความ (ต้อง return Promise) ส่งสำเร็จจะล้างช่องพิมพ์
function ChatBox({ messages, mySide, onSend, otherName, emptyText, className = "flex-1 min-h-0" }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  // มีข้อความใหม่ -> เลื่อนลงล่างสุดอัตโนมัติ
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      await onSend(message);
      setText("");
    } catch {
      // ส่งไม่สำเร็จ: เก็บข้อความที่พิมพ์ไว้ให้กดส่งใหม่ได้ (หน้าที่เรียกใช้แจ้ง error เอง)
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`flex flex-col bg-white ${className}`}>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-400">{emptyText}</p>}

        {messages.map((m) => {
          const mine = m.sender_role === mySide;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {!mine && <span className="mb-1 px-1 text-xs text-slate-400">{otherName}</span>}
              <p
                className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${
                  mine ? "rounded-br-md bg-pink-500 text-white" : "rounded-bl-md bg-slate-100 text-slate-700"
                }`}
              >
                {m.message}
              </p>
              <span className="mt-1 px-1 text-[11px] text-slate-400">
                {formatTime(m.created_at)}
                {mine && (m.is_read ? " · อ่านแล้ว" : "")}
              </span>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-pink-100 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่
            if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
          }}
          rows={1}
          maxLength={1000}
          placeholder="พิมพ์ข้อความ... (Enter เพื่อส่ง)"
          className="max-h-32 flex-1 resize-none rounded-2xl border border-pink-100 bg-pink-50/40 px-4 py-2.5 text-sm outline-none focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-100"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="ส่งข้อความ"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pink-500 text-white transition hover:bg-pink-600 disabled:opacity-40 cursor-pointer"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

export default ChatBox;
