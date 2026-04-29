const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('./database');

const app  = express();
const PORT = 3000;
// 같은 내부망의 다른 PC도 접속할 수 있도록 모든 네트워크 주소에서 요청을 받게 했습니다.
const HOST = '0.0.0.0';
// Browser guide address for this PC on the office network.
const DISPLAY_HOST = '192.168.56.102';

// 첨부파일을 한곳에 보관하려고 uploads 폴더 경로를 정했습니다.
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Keep uploaded files recognizable, but add a unique suffix so same-name files do not overwrite each other.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    const originalName = decodeUploadName(file.originalname);
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    const safeBase = sanitizeFileBaseName(base) || 'file';
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${safeBase}__${unique}${ext}`);
  },
});
// 게시글은 최대 20개, 댓글은 각 API에서 최대 10개까지 받을 수 있게 multer 업로드 기능을 준비했습니다.
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
const BOARDS = new Set(['project', 'maintenance', 'app-version', 'files']);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));
app.get('/marked.js', (req, res) =>
  res.sendFile(path.join(__dirname, 'node_modules/marked/lib/marked.umd.js'))
);
app.get('/turndown.js', (req, res) =>
  res.sendFile(path.join(__dirname, 'node_modules/turndown/lib/turndown.browser.umd.js'))
);

// ── 게시글 목록 (페이지네이션) ──────────────────────────────
app.get('/api/posts', (req, res) => {
  const board  = getBoard(req.query.board);
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = 10;
  const offset = (page - 1) * limit;

  const { count } = db.prepare('SELECT COUNT(*) as count FROM posts WHERE board = ?').get(board);
  const posts = db.prepare(`
    SELECT p.id, p.title, p.author, p.created_at, p.updated_at,
           ROW_NUMBER() OVER (ORDER BY p.id ASC) AS row_num,
           COUNT(DISTINCT c.id) AS comment_count,
           COUNT(DISTINCT f.id) AS file_count
    FROM posts p
    LEFT JOIN comments c ON c.post_id = p.id
    LEFT JOIN files    f ON f.post_id = p.id
    WHERE p.board = ?
    GROUP BY p.id
    ORDER BY p.id ASC
    LIMIT ? OFFSET ?
  `).all(board, limit, offset);

  if (posts.length > 0) {
    const ids = posts.map(p => p.id);
    const placeholders = ids.map(() => '?').join(',');
    const comments = db.prepare(
      `SELECT id, post_id, author, content, created_at FROM comments WHERE post_id IN (${placeholders}) ORDER BY id`
    ).all(...ids);
    const map = {};
    comments.forEach(c => {
      if (!map[c.post_id]) map[c.post_id] = [];
      map[c.post_id].push(c);
    });
    posts.forEach(p => { p.comments = map[p.id] || []; });
  }

  res.json({
    posts,
    pagination: { total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) },
  });
});

// ── 게시글 상세 ────────────────────────────────────────────
// 상세 화면에 댓글과 첨부파일까지 같이 보여주려고 게시글 하나의 관련 데이터를 모두 조회합니다.
app.get('/api/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  const files    = db.prepare('SELECT * FROM files    WHERE post_id = ? ORDER BY id').all(req.params.id);
  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY id').all(req.params.id);

  // 각 댓글에 첨부파일 포함
  comments.forEach(c => {
    c.files = db.prepare('SELECT * FROM comment_files WHERE comment_id = ? ORDER BY id').all(c.id);
  });

  res.json({ ...post, files, comments });
});

// ── 게시글 작성 ────────────────────────────────────────────
// 글 등록 때 본문 데이터와 첨부파일을 한 번에 받기 위해 multipart 업로드로 처리합니다.
app.post('/api/posts', upload.array('files', 20), (req, res) => {
  const { title, content, author } = req.body;
  const board = getBoard(req.body.board);
  if (!title?.trim() || !content?.trim())
    return res.status(400).json({ error: '제목과 내용은 필수입니다.' });

  const result = db.prepare('INSERT INTO posts (title, content, author, board) VALUES (?, ?, ?, ?)')
    .run(title.trim(), content.trim(), (author || '익명').trim(), board);

  const postId = Number(result.lastInsertRowid);
  saveFiles(postId, req.files);
  res.json({ id: postId });
});

// ── 게시글 수정 ────────────────────────────────────────────
// 글 수정 때 기존 글 내용을 바꾸고, 삭제할 파일과 새로 추가한 파일을 함께 처리합니다.
app.put('/api/posts/:id', upload.array('files', 20), (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  const { title, content, author, deleteFileIds } = req.body;
  db.prepare(`
    UPDATE posts SET title = ?, content = ?, author = ?,
    updated_at = datetime('now','localtime') WHERE id = ?
  `).run(title.trim(), content.trim(), (author || '익명').trim(), req.params.id);

  // 수정 화면에서 삭제 표시한 기존 첨부파일은 실제 파일과 DB 기록을 같이 지웁니다.
  if (deleteFileIds) {
    JSON.parse(deleteFileIds).forEach(fid => deleteFile(fid));
  }

  saveFiles(req.params.id, req.files);
  res.json({ success: true });
});

// ── 게시글 삭제 ────────────────────────────────────────────
// 글을 삭제하면 게시글 파일, 댓글, 댓글 파일까지 남지 않도록 함께 정리합니다.
app.delete('/api/posts/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  db.prepare('SELECT * FROM files WHERE post_id = ?').all(req.params.id)
    .forEach(f => fs.unlink(f.file_path, () => {}));

  // 댓글 첨부파일도 삭제
  const commentIds = db.prepare('SELECT id FROM comments WHERE post_id = ?').all(req.params.id).map(c => c.id);
  commentIds.forEach(cid => {
    db.prepare('SELECT * FROM comment_files WHERE comment_id = ?').all(cid)
      .forEach(f => fs.unlink(f.file_path, () => {}));
    db.prepare('DELETE FROM comment_files WHERE comment_id = ?').run(cid);
  });

  db.prepare('DELETE FROM files    WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts    WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── 댓글 작성 ─────────────────────────────────────────────
// 댓글 등록 때 댓글 내용과 댓글 첨부파일을 한 번에 저장합니다.
app.post('/api/posts/:id/comments', upload.array('files', 10), (req, res) => {
  const { author, content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '댓글 내용은 필수입니다.' });

  const result = db.prepare('INSERT INTO comments (post_id, author, content) VALUES (?, ?, ?)')
    .run(req.params.id, (author || '익명').trim(), content.trim());

  const commentId = Number(result.lastInsertRowid);
  saveCommentFiles(commentId, req.files);

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  comment.files = db.prepare('SELECT * FROM comment_files WHERE comment_id = ? ORDER BY id').all(commentId);
  res.json(comment);
});

// ── 댓글 삭제 ─────────────────────────────────────────────
// 댓글 삭제 때 댓글에 붙은 첨부파일도 같이 지워서 불필요한 파일이 남지 않게 합니다.
app.delete('/api/posts/:id/comments/:cid', (req, res) => {
  const cfList = db.prepare('SELECT * FROM comment_files WHERE comment_id = ?').all(req.params.cid);
  cfList.forEach(f => fs.unlink(f.file_path, () => {}));
  db.prepare('DELETE FROM comment_files WHERE comment_id = ?').run(req.params.cid);
  db.prepare('DELETE FROM comments WHERE id = ? AND post_id = ?').run(req.params.cid, req.params.id);
  res.json({ success: true });
});

// ── 댓글 파일 다운로드 ────────────────────────────────────
// 댓글 첨부파일을 원래 파일명으로 내려받을 수 있게 다운로드 응답을 보냅니다.
app.get('/api/comment-files/:id/download', (req, res) => {
  const file = db.prepare('SELECT * FROM comment_files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  res.download(file.file_path, file.original_name);
});

// ── 댓글 파일 삭제 ───────────────────────────────────────
// 댓글 첨부파일 하나만 삭제할 때 실제 파일과 DB 기록을 함께 삭제합니다.
app.delete('/api/comment-files/:id', (req, res) => {
  const file = db.prepare('SELECT * FROM comment_files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  fs.unlink(file.file_path, () => {});
  db.prepare('DELETE FROM comment_files WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── 파일 다운로드 ──────────────────────────────────────────
// 게시글 첨부파일을 원래 파일명으로 내려받을 수 있게 다운로드 응답을 보냅니다.
app.get('/api/files/:id/download', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  res.download(file.file_path, file.original_name);
});

// ── 게시글 파일 삭제 ──────────────────────────────────────
// 게시글 첨부파일 하나만 삭제할 때 실제 파일과 DB 기록을 함께 삭제합니다.
app.delete('/api/files/:id', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  fs.unlink(file.file_path, () => {});
  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── 헬퍼 ──────────────────────────────────────────────────
// 게시글에 새로 첨부한 파일 정보를 files 테이블에 저장합니다.
function saveFiles(postId, files) {
  if (!files || files.length === 0) return;
  const stmt = db.prepare(
    'INSERT INTO files (post_id, filename, original_name, file_path, file_size) VALUES (?, ?, ?, ?, ?)'
  );
  files.forEach(f => {
    // Store the original display name separately because the saved disk name has a unique suffix.
    const originalName = decodeUploadName(f.originalname);
    stmt.run(postId, f.filename, originalName, f.path, f.size);
  });
}

// 댓글에 새로 첨부한 파일 정보를 comment_files 테이블에 저장합니다.
function saveCommentFiles(commentId, files) {
  if (!files || files.length === 0) return;
  const stmt = db.prepare(
    'INSERT INTO comment_files (comment_id, filename, original_name, file_path, file_size) VALUES (?, ?, ?, ?, ?)'
  );
  files.forEach(f => {
    // Store the original display name separately because the saved disk name has a unique suffix.
    const originalName = decodeUploadName(f.originalname);
    stmt.run(commentId, f.filename, originalName, f.path, f.size);
  });
}

// Restore Korean filenames that multer can receive as Latin-1 encoded text.
function decodeUploadName(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

// Remove characters Windows cannot use in filenames and keep the saved name readable.
function sanitizeFileBaseName(name) {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// 수정 화면에서 삭제한 게시글 첨부파일을 실제 파일과 DB에서 함께 제거합니다.
function deleteFile(fileId) {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
  if (!file) return;
  fs.unlink(file.file_path, () => {});
  db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
}

function getBoard(board) {
  return BOARDS.has(board) ? board : 'project';
}

// Use plain HTTP again so every office laptop can connect without installing certificates.
app.listen(PORT, HOST, () => {
  console.log(`게시판 서버 실행 중 → http://${DISPLAY_HOST}:${PORT}`);
});
