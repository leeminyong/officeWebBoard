import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchPost, deletePost as apiDeletePost, createComment, updateComment, deleteComment as apiDeleteComment, deletePostFile, deleteCommentFile, togglePin as apiTogglePin } from '../api.js'
import { useToast } from './useToast.js'
import { boardMeta } from '../board.js'
import { downloadFromUrl } from '../utils.js'

export function usePostDetail() {
  const route = useRoute()
  const router = useRouter()
  const { showToast } = useToast()

  const post = ref(null)
  // route.query.board : 현재 URL의 ?board= 값입니다. (예: board_1234567890)
  // 사용자가 추가한 게시판은 boardMeta에 없으므로, boardMeta 체크 없이 URL 값을 그대로 사용합니다.
  // || 'project' : board 값이 없으면(undefined) 기본 게시판인 'project'를 사용합니다.
  const currentBoard = ref(route.query.board || 'project')
  const cmtFiles = ref([])
  const cmtContent = ref('')
  const editingCommentId = ref(null)
  const editingCommentContent = ref('')

  async function loadPost() {
    try {
      const data = await fetchPost(route.params.id)
      if (!data) { showToast('게시글을 찾을 수 없습니다.', true); return }
      // data.board : 서버에서 받아온 게시글의 게시판 key입니다.
      // boardMeta 체크를 없앴습니다. 사용자 추가 게시판(board_xxx)은 boardMeta에 없어서
      // 체크하면 항상 false가 되어 currentBoard가 업데이트되지 않는 버그가 있었습니다.
      // 서버에서 온 board 값은 실제 존재하는 게시판이므로 그냥 저장해도 안전합니다.
      if (data.board) currentBoard.value = data.board
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

  // handleTogglePin : 고정 버튼을 눌렀을 때 실행되는 함수입니다. (ViewModel 레이어)
  // 서버에 고정 전환 요청을 보내고, 성공하면 화면의 post 데이터를 즉시 업데이트합니다.
  // 이렇게 하면 페이지를 다시 불러오지 않아도 버튼 텍스트가 바로 바뀝니다.
  async function handleTogglePin() {
    const res = await apiTogglePin(route.params.id)
    if (res.ok) {
      // post.value.is_pinned : 현재 화면에 저장된 고정 상태를 서버 응답 값으로 덮어씁니다.
      // 안드로이드로 비유하면 LiveData.setValue()로 UI를 업데이트하는 것과 같습니다.
      post.value.is_pinned = res.data.is_pinned
      showToast(res.data.is_pinned ? '게시글이 고정되었습니다.' : '고정이 해제되었습니다.')
    } else {
      showToast('고정 설정 실패', true)
    }
  }

  function goToEdit() {
    router.push({ path: `/posts/${route.params.id}/edit`, query: { board: currentBoard.value } })
  }

  function goToList() {
    const q = currentBoard.value !== 'project' ? { board: currentBoard.value } : {}
    router.push({ path: '/', query: q })
  }

  return {
    post, currentBoard, cmtFiles, cmtContent, editingCommentId, editingCommentContent,
    loadPost, handleDeletePost, handleTogglePin, submitComment, startEditComment, cancelEditComment, submitEditComment, handleDeleteComment,
    handleDeletePostFile, handleDeleteCommentFile,
    downloadFile, downloadCommentFile, addCmtFiles, removeCmtFile, goToEdit, goToList,
  }
}
