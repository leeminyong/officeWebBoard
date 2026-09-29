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

      <!-- HTML 블록 넣기 버튼 -->
      <!-- 누르면 아래쪽 입력창(html-dialog)이 열리고, 거기에 HTML 코드를 붙여 넣습니다. -->
      <!-- &lt;/&gt; : HTML 안에서 "<" ">" 글자를 그대로 쓰면 태그로 오해받기 때문에, 대신 쓰는 표기입니다. 화면에는 </> 로 보입니다. -->
      <!-- type="button" : form 안에서 버튼을 눌러도 "제출" 동작이 일어나지 않게 하는 설정입니다. -->
      <!-- @mousedown="saveSelection" : 입력창이 열리면 에디터의 커서 위치가 사라지므로, 버튼을 누르는 순간 커서 위치를 먼저 저장해 둡니다. -->
      <!--   (글자 색상 버튼과 같은 이유, 같은 함수를 다시 씁니다.) -->
      <button
        type="button"
        class="toolbar-btn"
        title="HTML 블록 넣기 (스크립트·애니메이션 포함 HTML을 글 안에서 실행)"
        @mousedown="saveSelection"
        @click="openHtmlDialog(null)"
      >&lt;/&gt; HTML</button>

    </div>

    <!-- 실제 글을 입력하는 영역. contenteditable="true"로 사용자가 직접 타이핑할 수 있습니다. -->
    <!-- @click="handleEditorClick" : 에디터 안의 "HTML 블록" 상자를 클릭하면 수정 입력창을 열기 위해 씁니다. -->
    <div
      ref="editorEl"
      class="form-control content-editor md-body"
      contenteditable="true"
      data-placeholder="내용을 입력하세요..."
      @paste="handlePaste"
      @click="handleEditorClick"
    ></div>

    <!-- HTML 붙여넣기 입력창 -->
    <!-- v-if : 조건이 true일 때만 화면에 그리는 Vue 문법입니다. htmlDialogOpen이 true일 때만 입력창이 보입니다. -->
    <!--   (안드로이드에서 Dialog를 show()/dismiss() 하는 것과 비슷합니다.) -->
    <!-- @click.self : 바깥 어두운 배경 자체를 클릭했을 때만 닫습니다. (.self = 안쪽 상자를 클릭한 경우는 무시) -->
    <div v-if="htmlDialogOpen" class="html-dialog-backdrop" @click.self="closeHtmlDialog">
      <div class="html-dialog">
        <h3>{{ editingBox ? 'HTML 블록 수정' : 'HTML 블록 넣기' }}</h3>
        <p class="html-dialog-help">
          HTML 파일 내용을 통째로 붙여 넣으세요. 글보기 화면에서 게시판과 분리된 별도 창(iframe) 안에서 실행되므로,
          스크립트·애니메이션이 동작하고 게시판 화면이나 로그인 정보에는 영향을 주지 않습니다.
        </p>
        <!-- v-model : textarea에 입력한 글자가 htmlDraft 변수에 자동으로 들어가고, 반대로 htmlDraft를 바꾸면 textarea도 바뀝니다. -->
        <!--   (안드로이드 Data Binding의 양방향 바인딩 @={} 과 같습니다.) -->
        <!-- spellcheck="false" : 코드에 빨간 맞춤법 밑줄이 생기지 않게 합니다. -->
        <textarea
          ref="htmlTextareaEl"
          v-model="htmlDraft"
          class="form-control html-dialog-input"
          spellcheck="false"
          placeholder="<!doctype html> ..."
        ></textarea>
        <div class="html-dialog-actions">
          <button type="button" class="btn btn-secondary btn-sm" @click="closeHtmlDialog">취소</button>
          <button type="button" class="btn btn-primary btn-sm" @click="confirmHtmlDialog">
            {{ editingBox ? '수정' : '넣기' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
// nextTick : Vue가 화면을 다시 그린 "직후"에 코드를 실행하게 해 주는 함수입니다. (입력창이 화면에 나타난 뒤 포커스를 주려고 씁니다.)
import { ref, nextTick } from 'vue'
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
  // styleWithCSS : 색상을 어떤 형태로 넣을지 정하는 설정입니다.
  // false(기본)면 색을 옛날 방식인 <font color="..."> 태그로 넣습니다.
  // 그런데 저장할 때 색을 지켜내는 코드(getMarkdown의 querySelectorAll('[style]'))는
  // style 속성이 붙은 요소만 챙기기 때문에, <font color>로 들어간 색은 저장 중에 버려집니다.
  // 그래서 true로 켜서, 색이 <span style="color: ..."> 형태로 들어가게 만듭니다.
  // 이러면 기존 보존 코드가 색을 자동으로 지켜냅니다.
  document.execCommand('styleWithCSS', false, true)

  // execCommand('foreColor')는 선택된 텍스트에 글자 색상을 적용하는 브라우저 내장 명령입니다.
  // 안드로이드의 SpannableString에 ForegroundColorSpan을 적용하는 것과 비슷합니다.
  document.execCommand('foreColor', false, selectedColor.value)
}

// ──────────────────────────────────────────────────────────────────
// [HTML 블록 기능]
//
// 사용자가 붙여 넣은 HTML(스크립트·애니메이션 포함)을 글 안에 넣는 기능입니다.
// 1단계: 툴바의 </> HTML 버튼 → 입력창에 HTML 붙여넣기 → "넣기"
// 2단계: 에디터 안에는 코드 전체 대신 "🧩 HTML 블록" 상자가 들어갑니다.
//        실제 HTML 원본은 상자의 data-html 속성(요소에 붙이는 숨은 값)에 보관합니다.
// 3단계: 저장할 때(getMarkdown) 상자를 ```html-run ... ``` 코드블록으로 바꿔 저장합니다.
// 4단계: 글보기(PostDetailView.vue)에서 html-run 코드블록을 iframe으로 바꿔 실행합니다.
// ──────────────────────────────────────────────────────────────────

// 입력창이 열려 있는지 여부입니다. true면 입력창이 보입니다.
const htmlDialogOpen = ref(false)
// 입력창 textarea에 들어 있는 글자입니다.
const htmlDraft = ref('')
// 기존 상자를 클릭해서 "수정"하는 중이면 그 상자 요소, 새로 넣는 중이면 null 입니다.
const editingBox = ref(null)
// 입력창 textarea 요소입니다. 열릴 때 커서를 넣어 주기 위해 씁니다.
const htmlTextareaEl = ref(null)

// 입력창을 엽니다.
// box 가 null이면 "새로 넣기", 상자 요소가 들어오면 그 상자의 HTML을 불러와 "수정" 모드로 엽니다.
function openHtmlDialog(box) {
  editingBox.value = box
  // box?.dataset.html : box가 null이면 에러 없이 undefined를 돌려주는 문법(?.)입니다.
  // || '' : 값이 없으면 빈 문자열을 씁니다.
  htmlDraft.value = box?.dataset.html || ''
  htmlDialogOpen.value = true
  // 입력창이 실제로 화면에 그려진 뒤에 커서를 넣어야 하므로 nextTick 안에서 focus()를 부릅니다.
  nextTick(() => htmlTextareaEl.value?.focus())
}

function closeHtmlDialog() {
  htmlDialogOpen.value = false
  editingBox.value = null
  htmlDraft.value = ''
}

// 입력창의 "넣기/수정" 버튼을 눌렀을 때 실행됩니다.
function confirmHtmlDialog() {
  // trim() : 앞뒤 공백·줄바꿈을 지운 문자열을 돌려줍니다. 공백만 있는지 확인하려고 씁니다.
  const html = htmlDraft.value.trim()
  const box = editingBox.value

  if (box) {
    // 수정 모드: 내용을 비우고 "수정"을 누르면 상자를 지우고, 아니면 상자의 HTML을 새 값으로 바꿉니다.
    if (html) fillHtmlBlockBox(box, html)
    else box.remove()
  } else if (html) {
    // 새로 넣기 모드: 상자를 만들어 저장해 둔 커서 위치에 넣습니다.
    insertHtmlBlockBox(fillHtmlBlockBox(createHtmlBlockBox(), html))
  }
  closeHtmlDialog()
}

// 에디터 안에 들어갈 "HTML 블록" 상자 요소를 만듭니다.
function createHtmlBlockBox() {
  const box = document.createElement('div')
  box.className = 'html-block-box'
  // contentEditable = 'false' : 상자 안의 글자를 사용자가 직접 고칠 수 없게 합니다.
  // 상자 전체가 하나의 덩어리로 취급되어, Backspace 한 번으로 통째로 지울 수 있습니다. (이미지 상자와 같은 방식)
  box.contentEditable = 'false'
  box.title = '클릭하면 HTML을 수정할 수 있습니다'
  return box
}

// 상자에 HTML 원본을 보관하고, 상자에 보이는 안내 글자를 갱신합니다.
function fillHtmlBlockBox(box, html) {
  // dataset.html = ... : 요소에 data-html="..." 속성을 붙입니다. 화면에는 보이지 않고 값만 보관됩니다.
  box.dataset.html = html
  // toLocaleString() : 숫자에 천 단위 쉼표를 붙입니다. (예: 35210 → "35,210")
  box.textContent = `🧩 HTML 블록 (${html.length.toLocaleString()}자) · 클릭해서 수정`
  return box
}

// 상자를 에디터의 커서 위치에 넣습니다.
function insertHtmlBlockBox(box) {
  const el = editorEl.value
  el.focus()
  const sel = window.getSelection()
  sel.removeAllRanges()
  // 버튼을 누를 때 저장해 둔 커서 위치(savedRange)가 에디터 안이면 그 위치로 복원합니다.
  // el.contains(...) : 해당 위치가 에디터 요소 안에 있는지 확인합니다.
  // 에디터 밖(예: 제목 칸)에 커서가 있었다면 복원하지 않아서, 아래 insertNodeAtCursor가 에디터 맨 끝에 넣게 됩니다.
  if (savedRange && el.contains(savedRange.commonAncestorContainer)) sel.addRange(savedRange)
  insertNodeAtCursor(box)
  // 상자 뒤에 줄바꿈을 하나 넣어서, 이어서 글을 쓸 수 있게 합니다. (이미지 넣기와 같은 방식)
  insertNodeAtCursor(document.createElement('br'))
}

// 에디터 안을 클릭했을 때, 클릭한 곳이 "HTML 블록" 상자면 수정 입력창을 엽니다.
function handleEditorClick(event) {
  // closest('.html-block-box') : 클릭한 요소부터 위쪽 부모로 올라가며 이 class를 가진 요소를 찾습니다. 없으면 null.
  const box = event.target.closest('.html-block-box')
  if (box) openHtmlDialog(box)
}

// 저장할 HTML을 Markdown 코드블록 글자로 만듭니다.
// 결과 예:
//   ```html-run
//   <!doctype html> ...
//   ```
// "html-run" 이름표 덕분에 글보기 화면이 일반 코드블록과 구별해서 실행할 수 있습니다.
function toHtmlRunFence(html) {
  // HTML 안에 ``` 가 들어 있으면 코드블록이 중간에 끝나 버립니다.
  // 그래서 HTML 안에서 가장 길게 이어진 ` 개수보다 1개 더 긴 울타리(fence)를 씁니다. (최소 3개)
  // match(/`+/g) : 연속된 ` 묶음을 모두 찾아 배열로 돌려줍니다. 없으면 null이라 || [] 로 빈 배열을 씁니다.
  // Math.max(...배열) : 배열 안의 가장 큰 숫자를 구합니다. (... 는 배열을 풀어서 넘기는 문법입니다.)
  const longest = Math.max(0, ...(html.match(/`+/g) || []).map(run => run.length))
  // repeat(n) : 문자열을 n번 반복합니다. (예: '`'.repeat(3) → '```')
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `\n\n${fence}html-run\n${html}\n${fence}\n\n`
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

  // [HTML 블록 저장 준비]
  // "HTML 블록" 상자를 임시 표시(예: HTMLRUN0END)로 바꾸고, 상자 안의 HTML 원본은 runBlocks 배열에 따로 보관합니다.
  // 변환 도구(TurndownService)가 HTML 원본을 건드리지 못하게 하려는 것이며, 아래 style 색상 보존과 같은 방식입니다.
  // 변환이 끝나면 맨 아래에서 임시 표시 자리에 ```html-run 코드블록을 넣습니다.
  const runBlocks = []
  clone.querySelectorAll('.html-block-box').forEach(box => {
    const placeholder = `HTMLRUN${runBlocks.length}END`
    runBlocks.push(box.dataset.html || '')
    box.replaceWith(document.createTextNode(placeholder))
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
  // [중요] 예전에는 `\n\n${html}\n\n` 처럼 태그 앞뒤에 빈 줄(\n\n = 줄바꿈 2개)을 강제로 넣었습니다.
  //        그 결과 <span style="..."> 로 감싸진 글자(예: "(완료)")가 항상 다음 줄로 떨어져서,
  //        사용자가 수정모드에서 줄을 합쳐도 저장하면 다시 빈 줄이 생기는 문제가 있었습니다.
  //        이제는 빈 줄을 넣지 않고 태그(html)만 원래 자리에 그대로 넣습니다.
  //        임시 표시(RAWHTML0END 등)는 원래 태그가 있던 그 위치에 들어있으므로,
  //        사용자가 같은 줄에 붙이면 같은 줄로, 줄을 나누면 나뉜 채로 — 편집한 그대로 저장됩니다.
  htmlBlocks.forEach((html, i) => {
    md = md.replace(`RAWHTML${i}END`, html)
  })

  // [HTML 블록 되돌려 넣기] 임시 표시(HTMLRUN0END 등) 자리에 ```html-run 코드블록을 넣습니다.
  // replace의 두 번째 값으로 문자열 대신 함수 () => ... 를 넘긴 이유:
  //   문자열을 넘기면 그 안의 $&, $' 같은 글자를 특별한 기호로 해석해서 바꿔 버립니다.
  //   HTML/자바스크립트 코드에는 $ 가 자주 나오므로, 함수로 넘겨서 글자 그대로 들어가게 합니다.
  runBlocks.forEach((html, i) => {
    md = md.replace(`HTMLRUN${i}END`, () => toHtmlRunFence(html))
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
  restoreHtmlBlockBoxes()
}

// 수정 모드에서 저장된 글을 불러올 때, ```html-run 코드블록을 다시 "HTML 블록" 상자로 바꿉니다.
// marked.parse()는 ```html-run 코드블록을 <pre><code class="language-html-run">...</code></pre> 로 만듭니다.
function restoreHtmlBlockBoxes() {
  editorEl.value.querySelectorAll('pre > code.language-html-run').forEach(code => {
    // textContent : 요소 안의 글자만 꺼냅니다. marked가 &lt; 처럼 바꿔 둔 글자가 원래의 < 로 돌아옵니다.
    // replace(/\n$/, '') : 코드블록 끝에 붙는 줄바꿈 하나를 지웁니다. ($ = 문자열의 끝)
    const html = code.textContent.replace(/\n$/, '')
    // code.parentElement : <code>를 감싼 <pre> 요소입니다. <pre> 전체를 상자로 바꿉니다.
    code.parentElement.replaceWith(fillHtmlBlockBox(createHtmlBlockBox(), html))
  })
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

/* </> HTML 툴바 버튼. 글자 색상 버튼(.toolbar-color-wrap)과 같은 크기·모양으로 맞춥니다. */
.toolbar-btn {
  padding: 4px 7px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 13px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
}

.toolbar-btn:hover {
  background: #e2e6ea;
}

/* 에디터 안의 "🧩 HTML 블록" 상자 */
/* :deep(...) : scoped 스타일은 원래 template에 직접 적은 요소에만 적용됩니다. */
/*   HTML 블록 상자는 자바스크립트(createHtmlBlockBox)로 나중에 만든 요소라서, :deep()으로 감싸야 스타일이 적용됩니다. */
.content-editor :deep(.html-block-box) {
  display: block;
  margin: 6px 0;
  padding: 10px 12px;
  border: 1px dashed #1a73e8;
  border-radius: 6px;
  background: #eef4fe;
  color: #1a4fa0;
  font-size: .9rem;
  cursor: pointer;
  user-select: none;       /* 상자 글자가 드래그로 선택되지 않게 합니다. */
}

.content-editor :deep(.html-block-box:hover) {
  background: #dfeafd;
}

/* 입력창 뒤의 어두운 배경. 화면 전체를 덮습니다. */
.html-dialog-backdrop {
  position: fixed;         /* 스크롤과 상관없이 화면(브라우저 창) 기준으로 고정합니다. */
  inset: 0;                /* top/right/bottom/left 를 모두 0으로 = 화면 전체를 덮습니다. */
  z-index: 1000;           /* 다른 요소보다 위에 보이게 합니다. (숫자가 클수록 위) */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, .45);  /* 45% 불투명한 검정 */
}

/* 입력창 본체 */
.html-dialog {
  width: min(900px, 100%);  /* 900px과 화면 너비 중 작은 값. 좁은 화면에서도 넘치지 않습니다. */
  max-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 10px;
  background: #fff;
  color: #222;             /* 다크 모드에서도 흰 배경 위 글자가 잘 보이도록 글자색을 고정합니다. (에디터 칸도 다크 모드에서 흰 배경을 씁니다) */
  box-shadow: 0 10px 30px rgba(0, 0, 0, .25);
}

.html-dialog h3 {
  margin: 0;
  font-size: 1.05rem;
}

.html-dialog-help {
  margin: 0;
  font-size: .85rem;
  color: #666;
}

/* HTML을 붙여 넣는 큰 입력칸. 코드가 보기 좋게 고정폭 글꼴을 씁니다. */
.html-dialog-input {
  height: 55vh;            /* vh : 화면 높이의 퍼센트. 55vh = 화면 높이의 55% */
  resize: vertical;        /* 사용자가 세로 크기만 조절할 수 있습니다. */
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12.5px;
  white-space: pre;        /* 줄을 자동으로 접지 않고 코드 모양 그대로 보여줍니다. */
}

.html-dialog-actions {
  display: flex;
  justify-content: flex-end;  /* 버튼들을 오른쪽 끝으로 붙입니다. */
  gap: 8px;
}
</style>
