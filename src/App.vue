<template>
  <!-- v-if="route.path !== '/login'" : 로그인 페이지가 아닐 때만 헤더와 사이드바를 보여줍니다. -->
  <!-- v-if : 조건이 true일 때만 해당 HTML 요소를 화면에 그립니다. (안드로이드의 view.visibility와 비슷) -->
  <template v-if="route.path !== '/login'">
    <header class="site-header">
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
    <AppSidebar />
  </template>

  <!-- RouterView : 현재 URL 경로에 맞는 페이지 컴포넌트를 여기에 렌더링합니다. -->
  <!-- /login 이면 LoginView, / 이면 PostListView 등이 여기에 표시됩니다. -->
  <RouterView />
  <ToastContainer />
</template>

<script setup>
// ref : 값이 바뀌면 화면이 자동으로 다시 그려지는 반응형 변수를 만듭니다.
import { ref } from 'vue'
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
