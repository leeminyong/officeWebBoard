// ─────────────────────────────────────────────────────────────
// date.js : 날짜 계산 도우미 함수 모음입니다.
// 할 일의 날짜는 서버와 똑같이 'YYYY-MM-DD' 문자열(예: '2026-09-21')로 다룹니다.
//
// export : 이 함수를 다른 파일에서 import 로 가져다 쓸 수 있게 내보냅니다. (Kotlin 의 public 과 비슷)
// JavaScript 의 월(month)은 0부터 시작합니다. 0 = 1월, 8 = 9월, 11 = 12월
// ─────────────────────────────────────────────────────────────

export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// 한 자리 숫자 앞에 0을 붙입니다. 예) 9 → '09', 12 → '12'
// padStart(2, '0') : 문자열이 2글자가 될 때까지 앞에 '0'을 채웁니다.
export function pad(n) {
  return String(n).padStart(2, '0');
}

// (2026, 8, 21) → '2026-09-21'   (m 은 0부터 시작하는 월이라서 +1)
export function keyOf(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

// (2026, 8) → '2026-09'   서버에 "이 달 목록 주세요"라고 요청할 때 씁니다.
export function monthKey(y, m) {
  return `${y}-${pad(m + 1)}`;
}

// '2026-09-21' → Date 객체 (Date = 날짜/시각을 다루는 JavaScript 기본 객체, java.util.Date 와 비슷)
// split('-') : '-' 기준으로 잘라서 ['2026', '09', '21'] 배열을 만듭니다.
// +p[0] : 앞의 + 는 문자열을 숫자로 바꾸는 문법입니다. '2026' → 2026
export function parseKey(k) {
  const p = k.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

// 오늘 날짜를 'YYYY-MM-DD' 로 돌려줍니다. (이 기기의 시계 기준)
export function todayKey() {
  const n = new Date();
  return keyOf(n.getFullYear(), n.getMonth(), n.getDate());
}

// '2026-09-21' → '9월 21일 월요일'
// getDay() : 요일 번호 (0 = 일요일 … 6 = 토요일)
export function dateLabel(k) {
  const d = parseKey(k);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
}
