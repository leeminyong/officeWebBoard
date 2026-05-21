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
// is_pinned : 게시글 고정 여부를 저장합니다. 1이면 고정, 0이면 일반 글입니다.
// 이미 만들어진 DB 파일에도 컬럼을 추가하기 위해 ALTER TABLE을 사용합니다.
// CREATE TABLE의 IF NOT EXISTS 만으로는 기존 DB에 컬럼을 추가할 수 없습니다.
if (!postColumns.includes('is_pinned')) {
  db.exec("ALTER TABLE posts ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0");
}

// boards 테이블이 비어 있으면 기본 게시판 5개를 넣습니다.
// 서버를 처음 실행하거나 DB를 새로 만들 때 한 번만 실행됩니다.
const boardCount = db.prepare('SELECT COUNT(*) as count FROM boards').get().count;
if (boardCount === 0) {
  // prepare() : 같은 SQL을 여러 번 실행할 때 미리 준비해두면 빠릅니다. (안드로이드의 PreparedStatement와 비슷)
  const insertBoard = db.prepare('INSERT INTO boards (key, label, sort_order) VALUES (?, ?, ?)');
  // 기본 게시판 5개를 순서대로 삽입합니다.
  // maintenance-done : '유지보수(완료)' 게시판입니다. 유지보수 게시판 바로 아래에 위치합니다.
  insertBoard.run('project',          '프로젝트',      0);
  insertBoard.run('maintenance',      '유지보수',      1);
  insertBoard.run('maintenance-done', '유지보수(완료)', 2);
  insertBoard.run('app-version',      '앱 버전관리',   3);
  insertBoard.run('files',            '파일',          4);
}

// 기존 DB에 maintenance-done 게시판이 없으면 추가합니다.
// 이미 게시판이 4개 있는 상태에서 서버를 업데이트한 경우를 위한 처리입니다.
const maintenanceDone = db.prepare("SELECT key FROM boards WHERE key = 'maintenance-done'").get();
if (!maintenanceDone) {
  // 유지보수(완료)가 '유지보수' 바로 아래에 오도록 기존 게시판들의 순서를 조정합니다.
  // sort_order가 2 이상인 게시판(app-version, files 등)을 1씩 뒤로 밉니다.
  db.exec("UPDATE boards SET sort_order = sort_order + 1 WHERE sort_order >= 2");
  db.prepare("INSERT INTO boards (key, label, sort_order) VALUES ('maintenance-done', '유지보수(완료)', 2)").run();

  // 기존에 유지보수 게시판에 있던 '완료' 글들을 유지보수(완료) 게시판으로 일괄 이동합니다.
  // LIKE '%완료%' : 제목 어디에든 '완료'가 포함된 글을 찾습니다.
  db.exec("UPDATE posts SET board = 'maintenance-done' WHERE board = 'maintenance' AND title LIKE '%완료%'");
}

module.exports = db;
