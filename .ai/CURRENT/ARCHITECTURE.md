# Current Architecture

> 本文件是当前主线架构，而不是设计草案。每个已合并的架构变更应在此反映，并链接来源 CR/ADR。

## System overview

```text
<!-- External user/system → entry point → core services → storage/integrations -->
```

## Module boundaries

| Module | Owns | May depend on | Must not depend on |
|---|---|---|---|
| <!-- module --> | <!-- responsibility --> | <!-- allowed --> | <!-- forbidden --> |

## Data and API contracts

<!-- 稳定的数据模型、事件、外部 API 与关键不变量。 -->

## Dependency rules

- <!-- 例：UI 可调用 application service，但不可直接读 repository。 -->

## Architecture decisions

| ADR | Decision | Status |
|---|---|---|
| <!-- ADR-001 --> | <!-- decision --> | accepted |

## Last updated

- Date: YYYY-MM-DD
- Source: initial baseline / CR-XXX
- Approved by: Human
