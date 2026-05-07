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
  syncImageSizes()
  const clone = editorEl.value.cloneNode(true)
  clone.querySelectorAll('.inline-image-resizer').forEach(wrapper => {
    const img = wrapper.querySelector('img[data-attachment-name]')
    if (!img) return
    const w = Number(wrapper.dataset.width) || 520
    const h = Number(wrapper.dataset.height) || 320
    const el = document.createElement('div')
    el.innerHTML = `<img src="attachment:${img.dataset.attachmentName}" alt="${img.alt || '캡쳐 이미지'}" width="${w}" height="${h}">`
    wrapper.replaceWith(el.firstChild)
  })
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
  return td.turndown(clone.innerHTML)
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
