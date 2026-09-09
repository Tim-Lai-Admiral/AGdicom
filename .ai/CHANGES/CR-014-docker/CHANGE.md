# CR-014: Docker 化（镜像构建 + docker compose 一键运行）

## Metadata

```yaml
id: CR-014
title: "Docker Compose 构建镜像并运行项目（静态 SPA 交付）"
change_level: L2
status: completed
parent: null
created_by: Planner
created_at: 2026-09-09
```

## Why

Human 指示：用 docker compose 让项目可构建镜像。项目为纯前端 SPA（Vite 构建产物 dist/ 静态文件），适合多阶段构建（node 构建 → nginx 托管）。

## Goal

- `Dockerfile` 多阶段构建（node:24-alpine 构建 → nginx:alpine 运行）。
- `nginx.conf`：SPA 路由回退（try_files）、静态资源 gzip/缓存。
- `docker-compose.yml`：`docker compose up --build` 一键启动（宿主机端口 8080 → 容器 80）。
- `.dockerignore`：排除 node_modules/dist/.git/.ai 等。
- README 增加 Docker 构建与运行说明。

## Non-goals

- 后端服务容器化（本项目无后端）；HTTPS/TLS 配置；CI 镜像推送。

## Requirement changes

### Added

- R-034: Docker 交付：Dockerfile 多阶段 + nginx SPA 配置 + docker compose 一键构建运行（宿主 8080）；离线素材（public/samples）随镜像包含。

## Impact summary

| Area | None / minor / major | Notes |
|---|---|---|
| Product | none | 交付方式 |
| Architecture | minor | 容器化静态托管 |
| Testing | minor | 镜像构建 + 容器冒烟（HTTP 200 + SPA 回退） |

## Tasks

- [x] T-001: Docker 化（Dockerfile/nginx.conf/compose/.dockerignore/README）

## Dependencies

- 无（当前 master）

## Approval

- [x] Human approved（2026-09-09 指示）

## Result

- 2026-09-09 完成。T-001 合并至 master（PR #60，分支已删）；审查 PASS（REVIEW-CR014.md，独立复跑 451 存量 + 容器冒烟全过）。
- 非阻塞：nginx server_tokens off 可选加固；container_name 硬编码；.dockerignore *.md 排除 README（不影响构建）——登记 TODO 或后续顺手。
- CURRENT 已更新（REQUIREMENTS R-034、ARCHITECTURE 容器化部署），Tag v0.8.0。