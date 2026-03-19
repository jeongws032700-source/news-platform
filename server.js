const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = Number(process.env.PORT) || 3002;
const isProduction = process.env.NODE_ENV === 'production';

// --- MariaDB ---
// 환경 변수가 없으면 과제 기본값을 사용한다.
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'news_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

app.use(express.json());

function trimField(value) {
  return String(value ?? '').trim();
}

function normalizeNewsPayload(body) {
  return {
    title: trimField(body.title),
    category: trimField(body.category),
    content: trimField(body.content),
    author: trimField(body.author)
  };
}

function isValidNewsPayload(news) {
  return (
    news.title !== '' &&
    news.category !== '' &&
    news.content !== '' &&
    news.author !== ''
  );
}

/** @param {Error & { sqlMessage?: string; code?: string }} err */
function logDbError(label, err) {
  const detail = err.sqlMessage || err.message || String(err);
  console.error(`${label}:`, detail);
}

/** @returns {Promise<void>} */
async function checkDbConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('DB 연결 성공');
    conn.release();
  } catch (err) {
    console.error('DB 연결 실패:', err.message);
    console.error('→ MariaDB를 켠 뒤 DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME 값을 확인하세요.');
    throw err;
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
    logDbError('GET /api/news 오류', err);
    res.status(500).json(
      isProduction
        ? { error: '기사 목록을 불러오지 못했습니다.' }
        : {
            error: '기사 목록을 불러오지 못했습니다.',
            details: err.sqlMessage || err.message || String(err)
          }
    );
  }
});

app.post('/api/news', async (req, res) => {
  const news = normalizeNewsPayload(req.body);
  if (!isValidNewsPayload(news)) {
    return res
      .status(400)
      .json({ error: 'title, category, content, author 는 모두 필요합니다.' });
  }

  const sql =
    'INSERT INTO news (title, category, content, author) VALUES (?, ?, ?, ?)';
  try {
    const [result] = await pool.query(sql, [
      news.title,
      news.category,
      news.content,
      news.author
    ]);

    res.status(201).json({
      message: '기사가 등록되었습니다.',
      article: {
        id: result.insertId,
        ...news
      }
    });
  } catch (err) {
    logDbError('POST /api/news 오류', err);
    res.status(500).json(
      isProduction
        ? { error: '기사 등록에 실패했습니다.' }
        : {
            error: '기사 등록에 실패했습니다.',
            details: err.sqlMessage || err.message || String(err)
          }
    );
  }
});

app.delete('/api/news/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '유효한 기사 번호가 필요합니다.' });
  }

  try {
    const [result] = await pool.query('DELETE FROM news WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '삭제할 기사를 찾지 못했습니다.' });
    }

    res.json({ message: '기사가 삭제되었습니다.', id });
  } catch (err) {
    logDbError('DELETE /api/news/:id 오류', err);
    res.status(500).json(
      isProduction
        ? { error: '기사 삭제에 실패했습니다.' }
        : {
            error: '기사 삭제에 실패했습니다.',
            details: err.sqlMessage || err.message || String(err)
          }
    );
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

// 글쓰기 페이지
app.get('/write', async (req, res) => {
  try {
    const htmlPath = path.join(__dirname, 'templates', 'write.html');
    const html = await fs.readFile(htmlPath, 'utf8');
    res.type('html').send(html);
  } catch (err) {
    console.error('GET /write 오류:', err);
    res.status(500).type('text').send('페이지를 불러오지 못했습니다.');
  }
});

/** @returns {Promise<void>} */
async function startServer() {
  await checkDbConnection();

  await new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log('');
      console.log(`  서버 실행 중 — 포트 ${PORT}`);
      console.log(`  브라우저 주소: http://localhost:${PORT}/`);
      console.log(`  글쓰기 페이지: http://localhost:${PORT}/write`);
      console.log('  (index.html 파일을 더블클릭으로 열면 안 됩니다. 반드시 위 주소로 접속하세요.)');
      console.log('');
      resolve();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('');
        console.error(`  포트 ${PORT} 를 이미 다른 프로그램이 사용 중입니다 (EADDRINUSE).`);
        console.error('  해결: 이전에 켜 둔 터미널에서 Ctrl+C 로 끄거나,');
        console.error(
          '  PowerShell에서 PID 확인 후 종료 → netstat -ano | findstr :' + PORT
        );
        console.error('  예: taskkill /PID <위에서_나온_PID> /F');
        console.error('  또는 다른 포트: cmd → set PORT=3003 && node server.js');
        console.error('            PowerShell → $env:PORT=3003; node server.js');
        console.error('');
      }
      reject(err);
    });
  });
}

startServer().catch((err) => {
  console.error('서버 시작 실패:', err);
  process.exit(1);
});
