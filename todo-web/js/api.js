// ─────────────────────────────────────────────────────────────
// api.js : [MVVM - Model] 서버와 통신하는 코드만 모아 둔 파일입니다.
//          안드로이드의 Retrofit 인터페이스 + Repository 역할입니다.
//
// 서버 주소 (server/todo.js)
//   POST   /todo-api/login          로그인 → 토큰 발급
//   POST   /todo-api/logout         로그아웃
//   GET    /todo-api/todos?month=   한 달 목록
//   POST   /todo-api/todos          추가
//   PUT    /todo-api/todos/:id      수정
//   DELETE /todo-api/todos/:id      삭제
//   WS     /todo-ws?token=          실시간 변경 알림
// ─────────────────────────────────────────────────────────────

// localStorage : 브라우저에 작은 값을 저장해 두는 공간입니다. 창을 닫았다 열어도 남아 있습니다.
//               (안드로이드의 SharedPreferences 와 같은 역할)
const TOKEN_KEY = 'todoToken';

// try { } catch { } : 오류가 나도 앱이 멈추지 않게 감싸는 문법입니다.
// 브라우저의 "개인정보 보호 모드" 등에서는 localStorage 사용이 막혀 오류가 날 수 있어서 감쌌습니다.
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* 저장이 막혀 있으면 이번 창에서만 로그인 상태가 유지됩니다 */ }
}

// 로그인이 풀린 경우(401)를 다른 오류와 구분하기 위한 오류 종류입니다.
// class A extends B : B 를 상속해서 A 를 만듭니다. (Kotlin 의 class A : B() 와 같습니다)
export class AuthError extends Error {}

// 모든 API 요청이 거치는 공통 함수입니다.
// async / await : 서버 응답을 기다리는 동안 화면이 멈추지 않게 하는 문법입니다. (Kotlin 의 suspend 함수와 비슷)
// fetch() : 브라우저에 들어 있는 HTTP 요청 함수입니다. (OkHttp 의 call.execute() 와 비슷)
async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      // JSON.stringify() : 객체를 JSON 글자로 바꿉니다. (Gson.toJson() 과 같습니다)
      // 삼항연산자 (조건 ? A : B) : body 가 있을 때만 보냅니다.
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // 서버가 꺼져 있거나 인터넷이 끊겨 응답 자체를 못 받은 경우입니다.
    throw new Error('서버에 연결할 수 없습니다. 인터넷 연결이나 서버 상태를 확인하세요.');
  }

  // res.json() : 응답 글자를 객체로 바꿉니다. (Gson.fromJson() 과 같습니다) 응답이 비어 있으면 null 로 둡니다.
  let data = null;
  try { data = await res.json(); } catch { /* 응답 내용이 JSON 이 아닌 경우 */ }

  // 401 = 토큰이 없거나 더 이상 유효하지 않음 (다른 곳에서 비밀번호를 바꾼 경우 등)
  // 단, 로그인 요청의 401 은 "비밀번호 틀림"이라 일반 오류로 처리합니다.
  if (res.status === 401 && path !== '/todo-api/login') {
    throw new AuthError(data?.error || '다시 로그인해 주세요.');
  }
  // res.ok : 상태 코드가 200번대(성공)이면 true 입니다.
  if (!res.ok) throw new Error(data?.error || `요청에 실패했습니다. (${res.status})`);
  return data;
}

// ── API 함수들 ──
// 화살표 함수 (인자) => 결과 : function 을 짧게 쓰는 문법입니다.
// encodeURIComponent() : 주소에 넣을 값을 안전한 글자로 바꿉니다.
export const login       = password => request('POST', '/todo-api/login', { password });
export const logout      = ()       => request('POST', '/todo-api/logout');
export const fetchMonth  = month    => request('GET',  '/todo-api/todos?month=' + encodeURIComponent(month));
export const createTodo  = todo     => request('POST', '/todo-api/todos', todo);
export const updateTodo  = (id, changes) => request('PUT', '/todo-api/todos/' + id, changes);
export const deleteTodo  = id       => request('DELETE', '/todo-api/todos/' + id);

// ─────────────────────────────────────────────────────────────
// 실시간 연결 (WebSocket)
// 서버와 계속 열려 있는 연결을 만들어서, 다른 기기(앱, 다른 브라우저)가 할 일을 바꾸면 바로 알림을 받습니다.
//
// 동작 순서
//   1단계) /todo-ws?token=… 으로 연결
//   2단계) 연결되면 onStatus('online') + onChange(null) → 끊겨 있던 동안의 변경을 놓치지 않게 한 번 새로 불러옴
//   3단계) 서버가 {type:'changed', months:['2026-09']} 를 보내면 onChange(['2026-09'])
//   4단계) 연결이 끊기면 1초, 2초, 4초 … 최대 15초 간격으로 다시 연결 시도
//          서버가 4401(인증 실패)로 끊으면 다시 시도하지 않고 onAuthFail() → 로그인 화면으로
// ─────────────────────────────────────────────────────────────
export function connectLive({ onChange, onStatus, onAuthFail }) {
  let ws = null;
  let stopped = false;     // 로그아웃 등으로 일부러 끊은 경우 true → 재연결하지 않음
  let retry = 0;           // 연속 실패 횟수 (재연결 대기 시간을 늘리는 데 사용)
  let timer = null;

  function open() {
    const token = getToken();
    if (!token || stopped) return;
    onStatus('connecting');

    // 외부 주소(https)로 접속한 경우 wss(암호화된 WebSocket), 사무실 주소(http)는 ws 를 씁니다.
    // location : 지금 브라우저 주소 정보입니다. location.host = '192.168.0.139:3000' 처럼 주소+포트
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/todo-ws?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
      retry = 0;
      onStatus('online');
      onChange(null);
    };

    ws.onmessage = event => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }   // 'pong' 같은 JSON 이 아닌 글자는 무시
      if (msg.type === 'changed') onChange(msg.months || null);
    };

    ws.onclose = event => {
      ws = null;
      if (stopped) return;
      if (event.code === 4401) { onAuthFail(); return; }
      onStatus('offline');
      // 2 ** retry : 2의 retry 제곱. 1초 → 2초 → 4초 → 8초 → 15초(최대)
      const delay = Math.min(15000, 1000 * 2 ** retry);
      retry++;
      timer = setTimeout(open, delay);
    };
  }

  open();

  // 밖에서 쓸 수 있는 조작 함수 두 개를 돌려줍니다.
  return {
    // 완전히 끊기 (로그아웃할 때)
    close() {
      stopped = true;
      clearTimeout(timer);
      if (ws) ws.close();
    },
    // 끊겨 있으면 기다리지 말고 지금 바로 다시 연결 (화면으로 돌아왔을 때, 인터넷이 다시 연결됐을 때)
    reconnectNow() {
      if (ws || stopped) return;
      clearTimeout(timer);
      retry = 0;
      open();
    },
  };
}
