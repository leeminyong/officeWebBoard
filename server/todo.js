// ─────────────────────────────────────────────────────────────
// todo.js : 개인용 할 일(Todo) 앱의 서버 코드입니다.
//
// JavaScript 주석 문법: // 뒤의 글은 실행되지 않는 설명입니다.
//
// 게시판과 완전히 분리해서 동작합니다.
//   - 화면 주소 : /todo        (todo-web 폴더의 파일을 보여줌 → server.js 에서 연결)
//   - API 주소  : /todo-api/…  (게시판의 /api 와 겹치지 않아서 게시판 로그인 검사를 받지 않음)
//   - 실시간    : /todo-ws     (WebSocket, 데이터가 바뀌면 연결된 모든 기기에 알림)
//   - 로그인    : 게시판 비밀번호와 별개인 "할 일 전용 비밀번호" + 토큰
//
// 이 파일은 server.js 에서 두 번 호출됩니다.
//   1단계) registerTodoRoutes(app)  : 서버 시작 전에 API 주소들을 등록
//   2단계) attachTodoWebSocket(server) : 서버가 켜진 뒤 WebSocket 을 같은 3000번 포트에 연결
// ─────────────────────────────────────────────────────────────

// require() : 다른 파일이나 라이브러리를 불러옵니다. (Kotlin/Java 의 import 와 같은 역할)
const crypto = require('crypto');              // Node 내장 암호화 기능. 무작위 토큰을 만들 때 사용
const bcrypt = require('bcryptjs');            // 비밀번호 해시 비교 (게시판 로그인과 같은 라이브러리)
const { WebSocketServer } = require('ws');     // WebSocket 서버 라이브러리 (npm install ws 로 설치)
const db = require('./db/database');           // board.db 연결 (todos, todo_tokens 테이블은 database.js 에서 생성)

// settings 테이블에 할 일 비밀번호 해시를 저장할 때 쓰는 key 이름입니다.
// 비밀번호는 set-todo-password.cmd 로 설정합니다. (server/set-todo-password.js)
const PASSWORD_KEY = 'todo_password_hash';

// 날짜 형식 검사용 정규식입니다. 정규식 = 문자열 모양을 검사하는 패턴 문법입니다.
//   ^ : 문자열 시작,  \d{4} : 숫자 4개,  - : 하이픈 글자,  $ : 문자열 끝
//   → '2026-09-21' 은 통과, '2026-9-21' 이나 'abc' 는 실패
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

// 할 일 내용 최대 글자 수입니다. 너무 긴 글로 DB 가 커지는 것을 막습니다.
const MAX_TEXT = 500;

// ── 로그인 실패 제한 ────────────────────────────────────────
// 인터넷에 열려 있는 주소라서, 누군가 비밀번호를 무작정 대입해 보는 것을 막습니다.
// 같은 접속 주소(IP)에서 5번 틀리면 5분 동안 로그인을 막습니다.
// Map : key → value 쌍을 저장하는 자료구조입니다. (Kotlin 의 HashMap 과 같습니다)
const loginFails = new Map();   // IP → { count: 틀린 횟수, until: 잠금 해제 시각(ms) }
const MAX_FAILS = 5;
const LOCK_MS   = 5 * 60 * 1000;

// 요청을 보낸 사람의 IP 를 구합니다.
// Cloudflare 터널을 거쳐 오면 서버 입장에서는 모두 127.0.0.1(이 PC 자신)로 보이기 때문에,
// Cloudflare 가 붙여 주는 'cf-connecting-ip' 헤더(요청에 딸려 오는 추가 정보)를 먼저 확인합니다.
// || : 앞의 값이 비어 있으면 뒤의 값을 사용합니다.
function clientIp(req) {
  return req.headers['cf-connecting-ip'] || req.ip || 'unknown';
}

// ── 토큰 검사 ──────────────────────────────────────────────
// 토큰이 todo_tokens 테이블에 있으면 로그인한 기기로 인정합니다.
function isValidToken(token) {
  // typeof : 값의 종류를 문자열로 알려줍니다. 문자열이 아니거나 너무 짧으면 바로 거절합니다.
  if (typeof token !== 'string' || token.length < 32) return false;
  return !!db.prepare('SELECT token FROM todo_tokens WHERE token = ?').get(token);
}

// 요청 헤더에서 토큰을 꺼냅니다.
// 기기는 'Authorization: Bearer 토큰값' 형태로 보냅니다. (Retrofit 의 @Header("Authorization") 과 같은 방식)
function tokenFromRequest(req) {
  const header = req.headers.authorization || '';
  // startsWith() : 문자열이 특정 글자로 시작하는지 확인합니다.
  // slice(7) : 앞의 'Bearer ' 7글자를 잘라내고 나머지(토큰)만 남깁니다.
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

// 미들웨어 : API 가 실행되기 전에 먼저 실행되는 검사 함수입니다.
// 토큰이 맞으면 next() 로 원래 API 를 계속 실행하고, 틀리면 401(인증 필요)을 돌려줍니다.
function requireTodoAuth(req, res, next) {
  if (isValidToken(tokenFromRequest(req))) return next();
  return res.status(401).json({ error: '로그인이 필요합니다.' });
}

// ── DB 한 줄 → 화면/앱에 보낼 데이터 모양으로 변환 ──────────
// DB 의 done 은 0/1 숫자라서, 받는 쪽이 쓰기 편하도록 true/false 로 바꿉니다.
// 삼항연산자 (조건 ? A : B) : 조건이 참이면 A, 거짓이면 B 를 사용합니다.
function toTodo(row) {
  return {
    id: Number(row.id),
    date: row.date,
    text: row.text,
    done: row.done ? true : false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 'YYYY-MM-DD' 에서 앞 7글자 'YYYY-MM' 만 꺼냅니다. 실시간 알림에 "어느 달이 바뀌었는지" 담을 때 사용합니다.
function monthOf(date) {
  return date.slice(0, 7);
}

// ── 실시간 알림 ────────────────────────────────────────────
// wss : WebSocket 서버 객체입니다. attachTodoWebSocket() 이 실행된 뒤에 채워집니다.
let wss = null;

// 연결된 모든 기기에 "이 달의 할 일이 바뀌었다"는 신호를 보냅니다.
// 신호에는 데이터 자체가 아니라 바뀐 달만 담습니다. 받은 쪽이 그 달 목록을 다시 불러옵니다.
// → 앱의 LiveData 를 새로 채우는 방식과 같습니다. 데이터가 한 곳(서버)에서만 오니 서로 어긋나지 않습니다.
// ...months : 나머지 매개변수 문법입니다. broadcastChange('2026-09') 나 broadcastChange('2026-09', '2026-10') 처럼 여러 개를 받을 수 있습니다.
function broadcastChange(...months) {
  if (!wss) return;
  // new Set() : 중복을 없앱니다. 같은 달이 두 번 들어와도 한 번만 보냅니다.
  const message = JSON.stringify({ type: 'changed', months: [...new Set(months)] });
  // forEach : 배열(목록)의 항목을 하나씩 꺼내서 실행합니다.
  wss.clients.forEach(ws => {
    // readyState === 1 : 연결이 열려 있는 상태(OPEN)일 때만 보냅니다.
    // ws.authed : 연결할 때 토큰 검사를 통과한 기기만 보냅니다.
    if (ws.readyState === 1 && ws.authed) ws.send(message);
  });
}

// ─────────────────────────────────────────────────────────────
// 1단계) API 등록
// app.post / app.get / app.put / app.delete : 해당 주소로 요청이 오면 실행할 함수를 등록합니다.
// (req, res) => { } : 화살표 함수 문법입니다. req = 받은 요청, res = 돌려줄 응답입니다.
// ─────────────────────────────────────────────────────────────
function registerTodoRoutes(app) {

  // ── 로그인 : POST /todo-api/login  { password } → { token } ──
  app.post('/todo-api/login', (req, res) => {
    const ip = clientIp(req);
    const fail = loginFails.get(ip);

    // 잠금 시간이 아직 안 지났으면 비밀번호를 확인하지 않고 바로 거절합니다.
    // Date.now() : 현재 시각을 밀리초(1/1000초) 숫자로 돌려줍니다.
    if (fail && fail.until > Date.now()) {
      // Math.ceil() : 소수점을 올림합니다. 남은 시간을 분 단위로 보여주려고 사용합니다.
      const min = Math.ceil((fail.until - Date.now()) / 60000);
      return res.status(429).json({ error: `로그인을 너무 많이 실패했습니다. ${min}분 뒤에 다시 시도하세요.` });
    }

    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(PASSWORD_KEY);
    if (!row) {
      return res.status(503).json({ error: '할 일 비밀번호가 아직 설정되지 않았습니다. 서버 PC에서 set-todo-password.cmd 를 실행하세요.' });
    }

    // ?. : 앞의 값이 없으면(undefined) 오류 없이 undefined 를 돌려주는 문법입니다.
    const password = req.body?.password || '';
    if (!bcrypt.compareSync(password, row.value)) {
      // 틀린 횟수를 1 늘리고, 5번째면 잠금 시각을 정합니다.
      const count = (fail?.count || 0) + 1;
      loginFails.set(ip, { count, until: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
      return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });
    }

    // 로그인 성공 : 실패 기록을 지우고 새 토큰을 발급합니다.
    loginFails.delete(ip);
    // randomBytes(32) : 예측할 수 없는 무작위 32바이트를 만듭니다.
    // toString('hex') : 그 값을 64글자 16진수 문자열로 바꿉니다. (예: '9f3a…')
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO todo_tokens (token) VALUES (?)').run(token);
    res.json({ token });
  });

  // 아래 /todo-api 주소는 모두 토큰 검사(requireTodoAuth)를 먼저 통과해야 실행됩니다.
  // app.use('/todo-api', 함수) : 이 주소로 시작하는 모든 요청에 함수를 먼저 실행합니다.
  // 로그인 API 는 이 줄보다 위에 등록했기 때문에 토큰 없이도 호출할 수 있습니다.
  app.use('/todo-api', requireTodoAuth);

  // ── 로그아웃 : POST /todo-api/logout ──
  // 이 기기의 토큰을 DB 에서 지웁니다. 다른 기기의 로그인은 유지됩니다.
  app.post('/todo-api/logout', (req, res) => {
    db.prepare('DELETE FROM todo_tokens WHERE token = ?').run(tokenFromRequest(req));
    res.json({ ok: true });
  });

  // ── 월별 조회 : GET /todo-api/todos?month=2026-09 → [할 일, …] ──
  // req.query.month : 주소 뒤 ?month=2026-09 부분의 값입니다.
  app.get('/todo-api/todos', (req, res) => {
    const month = String(req.query.month || '');
    if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'month 는 YYYY-MM 형식이어야 합니다.' });

    // LIKE '2026-09-%' : '2026-09-' 로 시작하는 날짜를 모두 찾습니다. (% 는 "아무 글자나 0개 이상")
    // ORDER BY date, id : 날짜순, 같은 날짜 안에서는 먼저 추가한 순서대로 정렬합니다.
    const rows = db.prepare('SELECT * FROM todos WHERE date LIKE ? ORDER BY date ASC, id ASC').all(month + '-%');
    // map() : 배열의 항목을 하나씩 변환해서 새 배열을 만듭니다.
    res.json(rows.map(toTodo));
  });

  // ── 추가 : POST /todo-api/todos  { date, text, done? } → 추가된 할 일 ──
  // done 은 선택 항목입니다. "삭제 되돌리기"로 완료 상태까지 복원할 때 사용합니다.
  app.post('/todo-api/todos', (req, res) => {
    const date = String(req.body?.date || '');
    // trim() : 앞뒤 공백을 제거합니다.
    const text = String(req.body?.text || '').trim();
    if (!DATE_RE.test(date)) return res.status(400).json({ error: '날짜 형식이 올바르지 않습니다.' });
    if (!text)                return res.status(400).json({ error: '할 일 내용을 입력하세요.' });
    if (text.length > MAX_TEXT) return res.status(400).json({ error: `할 일은 ${MAX_TEXT}자까지 입력할 수 있습니다.` });

    const result = db.prepare('INSERT INTO todos (date, text, done) VALUES (?, ?, ?)')
      .run(date, text, req.body?.done ? 1 : 0);
    // lastInsertRowid : 방금 추가된 줄의 id 입니다.
    const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(Number(result.lastInsertRowid));

    broadcastChange(monthOf(date));
    res.json(toTodo(row));
  });

  // ── 수정 : PUT /todo-api/todos/:id  { text?, done?, date? } → 수정된 할 일 ──
  // :id : 주소의 이 자리에 오는 값을 req.params.id 로 꺼낼 수 있습니다. (예: /todo-api/todos/7 → '7')
  // 보낸 항목만 바꿉니다. 예) 체크박스는 { done: true } 만, 내용 수정은 { text: '…' } 만 보냅니다.
  app.put('/todo-api/todos/:id', (req, res) => {
    const old = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: '할 일을 찾을 수 없습니다. 다른 기기에서 삭제되었을 수 있습니다.' });

    // 보낸 값이 없으면(undefined) 기존 값을 그대로 씁니다.
    // !== undefined : "값이 들어왔는지" 확인합니다. false 나 빈 문자열도 "들어온 값"으로 구분하기 위해 사용합니다.
    const body = req.body || {};
    const text = body.text !== undefined ? String(body.text).trim() : old.text;
    const date = body.date !== undefined ? String(body.date) : old.date;
    const done = body.done !== undefined ? (body.done ? 1 : 0) : old.done;

    if (!DATE_RE.test(date)) return res.status(400).json({ error: '날짜 형식이 올바르지 않습니다.' });
    if (!text)                return res.status(400).json({ error: '할 일 내용을 입력하세요.' });
    if (text.length > MAX_TEXT) return res.status(400).json({ error: `할 일은 ${MAX_TEXT}자까지 입력할 수 있습니다.` });

    db.prepare(`UPDATE todos SET text = ?, date = ?, done = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(text, date, done, req.params.id);
    const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);

    // 날짜를 다른 달로 옮긴 경우 두 달 모두 알립니다.
    broadcastChange(monthOf(old.date), monthOf(date));
    res.json(toTodo(row));
  });

  // ── 삭제 : DELETE /todo-api/todos/:id ──
  app.delete('/todo-api/todos/:id', (req, res) => {
    const old = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    // 이미 없는 경우도 성공으로 처리합니다. (두 기기에서 동시에 지운 경우 오류를 보여줄 필요가 없음)
    if (!old) return res.json({ ok: true });

    db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
    broadcastChange(monthOf(old.date));
    res.json({ ok: true });
  });
}

// ─────────────────────────────────────────────────────────────
// 2단계) WebSocket 연결
// server : app.listen() 이 돌려준 HTTP 서버입니다. WebSocket 을 같은 3000번 포트에서 받으려고 넘겨받습니다.
// 기기는 ws://주소/todo-ws?token=토큰 (외부는 wss://) 으로 연결합니다.
// ─────────────────────────────────────────────────────────────
function attachTodoWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/todo-ws' });

  // 'connection' : 기기가 새로 연결될 때마다 실행됩니다.
  wss.on('connection', (ws, req) => {
    // 연결 주소에서 token 값을 꺼냅니다.
    // new URL() : 주소 문자열을 분석해 주는 기능입니다. searchParams.get('token') → ?token= 뒤의 값
    const url = new URL(req.url, 'http://localhost');
    if (!isValidToken(url.searchParams.get('token'))) {
      // 4401 : 이 앱에서 정한 "인증 실패" 종료 코드입니다. 기기는 이 코드를 받으면 로그인 화면으로 갑니다.
      ws.close(4401, 'unauthorized');
      return;
    }
    ws.authed = true;
    ws.isAlive = true;
    // pong : 서버가 보낸 ping 에 기기가 자동으로 답하는 신호입니다. 답이 오면 "아직 연결돼 있음"으로 표시합니다.
    ws.on('pong', () => { ws.isAlive = true; });
    // 기기가 보내는 'ping' 글자에 'pong' 으로 답합니다. (브라우저는 위의 자동 ping/pong 을 직접 쓸 수 없어서 따로 둡니다)
    ws.on('message', data => { if (String(data) === 'ping') ws.send('pong'); });
    ws.send(JSON.stringify({ type: 'hello' }));
  });

  // 30초마다 모든 연결에 ping 을 보냅니다.
  //   1) Cloudflare 터널은 오래 조용한 연결을 끊기 때문에, 주기적으로 신호를 보내 연결을 유지합니다.
  //   2) 지난 30초 동안 답이 없던 연결(와이파이가 끊긴 폰 등)은 정리합니다.
  // setInterval(함수, 시간) : 정해진 시간마다 함수를 반복 실행합니다. (안드로이드 Handler.postDelayed 반복과 비슷)
  const timer = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  wss.on('close', () => clearInterval(timer));
}

// module.exports : 이 파일 밖(server.js)에서 쓸 수 있게 내보낼 함수들입니다.
module.exports = { registerTodoRoutes, attachTodoWebSocket };
