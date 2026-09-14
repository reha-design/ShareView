// 다국어 지원 (한국어 기본, 영어 선택 가능)
const translations = {
  ko: {
    sidebarHideToggle: '전체화면 시 사이드바 숨기기',
    langLabel: '언어',
    myConnection: '내 연결',
    setBtn: '설정',
    placeholderMyId: '내 ID 입력 (선택)',
    idNotSet: '미설정',
    idChanging: '변경 중...',
    idError: 'ID 오류',
    hostControls: '호스트 설정',
    startSharingBtn: '화면 공유 시작 (오디오 포함)',
    stopSharingBtn: '화면 공유 중지',
    joinSession: '세션 참가',
    placeholderHostId: '호스트 ID 입력',
    connectBtn: '연결',
    availableHosts: '접속 가능한 호스트',
    noHostsFound: '공유 중인 호스트가 없습니다',
    clickToConnect: '클릭하여 연결',
    participants: '참가자',
    waitingConnections: '연결 대기 중...',
    chat: '채팅',
    dropMessage: '📂 파일을 놓아 공유하기',
    noMessagesYet: '메시지가 없습니다',
    placeholderChat: '메시지를 입력하세요...',
    sendBtn: '전송',
    readyToConnect: '연결 준비 완료',
    readyToConnectDesc: 'ID를 설정하고 공유를 시작하거나, 호스트에 연결하세요.',
    exitFullscreen: '❌ 전체화면 종료',
    fullscreenBtn: '⛶ 전체화면',

    confirmChangeId: '이미 ID가 설정되어 있습니다. 새로운 ID로 변경하시겠습니까?',
    idSetComplete: 'ID 설정 완료: {id}',
    idUnavailable: '이미 사용 중인 ID입니다. 다른 ID를 입력해주세요.',
    peerErrorGeneric: '연결 에러 발생: {type}',
    displayMediaUnsupported: '화면 공유 기능을 사용할 수 없습니다.\n\n원인: 보안 컨텍스트(HTTPS 또는 localhost)가 아닐 가능성이 높습니다.\n해결: http://localhost:3000 으로 접속했는지 확인해주세요.',
    enterFriendId: '친구의 ID를 입력해주세요.',
    callFailed: '연결 시도에 실패했습니다. PeerJS 상태를 확인해주세요.',
    callError: '연결 중 오류가 발생했습니다.',
    fullscreenFailed: '전체화면 모드 전환 실패: {msg}',
    welcomeMessage: '세션에 오신 것을 환영합니다!',
    sendingFile: '파일 전송 중: {name} ({size})...',
    fileSentSuccess: '파일 전송 완료.',
    fileTooLarge: '파일이 너무 큽니다. 최대 {max}까지 전송할 수 있습니다.',
    startedSharingFile: '파일 공유 시작: <strong>{name}</strong>',
    downloadLink: '💾 {name} 다운로드',
    sharedFile: '파일을 공유했습니다:<br>{link}',
    senderSystem: '시스템',
    senderMe: '나'
  },
  en: {
    sidebarHideToggle: 'Hide sidebar on fullscreen',
    langLabel: 'Language',
    myConnection: 'My Connection',
    setBtn: 'Set',
    placeholderMyId: 'Enter My ID (Optional)',
    idNotSet: 'Not Set',
    idChanging: 'Changing...',
    idError: 'ID Error',
    hostControls: 'Host Controls',
    startSharingBtn: 'Start Sharing (with Audio)',
    stopSharingBtn: 'Stop Sharing',
    joinSession: 'Join Session',
    placeholderHostId: 'Enter Host ID',
    connectBtn: 'Connect',
    availableHosts: 'Available hosts',
    noHostsFound: 'No hosts sharing right now',
    clickToConnect: 'Click to connect',
    participants: 'Participants',
    waitingConnections: 'Waiting for connections...',
    chat: 'Chat',
    dropMessage: '📂 Drop files to share',
    noMessagesYet: 'No messages yet',
    placeholderChat: 'Type a message...',
    sendBtn: 'Send',
    readyToConnect: 'Ready to Connect',
    readyToConnectDesc: 'Set your ID and start sharing, or connect to a host.',
    exitFullscreen: '❌ Exit Fullscreen',
    fullscreenBtn: '⛶ Fullscreen',

    confirmChangeId: 'An ID is already set. Do you want to change to a new ID?',
    idSetComplete: 'ID set: {id}',
    idUnavailable: 'This ID is already in use. Please enter a different ID.',
    peerErrorGeneric: 'Connection error occurred: {type}',
    displayMediaUnsupported: 'Screen sharing is unavailable.\n\nReason: this is likely not a secure context (HTTPS or localhost).\nFix: make sure you are accessing via http://localhost:3000.',
    enterFriendId: "Please enter your friend's ID.",
    callFailed: 'Failed to initiate the connection. Please check the PeerJS status.',
    callError: 'An error occurred during the connection.',
    fullscreenFailed: 'Failed to enter fullscreen mode: {msg}',
    welcomeMessage: 'Welcome to the session!',
    sendingFile: 'Sending file: {name} ({size})...',
    fileSentSuccess: 'File sent successfully.',
    fileTooLarge: 'File is too large. Maximum size is {max}.',
    startedSharingFile: 'Started sharing file: <strong>{name}</strong>',
    downloadLink: '💾 Download {name}',
    sharedFile: 'Shared a file:<br>{link}',
    senderSystem: 'System',
    senderMe: 'Me'
  }
};

let currentLang = localStorage.getItem('lang') || 'ko';

function t(key, vars) {
  let str = (translations[currentLang] && translations[currentLang][key]) || translations.ko[key] || key;
  if (vars) {
    // 함수로 치환해야 파일명 등에 들어간 "$&", "$'" 같은 특수 패턴이 해석되지 않음
    Object.keys(vars).forEach((k) => { str = str.replace(`{${k}}`, () => vars[k]); });
  }
  return str;
}

function applyTranslations() {
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  // ID 표시 영역은 실제 ID가 설정된 이후엔 건드리지 않음 (미설정 상태일 때만 갱신)
  const myIdEl = document.getElementById('my-id');
  if (myIdEl && (myIdEl.textContent === translations.ko.idNotSet || myIdEl.textContent === translations.en.idNotSet)) {
    myIdEl.textContent = t('idNotSet');
  }
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  applyTranslations();
}

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('lang-select');
  if (select) {
    select.value = currentLang;
    select.addEventListener('change', (e) => setLanguage(e.target.value));
  }
  applyTranslations();
});
