import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import api, { getErrorMessage } from '../api.js'

const PAGE_SIZE = 8

// ตั้งค่าของแต่ละแท็บ: ช่วงอ้างอิง, วิธีแสดงค่า และเกณฑ์สถานะ
// สถานะคืนค่า [ข้อความ, ระดับ] โดยระดับ ok = เขียว, alert = ชมพูแดง, mid = เหลือง
const TABS = [
  {
    type: 'heart_rate',
    label: 'ชีพจร',
    range: '60 – 100 bpm',
    format: (v) => `${v} bpm`,
    status: (v) => (v > 100 ? ['สูง', 'alert'] : v < 60 ? ['ต่ำ', 'alert'] : ['ปกติ', 'ok']),
  },
  {
    type: 'steps',
    label: 'ก้าวเดิน',
    range: 'เป้าหมาย 6,000 ก้าว',
    format: (v) => `${v.toLocaleString('en-US')} ก้าว`,
    status: (v) => (v >= 6000 ? ['ถึงเป้าแล้ว', 'ok'] : ['ยังไม่ถึงเป้า', 'mid']),
  },
  {
    type: 'sleep',
    label: 'การนอน',
    range: '7 – 9 ชม.',
    format: (v) => `${v} ชม.`,
    status: (v) => (v < 7 ? ['น้อยไป', 'alert'] : v > 9 ? ['มากไป', 'mid'] : ['ปกติ', 'ok']),
  },
  {
    type: 'stress',
    label: 'ความเครียด',
    range: '0 – 50',
    format: (v) => `${v}`,
    status: (v) => (v > 50 ? ['สูง', 'alert'] : v <= 25 ? ['ผ่อนคลาย', 'ok'] : ['ปกติ', 'ok']),
  },
]

const STATUS_STYLES = {
  ok: 'bg-emerald-50 text-emerald-600',
  mid: 'bg-amber-50 text-amber-600',
  alert: 'bg-[#ffe3ed] text-[#f05289]',
  none: 'bg-slate-100 text-slate-500',
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// แปลงเวลาให้อ่านง่าย: "วันนี้ 09:42", "เมื่อวาน 21:15", "27 ต.ค. 22:10"
function formatTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return `วันนี้ ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `เมื่อวาน ${time}`
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${time}`
}

// เลขหน้าที่จะแสดง: หน้าแรก หน้าสุดท้าย และหน้ารอบๆ หน้าปัจจุบัน ที่เหลือย่อเป็น "…"
// เช่น หน้า 7 จาก 50 -> [1, '…', 6, 7, 8, '…', 50]
function pageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((n) => pages.add(n))
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((n) => pages.add(n))

  const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const items = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) items.push('…')
    items.push(n)
  })
  return items
}

function Data() {
  const [members, setMembers] = useState([])
  const [memberId, setMemberId] = useState(null)
  const [tab, setTab] = useState(TABS[0])
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null) // { member, items, total }
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0) // เพิ่มค่าเพื่อสั่งโหลดข้อมูลใหม่หลังซิงค์

  // สมาชิกที่ส่งมาจากหน้าอื่น (เช่น popup รายละเอียดในหน้าสมาชิก) อ่านครั้งเดียวตอนเปิดหน้า
  const location = useLocation()
  const [preferredId] = useState(() => location.state?.memberId ?? null)

  // โหลดรายชื่อสมาชิกสำหรับ dropdown แล้วเลือกคนที่ส่งมา (ถ้าไม่มีเลือกคนแรก)
  useEffect(() => {
    api.get('/api/family-members')
      .then((res) => {
        setMembers(res.data)
        if (res.data.length > 0) {
          const preferred = res.data.find((m) => m.id === preferredId)
          setMemberId(preferred ? preferred.id : res.data[0].id)
        } else setLoading(false)
      })
      .catch((err) => {
        setError(getErrorMessage(err))
        setLoading(false)
      })
  }, [preferredId])

  // โหลดข้อมูลสุขภาพทุกครั้งที่เปลี่ยนสมาชิก / แท็บ / หน้า หรือหลังกดซิงค์
  useEffect(() => {
    if (!memberId) return
    let ignore = false // กันข้อมูลเก่าที่ตอบกลับช้ามาทับข้อมูลใหม่
    setLoading(true)

    api.get(`/api/family-members/${memberId}/readings`, {
      params: { type: tab.type, page, limit: PAGE_SIZE },
    })
      .then((res) => {
        if (!ignore) {
          setData(res.data)
          setError('')
        }
      })
      .catch((err) => !ignore && setError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false))

    return () => {
      ignore = true
    }
  }, [memberId, tab, page, reloadKey])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.post(`/api/garmin/mock-sync/${memberId}`)
      setPage(1)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSyncing(false)
    }
  }

  const changeMember = (e) => {
    setMemberId(Number(e.target.value))
    setPage(1)
  }

  const changeTab = (t) => {
    setTab(t)
    setPage(1)
  }

  // ยังไม่มีสมาชิกในครอบครัว
  if (!loading && members.length === 0) {
    return (
      <section className="rounded-[22px] border border-dashed border-[#f6cedd] bg-[#fffafd] p-10 text-center">
        <h2 className="text-xl font-semibold text-[#3c3038]">ยังไม่มีสมาชิกในครอบครัว</h2>
        <p className="mt-2 text-sm text-[#8e7c87]">เพิ่มสมาชิกก่อน แล้วค่อยกลับมาดูข้อมูลสุขภาพได้ที่นี่</p>
        <Link
          to="/party"
          className="mt-5 inline-block rounded-[15px] bg-linear-to-r from-[#ff83ad] to-[#f34c8c] px-6 py-2.5 text-sm font-medium text-white hover:brightness-95"
        >
          ไปหน้าสมาชิก
        </Link>
      </section>
    )
  }

  const member = data?.member
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <section className="text-[#3c3038]">
      {/* ส่วนหัว: ชื่อหน้า, เลือกสมาชิก, ปุ่มซิงค์ */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">ข้อมูลสุขภาพ</h1>
          <p className="mt-1.5 text-[#8e7c87]">
            ประวัติข้อมูลที่ดึงจาก Smart watch ของ{' '}
            {member ? `${member.relation} (${member.name})` : '...'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={memberId ?? ''}
            onChange={changeMember}
            aria-label="เลือกสมาชิก"
            className="cursor-pointer rounded-[15px] border border-[#f1dce5] bg-white px-4 py-2.5 text-sm font-medium text-[#786671] focus:outline-none focus:ring-2 focus:ring-[#ffe3ed]"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.relation})
              </option>
            ))}
          </select>

          <button
            onClick={handleSync}
            disabled={syncing || !memberId}
            className="flex cursor-pointer items-center gap-2 rounded-[15px] bg-linear-to-r from-[#ff83ad] to-[#f34c8c] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-200 transition hover:brightness-95 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'กำลังซิงค์...' : 'ซิงค์ตอนนี้'}
          </button>
        </div>
      </div>

      {/* แท็บประเภทข้อมูล + เวลาซิงค์ล่าสุด */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.type}
              onClick={() => changeTab(t)}
              className={`cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition ${
                tab.type === t.type
                  ? 'bg-[#f66c9c] text-white shadow-sm shadow-pink-200'
                  : 'bg-[#ffedf3] text-[#f05289] hover:bg-[#ffe3ed]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-[#8e7c87]">ซิงค์ล่าสุด {formatTime(member?.last_synced_at)}</p>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ตารางข้อมูล */}
      <div className="mt-4 overflow-hidden rounded-[22px] border border-[#f1dce5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#fff5f9] text-xs text-[#a9939e]">
              <tr>
                <th className="px-6 py-4 font-medium">วันที่ / เวลา</th>
                <th className="px-6 py-4 font-medium">ค่าที่วัดได้</th>
                <th className="px-6 py-4 font-medium">ช่วงอ้างอิง</th>
                <th className="px-6 py-4 font-medium">สถานะ</th>
                <th className="px-6 py-4 font-medium">แหล่งข้อมูล</th>
              </tr>
            </thead>
            <tbody className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
              {items.map((row) => {
                const hasValue = row.value !== null
                const [statusText, level] = hasValue ? tab.status(row.value) : ['ไม่มีข้อมูล', 'none']
                return (
                  <tr key={row.id} className="border-t border-[#f6e6ed] first:border-t-0">
                    <td className="px-6 py-4 text-[#786671]">{formatTime(row.recorded_at)}</td>
                    <td className="px-6 py-4 font-bold text-[#3c3038]">
                      {hasValue ? tab.format(row.value) : '—'}
                    </td>
                    <td className="px-6 py-4 text-[#786671]">{tab.range}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[level]}`}>
                        {statusText}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#786671]">{row.source || 'ไม่ได้เชื่อมต่อ'}</td>
                  </tr>
                )
              })}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-[#a9939e]">
                    ยังไม่มีข้อมูล{tab.label} กด "ซิงค์ตอนนี้" เพื่อดึงข้อมูลจาก Smart Watch
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ท้ายตาราง: จำนวนรายการ + แบ่งหน้า */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f6e6ed] px-6 py-4 text-xs text-[#a9939e]">
          <p>
            แสดง {from}–{to} จาก {total} รายการ · ข้อมูลย้อนหลัง 90 วัน
          </p>

          {totalPages > 1 && (
            <nav aria-label="เปลี่ยนหน้า" className="flex items-center gap-1 text-sm font-semibold">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                aria-label="หน้าก่อนหน้า"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#f05289] hover:bg-[#ffedf3] disabled:cursor-default disabled:text-[#e3cdd7] disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageItems(page, totalPages).map((n, i) =>
                n === '…' ? (
                  <span key={`gap-${i}`} className="grid h-8 w-8 place-items-center text-[#e3cdd7]">…</span>
                ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full ${
                    n === page ? 'bg-[#f66c9c] text-white' : 'text-[#f05289] hover:bg-[#ffedf3]'
                  }`}
                >
                  {n}
                </button>
                )
              )}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                aria-label="หน้าถัดไป"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#f05289] hover:bg-[#ffedf3] disabled:cursor-default disabled:text-[#e3cdd7] disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}

export default Data
