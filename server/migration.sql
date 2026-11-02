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