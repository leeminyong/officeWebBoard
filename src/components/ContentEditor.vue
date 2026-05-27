<template>
  <!-- 에디터 전체를 감싸는 wrapper div. 툴바와 글쓰기 영역을 세로로 배치합니다. -->
  <div class="editor-wrapper">

    <!-- 서식 도구 모음(툴바). 글쓰기 영역 위에 표시됩니다. -->
    <div class="editor-toolbar">

      <!-- 글자 색상 버튼 영역 -->
      <!-- position:relative로 감싸서, 안에 있는 color input이 이 영역 전체를 덮도록 합니다. -->
      <div class="toolbar-color-wrap" title="글자 색상 변경">
        <!-- 색상 표시 아이콘: "A" 글자 아래에 현재 선택된 색상 줄이 표시됩니다. -->
        <!-- :style은 Vue에서 인라인 스타일을 동적으로 바꿀 때 쓰는 문법입니다. -->
        <!-- selectedColor가 바뀔 때마다 밑줄 색도 자동으로 바뀝니다. -->
        <span class="color-icon" :style="{ borderBottomColor: selectedColor }">A</span>

        <!-- type="color"는 브라우저 내장 색상 선택 팝업을 여는 입력 요소입니다. -->
        <!-- @mousedown: 색상 팝업이 열리기 직전에 현재 선택 영역을 저장합니다. -->
        <!--   (팝업이 열리면 에디터 포커스가 사라져 선택이 풀리기 때문에 미리 저장해둡니다.) -->
        <!-- @change: 색상을 고른 뒤 확인하면 저장해둔 선택 영역에 색상을 적용합니다. -->
        <input
          type="color"
          v-model="selectedColor"
          @mousedown="saveSelection"
          @change="applyColor"
        />
      </div>

    </div>

    <!-- 실제 글을 입력하는 영역. contenteditable="true"로 사용자가 직접 타이핑할 수 있습니다. -->
    <div
      ref="editorEl"
      class="form-control content-editor md-body"
      contenteditable="true"
      data-placeholder="내용을 입력하세요..."
      @paste="handlePaste"
    ></div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { isImage } from '../utils.js'

const emit = defineEmits(['inlineFilesAdded'])
const editorEl = ref(null)

// 현재 툴바에서 선택된 글자 색상입니다. 초기값은 검정(#000000)입니다.
// ref()는 안드로이드의 LiveData처럼, 값이 바뀌면 화면도 자동으로 업데이트됩니다.
const selectedColor = ref('#000000')

// 색상 팝업이 열리기 직전에 에디터의 현재 선택 영역(드래그한 텍스트)을 저장합니다.
// 팝업이 열리면 에디터 포커스가 사라지고 선택이 풀리기 때문에, 미리 저장해둬야 합니다.
let savedRange = null
function saveSelection() {
  const sel = window.getSelection() // 현재 브라우저에서 선택된 텍스트 정보를 가져옵니다.
  if (sel && sel.rangeCount > 0) {
    savedRange = sel.getRangeAt(0).cloneRange() // 선택 범위를 복사해서 저장합니다.
  }
}

// 색상 팝업에서 색상을 고른 뒤 호출됩니다.
// 저장해둔 선택 영역을 복원하고, 거기에 선택한 색상을 적용합니다.
function applyColor() {
  editorEl.value.focus() // 에디터에 포커스를 돌려줍니다.
  if (savedRange) {
    // 저장해둔 선택 영역을 다시 활성화합니다.
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(savedRange)
  }
  // execCommand('foreColor')는 선택된 텍스트에 글자 색상을 적용하는 브라우저 내장 명령입니다.
  // 안드로이드의 SpannableString에 ForegroundColorSpan을 적용하는 것과 비슷합니다.
  document.execCommand('foreColor', false, selectedColor.value)
}

function handlePaste(event) {
  const imageFiles = getClipboardImageFiles(event)
  if (imageFiles.length > 0) {
    event.preventDefault()
    emit('inlineFilesAdded', imageFiles)
    imageFiles.forEach(file => insertInlineImage(file))
    return
  }
  const html = event.clipboardData.getData('text/html')
  if (!html) return
  event.preventDefault()
  document.execCommand('insertHTML', false, html)
}

function getClipboardImageFiles(event) {
  return [...event.clipboardData.items]
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => createClipboardImageFile(item.getAsFile(), item.type))
    .filter(Boolean)
}

function createClipboardImageFile(file, mimeType) {
  if (!file) return null
  const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg' }
  const ext = extMap[mimeType] || 'png'
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
  return new File([file], `clipboard-image-${ts}.${ext}`, { type: mimeType || 'image/png', lastModified: Date.now() })
}

function insertInlineImage(file) {
  const wrapper = createResizableWrapper(file.name)
  const img = document.createElement('img')
  img.src = URL.createObjectURL(file)
  img.alt = '캡쳐 이미지'
  img.dataset.attachmentName = file.name
  img.onload = () => {
    // 이미지의 실제 픽셀 크기를 읽습니다. (naturalWidth = 이미지 파일의 원본 가로 픽셀 수)
    const naturalW = img.naturalWidth || 520
    const naturalH = img.naturalHeight || 320
    // 표시 너비를 결정합니다.
    // - 이미지가 너무 작으면(300px 미만) → 최소 300px로 키웁니다.
    // - 이미지가 너무 크면(520px 초과) → 최대 520px로 줄입니다.
    // Math.max(a, b) = a와 b 중 큰 값, Math.min(a, b) = a와 b 중 작은 값
    const displayW = Math.max(Math.min(naturalW, 520), 300)
    // 너비가 바뀐 만큼 높이도 같은 비율로 조정합니다. (이미지 비율 유지)
    // 예: 원본이 100×80인데 300px로 키우면, 높이도 240px로 늘어납니다.
    // Math.round() = 소수점 반올림
    const displayH = Math.min(Math.round(naturalH * (displayW / naturalW)), 420)
    wrapper.style.width = `${displayW}px`
    wrapper.style.height = `${displayH}px`
    URL.revokeObjectURL(img.src)
  }
  wrapper.appendChild(img)
  insertNodeAtCursor(wrapper)
  insertNodeAtCursor(document.createElement('br'))
}

function createResizableWrapper(fileName) {
  const w = document.createElement('span')
  w.className = 'inline-image-resizer'
  w.contentEditable = 'false'
  w.tabIndex = 0
  w.dataset.attachmentName = fileName
  return w
}

function insertNodeAtCursor(node) {
  const el = editorEl.value
  el.focus()
  const sel = window.getSelection()
  if (!sel.rangeCount) { el.appendChild(node); return }
  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(node)
  range.setStartAfter(node)
  range.setEndAfter(node)
  sel.removeAllRanges()
  sel.addRange(range)
}

function getMarkdown() {
  // 에디터에 삽입된 이미지들의 현재 크기(가로/세로)를 먼저 측정해 저장합니다.
  syncImageSizes()

  // 에디터 내용을 복사본으로 만듭니다. (원본을 건드리지 않고 작업하기 위해)
  const clone = editorEl.value.cloneNode(true)

  // 복사본 안의 이미지 요소들을 찾아서, 서버에 저장할 수 있는 형태로 변환합니다.
  // 화면에 보이는 <img src="blob:..."> 형태 → 저장용 <img src="attachment:파일명"> 형태
  clone.querySelectorAll('.inline-image-resizer').forEach(wrapper => {
    const img = wrapper.querySelector('img[data-attachment-name]')
    if (!img) return
    const w = Number(wrapper.dataset.width) || 520
    const h = Number(wrapper.dataset.height) || 320
    const el = document.createElement('div')
    el.innerHTML = `<img src="attachment:${img.dataset.attachmentName}" alt="${img.alt || '캡쳐 이미지'}" width="${w}" height="${h}">`
    wrapper.replaceWith(el.firstChild)
  })
  // ──────────────────────────────────────────────────────────────────
  // [왜 이 코드가 필요한가?]
  //
  // VS Code 같은 편집기에서 코드를 복사해서 게시글에 붙여넣으면,
  // 글자 색·배경색 정보가 코드 안에 같이 들어옵니다.
  // 예) <pre style="background:#2b2b2b; color:#fff"> ... </pre>
  //
  // 그런데 게시글을 저장할 때 쓰는 변환 도구(TurndownService)는
  // 이 style 색상 정보를 처리하지 못해서 저장할 때 몽땅 지워버립니다.
  // 그 결과 저장 후에 다시 보면 코드 색깔이 전부 사라집니다.
  //
  // [해결 순서]
  // 1단계: style 색상 정보가 있는 부분을 미리 꺼내고, 그 자리에 임시 표시(예: RAWHTML0END)를 넣습니다.
  // 2단계: 변환 도구는 임시 표시가 들어간 내용을 저장용 형식(Markdown)으로 바꿉니다.
  //         이때 style 색상 부분은 이미 빠져 있으므로 변환 도구가 건드리지 않습니다.
  // 3단계: 변환이 끝나면 임시 표시 자리에 1단계에서 꺼내뒀던 style 색상 코드를 다시 넣습니다.
  // ──────────────────────────────────────────────────────────────────

  // 1단계: style 색상 정보가 있는 요소를 찾아 임시 표시 문자열로 교체하고, 원본은 배열에 따로 저장합니다.
  // filter 조건: 이미 다른 style 요소 안에 들어있는 것은 건너뜁니다.
  //              부모 요소를 꺼낼 때 자식도 같이 따라오기 때문에 따로 처리할 필요가 없습니다.
  const htmlBlocks = []
  Array.from(clone.querySelectorAll('[style]'))
    .filter(el => !el.parentElement?.closest('[style]'))
    .forEach(el => {
      const placeholder = `RAWHTML${htmlBlocks.length}END`
      htmlBlocks.push(el.outerHTML) // 원본을 배열에 저장해 둡니다.
      el.replaceWith(document.createTextNode(placeholder)) // 원본 자리에 임시 표시를 넣습니다.
    })

  // 2단계: 변환 도구(TurndownService)로 에디터 내용을 저장용 형식(Markdown)으로 바꿉니다.
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  td.addRule('keepSizedAttachmentImage', {
    filter: node => node.nodeName === 'IMG' && node.getAttribute('src')?.startsWith('attachment:'),
    replacement: (_, node) => {
      const src = node.getAttribute('src')
      const alt = node.getAttribute('alt') || '캡쳐 이미지'
      const w = node.getAttribute('width')
      const h = node.getAttribute('height')
      return `\n<img src="${src}" alt="${alt}" width="${w}" height="${h}">\n`
    },
  })
  let md = td.turndown(clone.innerHTML)

  // 3단계: 임시 표시 자리에 1단계에서 저장해둔 원본 style 색상 코드를 다시 넣습니다.
  htmlBlocks.forEach((html, i) => {
    md = md.replace(`RAWHTML${i}END`, `\n\n${html}\n\n`)
  })

  return md
}

function syncImageSizes() {
  editorEl.value.querySelectorAll('.inline-image-resizer').forEach(w => {
    const rect = w.getBoundingClientRect()
    w.dataset.width = String(Math.round(rect.width || w.offsetWidth || 520))
    w.dataset.height = String(Math.round(rect.height || w.offsetHeight || 320))
  })
}

function setContent(markdown, files = []) {
  let html = markdown
  files.filter(f => isImage(f.original_name)).forEach(file => {
    html = html.split(`attachment:${file.original_name}`).join(`/uploads/${file.filename}`)
    html = html.split(`[캡쳐 이미지 첨부: ${file.original_name}]`).join(`![캡쳐 이미지](/uploads/${file.filename})`)
  })
  editorEl.value.innerHTML = marked.parse(html)
  makeImagesResizable(files)
}

function makeImagesResizable(files) {
  editorEl.value.querySelectorAll('img').forEach(img => {
    if (img.closest('.inline-image-resizer')) return
    const file = files.find(f => img.src.includes(`/uploads/${f.filename}`))
    if (!file) return
    img.dataset.attachmentName = file.original_name
    const wrapper = createResizableWrapper(file.original_name)
    const w = img.getAttribute('width') || img.naturalWidth || 520
    const h = img.getAttribute('height') || img.naturalHeight || 320
    wrapper.style.width = `${w}px`
    wrapper.style.height = `${h}px`
    img.replaceWith(wrapper)
    wrapper.appendChild(img)
  })
}

defineExpose({ getMarkdown, setContent })
</script>

<!-- scoped: 이 스타일은 ContentEditor.vue 안에서만 적용됩니다. 다른 파일에 영향을 주지 않습니다. -->
<style scoped>
/* 툴바와 글쓰기 영역을 위아래로 배치하는 컨테이너 */
.editor-wrapper {
  display: flex;           /* 자식 요소들을 가로/세로로 배치하는 레이아웃 방식입니다. */
  flex-direction: column;  /* 세로 방향(위→아래)으로 배치합니다. */
}

/* 서식 도구 모음(툴바) */
.editor-toolbar {
  display: flex;
  align-items: center;     /* 버튼들을 세로 중앙 정렬합니다. */
  padding: 4px 8px;
  border: 1px solid #ced4da;
  border-bottom: none;     /* 아래쪽 테두리는 글쓰기 영역과 겹치므로 제거합니다. */
  border-radius: 4px 4px 0 0;  /* 위쪽 모서리만 둥글게 합니다. */
  background: #f8f9fa;
  gap: 4px;
}

/* 툴바가 있을 때, 글쓰기 영역의 위쪽 모서리는 직각으로 맞춥니다. */
.editor-toolbar + .content-editor {
  border-radius: 0 0 4px 4px;
}

/* 글자 색상 버튼 영역 */
.toolbar-color-wrap {
  position: relative;      /* 안에 있는 color input을 이 영역 기준으로 배치하기 위해 씁니다. */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 7px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;       /* 버튼 클릭 시 글자가 선택되지 않도록 합니다. */
}

.toolbar-color-wrap:hover {
  background: #e2e6ea;
}

/* "A" 글자 아이콘. 아래쪽 3px 테두리가 현재 선택된 색상을 나타냅니다. */
.color-icon {
  font-weight: bold;
  font-size: 14px;
  line-height: 1;
  border-bottom: 3px solid #000000;  /* 기본값은 검정. :style로 동적으로 바뀝니다. */
  padding-bottom: 2px;
}

/* 색상 선택 input을 "A" 아이콘 영역 전체에 투명하게 덮어씌웁니다. */
/* 이렇게 하면 "A" 버튼 어디를 클릭해도 색상 팝업이 열립니다. */
.toolbar-color-wrap input[type="color"] {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;              /* 투명하게 숨깁니다. (하지만 클릭은 됩니다.) */
  cursor: pointer;
  border: none;
  padding: 0;
}
</style>
