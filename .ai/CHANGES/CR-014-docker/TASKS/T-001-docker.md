# Task T-001: Docker 化

## Metadata

```yaml
id: T-001
cr: CR-014
type: feature
status: planned
owner: Builder
reviewer: Reviewer
priority: high
expected_steps: 12
depends_on: []
branch: feature/CR-014-T-001-docker
```

## Context pack

- Requirement: R-034
- 关键文件（全部新建）：`Dockerfile`（多阶段：`node:24-alpine` 构建 `npm ci && npm run build` → `nginx:alpine` 复制 dist + nginx.conf）、`nginx.conf`（SPA try_files 回退 index.html；静态资源缓存；gzip）、`docker-compose.yml`（服务 workbench：build .，ports "8080:80"，restart 可选）、`.dockerignore`（node_modules/dist/.git/.ai/scaffold/rec 等）、README.md（Docker 章节）
- 环境：本机 Docker 29.7.2 可用；构建产物 dist/ 含 public/samples（dicom/stl 已移除 stl，dicom 保留）随镜像
- 禁止：改应用代码；改 CI（如需 docker 构建 CI 属后续）

## Objective

`docker compose up --build` 一键构建并运行项目（http://localhost:8080）。

## Scope

- 上述 5 个文件；验证：`docker compose build` 成功 + `docker compose up -d` 后 `Invoke-WebRequest http://localhost:8080` 200 且 `/src/...`（SPA 路由）回退正常 + 容器日志无异常 → 清理容器（down）
- README Docker 章节：构建/启动/端口/停止命令
- 测试：无单元测试（容器冒烟为验证方式）

## Out of scope

- CI 推送镜像；HTTPS；多环境 compose

## Acceptance criteria

- [ ] `docker compose build` 成功（镜像含 dist 与 samples）
- [ ] `docker compose up` 后 8080 HTTP 200；刷新/深链接路由回退 index.html（SPA 不 404）
- [ ] README Docker 章节可复现
- [ ] 应用代码零改动

## Test requirements

- [ ] Manual: 上述容器冒烟命令（结果记录在 Builder result）

## Definition of done

- [ ] 验收通过；PR（body 写概要）；Reviewer 审查