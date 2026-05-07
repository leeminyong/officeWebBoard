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
        <button class="btn btn-secondary" @click="goToList">← 목록</button>
        <div class="right">
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
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import FileDropZone from '../components/FileDropZone.vue'
import { usePostDetail } from '../composables/usePostDetail.js'
import { isImage, formatSize } from '../utils.js'

const route = useRoute()
const {
  post, cmtFiles, cmtContent, editingCommentId, editingCommentContent,
  loadPost, handleDeletePost, submitComment, startEditComment, cancelEditComment, submitEditComment, handleDeleteComment,
  handleDeletePostFile, handleDeleteCommentFile,
  downloadFile, downloadCommentFile, addCmtFiles, removeCmtFile, goToEdit, goToList,
} = usePostDetail()

onMounted(() => loadPost())
watch(() => route.params.id, () => loadPost())

function renderMd(text) { return marked.parse(text || '') }
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
  return marked.parse(html)
})

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
