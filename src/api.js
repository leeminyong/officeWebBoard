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

// 게시판 이름을 수정하는 함수입니다.
// key : 수정할 게시판의 고유 식별자 (예: 'board_123')
// label : 새 게시판 이름
// PUT 방식 : HTTP에서 '기존 데이터를 통째로 바꿀 때' 쓰는 방식입니다. (생성은 POST, 수정은 PUT)
// 반환값: { ok: true/false, data: { key, label } 또는 { error: '...' } }
export async function renameBoard(key, label) {
  const res = await fetch(`/api/boards/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  })
  return { ok: res.ok, data: await res.json() }
}

// 게시판을 삭제하는 함수입니다.
// key : 삭제할 게시판의 고유 식별자 (예: 'board_123')
// DELETE 방식 : HTTP에서 '데이터를 삭제할 때' 쓰는 방식입니다.
// 반환값: { ok: true/false, data: { ok: true } 또는 { error: '...' } }
export async function deleteBoard(key) {
  const res = await fetch(`/api/boards/${key}`, { method: 'DELETE' })
  return { ok: res.ok, data: await res.json() }
}

// ── 게시글 API ─────────────────────────────────────────────

// fetchPostList : 서버에서 게시글 목록을 가져오는 함수입니다.
// page   : 가져올 페이지 번호 (1부터 시작)
// board  : 게시판 종류 (예: 'project', 'maintenance')
// search : 검색어. 없으면 빈 문자열('')을 기본값으로 사용합니다.
//          URLSearchParams를 쓰면 한글이나 특수문자가 자동으로 URL 안전한 문자로 변환됩니다.
//          (예: '유지 보수' → '%EC%9C%A0%EC%A7%80+%EB%B3%B4%EC%88%98')
export async function fetchPostList(page, board, search = '') {
  // URLSearchParams : URL 쿼리 문자열을 안전하게 만들어 주는 브라우저 내장 도구입니다.
  // 안드로이드의 Uri.Builder().appendQueryParameter()와 비슷한 역할입니다.
  const params = new URLSearchParams({ page, board })
  // 검색어가 있을 때만 search 파라미터를 추가합니다.
  // trim() : 앞뒤 공백을 제거합니다.
  if (search.trim()) params.append('search', search.trim())
  const res = await fetch(`/api/posts?${params}`)
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

// togglePin : 게시글 고정 상태를 서버에서 전환(고정 ↔ 해제)하는 함수입니다.
// PATCH 방식으로 요청하면 서버가 is_pinned 값을 0↔1로 바꾸고 결과를 돌려줍니다.
// 반환값 예시: { is_pinned: 1 } 또는 { is_pinned: 0 }
export async function togglePin(postId) {
  const res = await fetch(`/api/posts/${postId}/pin`, { method: 'PATCH' })
  return { ok: res.ok, data: await res.json() }
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
