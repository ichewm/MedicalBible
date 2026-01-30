# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装所有依赖（包括 devDependencies，用于构建）
RUN npm install && \
    npm cache clean --force

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# 安装 wget 用于健康检查，安装 mysql-client 用于初始化数据
RUN apk add --no-cache wget mysql-client bash

# 重新安装生产依赖
COPY package*.json ./
RUN npm install --only=production && \
    npm cache clean --force

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 复制启动脚本
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 创建上传目录
RUN mkdir -p /app/uploads

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# 启动应用
CMD ["/app/docker-entrypoint.sh"]
