const express = require('express');
const { PeerServer } = require('peer');
const http = require('http');
const path = require('path');

const app = express();
const port = 3000;

// 1. 정적 파일 호스팅 (웹 서버 역할)
// 현재 디렉토리의 파일들을 그대로 서빙합니다. (vendor/peerjs 포함)
app.use(express.static(path.join(__dirname)));

// 2. HTTP 서버 생성
const server = http.createServer(app);

// 3. PeerJS 시그널링 서버 실행
// '/peerjs' 경로로 들어오는 웹소켓 요청을 처리합니다.
const peerServer = PeerServer({ port: 9000, path: '/peerjs' });

// 4. 서버 시작
server.listen(port, () => {
    console.log(`===============================================`);
    console.log(`[ShareView] Local Server Started!`);
    console.log(`- Web Server: http://localhost:${port}`);
    console.log(`- Network Access: http://<Your-PC-IP>:${port}`);
    console.log(`===============================================`);
});

// PeerJS 서버 이벤트 로깅 (옵션)
peerServer.on('connection', (client) => {
    console.log(`[PeerJS] Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`[PeerJS] Client disconnected: ${client.getId()}`);
});

// 5. 에러 핸들링 (미처리 에러로 인한 전체 프로세스 다운 방지)
// EventEmitter는 'error' 리스너가 없으면 Node 프로세스를 강제 종료시킴.
// 시그널링 서버와 웹서버가 같은 프로세스에서 돌기 때문에, 이게 없으면
// 참여자 한 명의 연결 에러만으로도 모든 사람이 동시에 끊길 수 있음.
peerServer.on('error', (err) => {
    console.error('[PeerJS] Signaling server error (recovered):', err.message);
});

process.on('uncaughtException', (err) => {
    console.error('[ShareView] Uncaught exception (server kept alive):', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ShareView] Unhandled promise rejection (server kept alive):', reason);
});
