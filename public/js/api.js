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

export function deleteComment(postId, commentId) {
  return fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
}

export function deletePostFile(fileId) {
  return fetch(`/api/files/${fileId}`, { method: 'DELETE' });
}

export function deleteCommentFile(fileId) {
  return fetch(`/api/comment-files/${fileId}`, { method: 'DELETE' });
}
