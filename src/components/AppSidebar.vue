<template>
  <!-- aside : 화면 왼쪽에 고정된 사이드바 영역입니다. HTML 주석은 이렇게 작성합니다. -->
  <aside class="side-menu" aria-label="주요 메뉴">

    <!-- boardTree 배열을 반복합니다. 각 board 는 부모 메뉴이며 children 배열에 하위 메뉴가 있습니다. -->
    <!-- v-for : 배열을 순서대로 반복해서 같은 모양의 HTML을 여러 개 만듭니다. -->
    <div v-for="board in boardTree" :key="board.key">

      <!-- ── 부모 메뉴 항목 ── -->
      <!-- :class="{ 'item-active': ... }" : 현재 선택된 게시판이면 item-active 클래스를 추가합니다. -->
      <!-- item-active 가 있으면 래퍼 전체(버튼 영역 포함)에 파란 배경이 적용됩니다. -->
      <div class="board-item-wrap" :class="{ 'item-active': currentBoard === board.key }">

        <!-- 편집 모드일 때: editingKey가 이 게시판의 key와 같으면 입력 폼을 보여줍니다. -->
        <template v-if="editingKey === board.key">
          <div class="edit-board-form">
            <!-- ref="editInputEl" : 이 input 요소를 직접 제어할 때 씁니다. (포커스 이동용) -->
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
              <button class="add-board-confirm" @click="confirmRename(board.key)">변경</button>
              <button class="board-delete-btn" @click="confirmDelete(board.key, board.label)">삭제</button>
              <button class="add-board-cancel" @click="cancelEdit">취소</button>
            </div>
          </div>
        </template>

        <!-- 일반 모드일 때: 메뉴 링크 + 편집 버튼(조건부) + 폴더 버튼 -->
        <template v-else>
          <!-- RouterLink : 클릭 시 페이지를 이동하는 링크입니다. -->
          <RouterLink
            class="side-menu-item"
            :class="{ active: currentBoard === board.key }"
            :to="board.key === 'project' ? '/' : `/?board=${board.key}`"
          >{{ board.label }}</RouterLink>

          <!-- 편집 버튼: 사용자가 추가한 게시판(key가 'board_'로 시작)에만 표시합니다. -->
          <button
            v-if="isCustomBoard(board.key)"
            class="board-edit-btn"
            title="게시판 이름 변경 / 삭제"
            @click="startEdit(board)"
          >✏️</button>

          <!-- 폴더 버튼: 모든 메뉴에 표시됩니다. 클릭하면 하위 메뉴 추가 입력 폼이 열립니다. -->
          <!-- addingSubOf === board.key 이면 같은 버튼을 다시 누른 것이므로 폼을 닫습니다. (토글) -->
          <button
            class="board-subfolder-btn"
            :class="{ active: addingSubOf === board.key }"
            title="하위 메뉴 추가"
            @click="startAddSub(board.key)"
          >📁</button>
        </template>
      </div>

      <!-- ── 하위 메뉴 항목들 ── -->
      <!-- board.children : 이 부모 메뉴에 속한 하위 메뉴 배열입니다. -->
      <div
        v-for="child in board.children"
        :key="child.key"
        class="board-item-wrap sub-item"
        :class="{ 'item-active': currentBoard === child.key }"
      >
        <!-- 하위 메뉴 편집 모드 -->
        <template v-if="editingKey === child.key">
          <div class="edit-board-form">
            <input
              ref="editInputEl"
              v-model="editName"
              class="add-board-input"
              placeholder="게시판 이름"
              maxlength="20"
              @keyup.enter="confirmRename(child.key)"
              @keyup.esc="cancelEdit"
            />
            <div class="edit-board-actions">
              <button class="add-board-confirm" @click="confirmRename(child.key)">변경</button>
              <button class="board-delete-btn" @click="confirmDelete(child.key, child.label)">삭제</button>
              <button class="add-board-cancel" @click="cancelEdit">취소</button>
            </div>
          </div>
        </template>

        <!-- 하위 메뉴 일반 모드 -->
        <template v-else>
          <RouterLink
            class="side-menu-item side-menu-sub-item"
            :class="{ active: currentBoard === child.key }"
            :to="`/?board=${child.key}`"
          >{{ child.label }}</RouterLink>

          <!-- 하위 메뉴도 사용자 추가 항목이면 편집 버튼을 표시합니다. -->
          <button
            v-if="isCustomBoard(child.key)"
            class="board-edit-btn"
            title="게시판 이름 변경 / 삭제"
            @click="startEdit(child)"
          >✏️</button>
        </template>
      </div>

      <!-- ── 하위 메뉴 추가 입력 폼 ── -->
      <!-- addingSubOf === board.key 일 때만 이 부모 메뉴 아래에 입력 폼이 나타납니다. -->
      <div v-if="addingSubOf === board.key" class="add-board-form add-submenu-form">
        <!-- ref="subInputEl" : v-for 안에 있어서 배열로 수집됩니다. [0]으로 첫 번째 요소에 접근합니다. -->
        <input
          ref="subInputEl"
          v-model="newSubName"
          class="add-board-input"
          placeholder="하위 메뉴 이름"
          maxlength="20"
          @keyup.enter="confirmAddSub"
          @keyup.esc="cancelAddSub"
        />
        <div class="add-board-actions">
          <button class="add-board-confirm" @click="confirmAddSub">확인</button>
          <button class="add-board-cancel" @click="cancelAddSub">취소</button>
        </div>
      </div>

    </div>

    <!-- 게시판 추가 입력 폼: isAdding이 true일 때만 표시됩니다. -->
    <div v-if="isAdding" class="add-board-form">
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
// onMounted : 컴포넌트가 화면에 처음 표시될 때 실행할 코드를 등록합니다.
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBoards } from '../composables/useBoards.js'

const route  = useRoute()
const router = useRouter()

const { boards, boardMap, addBoard, renameBoard, deleteBoard, loadBoards } = useBoards()

onMounted(loadBoards)

// currentBoard : 현재 URL의 ?board= 값을 읽어서 어떤 메뉴가 활성화(파란색)될지 판단합니다.
const currentBoard = computed(() => route.query.board || 'project')

// boardTree : boards 배열을 부모-자식 트리 구조로 변환합니다.
// parent_key 가 없는 항목이 최상위 메뉴, parent_key 가 있는 항목이 하위 메뉴입니다.
// 결과 예시:
//   [
//     { key: 'project', label: '프로젝트', children: [] },
//     { key: 'board_1', label: '앱팀', children: [
//       { key: 'board_2', label: 'iOS', parent_key: 'board_1' }
//     ]}
//   ]
const boardTree = computed(() => {
  // filter() : 조건에 맞는 항목만 남긴 새 배열을 만듭니다.
  // !b.parent_key : parent_key 가 null, undefined, '' 이면 true → 최상위 메뉴입니다.
  const topLevel = boards.value.filter(b => !b.parent_key)

  // map() : 배열의 각 항목을 변환해서 새 배열을 만듭니다.
  // 각 최상위 메뉴에 children 배열을 추가합니다.
  return topLevel.map(b => ({
    ...b,
    // c.parent_key === b.key : 이 부모의 key 와 같은 parent_key 를 가진 항목이 하위 메뉴입니다.
    children: boards.value.filter(c => c.parent_key === b.key),
  }))
})

// isCustomBoard : 사용자가 추가한 게시판인지 확인하는 함수입니다.
// key가 'board_'로 시작하면 사용자 추가 게시판입니다.
function isCustomBoard(key) {
  return key.startsWith('board_')
}

// ── 최상위 게시판 추가 UI 상태 ────────────────────────────

const isAdding     = ref(false)
const newBoardName = ref('')
const inputEl      = ref(null)

async function startAdd() {
  cancelEdit()
  cancelAddSub()
  isAdding.value     = true
  newBoardName.value = ''
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
    // parentKey 없이 호출하면 최상위 메뉴로 추가됩니다.
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

// ── 하위 메뉴 추가 UI 상태 ────────────────────────────────

// addingSubOf : 폴더(📁) 버튼을 클릭한 부모 메뉴의 key입니다. null이면 폼이 닫혀 있습니다.
const addingSubOf = ref(null)
// newSubName : 하위 메뉴 이름 입력 변수입니다.
const newSubName  = ref('')
// subInputEl : 하위 메뉴 이름 입력창 참조입니다.
// v-for 안에 있어서 Vue 3는 배열로 수집합니다. [0]으로 현재 활성 입력창을 씁니다.
const subInputEl  = ref(null)

// startAddSub : 📁 폴더 버튼 클릭 시 해당 부모 메뉴 아래에 입력 폼을 엽니다.
// 이미 열린 부모의 폴더 버튼을 다시 누르면 폼을 닫습니다. (토글 방식)
async function startAddSub(parentKey) {
  if (addingSubOf.value === parentKey) {
    cancelAddSub()
    return
  }
  cancelEdit()
  cancelAdd()
  addingSubOf.value = parentKey
  newSubName.value  = ''
  await nextTick()
  // v-for 안의 ref 는 배열이므로 [0] 으로 첫 번째(유일한) 요소에 접근합니다.
  const el = Array.isArray(subInputEl.value) ? subInputEl.value[0] : subInputEl.value
  el?.focus()
}

function cancelAddSub() {
  addingSubOf.value = null
  newSubName.value  = ''
}

async function confirmAddSub() {
  const name = newSubName.value.trim()
  if (!name) return
  try {
    // addBoard(이름, 부모key) : 두 번째 인자로 부모 게시판 key를 넘겨 하위 메뉴로 만듭니다.
    const result = await addBoard(name, addingSubOf.value)
    if (result.ok) {
      cancelAddSub()
    } else {
      alert(result.error)
    }
  } catch {
    alert('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.')
  }
}

// ── 게시판 편집 UI 상태 ────────────────────────────────────

const editingKey  = ref(null)
const editName    = ref('')
// editInputEl : v-for 가 두 곳(부모/자식)에 있으므로 Vue 3 가 배열로 수집합니다.
const editInputEl = ref(null)

async function startEdit(board) {
  cancelAdd()
  cancelAddSub()
  editingKey.value = board.key
  editName.value   = board.label
  await nextTick()
  // 배열일 때 [0]으로 첫 번째(현재 활성) 입력창에 접근합니다.
  const el = Array.isArray(editInputEl.value) ? editInputEl.value[0] : editInputEl.value
  el?.focus()
}

function cancelEdit() {
  editingKey.value = null
  editName.value   = ''
}

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

async function confirmDelete(key, label) {
  if (!confirm(`"${label}" 게시판을 삭제하시겠습니까?\n\n이 게시판의 게시글과 첨부파일도 모두 삭제됩니다.`)) return
  try {
    const result = await deleteBoard(key)
    if (result.ok) {
      cancelEdit()
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
