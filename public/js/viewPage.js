/**
 * 이 파일은 게시글 상세 화면을 담당합니다.
 * 게시글 내용, 첨부파일, 댓글 목록, 댓글 작성과 삭제 기능을 처리합니다.
 */
import { boardMeta, boardUrl, setupHomeLink, updateBoardLinks } from './board.js';
import {
  createComment,
  deleteComment,
  deleteCommentFile,
  deletePost,
  deletePostFile,
  fetchPost,
} from './api.js';
import { downloadFromUrl, escHtml, formatSize, isImage, showToast } from './utils.js';

// JavaScript 주석 문법: 이 파일은 상세 화면(view.html)의 동작만 담당합니다.
// 게시글 보기, 댓글 작성, 첨부파일 다운로드/삭제 기능을 HTML에서 분리했습니다.
const params = new URLSearchParams(location.search);
const postId = params.get('id');
let currentBoard = boardMeta[params.get('board')] ? params.get('board') : 'project';
let cmtFiles = [];

if (!postId) location.href = boardUrl(currentBoard);

updateBoardUi();
setupHomeLink();
bindEvents();
loadPost();

// 버튼 클릭과 파일 드래그 같은 사용자 행동을 한곳에 연결합니다.
function bindEvents() {
  document.getElementById('listBtn').addEventListener('click', () => {
    location.href = boardUrl(currentBoard);
  });
  document.getElementById('editBtn').addEventListener('click', () => {
    location.href = `write.html?id=${postId}&board=${currentBoard}`;
  });
  document.getElementById('delBtn').addEventListener('click', handleDeletePost);
  document.getElementById('submitCommentBtn').addEventListener('click', submitComment);

  const cmtFileInput = document.getElementById('cmtFileInput');
  const cmtDropZone = document.getElementById('cmtDropZone');
  cmtDropZone.addEventListener('click', () => cmtFileInput.click());
  cmtFileInput.addEventListener('change', event => {
    addCmtFiles([...event.target.files]);
    event.target.value = '';
  });
  cmtDropZone.addEventListener('dragover', event => {
    event.preventDefault();
    cmtDropZone.classList.add('drag-over');
  });
  cmtDropZone.addEventListener('dragleave', () => cmtDropZone.classList.remove('drag-over'));
  cmtDropZone.addEventListener('drop', event => {
    event.preventDefault();
    cmtDropZone.classList.remove('drag-over');
    addCmtFiles([...event.dataTransfer.files]);
  });

  // 댓글 목록과 첨부파일 영역에서 생기는 버튼은 나중에 만들어지므로, 부모에서 클릭을 받아 처리합니다.
  document.getElementById('postCard').addEventListener('click', handlePostFileClick);
  document.getElementById('commentList').addEventListener('click', handleCommentClick);
}

// 상세 화면을 그리기 위해 게시글, 댓글, 첨부파일을 서버에서 한 번에 가져옵니다.
async function loadPost() {
  try {
    const post = await fetchPost(postId);
    if (!post) {
      showToast('게시글을 찾을 수 없습니다.', true);
      return;
    }
    renderPost(post);
    renderComments(post.comments);
  } catch {
    showToast('불러오기 실패', true);
  }
}

// 가져온 게시글 내용을 화면에 넣고, 첨부파일은 이미지와 일반 파일로 나누어 보여줍니다.
function renderPost(post) {
  if (boardMeta[post.board]) {
    currentBoard = post.board;
    updateBoardUi();
  }
  document.title = `${post.title} - ${boardMeta[currentBoard]} 게시판`;
  document.getElementById('postTitle').textContent = post.title;
  document.getElementById('postAuthor').textContent = post.author;
  document.getElementById('postDate').textContent = post.created_at.slice(0, 16);
  document.getElementById('postContent').innerHTML = window.marked.parse(post.content);
  document.getElementById('updatedBadge').style.display = post.created_at !== post.updated_at ? 'inline' : 'none';

  renderPostFiles(post.files || []);
}

// 게시글 첨부파일을 이미지 미리보기와 일반 파일 목록으로 나눠 표시합니다.
function renderPostFiles(files) {
  const section = document.getElementById('attachSection');
  const fileList = document.getElementById('fileList');
  const imgGrid = document.getElementById('imgPreviewGrid');
  fileList.innerHTML = '';
  imgGrid.innerHTML = '';
  section.style.display = files.length > 0 ? 'block' : 'none';

  files.forEach(file => {
    if (isImage(file.original_name)) {
      const div = document.createElement('div');
      div.className = 'img-preview-item';
      div.style.width = '140px';
      div.style.height = '140px';
      div.title = file.original_name;
      div.innerHTML = `
        <img src="/uploads/${escHtml(file.filename)}" alt="${escHtml(file.original_name)}" loading="lazy" data-action="download-post-file" data-file-id="${file.id}" data-file-name="${escHtml(file.original_name)}">
        <button class="remove-img" data-action="delete-post-file" data-file-id="${file.id}" title="삭제">✕</button>`;
      imgGrid.appendChild(div);
      return;
    }

    const li = document.createElement('li');
    li.className = 'file-item';
    li.innerHTML = `
      <span class="file-icon">📄</span>
      <span class="file-name" data-action="download-post-file" data-file-id="${file.id}" data-file-name="${escHtml(file.original_name)}">${escHtml(file.original_name)}</span>
      <span class="file-size">${formatSize(file.file_size)}</span>
      <button class="delete-file-btn" data-action="delete-post-file" data-file-id="${file.id}" title="삭제">✕</button>`;
    fileList.appendChild(li);
  });
}

// 댓글 목록을 화면에 만들고, 댓글에 붙은 파일도 함께 표시합니다.
function renderComments(comments) {
  const list = document.getElementById('commentList');
  document.getElementById('commentCount').textContent = `(${comments.length})`;
  if (comments.length === 0) {
    list.innerHTML = '<div style="color:#bbb;font-size:.88rem;padding:8px 0">첫 댓글을 작성해보세요.</div>';
    return;
  }

  list.innerHTML = '';
  comments.forEach(comment => {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.id = comment.id;
    div.innerHTML = `
      <div class="comment-header">
        <span class="comment-author">${escHtml(comment.author)}</span>
        <span>
          <span class="comment-date">${comment.created_at.slice(0, 16)}</span>
          <button class="comment-del" data-action="delete-comment" data-comment-id="${comment.id}">삭제</button>
        </span>
      </div>
      <div class="comment-text md-body"></div>
      ${renderCommentFiles(comment.files || [])}`;
    div.querySelector('.comment-text').innerHTML = window.marked.parse(comment.content);
    list.appendChild(div);
  });
}

// 댓글 첨부파일 HTML을 만듭니다. 이미지면 작은 미리보기, 일반 파일이면 파일명 줄로 보여줍니다.
function renderCommentFiles(files) {
  if (files.length === 0) return '';

  const fileItems = files.map(file => {
    if (isImage(file.original_name)) {
      return `<div class="img-preview-item" style="width:80px;height:80px" title="${escHtml(file.original_name)}">
        <img src="/uploads/${escHtml(file.filename)}" alt="${escHtml(file.original_name)}" loading="lazy" data-action="download-comment-file" data-file-id="${file.id}" data-file-name="${escHtml(file.original_name)}">
        <button class="remove-img" data-action="delete-comment-file" data-file-id="${file.id}" title="삭제">✕</button>
      </div>`;
    }
    return `<div class="file-item" style="margin-top:4px" id="cf-${file.id}">
      <span class="file-icon">📄</span>
      <span class="file-name" data-action="download-comment-file" data-file-id="${file.id}" data-file-name="${escHtml(file.original_name)}">${escHtml(file.original_name)}</span>
      <span class="file-size">${formatSize(file.file_size)}</span>
      <button class="delete-file-btn" data-action="delete-comment-file" data-file-id="${file.id}" title="삭제">✕</button>
    </div>`;
  }).join('');

  return `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${fileItems}</div>`;
}

// 댓글 등록 버튼을 누르면 댓글 내용과 선택한 파일을 FormData로 서버에 보냅니다.
async function submitComment() {
  const contentInput = document.getElementById('cmtContent');
  const author = document.getElementById('cmtAuthor').value.trim();
  const content = contentInput.value.trim();
  if (!content) {
    showToast('댓글 내용을 입력하세요.', true);
    return;
  }

  const formData = new FormData();
  formData.append('author', author);
  formData.append('content', content);
  cmtFiles.forEach(file => formData.append('files', file));

  const res = await createComment(postId, formData);
  if (res.ok) {
    contentInput.value = '';
    cmtFiles = [];
    renderCmtSelectedFiles();
    await loadPost();
    showToast('댓글이 등록되었습니다.');
  } else {
    showToast('등록 실패', true);
  }
}

// 같은 파일이 중복으로 들어가지 않게 확인한 뒤 댓글 첨부 목록에 추가합니다.
function addCmtFiles(files) {
  files.forEach(file => {
    if (!cmtFiles.find(item => item.name === file.name && item.size === file.size)) cmtFiles.push(file);
  });
  renderCmtSelectedFiles();
}

// 댓글 작성 전에 선택한 파일들을 미리보기와 파일명 목록으로 보여줍니다.
function renderCmtSelectedFiles() {
  const wrap = document.getElementById('cmtSelectedFiles');
  const grid = document.getElementById('cmtImgPreview');
  wrap.innerHTML = '';
  grid.innerHTML = '';

  cmtFiles.forEach((file, index) => {
    if (isImage(file.name)) {
      const div = document.createElement('div');
      div.className = 'img-preview-item';
      const btn = document.createElement('button');
      btn.className = 'remove-img';
      btn.textContent = '✕';
      btn.addEventListener('click', () => removeSelectedCommentFile(index));
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      div.appendChild(img);
      div.appendChild(btn);
      grid.appendChild(div);
      return;
    }

    const item = document.createElement('div');
    item.className = 'selected-file-item';
    item.innerHTML = `<span>📄</span><span>${escHtml(file.name)}</span>
      <span class="file-size" style="color:#aaa;font-size:.8rem;margin-left:4px">${formatSize(file.size)}</span>
      <button class="remove-btn" title="제거">✕</button>`;
    item.querySelector('.remove-btn').addEventListener('click', () => removeSelectedCommentFile(index));
    wrap.appendChild(item);
  });
}

// 아직 서버에 올리지 않은 댓글 첨부파일을 선택 목록에서만 제거합니다.
function removeSelectedCommentFile(index) {
  cmtFiles.splice(index, 1);
  renderCmtSelectedFiles();
}

// 게시글 첨부파일을 다운로드하거나 삭제합니다.
async function handlePostFileClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'download-post-file') {
    downloadFromUrl(`/api/files/${target.dataset.fileId}/download`, target.dataset.fileName);
    return;
  }

  if (target.dataset.action === 'delete-post-file') {
    await removeFile(target, deletePostFile);
  }
}

// 댓글, 댓글 첨부파일 버튼을 처리합니다.
async function handleCommentClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'delete-comment') {
    await handleDeleteComment(target.dataset.commentId);
    return;
  }
  if (target.dataset.action === 'download-comment-file') {
    downloadFromUrl(`/api/comment-files/${target.dataset.fileId}/download`, target.dataset.fileName);
    return;
  }
  if (target.dataset.action === 'delete-comment-file') {
    await removeFile(target, deleteCommentFile);
  }
}

// 게시글을 삭제하면 목록 화면으로 돌아갑니다.
async function handleDeletePost() {
  if (!confirm('게시글을 삭제하시겠습니까?')) return;
  const res = await deletePost(postId);
  if (res.ok) {
    showToast('삭제되었습니다.');
    setTimeout(() => location.href = boardUrl(currentBoard), 800);
  } else {
    showToast('삭제 실패', true);
  }
}

// 댓글 삭제 버튼을 누르면 서버에서 댓글과 댓글 첨부파일을 함께 삭제합니다.
async function handleDeleteComment(commentId) {
  if (!confirm('댓글을 삭제하시겠습니까?')) return;
  const res = await deleteComment(postId, commentId);
  if (res.ok) {
    await loadPost();
    showToast('댓글이 삭제되었습니다.');
  } else {
    showToast('삭제 실패', true);
  }
}

// 첨부파일 삭제는 게시글 파일과 댓글 파일이 비슷해서 같은 함수로 처리합니다.
async function removeFile(button, deleteRequest) {
  if (!confirm('이 파일을 삭제하시겠습니까?')) return;
  const res = await deleteRequest(button.dataset.fileId);
  if (res.ok) {
    const el = button.closest('.img-preview-item, .file-item');
    if (el) el.remove();
    showToast('파일이 삭제되었습니다.');
  } else {
    showToast('삭제 실패', true);
  }
}

// 게시판 메뉴 상태를 현재 게시판에 맞게 갱신합니다.
function updateBoardUi() {
  updateBoardLinks(currentBoard);
}
