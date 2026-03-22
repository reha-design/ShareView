const express = require('express');
const { PeerServer } = require('peer');
const http = require('http');
const path = require('path');

const app = express();
const port = 3000;

// 1. 정적 파일 호스팅 (웹 서버 역할)
// 현재 디렉토리의 파일들을 그대로 서빙합니다.
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
