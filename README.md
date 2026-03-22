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

### 2. Live Server로 실행 (VS Code)
1.  이 폴더를 VS Code로 엽니다.
2.  `Live Server` 확장 프로그램을 설치합니다.
3.  `index.html` 파일에서 우클릭 -> `Open with Live Server` 선택.

### 3. Docker로 로컬 환경 구축 (폐쇄망)
외부 인터넷이 없는 환경에서는 로컬 시그널링 서버가 필요합니다.
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

## ⚠️ 라이선스 및 참고사항
이 프로젝트는 교육용으로 제작되었습니다. 상용망에서 사용 시 NAT/방화벽 환경(STUN/TURN 서버)에 따라 연결이 제한될 수 있습니다.
