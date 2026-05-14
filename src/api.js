// ── 게시판 목록 API ────────────────────────────────────────

// 서버에서 게시판 목록을 가져오는 함수입니다.
// 반환값 예시: [{ key: 'project', label: '프로젝트' }, { key: 'board_123', label: '공지사항' }]
export async function fetchBoards() {
  const res = await fetch('/api/boards')
  return res.json()
}

// 새 게시판을 서버에 추가하는 함수입니다.
// label : 사용자가 입력한 게시판 이름 (예: '공지사항')
// 반환값: { ok: true/false, data: { key, label } 또는 { error: '...' } }
export async function addBoard(label) {
  const res = await fetch('/api/boards', {
    method: 'POST',
    // Content-Type: 'application/json' : 서버에 JSON 형식으로 데이터를 보낸다는 표시입니다.
    headers: { 'Content-Type': 'application/json' },
    // JSON.stringify() : 자바스크립트 객체를 JSON 문자열로 변환합니다. (안드로이드의 Gson.toJson()과 비슷)
    body: JSON.stringify({ label }),
  })
  return { ok: res.ok, data: await res.json() }
}

// ── 게시글 API ─────────────────────────────────────────────

export async function fetchPostList(page, board) {
  const res = await fetch(`/api/posts?page=${page}&board=${board}`)
  return res.json()
}

export async function fetchPost(postId) {
  const res = await fetch(`/api/posts/${postId}`)
  if (!res.ok) return null
  return res.json()
}

export async function createPost(formData) {
  const res = await fetch('/api/posts', { method: 'POST', body: formData })
  return { ok: res.ok, data: await res.json() }
}

export async function updatePost(postId, formData) {
  const res = await fetch(`/api/posts/${postId}`, { method: 'PUT', body: formData })
  return { ok: res.ok, data: await res.json() }
}

export function deletePost(postId) {
  return fetch(`/api/posts/${postId}`, { method: 'DELETE' })
}

export function createComment(postId, formData) {
  return fetch(`/api/posts/${postId}/comments`, { method: 'POST', body: formData })
}

// JavaScript 주석 문법: // 뒤의 글은 화면에 보이지 않는 코드 설명입니다. 댓글 내용을 고칠 때는 서버의 댓글 수정 주소로 새 내용을 보냅니다.
export async function updateComment(postId, commentId, content) {
  const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  return { ok: res.ok, data: await res.json() }
}

export function deleteComment(postId, commentId) {
  return fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' })
}

export function deletePostFile(fileId) {
  return fetch(`/api/files/${fileId}`, { method: 'DELETE' })
}

export function deleteCommentFile(fileId) {
  return fetch(`/api/comment-files/${fileId}`, { method: 'DELETE' })
}
