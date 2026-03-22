// PeerJS 객체 초기화
let peer = null;
let localStream = null;
let dataConnections = []; // 연결된 데이터 채널 목록 (Host용)
let myDataConnection = null; // 호스트와 연결된 데이터 채널 (Viewer용)
let receivedBuffers = {}; // 파일 수신 버퍼: { senderId: { meta: {}, chunks: [] } }

// PeerJS 초기화 및 ID 설정 함수
function initializePeer() {
    const customIdInput = document.getElementById('custom-id-input');
    const customId = customIdInput.value.trim();

    // 이미 연결된 상태라면 -> 기존 연결 끊고 재연결 허용 (ID 변경 목적)
    if (peer) {
        if (!peer.disconnected && !peer.destroyed) {
            const confirmChange = confirm("이미 ID가 설정되어 있습니다. 새로운 ID로 변경하시겠습니까?");
            if (!confirmChange) return;

            peer.destroy(); // 기존 연결 완전히 종료
            peer = null;
            document.getElementById('my-id').innerText = "변경 중...";
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
            port: 9000,                     // server.js에서 설정한 PeerJS 포트
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
            alert(`ID 설정 완료: ${id}`);
        }
    });

    // 누군가 나에게 전화를 걸었을 때 (Viewer -> Host)
    peer.on('call', (call) => {
        console.log('Incoming call...');
        // 내가 화면 공유 중이라면 그 스트림으로 응답
        if (localStream) {
            console.log('Answering with local stream.');
            call.answer(localStream);
        } else {
            // 공유 중이 아닐 때 전화가 오면? 일단 받되 스트림 없이?
            console.log('No local stream enabled yet. Answering without stream.');
            call.answer(); // 스트림 없이 받음
        }
    });

    // 데이터 채널 연결 요청 (Viewer -> Host)
    peer.on('connection', (conn) => {
        console.log("Incoming data connection from:", conn.peer);

        conn.on('open', () => {
            console.log("Data connection established with:", conn.peer);
            dataConnections.push(conn);
            updateParticipantList();

            // 접속 환영 메시지 전송
            conn.send({ type: 'chat', sender: 'System', message: 'Welcome to the session!' });
        });

        conn.on('data', (data) => {
            handleIncomingData(data);
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
            alert("이미 사용 중인 ID입니다. 다른 ID를 입력해주세요.");
            // Peer 객체가 유효하지 않으므로 null 처리 (재시도 위해)
            peer = null;
            document.getElementById('my-id').innerText = "ID 오류";
        } else {
            alert('연결 에러 발생: ' + err.type);
        }
    });
}

setupDragAndDrop();

// 1. Host: 화면 공유 시작 함수
async function startScreenShare() {
    try {
        const videoElement = document.getElementById('screen-preview');

        // Secure Context 체크
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert("화면 공유 기능을 사용할 수 없습니다.\n\n원인: 보안 컨텍스트(HTTPS 또는 localhost)가 아닐 가능성이 높습니다.\n해결: http://localhost:3000 으로 접속했는지 확인해주세요.");
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

        // 화면 공유 중지 시 처리
        localStream.getVideoTracks()[0].onended = () => {
            console.log('화면 공유가 중단되었습니다.');
            videoElement.srcObject = null;
            localStream = null;
            // 필요하다면 모든 연결 끊기 로직 추가 가능
        };

        console.log("화면 공유 시작됨. 다른 사용자가 내 ID로 연결하면 이 화면을 볼 수 있습니다.");

    } catch (err) {
        console.error("화면 공유 시작 실패:", err);
    }
}

// 2. Viewer: 친구에게 연결하여 화면 보기
function connectToPeer() {
    const friendId = document.getElementById('friend-id').value;
    if (!friendId) {
        alert("친구의 ID를 입력해주세요.");
        return;
    }

    console.log(`Connecting to ${friendId}...`);

    // 연결 시도 시 바로 전체화면으로 진입 (브라우저 정책상 사용자 클릭 시점에 요청해야 함)
    // 스트림이 아직 안 왔더라도 검은 화면(또는 로딩)으로 전체화면 진입
    const videoContainer = document.getElementById('video-container');
    const exitBtn = document.getElementById('exit-fullscreen-btn');
    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().then(() => {
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
        alert("연결 시도에 실패했습니다. PeerJS 상태를 확인해주세요.");
        return;
    }

    call.on('stream', (remoteStream) => {
        console.log("Received remote stream!");
        const videoElement = document.getElementById('screen-preview');
        videoElement.srcObject = remoteStream;
        videoElement.muted = false; // 상대방 소리는 들어야 함
        videoElement.play().catch(e => console.error("Autoplay failed:", e));
    });

    call.on('close', () => {
        console.log("연결이 종료되었습니다.");
        document.getElementById('screen-preview').srcObject = null;
        // 연결 끊기면 전체화면도 나가기
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    });

    call.on('error', (err) => {
        console.error("Call error:", err);
        alert("연결 중 오류가 발생했습니다.");
    });

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

    conn.on('error', (err) => {
        console.error("Data connection error:", err);
    });
}

// 3. Utils: 전체화면 토글
function toggleFullScreen() {
    const videoContainer = document.getElementById('video-container');
    const exitBtn = document.getElementById('exit-fullscreen-btn');
    // const videoElement = document.getElementById('screen-preview'); 
    // 스트림 유무와 상관없이 UI 컨테이너를 전체화면 처리할 수 있도록 제한 해제

    if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().then(() => {
            exitBtn.style.display = 'block'; // 전체화면 때 버튼 보이기
        }).catch(err => {
            alert(`전체화면 모드 전환 실패: ${err.message}`);
        });
    } else {
        document.exitFullscreen().then(() => {
            exitBtn.style.display = 'none'; // 전체화면 종료 시 버튼 숨기기
        });
    }
}

// 전체화면 상태 감지 (Esc키로 나갔을 때도 버튼 숨기기 위함)
document.addEventListener('fullscreenchange', () => {
    const exitBtn = document.getElementById('exit-fullscreen-btn');
    if (!document.fullscreenElement) {
        exitBtn.style.display = 'none';
    } else {
        exitBtn.style.display = 'block';
    }
});

// 4. Data Channel Logic (Chat & Participants)

// 데이터 수신 처리
function handleIncomingData(data) {
    if (data.type === 'chat') {
        appendChatMessage(data.sender, data.message);

        // Host라면 다른 모든 Viewer에게 브로드캐스트 (Echo)
        if (dataConnections.length > 0) {
            broadcastData(data);
        }
    } else if (data.type === 'file-start') {
        handleFileStart(data.sender, data.meta);
    } else if (data.type === 'file-chunk') {
        handleFileChunk(data.sender, data.payload);
    } else if (data.type === 'file-end') {
        handleFileEnd(data.sender);
    }
}

// 데이터 브로드캐스트 (Host -> All Viewers)
function broadcastData(data) {
    dataConnections.forEach(conn => {
        // 보낸 사람에게는 다시 보내지 않음 (선택 사항)
        if (conn.open) {
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

// UI: 채팅 메시지 추가
function appendChatMessage(sender, message) {
    const chatBox = document.getElementById('chat-messages');
    if (!chatBox) return; // UI 아직 없으면 무시

    const div = document.createElement('div');
    div.innerHTML = `<strong>${sender}:</strong> ${message}`;
    div.style.marginBottom = "5px";
    div.style.fontSize = "13px";
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// UI: 참여자 목록 업데이트 (Host Only for now)
function updateParticipantList() {
    const listEl = document.getElementById('participant-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    dataConnections.forEach(conn => {
        const li = document.createElement('li');
        li.innerText = conn.peer;
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

async function sendFile(file) {
    const myId = peer ? peer.id : 'Me';
    appendChatMessage('System', `Sending file: ${file.name} (${formatBytes(file.size)})...`);

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
        if (i % 100 === 0) await new Promise(r => setTimeout(r, 10));
    }

    // 3. Send End Signal
    const endData = {
        type: 'file-end',
        sender: myId
    };
    broadcastOrSend(endData);

    appendChatMessage('System', `File sent successfully.`);
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
        receivedSize: 0
    };
    appendChatMessage(sender, `Started sharing file: <strong>${meta.name}</strong>`);
}

function handleFileChunk(sender, buffer) {
    const context = receivedBuffers[sender];
    if (!context) return;

    context.chunks.push(buffer);
    context.receivedSize += buffer.byteLength;
}

function handleFileEnd(sender) {
    const context = receivedBuffers[sender];
    if (!context) return;

    const blob = new Blob(context.chunks, { type: context.meta.type });
    const url = URL.createObjectURL(blob);

    const downloadLink = `<a href="${url}" download="${context.meta.name}" style="color: #4f46e5; text-decoration: underline;">💾 Download ${context.meta.name}</a> (${formatBytes(context.meta.size)})`;

    appendChatMessage(sender, `Shared a file:<br>${downloadLink}`);

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

