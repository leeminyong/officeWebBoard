const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'board.db'));

db.exec(`
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

module.exports = db;
