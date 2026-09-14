// PeerJS 객체 초기화
let peer = null;
let localStream = null;
let dataConnections = []; // 연결된 데이터 채널 목록 (Host용)
let myDataConnection = null; // 호스트와 연결된 데이터 채널 (Viewer용)
let mediaCalls = []; // Host가 유지 중인 영상 통화 목록 (공유 중지 시 일괄 종료)
let receivedBuffers = {}; // 파일 수신 버퍼: { senderId: { meta: {}, chunks: [] } }

// PeerJS 초기화 및 ID 설정 함수
function initializePeer() {
    const customIdInput = document.getElementById('custom-id-input');
    const customId = customIdInput.value.trim();

    // 이미 연결된 상태라면 -> 기존 연결 끊고 재연결 허용 (ID 변경 목적)
    if (peer) {
        if (!peer.disconnected && !peer.destroyed) {
            const confirmChange = confirm(t('confirmChangeId'));
            if (!confirmChange) return;

            peer.destroy(); // 기존 연결 완전히 종료
            peer = null;
            document.getElementById('my-id').innerText = t('idChanging');
            document.getElementById('start-share-btn').disabled = true;
        }
    }

    // ID가 입력되면 해당 ID로, 없으면 랜덤으로 생성
    // Peer 생성 옵션
    let options = { debug: 2 };

    // 로컬 서버 환경(포트 3000) 감지
    const isLocalServer = window.location.port === '3000';

    if (isLocalServer) {
        console.log("Detected Local Server Environment. Using Local Signaling Server.");
        options = {
            host: window.location.hostname, // 현재 접속한 IP (예: 192.168.0.10)
            port: window.location.port,     // 시그널링도 웹 서버와 같은 HTTPS 포트에서 동작 (wss는 페이지 프로토콜 따라 자동)
            path: '/peerjs',
            debug: 2
        };
    }

    if (customId) {
        peer = new Peer(customId, options);
    } else {
        peer = new Peer(options); // 랜덤 ID
    }

    // PeerJS 서버 연결 성공 시
    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        document.getElementById('my-id').innerText = id;
        document.getElementById('my-id').style.color = "#4285F4";

        // 공유 시작 버튼 활성화
        document.getElementById('start-share-btn').disabled = false;
        document.getElementById('start-share-btn').style.backgroundColor = "#4285F4";
        document.getElementById('start-share-btn').style.cursor = "pointer";

        // 입력창 비활성화
        // 입력창은 다시 활성화 두기 (변경 가능하도록) - 원한다면 비활성화해도 됨
        // customIdInput.disabled = true; 
        customIdInput.value = ''; // 입력창 비움

        if (customId) {
            alert(t('idSetComplete', { id }));
        }
    });

    peer.on('call', (call) => {
        // Host가 공유를 시작하며 걸어온 호출 (Viewer가 공유 시작 전에 접속해 있던 경우)
        if (call.metadata && call.metadata.type === 'share') {
            call.answer();
            attachViewerCall(call);
            return;
        }
        // Viewer -> Host 호출: 공유 중이면 스트림으로 응답, 아니면 스트림 없이 받아두고 공유 시작 시 다시 걸어줌
        call.answer(localStream || undefined);
        trackCall(call);
    });

    // 데이터 채널 연결 요청 (Viewer -> Host)
    peer.on('connection', (conn) => {
        console.log("Incoming data connection from:", conn.peer);

        conn.on('open', () => {
            console.log("Data connection established with:", conn.peer);
            dataConnections.push(conn);
            updateParticipantList();

            // 접속 환영 메시지 전송
            conn.send({ type: 'chat', sender: 'System', message: t('welcomeMessage') });
        });

        conn.on('data', (data) => {
            handleIncomingData(data, conn.peer);
        });

        conn.on('close', () => {
            console.log("Data connection closed:", conn.peer);
            dataConnections = dataConnections.filter(c => c.peer !== conn.peer);
            updateParticipantList();
        });
    });

    // 에러 처리
    peer.on('error', (err) => {
        console.error('PeerJS Error:', err);

        if (err.type === 'unavailable-id') {
            alert(t('idUnavailable'));
            // Peer 객체가 유효하지 않으므로 null 처리 (재시도 위해)
            peer = null;
            document.getElementById('my-id').innerText = t('idError');
        } else {
            alert(t('peerErrorGeneric', { type: err.type }));
        }
    });
}

setupDragAndDrop();

// 화면 영상 유무에 따라 "Ready to Connect" 안내 문구 표시/숨김
function updateVideoPlaceholder() {
    const videoElement = document.getElementById('screen-preview');
    const placeholder = document.getElementById('no-video-placeholder');
    if (!placeholder) return;
    placeholder.style.display = (videoElement && videoElement.srcObject) ? 'none' : 'block';
}

// 1. Host: 화면 공유 시작 함수
async function startScreenShare() {
    try {
        const videoElement = document.getElementById('screen-preview');

        // Secure Context 체크
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert(t('displayMediaUnsupported'));
            console.error("navigator.mediaDevices.getDisplayMedia is not defined. Ensure you are using HTTPS or localhost.");
            return;
        }

        // 화면 공유 스트림 요청 (오디오 포함)
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true // 시스템 오디오 공유 활성화
        });

        // 내 화면 미리보기
        videoElement.srcObject = localStream;
        videoElement.muted = true; // 내 화면은 소리 끔
        updateVideoPlaceholder();
        registerAsHost();
        setSharingUI(true);

        // 공유 시작 전에 이미 접속해 있던 Viewer들에게도 화면 전송
        dataConnections.forEach(conn => {
            trackCall(peer.call(conn.peer, localStream, { metadata: { type: 'share' } }));
        });

        // 브라우저 자체 "공유 중지" 버튼으로 멈췄을 때
        localStream.getVideoTracks()[0].onended = stopScreenShare;

        console.log("화면 공유 시작됨. 다른 사용자가 내 ID로 연결하면 이 화면을 볼 수 있습니다.");

    } catch (err) {
        console.error("화면 공유 시작 실패:", err);
    }
}

// 1-1. Host: 화면 공유 중지 (Viewer들의 영상 통화도 함께 종료)
function stopScreenShare() {
    if (!localStream) return;
    localStream.getTracks().forEach(track => track.stop()); // stop()은 onended를 발생시키지 않음
    localStream = null;

    mediaCalls.forEach(call => call.close());
    mediaCalls = [];

    document.getElementById('screen-preview').srcObject = null;
    updateVideoPlaceholder();
    unregisterAsHost();
    setSharingUI(false);
}

function setSharingUI(sharing) {
    document.getElementById('start-share-btn').hidden = sharing;
    document.getElementById('stop-share-btn').hidden = !sharing;
}

function trackCall(call) {
    mediaCalls.push(call);
    call.on('close', () => { mediaCalls = mediaCalls.filter(c => c !== call); });
}

// 2. Viewer: 친구에게 연결하여 화면 보기
function connectToPeer() {
    const friendId = document.getElementById('friend-id').value;
    if (!friendId) {
        alert(t('enterFriendId'));
        return;
    }

    // 내 ID를 설정하지 않았으면 랜덤 ID로 먼저 접속한 뒤 이어서 연결
    if (!peer || peer.destroyed) {
        initializePeer();
        peer.once('open', connectToPeer);
        return;
    }

    console.log(`Connecting to ${friendId}...`);

    // 연결 시도 시 바로 전체화면으로 진입 (브라우저 정책상 사용자 클릭 시점에 요청해야 함)
    // 스트림이 아직 안 왔더라도 검은 화면(또는 로딩)으로 전체화면 진입
    const exitBtn = document.getElementById('exit-fullscreen-btn');
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            exitBtn.style.display = 'block';
        }).catch(err => {
            console.warn("Auto-fullscreen failed:", err);
        });
    }

    // 친구에게 전화를 걼니다.
    // 친구에게 전화를 겁니다. (null 대신 dummy stream 사용)
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const dummyStream = canvas.captureStream();

    // peer.call이 유효한 스트림을 기대하므로 dummyStream 전달
    const call = peer.call(friendId, dummyStream);

    if (!call) {
        console.error("Failed to initiate call. 'call' object is undefined.");
        alert(t('callFailed'));
        return;
    }

    attachViewerCall(call);

    // 데이터 채널 연결 (채팅/참여자용)
    const conn = peer.connect(friendId);
    conn.on('open', () => {
        console.log("Connected to Host Data Channel");
        myDataConnection = conn;

        // 내 ID 전송 (참여자 목록 등록용)
        conn.send({ type: 'join', id: peer.id });
    });

    conn.on('data', (data) => {
        handleIncomingData(data);
    });

    conn.on('close', () => {
        myDataConnection = null;
        renderParticipants([]);
    });

    conn.on('error', (err) => {
        console.error("Data connection error:", err);
    });
}

// Viewer: Host 영상 통화 수신/종료 처리 (직접 건 통화, Host가 걸어온 통화 공통)
function attachViewerCall(call) {
    const videoElement = document.getElementById('screen-preview');
    let shownStream = null; // PeerJS는 close 전에 call.remoteStream을 비우므로 직접 기억

    call.on('stream', (remoteStream) => {
        console.log("Received remote stream!");
        shownStream = remoteStream;
        videoElement.srcObject = remoteStream;
        videoElement.muted = false; // 상대방 소리는 들어야 함
        videoElement.play().catch(e => console.error("Autoplay failed:", e));
        updateVideoPlaceholder();
    });

    call.on('close', () => {
        // 스트림 없이 받아둔 통화가 닫힐 때 현재 보고 있는 화면까지 지우지 않도록
        if (videoElement.srcObject !== shownStream) return;
        console.log("연결이 종료되었습니다.");
        videoElement.srcObject = null;
        updateVideoPlaceholder();
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    });

    call.on('error', (err) => {
        console.error("Call error:", err);
        alert(t('callError'));
    });
}

// 3. Utils: 전체화면 토글
function toggleFullScreen() {
    const exitBtn = document.getElementById('exit-fullscreen-btn');
    // 사이드바 숨김 토글이 페이지 전체를 대상으로 동작하도록 documentElement를 전체화면 처리

    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            exitBtn.style.display = 'block'; // 전체화면 때 버튼 보이기
        }).catch(err => {
            alert(t('fullscreenFailed', { msg: err.message }));
        });
    } else {
        document.exitFullscreen().then(() => {
            exitBtn.style.display = 'none'; // 전체화면 종료 시 버튼 숨기기
        });
    }
}

// 3-1. 전체화면 시 사이드바 자동 숨김 (on/off 토글)
let hideSidebarOnFullscreen = (localStorage.getItem('hideSidebarOnFullscreen') ?? 'true') === 'true';

function toggleHideSidebarOnFullscreen(checked) {
    hideSidebarOnFullscreen = checked;
    localStorage.setItem('hideSidebarOnFullscreen', checked);
    applySidebarVisibility();
}

function applySidebarVisibility() {
    document.body.classList.toggle('hide-sidebar-fs', !!document.fullscreenElement && hideSidebarOnFullscreen);
}

// 저장된 토글 상태를 체크박스에 반영
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('hide-sidebar-toggle');
    if (toggle) toggle.checked = hideSidebarOnFullscreen;

    // 첫 방문 때만 사용법 모달 자동 표시
    if (!localStorage.getItem('helpSeen')) {
        localStorage.setItem('helpSeen', '1');
        document.getElementById('help-dialog').showModal();
    }
});

// 전체화면 상태 감지 (Esc키로 나갔을 때도 버튼 숨기기 위함)
document.addEventListener('fullscreenchange', () => {
    const exitBtn = document.getElementById('exit-fullscreen-btn');
    if (!document.fullscreenElement) {
        exitBtn.style.display = 'none';
    } else {
        exitBtn.style.display = 'block';
    }
    applySidebarVisibility();
});

// 3-2. 같은 네트워크의 Host 목록 (서버에 등록/조회하여 ID 직접 입력 없이 선택 연결)

function registerAsHost() {
    if (!peer || !peer.id) return;
    fetch('/api/hosts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: peer.id })
    }).catch(err => console.warn('Host 등록 실패:', err));
}

function unregisterAsHost() {
    if (!peer || !peer.id) return;
    fetch('/api/hosts/unregister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: peer.id })
    }).catch(err => console.warn('Host 등록 해제 실패:', err));
}

async function refreshHostList() {
    const listEl = document.getElementById('host-list');
    if (!listEl) return;

    try {
        const res = await fetch('/api/hosts');
        const hosts = (await res.json()).filter(id => !peer || id !== peer.id);

        listEl.innerHTML = '';
        if (hosts.length === 0) {
            listEl.appendChild(placeholderItem('noHostsFound'));
            return;
        }

        hosts.forEach(id => {
            const li = document.createElement('li');
            li.textContent = id;
            li.style.cursor = 'pointer';
            li.title = t('clickToConnect');
            li.onclick = () => {
                document.getElementById('friend-id').value = id;
                connectToPeer();
            };
            listEl.appendChild(li);
        });
    } catch (err) {
        console.warn('Host 목록 조회 실패:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    refreshHostList();
    setInterval(refreshHostList, 4000);
});

// 4. Data Channel Logic (Chat & Participants)

// 데이터 수신 처리 (fromPeer: Host가 받은 경우 보낸 Viewer의 ID)
function handleIncomingData(data, fromPeer) {
    if (data.type === 'chat') {
        appendChatMessage(data.sender, data.message);

        // Host라면 보낸 사람을 제외한 다른 Viewer들에게 전달 (보낸 사람은 이미 로컬에 표시함)
        if (dataConnections.length > 0) {
            broadcastData(data, fromPeer);
        }
    } else if (data.type === 'participants' && Array.isArray(data.list)) {
        renderParticipants(data.list);
    } else if (data.type === 'file-start') {
        handleFileStart(data.sender, data.meta);
    } else if (data.type === 'file-chunk') {
        handleFileChunk(data.sender, data.payload);
    } else if (data.type === 'file-end') {
        handleFileEnd(data.sender);
    }
}

// 데이터 브로드캐스트 (Host -> All Viewers, exceptPeer는 제외)
function broadcastData(data, exceptPeer) {
    dataConnections.forEach(conn => {
        if (conn.open && conn.peer !== exceptPeer) {
            conn.send(data);
        }
    });
}

// 메시지 전송
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    const myId = peer ? peer.id : 'Me';

    // 내 화면에 표시
    appendChatMessage('Me', message);

    const data = { type: 'chat', sender: myId, message: message };

    // Viewer -> Host 전송
    if (myDataConnection && myDataConnection.open) {
        myDataConnection.send(data);
    }
    // Host -> All Viewers 전송
    else if (dataConnections.length > 0) {
        broadcastData(data);
    }

    input.value = '';
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 텍스트 속 http(s) 링크를 새 탭으로 여는 <a>로 변환 (나머지는 이스케이프). 끝의 문장부호는 링크에서 제외
function linkify(text) {
    return String(text).split(/(https?:\/\/[^\s]*[^\s.,!?)])/g).map((part, i) =>
        i % 2
            ? `<a href="${escapeHtml(part)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part)}</a>`
            : escapeHtml(part)
    ).join('');
}

// UI: 채팅 메시지 추가. 상대방이 보낸 값은 반드시 이스케이프 (isHtml은 로컬에서 만든 안전한 HTML일 때만)
function appendChatMessage(sender, message, isHtml = false) {
    const chatBox = document.getElementById('chat-messages');
    document.getElementById('chat-empty')?.remove();

    const displaySender = sender === 'System' ? t('senderSystem') : sender === 'Me' ? t('senderMe') : sender;
    const div = document.createElement('div');
    div.innerHTML = `<strong>${escapeHtml(displaySender)}:</strong> ${isHtml ? message : linkify(message)}`;
    div.style.marginBottom = "5px";
    div.style.fontSize = "13px";
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}

function placeholderItem(key) {
    const li = document.createElement('li');
    li.style.cssText = 'color:#9ca3af;background:none;padding-left:0;';
    li.setAttribute('data-i18n', key);
    li.textContent = t(key);
    return li;
}

// UI: 참여자 목록 (Host가 갱신 후 모든 Viewer에게도 전송)
function updateParticipantList() {
    const ids = dataConnections.map(conn => conn.peer);
    renderParticipants(ids);
    broadcastData({ type: 'participants', list: ids });
}

function renderParticipants(ids) {
    const listEl = document.getElementById('participant-list');
    listEl.innerHTML = '';
    if (ids.length === 0) {
        listEl.appendChild(placeholderItem('waitingConnections'));
        return;
    }
    ids.forEach(id => {
        const li = document.createElement('li');
        li.textContent = id;
        listEl.appendChild(li);
    });
}


// 5. File Sharing Logic

function setupDragAndDrop() {
    const chatSection = document.querySelector('.chat-section');
    const dropZone = document.getElementById('drop-zone');

    // Drag Enter/Over
    chatSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        chatSection.classList.add('drag-over');
    });

    chatSection.addEventListener('dragenter', (e) => {
        e.preventDefault();
        chatSection.classList.add('drag-over');
    });

    // Drag Leave
    chatSection.addEventListener('dragleave', (e) => {
        e.preventDefault();
        // 자식 요소로 들어갔을 때 깜빡임 방지용 로직이 필요할 수 있으나 간단히 처리
        if (e.target === chatSection || e.target === dropZone) {
            chatSection.classList.remove('drag-over');
        }
    });

    // Drop
    chatSection.addEventListener('drop', (e) => {
        e.preventDefault();
        chatSection.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            sendFile(files[0]);
        }
    });
}

const CHUNK_SIZE = 16384; // 16KB
// ponytail: 수신측이 파일 전체를 메모리에 모았다가 Blob으로 만들므로 상한을 둠. 더 큰 파일이 필요하면 스트리밍 저장(File System Access API) 필요
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// 채팅 메시지 끝에 진행률(%)을 붙이고, 갱신 함수를 돌려줌
function addProgress(div) {
    const span = document.createElement('span');
    div.appendChild(span);
    return (done, total) => {
        const text = ` ${total ? Math.floor(done / total * 100) : 100}%`;
        if (span.textContent !== text) span.textContent = text;
    };
}

async function sendFile(file) {
    if (file.size > MAX_FILE_SIZE) {
        alert(t('fileTooLarge', { max: formatBytes(MAX_FILE_SIZE) }));
        return;
    }

    const myId = peer ? peer.id : 'Me';
    const progress = addProgress(appendChatMessage('System', t('sendingFile', { name: file.name, size: formatBytes(file.size) })));

    // 1. Send File Metadata
    const metaData = {
        type: 'file-start',
        sender: myId,
        meta: {
            name: file.name,
            size: file.size,
            type: file.type
        }
    };
    broadcastOrSend(metaData);

    // 2. Read and Send Chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let offset = 0;

    for (let i = 0; i < totalChunks; i++) {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        const chunkData = {
            type: 'file-chunk',
            sender: myId,
            payload: buffer // ArrayBuffer works with PeerJS BinaryPack
        };
        broadcastOrSend(chunkData);

        offset += CHUNK_SIZE;

        // 간단한 흐름 제어 (너무 빠르면 끊길 수 있음 -> await sleep?)
        if (i % 100 === 0) {
            progress(i, totalChunks);
            await new Promise(r => setTimeout(r, 10));
        }
    }
    progress(totalChunks, totalChunks);

    // 3. Send End Signal
    const endData = {
        type: 'file-end',
        sender: myId
    };
    broadcastOrSend(endData);

    appendChatMessage('System', t('fileSentSuccess'));
}

function broadcastOrSend(data) {
    // Viewer -> Host
    if (myDataConnection && myDataConnection.open) {
        myDataConnection.send(data);
    }
    // Host -> All Viewers
    else if (dataConnections.length > 0) {
        broadcastData(data);
    }
}

// 수신 처리
function handleFileStart(sender, meta) {
    console.log(`Receiving file from ${sender}: ${meta.name}`);
    receivedBuffers[sender] = {
        meta: meta,
        chunks: [],
        receivedSize: 0,
        progress: addProgress(appendChatMessage(sender, t('startedSharingFile', { name: escapeHtml(meta.name) }), true))
    };
}

function handleFileChunk(sender, buffer) {
    const context = receivedBuffers[sender];
    if (!context) return;

    context.chunks.push(buffer);
    context.receivedSize += buffer.byteLength;

    // 상대가 보낸 크기 정보는 신뢰할 수 없으므로 실제 받은 양으로 상한 검사
    if (context.receivedSize > MAX_FILE_SIZE) {
        delete receivedBuffers[sender];
        return;
    }
    context.progress(context.receivedSize, context.meta.size);
}

function handleFileEnd(sender) {
    const context = receivedBuffers[sender];
    if (!context) return;

    const blob = new Blob(context.chunks, { type: context.meta.type });
    const url = URL.createObjectURL(blob);

    const safeName = escapeHtml(context.meta.name);
    const downloadLink = `<a href="${url}" download="${safeName}" style="color: #4f46e5; text-decoration: underline;">${t('downloadLink', { name: safeName })}</a> (${formatBytes(context.meta.size)})`;

    appendChatMessage(sender, t('sharedFile', { link: downloadLink }), true);

    // Clean up
    delete receivedBuffers[sender];
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

