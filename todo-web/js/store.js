// ─────────────────────────────────────────────────────────────
// store.js : [MVVM - ViewModel] 화면 상태(state)와 사용자 동작(함수)을 모아 둔 파일입니다.
//            안드로이드의 ViewModel 클래스와 같은 역할입니다.
//
//   - state      : 화면에 보여줄 모든 값 (ViewModel 의 LiveData 필드들에 해당)
//   - subscribe  : state 가 바뀔 때마다 실행할 함수를 등록 (LiveData.observe() 에 해당)
//   - 나머지 함수 : 버튼을 눌렀을 때 실행되는 동작 (ViewModel 의 public 함수들에 해당)
//
// 화면(app.js)은 state 를 읽어서 그리기만 하고, 값을 직접 바꾸지 않습니다.
// 값을 바꿀 때는 반드시 이 파일의 함수를 호출합니다. → 상태를 바꾸는 곳이 한 곳이라 추적이 쉽습니다.
// ─────────────────────────────────────────────────────────────
import * as api from './api.js';
import { keyOf, monthKey, parseKey, todayKey } from './date.js';

const now = new Date();

// ── 화면 상태 ──
// const : 다시 대입할 수 없는 변수입니다. (Kotlin 의 val) 단, 객체 안의 값은 바꿀 수 있습니다.
export const state = {
  authed: !!api.getToken(),   // 로그인 여부. !! 는 값을 true/false 로 바꾸는 문법 (토큰이 있으면 true)
  loginBusy: false,           // 로그인 요청 중이면 true (버튼 중복 클릭 방지)
  loginError: '',

  viewY: now.getFullYear(),   // 달력에 보이는 연도
  viewM: now.getMonth(),      // 달력에 보이는 월 (0 = 1월)
  sel: todayKey(),            // 선택한 날짜 'YYYY-MM-DD'
  todos: [],                  // 지금 보이는 달의 할 일 목록 (서버에서 받아 옴)
  loading: false,             // 목록을 처음 불러오는 중이면 true

  sheetOpen: false,           // 날짜 팝업이 열려 있는지
  editingId: null,            // 팝업에서 수정 중인 할 일 id. null 이면 "새로 추가" 모드
  draft: '',                  // 팝업 입력칸의 글자
  saving: false,              // 저장 요청 중이면 true (추가 버튼 중복 클릭 방지)

  snack: null,                // 방금 삭제한 할 일 { todo } → "되돌리기" 알림에 사용
  toast: '',                  // 오류 안내 문구
  conn: 'offline',            // 실시간 연결 상태: 'connecting' | 'online' | 'offline'
};

// ── 상태 변경 알림 (LiveData 와 같은 구조) ──
// Set : 중복 없이 값을 모아 두는 자료구조입니다.
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
}

// state 의 일부만 바꾸고, 등록된 화면 함수들을 다시 실행합니다.
// Object.assign(대상, 바꿀값) : 대상 객체에 바꿀값의 항목들을 덮어씁니다. (Kotlin data class 의 copy() 와 비슷한 용도)
function set(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

// ── 내부 도우미 ──
const currentMonth = () => monthKey(state.viewY, state.viewM);

// 날짜순 → 같은 날짜는 먼저 추가한 순(id 작은 순)으로 정렬합니다.
// sort((a, b) => …) : 음수를 돌려주면 a 가 앞, 양수면 b 가 앞입니다.
// localeCompare() : 문자열 크기 비교. 'YYYY-MM-DD' 형식이라 글자 비교만으로 날짜 순서가 맞습니다.
function sorted(list) {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

// 서버가 돌려준 할 일 하나를 현재 목록에 반영합니다. (있으면 교체, 없으면 추가, 다른 달로 갔으면 제거)
// filter() : 조건에 맞는 항목만 남긴 새 배열을 만듭니다.
function upsertLocal(todo) {
  const rest = state.todos.filter(t => t.id !== todo.id);
  const inMonth = todo.date.startsWith(currentMonth());
  set({ todos: sorted(inMonth ? [...rest, todo] : rest) });
}

// 화면 하단에 오류 문구를 3초 동안 보여줍니다.
let toastTimer = null;
function showToast(message) {
  clearTimeout(toastTimer);
  set({ toast: message });
  toastTimer = setTimeout(() => set({ toast: '' }), 3000);
}

// 모든 API 오류는 여기서 처리합니다.
// instanceof : 오류의 종류를 확인합니다. 로그인이 풀린 오류면 로그인 화면으로, 나머지는 안내 문구만 보여줍니다.
function handleError(e) {
  if (e instanceof api.AuthError) {
    signOutLocal('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  } else {
    showToast(e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 로그인 / 로그아웃 / 실시간 연결
// ─────────────────────────────────────────────────────────────
let live = null;   // connectLive() 가 돌려준 조작 객체

// 로그인된 상태에서 시작할 때 호출합니다: 이번 달 목록 불러오기 + 실시간 연결
function startSession() {
  set({ loading: true });   // 첫 목록이 오기 전에 "할 일이 없어요"가 잠깐 보이지 않게 로딩 상태로 시작
  loadMonth();
  live = api.connectLive({
    onStatus: conn => set({ conn }),
    // months 가 null 이면 "무조건 새로 불러오기", 배열이면 지금 보는 달이 포함됐을 때만 새로 불러옵니다.
    // includes() : 배열에 값이 들어 있는지 확인합니다. (Kotlin 의 contains())
    onChange: months => {
      if (!months || months.includes(currentMonth())) loadMonth();
    },
    onAuthFail: () => signOutLocal('로그인이 만료되었습니다. 다시 로그인해 주세요.'),
  });
}

// 이 기기의 로그인 정보를 지우고 로그인 화면으로 돌아갑니다.
function signOutLocal(message = '') {
  if (live) { live.close(); live = null; }
  api.setToken('');
  set({ authed: false, loginError: message, todos: [], sheetOpen: false, editingId: null, draft: '', snack: null, conn: 'offline' });
}

export function init() {
  if (state.authed) startSession();
}

export async function login(password) {
  if (state.loginBusy) return;
  set({ loginBusy: true, loginError: '' });
  try {
    const { token } = await api.login(password);   // { token } : 응답 객체에서 token 항목만 꺼내는 문법 (구조 분해)
    api.setToken(token);
    set({ authed: true, loginBusy: false });
    startSession();
  } catch (e) {
    set({ loginBusy: false, loginError: e.message });
  }
}

export async function logout() {
  // 서버의 토큰도 지웁니다. 실패해도(서버 꺼짐 등) 이 기기에서는 로그아웃합니다.
  try { await api.logout(); } catch { /* 무시 */ }
  signOutLocal('');
}

// 다른 앱을 보다가 이 탭으로 돌아왔을 때 / 인터넷이 다시 연결됐을 때 호출합니다.
export function refreshOnReturn() {
  if (!state.authed) return;
  if (live) live.reconnectNow();
  loadMonth();
}

// ─────────────────────────────────────────────────────────────
// 목록 불러오기
// ─────────────────────────────────────────────────────────────
// 달을 빠르게 넘기면 요청이 여러 개 동시에 나갈 수 있습니다.
// 늦게 도착한 옛날 달의 응답이 화면을 덮어쓰지 않도록, 가장 마지막 요청의 응답만 사용합니다.
// (코루틴에서 이전 Job 을 cancel 하고 새로 launch 하는 것과 같은 목적)
let loadSeq = 0;

export async function loadMonth() {
  const month = currentMonth();
  const seq = ++loadSeq;   // ++변수 : 1 증가시킨 뒤 그 값을 사용
  try {
    const list = await api.fetchMonth(month);
    if (seq !== loadSeq) return;
    set({ todos: sorted(list), loading: false });
  } catch (e) {
    if (seq === loadSeq) set({ loading: false });
    handleError(e);
  }
}

// ─────────────────────────────────────────────────────────────
// 달력
// ─────────────────────────────────────────────────────────────
// 달을 이동하면, 오늘이 그 달이면 오늘을, 아니면 1일을 선택합니다.
// (선택 날짜가 화면에 안 보이는 달에 남아 있으면 하단 "○월 ○일에 추가" 버튼이 헷갈리기 때문)
function moveTo(y, m) {
  const t = todayKey();
  const sel = t.startsWith(monthKey(y, m)) ? t : keyOf(y, m, 1);
  set({ viewY: y, viewM: m, sel, todos: [], loading: true });
  loadMonth();
}

export function shiftMonth(delta) {
  // new Date(연, 월 + delta, 1) : 12월 + 1 처럼 범위를 넘으면 자동으로 다음 해 1월로 계산됩니다.
  const d = new Date(state.viewY, state.viewM + delta, 1);
  moveTo(d.getFullYear(), d.getMonth());
}

export function goToday() {
  const n = new Date();
  if (n.getFullYear() === state.viewY && n.getMonth() === state.viewM) set({ sel: todayKey() });
  else moveTo(n.getFullYear(), n.getMonth());
}

export function selectDate(date) {
  set({ sel: date });
}

// ─────────────────────────────────────────────────────────────
// 날짜 팝업 (추가 · 편집 · 삭제)
// ─────────────────────────────────────────────────────────────
// date 날짜의 팝업을 엽니다. editTodo 를 주면 그 할 일을 수정 모드로 엽니다.
export function openSheet(date = state.sel, editTodo = null) {
  set({
    sel: date,
    sheetOpen: true,
    editingId: editTodo ? editTodo.id : null,
    draft: editTodo ? editTodo.text : '',
  });
}

export function closeSheet() {
  set({ sheetOpen: false, editingId: null, draft: '' });
}

export function startEdit(id) {
  // find() : 조건에 맞는 첫 항목을 찾습니다. 없으면 undefined
  const t = state.todos.find(x => x.id === id);
  if (t) set({ editingId: t.id, draft: t.text });
}

export function cancelEdit() {
  set({ editingId: null, draft: '' });
}

// 입력칸에 글자를 칠 때마다 호출됩니다. (TextField 의 onValueChange 와 같은 역할)
export function setDraft(value) {
  set({ draft: value });
}

// 추가 또는 수정 저장. 저장 후에도 팝업은 열어 둬서 연달아 입력할 수 있습니다.
export async function save() {
  const text = state.draft.trim();
  if (!text || state.saving) return;
  set({ saving: true });
  try {
    if (state.editingId !== null) {
      const todo = await api.updateTodo(state.editingId, { text });
      upsertLocal(todo);
      set({ editingId: null, draft: '' });
    } else {
      const todo = await api.createTodo({ date: state.sel, text });
      upsertLocal(todo);
      set({ draft: '' });
    }
  } catch (e) {
    handleError(e);
  } finally {
    // finally : 성공하든 실패하든 마지막에 항상 실행됩니다.
    set({ saving: false });
  }
}

// 완료 체크 / 해제
// 화면을 먼저 바꾸고(빠른 반응) 서버에 저장합니다. 저장에 실패하면 원래대로 되돌립니다.
export async function toggle(id) {
  const t = state.todos.find(x => x.id === id);
  if (!t) return;
  // { ...t, done: !t.done } : t 를 복사하면서 done 만 반대로 바꾼 새 객체 (Kotlin 의 t.copy(done = !t.done))
  upsertLocal({ ...t, done: !t.done });
  try {
    upsertLocal(await api.updateTodo(id, { done: !t.done }));
  } catch (e) {
    upsertLocal(t);
    handleError(e);
  }
}

// 삭제 + 4초 동안 "되돌리기" 알림
let snackTimer = null;

export async function remove(id) {
  const t = state.todos.find(x => x.id === id);
  if (!t) return;
  const patch = { todos: state.todos.filter(x => x.id !== id), snack: { todo: t } };
  // 수정 중이던 항목을 지우면 입력칸도 비웁니다.
  if (state.editingId === id) Object.assign(patch, { editingId: null, draft: '' });
  set(patch);

  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => set({ snack: null }), 4000);

  try {
    await api.deleteTodo(id);
  } catch (e) {
    upsertLocal(t);
    set({ snack: null });
    handleError(e);
  }
}

// 되돌리기 : 지운 할 일을 같은 날짜, 같은 내용, 같은 완료 상태로 다시 추가합니다.
export async function undo() {
  if (!state.snack) return;
  const { todo } = state.snack;
  clearTimeout(snackTimer);
  set({ snack: null });
  try {
    upsertLocal(await api.createTodo({ date: todo.date, text: todo.text, done: todo.done }));
  } catch (e) {
    handleError(e);
  }
}

// 선택한 날짜의 할 일만 골라서 돌려줍니다. (팝업 목록에 사용)
export function todosOf(date) {
  return state.todos.filter(t => t.date === date);
}

// parseKey 를 화면 쪽에서도 쓸 수 있게 다시 내보냅니다.
export { parseKey };
