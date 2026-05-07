/**
 * 이 파일은 글쓰기와 글수정 화면을 담당합니다.
 * 제목/내용 저장, 파일 첨부, 캡쳐 이미지 붙여넣기, 기존 첨부파일 삭제 표시, HTML 붙여넣기 변환을 처리합니다.
 */
import { boardMeta, setupHomeLink } from './board.js';
import { createPost, fetchPost, updatePost } from './api.js';
import { escHtml, formatSize, isImage, showToast } from './utils.js';

// JavaScript 주석 문법: 이 파일은 글쓰기 화면(write.html)의 동작만 담당하는 모듈입니다.
// 새 글 등록, 기존 글 수정, 파일 선택, 캡쳐 이미지 붙여넣기, HTML 붙여넣기 변환 기능을 HTML에서 분리했습니다.
const params = new URLSearchParams(location.search);
const editId = params.get('id');
const isEdit = Boolean(editId);
let currentBoard = boardMeta[params.get('board')] ? params.get('board') : 'project';
let selectedFiles = [];
let deleteFileIds = [];
const inlineImageNames = new Set();

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

  document.getElementById('contentEditor').addEventListener('paste', handleContentPaste);
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
  // JavaScript 주석 문법: 작성자 입력칸을 제거했기 때문에 수정 화면에서도 작성자 값은 채우지 않습니다.
  document.getElementById('title').value = post.title;
  setEditorFromSavedContent(post.content, post.files || []);
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
    if (inlineImageNames.has(file.name)) return;

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
  inlineImageNames.delete(selectedFiles[index]?.name);
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
}

// 등록/수정 버튼을 누르면 글 내용, 새 첨부파일, 삭제할 기존 파일 목록을 서버에 보냅니다.
async function submitPost() {
  const title = document.getElementById('title').value.trim();
  const content = getEditorMarkdown().trim();
  document.getElementById('content').value = content;

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
  // JavaScript 주석 문법: 작성자 값을 보내지 않으면 서버가 기본값인 익명으로 저장합니다.
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

// 편집 영역에 붙여넣을 때 캡쳐 이미지는 글 안에 바로 보이게 넣고, HTML 글은 보기 좋은 형태로 붙여넣습니다.
function handleContentPaste(event) {
  const imageFiles = getClipboardImageFiles(event);
  if (imageFiles.length > 0) {
    event.preventDefault();
    addInlineImageFiles(imageFiles);
    imageFiles.forEach(file => insertInlineImage(file));
    showToast('캡쳐 이미지를 내용란에 추가했습니다.');
    return;
  }

  const html = event.clipboardData.getData('text/html');
  if (!html) return;

  event.preventDefault();
  document.execCommand('insertHTML', false, html);
}

// 캡쳐 이미지는 서버에 저장할 첨부파일 목록에는 넣되, 첨부파일란 미리보기에는 보이지 않도록 이름을 따로 기억합니다.
function addInlineImageFiles(files) {
  files.forEach(file => inlineImageNames.add(file.name));
  addFiles(files);
}

// 내용 편집 영역의 현재 커서 위치에 이미지 태그를 바로 넣습니다. 사용자는 붙여넣는 즉시 이미지를 볼 수 있습니다.
function insertInlineImage(file) {
  const wrapper = createResizableImageWrapper(file.name);
  const image = document.createElement('img');
  image.src = URL.createObjectURL(file);
  image.alt = '캡쳐 이미지';
  image.dataset.attachmentName = file.name;
  image.onload = () => {
    wrapper.style.width = `${Math.min(image.naturalWidth || 520, 520)}px`;
    wrapper.style.height = `${Math.min(image.naturalHeight || 320, 420)}px`;
    URL.revokeObjectURL(image.src);
  };
  wrapper.appendChild(image);
  insertNodeAtCursor(wrapper);
  insertNodeAtCursor(document.createElement('br'));
}

// 이미지 크기를 사용자가 바꿀 수 있도록 감싸는 박스를 만듭니다. tabindex는 클릭해서 선택 표시를 볼 수 있게 해줍니다.
function createResizableImageWrapper(fileName) {
  const wrapper = document.createElement('span');
  wrapper.className = 'inline-image-resizer';
  wrapper.contentEditable = 'false';
  wrapper.tabIndex = 0;
  wrapper.dataset.attachmentName = fileName;
  return wrapper;
}

// contenteditable 편집 영역은 textarea가 아니므로, 브라우저 선택 영역에 직접 노드를 끼워 넣습니다.
function insertNodeAtCursor(node) {
  const editor = document.getElementById('contentEditor');
  editor.focus();
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    editor.appendChild(node);
    return;
  }
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.setEndAfter(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

// 클립보드 안에서 이미지 파일만 골라냅니다. 캡쳐 도구로 복사한 이미지는 보통 image/png 형태로 들어옵니다.
function getClipboardImageFiles(event) {
  const items = [...event.clipboardData.items];
  return items
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => createClipboardImageFile(item.getAsFile(), item.type))
    .filter(Boolean);
}

// 클립보드 이미지는 파일명이 비어 있는 경우가 많아서, 저장하기 쉬운 이름을 새로 붙입니다.
function createClipboardImageFile(file, mimeType) {
  if (!file) return null;
  const extension = fileExtensionFromMime(mimeType);
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  return new File([file], `clipboard-image-${timestamp}.${extension}`, {
    type: mimeType || file.type || 'image/png',
    lastModified: Date.now(),
  });
}

// 이미지 종류에 맞춰 파일 확장자를 정합니다. 모르는 형식이면 가장 흔한 png로 저장합니다.
function fileExtensionFromMime(mimeType) {
  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
  };
  return extensionMap[mimeType] || 'png';
}

// 저장된 마크다운 글을 편집 영역에 다시 보여줍니다. attachment: 이미지는 실제 업로드 주소로 바꿔서 보이게 합니다.
function setEditorFromSavedContent(content, files) {
  const editor = document.getElementById('contentEditor');
  let visibleContent = content;
  files.filter(file => isImage(file.original_name)).forEach(file => {
    visibleContent = visibleContent.split(`attachment:${file.original_name}`).join(`/uploads/${file.filename}`);
    visibleContent = visibleContent
      .split(`[캡쳐 이미지 첨부: ${file.original_name}]`)
      .join(`![캡쳐 이미지](/uploads/${file.filename})`);
  });
  editor.innerHTML = window.marked.parse(visibleContent);
  makeEditorImagesResizable(files);
  document.getElementById('content').value = content;
}

// 편집 영역의 HTML을 서버에 저장할 마크다운으로 바꿉니다. 붙여넣은 이미지는 attachment:파일명 형태로 저장합니다.
function getEditorMarkdown() {
  syncInlineImageSizes();
  const editorClone = document.getElementById('contentEditor').cloneNode(true);
  editorClone.querySelectorAll('.inline-image-resizer').forEach(wrapper => {
    const image = wrapper.querySelector('img[data-attachment-name]');
    if (!image) return;
    const width = Number(wrapper.dataset.width) || 520;
    const height = Number(wrapper.dataset.height) || 320;
    const html = document.createElement('div');
    html.innerHTML = `<img src="attachment:${image.dataset.attachmentName}" alt="${image.alt || '캡쳐 이미지'}" width="${width}" height="${height}">`;
    wrapper.replaceWith(html.firstChild);
  });
  const turndown = new window.TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  turndown.addRule('keepSizedAttachmentImage', {
    filter: node => node.nodeName === 'IMG' && node.getAttribute('src')?.startsWith('attachment:'),
    replacement: (_content, node) => {
      const src = node.getAttribute('src');
      const alt = node.getAttribute('alt') || '캡쳐 이미지';
      const width = node.getAttribute('width');
      const height = node.getAttribute('height');
      return `\n<img src="${src}" alt="${alt}" width="${width}" height="${height}">\n`;
    },
  });
  return turndown.turndown(editorClone.innerHTML);
}

// 저장 직전에 사용자가 손으로 조절한 이미지 박스의 현재 가로/세로 크기를 읽어둡니다.
function syncInlineImageSizes() {
  document.querySelectorAll('.inline-image-resizer').forEach(wrapper => {
    const rect = wrapper.getBoundingClientRect();
    wrapper.dataset.width = String(Math.round(rect.width || wrapper.offsetWidth || 520));
    wrapper.dataset.height = String(Math.round(rect.height || wrapper.offsetHeight || 320));
  });
}

// 수정 화면에서 기존 본문 이미지를 다시 열었을 때도 크기를 조절할 수 있도록 이미지에 리사이즈 박스를 씌웁니다.
function makeEditorImagesResizable(files) {
  const editor = document.getElementById('contentEditor');
  editor.querySelectorAll('img').forEach(image => {
    if (image.closest('.inline-image-resizer')) return;
    const file = files.find(item => image.src.includes(`/uploads/${item.filename}`));
    if (!file) return;

    image.dataset.attachmentName = file.original_name;
    const wrapper = createResizableImageWrapper(file.original_name);
    const width = image.getAttribute('width') || image.naturalWidth || 520;
    const height = image.getAttribute('height') || image.naturalHeight || 320;
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    image.replaceWith(wrapper);
    wrapper.appendChild(image);
  });
}
