/**
 * 이 파일은 서버와 통신하는 함수들을 모아둔 파일입니다.
 * 안드로이드의 Repository처럼, 화면 파일이 서버 주소를 직접 많이 알지 않아도 되게 도와줍니다.
 */
// JavaScript 주석 문법: // 로 시작하는 줄은 코드 설명입니다.
// 이 파일은 서버와 대화하는 함수만 모아둔 Repository 역할입니다. 화면 파일은 fetch 주소를 직접 알 필요가 줄어듭니다.

export async function fetchPostList(page, board) {
  const res = await fetch(`/api/posts?page=${page}&board=${board}`);
  return res.json();
}

export async function fetchPost(postId) {
  const res = await fetch(`/api/posts/${postId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function createPost(formData) {
  const res = await fetch('/api/posts', { method: 'POST', body: formData });
  return { ok: res.ok, data: await res.json() };
}

export async function updatePost(postId, formData) {
  const res = await fetch(`/api/posts/${postId}`, { method: 'PUT', body: formData });
  return { ok: res.ok, data: await res.json() };
}

export function deletePost(postId) {
  return fetch(`/api/posts/${postId}`, { method: 'DELETE' });
}

export function createComment(postId, formData) {
  return fetch(`/api/posts/${postId}/comments`, { method: 'POST', body: formData });
}

// JavaScript 주석 문법: // 뒤의 글은 화면에 보이지 않는 코드 설명입니다. 댓글 수정 버튼을 눌렀을 때 새 댓글 내용을 서버로 보내는 함수입니다.
export async function updateComment(postId, commentId, content) {
  const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return { ok: res.ok, data: await res.json() };
}

export function deleteComment(postId, commentId) {
  return fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
}

export function deletePostFile(fileId) {
  return fetch(`/api/files/${fileId}`, { method: 'DELETE' });
}

export function deleteCommentFile(fileId) {
  return fetch(`/api/comment-files/${fileId}`, { method: 'DELETE' });
}
