// Vue에서 반응형 데이터를 만들 때 사용하는 함수들을 불러옵니다.
// ref() : 값이 바뀌면 화면도 자동으로 업데이트되는 변수를 만듭니다. (Android의 LiveData와 비슷)
// computed() : 다른 값에 의존해서 자동으로 계산되는 읽기전용 값을 만듭니다.
import { ref, computed } from 'vue'

// 페이지 이동(router)과 현재 URL 정보(route)를 가져오는 함수들입니다.
// Android의 Intent나 NavController와 비슷한 역할입니다.
import { useRouter, useRoute } from 'vue-router'

// 서버에서 게시글 목록을 가져오는 함수입니다. (api.js에 정의되어 있음)
import { fetchPostList } from '../api.js'

// 화면 하단에 잠깐 뜨는 알림(토스트 메시지)을 띄우는 함수입니다.
import { useToast } from './useToast.js'

// useBoards : 게시판 목록(동적으로 추가된 게시판 포함)을 제공하는 ViewModel composable입니다.
import { useBoards } from './useBoards.js'

// usePostList : 게시글 목록 화면에서 필요한 상태와 함수들을 묶어서 제공하는 composable 함수입니다.
// Android의 ViewModel 클래스와 동일한 역할입니다.
export function usePostList() {
  // 현재 URL의 쿼리 파라미터 등 라우트 정보를 가져옵니다. (예: ?board=maintenance)
  const route = useRoute()
  // 페이지를 이동할 때 사용하는 router 객체입니다.
  const router = useRouter()
  // 토스트 메시지를 띄우는 함수를 가져옵니다.
  const { showToast } = useToast()
  // boardMap : { key: label } 형태의 게시판 목록입니다. 사용자가 추가한 게시판도 포함됩니다.
  const { boardMap } = useBoards()

  // postList : 화면에 표시할 게시글 목록입니다. 처음엔 빈 배열([])로 시작합니다.
  // ref([]) 로 감싸면 postList.value 가 바뀔 때 화면이 자동으로 다시 그려집니다.
  const postList = ref([])

  // pageInfo : 현재 페이지, 전체 글 수, 총 페이지 수를 담는 객체입니다.
  const pageInfo = ref({ total: 0, page: 1, totalPages: 1 })

  // searchKeyword : 사용자가 입력 중인 검색어를 저장하는 반응형 변수입니다.
  // Android의 EditText에 바인딩된 LiveData<String>과 비슷합니다.
  const searchKeyword = ref('')

  // currentBoard : URL의 ?board= 값을 읽어서 현재 게시판 종류를 반환합니다.
  // boardMap 체크를 없앴습니다. boardMap은 서버 응답이 올 때까지 사용자 추가 게시판을 모르기 때문에
  // 체크하면 사용자 추가 게시판일 때 항상 'project'로 잘못 반환되는 문제가 있었습니다.
  // || 'project' : board 값이 없으면(URL에 ?board= 가 없으면) 기본값 'project'를 사용합니다.
  const currentBoard = computed(() => route.query.board || 'project')

  // loadPosts : 서버에서 게시글 목록을 불러와서 postList에 저장하는 함수입니다.
  // async/await : 서버 통신처럼 시간이 걸리는 작업을 기다릴 때 사용하는 문법입니다.
  // pageNumber = 1 : 인자를 넘기지 않으면 기본값 1페이지를 불러옵니다.
  async function loadPosts(pageNumber = 1) {
    // try/catch : 오류가 발생했을 때 앱이 멈추지 않고 catch 블록을 실행합니다.
    try {
      // 서버에서 게시글 목록과 페이지 정보를 받아옵니다.
      // searchKeyword.value : 현재 검색어를 함께 전달합니다. 비어 있으면 전체 목록을 가져옵니다.
      // 받아온 데이터 구조 예시: { posts: [...], pagination: { total, page, totalPages } }
      const serverResponse = await fetchPostList(pageNumber, currentBoard.value, searchKeyword.value)

      // 서버에서 이미 올바른 순서로 정렬된 결과를 그대로 사용합니다.
      // 정렬 기준은 server.js의 SQL에서 처리합니다:
      //   1) 제목에 '완료'가 없는 글 먼저 (최신순)
      //   2) 제목에 '완료'가 있는 글은 맨 뒤 (최신순)
      // 여기서 다시 정렬하면 현재 페이지 안에서만 정렬되어 '완료' 글이
      // 마지막 페이지가 아닌 현재 페이지의 맨 아래로만 내려가는 문제가 생깁니다.
      postList.value = serverResponse.posts

      // 서버에서 받은 페이지 정보를 저장합니다.
      pageInfo.value = serverResponse.pagination
    } catch {
      // 오류가 발생하면 사용자에게 토스트 메시지로 알립니다.
      // 두 번째 인자 true 는 '오류 스타일'로 표시하라는 의미입니다.
      showToast('게시글을 불러오지 못했습니다.', true)
    }
  }

  // doSearch : 검색 버튼을 눌렀을 때 1페이지부터 다시 검색 결과를 불러오는 함수입니다.
  // 검색어가 바뀌면 항상 1페이지부터 시작해야 하므로 loadPosts(1)을 호출합니다.
  function doSearch() {
    loadPosts(1)
  }

  // clearSearch : 검색어를 지우고 전체 목록으로 돌아오는 함수입니다.
  function clearSearch() {
    searchKeyword.value = ''
    loadPosts(1)
  }

  // goToWrite : 글쓰기 페이지로 이동하는 함수입니다.
  function goToWrite() {
    // 글쓰기 페이지로 이동할 때 URL에 붙일 게시판 정보입니다.
    // 예) 유지보수 게시판이면 → /write?board=maintenance
    //     프로젝트 게시판이면 → /write (쿼리 없음, 기본값이 project라서)
    // 삼항연산자: 조건 ? 참일때값 : 거짓일때값
    const boardQuery = currentBoard.value !== 'project' ? { board: currentBoard.value } : {}
    // router.push() : 지정한 경로로 페이지를 이동합니다. Android의 startActivity()와 비슷합니다.
    router.push({ path: '/write', query: boardQuery })
  }

  // goToPost : 특정 게시글 상세 페이지로 이동하는 함수입니다.
  function goToPost(postId) {
    // 백틱(``)을 사용한 템플릿 리터럴 문법입니다. ${변수} 로 값을 문자열 안에 삽입할 수 있습니다.
    // 예) postId가 5이면 → /posts/5?board=project
    router.push({ path: `/posts/${postId}`, query: { board: currentBoard.value } })
  }

  // 이 composable을 사용하는 컴포넌트(View)에서 접근할 수 있도록 필요한 것들을 반환합니다.
  // Android ViewModel에서 LiveData나 함수를 외부에 공개하는 것과 같습니다.
  // 주의: 여기서 반환하는 이름(postList, pageInfo 등)이 View에서 사용하는 이름이 됩니다.
  // searchKeyword, doSearch, clearSearch 도 View에서 사용할 수 있도록 함께 반환합니다.
  return { postList, pageInfo, currentBoard, loadPosts, goToWrite, goToPost, searchKeyword, doSearch, clearSearch }
}
