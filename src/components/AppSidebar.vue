<template>
  <!-- aside : 화면 왼쪽에 고정된 사이드바 영역입니다. (HTML 주석 문법: <!-- 내용 -->) -->
  <aside class="side-menu" aria-label="주요 메뉴">
    <!-- v-for : boards 배열을 순서대로 반복해서 메뉴 항목을 만듭니다. -->
    <!-- RouterLink : 클릭 시 페이지를 이동하는 링크입니다. (안드로이드의 startActivity()와 비슷) -->
    <!-- :class="{ active: ... }" : 현재 게시판이면 'active' 클래스를 추가해서 파란색으로 표시합니다. -->
    <RouterLink
      v-for="board in boards"
      :key="board.key"
      class="side-menu-item"
      :class="{ active: currentBoard === board.key }"
      :to="board.key === 'project' ? '/' : `/?board=${board.key}`"
    >{{ board.label }}</RouterLink>

    <!-- 게시판 추가 입력 폼: isAdding이 true일 때만 표시됩니다. -->
    <!-- v-if : 조건이 true일 때만 이 영역을 화면에 그립니다. (안드로이드의 View.VISIBLE/GONE과 비슷) -->
    <div v-if="isAdding" class="add-board-form">
      <!-- ref="inputEl" : 이 input 요소를 직접 제어할 때 사용합니다. (포커스 이동 등) -->
      <!-- @keyup.enter : Enter 키를 누르면 confirmAdd()를 실행합니다. -->
      <!-- @keyup.esc : Esc 키를 누르면 cancelAdd()를 실행합니다. -->
      <input
        ref="inputEl"
        v-model="newBoardName"
        class="add-board-input"
        placeholder="게시판 이름"
        maxlength="20"
        @keyup.enter="confirmAdd"
        @keyup.esc="cancelAdd"
      />
      <div class="add-board-actions">
        <!-- @click : 버튼을 클릭하면 해당 함수를 실행합니다. -->
        <button class="add-board-confirm" @click="confirmAdd">확인</button>
        <button class="add-board-cancel" @click="cancelAdd">취소</button>
      </div>
    </div>

    <!-- 게시판 추가하기 버튼: isAdding이 false일 때만 표시됩니다. -->
    <!-- v-else : 바로 위의 v-if가 false일 때 표시됩니다. -->
    <button v-else class="side-menu-add-btn" @click="startAdd">
      + 게시판 추가하기
    </button>
  </aside>
</template>

<script setup>
// computed : 다른 값이 바뀔 때 자동으로 재계산되는 읽기전용 값입니다.
// nextTick : Vue가 화면을 다시 그린 직후에 코드를 실행할 때 사용합니다.
// ref : 반응형 변수를 만들 때 사용합니다.
import { computed, nextTick, ref } from 'vue'
// useRoute : 현재 URL 정보(경로, 쿼리 파라미터 등)를 읽는 함수입니다.
import { useRoute } from 'vue-router'
// useBoards : 게시판 목록 상태와 추가 함수를 제공하는 ViewModel composable입니다.
import { useBoards } from '../composables/useBoards.js'

const route = useRoute()
// boards : 게시판 목록 배열, boardMap : { key: label } 객체, addBoard : 추가 함수
const { boards, boardMap, addBoard } = useBoards()

// currentBoard : 현재 URL의 ?board= 값을 읽어서 활성 게시판을 판단합니다.
// boardMap.value[route.query.board] 가 없으면(존재하지 않는 게시판) 기본값 'project'를 사용합니다.
const currentBoard = computed(() =>
  boardMap.value[route.query.board] ? route.query.board : 'project'
)

// ── 게시판 추가 UI 상태 ────────────────────────────────────

// isAdding : 입력 폼을 보여줄지 여부입니다. true면 입력 폼, false면 "+" 버튼이 보입니다.
const isAdding = ref(false)
// newBoardName : 사용자가 입력 중인 게시판 이름입니다.
const newBoardName = ref('')
// inputEl : input 요소를 직접 제어하기 위한 참조입니다. (안드로이드의 findViewById()와 비슷)
const inputEl = ref(null)

// startAdd : "게시판 추가하기" 버튼을 클릭하면 입력 폼을 열고 커서를 input으로 이동합니다.
async function startAdd() {
  isAdding.value = true
  newBoardName.value = ''
  // nextTick() : Vue가 DOM을 업데이트한 직후에 실행됩니다.
  // 입력 폼이 화면에 그려진 뒤에 포커스를 줘야 하기 때문에 nextTick을 사용합니다.
  await nextTick()
  inputEl.value?.focus()
}

// cancelAdd : 취소 버튼 또는 Esc 키를 누르면 입력 폼을 닫습니다.
function cancelAdd() {
  isAdding.value = false
  newBoardName.value = ''
}

// confirmAdd : 확인 버튼 또는 Enter 키를 누르면 게시판을 추가합니다.
async function confirmAdd() {
  // trim() : 앞뒤 공백을 제거합니다.
  const name = newBoardName.value.trim()
  // 이름이 비어 있으면 아무것도 하지 않습니다.
  if (!name) return

  // try/catch : 서버 통신 중 오류가 발생해도 앱이 멈추지 않고 메시지를 보여줍니다.
  try {
    // addBoard() : useBoards.js의 함수를 호출해서 서버에 저장하고 목록을 갱신합니다.
    const result = await addBoard(name)
    if (result.ok) {
      // 성공하면 입력 폼을 닫습니다. 목록은 boards ref가 자동으로 업데이트합니다.
      cancelAdd()
    } else {
      // 실패하면 오류 메시지를 보여줍니다. (예: 같은 이름 중복)
      alert(result.error)
    }
  } catch {
    // 네트워크 오류나 서버 미시작 등 예상치 못한 오류를 알려줍니다.
    alert('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.')
  }
}
</script>
