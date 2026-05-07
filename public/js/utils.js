/**
 * 이 파일은 여러 화면에서 같이 쓰는 작은 도구 함수들을 모아둔 파일입니다.
 * 알림 메시지, 파일 크기 표시, 이미지 파일 확인, 안전한 글자 변환 같은 공통 기능이 들어 있습니다.
 */
// JavaScript 주석 문법: // 는 한 줄 주석이고, 아래 함수들이 무슨 일을 하는지 설명할 때 사용합니다.
// HTML 특수문자를 안전한 글자로 바꿉니다. 사용자가 입력한 제목이나 파일명이 HTML 코드처럼 실행되지 않게 막습니다.
export function escHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 오른쪽 아래에 잠깐 나타나는 알림 메시지를 만듭니다. 실패 알림이면 빨간색 스타일을 붙입니다.
export function showToast(message, isError = false) {
  const wrap = document.getElementById('toastWrap');
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// 파일 크기를 사람이 읽기 쉬운 B, KB, MB 단위로 바꿉니다.
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// 파일 이름의 확장자를 보고 이미지인지 확인합니다. 이미지면 미리보기 칸에 그림으로 보여줍니다.
export function isImage(name) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
}

// 서버의 다운로드 주소를 임시 링크로 만들어 클릭합니다. 사용자는 버튼만 눌러도 파일을 받을 수 있습니다.
export function downloadFromUrl(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}
