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

## Builder result

- **分支**：`feature/CR-014-T-001-docker`　**commit**：`ded2351`　**PR**：https://github.com/Tim-Lai-Admiral/AGdicom/pull/60
- **实现摘要**：多阶段 Dockerfile（node:24-alpine 构建 → nginx:alpine 托管）；nginx.conf（SPA try_files 回退、/assets/ 30d 缓存、gzip）；docker-compose.yml（workbench 服务，8080:80）；.dockerignore；README「Docker 运行」章节。应用代码零改动。
- **文件清单**：`Dockerfile`、`nginx.conf`、`docker-compose.yml`、`.dockerignore`（新建），`README.md`（新增 Docker 章节）
- **验证结果（docker compose build → up -d → down）**：
  - `docker compose build` 成功；容器内含自建 dist 与 public/samples（18 个 dicom）
  - `GET http://localhost:8080` → 200，含根 `div#root`
  - 深链接 `GET /some/path` → 200（SPA 回退，非 404）
  - `HEAD /samples/dicom/phantom-ct-01.dcm` → 200
  - `/assets/index-*.js` → 200，`Cache-Control: max-age=2592000, public, immutable`；gzip 生效（`Content-Encoding: gzip`）
  - 容器日志无异常；`docker compose down` 清理完成
- **已知限制 / 风险**：验证期间 Docker Hub 曾瞬时不可达（auth.docker.io 连接超时），重试拉取成功，与改动无关；本地 `dist/` 为旧产物（.dockerignore 已排除，镜像内自行构建，hash 不同属预期）
- **需 Reviewer 关注**：`.dockerignore` 排除范围（含 `*.md`、`scripts/`）是否覆盖预期；compose 端口 8080 冲突场景未处理（Out of scope）