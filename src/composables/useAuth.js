// ViewModel 역할을 하는 컴포저블입니다. (안드로이드의 ViewModel 클래스와 비슷)
// 로그인 상태(isLoggedIn)를 관리하고, 로그인/로그아웃/상태확인 API를 호출합니다.

// ref : 값이 바뀌면 화면이 자동으로 다시 그려지는 반응형 변수를 만듭니다.
import { ref } from 'vue'

// ── 모듈 수준 상태 (싱글턴 패턴) ───────────────────────────
// useAuth()를 여러 컴포넌트에서 호출해도 isLoggedIn은 항상 같은 하나의 값을 공유합니다.
// 안드로이드의 싱글턴(static 변수)과 비슷한 개념입니다.
// null  : 아직 서버에 확인 요청을 보내지 않은 초기 상태입니다.
// true  : 서버에서 로그인됨을 확인한 상태입니다.
// false : 서버에서 로그인 안 됨을 확인한 상태입니다.
const isLoggedIn = ref(null)

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
      // data.loggedIn : 서버가 true 또는 false로 알려줍니다.
      isLoggedIn.value = data.loggedIn
      return data.loggedIn
    } catch {
      // 네트워크 오류 등 예외가 발생하면 로그인 안 된 것으로 처리합니다.
      isLoggedIn.value = false
      return false
    }
  }

  // ── login : 비밀번호를 서버에 보내서 로그인을 요청하는 함수 ──
  // 반환값: { ok: true/false, data: { ok: true } 또는 { error: '...' } }
  async function login(password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      // Content-Type: 'application/json' : 서버에 JSON 형식으로 보낸다는 표시입니다.
      headers: { 'Content-Type': 'application/json' },
      // JSON.stringify() : 자바스크립트 객체를 JSON 문자열로 변환합니다.
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    // 로그인 성공 시 isLoggedIn을 true로 변경합니다.
    if (res.ok) {
      isLoggedIn.value = true
    }
    return { ok: res.ok, data }
  }

  // ── logout : 서버에 로그아웃을 요청하고 로컬 상태를 초기화하는 함수 ──
  async function logout() {
    await fetch('/api/logout', { method: 'POST' })
    // 로그아웃 후 isLoggedIn을 false로 바꿉니다.
    // 다음번에 checkAuth()를 호출하면 서버에 다시 요청을 보냅니다.
    isLoggedIn.value = false
  }

  return { isLoggedIn, checkAuth, login, logout }
}
