/**
 * 이 파일은 글쓰기와 글수정 화면을 담당합니다.
 * 제목/내용 저장, 파일 첨부, 기존 첨부파일 삭제 표시, HTML 붙여넣기 변환을 처리합니다.
 */
import { boardMeta, setupHomeLink } from './board.js';
import { createPost, fetchPost, updatePost } from './api.js';
import { escHtml, formatSize, isImage, showToast } from './utils.js';

// JavaScript 주석 문법: 이 파일은 글쓰기 화면(write.html)의 동작만 담당하는 모듈입니다.
// 새 글 등록, 기존 글 수정, 파일 선택, HTML 붙여넣기 변환 기능을 HTML에서 분리했습니다.
const params = new URLSearchParams(location.search);
const editId = params.get('id');
const isEdit = Boolean(editId);
let currentBoard = boardMeta[params.get('board')] ? params.get('board') : 'project';
let selectedFiles = [];
let deleteFileIds = [];

setupHomeLink();
bindEvents();
setupEditMode();

// 버튼, 파일 선택, 드래그, 붙여넣기 같은 사용자 행동을 이 함수에서 한 번에 연결합니다.
function bindEvents() {
  document.getElementById('cancelBtn').addEventListener('click', () => history.back());
  document.getElementById('submitBtn').addEventListener('click', submitPost);

  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', event => addFiles([...event.target.files]));
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles([...event.dataTransfer.files]);
  });

  document.getElementById('existingFileList').addEventListener('click', event => {
    const button = event.target.closest('[data-delete-file-id]');
    if (button) markDeleteFile(button.dataset.deleteFileId);
  });

  document.getElementById('content').addEventListener('paste', handlePasteAsMarkdown);
}

// 주소에 글 번호가 있으면 새 글 작성이 아니라 기존 글 수정 화면으로 바꿉니다.
function setupEditMode() {
  if (!isEdit) return;
  document.title = '글 수정 - 게시판';
  document.getElementById('pageTitle').textContent = '✏️ 글 수정';
  document.getElementById('submitBtn').textContent = '수정 완료';
  loadPostForEdit();
}

// 수정할 글의 기존 제목, 내용, 첨부파일을 불러와 입력칸에 채웁니다.
async function loadPostForEdit() {
  const post = await fetchPost(editId);
  if (!post) {
    showToast('수정할 글을 찾을 수 없습니다.', true);
    return;
  }

  if (boardMeta[post.board]) currentBoard = post.board;
  document.getElementById('author').value = post.author;
  document.getElementById('title').value = post.title;
  document.getElementById('content').value = post.content;
  renderExistingFiles(post.files || []);
}

// 기존 첨부파일 목록을 화면에 보여줍니다. 삭제 버튼을 눌러도 바로 지우지 않고 저장할 때 서버에 알려줍니다.
function renderExistingFiles(files) {
  if (files.length === 0) return;
  document.getElementById('existingFiles').style.display = 'block';
  const list = document.getElementById('existingFileList');
  list.innerHTML = '';

  files.forEach(file => {
    const li = document.createElement('li');
    li.className = 'file-item';
    li.id = `ef-${file.id}`;
    li.innerHTML = `
      <span class="file-icon">${isImage(file.original_name) ? '🖼️' : '📄'}</span>
      <span class="file-name">${escHtml(file.original_name)}</span>
      <span class="file-size">${formatSize(file.file_size)}</span>
      <button class="delete-file-btn" data-delete-file-id="${file.id}" title="삭제">✕</button>`;
    list.appendChild(li);
  });
}

// 기존 첨부파일은 바로 지우지 않고, 저장할 때 삭제하도록 표시만 해둡니다.
function markDeleteFile(fileId) {
  if (!confirm('이 파일을 삭제하시겠습니까?')) return;
  if (!deleteFileIds.includes(Number(fileId))) deleteFileIds.push(Number(fileId));
  const el = document.getElementById(`ef-${fileId}`);
  if (el) {
    el.style.opacity = '.4';
    el.style.textDecoration = 'line-through';
    el.querySelector('button').disabled = true;
  }
}

// 같은 파일이 중복으로 들어가지 않게 확인한 뒤 새 첨부 목록에 추가합니다.
function addFiles(files) {
  files.forEach(file => {
    if (selectedFiles.find(item => item.name === file.name && item.size === file.size)) return;
    selectedFiles.push(file);
  });
  renderSelectedFiles();
  document.getElementById('fileInput').value = '';
}

// 새로 선택한 첨부파일을 이미지 미리보기와 파일명 목록으로 보여줍니다.
function renderSelectedFiles() {
  const wrap = document.getElementById('selectedFiles');
  const grid = document.getElementById('imgPreviewGrid');
  wrap.innerHTML = '';
  grid.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    if (isImage(file.name)) {
      const div = document.createElement('div');
      div.className = 'img-preview-item';
      const btn = document.createElement('button');
      btn.className = 'remove-img';
      btn.textContent = '✕';
      btn.addEventListener('click', () => removeSelectedFile(index));
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
    item.innerHTML = `
      <span>📄</span>
      <span>${escHtml(file.name)}</span>
      <span class="file-size" style="color:#aaa;font-size:.8rem;margin-left:4px">${formatSize(file.size)}</span>
      <button class="remove-btn" title="제거">✕</button>`;
    item.querySelector('.remove-btn').addEventListener('click', () => removeSelectedFile(index));
    wrap.appendChild(item);
  });
}

// 아직 서버에 올리지 않은 새 첨부파일을 선택 목록에서 제거합니다.
function removeSelectedFile(index) {
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
}

// 등록/수정 버튼을 누르면 글 내용, 새 첨부파일, 삭제할 기존 파일 목록을 서버에 보냅니다.
async function submitPost() {
  const author = document.getElementById('author').value.trim();
  const title = document.getElementById('title').value.trim();
  const content = document.getElementById('content').value.trim();

  if (!title) {
    showToast('제목을 입력해주세요.', true);
    return;
  }
  if (!content) {
    showToast('내용을 입력해주세요.', true);
    return;
  }

  const button = document.getElementById('submitBtn');
  button.disabled = true;
  button.textContent = '처리 중...';

  const formData = new FormData();
  formData.append('author', author);
  formData.append('title', title);
  formData.append('content', content);
  formData.append('board', currentBoard);
  selectedFiles.forEach(file => formData.append('files', file));
  if (isEdit && deleteFileIds.length > 0) formData.append('deleteFileIds', JSON.stringify(deleteFileIds));

  try {
    const result = isEdit ? await updatePost(editId, formData) : await createPost(formData);
    if (result.ok) {
      showToast(isEdit ? '수정되었습니다.' : '등록되었습니다.');
      const postId = isEdit ? editId : result.data.id;
      setTimeout(() => location.href = `view.html?id=${postId}&board=${currentBoard}`, 600);
      return;
    }

    showToast(result.data.error || '오류가 발생했습니다.', true);
    resetSubmitButton(button);
  } catch {
    showToast('서버 오류가 발생했습니다.', true);
    resetSubmitButton(button);
  }
}

// 저장 실패 후 다시 버튼을 누를 수 있도록 원래 글자로 되돌립니다.
function resetSubmitButton(button) {
  button.disabled = false;
  button.textContent = isEdit ? '수정 완료' : '등록';
}

// HTML로 복사된 내용을 붙여넣을 때 마크다운으로 자동 변환합니다.
function handlePasteAsMarkdown(event) {
  const html = event.clipboardData.getData('text/html');
  if (!html) return;

  event.preventDefault();
  const turndown = new window.TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  const markdown = turndown.turndown(html);
  const input = event.target;
  const start = input.selectionStart;
  const before = input.value.slice(0, start);
  const after = input.value.slice(input.selectionEnd);
  input.value = before + markdown + after;
  input.selectionStart = input.selectionEnd = start + markdown.length;
}
