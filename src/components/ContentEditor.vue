<template>
  <div
    ref="editorEl"
    class="form-control content-editor md-body"
    contenteditable="true"
    data-placeholder="내용을 입력하세요..."
    @paste="handlePaste"
  ></div>
</template>

<script setup>
import { ref } from 'vue'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { isImage } from '../utils.js'

const emit = defineEmits(['inlineFilesAdded'])
const editorEl = ref(null)

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
    wrapper.style.width = `${Math.min(img.naturalWidth || 520, 520)}px`
    wrapper.style.height = `${Math.min(img.naturalHeight || 320, 420)}px`
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
