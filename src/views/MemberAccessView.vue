<template>
  <!-- HTML 주석 문법: 이 안의 글은 화면에 보이지 않는 설명입니다. -->
  <!-- 👥 멤버 권한 화면 : 관리자가 멤버에게 보여줄 게시판을 체크하는 화면입니다. (주소: /admin/member) -->
  <!-- container, card, btn 같은 class 는 style.css 에 이미 있는 공통 모양을 그대로 씁니다. -->
  <div class="container">
    <div class="card">
      <h2 style="margin-bottom:6px">👥 멤버 권한</h2>
      <p class="member-help">
        멤버(비밀번호 1996!!)로 로그인하면 여기서 체크한 게시판만 왼쪽 메뉴에 보이고, 그 게시판의 글만 볼 수 있습니다.
        체크한 게시판에서는 글쓰기·수정·삭제·댓글이 가능하고, 게시판 추가/이름변경/삭제는 관리자만 할 수 있습니다.
      </p>

      <div class="member-tools">
        <button type="button" class="btn btn-secondary btn-sm" @click="setAll(true)">전체 선택</button>
        <button type="button" class="btn btn-secondary btn-sm" @click="setAll(false)">전체 해제</button>
      </div>

      <!-- v-if / v-else : 불러오는 중이면 안내 글자를, 다 불러오면 체크박스 목록을 보여줍니다. -->
      <div v-if="loading" class="text-muted">불러오는 중...</div>
      <ul v-else class="member-board-list">
        <!-- v-for : boardTree 배열(부모 게시판 목록)을 반복해서 줄을 만듭니다. -->
        <li v-for="board in boardTree" :key="board.key">
          <!-- label 로 체크박스와 글자를 감싸면, 글자를 눌러도 체크됩니다. -->
          <label class="member-board-item">
            <!-- v-model="checked" + :value="board.key" : 체크하면 checked 배열에 이 게시판 key 가 들어가고, 해제하면 빠집니다. -->
            <!--   (체크박스 여러 개를 배열 하나에 연결하는 Vue 문법입니다.) -->
            <input v-model="checked" type="checkbox" :value="board.key" />
            <span>{{ board.label }}</span>
          </label>
          <!-- 하위 게시판은 부모 아래에 들여써서 보여줍니다. -->
          <ul v-if="board.children.length" class="member-board-list sub">
            <li v-for="child in board.children" :key="child.key">
              <label class="member-board-item">
                <input v-model="checked" type="checkbox" :value="child.key" />
                <span>└ {{ child.label }}</span>
              </label>
            </li>
          </ul>
        </li>
      </ul>

      <div class="action-bar" style="margin-top:20px">
        <!-- checked.length : 체크된 게시판 개수입니다. -->
        <span class="text-muted">{{ checked.length }}개 게시판 허용</span>
        <button type="button" class="btn btn-primary" :disabled="saving || loading" @click="save">
          {{ saving ? '저장 중...' : '저장' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// onMounted : 화면이 처음 표시될 때 실행할 코드를 등록합니다. (안드로이드의 onCreate()와 비슷)
import { onMounted } from 'vue'
import { useMemberAccess } from '../composables/useMemberAccess.js'

// 체크 상태, 불러오기/저장 로직은 모두 ViewModel(useMemberAccess.js)에 있고, 이 파일은 화면만 그립니다.
const { boardTree, checked, loading, saving, load, save, setAll } = useMemberAccess()

// 화면이 열리면 서버에서 지금 허용된 게시판 목록을 불러와 체크해 둡니다.
onMounted(load)
</script>

<!-- scoped : 이 스타일은 이 화면 안에서만 적용됩니다. -->
<style scoped>
/* CSS 주석 문법: 이 안의 글은 화면에 영향을 주지 않는 설명입니다. */

/* 화면 위쪽 안내 문구 */
.member-help {
  margin-bottom: 16px;
  font-size: .88rem;
  color: #666;
}

/* 전체 선택 / 전체 해제 버튼 줄 */
.member-tools {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

/* 게시판 체크박스 목록. 점(•) 없이 세로로 나열합니다. */
.member-board-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 하위 게시판 목록은 왼쪽으로 24px 들여씁니다. */
.member-board-list.sub {
  margin-left: 24px;
}

/* 체크박스 한 줄. 마우스를 올리면 배경색이 바뀌어 누를 수 있는 줄임을 알려줍니다. */
.member-board-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.member-board-item:hover {
  background: rgba(26, 115, 232, .08);
}

/* 체크박스 크기를 조금 키워서 누르기 쉽게 합니다. */
.member-board-item input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
