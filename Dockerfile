FROM node:18-alpine

# 작업 디렉토리 생성
WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# 포트 노출 (3000: Web Server, 9000: PeerJS Signaling)
EXPOSE 3000
EXPOSE 9000

# 서버 시작
CMD ["npm", "start"]
