-- migration.sql : สำหรับรันอัปเดตเครื่องที่มีฐานข้อมูลเวอร์ชันเก่าอยู่แล้ว


USE signup_login;[cite: 3]

-- 1. เพิ่มคอลัมน์ role ในตาราง users (กรณีตารางเดิมยังไม่มี)[cite: 3]
ALTER TABLE users 
  ADD COLUMN role VARCHAR(20) DEFAULT 'user';[cite: 3]

-- 2. เพิ่มคอลัมน์สำหรับ Garmin และสถานะในตาราง family_members[cite: 3]
ALTER TABLE family_members 
  ADD COLUMN garmin_user_id VARCHAR(255) DEFAULT NULL,[cite: 3]
  ADD COLUMN garmin_access_token TEXT DEFAULT NULL,[cite: 3]
  ADD COLUMN garmin_refresh_token TEXT DEFAULT NULL,[cite: 3]
  ADD COLUMN garmin_token_expires_at BIGINT DEFAULT NULL,[cite: 3]
  ADD COLUMN last_synced_at DATETIME DEFAULT NULL;[cite: 3]

-- 3. ปรับ ค่าเริ่มต้น (Default Value) และค่า Nullable ของตาราง family_members
ALTER TABLE family_members
  MODIFY COLUMN device VARCHAR(100) DEFAULT NULL,
  ALTER COLUMN heart_rate SET DEFAULT '-',[cite: 3]
  ALTER COLUMN steps SET DEFAULT '-',[cite: 3]
  ALTER COLUMN sleep SET DEFAULT '-',[cite: 3]
  ALTER COLUMN status SET DEFAULT 'ไม่มีข้อมูล';[cite: 3]

-- 4. เคลียร์ข้อมูลสมาชิกเดิมที่ยังไม่เคยซิงค์ ให้เป็น "ไม่มีข้อมูล"[cite: 3]
UPDATE family_members
SET heart_rate = '-',[cite: 3]
    steps = '-',[cite: 3]
    sleep = '-',[cite: 3]
    status = 'ไม่มีข้อมูล'[cite: 3]
WHERE last_synced_at IS NULL;[cite: 3]

-- 5. สร้างตาราง health_history หากตารางเดิมยังไม่มี[cite: 3]
CREATE TABLE IF NOT EXISTS health_history (
  id INT AUTO_INCREMENT PRIMARY KEY,[cite: 3]
  member_id INT NOT NULL,[cite: 3]
  record_date DATE NOT NULL,[cite: 3]
  sleep_hours DECIMAL(3,1) DEFAULT 0.0,[cite: 3]
  avg_hr INT DEFAULT 75,[cite: 3]
  steps INT DEFAULT 0,[cite: 3]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,[cite: 3]
  FOREIGN KEY (member_id) REFERENCES family_members(id) ON DELETE CASCADE,[cite: 3]
  UNIQUE KEY unique_member_date (member_id, record_date)[cite: 3]
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;