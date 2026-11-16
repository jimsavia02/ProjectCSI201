-- schema.sql : สำหรับขึ้นระบบใหม่/สร้างฐานข้อมูลเปล่าตั้งแต่ต้น

CREATE DATABASE IF NOT EXISTS signup_login 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE signup_login;

-- 1. ตาราง users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  line_user_id VARCHAR(64) DEFAULT NULL UNIQUE, -- LINE userId ที่ผูกไว้รับแจ้งเตือน (1 LINE ผูกได้แค่ 1 บัญชี)
  line_link_code VARCHAR(10) DEFAULT NULL,      -- รหัส 6 หลักชั่วคราวสำหรับจับคู่ LINE
  line_link_expires DATETIME DEFAULT NULL,
  line_snooze_until DATETIME DEFAULT NULL,      -- พิมพ์ "ปลอดภัย" ใน LINE -> หยุดแจ้งเตือนถึงเวลานี้
  line_login_token CHAR(64) DEFAULT NULL,       -- sha256 ของ magic link จากปุ่มใน LINE (ใช้ได้ครั้งเดียว)
  line_login_expires DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_line_login_token (line_login_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ตาราง family_members
CREATE TABLE IF NOT EXISTS family_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  relation VARCHAR(50) NOT NULL,
  avatar_text VARCHAR(10) DEFAULT NULL,
  device VARCHAR(100) DEFAULT NULL, -- ปรับเป็น NULL เพื่อให้แสดง "ยังไม่ได้เชื่อมต่ออุปกรณ์" เมื่อยังไม่เชื่อมต่อ
  heart_rate VARCHAR(20) DEFAULT '-',
  steps VARCHAR(20) DEFAULT '-',
  sleep VARCHAR(20) DEFAULT '-',
  status VARCHAR(20) DEFAULT 'ไม่มีข้อมูล',
  is_connected TINYINT(1) DEFAULT 0,
  garmin_user_id VARCHAR(255) DEFAULT NULL,
  garmin_access_token TEXT DEFAULT NULL,
  garmin_refresh_token TEXT DEFAULT NULL,
  garmin_token_expires_at BIGINT DEFAULT NULL,
  last_synced_at DATETIME DEFAULT NULL,
  last_alert_at DATETIME DEFAULT NULL, -- เวลาที่ส่งแจ้งเตือน LINE ล่าสุด
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ตาราง health_history
CREATE TABLE IF NOT EXISTS health_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  record_date DATE NOT NULL,
  sleep_hours DECIMAL(3,1) DEFAULT 0.0,
  avg_hr INT DEFAULT 75,
  steps INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
  UNIQUE KEY unique_member_date (member_id, record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ตาราง health_readings (ข้อมูลสุขภาพรายครั้งจาก Smart Watch เก็บย้อนหลัง 90 วัน)
CREATE TABLE IF NOT EXISTS health_readings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  type VARCHAR(20) NOT NULL,           -- heart_rate | steps | sleep | stress
  value DECIMAL(7,1) DEFAULT NULL,     -- NULL = ไม่มีข้อมูล (อุปกรณ์ไม่ได้เชื่อมต่อ)
  source VARCHAR(100) DEFAULT NULL,    -- ชื่ออุปกรณ์ที่ส่งข้อมูลมา
  recorded_at DATETIME NOT NULL,       -- เวลาที่นาฬิกาวัดค่า
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
  INDEX idx_member_type_time (member_id, type, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ตาราง support_messages (แชทซัพพอร์ตระหว่างผู้ใช้กับ admin)
CREATE TABLE IF NOT EXISTS support_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,                -- ห้องแชทของผู้ใช้คนไหน (1 ผู้ใช้ = 1 ห้องแชทกับ admin)
  sender_role VARCHAR(20) NOT NULL,    -- 'user' = ผู้ใช้ส่ง | 'admin' = เจ้าหน้าที่ตอบ
  sender_id INT DEFAULT NULL,          -- id ของคนที่ส่ง (admin คนไหนตอบ)
  message TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,        -- อีกฝั่งเปิดอ่านแล้วหรือยัง (ใช้ทำจุดแดงแจ้งเตือน)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_time (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. ตาราง emergency_cases (เคสเหตุฉุกเฉินที่ admin ติดตาม: ชีพจรผิดปกติ / SOS / ล้ม)
CREATE TABLE IF NOT EXISTS emergency_cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  type VARCHAR(10) NOT NULL,                    -- hr = ชีพจรผิดปกติ (เผื่อเพิ่ม sos / fall เมื่อนาฬิการองรับ)
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open = ยังไม่มีผู้รับ | in_progress = กำลังดูแล | closed = ปิดแล้ว
  bpm INT DEFAULT NULL,                         -- ชีพจรตอนเปิดเคส
  peak_bpm INT DEFAULT NULL,                    -- ค่าที่ผิดปกติที่สุดระหว่างเคส
  last_bpm INT DEFAULT NULL,                    -- ชีพจรล่าสุด
  last_bpm_at DATETIME DEFAULT NULL,
  recovered_at DATETIME DEFAULT NULL,           -- ชีพจรกลับมาปกติเมื่อไร (ยังไม่ปิดเคสเอง)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME DEFAULT NULL,        -- มีผู้รับเรื่องเมื่อไร (ผู้ดูแลทาง LINE หรือ admin)
  closed_at DATETIME DEFAULT NULL,
  FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,
  INDEX idx_status_created (status, created_at),
  INDEX idx_member_type_status (member_id, type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. ตาราง emergency_case_events (ไทม์ไลน์ของแต่ละเคส)
CREATE TABLE IF NOT EXISTS emergency_case_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  kind VARCHAR(20) NOT NULL,                    -- created | line | ack | status | note | hr | recovered
  actor VARCHAR(20) NOT NULL DEFAULT 'system', -- system | caregiver | admin
  admin_id INT DEFAULT NULL,                    -- admin ที่ทำรายการ
  message VARCHAR(500) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES emergency_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_case_time (case_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
