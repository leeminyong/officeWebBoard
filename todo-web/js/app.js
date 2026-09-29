// ─────────────────────────────────────────────────────────────
// app.js : [MVVM - View] state 를 보고 화면을 그리고, 버튼 클릭을 store(ViewModel) 함수로 전달합니다.
//          안드로이드의 Activity/Fragment 에서 observe { } 로 화면을 갱신하고
//          setOnClickListener { viewModel.xxx() } 를 연결하는 부분에 해당합니다.
//
// 동작 순서
//   1단계) subscribe(render) : state 가 바뀔 때마다 render() 가 실행되도록 등록
//   2단계) render() : state 를 보고 달력, 목록, 팝업 등을 다시 그림
//   3단계) 사용자가 버튼을 누르면 → 클릭 처리에서 store 의 함수 호출 → state 변경 → 2단계 반복
// ─────────────────────────────────────────────────────────────
import * as store from './store.js';
import { WEEK, keyOf, parseKey, todayKey, dateLabel } from './date.js';

// document.getElementById('x') : HTML 에서 id="x" 인 요소를 찾습니다. (findViewById 와 같습니다)
const $ = id => document.getElementById(id);

// 사용자가 입력한 글자를 화면에 넣기 전에 HTML 특수문자를 바꿉니다.
// 이렇게 하지 않으면 할 일 내용에 <script> 같은 글자를 넣었을 때 코드로 실행될 수 있습니다.
// replace(/[&<>"']/g, …) : 해당 글자를 모두(g) 찾아서 안전한 표기로 바꿉니다.
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── 아이콘 (SVG = 선으로 그리는 이미지 문법) ──
const ICON = {
  check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  pencil: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>',
  trash: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg>',
};

// ─────────────────────────────────────────────────────────────
// 화면 그리기
// ─────────────────────────────────────────────────────────────
let wasSheetOpen = false;
let lastEditingId = null;

function render(s) {
  // 로그인 여부에 따라 로그인 화면 / 메인 화면 중 하나만 보여줍니다.
  $('loginView').hidden = s.authed;
  $('mainView').hidden = !s.authed;
  renderLogin(s);
  if (!s.authed) return;

  renderConn(s);
  renderCalendar(s);
  renderMonthList(s);
  renderPill(s);
  renderSheet(s);
  renderSnack(s);
  $('toast').hidden = !s.toast;
  $('toast').textContent = s.toast;
}

function renderLogin(s) {
  $('loginError').hidden = !s.loginError;
  $('loginError').textContent = s.loginError;
  $('loginBtn').disabled = s.loginBusy;
  $('loginBtn').textContent = s.loginBusy ? '확인 중…' : '로그인';
}

// 상단 실시간 연결 상태 표시
function renderConn(s) {
  const text = { online: '실시간 연결됨', connecting: '연결 중…', offline: '연결 끊김 · 다시 연결 중' }[s.conn];
  $('connStatus').textContent = text;
  // className : 요소의 CSS 클래스를 통째로 바꿉니다. 상태별로 점 색이 달라집니다. (style.css 의 .conn.online 등)
  $('connStatus').className = 'conn ' + s.conn;
}

// 달력 칸 그리기
function renderCalendar(s) {
  const y = s.viewY, m = s.viewM;
  $('monthTitle').textContent = `${y}년 ${m + 1}월`;

  const first = new Date(y, m, 1).getDay();          // 1일이 무슨 요일인지 (0 = 일요일)
  const days = new Date(y, m + 1, 0).getDate();      // 이 달이 며칠까지 있는지 (다음 달 0일 = 이번 달 마지막 날)
  const total = Math.ceil((first + days) / 7) * 7;   // 필요한 칸 수 (7의 배수로 올림)
  const today = todayKey();

  // 할 일이 있는 날짜 목록 (달력 점 표시용). Compose 의 derivedStateOf 로 계산하던 값입니다.
  const hasTodo = new Set(s.todos.map(t => t.date));

  let html = '';
  // for (시작; 조건; 증가) : 조건이 참인 동안 반복합니다.
  for (let i = 0; i < total; i++) {
    const d = i - first + 1;
    if (d < 1 || d > days) { html += '<span class="cell-empty"></span>'; continue; }   // 달력 앞뒤 빈칸
    const k = keyOf(y, m, d);
    const col = i % 7;   // % : 나머지 연산. 0 이면 일요일 열, 6 이면 토요일 열
    // 배열에 클래스 이름을 모은 뒤 join(' ') 으로 공백을 넣어 이어 붙입니다.
    const cls = ['day'];
    if (k === s.sel) cls.push('sel');
    else if (k === today) cls.push('today');
    if (col === 0) cls.push('sun');
    if (col === 6) cls.push('sat');
    const label = `${m + 1}월 ${d}일${k === today ? ', 오늘' : ''}${hasTodo.has(k) ? ', 할 일 있음' : ''}`;
    html += `<button type="button" class="${cls.join(' ')}" data-act="select" data-date="${k}" aria-label="${label}">`
          + `<span class="num">${d}</span><span class="dot${hasTodo.has(k) ? ' on' : ''}"></span></button>`;
  }
  // innerHTML : 요소 안의 내용을 HTML 문자열로 통째로 바꿉니다.
  $('calGrid').innerHTML = html;
}

// 할 일 한 줄 (메인 목록과 팝업 목록에서 같이 사용)
// inSheet : 팝업 안이면 true → 연필 버튼을 보여주고, 글자를 누르면 팝업 안에서 바로 수정 모드가 됩니다.
function itemHtml(t, inSheet, editingId) {
  const editing = inSheet && t.id === editingId;
  return `
    <div class="item${editing ? ' editing' : ''}">
      <button type="button" class="check${t.done ? ' done' : ''}" data-act="toggle" data-id="${t.id}"
              aria-pressed="${t.done}" aria-label="${esc(t.text)} ${t.done ? '완료 취소' : '완료 표시'}">
        <span class="box">${t.done ? ICON.check : ''}</span>
      </button>
      <button type="button" class="item-text${t.done ? ' done' : ''}" data-act="${inSheet ? 'editInSheet' : 'editFromList'}" data-id="${t.id}">${esc(t.text)}</button>
      ${inSheet ? `<button type="button" class="icon-btn" data-act="editInSheet" data-id="${t.id}" aria-label="${esc(t.text)} 수정">${ICON.pencil}</button>` : ''}
      <button type="button" class="icon-btn del" data-act="remove" data-id="${t.id}" aria-label="${esc(t.text)} 삭제">${ICON.trash}</button>
    </div>`;
}

// 이번 달 할 일 목록 (날짜별로 묶어서)
function renderMonthList(s) {
  if (s.loading) {
    $('monthList').innerHTML = '<div class="empty">불러오는 중…</div>';
    return;
  }
  if (s.todos.length === 0) {
    $('monthList').innerHTML = '<div class="empty"><strong>이번 달에는 할 일이 없어요</strong><span>날짜를 고르고 아래 추가 버튼을 눌러보세요</span></div>';
    return;
  }

  // 같은 날짜끼리 묶습니다. (todos 는 이미 날짜순으로 정렬되어 있음)
  const groups = [];
  s.todos.forEach(t => {
    const last = groups[groups.length - 1];
    if (last && last.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  });

  const today = todayKey();
  $('monthList').innerHTML = groups.map(g => {
    const d = parseKey(g.date);
    const cls = g.date === s.sel ? ' sel' : d.getDay() === 0 ? ' sun' : '';
    return `
      <section class="group">
        <button type="button" class="group-head" data-act="openDate" data-date="${g.date}" aria-label="${dateLabel(g.date)} 할 일 열기">
          <span class="group-day${cls}">${d.getDate()}일 ${WEEK[d.getDay()]}요일</span>
          ${g.date === today ? '<span class="badge">오늘</span>' : ''}
          <span class="group-line"></span>
          <span class="group-count">${g.items.length}개</span>
        </button>
        ${g.items.map(t => itemHtml(t, false)).join('')}
      </section>`;
  }).join('');
}

// 하단 "○월 ○일에 추가 +" 버튼
function renderPill(s) {
  const d = parseKey(s.sel);
  $('pillText').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일에 추가`;
  $('addPill').setAttribute('aria-label', `${dateLabel(s.sel)}에 할 일 추가`);
}

// 날짜 팝업
function renderSheet(s) {
  $('sheet').hidden = !s.sheetOpen;
  if (!s.sheetOpen) { wasSheetOpen = false; return; }

  const list = store.todosOf(s.sel);
  const editing = s.editingId !== null;

  $('sheetDate').textContent = dateLabel(s.sel) + (s.sel === todayKey() ? ' · 오늘' : '');
  $('sheetCount').textContent = list.length ? `할 일 ${list.length}개` : '할 일';
  $('sheetList').innerHTML = list.length
    ? list.map(t => itemHtml(t, true, s.editingId)).join('')
    : '<div class="sheet-empty">아직 할 일이 없어요. 아래에 입력해 보세요.</div>';

  $('inputLabel').textContent = editing ? '할 일 수정 중' : '새 할 일 추가';
  // classList.toggle('이름', 조건) : 조건이 참이면 클래스를 붙이고, 거짓이면 뗍니다.
  $('inputLabel').classList.toggle('editing', editing);
  $('cancelEditBtn').hidden = !editing;
  $('saveBtn').textContent = s.saving ? '저장 중…' : editing ? '수정 완료' : '추가';
  $('saveBtn').disabled = !s.draft.trim() || s.saving;

  // 입력칸은 state.draft 와 다를 때만 값을 넣습니다.
  // 사용자가 직접 치고 있을 때는 이미 같은 값이라 건드리지 않아서, 한글 조합(ㅎ→하→한)이 끊기지 않습니다.
  const memo = $('memo');
  if (memo.value !== s.draft) memo.value = s.draft;

  // 팝업이 막 열렸을 때, 또는 수정할 항목을 새로 골랐을 때 입력칸에 커서를 둡니다.
  // (마우스가 있는 PC에서만. 폰에서는 키보드가 갑자기 올라와 목록을 가리지 않게 합니다)
  // matchMedia('(pointer: fine)') : 마우스처럼 정밀한 입력 장치가 있는지 확인합니다.
  const justOpened = !wasSheetOpen;
  const editChanged = s.editingId !== lastEditingId && editing;
  if ((justOpened || editChanged) && matchMedia('(pointer: fine)').matches) {
    memo.focus();
    // 커서를 글 끝으로 옮깁니다.
    memo.setSelectionRange(memo.value.length, memo.value.length);
  }
  wasSheetOpen = true;
  lastEditingId = s.editingId;
}

function renderSnack(s) {
  $('snack').hidden = !s.snack;
  if (s.snack) $('snackText').textContent = `‘${s.snack.todo.text}’ 삭제됨`;
  // 팝업이 열려 있으면 알림을 화면 위쪽에 보여서 입력칸을 가리지 않게 합니다.
  $('snack').classList.toggle('top', s.sheetOpen);
}

// ─────────────────────────────────────────────────────────────
// 사용자 입력 연결
// ─────────────────────────────────────────────────────────────
// 버튼마다 클릭 함수를 따로 붙이지 않고, 화면 전체에 클릭 함수 하나만 붙입니다.
// 목록은 매번 다시 그려지기 때문에, 이 방식이 버튼을 새로 만들 때마다 다시 연결할 필요가 없어 간단합니다.
// closest('[data-act]') : 누른 곳에서 위로 올라가며 data-act 가 붙은 가장 가까운 요소를 찾습니다.
//                          (아이콘 그림을 눌러도 그 그림을 감싼 버튼을 찾아줍니다)
$('app').addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  // dataset.id : HTML 의 data-id 값입니다. Number() 로 숫자로 바꿉니다.
  const id = el.dataset.id ? Number(el.dataset.id) : null;
  const date = el.dataset.date;

  // switch : 값에 따라 실행할 코드를 고릅니다. (Kotlin 의 when 과 같습니다)
  switch (el.dataset.act) {
    case 'prev':         store.shiftMonth(-1); break;
    case 'next':         store.shiftMonth(1); break;
    case 'today':        store.goToday(); break;
    case 'select':       store.selectDate(date); break;
    case 'openSel':      store.openSheet(); break;
    case 'openDate':     store.openSheet(date); break;
    // 메인 목록에서 글자를 누르면: 그 날짜 팝업을 그 항목 수정 모드로 엽니다.
    case 'editFromList': {
      const t = store.state.todos.find(x => x.id === id);
      if (t) store.openSheet(t.date, t);
      break;
    }
    case 'editInSheet':  store.startEdit(id); break;
    case 'cancelEdit':   store.cancelEdit(); break;
    case 'save':         store.save(); break;
    case 'toggle':       store.toggle(id); break;
    case 'remove':       store.remove(id); break;
    case 'undo':         store.undo(); break;
    case 'closeSheet':   store.closeSheet(); break;
    case 'logout':       store.logout(); break;
  }
});

// 입력칸에 글자를 칠 때마다 state.draft 에 반영합니다. (Compose TextField 의 onValueChange = { draft = it })
$('memo').addEventListener('input', e => store.setDraft(e.target.value));

// Enter : 저장, Shift+Enter : 줄바꿈
// isComposing : 한글 조합 중이면 true. 조합 중 Enter 는 글자 확정용이라 저장하지 않습니다.
$('memo').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();   // preventDefault() : 원래 동작(줄바꿈)을 막습니다.
    store.save();
  }
});

// Esc 키로 팝업 닫기
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && store.state.sheetOpen) store.closeSheet();
});

// 로그인 폼 제출
$('loginForm').addEventListener('submit', e => {
  e.preventDefault();   // 폼의 기본 동작(페이지 새로고침)을 막습니다.
  store.login($('loginPw').value);
  $('loginPw').value = '';
});

// 다른 탭/앱을 보다가 돌아왔을 때, 인터넷이 다시 연결됐을 때 최신 목록을 불러옵니다.
// visibilitychange : 탭이 보이거나 숨겨질 때 발생합니다. (Activity 의 onResume 과 비슷)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') store.refreshOnReturn();
});
window.addEventListener('online', () => store.refreshOnReturn());

// ── 시작 ──
store.subscribe(render);
store.init();
