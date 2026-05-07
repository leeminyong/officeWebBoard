/**
 * 이 파일은 게시판 공통 규칙을 모아둔 파일입니다.
 * 게시판 이름, 게시판 주소, 왼쪽 메뉴 선택 표시, 상단 제목 클릭 이동을 처리합니다.
 */
// JavaScript 주석 문법: 한 줄 설명은 이렇게 // 로 적고, 브라우저 화면에는 보이지 않습니다.
// 게시판 이름과 주소 규칙을 한 파일에 모아둡니다. 여러 화면에서 같은 규칙을 쓰기 위해 분리했습니다.
export const boardMeta = {
  project: '프로젝트',
  maintenance: '유지보수',
  'app-version': '앱 버전관리',
  files: '파일',
};

// 주소의 ?board= 값을 읽어 현재 게시판을 정합니다. 잘못된 값이면 기본 게시판인 프로젝트로 보냅니다.
export function getCurrentBoard() {
  const params = new URLSearchParams(location.search);
  const board = params.get('board');
  return boardMeta[board] ? board : 'project';
}

// 프로젝트 게시판은 주소가 / 이고, 다른 게시판은 ?board=이름을 붙여 이동합니다.
export function boardUrl(board) {
  return board === 'project' ? '/' : `/?board=${board}`;
}

// 글쓰기 화면으로 갈 때 현재 게시판 정보를 주소에 붙일지 결정합니다.
export function boardQuery(board) {
  return board === 'project' ? '' : `?board=${board}`;
}

// 왼쪽 메뉴에서 현재 게시판만 파란색 active 상태로 보이게 합니다.
export function updateBoardLinks(currentBoard) {
  document.querySelectorAll('[data-board-link]').forEach(link => {
    link.classList.toggle('active', link.dataset.boardLink === currentBoard);
  });
}

// 상단 게시판 제목을 누르면 목록 첫 화면으로 이동하게 합니다. HTML의 onclick을 줄이고 JavaScript 모듈에서 처리하려고 분리했습니다.
export function setupHomeLink() {
  const homeLink = document.querySelector('[data-home-link]');
  if (homeLink) homeLink.addEventListener('click', () => location.href = '/');
}
