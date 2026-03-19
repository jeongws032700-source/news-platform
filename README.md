# 충정일보 신문 플랫폼

Express, MariaDB, HTML/CSS Grid를 사용한 기사 등록·조회 웹 애플리케이션입니다.

## 주요 기능

- 기사 목록 조회: `GET /api/news`
- 기사 등록: `POST /api/news`
- 기사 삭제: `DELETE /api/news/:id`
- 메인 화면에서 최신 기사, 전체 기사 목록, 카테고리, 랭킹 표시
- 기사 작성 페이지에서 새 기사 송고 가능

## 데이터베이스

사용 테이블은 `news`이며 다음 컬럼으로 구성됩니다.

- `id`: 기본키, 자동 증가
- `title`: 기사 제목
- `category`: 기사 카테고리
- `content`: 기사 본문
- `author`: 기자 이름

## 화면 구성

- 메인 페이지는 CSS Grid 기반 12열 레이아웃으로 구성
- 최신 기사는 메인 영역에 크게 표시
- 우측 사이드바에는 랭킹과 카테고리 정보 표시
- 기사 작성 페이지에서 제목, 카테고리, 기자명, 본문 입력 가능

## 사용 기술

- Node.js
- Express
- MariaDB
- mysql2
- HTML
- CSS Grid
- JavaScript (async/await)
