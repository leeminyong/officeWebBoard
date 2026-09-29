// JavaScript 주석 문법: // 뒤의 글은 코드 실행에 영향을 주지 않는 설명입니다.
// computed() : 다른 ref 값이 바뀌면 자동으로 다시 계산되는 읽기 전용 값입니다. (안드로이드의 Transformations.map()과 비슷)
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchPost, deletePost as apiDeletePost, createComment, updateComment, deleteComment as apiDeleteComment, deletePostFile, deleteCommentFile, togglePin as apiTogglePin, movePost as apiMovePost } from '../api.js'
import { useToast } from './useToast.js'
import { boardMeta } from '../board.js'
import { downloadFromUrl } from '../utils.js'
// useBoards : 게시판 목록(boards)을 관리하는 ViewModel입니다.
// '이동' 드롭다운에 보여줄 게시판 목록을 여기서 가져옵니다.
import { useBoards } from './useBoards.js'

export function usePostDetail() {
  const route = useRoute()
  const router = useRouter()
  const { showToast } = useToast()
  // boards : 전체 게시판 배열입니다. 예) [{ key: 'project', label: '프로젝트', parent_key: null }, ...]
  // boardMap : { key: label } 형태의 객체입니다. 부모 게시판 이름을 찾을 때 씁니다.
  const { boards, boardMap } = useBoards()

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

  // handleComplete : '완료' 버튼을 눌렀을 때 실행되는 함수입니다. (ViewModel 레이어)
  // 현재 글을 '유지보수(완료)' 게시판(maintenance-done)으로 이동하고,
  // 이동 완료 후 '유지보수(완료)' 게시판 목록 화면으로 이동합니다.
  async function handleComplete() {
    if (!confirm('이 게시글을 완료 처리하시겠습니까?\n유지보수(완료) 게시판으로 이동됩니다.')) return
    const res = await apiMovePost(route.params.id, 'maintenance-done')
    if (res.ok) {
      showToast('완료 처리되었습니다.')
      // 800ms 후 유지보수(완료) 게시판 목록으로 이동합니다.
      // setTimeout : 일정 시간(밀리초) 후에 코드를 실행합니다. 토스트 메시지를 잠깐 보여주기 위해 사용합니다.
      setTimeout(() => {
        router.push({ path: '/', query: { board: 'maintenance-done' } })
      }, 800)
    } else {
      showToast('완료 처리 실패', true)
    }
  }

  // moveTargets : '이동' 드롭다운에 보여줄 게시판 목록입니다. (ViewModel 레이어)
  // 현재 글이 있는 게시판은 이동할 필요가 없으므로 목록에서 뺍니다.
  // 하위 게시판은 "부모 이름 > 자식 이름" 형태로 보여줘서 어느 메뉴 아래인지 알 수 있게 합니다.
  // computed() 이므로 boards 나 currentBoard 가 바뀌면 자동으로 다시 계산됩니다.
  const moveTargets = computed(() =>
    boards.value
      // filter() : 조건에 맞는 항목만 남깁니다. b.key !== currentBoard.value → 현재 게시판 제외
      .filter(b => b.key !== currentBoard.value)
      // map() : 각 항목을 { key, label } 형태로 바꿉니다.
      // 삼항연산자(조건 ? A : B) : parent_key 가 있으면 "부모 > 자식", 없으면 이름 그대로
      .map(b => ({
        key: b.key,
        label: b.parent_key ? `${boardMap.value[b.parent_key]} > ${b.label}` : b.label,
      }))
  )

  // handleMove : '이동' 드롭다운에서 게시판을 골랐을 때 실행되는 함수입니다. (ViewModel 레이어)
  // targetBoard : 이동할 게시판 key (예: 'maintenance', 'board_1234567890')
  // 흐름: 확인창 → 서버에 이동 요청 → 성공 토스트 → 0.8초 뒤 옮긴 게시판의 목록 화면으로 이동
  // handleComplete 와 같은 구조지만, 목적지가 고정되지 않고 인자로 들어온다는 점이 다릅니다.
  async function handleMove(targetBoard) {
    // 드롭다운의 첫 줄("이동 ▾")을 다시 고른 경우 key 가 빈 문자열이므로 아무것도 하지 않습니다.
    if (!targetBoard) return
    // find() : 배열에서 조건에 맞는 첫 항목을 찾습니다. 확인창에 게시판 이름을 보여주기 위해 씁니다.
    // ?. (옵셔널 체이닝) : 앞의 값이 없으면(undefined) 오류 대신 undefined 를 돌려줍니다.
    const targetLabel = moveTargets.value.find(b => b.key === targetBoard)?.label || targetBoard
    // confirm() : 확인/취소 버튼이 있는 대화상자를 띄웁니다. 취소를 누르면 false 를 돌려줍니다.
    if (!confirm(`이 게시글을 '${targetLabel}' 게시판으로 이동하시겠습니까?`)) return
    const res = await apiMovePost(route.params.id, targetBoard)
    if (res.ok) {
      showToast(`'${targetLabel}' 게시판으로 이동되었습니다.`)
      // setTimeout : 일정 시간(밀리초) 후에 코드를 실행합니다. 토스트 메시지를 잠깐 보여주기 위해 사용합니다.
      // router.push() : 다른 화면으로 이동합니다. (안드로이드의 startActivity()와 비슷)
      // 'project' 는 기본 게시판이라 URL 에 ?board= 를 붙이지 않습니다. (goToList 와 같은 규칙)
      setTimeout(() => {
        const q = targetBoard !== 'project' ? { board: targetBoard } : {}
        router.push({ path: '/', query: q })
      }, 800)
    } else {
      showToast('이동 실패', true)
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
    // moveTargets, handleMove : '이동' 드롭다운에서 쓰는 목록과 함수입니다.
    moveTargets, handleMove,
    loadPost, handleDeletePost, handleTogglePin, handleComplete, submitComment, startEditComment, cancelEditComment, submitEditComment, handleDeleteComment,
    handleDeletePostFile, handleDeleteCommentFile,
    downloadFile, downloadCommentFile, addCmtFiles, removeCmtFile, goToEdit, goToList,
  }
}
