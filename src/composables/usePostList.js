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

// 게시판 종류별 메타 정보(이름, 설명 등)가 담긴 객체입니다.
import { boardMeta } from '../board.js'

// usePostList : 게시글 목록 화면에서 필요한 상태와 함수들을 묶어서 제공하는 composable 함수입니다.
// Android의 ViewModel 클래스와 동일한 역할입니다.
export function usePostList() {
  // 현재 URL의 쿼리 파라미터 등 라우트 정보를 가져옵니다. (예: ?board=maintenance)
  const route = useRoute()
  // 페이지를 이동할 때 사용하는 router 객체입니다.
  const router = useRouter()
  // 토스트 메시지를 띄우는 함수를 가져옵니다.
  const { showToast } = useToast()

  // posts : 화면에 표시할 게시글 목록입니다. 처음엔 빈 배열([])로 시작합니다.
  // ref([]) 로 감싸면 posts.value 가 바뀔 때 화면이 자동으로 다시 그려집니다.
  const posts = ref([])

  // pagination : 현재 페이지, 전체 글 수, 총 페이지 수를 담는 객체입니다.
  const pagination = ref({ total: 0, page: 1, totalPages: 1 })

  // currentBoard : URL의 ?board= 값을 읽어서 현재 게시판 종류를 반환합니다.
  // boardMeta에 없는 값이 오면 기본값 'project'를 사용합니다.
  // computed(() => ...) 는 route.query.board 가 바뀔 때마다 자동으로 재계산됩니다.
  const currentBoard = computed(() => boardMeta[route.query.board] ? route.query.board : 'project')

  // loadPosts : 서버에서 게시글 목록을 불러와서 posts에 저장하는 함수입니다.
  // async/await : 서버 통신처럼 시간이 걸리는 작업을 기다릴 때 사용하는 문법입니다.
  // page = 1 : 인자를 넘기지 않으면 기본값 1페이지를 불러옵니다.
  async function loadPosts(page = 1) {
    // try/catch : 오류가 발생했을 때 앱이 멈추지 않고 catch 블록을 실행합니다.
    try {
      // 서버에서 게시글 목록 데이터를 받아옵니다.
      const data = await fetchPostList(page, currentBoard.value)

      // [...data.posts] : 원본 배열을 복사합니다. 원본을 직접 수정하지 않기 위해서입니다.
      // .sort((a, b) => ...) : 배열을 정렬합니다. 반환값이 음수면 a가 앞, 양수면 b가 앞에 옵니다.
      posts.value = [...data.posts].sort((a, b) => {
        // 제목에 '완료'가 포함된 글은 맨 아래로 보냅니다.
        // includes('완료') : 문자열 안에 '완료'가 있으면 true를 반환하는 함수입니다.
        // ? 1 : 0 은 삼항연산자입니다. 조건이 true면 1, false면 0을 저장합니다.
        const aDone = a.title.includes('완료') ? 1 : 0
        const bDone = b.title.includes('완료') ? 1 : 0

        // 완료 여부가 다르면 완료 글(1)이 뒤로 가도록 정렬합니다.
        // aDone - bDone 이 양수이면 a가 뒤로 이동합니다.
        if (aDone !== bDone) return aDone - bDone

        // 완료 여부가 같은 글끼리는 작성일 기준 최신순으로 정렬합니다.
        // localeCompare : 두 문자열을 사전 순으로 비교합니다. b가 크면 양수를 반환해서 b가 앞에 옵니다.
        const d = String(b.created_at).localeCompare(String(a.created_at))

        // 날짜도 같으면 id가 큰 것(나중에 작성된 글)이 앞에 오도록 합니다.
        // || : 앞의 값이 0(falsy)이면 뒤의 값을 사용하는 OR 연산자입니다.
        return d || b.id - a.id
      })

      // 서버에서 받은 페이지 정보를 저장합니다.
      pagination.value = data.pagination
    } catch {
      // 오류가 발생하면 사용자에게 토스트 메시지로 알립니다.
      // 두 번째 인자 true 는 '오류 스타일'로 표시하라는 의미입니다.
      showToast('게시글을 불러오지 못했습니다.', true)
    }
  }

  // goToWrite : 글쓰기 페이지로 이동하는 함수입니다.
  function goToWrite() {
    // 현재 게시판이 'project'가 아닐 때만 board 쿼리를 URL에 포함시킵니다.
    // 삼항연산자: 조건 ? 참일때값 : 거짓일때값
    const q = currentBoard.value !== 'project' ? { board: currentBoard.value } : {}
    // router.push() : 지정한 경로로 페이지를 이동합니다. Android의 startActivity()와 비슷합니다.
    router.push({ path: '/write', query: q })
  }

  // goToPost : 특정 게시글 상세 페이지로 이동하는 함수입니다.
  function goToPost(id) {
    // 백틱(``)을 사용한 템플릿 리터럴 문법입니다. ${변수} 로 값을 문자열 안에 삽입할 수 있습니다.
    router.push({ path: `/posts/${id}`, query: { board: currentBoard.value } })
  }

  // 이 composable을 사용하는 컴포넌트(View)에서 접근할 수 있도록 필요한 것들을 반환합니다.
  // Android ViewModel에서 LiveData나 함수를 외부에 공개하는 것과 같습니다.
  return { posts, pagination, currentBoard, loadPosts, goToWrite, goToPost }
}
