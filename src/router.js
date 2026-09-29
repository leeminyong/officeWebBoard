import { createRouter, createWebHistory } from 'vue-router'
import PostListView from './views/PostListView.vue'
import PostDetailView from './views/PostDetailView.vue'
import WriteFormView from './views/WriteFormView.vue'
// LoginView : 로그인 페이지 컴포넌트입니다.
import LoginView from './views/LoginView.vue'
// MemberAccessView : 관리자가 멤버에게 보여줄 게시판을 체크하는 화면입니다.
import MemberAccessView from './views/MemberAccessView.vue'
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
    // /admin/member : 👥 멤버 권한 화면입니다. 관리자만 들어갈 수 있습니다. (아래 네비게이션 가드에서 검사)
    { path: '/admin/member', component: MemberAccessView },
  ],
})

// ── 네비게이션 가드 ─────────────────────────────────────────
// 모든 페이지 이동 전에 이 함수가 실행됩니다.
// 안드로이드에서 Activity onResume()에서 로그인 여부를 확인하고 LoginActivity로 보내는 것과 비슷합니다.
// to : 이동하려는 페이지 정보입니다. (to.path = 이동할 경로 문자열)
// async (to) => {} : 서버 응답을 기다리는 비동기 함수입니다.
router.beforeEach(async (to) => {
  const { checkAuth, isAdmin, memberBoards } = useAuth()
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

  // /admin 으로 시작하는 관리자 전용 화면은 관리자가 아니면 메인 페이지로 보냅니다.
  // startsWith() : 문자열이 해당 글자로 시작하는지 true/false로 알려줍니다.
  // (화면만 막는 것이고, 실제 데이터는 서버에서도 관리자만 읽고 저장할 수 있게 막혀 있습니다.)
  if (to.path.startsWith('/admin') && !isAdmin.value) return '/'

  // 멤버가 게시글 목록 화면(/)으로 갈 때, 허용되지 않은 게시판이면 허용된 첫 게시판으로 보냅니다.
  // 예) 멤버가 로그인하면 기본으로 '/'(프로젝트 게시판)로 오는데, 프로젝트가 허용 안 돼 있으면
  //     허용 목록의 첫 게시판(예: /?board=board_123)으로 바꿔서 보여줍니다.
  // memberBoards.value : 관리자는 null 이라 이 검사를 건너뜁니다.
  // memberBoards.value.length : 허용된 게시판이 하나도 없으면 보낼 곳이 없으므로 그대로 두고,
  //   목록 화면에서 서버가 돌려준 "권한이 없습니다" 안내가 표시됩니다.
  const allowed = memberBoards.value
  if (to.path === '/' && allowed && allowed.length) {
    const board = to.query.board || 'project'
    // includes() : 배열 안에 해당 값이 있는지 true/false로 알려줍니다.
    if (!allowed.includes(board)) return { path: '/', query: { board: allowed[0] } }
  }
  // 로그인된 상태라면 요청한 페이지로 이동을 허용합니다.
})
