<template>
  <div class="container">
    <div class="card">
      <h2 style="margin-bottom:20px">{{ isEdit ? '✏️ 글 수정' : '✏️ 글쓰기' }}</h2>

      <div class="form-group">
        <label>제목</label>
        <input v-model="title" class="form-control" placeholder="제목을 입력하세요" />
      </div>

      <div class="form-group">
        <label>내용</label>
        <ContentEditor ref="editorRef" @inlineFilesAdded="addInlineFiles" />
      </div>

      <div class="form-group">
        <label>첨부파일</label>
        <FileDropZone @filesAdded="addFiles" />

        <div v-if="editPost?.files?.length" style="margin-top:10px">
          <ul class="file-list" style="list-style:none">
            <li
              v-for="file in editPost.files" :key="file.id"
              class="file-item"
              :style="deleteFileIds.includes(file.id) ? 'opacity:.4;text-decoration:line-through' : ''"
            >
              <span class="file-icon">{{ isImage(file.original_name) ? '🖼️' : '📄' }}</span>
              <span class="file-name">{{ file.original_name }}</span>
              <span class="file-size">{{ formatSize(file.file_size) }}</span>
              <button v-if="!deleteFileIds.includes(file.id)" class="delete-file-btn" @click="markDeleteFile(file.id)">✕</button>
            </li>
          </ul>
        </div>

        <div class="img-preview-grid" v-if="newImageItems.length" style="margin-top:10px">
          <div v-for="item in newImageItems" :key="item.index" class="img-preview-item">
            <img :src="makeUrl(item.file)" @load="e => URL.revokeObjectURL(e.target.src)" />
            <button class="remove-img" @click="removeFile(item.index)">✕</button>
          </div>
        </div>
        <div class="selected-files" v-if="newDocItems.length">
          <div v-for="item in newDocItems" :key="item.index" class="selected-file-item">
            <span>📄</span><span>{{ item.name }}</span>
            <span class="file-size" style="color:#aaa;font-size:.8rem;margin-left:4px">{{ formatSize(item.size) }}</span>
            <button class="remove-btn" @click="removeFile(item.index)">✕</button>
          </div>
        </div>
      </div>

      <div class="action-bar">
        <button class="btn btn-secondary" @click="cancel">취소</button>
        <button class="btn btn-primary" :disabled="submitting" @click="handleSubmit">
          {{ submitting ? '처리 중...' : isEdit ? '수정 완료' : '등록' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ContentEditor from '../components/ContentEditor.vue'
import FileDropZone from '../components/FileDropZone.vue'
import { useWriteForm } from '../composables/useWriteForm.js'
import { isImage, formatSize } from '../utils.js'

const editorRef = ref(null)
const editPost = ref(null)

const {
  isEdit, title, selectedFiles, deleteFileIds, submitting,
  loadPostForEdit, submitPost, addFiles, addInlineFiles, removeFile, markDeleteFile, isInlineImage, cancel,
} = useWriteForm()

onMounted(async () => {
  const post = await loadPostForEdit()
  if (post) {
    editPost.value = post
    editorRef.value?.setContent(post.content, post.files || [])
  }
})

async function handleSubmit() {
  const content = editorRef.value?.getMarkdown() || ''
  await submitPost(content)
}

function makeUrl(file) { return URL.createObjectURL(file) }

const newImageItems = computed(() =>
  selectedFiles.value
    .map((f, i) => ({ file: f, name: f.name, size: f.size, index: i }))
    .filter(item => isImage(item.name) && !isInlineImage(item.name))
)
const newDocItems = computed(() =>
  selectedFiles.value
    .map((f, i) => ({ file: f, name: f.name, size: f.size, index: i }))
    .filter(item => !isImage(item.name))
)
</script>
