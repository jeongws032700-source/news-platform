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

## Colab

Colab에서 MariaDB 설치·실행, 프로젝트 업로드, `cloudflared` 터널 등은 수업 안내에 맞춰 진행하세요. (`colab_step1.ipynb` 참고)

## GitHub에 올리기

로컬에서 이미 `git init`·첫 커밋이 되어 있다면:

1. GitHub에서 **New repository** → 이름만 정하고 README는 비워서 생성.
2. 터미널:

```bash
cd d:\3.16\news-platform
git remote add origin https://github.com/본인아이디/저장소이름.git
git push -u origin main
```

처음이면 GitHub 로그인(토큰/PAT)이 필요할 수 있음.

**커밋 작성자 바꾸기:** `git config user.name "이름"` / `git config user.email "이메일"` (이 폴더만이면 `--global` 빼기)
