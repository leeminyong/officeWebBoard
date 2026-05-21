// useDarkMode.js : 다크모드 상태를 앱 전체에서 공유하는 composable 입니다.
//
// [왜 이 파일이 필요한가?]
// App.vue 에서만 isDark 상태를 관리하면, PostDetailView.vue 처럼 다른 화면에서
// 다크모드 여부를 알 수 없습니다.
// 이 파일에서 isDark ref를 "모듈 레벨"에 선언하면,
// 여러 컴포넌트가 같은 하나의 ref를 공유합니다.
// 안드로이드의 싱글톤(Singleton) 패턴과 같은 개념입니다.

// ref : 값이 바뀌면 화면이 자동으로 다시 그려지는 반응형 변수입니다. (안드로이드 LiveData와 같음)
import { ref } from 'vue'

// 이 변수는 파일이 처음 import 될 때 딱 한 번만 생성됩니다.
// App.vue, PostDetailView.vue 모두 이 파일을 import 해도 같은 변수를 씁니다.
// localStorage.getItem('theme') : 브라우저에 저장된 테마를 불러옵니다.
const isDark = ref(localStorage.getItem('theme') === 'dark')

// 앱이 처음 실행될 때 저장된 테마를 즉시 적용합니다.
// document.documentElement : <html> 태그 자체를 가리킵니다.
// setAttribute('data-theme', 'dark') : <html data-theme="dark"> 속성을 추가합니다.
// CSS 파일의 [data-theme="dark"] 선택자가 이 속성을 감지해 다크 모드 색을 적용합니다.
if (isDark.value) {
  document.documentElement.setAttribute('data-theme', 'dark')
}

export function useDarkMode() {
  // setLight : ☀️ 라이트 버튼 클릭 시 실행됩니다.
  function setLight() {
    isDark.value = false
    // removeAttribute : <html>에서 data-theme 속성을 제거합니다. 라이트 모드로 돌아갑니다.
    document.documentElement.removeAttribute('data-theme')
    // localStorage.setItem : 브라우저에 설정을 저장합니다. 새로고침해도 유지됩니다.
    localStorage.setItem('theme', 'light')
  }

  // setDark : 🌙 다크 버튼 클릭 시 실행됩니다.
  function setDark() {
    isDark.value = true
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorage.setItem('theme', 'dark')
  }

  return { isDark, setLight, setDark }
}
