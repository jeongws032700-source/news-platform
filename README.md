# 충정일보 신문 플랫폼 (news-platform)

Express + MariaDB + HTML/CSS Grid. 로컬 또는 Google Colab + Cloudflared 로 실행.

## 구조

- `server.js` — API, 정적 파일, `templates` / `static`
- `templates/index.html` — 메인 페이지
- `static/styles.css`, `static/images/` — 스타일·이미지
- `db/schema.sql` — `news` 테이블

## 로컬 실행

```bash
npm install
# server.js 의 dbConfig 수정 후
npm start
```

브라우저: http://localhost:3002

## DB

MariaDB에 `schema.sql` 실행 후 `server.js`의 `host`, `user`, `password`, `database` 를 맞춤.
