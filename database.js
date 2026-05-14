const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'board.db'));

db.exec(`
  -- 게시판 목록을 저장하는 테이블입니다. 사용자가 추가한 게시판도 여기에 보관됩니다.
  CREATE TABLE IF NOT EXISTS boards (
    key        TEXT PRIMARY KEY,               -- 게시판 고유 식별자 (URL에 사용, 예: 'project')
    label      TEXT NOT NULL,                  -- 화면에 보이는 게시판 이름 (예: '프로젝트')
    sort_order INTEGER NOT NULL DEFAULT 0,     -- 메뉴 순서 (작은 숫자가 위에 표시됨)
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    author     TEXT NOT NULL DEFAULT '익명',
    board      TEXT NOT NULL DEFAULT 'project',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id       INTEGER NOT NULL,
    filename      TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path     TEXT NOT NULL,
    file_size     INTEGER NOT NULL,
    created_at    TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (post_id) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id    INTEGER NOT NULL,
    author     TEXT NOT NULL DEFAULT '익명',
    content    TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (post_id) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS comment_files (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id    INTEGER NOT NULL,
    filename      TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path     TEXT NOT NULL,
    file_size     INTEGER NOT NULL,
    created_at    TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (comment_id) REFERENCES comments(id)
  );
`);

const postColumns = db.prepare('PRAGMA table_info(posts)').all().map(col => col.name);
if (!postColumns.includes('board')) {
  db.exec("ALTER TABLE posts ADD COLUMN board TEXT NOT NULL DEFAULT 'project'");
}

// boards 테이블이 비어 있으면 기본 게시판 4개를 넣습니다.
// 서버를 처음 실행하거나 DB를 새로 만들 때 한 번만 실행됩니다.
const boardCount = db.prepare('SELECT COUNT(*) as count FROM boards').get().count;
if (boardCount === 0) {
  // prepare() : 같은 SQL을 여러 번 실행할 때 미리 준비해두면 빠릅니다. (안드로이드의 PreparedStatement와 비슷)
  const insertBoard = db.prepare('INSERT INTO boards (key, label, sort_order) VALUES (?, ?, ?)');
  // 기존 게시판 4개를 순서대로 삽입합니다.
  insertBoard.run('project',     '프로젝트',   0);
  insertBoard.run('maintenance', '유지보수',   1);
  insertBoard.run('app-version', '앱 버전관리', 2);
  insertBoard.run('files',       '파일',       3);
}

module.exports = db;
