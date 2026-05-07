/**
 * 이 파일은 게시글 목록 화면을 담당합니다.
 * 게시글을 불러와 표로 보여주고, 페이지 번호 버튼과 글쓰기 버튼 동작을 처리합니다.
 */
import { boardMeta, boardQuery, getCurrentBoard, setupHomeLink, updateBoardLinks } from './board.js';
import { fetchPostList } from './api.js';
import { escHtml, showToast } from './utils.js';

// JavaScript 주석 문법: import/export는 다른 JS 파일의 기능을 가져오거나 내보낼 때 쓰는 모듈 문법입니다.
// 이 파일은 목록 화면(index.html)만 담당합니다. 게시글 목록 불러오기, 페이지 버튼, 글쓰기 이동을 여기서 처리합니다.
const currentBoard = getCurrentBoard();
let currentPage = 1;

updateBoardLinks(currentBoard);
setupHomeLink();
document.title = `${boardMeta[currentBoard]} 게시판`;

// 글쓰기 버튼을 누르면 현재 게시판 정보를 유지한 채 글쓰기 화면으로 이동합니다.
document.getElementById('writeBtn').addEventListener('click', () => {
  location.href = `write.html${boardQuery(currentBoard)}`;
});

// 페이지 번호 버튼은 HTML 문자열 안의 onclick 대신 data-page 값으로 처리합니다. 이렇게 하면 HTML과 JavaScript 역할이 조금 더 분리됩니다.
document.getElementById('pagination').addEventListener('click', event => {
  const button = event.target.closest('[data-page]');
  if (!button || button.disabled) return;
  loadPosts(Number(button.dataset.page));
});

// 서버에서 현재 게시판의 글 목록을 가져오고, 성공하면 표와 페이지 버튼을 다시 그립니다.
async function loadPosts(page) {
  currentPage = page;
  try {
    const data = await fetchPostList(page, currentBoard);
    renderList(data.posts);
    renderPagination(data.pagination);
    document.getElementById('totalInfo').textContent = `${boardMeta[currentBoard]} 전체 ${data.pagination.total}건`;
  } catch {
    showToast('게시글을 불러오지 못했습니다.', true);
  }
}

// 게시글 배열을 표의 행으로 바꿔 화면에 보여줍니다. 댓글 미리보기와 파일 개수도 함께 표시합니다.
function renderList(posts) {
  const tbody = document.getElementById('postList');
  const empty = document.getElementById('emptyState');
  if (posts.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  // JavaScript 주석 문법: // 뒤의 글은 화면에 보이지 않는 코드 설명입니다. 서버에서 받은 글을 작성일 최신순으로 한 번 더 정리해서, 사용자는 새 글을 표 맨 위에서 보게 됩니다.
  const latestPosts = [...posts].sort((a, b) => {
    const dateCompare = String(b.created_at).localeCompare(String(a.created_at));
    return dateCompare || b.id - a.id;
  });
  tbody.innerHTML = latestPosts.map((post, index) => {
    // JavaScript 주석 문법: // 뒤의 글은 화면에 보이지 않는 코드 설명입니다. 최신글이 맨 위에 오므로, 왼쪽 번호도 맨 위부터 1, 2, 3 순서로 보이게 다시 계산합니다.
    const listNumber = (currentPage - 1) * 10 + index + 1;
    const commentBadge = post.comment_count > 0
      ? `<span class="badge-comment">${post.comment_count}</span>`
      : '';
    const fileBadge = post.file_count > 0
      ? `<span class="badge-file">📎${post.file_count}</span>`
      : '';
    const commentsHtml = renderInlineComments(post);

    return `
      <tr>
        <td class="center text-muted">${listNumber}</td>
        <td>
          <a class="post-title-link" href="view.html?id=${post.id}&board=${currentBoard}">${escHtml(post.title)}</a>
          ${commentBadge}${fileBadge}
          ${commentsHtml}
        </td>
        <!-- JavaScript에서 만든 HTML 안의 주석입니다. 혼자 사용하는 게시판이라 목록의 작성자 칸은 표시하지 않습니다. -->
        <td class="center text-muted">${post.created_at.slice(0, 10)}</td>
        <td class="center text-muted">${post.file_count > 0 ? '📎' : ''}</td>
      </tr>`;
  }).join('');
}

// 목록에서 최근 댓글을 작게 보여주는 HTML을 만듭니다.
function renderInlineComments(post) {
  if (!post.comments || post.comments.length === 0) return '';

  return post.comments.map(comment => `
    <a class="inline-comment" href="view.html?id=${post.id}&board=${currentBoard}">
      <!-- JavaScript에서 만든 HTML 안의 주석입니다. 댓글 작성자 이름도 혼자 쓰는 게시판에서는 숨깁니다. -->
      <span class="inline-comment-text">${escHtml(comment.content)}</span>
      <span class="inline-comment-date">${comment.created_at.slice(0, 10)}</span>
    </a>`).join('');
}

// 전체 페이지 수에 맞춰 처음, 이전, 번호, 다음, 마지막 버튼을 만듭니다.
function renderPagination({ page, totalPages }) {
  const wrap = document.getElementById('pagination');
  if (totalPages <= 1) {
    wrap.innerHTML = '';
    return;
  }

  const groupSize = 5;
  const groupStart = Math.floor((page - 1) / groupSize) * groupSize + 1;
  const groupEnd = Math.min(groupStart + groupSize - 1, totalPages);
  let html = '';

  html += pageButton('«', 1, page === 1);
  html += pageButton('‹', page - 1, page === 1);
  for (let i = groupStart; i <= groupEnd; i++) {
    html += pageButton(String(i), i, false, i === page);
  }
  html += pageButton('›', page + 1, page === totalPages);
  html += pageButton('»', totalPages, page === totalPages);
  wrap.innerHTML = html;
}

// 페이지 버튼을 만들 때 이동할 페이지 숫자를 data-page 속성에 넣습니다.
function pageButton(label, page, disabled, active = false) {
  return `<button class="page-btn ${active ? 'active' : ''}" data-page="${page}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

loadPosts(currentPage);
