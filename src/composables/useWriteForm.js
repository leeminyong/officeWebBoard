import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchPost, createPost, updatePost } from '../api.js'
import { useToast } from './useToast.js'
import { boardMeta } from '../board.js'

export function useWriteForm() {
  const route = useRoute()
  const router = useRouter()
  const { showToast } = useToast()

  const editId = route.params.id || null
  const isEdit = Boolean(editId)
  const currentBoard = ref(boardMeta[route.query.board] ? route.query.board : 'project')

  const title = ref('')
  const selectedFiles = ref([])
  const deleteFileIds = ref([])
  const submitting = ref(false)
  const inlineImageNames = new Set()

  async function loadPostForEdit() {
    if (!isEdit) return null
    const post = await fetchPost(editId)
    if (!post) { showToast('수정할 글을 찾을 수 없습니다.', true); return null }
    if (boardMeta[post.board]) currentBoard.value = post.board
    title.value = post.title
    return post
  }

  async function submitPost(content) {
    if (!title.value.trim()) { showToast('제목을 입력해주세요.', true); return false }
    if (!content.trim()) { showToast('내용을 입력해주세요.', true); return false }

    submitting.value = true
    const formData = new FormData()
    formData.append('title', title.value)
    formData.append('content', content)
    formData.append('board', currentBoard.value)
    selectedFiles.value.forEach(f => formData.append('files', f))
    if (isEdit && deleteFileIds.value.length > 0) {
      formData.append('deleteFileIds', JSON.stringify(deleteFileIds.value))
    }

    try {
      const result = isEdit ? await updatePost(editId, formData) : await createPost(formData)
      if (result.ok) {
        showToast(isEdit ? '수정되었습니다.' : '등록되었습니다.')
        const postId = isEdit ? editId : result.data.id
        setTimeout(() => router.push({ path: `/posts/${postId}`, query: { board: currentBoard.value } }), 600)
        return true
      }
      showToast(result.data.error || '오류가 발생했습니다.', true)
    } catch {
      showToast('서버 오류가 발생했습니다.', true)
    }

    submitting.value = false
    return false
  }

  function addFiles(files) {
    files.forEach(f => {
      if (!selectedFiles.value.find(s => s.name === f.name && s.size === f.size)) selectedFiles.value.push(f)
    })
  }

  function addInlineFiles(files) {
    files.forEach(f => inlineImageNames.add(f.name))
    addFiles(files)
  }

  function removeFile(index) {
    inlineImageNames.delete(selectedFiles.value[index]?.name)
    selectedFiles.value.splice(index, 1)
  }

  function markDeleteFile(fileId) {
    if (!confirm('이 파일을 삭제하시겠습니까?')) return false
    if (!deleteFileIds.value.includes(Number(fileId))) deleteFileIds.value.push(Number(fileId))
    return true
  }

  function isInlineImage(name) { return inlineImageNames.has(name) }
  function cancel() { router.back() }

  return {
    isEdit, currentBoard, title, selectedFiles, deleteFileIds, submitting,
    loadPostForEdit, submitPost, addFiles, addInlineFiles, removeFile, markDeleteFile, isInlineImage, cancel,
  }
}
