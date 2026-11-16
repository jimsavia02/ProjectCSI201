USE signup_login;

-- ===================================================
-- 1. เพิ่มคอลัมน์ role ในตาราง users (ถ้ายังไม่มี)
-- ===================================================
SET @exist_role := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role');
SET @sql_role := IF(@exist_role = 0, 'ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT ''user'';', 'SELECT "Column role already exists";');
PREPARE stmt_role FROM @sql_role;
EXECUTE stmt_role;
DEALLOCATE PREPARE stmt_role;

-- ===================================================
-- 2. เพิ่มคอลัมน์ Garmin, เบอร์ฉุกเฉิน และสถานะในตาราง family_members
-- ===================================================
ALTER TABLE family_members 
  ADD COLUMN IF NOT EXISTS garmin_user_id VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS garmin_access_token TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS garmin_refresh_token TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS garmin_token_expires_at BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_synced_at DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50) DEFAULT NULL;

-- ===================================================
-- 3. ปรับค่าเริ่มต้น (Default Value) และค่า Nullable ของตาราง family_members
-- ===================================================
ALTER TABLE family_members
  MODIFY COLUMN device VARCHAR(100) DEFAULT NULL,
  ALTER COLUMN heart_rate SET DEFAULT '-',
  ALTER COLUMN steps SET DEFAULT '-',
  ALTER COLUMN sleep SET DEFAULT '-',
  ALTER COLUMN status SET DEFAULT 'ไม่มีข้อมูล';

-- ===================================================
-- 4. เคลียร์ข้อมูลสมาชิกเดิมที่ยังไม่เคยซิงค์ ให้เป็น "ไม่มีข้อมูล"
-- ===================================================
UPDATE family_members
SET heart_rate = '-',
    steps = '-',
    sleep = '-',
    status = 'ไม่มีข้อมูล'
WHERE last_synced_at IS NULL;

-- ===================================================
-- 5. สร้างตาราง health_history (เก็บประวัติสุขภาพย้อนหลัง)
-- ===================================================
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

-- ===================================================
-- 6. สร้างตาราง appointments (จัดเก็บรายการนัดหมายแพทย์)
-- ===================================================
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  member_id INT NOT NULL,
  appointment_date VARCHAR(50) NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  doctor_name VARCHAR(100) NOT NULL,
  hospital_name VARCHAR(100) NOT NULL,
  reminder_note VARCHAR(100) DEFAULT 'ล่วงหน้า 1 วัน',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- 7. สร้างตาราง health_readings (ข้อมูลสุขภาพรายครั้งจาก Smart Watch เก็บย้อนหลัง 90 วัน)
-- ===================================================
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


-- ===================================================
-- 8. เพิ่มคอลัมน์เบอร์โทรศัพท์ในตาราง users (ใช้ในหน้าสมัครสมาชิกและหน้าตั้งค่า)
-- ===================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL AFTER email;


-- ===================================================
-- 9. สร้างตาราง support_messages (แชทซัพพอร์ตระหว่างผู้ใช้กับ admin)
-- ===================================================
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


-- ===================================================
-- 10. เชื่อม LINE แจ้งเตือนชีพจรผิดปกติ (1 LINE ผูกได้แค่ 1 บัญชี)
-- ===================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS line_user_id VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS line_link_code VARCHAR(10) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS line_link_expires DATETIME DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS line_snooze_until DATETIME DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_line_user_id ON users (line_user_id);
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS last_alert_at DATETIME DEFAULT NULL;


-- ===================================================
-- 11. Magic link จากปุ่มใน LINE (เก็บ sha256 ของ token, ใช้ได้ครั้งเดียว อายุ 5 นาที)
-- ===================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS line_login_token CHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS line_login_expires DATETIME DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_line_login_token ON users (line_login_token);


-- ===================================================
-- 12. เหตุฉุกเฉิน (หน้า admin "เหตุฉุกเฉิน")
-- ===================================================
-- ตาราง emergency_cases (เคสเหตุฉุกเฉินที่ admin ติดตาม: ชีพจรผิดปกติ / SOS / ล้ม)
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

-- ตาราง emergency_case_events (ไทม์ไลน์ของแต่ละเคส)
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
