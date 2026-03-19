-- 외부 MariaDB에서 실행하세요. (Colab 안에 DB 설치하지 않음)
-- 예: mysql -h 호스트 -u 사용자 -p 데이터베이스명 < schema.sql

CREATE TABLE IF NOT EXISTS news (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  author VARCHAR(100) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
