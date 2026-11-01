CREATE DATABASE IF NOT EXISTS signup_login;
USE signup_login;

-- 1. ตาราง users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ตาราง family_members
CREATE TABLE IF NOT EXISTS family_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  relation VARCHAR(50) NOT NULL,
  avatar_text VARCHAR(10) DEFAULT NULL,
  device VARCHAR(100) DEFAULT 'Garmin Smartwatch',
  heart_rate VARCHAR(20) DEFAULT '-',
  steps VARCHAR(20) DEFAULT '-',
  sleep VARCHAR(20) DEFAULT '-',
  status VARCHAR(20) DEFAULT 'ปกติ',
  is_connected TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);