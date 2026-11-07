import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, Cell, LabelList, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine,
} from 'recharts'
import { ArrowDown, HeartPulse, Moon, BellRing } from 'lucide-react'
import api, { getErrorMessage } from '../api.js'

// ช่วงเวลาของรายงาน: tickEvery = แสดงวันที่บนแกน X ทุกกี่วัน
const PERIODS = [
  { days: 7, label: '7 วัน', tickEvery: 1 },
  { days: 30, label: '30 วัน', tickEvery: 5 },
  { days: 90, label: '3 เดือน', tickEvery: 15 },
]

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const PINK = '#f05289'
const PINK_LIGHT = '#ffd1e0'

// "2026-10-14" -> Date ตามเวลาเครื่อง (new Date("2026-10-14") จะได้เวลา UTC ซึ่งเพี้ยน)
const parseDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// "2026-10-14" -> "14 ต.ค."
const shortDate = (key) => {
  const d = parseDateKey(key)
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`
}

// ช่วงวันที่มุมขวา เช่น "29 ก.ย. – 28 ต.ค. 2026"
const rangeLabel = (from, to) => {
  const a = parseDateKey(from)
  const b = parseDateKey(to)
  const yearA = a.getFullYear() !== b.getFullYear() ? ` ${a.getFullYear()}` : ''
  return `${shortDate(from)}${yearA} – ${shortDate(to)} ${b.getFullYear()}`
}

// เวลาจากฐานข้อมูล -> "14 ต.ค." และ "14:20"
const dayMonthOf = (value) => {
  const d = new Date(value)
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`
}

const timeOf = (value) => {
  const d = new Date(value)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const tooltipStyle = {
  borderRadius: '14px',
  border: '1px solid #f1dce5',
  boxShadow: '0 4px 12px rgba(240,82,137,0.08)',
  fontSize: 12,
}

function StatCard({ label, value, unit, note, tone = 'ok' }) {
  const toneClass = { ok: 'text-emerald-600', alert: 'text-[#f05289]', muted: 'text-[#a9939e]' }[tone]
  return (
    <div className="rounded-[18px] border border-[#f1dce5] bg-white px-5 py-4">
      <p className="text-xs text-[#8e7c87]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#3c3038]">
        {value ?? '–'}
        {value != null && unit && <span className="ml-1">{unit}</span>}
      </p>
      <p className={`mt-1.5 text-xs ${toneClass}`}>{note}</p>
    </div>
  )
}

// การ์ดในส่วน "สรุปจากระบบ": ไอคอน + หัวข้อ + ตัวเลขใหญ่ + รายละเอียด
const SUMMARY_ACCENTS = {
  pink: { icon: 'bg-[#ffe3ed] text-[#f05289]', value: 'text-[#f05289]' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-600' },
  green: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-600' },
}

function SummaryCard({ icon: Icon, accent, label, value, unit, empty, children }) {
  const colors = SUMMARY_ACCENTS[accent]
  return (
    <div className="rounded-[18px] bg-white p-5 shadow-sm shadow-pink-100">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${colors.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-[#786671]">{label}</p>
      </div>

      {value == null ? (
        <p className="mt-4 text-sm text-[#a9939e]">{empty}</p>
      ) : (
        <>
          <p className="mt-3 leading-none">
            <span className={`text-4xl font-bold ${colors.value}`}>{value}</span>
            <span className="ml-1.5 text-sm font-medium text-[#8e7c87]">{unit}</span>
          </p>
          <div className="mt-3 text-xs text-[#8e7c87]">{children}</div>
        </>
      )}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="grid h-full place-items-center text-sm text-[#a9939e]">
      ยังไม่มีข้อมูลในช่วงนี้
    </div>
  )
}

function Report() {
  const [members, setMembers] = useState([])
  const [memberId, setMemberId] = useState(null)
  const [period, setPeriod] = useState(PERIODS[1]) // เริ่มที่ 30 วัน ตามแบบ
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // โหลดรายชื่อสมาชิก แล้วเลือกคนแรกไว้ก่อน
  useEffect(() => {
    api.get('/api/family-members')
      .then((res) => {
        setMembers(res.data)
        if (res.data.length > 0) setMemberId(res.data[0].id)
        else setLoading(false)
      })
      .catch((err) => {
        setError(getErrorMessage(err))
        setLoading(false)
      })
  }, [])

  // โหลดรายงานทุกครั้งที่เปลี่ยนสมาชิกหรือช่วงเวลา
  useEffect(() => {
    if (!memberId) return
    let ignore = false // กันข้อมูลเก่าที่ตอบกลับช้ามาทับข้อมูลใหม่
    setLoading(true)

    api.get(`/api/family-members/${memberId}/report`, { params: { days: period.days } })
      .then((res) => {
        if (!ignore) {
          setReport(res.data)
          setError('')
        }
      })
      .catch((err) => !ignore && setError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false))

    return () => {
      ignore = true
    }
  }, [memberId, period])

  // ยังไม่มีสมาชิกในครอบครัว
  if (!loading && members.length === 0) {
    return (
      <section className="rounded-[22px] border border-dashed border-[#f6cedd] bg-[#fffafd] p-10 text-center">
        <h2 className="text-xl font-semibold text-[#3c3038]">ยังไม่มีสมาชิกในครอบครัว</h2>
        <p className="mt-2 text-sm text-[#8e7c87]">เพิ่มสมาชิกก่อน แล้วค่อยกลับมาดูรายงานสุขภาพได้ที่นี่</p>
        <Link
          to="/party"
          className="mt-5 inline-block rounded-[15px] bg-linear-to-r from-[#ff83ad] to-[#f34c8c] px-6 py-2.5 text-sm font-medium text-white hover:brightness-95"
        >
          ไปหน้าสมาชิก
        </Link>
      </section>
    )
  }

  const member = report?.member
  const daily = report?.daily ?? []
  const s = report?.summary

  const hasHr = daily.some((d) => d.avg_hr !== null)
  const hasSleep = daily.some((d) => d.sleep !== null)

  // จุดที่ชีพจรเฉลี่ยรายวันสูงที่สุด (ไว้ทำจุดเด่นบนกราฟ)
  const peakDay = hasHr
    ? daily.reduce((best, d) => (d.avg_hr !== null && (best === null || d.avg_hr > best.avg_hr) ? d : best), null)
    : null

  // ก้าวเดินเทียบกับช่วงก่อนหน้า
  const stepsChange =
    s?.avg_steps != null && s?.prev_avg_steps ? Math.round(((s.avg_steps - s.prev_avg_steps) / s.prev_avg_steps) * 100) : null

  const tickInterval = period.tickEvery - 1
  const showBarLabels = period.days <= 30 // 3 เดือนแท่งแคบเกินจะใส่ตัวเลข

  const alertsTotal = s ? s.alerts.warning + s.alerts.emergency : 0

  return (
    <section className="text-[#3c3038]">
      {/* ส่วนหัว: ชื่อหน้า + ปุ่ม Export */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">รายงานสุขภาพ</h1>
          <p className="mt-1.5 text-[#8e7c87]">
            สรุปข้อมูลจาก Smart Watch ของ {member ? `${member.relation} (${member.name})` : '...'}
          </p>
        </div>

        {/* ปุ่ม Export: ยังไม่ได้ทำฟีเจอร์ กดได้แต่ยังไม่มีอะไรเกิดขึ้น */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {}}
            className="flex cursor-pointer items-center gap-1.5 rounded-[15px] border-2 border-[#f6cedd] bg-white px-5 py-2.5 text-sm font-semibold text-[#f05289] transition hover:bg-[#fff5f8]"
          >
            <ArrowDown className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => {}}
            className="flex cursor-pointer items-center gap-1.5 rounded-[15px] bg-linear-to-r from-[#ff83ad] to-[#f34c8c] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-200 transition hover:brightness-95"
          >
            <ArrowDown className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* เลือกช่วงเวลา + สมาชิก / ช่วงวันที่ */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period.days === p.days}
              className={`cursor-pointer rounded-full px-5 py-2 text-sm font-semibold transition ${
                period.days === p.days
                  ? 'bg-linear-to-r from-[#ff83ad] to-[#f34c8c] text-white shadow-sm shadow-pink-200'
                  : 'bg-[#ffedf3] text-[#f05289] hover:bg-[#ffe3ed]'
              }`}
            >
              {p.label}
            </button>
          ))}

          <select
            value={memberId ?? ''}
            onChange={(e) => setMemberId(Number(e.target.value))}
            aria-label="เลือกสมาชิก"
            className="ml-1 cursor-pointer rounded-full border border-[#f1dce5] bg-white px-4 py-2 text-sm font-medium text-[#786671] focus:outline-none focus:ring-2 focus:ring-[#ffe3ed]"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.relation})
              </option>
            ))}
          </select>
        </div>

        {report && <p className="text-sm text-[#8e7c87]">{rangeLabel(report.from, report.to)}</p>}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
        {/* การ์ดสรุปตัวเลข */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:max-w-3xl">
          <StatCard
            label="ชีพจรเฉลี่ย"
            value={s?.avg_hr}
            unit="bpm"
            note={
              s?.avg_hr == null ? 'ยังไม่มีข้อมูล' : s.avg_hr >= 60 && s.avg_hr <= 100 ? 'ช่วงปกติ' : 'นอกช่วงปกติ (60 – 100)'
            }
            tone={s?.avg_hr == null ? 'muted' : s.avg_hr >= 60 && s.avg_hr <= 100 ? 'ok' : 'alert'}
          />
          <StatCard
            label="ก้าวเฉลี่ย / วัน"
            value={s?.avg_steps?.toLocaleString('en-US')}
            note={
              stepsChange === null
                ? 'ไม่มีข้อมูลช่วงก่อนหน้าให้เทียบ'
                : `${stepsChange >= 0 ? '▲' : '▼'} ${Math.abs(stepsChange)}% จาก ${period.label}ก่อน`
            }
            tone={stepsChange === null ? 'muted' : stepsChange >= 0 ? 'ok' : 'alert'}
          />
          <StatCard
            label="การนอนเฉลี่ย"
            value={s?.avg_sleep}
            unit="ชม."
            note={
              s?.avg_sleep == null
                ? 'ยังไม่มีข้อมูล'
                : s.avg_sleep >= s.sleep_goal
                  ? `ถึงเป้าหมาย ${s.sleep_goal} ชม.`
                  : `ต่ำกว่าเป้าหมาย ${s.sleep_goal} ชม.`
            }
            tone={s?.avg_sleep == null ? 'muted' : s.avg_sleep >= s.sleep_goal ? 'ok' : 'alert'}
          />
        </div>

        {/* กราฟ */}
        <div className="mt-5 grid gap-5 lg:grid-cols-5">
          {/* แนวโน้มชีพจร */}
          <div className="rounded-[22px] border border-[#f1dce5] bg-white p-5 md:p-6 lg:col-span-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">แนวโน้มชีพจร {period.label}</h2>
                <p className="text-xs text-[#a9939e]">ค่าเฉลี่ยรายวัน (bpm)</p>
              </div>
              {peakDay && (
                <span className="rounded-full bg-[#ffe3ed] px-3 py-1 text-xs font-semibold text-[#f05289]">
                  สูงสุด {peakDay.avg_hr}
                </span>
              )}
            </div>

            <div className="mt-4 h-56">
              {hasHr ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily} margin={{ top: 10, right: 12, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PINK} stopOpacity={0.18} />
                        <stop offset="100%" stopColor={PINK} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#f3e7ec" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      interval={tickInterval}
                      tick={{ fontSize: 11, fill: '#8e7c87' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={['dataMin - 10', 'dataMax + 10']}
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#a9939e' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={shortDate}
                      formatter={(v) => [`${v} bpm`, 'ชีพจรเฉลี่ย']}
                    />
                    <Area
                      type="linear"
                      dataKey="avg_hr"
                      stroke={PINK}
                      strokeWidth={2.5}
                      fill="url(#hrFill)"
                      connectNulls
                      dot={false}
                      activeDot={{ r: 5, fill: PINK, stroke: '#fff', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    {peakDay && (
                      <ReferenceDot x={peakDay.date} y={peakDay.avg_hr} r={5} fill="#fff" stroke={PINK} strokeWidth={2.5} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>
          </div>

          {/* การนอนหลับ */}
          <div className="rounded-[22px] border border-[#f1dce5] bg-white p-5 md:p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold">การนอนหลับ (ชม.)</h2>
            <p className="text-xs text-[#a9939e]">เป้าหมาย {s?.sleep_goal ?? 7} ชม./คืน</p>

            <div className="mt-4 h-56">
              {hasSleep ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily} margin={{ top: 14, right: 4, left: 4, bottom: 0 }} barCategoryGap="18%">
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDate}
                      interval={tickInterval}
                      tick={{ fontSize: 11, fill: '#8e7c87' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis hide domain={[0, 10]} />
                    <ReferenceLine y={s.sleep_goal} stroke="#f6cedd" strokeDasharray="4 4" />
                    <Tooltip
                      cursor={{ fill: '#fff5f8' }}
                      contentStyle={tooltipStyle}
                      labelFormatter={shortDate}
                      formatter={(v) => [`${v} ชม.`, 'การนอน']}
                    />
                    <Bar dataKey="sleep" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {/* คืนที่นอนถึงเป้าเป็นสีชมพูเข้ม ไม่ถึงเป้าเป็นสีอ่อน */}
                      {daily.map((d) => (
                        <Cell key={d.date} fill={d.sleep !== null && d.sleep >= s.sleep_goal ? PINK : PINK_LIGHT} />
                      ))}
                      {showBarLabels && (
                        <LabelList
                          dataKey="sleep"
                          position="top"
                          style={{ fontSize: period.days <= 7 ? 11 : 7, fill: '#786671', fontWeight: 600 }}
                        />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </div>
          </div>
        </div>

        {/* สรุปจากระบบ */}
        {s && (
          <div className="mt-5 rounded-[22px] bg-[#fff0f5] p-5 md:p-6">
            <h2 className="text-lg font-semibold">สรุปจากระบบ</h2>
            <p className="text-xs text-[#a9939e]">ช่วง {period.label}ที่ผ่านมา</p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {/* ชีพจรสูงสุด */}
              <SummaryCard
                icon={HeartPulse}
                accent="pink"
                label="ชีพจรสูงสุด"
                value={s.max_hr?.value}
                unit="bpm"
                empty="ยังไม่มีข้อมูลชีพจร"
              >
                {s.max_hr && (
                  <>
                    วันที่ <b className="text-[#3c3038]">{dayMonthOf(s.max_hr.recorded_at)}</b> เวลา{' '}
                    <b className="text-[#3c3038]">{timeOf(s.max_hr.recorded_at)} น.</b>
                  </>
                )}
              </SummaryCard>

              {/* นอนน้อยกว่าเป้า */}
              <SummaryCard
                icon={Moon}
                accent="amber"
                label={`นอนน้อยกว่า ${s.sleep_goal} ชม.`}
                value={s.sleep_days > 0 ? s.short_sleep_days : null}
                unit="วัน"
                empty="ยังไม่มีข้อมูลการนอน"
              >
                {s.sleep_days > 0 && (
                  <>
                    จาก <b className="text-[#3c3038]">{s.sleep_days} คืน</b> ที่มีข้อมูล
                    {s.short_sleep_days === 0 && ' · ถึงเป้าทุกคืน'}
                  </>
                )}
              </SummaryCard>

              {/* การแจ้งเตือน */}
              <SummaryCard icon={BellRing} accent="green" label="การแจ้งเตือนทั้งหมด" value={alertsTotal} unit="ครั้ง">
                <span className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-600">
                    ผิดปกติ {s.alerts.warning}
                  </span>
                  <span className="rounded-full bg-[#ffe3ed] px-2.5 py-0.5 font-semibold text-[#f05289]">
                    ฉุกเฉิน {s.alerts.emergency}
                  </span>
                </span>
              </SummaryCard>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default Report
