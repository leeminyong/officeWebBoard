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
