// ส่งข้อมูลจำลองแบบที่ Garmin push มา ใช้ทดสอบ webhook โดยไม่ต้องมีนาฬิกา
// ใช้: node test-garmin-webhook.js <garmin_user_id> [base_url]
import axios from "axios";

const [garminUserId, baseUrl = "http://localhost:8081"] = process.argv.slice(2);
if (!garminUserId) {
  console.error("ใช้: node test-garmin-webhook.js <garmin_user_id> [base_url]");
  process.exit(1);
}

const today = new Date().toISOString().split("T")[0];
const hr = 60 + Math.floor(Math.random() * 30);

const payload = {
  dailies: [
    {
      userId: garminUserId,
      summaryId: `test-daily-${Date.now()}`,
      calendarDate: today,
      steps: 3000 + Math.floor(Math.random() * 5000),
      restingHeartRateInBeatsPerMinute: hr,
    },
  ],
  sleeps: [
    {
      userId: garminUserId,
      summaryId: `test-sleep-${Date.now()}`,
      calendarDate: today,
      durationInSeconds: 7 * 3600 + Math.floor(Math.random() * 3600),
    },
  ],
};

const res = await axios.post(`${baseUrl}/api/garmin/webhook`, payload);
console.log(`ส่งไป ${baseUrl} ได้สถานะ ${res.status} (ชีพจร ${hr} bpm)`);
