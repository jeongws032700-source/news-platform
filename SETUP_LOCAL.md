# Local Setup

## 1. Move into the project

```powershell
cd D:\3.16\news-platform
```

## 2. Install dependencies

```powershell
npm.cmd install
```

## 3. Create your local environment file

```powershell
Copy-Item .env.example .env
```

Edit `.env` if your MariaDB settings are different.

Example:

```env
PORT=3002
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=news_db
JWT_SECRET=my-secret-key
```

## 4. Create the database tables

Run this SQL in MariaDB:

```sql
CREATE DATABASE IF NOT EXISTS news_db;
USE news_db;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS news (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  author VARCHAR(100) NOT NULL
);
```

## 5. Insert a test user

The sample account below uses:

- username: `reporter1`
- password: `1234`
- display name: `홍길동`

```sql
INSERT INTO users (username, password_hash, display_name)
VALUES (
  'reporter1',
  '$2b$10$3lUCY14YfGVyDvz9/d87AuV2mUlRlErrTzpllAN1TUVrTvUqArA5a',
  '홍길동'
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  display_name = VALUES(display_name);
```

## 6. Start the server

```powershell
node server.js
```

## 7. Open the app

- Main page: `http://localhost:3002/`
- Login page: `http://localhost:3002/login`
- Write page: `http://localhost:3002/write`

## Notes

- This project uses JWT for learning purposes.
- After login, the browser stores the token in `localStorage`.
- `POST /api/news` and `DELETE /api/news/:id` require `Authorization: Bearer <token>`.
