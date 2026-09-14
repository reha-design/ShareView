# Changelog

## 2026-09-15

### Added
- 다국어 지원(한국어 기본 / 영어) — 사이드바에서 언어 전환, 선택값은 `localStorage`에 저장되어 새로고침 후에도 유지됨 ([i18n.js](i18n.js))
- 같은 네트워크에서 현재 화면 공유 중인 Host 목록을 "세션 참가"에 자동 표시 — Host ID를 직접 입력하지 않고 클릭 한 번으로 연결 가능 (`server.js`의 `/api/hosts` 등록/조회 API, 4초 간격 자동 갱신)

### Fixed
- 한글 버튼 텍스트("설정", "연결" 등)가 두 줄로 줄바꿈되던 레이아웃 버그 수정 (`button { white-space: nowrap }`)

### Changed
- "Start Sharing" 버튼의 카메라 이모지(🎥) 제거

### Docs
- [markdown/test-scenarios.md](markdown/test-scenarios.md) 테스트 시나리오 문서 추가
