import { createRouter, createWebHistory } from 'vue-router'
import PostListView from './views/PostListView.vue'
import PostDetailView from './views/PostDetailView.vue'
import WriteFormView from './views/WriteFormView.vue'
// LoginView : 로그인 페이지 컴포넌트입니다.
import LoginView from './views/LoginView.vue'
// useAuth : 로그인 상태를 확인하는 컴포저블입니다.
import { useAuth } from './composables/useAuth.js'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // /login : 로그인 페이지 경로입니다. 로그인 전에는 여기로 리다이렉트됩니다.
    { path: '/login', component: LoginView },
    { path: '/', component: PostListView },
    { path: '/posts/:id', component: PostDetailView },
    { path: '/write', component: WriteFormView },
    { path: '/posts/:id/edit', component: WriteFormView },
  ],
})

// ── 네비게이션 가드 ─────────────────────────────────────────
// 모든 페이지 이동 전에 이 함수가 실행됩니다.
// 안드로이드에서 Activity onResume()에서 로그인 여부를 확인하고 LoginActivity로 보내는 것과 비슷합니다.
// to : 이동하려는 페이지 정보입니다. (to.path = 이동할 경로 문자열)
// async (to) => {} : 서버 응답을 기다리는 비동기 함수입니다.
router.beforeEach(async (to) => {
  const { checkAuth } = useAuth()
  // 서버에 로그인 여부를 확인합니다. (최초 1회만 서버 요청, 이후는 캐시된 값 사용)
  const loggedIn = await checkAuth()

  // /login 페이지로 이동하는 경우:
  if (to.path === '/login') {
    // 이미 로그인된 상태라면 /login을 보여줄 필요가 없으므로 메인 페이지로 보냅니다.
    if (loggedIn) return '/'
    // 로그인 안 된 상태라면 /login 페이지를 그대로 보여줍니다.
    // return true : "이동을 허용한다"는 의미입니다.
    return true
  }

  // /login 이외의 페이지로 이동하는 경우:
  // 로그인이 안 돼 있으면 /login 페이지로 강제 이동합니다.
  // return '/login' : "이 경로로 리다이렉트하라"는 의미입니다.
  if (!loggedIn) return '/login'
  // 로그인된 상태라면 요청한 페이지로 이동을 허용합니다.
})
