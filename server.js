require('dotenv').config();

const path = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcrypt');
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
 

const app = express();
const PORT = Number(process.env.PORT) || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-key';
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

// 비밀번호를 그대로 저장하지 않고 해시값으로 바꾸기 위한 함수
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// 로그인 시 입력한 비밀번호를 같은 방식으로 해시해서 비교하는 함수
async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

// 로그인 성공 시 사용할 JWT를 만드는 함수
function generateToken(user) {
  return jwt.sign(
    {
      id: user.user_id,
      username: user.user_id,
      displayName: user.user_name
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// 요청 헤더에 담긴 JWT가 유효한지 검사하는 미들웨어
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  // Authorization 헤더는 보통 "Bearer 토큰값" 형태로 들어온다.
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // 다음 라우트에서 로그인한 사용자 정보를 꺼내 쓸 수 있게 저장한다.
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
  }
}

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

function normalizeLoginPayload(body) {
  return {
    username: trimField(body.username),
    password: trimField(body.password)
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
app.post('/api/login', async (req, res) => {
  const login = normalizeLoginPayload(req.body);

  if (login.username === '' || login.password === '') {
    return res
      .status(400)
      .json({ error: 'username과 password를 모두 입력해야 합니다.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT user_id, user_pw, user_name FROM users WHERE user_id = ? LIMIT 1',
      [login.username]
    );

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = rows[0];
    const isPasswordValid = await verifyPassword(
      login.password,
      user.user_pw
    );

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = generateToken(user);

    res.json({
      message: '로그인되었습니다.',
      token,
      user: {
        id: user.user_id,
        username: user.user_id,
        displayName: user.user_name
      }
    });
  } catch (err) {
    logDbError('POST /api/login 오류', err);
    res.status(500).json(
      isProduction
        ? { error: '로그인 처리 중 문제가 발생했습니다.' }
        : {
            error: '로그인 처리 중 문제가 발생했습니다.',
            details: err.sqlMessage || err.message || String(err)
          }
    );
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, user_name FROM users WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '사용자 정보를 찾을 수 없습니다.' });
    }

    const user = rows[0];

    res.json({
      user: {
        id: user.user_id,
        username: user.user_id,
        displayName: user.user_name
      }
    });
  } catch (err) {
    logDbError('GET /api/me 오류', err);
    res.status(500).json(
      isProduction
        ? { error: '사용자 정보를 불러오지 못했습니다.' }
        : {
            error: '사용자 정보를 불러오지 못했습니다.',
            details: err.sqlMessage || err.message || String(err)
          }
    );
  }
});

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

app.post('/api/news', requireAuth, async (req, res) => {
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

app.delete('/api/news/:id', requireAuth, async (req, res) => {
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
app.get('/login', async (req, res) => {
  try {
    const htmlPath = path.join(__dirname, 'templates', 'login.html');
    const html = await fs.readFile(htmlPath, 'utf8');
    res.type('html').send(html);
  } catch (err) {
    console.error('GET /login 오류:', err);
    res.status(500).type('text').send('페이지를 불러오지 못했습니다.');
  }
});

// JWT를 localStorage에 저장하는 방식이라 /write 진입 자체는 허용하고,
// 실제 보호는 클라이언트의 토큰 확인과 POST /api/news 인증으로 처리한다.
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
