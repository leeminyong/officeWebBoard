<template>
  <!-- aside : 화면 왼쪽에 고정된 사이드바 영역입니다. HTML 주석은 이렇게 작성합니다. -->
  <aside class="side-menu" aria-label="주요 메뉴">

    <!-- v-for : boards 배열을 순서대로 반복해서 메뉴 항목을 만듭니다. -->
    <!-- :key="board.key" : Vue가 각 항목을 구분할 수 있도록 고유 key를 지정합니다. -->
    <div
      v-for="board in boards"
      :key="board.key"
      class="board-item-wrap"
    >
      <!-- 편집 모드일 때: editingKey가 이 게시판의 key와 같으면 입력 폼을 보여줍니다. -->
      <!-- v-if : 조건이 true일 때만 이 영역을 그립니다. (안드로이드의 View.VISIBLE/GONE과 비슷) -->
      <template v-if="editingKey === board.key">
        <div class="edit-board-form">
          <!-- ref="editInputEl" : 이 input 요소를 직접 제어할 때 사용합니다. (포커스 이동용) -->
          <!-- v-model="editName" : 입력 값과 editName 변수를 양방향으로 연결합니다. -->
          <!-- @keyup.enter : Enter 키를 누르면 confirmRename()을 실행합니다. -->
          <!-- @keyup.esc : Esc 키를 누르면 cancelEdit()를 실행합니다. -->
          <input
            ref="editInputEl"
            v-model="editName"
            class="add-board-input"
            placeholder="게시판 이름"
            maxlength="20"
            @keyup.enter="confirmRename(board.key)"
            @keyup.esc="cancelEdit"
          />
          <div class="edit-board-actions">
            <!-- 이름 변경 확인 버튼 -->
            <button class="add-board-confirm" @click="confirmRename(board.key)">변경</button>
            <!-- 삭제 버튼: 빨간색으로 강조해서 위험한 동작임을 알려줍니다. -->
            <button class="board-delete-btn" @click="confirmDelete(board.key, board.label)">삭제</button>
            <!-- 취소 버튼 -->
            <button class="add-board-cancel" @click="cancelEdit">취소</button>
          </div>
        </div>
      </template>

      <!-- 일반 모드일 때: RouterLink(메뉴 링크)와 편집 버튼을 나란히 보여줍니다. -->
      <!-- v-else : 바로 위의 v-if가 false일 때 표시됩니다. -->
      <template v-else>
        <!-- RouterLink : 클릭 시 페이지를 이동하는 링크입니다. (안드로이드의 startActivity()와 비슷) -->
        <!-- :class="{ active: ... }" : 현재 게시판이면 'active' 클래스를 추가해서 파란색으로 표시합니다. -->
        <RouterLink
          class="side-menu-item"
          :class="{ active: currentBoard === board.key }"
          :to="board.key === 'project' ? '/' : `/?board=${board.key}`"
        >{{ board.label }}</RouterLink>

        <!-- 편집 버튼: 사용자가 추가한 게시판(key가 'board_'로 시작)에만 표시합니다. -->
        <!-- v-if="isCustomBoard(board.key)" : 기본 게시판(프로젝트, 유지보수 등)에는 편집 버튼을 숨깁니다. -->
        <!-- CSS로 마우스를 올렸을 때만 나타나도록 설정합니다. -->
        <button
          v-if="isCustomBoard(board.key)"
          class="board-edit-btn"
          title="게시판 이름 변경 / 삭제"
          @click="startEdit(board)"
        >✏️</button>
      </template>
    </div>

    <!-- 게시판 추가 입력 폼: isAdding이 true일 때만 표시됩니다. -->
    <div v-if="isAdding" class="add-board-form">
      <!-- ref="inputEl" : 이 input 요소를 직접 제어할 때 사용합니다. (포커스 이동 등) -->
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
        <button class="add-board-confirm" @click="confirmAdd">확인</button>
        <button class="add-board-cancel" @click="cancelAdd">취소</button>
      </div>
    </div>

    <!-- 게시판 추가하기 버튼: isAdding이 false일 때만 표시됩니다. -->
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
// useRoute : 현재 URL 정보를, useRouter : 페이지 이동 함수를 제공합니다.
import { useRoute, useRouter } from 'vue-router'
// useBoards : 게시판 목록 상태와 추가/수정/삭제 함수를 제공하는 ViewModel composable입니다.
import { useBoards } from '../composables/useBoards.js'

const route  = useRoute()
const router = useRouter()

// boards : 게시판 목록 배열, boardMap : { key: label } 객체
// addBoard / renameBoard / deleteBoard : 각각 추가/수정/삭제 함수
const { boards, boardMap, addBoard, renameBoard, deleteBoard } = useBoards()

// currentBoard : 현재 URL의 ?board= 값을 읽어서 활성 게시판을 판단합니다.
// boardMap.value[route.query.board] 가 없으면(존재하지 않는 게시판) 기본값 'project'를 사용합니다.
const currentBoard = computed(() =>
  boardMap.value[route.query.board] ? route.query.board : 'project'
)

// isCustomBoard : 사용자가 추가한 게시판인지 확인하는 함수입니다.
// key가 'board_'로 시작하면 사용자 추가 게시판입니다. (서버에서 'board_타임스탬프' 형태로 만듭니다.)
// startsWith() : 문자열이 특정 문자로 시작하는지 확인합니다. (Java의 String.startsWith()와 동일)
function isCustomBoard(key) {
  return key.startsWith('board_')
}

// ── 게시판 추가 UI 상태 ────────────────────────────────────

// isAdding : 추가 입력 폼을 보여줄지 여부입니다.
const isAdding     = ref(false)
// newBoardName : 사용자가 입력 중인 새 게시판 이름입니다.
const newBoardName = ref('')
// inputEl : 추가 input 요소를 직접 제어하기 위한 참조입니다. (안드로이드의 findViewById()와 비슷)
const inputEl      = ref(null)

// startAdd : "게시판 추가하기" 버튼 클릭 시 입력 폼을 열고 커서를 이동합니다.
async function startAdd() {
  // 편집 중인 게시판이 있으면 편집 모드를 먼저 닫습니다.
  cancelEdit()
  isAdding.value     = true
  newBoardName.value = ''
  // nextTick() : Vue가 DOM을 업데이트한 직후에 실행합니다.
  // 입력 폼이 화면에 그려진 뒤 포커스를 줘야 하기 때문입니다.
  await nextTick()
  inputEl.value?.focus()
}

function cancelAdd() {
  isAdding.value     = false
  newBoardName.value = ''
}

async function confirmAdd() {
  const name = newBoardName.value.trim()
  if (!name) return
  try {
    const result = await addBoard(name)
    if (result.ok) {
      cancelAdd()
    } else {
      alert(result.error)
    }
  } catch {
    alert('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.')
  }
}

// ── 게시판 편집 UI 상태 ────────────────────────────────────

// editingKey : 현재 편집 중인 게시판의 key입니다. null이면 편집 모드가 아닙니다.
const editingKey  = ref(null)
// editName : 편집 중인 새 이름을 담는 입력 변수입니다.
const editName    = ref('')
// editInputEl : 편집 input 요소를 직접 제어하기 위한 참조입니다.
const editInputEl = ref(null)

// startEdit : 연필(✏️) 버튼 클릭 시 해당 게시판을 편집 모드로 전환합니다.
// board : { key, label } 객체
async function startEdit(board) {
  // 추가 폼이 열려 있으면 닫습니다.
  cancelAdd()
  editingKey.value = board.key
  // 현재 이름을 입력칸에 미리 채워줍니다.
  editName.value   = board.label
  await nextTick()
  editInputEl.value?.focus()
}

// cancelEdit : 편집 모드를 취소하고 원래 상태로 돌아갑니다.
function cancelEdit() {
  editingKey.value = null
  editName.value   = ''
}

// confirmRename : "변경" 버튼 또는 Enter 키 입력 시 이름을 수정합니다.
// key : 수정할 게시판의 식별자
async function confirmRename(key) {
  const name = editName.value.trim()
  if (!name) return
  try {
    const result = await renameBoard(key, name)
    if (result.ok) {
      cancelEdit()
    } else {
      alert(result.error)
    }
  } catch {
    alert('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.')
  }
}

// confirmDelete : "삭제" 버튼 클릭 시 확인 대화상자를 보여주고 삭제를 진행합니다.
// key : 삭제할 게시판의 식별자, label : 확인 메시지에 보여줄 게시판 이름
async function confirmDelete(key, label) {
  // confirm() : 브라우저 기본 확인창을 보여줍니다. 확인을 누르면 true, 취소를 누르면 false입니다.
  // 안드로이드의 AlertDialog와 비슷한 역할입니다.
  if (!confirm(`"${label}" 게시판을 삭제하시겠습니까?\n\n이 게시판의 게시글과 첨부파일도 모두 삭제됩니다.`)) return
  try {
    const result = await deleteBoard(key)
    if (result.ok) {
      cancelEdit()
      // 현재 보고 있던 게시판이 삭제된 경우, 기본 게시판(프로젝트)으로 이동합니다.
      // currentBoard.value === key : 지금 보고 있던 게시판이 삭제된 것인지 확인합니다.
      // router.push('/') : 프로젝트 게시판 화면으로 이동합니다. (안드로이드의 startActivity()와 비슷)
      if (currentBoard.value === key) {
        router.push('/')
      }
    } else {
      alert(result.error)
    }
  } catch {
    alert('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.')
  }
}
</script>
