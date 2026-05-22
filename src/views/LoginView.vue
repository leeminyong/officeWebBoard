<template>
  <!-- login-wrapper : 화면 전체를 덮는 배경 영역입니다. 로그인 카드를 정중앙에 배치합니다. -->
  <!-- display:flex + justify-content:center + align-items:center = 수평·수직 정중앙 -->
  <div class="login-wrapper">
    <div class="login-card">
      <h2 class="login-title">🔐 관리자 로그인</h2>

      <!-- @submit.prevent : 폼 제출 시 페이지 새로고침을 막고 handleLogin 함수를 실행합니다. -->
      <!-- 안드로이드에서 버튼 onClick 이벤트 처리와 비슷합니다. -->
      <form @submit.prevent="handleLogin">
        <!-- v-model : input과 password 변수를 양방향으로 연결합니다. -->
        <!-- 입력할 때마다 password 값이 자동으로 업데이트됩니다. (안드로이드 TextWatcher와 비슷) -->
        <!-- type="password" : 입력 내용이 ●●● 으로 가려집니다. -->
        <!-- autofocus : 페이지가 열리면 이 입력칸에 자동으로 커서가 위치합니다. -->
        <input
          v-model="password"
          type="password"
          class="login-input"
          placeholder="비밀번호를 입력하세요"
          autofocus
        />

        <!-- v-if : errorMsg에 내용이 있을 때만 오류 메시지 영역을 화면에 표시합니다. -->
        <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>

        <!-- :disabled="loading" : loading이 true일 때 버튼을 비활성화합니다. -->
        <!-- 로그인 요청이 진행 중일 때 버튼을 두 번 누르는 것을 방지합니다. -->
        <!-- {{ loading ? '로그인 중...' : '로그인' }} : 삼항 연산자입니다. -->
        <!-- loading이 true이면 '로그인 중...' 텍스트, false이면 '로그인' 텍스트를 보여줍니다. -->
        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? '로그인 중...' : '로그인' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
// ref : 값이 바뀌면 화면이 자동으로 다시 그려지는 반응형 변수를 만듭니다. (안드로이드의 LiveData와 비슷)
import { ref } from 'vue'
// useRouter : 페이지 이동을 제어합니다. (안드로이드의 startActivity()와 비슷)
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

const router = useRouter()
// login : useAuth 컴포저블에서 로그인 API 호출 함수를 가져옵니다.
const { login } = useAuth()

// password : 사용자가 입력한 비밀번호를 저장하는 반응형 변수입니다.
const password = ref('')
// errorMsg : 로그인 실패 시 화면에 보여줄 오류 메시지입니다.
const errorMsg = ref('')
// loading : 서버에 요청을 보내는 중인지 여부입니다. true이면 버튼이 비활성화됩니다.
const loading = ref(false)

// handleLogin : 로그인 버튼 클릭 또는 Enter 키 입력 시 실행되는 함수입니다.
// async function : 서버 응답을 기다리는 비동기 함수입니다. (안드로이드의 코루틴 suspend fun과 비슷)
async function handleLogin() {
  // trim() : 앞뒤 공백을 제거합니다. 공백만 입력한 경우도 비어 있는 것으로 처리합니다.
  if (!password.value.trim()) {
    errorMsg.value = '비밀번호를 입력해주세요.'
    return
  }

  // 요청 시작 전에 상태를 설정합니다.
  loading.value = true
  errorMsg.value = ''

  // await : 서버 응답이 올 때까지 기다립니다. (안드로이드 코루틴의 await과 비슷)
  // ok : 로그인 성공 여부 (true/false), data : 서버가 반환한 데이터
  const { ok, data } = await login(password.value)
  loading.value = false

  if (ok) {
    // 로그인 성공 : 게시판 메인 페이지로 이동합니다.
    // router.push('/') : 안드로이드의 startActivity(Intent(this, MainActivity::class.java))와 비슷합니다.
    router.push('/')
  } else {
    // 로그인 실패 : 오류 메시지를 표시하고 입력칸을 초기화합니다.
    // data?.error : data가 null이 아닐 때만 error 속성을 읽습니다. (Kotlin의 data?.error와 같습니다)
    errorMsg.value = data?.error || '로그인에 실패했습니다.'
    password.value = ''
  }
}
</script>

<style scoped>
/* scoped : 이 파일의 컴포넌트에만 적용되는 스타일입니다. 다른 페이지에 영향을 주지 않습니다. */

/* login-wrapper : 화면 전체를 채우는 배경 영역입니다. */
.login-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--color-bg, #f5f5f5);
}

/* login-card : 로그인 폼을 담는 카드 영역입니다. */
.login-card {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #ddd);
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* login-title : 카드 상단 제목입니다. */
.login-title {
  text-align: center;
  margin: 0 0 28px;
  font-size: 1.4rem;
  color: var(--color-text, #222);
}

/* login-input : 비밀번호 입력칸입니다. */
/* box-sizing: border-box : padding이 width에 포함되도록 합니다. */
.login-input {
  display: block;
  width: 100%;
  padding: 10px 14px;
  font-size: 1rem;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 6px;
  background: var(--color-bg, #fff);
  color: var(--color-text, #222);
  box-sizing: border-box;
  outline: none;
}

/* :focus : 입력칸이 선택됐을 때(커서가 있을 때) 테두리 색을 파란색으로 바꿉니다. */
.login-input:focus {
  border-color: #4a90d9;
}

/* login-error : 비밀번호가 틀렸을 때 나타나는 오류 메시지 영역입니다. */
.login-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fff0f0;
  border: 1px solid #fcc;
  border-radius: 6px;
  color: #c00;
  font-size: 0.9rem;
}

/* login-btn : 로그인 버튼입니다. */
.login-btn {
  display: block;
  width: 100%;
  margin-top: 16px;
  padding: 11px;
  font-size: 1rem;
  font-weight: 600;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: filter 0.15s;
}

/* :hover:not(:disabled) : 버튼에 마우스를 올렸을 때 (비활성화 상태가 아닐 때만) 어둡게 합니다. */
.login-btn:hover:not(:disabled) {
  filter: brightness(0.9);
}

/* :disabled : 요청 중에 버튼이 비활성화됐을 때 흐릿하게 표시합니다. */
.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
