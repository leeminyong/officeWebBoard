// ─────────────────────────────────────────────────────────────
// set-todo-password.js : 할 일 앱 전용 비밀번호를 설정(또는 변경)합니다.
//
// 실행 방법 : 프로젝트 폴더의 set-todo-password.cmd 를 더블클릭합니다.
//
// 동작 순서
//   1단계) 새 비밀번호를 두 번 입력받습니다. (입력하는 글자는 * 로 가려집니다)
//   2단계) bcrypt 해시로 바꿔서 settings 테이블에 저장합니다. (DB 를 열어 봐도 원래 비밀번호를 알 수 없음)
//   3단계) 기존에 로그인해 둔 기기의 토큰을 모두 지웁니다. → 모든 기기에서 새 비밀번호로 다시 로그인해야 합니다.
//
// 서버가 켜져 있어도 실행할 수 있습니다. 서버는 로그인할 때마다 DB 에서 해시를 새로 읽기 때문에 재시작이 필요 없습니다.
// ─────────────────────────────────────────────────────────────
const readline = require('readline');   // Node 내장 기능. 콘솔(명령 프롬프트)에서 글자를 입력받습니다.
const bcrypt   = require('bcryptjs');
const db       = require('./db/database');

// 입력한 글자를 화면에 그대로 보여주지 않고 * 로 바꿔 보여주는 입력 함수입니다.
// Promise : "나중에 결과가 오는 작업"을 나타냅니다. await 로 결과가 올 때까지 기다릴 수 있습니다.
//           (Kotlin 코루틴의 suspend 함수와 비슷합니다)
function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let asked = false;
    // _writeToOutput : readline 이 화면에 글자를 쓸 때 부르는 내부 함수입니다.
    // 질문 문장은 그대로 쓰고, 그 뒤에 입력하는 글자는 * 로 바꿔서 씁니다.
    rl._writeToOutput = str => {
      if (!asked) { rl.output.write(str); return; }
      // replace(/[^\r\n]/g, '*') : 줄바꿈이 아닌 모든 글자를 * 로 바꿉니다.
      rl.output.write(str.replace(/[^\r\n]/g, '*'));
    };
    rl.question(question, answer => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    asked = true;
  });
}

// async function : 안에서 await 를 쓸 수 있는 함수입니다.
async function main() {
  console.log('=== 할 일 앱 비밀번호 설정 ===');
  console.log('게시판 비밀번호와 별개인, 할 일 앱(웹 /todo, 안드로이드 앱) 전용 비밀번호입니다.\n');

  const pw1 = await askHidden('새 비밀번호 (6자 이상): ');
  if (pw1.length < 6) {
    console.log('\n비밀번호는 6자 이상이어야 합니다. 다시 실행해 주세요.');
    return;
  }
  const pw2 = await askHidden('새 비밀번호 확인: ');
  if (pw1 !== pw2) {
    console.log('\n두 번 입력한 비밀번호가 다릅니다. 다시 실행해 주세요.');
    return;
  }

  const hash = bcrypt.hashSync(pw1, 10);
  // INSERT … ON CONFLICT(key) DO UPDATE : 이미 저장된 값이 있으면 새 값으로 바꾸고, 없으면 새로 넣습니다.
  db.prepare(`
    INSERT INTO settings (key, value) VALUES ('todo_password_hash', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(hash);

  // 이전 비밀번호로 로그인해 둔 기기를 모두 로그아웃시킵니다.
  const removed = db.prepare('DELETE FROM todo_tokens').run().changes;

  console.log('\n비밀번호를 저장했습니다.');
  if (removed > 0) console.log(`기존에 로그인한 기기 ${removed}대를 로그아웃했습니다. 새 비밀번호로 다시 로그인하세요.`);
}

main();
