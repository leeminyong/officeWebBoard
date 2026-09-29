// JavaScript 주석 문법: // 뒤의 글은 실행되지 않는 설명입니다.
// 이 파일은 "👥 멤버 권한" 화면(MemberAccessView.vue)의 ViewModel 입니다. (안드로이드의 ViewModel 클래스와 같은 역할)
// 관리자가 멤버에게 보여줄 게시판을 체크하고 저장하는 로직을 담당합니다.
//
// 동작 순서
//   1단계) 화면이 열리면 load() : 서버에서 지금 허용된 게시판 목록을 받아와 체크 상태로 표시
//   2단계) 관리자가 체크박스를 누르면 checked 배열이 바뀜 (화면의 v-model 이 자동으로 처리)
//   3단계) "저장" 버튼 → save() : 체크된 게시판 목록을 서버에 저장

import { ref, computed } from 'vue'
import { fetchMemberBoards, saveMemberBoards } from '../api.js'
import { useBoards } from './useBoards.js'
import { useToast } from './useToast.js'

export function useMemberAccess() {
  const { boards } = useBoards()
  const { showToast } = useToast()

  // checked : 체크된 게시판 key 배열입니다. 예) ['project', 'board_123']
  // 화면의 체크박스에 v-model="checked" 로 연결하면, 체크/해제할 때 이 배열에 key 가 자동으로 추가/삭제됩니다.
  const checked = ref([])
  // loading : 서버에서 불러오는 중인지, saving : 저장 중인지 여부입니다. (버튼 중복 클릭 방지용)
  const loading = ref(false)
  const saving = ref(false)

  // boardTree : 게시판 목록을 "부모 → 하위" 구조로 만듭니다. (왼쪽 메뉴 AppSidebar.vue 와 같은 방식)
  // 화면에서 하위 게시판을 부모 아래에 들여써서 보여주기 위해 씁니다.
  // filter() : 조건에 맞는 항목만 남깁니다. map() : 각 항목을 새 모양으로 바꿉니다.
  const boardTree = computed(() =>
    boards.value
      .filter(b => !b.parent_key)
      .map(b => ({ ...b, children: boards.value.filter(c => c.parent_key === b.key) }))
  )

  // load : 서버에서 지금 멤버에게 허용된 게시판 목록을 받아와 체크 상태로 만듭니다.
  async function load() {
    loading.value = true
    try {
      const result = await fetchMemberBoards()
      if (result.ok) checked.value = result.data.boards
      else showToast(result.data.error || '멤버 권한을 불러오지 못했습니다.', true)
    } catch {
      showToast('서버에 연결할 수 없습니다.', true)
    }
    loading.value = false
  }

  // save : 체크된 게시판 목록을 서버에 저장합니다.
  async function save() {
    saving.value = true
    try {
      const result = await saveMemberBoards(checked.value)
      if (result.ok) {
        // 서버가 메뉴 순서대로 정리한 목록을 돌려주므로 그 값으로 다시 맞춥니다.
        checked.value = result.data.boards
        showToast('멤버 권한을 저장했습니다.')
      } else {
        showToast(result.data.error || '저장에 실패했습니다.', true)
      }
    } catch {
      showToast('서버에 연결할 수 없습니다.', true)
    }
    saving.value = false
  }

  // setAll : "전체 선택"(true) / "전체 해제"(false) 버튼용입니다.
  function setAll(on) {
    checked.value = on ? boards.value.map(b => b.key) : []
  }

  return { boardTree, checked, loading, saving, load, save, setAll }
}
