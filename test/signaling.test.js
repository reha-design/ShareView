// 서버를 실제로 띄워 HTTPS 서빙, 시그널링(wss), Host 목록 API를 확인하는 통합 테스트
// 실행: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');
const WebSocket = require('ws');

let server;
let port;

function freePort() {
    return new Promise((resolve) => {
        const s = net.createServer().listen(0, () => {
            const { port } = s.address();
            s.close(() => resolve(port));
        });
    });
}

// 자체 서명 인증서라 검증은 끔
function request(urlPath, { method = 'GET', body } = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            host: 'localhost', port, path: urlPath, method, rejectUnauthorized: false,
            headers: body ? { 'Content-Type': 'application/json' } : {}
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.end(body && JSON.stringify(body));
    });
}

// 브라우저의 PeerJS가 하는 것과 같은 방식으로 시그널링 서버에 접속하고, OPEN을 받으면 반환
function openPeer(id) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`wss://localhost:${port}/peerjs/peerjs?key=peerjs&id=${id}&token=t-${id}`, { rejectUnauthorized: false });
        ws.once('message', (m) => {
            const msg = JSON.parse(m);
            msg.type === 'OPEN' ? resolve(ws) : reject(new Error(`${id}: ${m}`));
        });
        ws.once('error', reject);
    });
}

async function hostList() {
    return JSON.parse((await request('/api/hosts')).body);
}

before(async () => {
    port = await freePort();
    server = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: String(port) }
    });

    let out = '';
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`서버가 시작되지 않음:\n${out}`)), 20000);
        server.stdout.on('data', (chunk) => {
            out += chunk;
            if (out.includes('Local Server Started!')) { clearTimeout(timer); resolve(); }
        });
        server.stderr.on('data', (chunk) => { out += chunk; });
        server.once('exit', (code) => { clearTimeout(timer); reject(new Error(`서버 종료 (code ${code}):\n${out}`)); });
    });
});

after(() => server.kill());

test('HTTPS로 앱 페이지를 서빙한다', async () => {
    assert.equal((await request('/')).status, 200);
    assert.equal((await request('/screenShare.js')).status, 200);
});

test('점(.) 폴더는 서빙하지 않는다 (인증서 개인키, .git 노출 방지)', async () => {
    assert.equal((await request('/.certs/key.pem')).status, 404);
    assert.equal((await request('/.git/config')).status, 404);
});

test('시그널링 메시지가 같은 포트의 wss로 상대에게 전달된다', async () => {
    const a = await openPeer('relay-a');
    const b = await openPeer('relay-b');
    try {
        const received = new Promise((resolve) => b.on('message', (m) => {
            const msg = JSON.parse(m);
            if (msg.type === 'OFFER') resolve(msg);
        }));
        a.send(JSON.stringify({ type: 'OFFER', dst: 'relay-b', payload: { sdp: 'x' } }));

        const msg = await received;
        assert.equal(msg.src, 'relay-a');
        assert.deepEqual(msg.payload, { sdp: 'x' });
    } finally {
        a.close();
        b.close();
    }
});

test('Host 목록: 등록하면 보이고, 해제하면 사라진다', async () => {
    assert.equal((await request('/api/hosts/register', { method: 'POST', body: {} })).status, 400);

    await request('/api/hosts/register', { method: 'POST', body: { id: 'list-host' } });
    assert.ok((await hostList()).includes('list-host'));

    await request('/api/hosts/unregister', { method: 'POST', body: { id: 'list-host' } });
    assert.ok(!(await hostList()).includes('list-host'));
});

test('Host가 비정상 종료되면(시그널링 연결 끊김) 목록에서 자동으로 빠진다', async () => {
    const ws = await openPeer('drop-host');
    await request('/api/hosts/register', { method: 'POST', body: { id: 'drop-host' } });
    assert.ok((await hostList()).includes('drop-host'));

    ws.terminate();
    for (let i = 0; i < 20 && (await hostList()).includes('drop-host'); i++) {
        await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(!(await hostList()).includes('drop-host'));
});
