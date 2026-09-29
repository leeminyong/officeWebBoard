// ViewModel 역할을 하는 컴포저블입니다. (안드로이드의 ViewModel 클래스와 비슷)
// 로그인 상태(isLoggedIn)를 관리하고, 로그인/로그아웃/상태확인 API를 호출합니다.
// 로그인한 사람이 관리자(admin)인지 멤버(member)인지, 멤버라면 어떤 게시판을 볼 수 있는지도 함께 기억합니다.

// ref : 값이 바뀌면 화면이 자동으로 다시 그려지는 반응형 변수를 만듭니다.
// computed : 다른 값이 바뀔 때 자동으로 다시 계산되는 읽기전용 값입니다.
import { ref, computed } from 'vue'

// ── 모듈 수준 상태 (싱글턴 패턴) ───────────────────────────
// useAuth()를 여러 컴포넌트에서 호출해도 아래 값들은 항상 같은 하나의 값을 공유합니다.
// 안드로이드의 싱글턴(static 변수)과 비슷한 개념입니다.
// null  : 아직 서버에 확인 요청을 보내지 않은 초기 상태입니다.
// true  : 서버에서 로그인됨을 확인한 상태입니다.
// false : 서버에서 로그인 안 됨을 확인한 상태입니다.
const isLoggedIn = ref(null)

// role : 로그인한 사람의 종류입니다. 'admin'(관리자) 또는 'member'(멤버), 로그인 전에는 null
const role = ref(null)

// memberBoards : 멤버에게 허용된 게시판 key 배열입니다. 예) ['project', 'board_123']
// 관리자는 제한이 없으므로 null 입니다.
const memberBoards = ref(null)

// isAdmin : 관리자인지 여부입니다. role 이 바뀌면 자동으로 다시 계산됩니다.
// 화면에서 관리자 전용 버튼(👥 멤버 권한, 게시판 추가 등)을 보여줄지 정할 때 씁니다.
const isAdmin = computed(() => role.value === 'admin')

// applyAuthInfo : 서버가 돌려준 로그인 정보(loggedIn, role, memberBoards)를 위 상태 변수에 저장합니다.
// 로그인 확인(checkAuth)과 로그인(login) 두 곳에서 같은 처리를 하므로 함수로 묶었습니다.
function applyAuthInfo(data) {
  isLoggedIn.value = !!data.loggedIn
  role.value = data.role || null
  memberBoards.value = data.memberBoards ?? null   // ?? : 왼쪽 값이 null/undefined 일 때만 오른쪽 값을 씁니다.
}

export function useAuth() {
  // ── checkAuth : 서버에 현재 로그인 상태를 확인하는 함수 ──
  // 이미 확인한 경우(null이 아닌 경우)는 서버 요청을 다시 보내지 않습니다.
  // 페이지를 이동할 때마다 이 함수가 호출되지만, 서버 요청은 최초 1회만 발생합니다.
  async function checkAuth() {
    // isLoggedIn이 이미 설정돼 있으면 (null이 아니면) 저장된 값을 바로 반환합니다.
    if (isLoggedIn.value !== null) return isLoggedIn.value

    // 서버에 로그인 상태 확인 요청을 보냅니다.
    // fetch('/api/auth/check') : GET 방식으로 서버에 요청합니다.
    try {
      const res = await fetch('/api/auth/check')
      const data = await res.json()
      // data 예시: { loggedIn: true, role: 'member', memberBoards: ['project'] }
      applyAuthInfo(data)
      return isLoggedIn.value
    } catch {
      // 네트워크 오류 등 예외가 발생하면 로그인 안 된 것으로 처리합니다.
      isLoggedIn.value = false
      return false
    }
  }

  // ── login : 비밀번호를 서버에 보내서 로그인을 요청하는 함수 ──
  // 관리자 비밀번호든 멤버 비밀번호든 같은 함수로 보냅니다. 서버가 어느 쪽인지 판단해서 role 로 알려줍니다.
  // 반환값: { ok: true/false, data: { ok: true, role, ... } 또는 { error: '...' } }
  async function login(password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      // Content-Type: 'application/json' : 서버에 JSON 형식으로 보낸다는 표시입니다.
      headers: { 'Content-Type': 'application/json' },
      // JSON.stringify() : 자바스크립트 객체를 JSON 문자열로 변환합니다.
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    // 로그인 성공 시 서버가 돌려준 로그인 정보(role, memberBoards)를 저장합니다.
    if (res.ok) {
      applyAuthInfo(data)
    }
    return { ok: res.ok, data }
  }

  // ── logout : 서버에 로그아웃을 요청하고 로컬 상태를 초기화하는 함수 ──
  async function logout() {
    await fetch('/api/logout', { method: 'POST' })
    // 로그아웃 후 로그인 정보를 모두 비웁니다.
    // 다음번에 checkAuth()를 호출하면 서버에 다시 요청을 보냅니다.
    isLoggedIn.value = false
    role.value = null
    memberBoards.value = null
  }

  return { isLoggedIn, role, isAdmin, memberBoards, checkAuth, login, logout }
}
