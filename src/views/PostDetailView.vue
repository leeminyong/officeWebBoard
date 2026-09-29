<template>
  <div class="container" v-if="post">
    <div class="card">
      <h2 style="font-size:1.2rem;margin-bottom:8px">{{ post.title }}</h2>
      <div class="post-meta">
        <span>{{ post.created_at.slice(0, 16) }}</span>
        <span v-if="post.created_at !== post.updated_at" style="background:#fff3cd;color:#856404;padding:1px 8px;border-radius:10px;font-size:.78rem">수정됨</span>
      </div>

      <div class="post-content md-body" v-html="renderedContent"></div>

      <div v-if="visibleFiles.length" class="attach-section">
        <h4>첨부파일</h4>
        <div class="img-preview-grid">
          <div
            v-for="file in imageFiles" :key="file.id"
            class="img-preview-item" style="width:140px;height:140px" :title="file.original_name"
          >
            <img :src="`/uploads/${file.filename}`" :alt="file.original_name" loading="lazy" style="cursor:pointer" @click="downloadFile(file.id, file.original_name)" />
            <button class="remove-img" @click="handleDeletePostFile(file.id)" title="삭제">✕</button>
          </div>
        </div>
        <ul class="file-list">
          <li v-for="file in docFiles" :key="file.id" class="file-item">
            <span class="file-icon">📄</span>
            <span class="file-name" @click="downloadFile(file.id, file.original_name)">{{ file.original_name }}</span>
            <span class="file-size">{{ formatSize(file.file_size) }}</span>
            <button class="delete-file-btn" @click="handleDeletePostFile(file.id)" title="삭제">✕</button>
          </li>
        </ul>
      </div>

      <div class="action-bar" style="margin-top:24px">
        <div>
          <button class="btn btn-secondary" @click="goToList">← 목록</button>
        </div>
        <div class="right">
          <!-- HTML 주석 문법: 화살괄호와 느낌표, 붙임표 두 개로 감싼 글은 화면에 보이지 않습니다. -->
          <!-- 이동 드롭다운: 버튼 묶음의 맨 왼쪽에 표시되며, 누르면 게시판 목록이 펼쳐집니다. -->
          <!-- select : 목록 중 하나를 고르는 HTML 요소입니다. (안드로이드의 Spinner와 비슷) -->
          <!-- 버튼과 같은 모양이 되도록 btn 클래스를 함께 붙였고, 세부 모양은 style.css 의 .move-select 에 있습니다. -->
          <!-- @change : 사용자가 다른 항목을 고르면 실행됩니다. $event.target.value 는 고른 option 의 value(게시판 key)입니다. -->
          <!-- 고른 뒤 $event.target.value = '' 로 되돌려서, 이동을 취소해도 드롭다운이 항상 "이동 ▾" 글자로 돌아오게 합니다. -->
          <select
            class="btn btn-secondary btn-sm move-select"
            @change="handleMove($event.target.value); $event.target.value = ''"
          >
            <!-- 첫 번째 option : 드롭다운이 닫혀 있을 때 보이는 글자입니다. value 가 빈 문자열이라 골라도 이동하지 않습니다. -->
            <option value="">이동 ▾</option>
            <!-- v-for : moveTargets 배열의 항목 수만큼 option 을 반복해서 만듭니다. -->
            <!-- :value="b.key" : 이 항목을 고르면 select 의 값이 게시판 key 가 됩니다. -->
            <option v-for="b in moveTargets" :key="b.key" :value="b.key">{{ b.label }}</option>
          </select>
          <!-- 완료 버튼: '유지보수' 게시판에서만 고정 버튼 왼쪽에 표시됩니다. -->
          <!-- currentBoard === 'maintenance' : 현재 게시판이 유지보수일 때만 버튼을 보여줍니다. -->
          <button
            v-if="currentBoard === 'maintenance'"
            class="btn btn-secondary btn-sm"
            @click="handleComplete"
          >완료</button>
          <!-- 고정 버튼: 누를 때마다 고정/해제가 전환됩니다. -->
          <!-- post.is_pinned가 1(고정 상태)이면 '고정 해제', 0이면 '고정' 텍스트를 보여줍니다. -->
          <!-- v-if / v-else: 조건에 따라 두 버튼 중 하나만 화면에 그립니다. -->
          <button
            v-if="post.is_pinned"
            class="btn btn-secondary btn-sm"
            style="color:#e67e22;border-color:#e67e22"
            @click="handleTogglePin"
          >📌 고정 해제</button>
          <button
            v-else
            class="btn btn-secondary btn-sm"
            @click="handleTogglePin"
          >📌 고정</button>
          <button class="btn btn-secondary btn-sm" @click="goToEdit">수정</button>
          <button class="btn btn-danger btn-sm" @click="handleDeletePost">삭제</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="comment-section">
        <h3>댓글 <span>({{ post.comments?.length || 0 }})</span></h3>

        <div class="comment-list">
          <div v-if="!post.comments?.length" style="color:#bbb;font-size:.88rem;padding:8px 0">첫 댓글을 작성해보세요.</div>
          <div v-for="comment in post.comments" :key="comment.id" class="comment-item">
            <div class="comment-header">
              <span>
                <span class="comment-date">{{ comment.created_at.slice(0, 16) }}</span>
                <button class="comment-del" @click="startEditComment(comment)">수정</button>
                <button class="comment-del" @click="handleDeleteComment(comment.id)">삭제</button>
              </span>
            </div>
            <!-- Vue 주석 문법: 이 주석은 화면에 보이지 않습니다. 수정 중인 댓글만 textarea와 저장/취소 버튼으로 바꿔서, 사용자는 삭제뿐 아니라 댓글 내용을 바로 고칠 수 있습니다. -->
            <div v-if="editingCommentId === comment.id" class="comment-form" style="margin-top:8px">
              <textarea v-model="editingCommentContent" class="form-control" rows="3"></textarea>
              <div class="action-bar" style="margin-top:8px">
                <span></span>
                <div class="right">
                  <button class="btn btn-secondary btn-sm" @click="cancelEditComment">취소</button>
                  <button class="btn btn-primary btn-sm" @click="submitEditComment(comment.id)">저장</button>
                </div>
              </div>
            </div>
            <div v-else class="comment-text md-body" v-html="renderMd(comment.content)"></div>
            <div v-if="comment.files?.length" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
              <template v-for="file in comment.files" :key="file.id">
                <div v-if="isImage(file.original_name)" class="img-preview-item" style="width:80px;height:80px" :title="file.original_name">
                  <img :src="`/uploads/${file.filename}`" :alt="file.original_name" loading="lazy" style="cursor:pointer" @click="downloadCommentFile(file.id, file.original_name)" />
                  <button class="remove-img" @click="handleDeleteCommentFile(file.id)" title="삭제">✕</button>
                </div>
                <div v-else class="file-item" style="margin-top:4px">
                  <span class="file-icon">📄</span>
                  <span class="file-name" @click="downloadCommentFile(file.id, file.original_name)">{{ file.original_name }}</span>
                  <span class="file-size">{{ formatSize(file.file_size) }}</span>
                  <button class="delete-file-btn" @click="handleDeleteCommentFile(file.id)">✕</button>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="comment-form">
          <textarea v-model="cmtContent" class="form-control" placeholder="댓글을 입력하세요..."></textarea>
          <FileDropZone @filesAdded="addCmtFiles" />
          <div class="img-preview-grid" v-if="cmtImageItems.length">
            <div v-for="item in cmtImageItems" :key="item.index" class="img-preview-item">
              <img :src="makeUrl(item.file)" @load="e => URL.revokeObjectURL(e.target.src)" />
              <button class="remove-img" @click="removeCmtFile(item.index)">✕</button>
            </div>
          </div>
          <div class="selected-files" v-if="cmtDocItems.length">
            <div v-for="item in cmtDocItems" :key="item.index" class="selected-file-item">
              <span>📄</span><span>{{ item.name }}</span>
              <span class="file-size" style="color:#aaa;font-size:.8rem;margin-left:4px">{{ formatSize(item.size) }}</span>
              <button class="remove-btn" @click="removeCmtFile(item.index)">✕</button>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" @click="submitComment" style="align-self:flex-end">댓글 등록</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// onUnmounted : 화면이 사라질 때 실행할 코드를 등록하는 함수입니다. (안드로이드의 onDestroy()와 비슷합니다.)
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import FileDropZone from '../components/FileDropZone.vue'
import { usePostDetail } from '../composables/usePostDetail.js'
import { isImage, formatSize } from '../utils.js'

const route = useRoute()
const {
  post, currentBoard, cmtFiles, cmtContent, editingCommentId, editingCommentContent,
  // moveTargets : 이동 드롭다운에 보여줄 게시판 목록, handleMove : 게시판을 골랐을 때 실행할 함수
  moveTargets, handleMove,
  loadPost, handleDeletePost, handleTogglePin, handleComplete, submitComment, startEditComment, cancelEditComment, submitEditComment, handleDeleteComment,
  handleDeletePostFile, handleDeleteCommentFile,
  downloadFile, downloadCommentFile, addCmtFiles, removeCmtFile, goToEdit, goToList,
} = usePostDetail()

onMounted(() => loadPost())
watch(() => route.params.id, () => loadPost())

// breaks: true → 줄바꿈 1개(\n)도 <br>로 변환
// 기본값은 false라 줄바꿈 2개(\n\n)만 문단 나누기로 인식해서 개행이 사라졌었음
function renderMd(text) { return marked.parse(text || '', { breaks: true }) }
function makeUrl(file) { return URL.createObjectURL(file) }

function isInlineInContent(file, content) {
  return isImage(file.original_name) &&
    (content.includes(`attachment:${file.original_name}`) || content.includes(`[캡쳐 이미지 첨부: ${file.original_name}]`))
}

const renderedContent = computed(() => {
  if (!post.value) return ''
  let html = post.value.content
  ;(post.value.files || []).filter(f => isImage(f.original_name)).forEach(file => {
    html = html.split(`attachment:${file.original_name}`).join(`/uploads/${file.filename}`)
    html = html.split(`[캡쳐 이미지 첨부: ${file.original_name}]`).join(`![캡쳐 이미지](/uploads/${file.filename})`)
  })
  return renderHtmlRunBlocks(marked.parse(html))
})

// ──────────────────────────────────────────────────────────────────
// [HTML 블록 실행]
//
// 글쓰기의 </> HTML 버튼으로 넣은 HTML은 ```html-run 코드블록으로 저장되어 있습니다.
// marked.parse()를 거치면 <pre><code class="language-html-run">...</code></pre> 가 되는데,
// 이것을 <iframe>(웹페이지 안에 끼워 넣는 독립된 웹페이지)으로 바꿔서 HTML을 실제로 실행합니다.
//
// 왜 v-html로 바로 넣지 않고 iframe을 쓰는가?
//  - v-html로 넣은 <script>는 브라우저 규칙상 실행되지 않아 애니메이션이 동작하지 않습니다.
//  - 게시판 화면에서 직접 실행하면 그 스크립트가 로그인 상태로 게시판 API(글 삭제 등)를 부를 수 있고,
//    붙여 넣은 HTML의 CSS(body, :root 등)가 게시판 전체 모양을 덮어씁니다.
//  - sandbox="allow-scripts" iframe은 스크립트는 실행하되, 게시판 화면·로그인 정보와는 완전히 분리됩니다.
//    (allow-same-origin 을 일부러 넣지 않았습니다. 넣으면 분리가 풀립니다.)
// ──────────────────────────────────────────────────────────────────

// iframe 안의 페이지에 몰래 덧붙이는 짧은 스크립트입니다.
// iframe은 안의 내용 길이를 모르기 때문에 기본 높이(150px)로 잘립니다.
// 그래서 iframe 안에서 자기 내용 높이를 재서, postMessage(격리된 창끼리 메시지를 보내는 브라우저 기능)로 바깥 게시판에 알려 줍니다.
// ResizeObserver : 요소의 크기가 바뀔 때마다 함수를 불러 주는 브라우저 기능입니다. 애니메이션으로 높이가 바뀌어도 따라갑니다.
// 아래 문자열 끝의 script 닫는 태그는 / 앞에 \ 를 붙여 적었습니다.
// 이 .vue 파일 안에 script 닫는 태그를 그대로 적으면(주석 안이라도) 이 파일의 script 영역이 거기서 끝난 것으로 해석되어 오류가 나기 때문입니다.
const HTML_RUN_HEIGHT_REPORTER = `
<script>
(function () {
  function send() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height) || document.documentElement.scrollHeight;
    parent.postMessage({ type: 'html-run-height', height: h }, '*');
  }
  new ResizeObserver(send).observe(document.documentElement);
  window.addEventListener('load', send);
})();
<\/script>`

// marked가 만든 HTML 문자열에서 html-run 코드블록을 찾아 iframe으로 바꾼 HTML 문자열을 돌려줍니다.
function renderHtmlRunBlocks(html) {
  // 빠른 확인: html-run 블록이 없는 일반 글은 그대로 돌려줍니다. (기존 글 표시 방식에 전혀 영향 없음)
  // includes() : 문자열 안에 해당 글자가 들어 있는지 true/false로 알려줍니다.
  if (!html.includes('language-html-run')) return html

  // <template> 요소는 화면에 그려지지 않는 HTML 작업용 공간입니다.
  // 여기에 HTML 문자열을 넣으면 요소 단위로 찾고 바꿀 수 있고, 그 안의 이미지 등도 실제로 불러오지 않습니다.
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  tpl.content.querySelectorAll('pre > code.language-html-run').forEach(code => {
    const iframe = document.createElement('iframe')
    iframe.className = 'html-run-frame'
    // sandbox="allow-scripts" : 스크립트 실행만 허용하고, 게시판과는 분리된 창으로 만듭니다.
    iframe.setAttribute('sandbox', 'allow-scripts')
    // srcdoc : 파일 주소 대신 이 HTML 글자를 바로 띄우는 iframe 속성입니다.
    // code.textContent : marked가 &lt; 로 바꿔 둔 글자를 원래 HTML(<)로 되돌려 꺼냅니다.
    iframe.setAttribute('srcdoc', code.textContent + HTML_RUN_HEIGHT_REPORTER)
    // 높이 메시지가 오기 전까지 쓸 기본 모양입니다. 너비는 글 영역에 꽉 채웁니다.
    iframe.setAttribute('style', 'display:block;width:100%;height:400px;border:1px solid #e0e0e0;border-radius:8px;margin:.8em 0')
    // code.parentElement : <code>를 감싼 <pre> 요소입니다. <pre> 전체를 iframe으로 바꿉니다.
    code.parentElement.replaceWith(iframe)
  })
  return tpl.innerHTML
}

// iframe 안에서 보낸 높이 메시지를 받아, 그 iframe의 높이를 맞춥니다.
function handleHtmlRunMessage(event) {
  // event.data?.type : 메시지 내용 중 type 값입니다. 우리가 보낸 높이 메시지가 아니면 무시합니다.
  if (event.data?.type !== 'html-run-height') return
  const height = Number(event.data.height)
  // Number.isFinite() : 정상적인 숫자인지 확인합니다. 이상한 값이면 무시합니다.
  if (!Number.isFinite(height) || height <= 0) return
  // 화면의 모든 HTML 블록 iframe 중에서, 메시지를 보낸 창(event.source)과 같은 iframe을 찾아 높이를 바꿉니다.
  // contentWindow : iframe 안쪽 페이지의 창 객체입니다.
  document.querySelectorAll('iframe.html-run-frame').forEach(frame => {
    // Math.min(..., 20000) : 잘못된 값으로 화면이 끝없이 길어지지 않도록 최대 20000px로 제한합니다.
    if (frame.contentWindow === event.source) frame.style.height = `${Math.min(Math.ceil(height), 20000)}px`
  })
}

// 화면이 열릴 때 메시지 받기를 시작하고, 화면이 닫힐 때 멈춥니다.
// (안드로이드에서 onCreate에서 리스너를 등록하고 onDestroy에서 해제하는 것과 같습니다.)
onMounted(() => window.addEventListener('message', handleHtmlRunMessage))
onUnmounted(() => window.removeEventListener('message', handleHtmlRunMessage))

const visibleFiles = computed(() => {
  if (!post.value) return []
  return (post.value.files || []).filter(f => !isInlineInContent(f, post.value.content))
})
const imageFiles = computed(() => visibleFiles.value.filter(f => isImage(f.original_name)))
const docFiles = computed(() => visibleFiles.value.filter(f => !isImage(f.original_name)))

const cmtImageItems = computed(() =>
  cmtFiles.value.map((f, i) => ({ file: f, name: f.name, size: f.size, index: i })).filter(item => isImage(item.name))
)
const cmtDocItems = computed(() =>
  cmtFiles.value.map((f, i) => ({ file: f, name: f.name, size: f.size, index: i })).filter(item => !isImage(item.name))
)
</script>
