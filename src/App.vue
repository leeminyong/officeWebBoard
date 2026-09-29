<template>
  <!-- v-if="route.path !== '/login'" : 로그인 페이지가 아닐 때만 헤더와 사이드바를 보여줍니다. -->
  <!-- v-if : 조건이 true일 때만 해당 HTML 요소를 화면에 그립니다. (안드로이드의 view.visibility와 비슷) -->
  <template v-if="route.path !== '/login'">
    <header class="site-header">
      <!-- ☰ 메뉴 버튼 : 누를 때마다 왼쪽 메뉴를 숨기거나 다시 보여줍니다. -->
      <!-- theme-btn 클래스를 같이 붙여서 오른쪽 라이트/다크 버튼과 같은 모양(반투명 테두리 알약 모양)으로 보이게 합니다. -->
      <!-- :title : 마우스를 올렸을 때 뜨는 설명 글자입니다. 삼항연산자(조건 ? A : B)로 지금 상태에 맞는 글자를 고릅니다. -->
      <!-- :aria-expanded : 화면 낭독기(시각장애인용 읽어주기 프로그램)에 "메뉴가 펼쳐져 있는지"를 알려주는 속성입니다. -->
      <button
        class="theme-btn menu-toggle-btn"
        :title="sidebarHidden ? '왼쪽 메뉴 보이기' : '왼쪽 메뉴 숨기기'"
        :aria-expanded="!sidebarHidden"
        @click="toggleSidebar"
      >☰</button>
      <h1 @click="router.push('/')">📋 게시판</h1>

      <!-- 헤더 오른쪽 버튼 영역: margin-left:auto 로 오른쪽 끝에 배치됩니다. -->
      <div style="margin-left:auto;display:flex;gap:6px">
        <!-- :class="{ active: !isDark }" → isDark가 false(라이트 모드)일 때 'active' 클래스가 추가됩니다. -->
        <button class="theme-btn" :class="{ active: !isDark }" @click="setLight" title="라이트 모드로 전환">
          ☀️ 라이트
        </button>
        <!-- :class="{ active: isDark }" → isDark가 true(다크 모드)일 때 'active' 클래스가 추가됩니다. -->
        <button class="theme-btn" :class="{ active: isDark }" @click="setDark" title="다크 모드로 전환">
          🌙 다크
        </button>
        <!-- 로그아웃 버튼입니다. 클릭하면 서버 세션을 삭제하고 로그인 페이지로 이동합니다. -->
        <button class="theme-btn" @click="handleLogout" title="로그아웃">
          🔓 로그아웃
        </button>
      </div>
    </header>
    <!-- :class="{ 'side-menu-hidden': sidebarHidden }" : sidebarHidden 이 true일 때만 side-menu-hidden 이라는 CSS 이름표를 붙입니다. -->
    <!-- AppSidebar 의 가장 바깥 요소(aside.side-menu)에 이 이름표가 그대로 전달되고, style.css 에서 메뉴를 왼쪽 화면 밖으로 밀어냅니다. -->
    <AppSidebar :class="{ 'side-menu-hidden': sidebarHidden }" />
  </template>

  <!-- RouterView : 현재 URL 경로에 맞는 페이지 컴포넌트를 여기에 렌더링합니다. -->
  <!-- /login 이면 LoginView, / 이면 PostListView 등이 여기에 표시됩니다. -->
  <RouterView />
  <ToastContainer />
</template>

<script setup>
// ref : 값이 바뀌면 화면이 자동으로 다시 그려지는 반응형 변수를 만듭니다.
// watch : 지정한 값이 바뀔 때마다 함수를 실행합니다. (안드로이드에서 LiveData.observe() 하는 것과 비슷합니다.)
import { ref, watch } from 'vue'
// useRouter : 페이지 이동을 제어합니다. (안드로이드의 startActivity()와 비슷)
// useRoute : 현재 페이지의 경로 정보를 읽습니다. (안드로이드의 intent.data와 비슷)
import { useRouter, useRoute } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import ToastContainer from './components/ToastContainer.vue'
// useAuth : 로그인 상태 관리 컴포저블입니다.
import { useAuth } from './composables/useAuth.js'

const router = useRouter()
// route.path : 현재 URL 경로 문자열입니다. (예: '/login', '/', '/posts/5')
// 이 값을 보고 헤더/사이드바를 보여줄지 결정합니다.
const route = useRoute()
const { logout } = useAuth()

// ── 왼쪽 메뉴 숨기기 ─────────────────────────────────────────
// 글보기 화면에서는 본문을 넓게 보기 위해 왼쪽 메뉴를 자동으로 숨기고,
// 머리글의 ☰ 버튼으로 언제든 다시 보이거나 숨길 수 있게 합니다.

// isPostDetail : 주소가 글보기 화면(/posts/번호)인지 확인합니다.
// /^\/posts\/[^/]+$/ 는 정규식(문자열 모양을 검사하는 규칙)입니다.
//   ^ = 문자열 시작, \/posts\/ = "/posts/" 글자, [^/]+ = "/"가 아닌 글자 1개 이상(글 번호), $ = 문자열 끝
//   그래서 /posts/5 는 true, 글수정 화면인 /posts/5/edit 은 뒤에 /edit 이 더 있어서 false 입니다.
// test() : 문자열이 정규식 규칙에 맞으면 true, 아니면 false를 돌려줍니다.
function isPostDetail(path) {
  return /^\/posts\/[^/]+$/.test(path)
}

// sidebarHidden : 왼쪽 메뉴를 숨길지 여부입니다. true면 숨깁니다.
const sidebarHidden = ref(isPostDetail(route.path))

// 화면(주소)이 바뀔 때마다 기본 상태로 되돌립니다.
// 글보기 화면으로 가면 숨기고(true), 목록·글쓰기 등 다른 화면으로 가면 보여줍니다(false).
// 예: 글보기에서 ☰로 메뉴를 열고 → 메뉴에서 다른 게시판을 누르면 → 목록 화면이 되므로 메뉴는 보이는 상태가 됩니다.
watch(() => route.path, path => {
  sidebarHidden.value = isPostDetail(path)
})

// toggleSidebar : ☰ 버튼을 누르면 실행됩니다. 지금 상태의 반대로 바꿉니다. (! = true↔false 뒤집기)
function toggleSidebar() {
  sidebarHidden.value = !sidebarHidden.value
}

// isDark : 현재 다크 모드 여부를 저장하는 반응형 변수입니다.
// localStorage.getItem('theme') : 브라우저에 저장된 테마 설정을 불러옵니다.
const isDark = ref(localStorage.getItem('theme') === 'dark')

// 페이지가 처음 열릴 때, 저장된 테마를 즉시 적용합니다.
if (isDark.value) {
  document.documentElement.setAttribute('data-theme', 'dark')
}

// setLight : ☀️ 라이트 버튼 클릭 시 실행됩니다.
function setLight() {
  isDark.value = false
  document.documentElement.removeAttribute('data-theme')
  localStorage.setItem('theme', 'light')
}

// setDark : 🌙 다크 버튼 클릭 시 실행됩니다.
function setDark() {
  isDark.value = true
  document.documentElement.setAttribute('data-theme', 'dark')
  localStorage.setItem('theme', 'dark')
}

// handleLogout : 🔓 로그아웃 버튼 클릭 시 실행됩니다.
// 1단계: 서버에 로그아웃 요청을 보냅니다. (세션 삭제)
// 2단계: isLoggedIn을 false로 변경합니다.
// 3단계: 로그인 페이지로 이동합니다.
async function handleLogout() {
  await logout()
  router.push('/login')
}
</script>
