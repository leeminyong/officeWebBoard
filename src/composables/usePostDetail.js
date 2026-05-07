import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchPost, deletePost as apiDeletePost, createComment, updateComment, deleteComment as apiDeleteComment, deletePostFile, deleteCommentFile } from '../api.js'
import { useToast } from './useToast.js'
import { boardMeta } from '../board.js'
import { downloadFromUrl } from '../utils.js'

export function usePostDetail() {
  const route = useRoute()
  const router = useRouter()
  const { showToast } = useToast()

  const post = ref(null)
  const currentBoard = ref(boardMeta[route.query.board] ? route.query.board : 'project')
  const cmtFiles = ref([])
  const cmtContent = ref('')
  const editingCommentId = ref(null)
  const editingCommentContent = ref('')

  async function loadPost() {
    try {
      const data = await fetchPost(route.params.id)
      if (!data) { showToast('게시글을 찾을 수 없습니다.', true); return }
      if (boardMeta[data.board]) currentBoard.value = data.board
      post.value = data
    } catch {
      showToast('불러오기 실패', true)
    }
  }

  async function handleDeletePost() {
    if (!confirm('게시글을 삭제하시겠습니까?')) return
    const res = await apiDeletePost(route.params.id)
    if (res.ok) {
      showToast('삭제되었습니다.')
      setTimeout(() => {
        const q = currentBoard.value !== 'project' ? { board: currentBoard.value } : {}
        router.push({ path: '/', query: q })
      }, 800)
    } else {
      showToast('삭제 실패', true)
    }
  }

  async function submitComment() {
    if (!cmtContent.value.trim()) { showToast('댓글 내용을 입력하세요.', true); return }
    const formData = new FormData()
    formData.append('content', cmtContent.value)
    cmtFiles.value.forEach(f => formData.append('files', f))
    const res = await createComment(route.params.id, formData)
    if (res.ok) {
      cmtContent.value = ''
      cmtFiles.value = []
      await loadPost()
      showToast('댓글이 등록되었습니다.')
    } else {
      showToast('등록 실패', true)
    }
  }

  function startEditComment(comment) {
    // JavaScript 주석 문법: // 뒤의 글은 화면에 보이지 않는 코드 설명입니다. 수정 버튼을 누른 댓글의 id와 내용을 기억해서, 그 댓글만 입력창으로 바뀌게 합니다.
    editingCommentId.value = comment.id
    editingCommentContent.value = comment.content
  }

  function cancelEditComment() {
    // JavaScript 주석 문법: 수정 취소 때는 기억해 둔 댓글 id와 내용을 비워서 화면을 원래 댓글 보기 상태로 돌립니다.
    editingCommentId.value = null
    editingCommentContent.value = ''
  }

  async function submitEditComment(commentId) {
    if (!editingCommentContent.value.trim()) { showToast('수정할 댓글 내용을 입력하세요.', true); return }
    const res = await updateComment(route.params.id, commentId, editingCommentContent.value)
    if (res.ok) {
      await loadPost()
      cancelEditComment()
      showToast('댓글이 수정되었습니다.')
    } else {
      showToast('댓글 수정 실패', true)
    }
  }

  async function handleDeleteComment(commentId) {
    if (!confirm('댓글을 삭제하시겠습니까?')) return
    const res = await apiDeleteComment(route.params.id, commentId)
    if (res.ok) {
      await loadPost()
      showToast('댓글이 삭제되었습니다.')
    } else {
      showToast('삭제 실패', true)
    }
  }

  async function handleDeletePostFile(fileId) {
    if (!confirm('이 파일을 삭제하시겠습니까?')) return
    const res = await deletePostFile(fileId)
    if (res.ok) {
      post.value.files = post.value.files.filter(f => f.id !== Number(fileId))
      showToast('파일이 삭제되었습니다.')
    } else {
      showToast('삭제 실패', true)
    }
  }

  async function handleDeleteCommentFile(fileId) {
    if (!confirm('이 파일을 삭제하시겠습니까?')) return
    const res = await deleteCommentFile(fileId)
    if (res.ok) {
      post.value.comments.forEach(c => { c.files = c.files.filter(f => f.id !== Number(fileId)) })
      showToast('파일이 삭제되었습니다.')
    } else {
      showToast('삭제 실패', true)
    }
  }

  function downloadFile(fileId, fileName) { downloadFromUrl(`/api/files/${fileId}/download`, fileName) }
  function downloadCommentFile(fileId, fileName) { downloadFromUrl(`/api/comment-files/${fileId}/download`, fileName) }

  function addCmtFiles(files) {
    files.forEach(f => {
      if (!cmtFiles.value.find(c => c.name === f.name && c.size === f.size)) cmtFiles.value.push(f)
    })
  }

  function removeCmtFile(index) { cmtFiles.value.splice(index, 1) }

  function goToEdit() {
    router.push({ path: `/posts/${route.params.id}/edit`, query: { board: currentBoard.value } })
  }

  function goToList() {
    const q = currentBoard.value !== 'project' ? { board: currentBoard.value } : {}
    router.push({ path: '/', query: q })
  }

  return {
    post, currentBoard, cmtFiles, cmtContent, editingCommentId, editingCommentContent,
    loadPost, handleDeletePost, submitComment, startEditComment, cancelEditComment, submitEditComment, handleDeleteComment,
    handleDeletePostFile, handleDeleteCommentFile,
    downloadFile, downloadCommentFile, addCmtFiles, removeCmtFile, goToEdit, goToList,
  }
}
