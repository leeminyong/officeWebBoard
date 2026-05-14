// JavaScript 주석 문법: // 뒤의 글은 설명입니다. 이 파일은 게시판 목록 상태를 관리하는 ViewModel입니다.
// 안드로이드의 ViewModel 클래스와 같은 역할을 합니다.

// ref() : 값이 바뀌면 화면도 자동으로 업데이트되는 변수입니다. (안드로이드 LiveData와 비슷)
// computed() : 다른 ref 값이 바뀔 때 자동으로 재계산되는 읽기전용 값입니다.
import { ref, computed } from 'vue'

// 게시판 목록을 서버에서 가져오거나 추가하는 API 함수들입니다.
import { fetchBoards as apiFetchBoards, addBoard as apiAddBoard } from '../api.js'

// 기본 게시판 4개를 정의한 정적 데이터입니다.
// 서버 응답이 오기 전에도 메뉴가 바로 표시되도록 미리 채워둡니다.
import { boardMeta } from '../board.js'

// ── 모듈 레벨 공유 상태 ────────────────────────────────────
// 이 변수들은 함수 밖에 선언했기 때문에 앱 전체에서 하나의 값을 공유합니다.
// 안드로이드의 싱글톤(Singleton) Repository와 비슷한 개념입니다.
// 어느 컴포넌트에서 useBoards()를 호출해도 같은 boards 배열을 봅니다.

// boards : 게시판 목록 배열입니다. 예) [{ key: 'project', label: '프로젝트' }, ...]
// Object.entries(boardMeta) : { project: '프로젝트', ... } 객체를 [['project', '프로젝트'], ...] 배열로 변환합니다.
// .map(([key, label]) => ...) : 각 항목을 { key, label } 객체 형태로 바꿉니다.
const boards = ref(
  Object.entries(boardMeta).map(([key, label]) => ({ key, label }))
)

// 앱이 시작될 때 서버에서 최신 게시판 목록을 바로 가져옵니다.
// 이렇게 하면 사용자가 추가한 게시판도 화면에 바로 반영됩니다.
// catch(() => {}) : 서버 오류가 생겨도 앱이 멈추지 않고 기본 게시판으로 유지됩니다.
apiFetchBoards().then(data => { boards.value = data }).catch(() => {})

// ── Composable 함수 (외부에서 호출하는 진입점) ──────────────
// export function : 다른 파일에서 이 함수를 가져다 쓸 수 있게 내보냅니다.
export function useBoards() {
  // boardMap : 게시판 배열을 { key: label } 형태의 객체로 변환합니다.
  // 예) { project: '프로젝트', maintenance: '유지보수', board_123: '공지사항' }
  // computed() 이기 때문에 boards가 바뀔 때마다 자동으로 다시 계산됩니다.
  // Object.fromEntries() : [['key', 'label'], ...] 배열을 { key: label } 객체로 바꿉니다.
  const boardMap = computed(() =>
    Object.fromEntries(boards.value.map(b => [b.key, b.label]))
  )

  // addBoard : 새 게시판을 서버에 저장하고 목록에 추가하는 함수입니다.
  // label : 사용자가 입력한 게시판 이름 (예: '공지사항')
  async function addBoard(label) {
    // try/catch : 서버 응답이 JSON이 아닌 경우(예: 서버 미시작)에도 오류가 밖으로 전달되게 합니다.
    try {
      // 서버에 새 게시판 추가를 요청합니다.
      const result = await apiAddBoard(label)

      if (result.ok) {
        // 스프레드 연산자(...) : 기존 배열을 복사하고 새 항목을 추가합니다.
        // boards.value = [...boards.value, result.data] : 기존 목록 끝에 새 게시판을 붙입니다.
        boards.value = [...boards.value, result.data]
        return { ok: true }
      }

      // 서버에서 오류 메시지를 받아 반환합니다. (예: '같은 이름의 게시판이 이미 있습니다.')
      return { ok: false, error: result.data?.error || '게시판 추가에 실패했습니다.' }
    } catch {
      // fetch 자체가 실패하거나 JSON 파싱에 실패하면 오류를 위로 전달합니다.
      throw new Error('서버 통신 오류')
    }
  }

  // 이 composable을 사용하는 컴포넌트에서 접근할 수 있도록 필요한 것들을 반환합니다.
  return { boards, boardMap, addBoard }
}
