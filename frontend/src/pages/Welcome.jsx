import { Link, useLocation } from "react-router-dom";
import {
  Heart,
  HeartPulse,
  Watch,
  CalendarHeart,
  Users,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react";

// หน้ายินดีต้อนรับ: แสดงหลังสมัครสมาชิกสำเร็จ (Register ส่งชื่อผู้ใช้มาทาง state)
function Welcome() {
  const location = useLocation();
  const name = location.state?.name;

  // ฟีเจอร์หลักของระบบ ที่แนะนำให้ผู้ใช้ใหม่รู้จัก
  const features = [
    {
      icon: Users,
      title: "ดูแลคนในครอบครัว",
      desc: "เพิ่มสมาชิกและติดตามสุขภาพได้ในที่เดียว",
    },
    {
      icon: Watch,
      title: "เชื่อมต่อ Smart Watch",
      desc: "ซิงค์ชีพจร จำนวนก้าว และการนอนหลับ",
    },
    {
      icon: CalendarHeart,
      title: "นัดหมายแพทย์",
      desc: "บันทึกนัดและรับการแจ้งเตือนล่วงหน้า",
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-[#fff0f5] via-[#ffe3ed] to-[#ffc9dc] px-4 py-10">
      {/* วงกลมและหัวใจตกแต่งพื้นหลัง */}
      <span className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#ff9dbc]/40 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-[#fa6c9e]/30 blur-3xl" />
      <Heart className="pointer-events-none absolute left-[12%] top-[18%] hidden h-8 w-8 animate-pulse fill-[#ff9dbc] text-[#ff9dbc] md:block" />
      <Heart className="pointer-events-none absolute right-[14%] top-[12%] hidden h-5 w-5 animate-pulse fill-white text-white md:block" />
      <Heart className="pointer-events-none absolute bottom-[16%] left-[18%] hidden h-5 w-5 animate-pulse fill-[#f4518c]/60 text-[#f4518c]/60 md:block" />
      <Sparkles className="pointer-events-none absolute bottom-[22%] right-[16%] hidden h-7 w-7 text-white md:block" />

      {/* การ์ดหลัก */}
      <main className="relative w-full max-w-xl rounded-[32px] border border-white/70 bg-white/80 p-7 text-center shadow-2xl shadow-pink-200/60 backdrop-blur md:p-10">
        {/* โลโก้ */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fa6c9e] text-2xl text-white">
            ♡
          </div>
          <div className="text-left">
            <strong className="block text-[15px] text-[#3c3038]">
              PINK STUDIO
            </strong>
            <span className="text-[11px] tracking-wider text-[#a88e9b]">
              MEMBER SPACE
            </span>
          </div>
        </div>

        {/* ไอคอนสมัครสำเร็จ */}
        <div className="relative mx-auto mb-6 h-28 w-28">
          <div className="relative grid h-28 w-28 place-items-center rounded-full bg-linear-to-br from-[#ff83ad] to-[#f34c8c] shadow-lg shadow-pink-300">
            <HeartPulse className="h-12 w-12 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-4 border-white bg-emerald-400">
            <Check className="h-4 w-4 text-white" strokeWidth={3} />
          </div>
        </div>

        <p className="mb-2 text-sm font-medium text-[#f05289]">
          สร้างบัญชีสำเร็จ
        </p>
        <h1 className="text-2xl font-semibold leading-snug text-[#3c3038] md:text-3xl">
          ยินดีต้อนรับสู่ <span className="text-[#f05289]">PINK STUDIO</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[#8e7c87]">
          {name ? `สวัสดีคุณ ${name} ` : ""}
          เราดีใจที่คุณมาร่วมเป็นส่วนหนึ่งกับเรา
          พร้อมดูแลสุขภาพคนที่คุณรักแล้วหรือยัง?
        </p>

        {/* ฟีเจอร์แนะนำ */}
        <ul className="mt-8 grid gap-3 text-left sm:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="rounded-2xl border border-[#f1dce5] bg-[#fffafd] p-4"
            >
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#ffedf3]">
                <Icon className="h-5 w-5 text-[#f05289]" />
              </div>
              <h2 className="text-sm font-semibold text-[#3c3038]">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#9d8994]">
                {desc}
              </p>
            </li>
          ))}
        </ul>

        {/* ปุ่มไปหน้าเข้าสู่ระบบ */}
        <Link
          to="/login"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[15px] bg-linear-to-r from-[#ff83ad] to-[#f34c8c] px-10 py-3.5 text-lg font-medium text-white shadow-lg shadow-pink-200 transition hover:brightness-95 sm:w-auto"
        >
          เข้าสู่ระบบเพื่อเริ่มต้นใช้งาน <ArrowRight className="h-5 w-5" />
        </Link>
      </main>
    </div>
  );
}

export default Welcome;
