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
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- 4. ตาราง health_readings (ข้อมูลสุขภาพรายครั้งจาก Smart Watch เก็บย้อนหลัง 7 วัน)
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
