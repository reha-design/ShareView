const express = require('express');
const { ExpressPeerServer } = require('peer');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { X509Certificate } = require('crypto');
const selfsigned = require('selfsigned');

const app = express();
const port = Number(process.env.PORT) || 3000;
const CERT_DIR = path.join(__dirname, '.certs');

// 1. 정적 파일 호스팅 (웹 서버 역할)
// 현재 디렉토리의 파일들을 그대로 서빙합니다. (vendor/peerjs 포함)
// dotfiles를 명시하지 않으면 점(.) 폴더 안의 파일은 서빙됨 → .certs(개인키), .git 노출 방지
app.use(express.static(path.join(__dirname), { dotfiles: 'ignore' }));
app.use(express.json());

// 1-1. 같은 네트워크에서 현재 화면 공유 중인 Host 목록 (메모리 저장, 단일 프로세스라 DB 불필요)
const activeHosts = new Map(); // id -> registered at (ms)

app.get('/api/hosts', (req, res) => {
    res.json(Array.from(activeHosts.keys()));
});

app.post('/api/hosts/register', (req, res) => {
    const { id } = req.body || {};
    if (!id) return res.status(400).end();
    activeHosts.set(id, Date.now());
    res.status(204).end();
});

app.post('/api/hosts/unregister', (req, res) => {
    const { id } = req.body || {};
    activeHosts.delete(id);
    res.status(204).end();
});

function lanIPv4s() {
    return Object.values(os.networkInterfaces()).flat()
        .filter(i => i.family === 'IPv4' && !i.internal)
        .map(i => i.address);
}

// 2. HTTPS 인증서
// 브라우저 화면 공유 API는 HTTPS(또는 localhost)에서만 동작하므로, 다른 PC도 Host가 되려면 HTTPS가 필요함.
// 인증서가 없거나 만료되면 자체 서명 인증서를 만들어 .certs/에 저장 (mkcert 등으로 만든 key.pem/cert.pem으로 교체 가능)
async function loadOrCreateCert() {
    const keyPath = path.join(CERT_DIR, 'key.pem');
    const certPath = path.join(CERT_DIR, 'cert.pem');
    const valid = fs.existsSync(keyPath) && fs.existsSync(certPath)
        && new Date(new X509Certificate(fs.readFileSync(certPath)).validTo) > new Date();

    if (!valid) {
        const notAfterDate = new Date();
        notAfterDate.setDate(notAfterDate.getDate() + 825);
        const pems = await selfsigned.generate([{ name: 'commonName', value: 'ShareView' }], {
            algorithm: 'sha256', // 기본값 sha1은 브라우저가 거부함
            notAfterDate,
            extensions: [
                { name: 'basicConstraints', cA: false },
                { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
                { name: 'extKeyUsage', serverAuth: true },
                {
                    name: 'subjectAltName', altNames: [
                        { type: 2, value: 'localhost' },
                        { type: 7, ip: '127.0.0.1' },
                        ...lanIPv4s().map(ip => ({ type: 7, ip }))
                    ]
                }
            ]
        });
        fs.mkdirSync(CERT_DIR, { recursive: true });
        fs.writeFileSync(keyPath, pems.private);
        fs.writeFileSync(certPath, pems.cert);
        console.log('[ShareView] 자체 서명 HTTPS 인증서를 새로 만들었습니다 (.certs/)');
    }
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

// 3. 서버 시작 (웹 서버 + PeerJS 시그널링을 같은 HTTPS 포트에서 처리 → 인증서 경고도 한 번만 수락하면 됨)
loadOrCreateCert().then((tls) => {
    const server = https.createServer(tls, app);

    const peerServer = ExpressPeerServer(server, { path: '/' });
    app.use('/peerjs', peerServer);

    peerServer.on('connection', (client) => {
        console.log(`[PeerJS] Client connected: ${client.getId()}`);
    });

    peerServer.on('disconnect', (client) => {
        console.log(`[PeerJS] Client disconnected: ${client.getId()}`);
        // 비정상 종료(브라우저 강제 닫힘 등) 시에도 Host 목록에서 정리
        activeHosts.delete(client.getId());
    });

    // EventEmitter는 'error' 리스너가 없으면 Node 프로세스를 강제 종료시킴.
    // 시그널링 서버와 웹서버가 같은 프로세스에서 돌기 때문에, 이게 없으면
    // 참여자 한 명의 연결 에러만으로도 모든 사람이 동시에 끊길 수 있음.
    peerServer.on('error', (err) => {
        console.error('[PeerJS] Signaling server error (recovered):', err.message);
    });

    server.listen(port, () => {
        console.log(`===============================================`);
        console.log(`[ShareView] Local Server Started!`);
        console.log(`- 이 PC: https://localhost:${port}`);
        lanIPv4s().forEach(ip => console.log(`- 다른 PC: https://${ip}:${port}`));
        console.log(`처음 접속 시 인증서 경고가 나오면 "고급" → "계속 진행"을 눌러주세요.`);
        console.log(`===============================================`);
    });
}).catch((err) => {
    console.error('[ShareView] 서버 시작 실패:', err);
    process.exit(1);
});

// 4. 에러 핸들링 (미처리 에러로 인한 전체 프로세스 다운 방지)
process.on('uncaughtException', (err) => {
    console.error('[ShareView] Uncaught exception (server kept alive):', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ShareView] Unhandled promise rejection (server kept alive):', reason);
});
