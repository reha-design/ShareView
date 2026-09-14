# 화면 공유 (P2P Screen Sharing)

**PeerJS**와 **WebRTC** 기술을 활용한 웹 기반 P2P 화면 공유 애플리케이션입니다. 교육 및 소규모 협업을 위해 설계되었으며, 중계 서버 없이 사용자 간 직접 연결을 통해 빠르고 효율적인 화면 공유를 제공합니다.

## 🚀 주요 기능
*   **간편한 P2P 연결**: 별도의 회원가입 없이 ID만으로 즉시 연결
*   **커스텀 ID 설정**: 기억하기 쉬운 ID (예: `teacher`, `class-1`) 설정 지원
*   **초저지연 화면 공유**: 로컬 네트워크 환경에서 딜레이 없는 실시간 공유
*   **단방향 시청 모드**: 호스트는 화면을 송출하고, 참여자는 별도의 권한 없이 시청 가능
*   **전체화면 지원**: 원클릭으로 공유된 화면을 전체화면으로 전환

## 📦 설치 및 실행 방법

### 1. 필수 요구 사항
*   최신 웹 브라우저 (Chrome, Edge, Firefox 등)
*   **참고**: 로컬 테스트 시 `file://` 프로토콜로는 보안 정책상 화면 공유 권한이 제한될 수 있습니다. 간단한 웹 서버(Live Server 등)를 사용하는 것을 권장합니다.
*   PeerJS 클라이언트 라이브러리는 `vendor/peerjs/peerjs.min.js`에 로컬로 포함되어 있어 **외부 인터넷(CDN) 없이도** 정상 동작합니다.

### 2. 로컬 서버로 실행 (권장, 화면 공유 정상 동작)
사설 시그널링 서버까지 포함해 정식으로 실행하는 방법입니다. 여러 PC가 같은 방(호스트)에 접속하려면 이 방식을 사용하세요.
```bash
npm install
npm start
```
*   접속 주소: `http://localhost:3000` (호스트 PC)
*   같은 네트워크의 다른 PC: `http://<호스트-IP>:3000`

### 3. Live Server로 실행 (VS Code, 빠른 UI 확인용)
시그널링 서버 없이 화면(UI)만 빠르게 띄워볼 때 사용합니다. 다른 PC와 연결하려면 2번(로컬 서버) 방식을 권장합니다.
1.  이 폴더를 VS Code로 엽니다.
2.  `Live Server` 확장 프로그램을 설치합니다.
3.  `index.html` 파일에서 우클릭 -> `Open with Live Server` 선택.

### 4. Docker로 로컬 환경 구축 (폐쇄망)
외부 인터넷이 없는 환경에서도 완전히 동작합니다(라이브러리가 로컬에 포함되어 있음).
```bash
docker-compose up --build -d
```
자세한 내용은 [배포 가이드](markdown/Report/architecture_and_deployment.md)를 참고하세요.

## 📂 문서 (Documentation)
프로젝트에 대한 상세한 문서는 `markdown` 폴더에 정리되어 있습니다.

*   **[실행 흐름도 (Flowchart)](markdown/Mermaid/flow.md)**: 애플리케이션의 작동 로직과 시그널링 흐름
*   **[프로젝트 보고서](markdown/Report/report.md)**: 개발 현황 및 주요 아키텍처 설명
*   **[시스템 아키텍처 및 배포 가이드](markdown/Report/architecture_and_deployment.md)**: P2P 구조 설명 및 Docker 배포 방법

## 🛠 기술 스택
*   **Frontend**: HTML5, Vanilla JavaScript
*   **Communication**: [PeerJS](https://peerjs.com/) (WebRTC Wrapper)
*   **Style**: Inline CSS (Simple & Fast)

## 👥 권장 동시 접속 인원
P2P Mesh 구조라 호스트 1대가 참여자 수만큼 화면을 개별 인코딩/전송합니다.
*   **유선 LAN 기준 네트워크 대역폭은 20명 이상도 여유롭습니다** (20명 × 약 3Mbps ≈ 60Mbps, 기가비트 유선 환경에서 문제없음).
*   실제 한계는 **호스트 PC의 CPU**입니다. 일반적인 PC 기준 **10~15명** 이내를 권장하며, 옥타코어급 이상 + 하드웨어 인코더가 있는 PC라면 20명까지도 가능합니다.
*   인원이 늘어날수록 호스트 PC의 CPU 사용률과 발열이 증가하니, 대규모 인원이 예상되면 사전에 실제 인원으로 테스트해보세요.

## ⚠️ 라이선스 및 참고사항
이 프로젝트는 교육용으로 제작되었습니다. 상용망에서 사용 시 NAT/방화벽 환경(STUN/TURN 서버)에 따라 연결이 제한될 수 있습니다.
