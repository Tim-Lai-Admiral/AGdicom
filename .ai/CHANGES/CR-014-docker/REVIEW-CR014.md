# Review: T-001（Docker 化）

## Metadata

```yaml
task: T-001
cr: CR-014
reviewer: Reviewer
target_commit_or_pr: "https://github.com/Tim-Lai-Admiral/AGdicom/pull/60"
date: 2026-09-09
result: PASS
```

## Scope and requirement check

| Check | Result | Evidence / note |
|---|---|---|
| Task objective satisfied | pass | `docker compose up --build` 构建并运行成功，http://localhost:8080 可访问（独立复跑） |
| Acceptance criteria | pass | 4 项验收全部满足（见 Tests） |
| No out-of-scope changes | pass | `git diff master...HEAD --name-only` 仅含 5 个交付文件 + T-001 任务卡；无 src/public/CI 改动 |
| CURRENT/architecture respected | pass | 纯静态 SPA 多阶段容器化，符合 CR-014 Goal（L2），未触及后端/HTTPS/CI（Non-goals） |

R-034 对照：Dockerfile 多阶段（node:24-alpine → nginx:alpine）✓、nginx SPA 配置 ✓、compose 一键构建运行（宿主 8080→容器 80）✓、离线素材 public/samples 随镜像（镜像内确认 18 个 dicom）✓。

## Tests

| Verification | Result | Evidence |
|---|---|---|
| verify.ps1（单测 + 构建） | pass | 451 passed（43 files），`npm run build` OK，`== verify OK ==`；与存量 451 基线一致，应用代码零改动 → 全绿 |
| CI（.github/workflows/ci.yml "verify"） | pass | `gh pr checks 60` → `verify pass (1m0s)` |
| 容器冒烟（独立复跑） | pass | 见下，全部通过 |

容器冒烟独立复跑结果（`docker compose build` → `up -d` → 探测 → `down`）：

| 检查项 | 结果 |
|---|---|
| `docker compose build` | ✅ 成功（多阶段，镜像 `agdicom-workbench`，npm ci + npm run build 缓存命中） |
| 镜像内容 | ✅ 含 dist（index.html + assets/ + fonts/）与 `samples/dicom/` 18 个 dicom |
| `GET /` | ✅ 200，含 `div#root`（index.html 421B） |
| 深链接 `GET /some/path` | ✅ 200（SPA try_files 回退，非 404） |
| `HEAD /samples/dicom/phantom-ct-01.dcm` | ✅ 200，Content-Length 17228 |
| 资源缓存 `GET /assets/index-CW6aKPuL.js` | ✅ 200，`Cache-Control: max-age=2592000,public, immutable`，`Expires` 30 天后 |
| gzip（GET + `Accept-Encoding: gzip`） | ✅ `Content-Encoding: gzip` |
| 缺失资源 `GET /assets/nonexistent-xyz.js` | ✅ 404（`try_files $uri =404` 正确） |
| 容器日志 | ✅ 仅 notice/startup，无异常 |
| `docker compose down` | ✅ 容器/网络清理完成 |

注：HEAD 请求下 nginx 默认不触发 gzip（`Content-Encoding` 为空），GET 请求正常返回 gzip —— 属 nginx 正常行为，Builder 声明（GET gzip）与实际一致。

## Findings

### Blocker

- None.

### Major

- None.

### Minor / non-blocking

- `nginx.conf:2` 未设置 `server_tokens off`：会透露 nginx 版本号，属可选加固（审查要点已标「可选」），不阻塞。
- `docker-compose.yml:6` `container_name: workbench` 硬编码容器名：同一宿主机多实例/多项目同目录运行时可能冲突；单服务场景无碍，不阻塞。
- `.dockerignore:11` `*.md` 会连 README 一并排除出构建上下文：构建不依赖 md，无实际影响；读者可自行决定是否保留 README 进入上下文（非必需）。
- `docker-compose.yml` 未写 `version` 字段：现代 compose（v5.5.0）已废弃，为正确写法的省略，无问题。

## Recommendation

PASS —— 满足 R-034 与 T-001 全部验收标准，独立复跑（verify 451 全绿 + 容器冒烟全过）与 Builder 声明一致，应用代码零改动。可选加固项（server_tokens off、container_name 冲突）建议记录为技术债，不阻塞合并。
