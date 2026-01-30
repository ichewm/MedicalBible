version: 2
updates:
  # 后端依赖更新
  - package-ecosystem: "npm"
    directory: "/server"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Asia/Shanghai"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "backend"
    commit-message:
      prefix: "chore(deps)"
    groups:
      nestjs:
        patterns:
          - "@nestjs/*"
      typeorm:
        patterns:
          - "typeorm"
          - "@nestjs/typeorm"
      testing:
        patterns:
          - "jest"
          - "@types/jest"
          - "supertest"
      types:
        patterns:
          - "@types/*"

  # 前端依赖更新
  - package-ecosystem: "npm"
    directory: "/web"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Asia/Shanghai"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "frontend"
    commit-message:
      prefix: "chore(deps)"
    groups:
      react:
        patterns:
          - "react"
          - "react-dom"
          - "@types/react*"
      antd:
        patterns:
          - "antd"
          - "@ant-design/*"
      vite:
        patterns:
          - "vite"
          - "@vitejs/*"
      testing:
        patterns:
          - "vitest"
          - "@testing-library/*"
          - "playwright"

  # GitHub Actions 更新
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    labels:
      - "dependencies"
      - "ci"
    commit-message:
      prefix: "chore(ci)"
