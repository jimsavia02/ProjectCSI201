import { useEffect } from "react";
import { MessageCircle, X } from "lucide-react";

// ปุ่มวงกลมมุมขวาล่าง กดแล้วเปิดหน้าต่างแชทลอยขึ้นมา (ใช้ทั้งฝั่ง user และ admin)
//   open / onToggle = สถานะเปิด-ปิด (หน้าที่เรียกใช้เป็นคนเก็บ)
//   badge           = ตัวเลขข้อความใหม่ (มากกว่า 0 จะแสดงจุดแดงบนปุ่ม)
//   title / header  = หัวหน้าต่างแชท
//   label           = ข้อความเล็กๆ ข้างปุ่ม บอกว่าปุ่มนี้ไว้ทำอะไร (ซ่อนตอนเปิดหน้าต่าง)
function FloatingChat({ open, onToggle, badge = 0, title, subtitle, headerLeft, label, children }) {
  // กด Esc เพื่อปิดหน้าต่าง
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onToggle();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onToggle]);

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label={title}
          className="fixed bottom-24 right-6 z-50 flex h-[min(560px,calc(100vh-8rem))] w-[min(380px,calc(100vw-3rem))] flex-col overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-2xl shadow-pink-200/50"
        >
          <header className="flex items-center gap-2 bg-linear-to-r from-pink-400 to-pink-500 px-4 py-3 text-white">
            {headerLeft}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{title}</p>
              {subtitle && <p className="truncate text-xs text-white/80">{subtitle}</p>}
            </div>
            <button onClick={onToggle} aria-label="ปิดแชท" className="rounded-full p-1 hover:bg-white/20 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </section>
      )}

      <button
        onClick={onToggle}
        aria-label={open ? "ปิดแชท" : label || "เปิดแชท"}
        className="group fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-pink-500 text-white shadow-lg shadow-pink-300 transition hover:scale-105 hover:bg-pink-600 cursor-pointer"
      >
        {/* ข้อความบอกว่าปุ่มนี้ไว้ทำอะไร: ขึ้นเฉพาะตอนเอาเมาส์ชี้ที่ปุ่ม */}
        {label && !open && (
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
            {label}
          </span>
        )}
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {badge > 0 && !open && (
          <span
            className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-bold"
            aria-label={`ข้อความใหม่ ${badge} ข้อความ`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </>
  );
}

export default FloatingChat;
