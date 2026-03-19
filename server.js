const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3002;

// --- MariaDB (server.js 에서 직접 수정) ---
// Colab: 127.0.0.1 은 "Colab 머신 안" 이다. PC/학교 DB에 붙으려면
//        수업에서 준 외부 호스트(도메인/IP)를 host 에 넣어야 한다.
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '',
  database: 'your_database_name',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

/** @param {Error & { sqlMessage?: string; code?: string }} err */
function dbErrorPayload(err) {
  const details = err.sqlMessage || err.message || String(err);
  return { details, code: err.code };
}

app.use(express.json());

/** @returns {Promise<void>} */
async function checkDbConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('DB 연결 성공');
    conn.release();
  } catch (err) {
    console.error('DB 연결 실패:', err.message);
    console.error('→ server.js 의 dbConfig 를 MariaDB 정보로 수정하세요.');
  }
}

// API (정적 파일보다 먼저)
app.get('/api/news', async (req, res) => {
  const sql =
    'SELECT id, title, category, content, author FROM news ORDER BY id DESC';
  try {
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/news 오류:', err);
    res.status(500).json({
      error: '기사 목록을 불러오지 못했습니다.',
      ...dbErrorPayload(err)
    });
  }
});

app.post('/api/news', async (req, res) => {
  const { title, category, content, author } = req.body;
  if (
    title === undefined ||
    category === undefined ||
    content === undefined ||
    author === undefined ||
    String(title).trim() === '' ||
    String(category).trim() === '' ||
    String(content).trim() === '' ||
    String(author).trim() === ''
  ) {
    return res
      .status(400)
      .json({ error: 'title, category, content, author 는 모두 필요합니다.' });
  }
  const sql =
    'INSERT INTO news (title, category, content, author) VALUES (?, ?, ?, ?)';
  try {
    await pool.query(sql, [title, category, content, author]);
    res.json({ message: '기사가 등록되었습니다.' });
  } catch (err) {
    console.error('POST /api/news 오류:', err);
    res.status(500).json({
      error: '기사 등록에 실패했습니다.',
      ...dbErrorPayload(err)
    });
  }
});

// 정적: /static → static/ (css, images 등)
app.use('/static', express.static(path.join(__dirname, 'static')));

// 루트: templates/index.html
app.get('/', async (req, res) => {
  try {
    const htmlPath = path.join(__dirname, 'templates', 'index.html');
    const html = await fs.readFile(htmlPath, 'utf8');
    res.type('html').send(html);
  } catch (err) {
    console.error('GET / 오류:', err);
    res.status(500).type('text').send('페이지를 불러오지 못했습니다.');
  }
});

/** @returns {Promise<void>} */
async function startServer() {
  await checkDbConnection();

  await new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`서버가 포트 ${PORT}에서 작동 중입니다.`);
      resolve();
    });
  });
}

startServer().catch((err) => {
  console.error('서버 시작 실패:', err);
  process.exit(1);
});
