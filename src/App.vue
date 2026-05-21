<template>
  <header class="site-header">
    <h1 @click="router.push('/')">📋 게시판</h1>

    <!-- 테마 전환 버튼 영역: 헤더 오른쪽 끝에 배치됩니다. -->
    <!-- style="margin-left:auto" → flexbox에서 왼쪽의 h1이 왼쪽에 붙고, 이 div는 오른쪽 끝으로 밀립니다. -->
    <div style="margin-left:auto;display:flex;gap:6px">
      <!-- :class="{ active: !isDark }" → isDark가 false(라이트 모드)일 때 'active' 클래스가 추가됩니다. -->
      <!-- active 클래스가 붙으면 CSS에서 더 밝게 강조합니다. -->
      <button class="theme-btn" :class="{ active: !isDark }" @click="setLight" title="라이트 모드로 전환">
        ☀️ 라이트
      </button>
      <!-- :class="{ active: isDark }" → isDark가 true(다크 모드)일 때 'active' 클래스가 추가됩니다. -->
      <button class="theme-btn" :class="{ active: isDark }" @click="setDark" title="다크 모드로 전환">
        🌙 다크
      </button>
    </div>
  </header>
  <AppSidebar />
  <RouterView />
  <ToastContainer />
</template>

<script setup>
// ref : 값이 바뀌면 화면이 자동으로 다시 그려지는 반응형 변수를 만듭니다. (안드로이드의 LiveData와 같은 개념)
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import ToastContainer from './components/ToastContainer.vue'

const router = useRouter()

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
</script>
