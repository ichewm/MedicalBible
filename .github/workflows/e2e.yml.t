# E2E 测试工作流
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: testpassword
          MYSQL_DATABASE: medical_bible_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping -h localhost"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

      redis:
        image: redis:6.2-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd="redis-cli ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"

      - name: Install backend dependencies
        working-directory: server
        run: npm ci

      - name: Install frontend dependencies
        working-directory: web
        run: npm ci

      - name: Install Playwright browsers
        working-directory: web
        run: npx playwright install --with-deps chromium

      - name: Start backend server
        working-directory: server
        run: npm run start:dev &
        env:
          DB_HOST: localhost
          DB_PORT: 3306
          DB_USERNAME: root
          DB_PASSWORD: testpassword
          DB_DATABASE: medical_bible_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          JWT_SECRET: test-jwt-secret-for-e2e
          NODE_ENV: test

      - name: Wait for backend
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:3000/api/v1/health; do sleep 2; done'

      - name: Start frontend server
        working-directory: web
        run: npm run dev &
        env:
          VITE_API_BASE_URL: http://localhost:3000/api/v1

      - name: Wait for frontend
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:5173; do sleep 2; done'

      - name: Run E2E tests
        working-directory: web
        run: npm run test:e2e
        env:
          CI: true
          PLAYWRIGHT_BASE_URL: http://localhost:5173

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: web/playwright-report/
          retention-days: 30

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: web/test-results/
          retention-days: 7
