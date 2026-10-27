# star.byb.kr 이미지: 정적 내보내기(out/)를 nginx로 내려준다. 빌드는 GitHub Actions에서 한다 (서버에서 빌드하지 않는다).
#   docker build -t star .   →   docker run -p 8080:80 star

# 1) 빌드: 별 데이터베이스(build/) → Next 정적 내보내기(out/)
FROM node:20.11.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN ./build_database.sh && npm run build

# 2) 내려주기: nginx에 out/ 과 설정만
FROM nginx:1.27-alpine AS runner
COPY ops/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
# 설정이 틀리면 여기서 이미지 빌드가 멈춰 서버까지 가지 않는다
RUN nginx -t
EXPOSE 80
