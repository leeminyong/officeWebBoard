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
const DISPLAY_HOST = '192.168.0.139';

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

// 서버 시작 시 DB에서 게시판 목록을 불러와 Set으로 만듭니다.
// Set : 중복 없이 값을 모아두는 자료구조입니다. (안드로이드의 HashSet과 비슷)
// 게시글 저장/조회 시 유효한 게시판인지 빠르게 확인하는 데 사용합니다.
const BOARDS = new Set(db.prepare('SELECT key FROM boards').all().map(b => b.key));

// 기본 게시판 목록입니다. 이 게시판들은 수정하거나 삭제할 수 없습니다.
// 사용자가 추가한 게시판의 key는 'board_숫자' 형태여서 여기에 포함되지 않습니다.
const DEFAULT_BOARD_KEYS = new Set(['project', 'maintenance', 'app-version', 'files']);

app.use(express.json());
const distDir = path.join(__dirname, 'dist');
app.use(express.static(fs.existsSync(distDir) ? distDir : path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ── 게시판 목록 조회 ───────────────────────────────────────
// 프론트엔드에서 사이드바 메뉴를 그릴 때 이 API로 게시판 목록을 가져갑니다.
app.get('/api/boards', (req, res) => {
  // sort_order 오름차순 → created_at 오름차순 순으로 정렬해서 반환합니다.
  const boards = db.prepare('SELECT key, label FROM boards ORDER BY sort_order ASC, created_at ASC').all();
  res.json(boards);
});

// ── 게시판 추가 ────────────────────────────────────────────
// 사용자가 "게시판 추가하기"로 새 메뉴를 만들 때 호출됩니다.
app.post('/api/boards', (req, res) => {
  const { label } = req.body;

  // label(게시판 이름)이 없으면 오류를 반환합니다.
  if (!label?.trim()) return res.status(400).json({ error: '게시판 이름을 입력해주세요.' });

  const trimmed = label.trim();

  // 같은 이름의 게시판이 이미 있는지 확인합니다.
  const existing = db.prepare('SELECT key FROM boards WHERE label = ?').get(trimmed);
  if (existing) return res.status(409).json({ error: '같은 이름의 게시판이 이미 있습니다.' });

  // 새 게시판의 key를 타임스탬프 기반으로 자동 생성합니다.
  // 예) 'board_1715000000000' — 사용자가 직접 입력할 필요 없습니다.
  const key = 'board_' + Date.now();

  // 현재 게시판 수를 sort_order로 사용해서 항상 맨 아래에 추가됩니다.
  const sortOrder = db.prepare('SELECT COUNT(*) as count FROM boards').get().count;
  db.prepare('INSERT INTO boards (key, label, sort_order) VALUES (?, ?, ?)').run(key, trimmed, sortOrder);

  // 서버 메모리의 BOARDS Set에도 추가해서 새 게시판에 글을 바로 쓸 수 있게 합니다.
  BOARDS.add(key);

  res.json({ key, label: trimmed });
});

// ── 게시판 이름 수정 ────────────────────────────────────────
// 사용자가 추가한 게시판(key가 'board_'로 시작)의 이름을 바꿀 때 호출됩니다.
// PUT /api/boards/:key → 특정 key의 게시판 이름을 label로 변경합니다.
app.put('/api/boards/:key', (req, res) => {
  const { key } = req.params;    // URL에서 게시판 key를 꺼냅니다. 예) /api/boards/board_123 → key = 'board_123'
  const { label } = req.body;   // 요청 body에서 새 이름을 꺼냅니다.

  // 기본 게시판은 수정할 수 없습니다.
  if (DEFAULT_BOARD_KEYS.has(key))
    return res.status(403).json({ error: '기본 게시판은 수정할 수 없습니다.' });

  // 존재하지 않는 게시판이면 오류를 반환합니다.
  if (!BOARDS.has(key))
    return res.status(404).json({ error: '게시판을 찾을 수 없습니다.' });

  // 이름이 비어 있으면 오류를 반환합니다.
  if (!label?.trim())
    return res.status(400).json({ error: '게시판 이름을 입력해주세요.' });

  const trimmed = label.trim();

  // 같은 이름이 이미 있는지 확인합니다. 자기 자신(key)은 제외하고 비교합니다.
  const existing = db.prepare('SELECT key FROM boards WHERE label = ? AND key != ?').get(trimmed, key);
  if (existing) return res.status(409).json({ error: '같은 이름의 게시판이 이미 있습니다.' });

  // DB의 게시판 이름을 업데이트합니다.
  db.prepare('UPDATE boards SET label = ? WHERE key = ?').run(trimmed, key);

  res.json({ key, label: trimmed });
});

// ── 게시판 삭제 ────────────────────────────────────────────
// 사용자가 추가한 게시판과 그 안의 게시글/댓글/첨부파일을 모두 삭제합니다.
// DELETE /api/boards/:key → 해당 key의 게시판을 삭제합니다.
app.delete('/api/boards/:key', (req, res) => {
  const { key } = req.params;

  // 기본 게시판은 삭제할 수 없습니다.
  if (DEFAULT_BOARD_KEYS.has(key))
    return res.status(403).json({ error: '기본 게시판은 삭제할 수 없습니다.' });

  // 존재하지 않는 게시판이면 오류를 반환합니다.
  if (!BOARDS.has(key))
    return res.status(404).json({ error: '게시판을 찾을 수 없습니다.' });

  // 해당 게시판의 모든 게시글 id를 가져옵니다.
  const posts = db.prepare('SELECT id FROM posts WHERE board = ?').all(key);
  const postIds = posts.map(p => p.id);

  // 게시글이 하나 이상 있을 때만 관련 데이터를 삭제합니다.
  if (postIds.length > 0) {
    // SQL의 IN (?, ?, ...) 절에 쓸 ? 자리를 게시글 수만큼 만듭니다.
    const postPH = postIds.map(() => '?').join(',');

    // 게시글에 달린 댓글 id를 모두 가져옵니다.
    const comments = db.prepare(`SELECT id FROM comments WHERE post_id IN (${postPH})`).all(...postIds);
    const commentIds = comments.map(c => c.id);

    if (commentIds.length > 0) {
      const cmtPH = commentIds.map(() => '?').join(',');
      // 댓글 첨부파일을 디스크에서도 삭제합니다.
      const cmtFiles = db.prepare(`SELECT file_path FROM comment_files WHERE comment_id IN (${cmtPH})`).all(...commentIds);
      cmtFiles.forEach(f => { try { fs.unlinkSync(f.file_path); } catch {} });
      db.prepare(`DELETE FROM comment_files WHERE comment_id IN (${cmtPH})`).run(...commentIds);
    }

    // 게시글 첨부파일을 디스크에서도 삭제합니다.
    const postFiles = db.prepare(`SELECT file_path FROM files WHERE post_id IN (${postPH})`).all(...postIds);
    postFiles.forEach(f => { try { fs.unlinkSync(f.file_path); } catch {} });
    db.prepare(`DELETE FROM files     WHERE post_id IN (${postPH})`).run(...postIds);

    // 댓글을 삭제합니다.
    db.prepare(`DELETE FROM comments  WHERE post_id IN (${postPH})`).run(...postIds);

    // 게시글을 삭제합니다.
    db.prepare('DELETE FROM posts WHERE board = ?').run(key);
  }

  // 게시판 자체를 DB에서 삭제합니다.
  db.prepare('DELETE FROM boards WHERE key = ?').run(key);
  // 서버 메모리의 BOARDS Set에서도 제거합니다.
  BOARDS.delete(key);

  res.json({ ok: true });
});

// ── 게시글 목록 (페이지네이션 + 검색) ───────────────────────
app.get('/api/posts', (req, res) => {
  const board  = getBoard(req.query.board);
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = 10;
  const offset = (page - 1) * limit;

  // req.query.search : URL에 ?search=키워드 형태로 넘어오는 검색어입니다.
  // trim() : 앞뒤 공백을 제거합니다. 사용자가 실수로 공백만 입력한 경우를 막습니다.
  // || '' : search 파라미터가 없으면 빈 문자열('')을 기본값으로 사용합니다.
  const searchRaw = (req.query.search || '').trim();

  // 검색어가 있을 때만 SQL LIKE 조건을 추가합니다.
  // LIKE '%검색어%' : 제목이나 내용 어디든 검색어가 포함된 글을 찾습니다.
  // % 는 SQL 와일드카드로, '어떤 문자든 0개 이상'을 의미합니다.
  const searchParam = searchRaw ? `%${searchRaw}%` : null;

  // 검색어 유무에 따라 WHERE 조건이 달라집니다.
  // searchParam이 있으면 제목(title) 또는 내용(content)에 검색어가 포함된 글만 조회합니다.
  const countSql = searchParam
    ? 'SELECT COUNT(*) as count FROM posts WHERE board = ? AND (title LIKE ? OR content LIKE ?)'
    : 'SELECT COUNT(*) as count FROM posts WHERE board = ?';
  const countArgs = searchParam ? [board, searchParam, searchParam] : [board];
  const { count } = db.prepare(countSql).get(...countArgs);

  // 목록 조회 SQL도 검색 조건을 함께 적용합니다.
  // ORDER BY 설명:
  //   1순위: 제목에 '완료'가 포함된 글은 1, 아니면 0 → 0이 먼저(위), 1이 나중(아래)에 옴
  //          CASE WHEN ... THEN ... ELSE ... END : SQL의 if/else 문법입니다.
  //          LIKE '%완료%' : 제목 어디에든 '완료'가 들어있으면 true입니다.
  //   2순위: 같은 그룹 안에서는 작성일 최신순으로 정렬합니다.
  //   3순위: 날짜도 같으면 id가 큰 것(나중에 쓴 글)이 위로 옵니다.
  // 이 정렬이 LIMIT/OFFSET(페이징)보다 먼저 적용되기 때문에,
  // '완료' 글은 전체 글 중 맨 마지막 페이지 하단에 위치하게 됩니다.
  const listSql = `
    SELECT p.id, p.title, p.author, p.created_at, p.updated_at,
           COUNT(DISTINCT c.id) AS comment_count,
           COUNT(DISTINCT f.id) AS file_count
    FROM posts p
    LEFT JOIN comments c ON c.post_id = p.id
    LEFT JOIN files    f ON f.post_id = p.id
    WHERE p.board = ?
    ${searchParam ? 'AND (p.title LIKE ? OR p.content LIKE ?)' : ''}
    GROUP BY p.id
    ORDER BY p.is_pinned DESC,
             CASE WHEN p.title LIKE '%완료%' THEN 1 ELSE 0 END ASC,
             p.created_at DESC,
             p.id DESC
    LIMIT ? OFFSET ?
  `;
  // 검색어 유무에 따라 SQL에 넘길 인자 배열이 달라집니다.
  const listArgs = searchParam
    ? [board, searchParam, searchParam, limit, offset]
    : [board, limit, offset];
  const posts = db.prepare(listSql).all(...listArgs);

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

// ── 게시글 고정/해제 ───────────────────────────────────────
// PATCH : HTTP에서 '일부 데이터만 바꿀 때' 쓰는 방식입니다. (PUT은 전체 교체, PATCH는 부분 수정)
// 고정 버튼을 누를 때마다 is_pinned 값을 0 ↔ 1로 전환합니다.
// 현재 값이 1(고정)이면 0(일반)으로, 0(일반)이면 1(고정)으로 바꿉니다.
app.patch('/api/posts/:id/pin', (req, res) => {
  // 먼저 해당 게시글이 존재하는지 확인합니다. 없으면 404 오류를 돌려줍니다.
  const post = db.prepare('SELECT id, is_pinned FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  // is_pinned가 1이면 0으로, 0이면 1로 전환합니다.
  // ! 연산자: true → false, false → true 처럼 값을 반전시킵니다.
  // Number(): Boolean을 숫자로 바꿉니다. true → 1, false → 0
  const newValue = Number(!post.is_pinned);
  db.prepare('UPDATE posts SET is_pinned = ? WHERE id = ?').run(newValue, req.params.id);

  // 변경된 고정 상태를 응답으로 돌려줍니다. 프론트엔드에서 화면을 바로 업데이트할 때 씁니다.
  res.json({ is_pinned: newValue });
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

// ── 댓글 수정 ─────────────────────────────────────────────
// JavaScript 주석 문법: // 뒤의 글은 서버 실행에 영향을 주지 않는 설명입니다. 댓글 수정 요청이 오면 해당 게시글에 속한 댓글인지 확인한 뒤 내용만 바꿉니다.
app.put('/api/posts/:id/comments/:cid', (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '댓글 내용은 필수입니다.' });

  const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND post_id = ?').get(req.params.cid, req.params.id);
  if (!comment) return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });

  db.prepare('UPDATE comments SET content = ? WHERE id = ? AND post_id = ?')
    .run(content.trim(), req.params.cid, req.params.id);

  const updatedComment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.cid);
  updatedComment.files = db.prepare('SELECT * FROM comment_files WHERE comment_id = ? ORDER BY id').all(req.params.cid);
  res.json(updatedComment);
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

// Vue Router history mode 를 위해 API/업로드 외 경로는 index.html 로 fallback
if (fs.existsSync(distDir)) {
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Use plain HTTP again so every office laptop can connect without installing certificates.
app.listen(PORT, HOST, () => {
  console.log(`게시판 서버 실행 중 → http://${DISPLAY_HOST}:${PORT}`);
});
