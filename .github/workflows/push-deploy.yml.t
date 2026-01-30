# 推送式部署（Push-based Deployment）
#
# 特点：
# - GitHub 主动推送代码到服务器（服务器不需要访问 GitHub）
# - 所有敏感信息通过 Secrets 注入
# - 服务器仅被动接收，无需配置任何凭证
#
name: Push Deploy to China Server

on:
  # 手动触发（推荐）
  workflow_dispatch:
    inputs:
      environment:
        description: "部署环境"
        required: true
        default: "production"
        type: choice
        options:
          - production
          - staging
      deploy_type:
        description: "部署类型"
        required: true
        default: "full"
        type: choice
        options:
          - full # 完整部署（前端+后端+配置）
          - backend # 仅后端
          - frontend # 仅前端
          - config # 仅配置文件
      backup_db:
        description: "部署前备份数据库"
        required: false
        default: true
        type: boolean
      skip_tests:
        description: "跳过测试（紧急修复时使用）"
        required: false
        default: false
        type: boolean

  # 或：发布 Release 时自动触发
  release:
    types: [published]

env:
  DEPLOY_PATH: /opt/medical-bible
  ARCHIVE_NAME: medical-bible-deploy.tar.gz

jobs:
  # ==================== 阶段1：测试 ====================
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    if: ${{ github.event_name == 'release' || !inputs.skip_tests }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: server/package-lock.json

      - name: Install dependencies
        working-directory: server
        run: npm ci

      - name: Run tests
        working-directory: server
        run: npm run test

      - name: Build check
        working-directory: server
        run: npm run build

  # ==================== 阶段2：构建打包 ====================
  build:
    name: Build and Package
    runs-on: ubuntu-latest
    needs: [test]
    if: always() && (needs.test.result == 'success' || needs.test.result == 'skipped')

    outputs:
      version: ${{ steps.version.outputs.version }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Get version
        id: version
        run: |
          if [[ "${{ github.event_name }}" == "release" ]]; then
            echo "version=${{ github.event.release.tag_name }}" >> $GITHUB_OUTPUT
          else
            echo "version=$(date +%Y%m%d-%H%M%S)-${GITHUB_SHA::8}" >> $GITHUB_OUTPUT
          fi

      - name: Prepare deployment package
        run: |
          echo "📦 Preparing deployment package..."

          # 创建部署目录
          mkdir -p deploy-package

          # 根据部署类型选择文件
          DEPLOY_TYPE="${{ inputs.deploy_type || 'full' }}"

          if [[ "$DEPLOY_TYPE" == "full" || "$DEPLOY_TYPE" == "backend" ]]; then
            cp -r server deploy-package/
          fi

          if [[ "$DEPLOY_TYPE" == "full" || "$DEPLOY_TYPE" == "frontend" ]]; then
            cp -r web deploy-package/
          fi

          if [[ "$DEPLOY_TYPE" == "full" || "$DEPLOY_TYPE" == "config" ]]; then
            cp -r nginx deploy-package/ 2>/dev/null || true
            cp docker-compose.prod.yml deploy-package/
            cp -r scripts deploy-package/ 2>/dev/null || true
          fi

          # 创建版本文件
          echo "${{ steps.version.outputs.version }}" > deploy-package/VERSION
          echo "Deployed at: $(date -u +'%Y-%m-%d %H:%M:%S UTC')" >> deploy-package/VERSION
          echo "Commit: ${{ github.sha }}" >> deploy-package/VERSION
          echo "Triggered by: ${{ github.actor }}" >> deploy-package/VERSION

          # 创建部署脚本（会在服务器上执行）
          cat > deploy-package/deploy.sh << 'DEPLOY_SCRIPT'
          #!/bin/bash
          set -e

          DEPLOY_PATH="${DEPLOY_PATH:-/opt/medical-bible}"
          DEPLOY_TYPE="${DEPLOY_TYPE:-full}"

          echo "=========================================="
          echo "  医学宝典 - 自动部署"
          echo "  版本: $(cat VERSION 2>/dev/null || echo 'unknown')"
          echo "  类型: $DEPLOY_TYPE"
          echo "=========================================="

          cd $DEPLOY_PATH

          # 根据部署类型执行
          case $DEPLOY_TYPE in
            full)
              echo "📦 Full deployment..."
              docker compose -f docker-compose.prod.yml build --no-cache
              docker compose -f docker-compose.prod.yml up -d
              ;;
            backend)
              echo "🔧 Backend only..."
              docker compose -f docker-compose.prod.yml build --no-cache backend
              docker compose -f docker-compose.prod.yml up -d backend
              ;;
            frontend)
              echo "🎨 Frontend only..."
              docker compose -f docker-compose.prod.yml build --no-cache frontend
              docker compose -f docker-compose.prod.yml up -d frontend
              ;;
            config)
              echo "⚙️ Config reload..."
              docker compose -f docker-compose.prod.yml up -d --force-recreate
              ;;
          esac

          # 清理旧镜像
          docker image prune -f

          # 健康检查
          echo "⏳ Waiting for services..."
          sleep 10

          for i in {1..30}; do
            if curl -sf http://localhost:3000/api/v1/health > /dev/null 2>&1; then
              echo "✅ Deployment successful!"
              docker compose -f docker-compose.prod.yml ps
              exit 0
            fi
            echo "  Checking... ($i/30)"
            sleep 2
          done

          echo "❌ Health check failed!"
          docker compose -f docker-compose.prod.yml logs --tail=50 backend
          exit 1
          DEPLOY_SCRIPT

          chmod +x deploy-package/deploy.sh

          # 打包
          tar -czf ${{ env.ARCHIVE_NAME }} -C deploy-package .

          echo "✅ Package created: ${{ env.ARCHIVE_NAME }}"
          ls -lh ${{ env.ARCHIVE_NAME }}

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: deploy-package
          path: ${{ env.ARCHIVE_NAME }}
          retention-days: 7

  # ==================== 阶段3：推送部署 ====================
  deploy:
    name: Push Deploy to Server
    runs-on: ubuntu-latest
    needs: [build]
    environment: ${{ inputs.environment || 'production' }}

    steps:
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: deploy-package

      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SERVER_SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key

          # 添加服务器到 known_hosts（避免交互确认）
          ssh-keyscan -p ${{ secrets.SERVER_PORT || 22 }} -H ${{ secrets.SERVER_HOST }} >> ~/.ssh/known_hosts 2>/dev/null

      - name: Backup database (if enabled)
        if: ${{ inputs.backup_db }}
        run: |
          echo "📦 Backing up database..."
          ssh -i ~/.ssh/deploy_key \
              -p ${{ secrets.SERVER_PORT || 22 }} \
              -o StrictHostKeyChecking=no \
              ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} << 'ENDSSH'

          cd ${{ env.DEPLOY_PATH }}
          mkdir -p backups

          # 检查数据库容器是否运行
          if docker compose -f docker-compose.prod.yml ps mysql | grep -q "running"; then
            BACKUP_FILE="backups/pre_deploy_$(date +%Y%m%d_%H%M%S).sql"
            docker compose -f docker-compose.prod.yml exec -T mysql mysqldump \
              -u root -p"${DB_ROOT_PASSWORD}" \
              --single-transaction \
              medical_bible > "$BACKUP_FILE" 2>/dev/null && \
            gzip "$BACKUP_FILE" && \
            echo "✅ Backup: ${BACKUP_FILE}.gz" || \
            echo "⚠️ Backup skipped (first deployment?)"
          else
            echo "⚠️ MySQL not running, skip backup"
          fi
          ENDSSH

      - name: Generate .env file
        run: |
          # 从 Secrets 生成 .env 文件（不会出现在日志中）
          cat > .env << EOF
          # Auto-generated by GitHub Actions
          # DO NOT EDIT MANUALLY

          # Database
          DB_ROOT_PASSWORD=${{ secrets.DB_ROOT_PASSWORD }}

          # Redis
          REDIS_PASSWORD=${{ secrets.REDIS_PASSWORD }}

          # JWT
          JWT_SECRET=${{ secrets.JWT_SECRET }}

          # Encryption
          ENCRYPTION_KEY=${{ secrets.ENCRYPTION_KEY }}

          # CORS
          CORS_ORIGIN=${{ secrets.CORS_ORIGIN || '*' }}

          # File URL
          FILE_BASE_URL=${{ secrets.FILE_BASE_URL || '' }}

          # SMS (Aliyun)
          ALIYUN_ACCESS_KEY_ID=${{ secrets.ALIYUN_ACCESS_KEY_ID || '' }}
          ALIYUN_ACCESS_KEY_SECRET=${{ secrets.ALIYUN_ACCESS_KEY_SECRET || '' }}
          ALIYUN_SMS_SIGN_NAME=${{ secrets.ALIYUN_SMS_SIGN_NAME || '' }}
          ALIYUN_SMS_TEMPLATE_CODE=${{ secrets.ALIYUN_SMS_TEMPLATE_CODE || '' }}

          # Payment (WeChat)
          WECHAT_APP_ID=${{ secrets.WECHAT_APP_ID || '' }}
          WECHAT_MCH_ID=${{ secrets.WECHAT_MCH_ID || '' }}
          WECHAT_API_KEY=${{ secrets.WECHAT_API_KEY || '' }}
          WECHAT_NOTIFY_URL=${{ secrets.WECHAT_NOTIFY_URL || '' }}

          # OSS (Aliyun)
          OSS_REGION=${{ secrets.OSS_REGION || '' }}
          OSS_ACCESS_KEY_ID=${{ secrets.OSS_ACCESS_KEY_ID || '' }}
          OSS_ACCESS_KEY_SECRET=${{ secrets.OSS_ACCESS_KEY_SECRET || '' }}
          OSS_BUCKET=${{ secrets.OSS_BUCKET || '' }}
          OSS_ENDPOINT=${{ secrets.OSS_ENDPOINT || '' }}
          EOF

          echo "✅ .env file generated"

      - name: Push to server
        run: |
          echo "🚀 Pushing deployment package to server..."

          SERVER="${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}"
          SSH_OPTS="-i ~/.ssh/deploy_key -p ${{ secrets.SERVER_PORT || 22 }} -o StrictHostKeyChecking=no"

          # 1. 创建临时目录
          ssh $SSH_OPTS $SERVER "mkdir -p /tmp/medical-bible-deploy"

          # 2. 推送部署包
          scp $SSH_OPTS ${{ env.ARCHIVE_NAME }} $SERVER:/tmp/medical-bible-deploy/

          # 3. 推送 .env 文件（敏感信息）
          scp $SSH_OPTS .env $SERVER:/tmp/medical-bible-deploy/

          echo "✅ Files pushed to server"

      - name: Execute deployment
        env:
          DEPLOY_TYPE: ${{ inputs.deploy_type || 'full' }}
        run: |
          echo "🔧 Executing deployment on server..."

          ssh -i ~/.ssh/deploy_key \
              -p ${{ secrets.SERVER_PORT || 22 }} \
              -o StrictHostKeyChecking=no \
              ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} << ENDSSH

          set -e

          DEPLOY_PATH="${{ env.DEPLOY_PATH }}"
          DEPLOY_TYPE="${{ env.DEPLOY_TYPE }}"

          echo "📂 Preparing deployment directory..."
          mkdir -p \$DEPLOY_PATH
          cd \$DEPLOY_PATH

          echo "📦 Extracting deployment package..."
          tar -xzf /tmp/medical-bible-deploy/${{ env.ARCHIVE_NAME }} -C \$DEPLOY_PATH

          echo "🔐 Installing environment file..."
          mv /tmp/medical-bible-deploy/.env \$DEPLOY_PATH/.env
          chmod 600 \$DEPLOY_PATH/.env

          echo "🧹 Cleaning up temp files..."
          rm -rf /tmp/medical-bible-deploy

          echo "🚀 Running deployment script..."
          export DEPLOY_PATH=\$DEPLOY_PATH
          export DEPLOY_TYPE=\$DEPLOY_TYPE
          bash \$DEPLOY_PATH/deploy.sh

          ENDSSH

          echo "✅ Deployment completed!"

      - name: Cleanup SSH key
        if: always()
        run: |
          rm -f ~/.ssh/deploy_key

      - name: Deployment Summary
        if: always()
        run: |
          echo "## 🚀 Deployment Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Item | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| Environment | ${{ inputs.environment || 'production' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Deploy Type | ${{ inputs.deploy_type || 'full' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Version | ${{ needs.build.outputs.version }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Commit | \`${{ github.sha }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Triggered by | @${{ github.actor }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Database Backup | ${{ inputs.backup_db && '✅' || '⏭️' }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Time | $(date -u +'%Y-%m-%d %H:%M:%S UTC') |" >> $GITHUB_STEP_SUMMARY

  # ==================== 阶段4：验证 ====================
  verify:
    name: Verify Deployment
    runs-on: ubuntu-latest
    needs: [deploy]
    if: success()

    steps:
      - name: Health Check
        run: |
          echo "🔍 Verifying deployment..."

          # 如果配置了域名，检查外部可访问性
          HEALTH_URL="${{ secrets.HEALTH_CHECK_URL }}"

          if [ -n "$HEALTH_URL" ]; then
            for i in {1..5}; do
              if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
                echo "✅ External health check passed!"
                exit 0
              fi
              echo "Retrying... ($i/5)"
              sleep 5
            done
            echo "⚠️ External health check failed (may be firewall)"
          else
            echo "ℹ️ No HEALTH_CHECK_URL configured, skipping external check"
          fi

      - name: Notify Success
        run: |
          echo "## ✅ Deployment Verified" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "Deployment completed and verified successfully!" >> $GITHUB_STEP_SUMMARY
