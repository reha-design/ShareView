FROM node:18-alpine

# 작업 디렉토리 생성
WORKDIR /app

# 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# 포트 노출 (3000: HTTPS 웹 서버 + PeerJS 시그널링)
EXPOSE 3000

# 서버 시작
CMD ["npm", "start"]
