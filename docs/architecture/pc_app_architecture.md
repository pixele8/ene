# 工小聊 PC 端架构设计

## 1. 总览
PC 端采用 Electron + React + TypeScript 构建桌面客户端，通过 Node.js 进程集成原生能力，利用 Web 技术实现高效开发与后续 Android 端的代码复用（共享 UI 组件与状态逻辑）。

> 2025-10-01 更新：由于当前环境无法访问公共 npm 镜像，为了快速交付一个可运行的演示版本，仓库额外提供了一个零依赖的 HTML/CSS/ES Module 实现，并通过 Node.js 内置静态服务器启动。核心业务流程、权限分层、导出及自动化演示全部保留，后续在恢复正式开发环境后可将演示态迁回 Electron + React 架构。
>
> 2025-10-02 更新：桌面端与 Node.js 服务增加“演示 / 联机”模式切换，同一代码既能使用本地演示数据，也能通过 `/api` 接口写入内存版后端；新增 Electron 主进程脚本在启动时拉起服务器并暴露 `GXL_DESKTOP_API`，配套 `electron-builder` 可一键生成 Windows 可执行程序。

```
+--------------------+        +-------------------+
| Electron Renderer  |<------>|  GraphQL/REST API |
|  React UI + State  |        |  NestJS Services  |
+--------------------+        +-------------------+
        ^   |                          ^
        |   | WebSocket                |
        |   v                          |
+--------------------+        +-------------------+
| Electron Main Proc |<------>|  Event Bus / MQ   |
| IPC / FS / Native  |        |  Redis + BullMQ   |
+--------------------+        +-------------------+
```

## 2. 模块划分
### 2.1 Electron Main 进程
- 应用生命周期管理、自动更新。
- 启动阶段自动拉起桌面内置 Node.js 服务（`createDesktopServer`），并将实际监听端口注入 Renderer 端（`window.__GXL_BRIDGE__`）。
- IPC 通道暴露文件系统访问、打印、截图、相机调用等能力。
- 集成本地缓存（SQLite）实现离线数据暂存。

### 2.2 Renderer 进程（React）
- 使用 Vite 作为构建工具，TailwindCSS 实现微信风格 UI。
- 状态管理采用 Zustand + React Query，确保实时消息与工单数据同步。
- 新增演示 / 联机模式切换与手动同步按钮：演示模式直接引用内嵌 demo 数据，联机模式通过 `fetch /api/*` 调用内存服务实现增删改。
- 路由：主界面（工单聊天）+ 管理控制台（卡片看板）+ 设置。
- 工单对象新增 `watchers` 字段，Renderer 在聊天头部、洞察面板与导出模板中统一渲染关注人列表，并在本地/联机模式下保持格式一致。

### 2.3 服务端接口
- NestJS 提供统一 REST（工单 CRUD、权限、文件）和 WebSocket（即时消息、状态推送）接口。
- GraphQL 暴露复杂聚合（看板视图、报表统计）。
- 文件上传走对象存储（MinIO / S3），OCR 解析后写入 PostgreSQL。
- 当前原型阶段内置内存版工单服务，并通过 `WorkOrdersRepository` 抽象隔离存储细节，已支持 `POST /work-orders` 创建、`PATCH /work-orders/:id` 编辑、`PATCH /work-orders/:id/status` 状态流转与 `DELETE /work-orders/:id` 删除，为前端联调与后续落地 PostgreSQL/Redis 提供统一契约。
- 演示仓库中的 Node.js 服务器同步实现了上述接口的最小子集（工单拉取、消息追加、工序进度、闪电工单、快捷回复），供联机模式即时落盘。
- 服务端实体同步扩展 `watchers: string[]`，创建/更新时自动补齐负责人到关注人列表，以便后续推送、订阅和自动提醒流程引用。

### 2.4 订阅与授权服务
- 新增 `LicensesModule` 负责定价套餐、激活码与授权状态管理，当前以内存实现模拟云端发码流程。
- 暴露 `GET /licenses/plans`、`GET /licenses/status`、`POST /licenses/activate|renew|suspend|resume` 接口，桌面端可直接调用。
- 订阅信息后续将落库 PostgreSQL，并接入短信/邮件通知，实现续费提醒与自动化封停。 

### 2.5 快捷回复同步服务
- 新增 `QuickRepliesModule` 维护用户常用话术，提供 `GET /quick-replies/:userId`、`PATCH /quick-replies/:userId/add|remove` 接口。
- 以内存实现原型并预置默认短语，后续将落库 PostgreSQL，实现跨端共享与审计。
- 前端登录后自动拉取并在增删快捷回复时回写服务端，确保 PC、Android 端话术一致。

### 2.6 OCR 微服务
- FastAPI + Celery，使用 Tencent OCR API。
- 解析完成后生成标准化 Excel，存入对象存储并推送消息到 Redis 事件总线。

### 2.7 数据存储
- PostgreSQL：核心业务数据（用户、工单、工序、品质记录）。
- Redis：会话缓存、WebSocket 订阅、任务队列。
- MinIO：图纸、附件、自动生成的 Excel。

## 3. 关键流程
### 3.1 工单创建
1. 老板在 PC 端填写信息。
2. Renderer 通过 REST 调用 `POST /work-orders`。
3. 后端创建工序实例，写入数据库，发布 `workOrder.created` 事件。
4. WebSocket 向全体成员推送新工单消息，前端插入工单卡片并创建聊天会话。

### 3.2 文件上传与 OCR
1. 用户上传图纸 → Electron Main 负责读取文件，调用对象存储上传。
2. 上传完成后调用后端接口登记文件，后端向 OCR 微服务投递任务。
3. OCR 解析完成后生成 Excel，推送到指定聊天会话，并允许用户预览/下载/编辑。

### 3.3 工序完成 & 异常
1. 工人点击完成 → 输入数量 → Renderer 调用 `PATCH /work-orders/{id}/steps/{stepId}/progress`。
2. 后端校验配额，累加工序完成数与不良数，若存在不合格数则触发采购策略并回写总览指标。
3. 根据工单设置，自动生成采购需求消息并推送到对应采购工厂账号。
4. 若配置自动补料，生成闪电工单关联到当前工序。

### 3.4 数据导出
- 前端调用 `POST /reports/work-orders/{id}/export`，后端生成 Excel/PDF，通过对象存储返回下载链接。
- 送货单、对账单基于模板引擎（Handlebars）渲染。
- 桌面端在导出前提供本地预览与一键复制能力，方便老板校对数据后再触发下载。
- 离线演示模式下新增生产日报、送货单、对账单与生产日志四类本地模板，使用 CSV/TXT 字符串即时生成示例票据，并复用打印弹窗展示
  元数据与内容。

## 4. 技术选型
- **Electron Forge** + Vite + React。
- `electron-builder` 负责跨平台打包，当前预配置 `portable` 与 `nsis` 目标以生成 Windows 可执行程序。
- **TypeScript** 全覆盖，统一 ESLint + Prettier。
- 单元测试：Jest；端到端测试：Playwright（模拟核心流程）。
- CI/CD：GitHub Actions 构建跨平台安装包，采用 Squirrel.Windows / AppImage。

## 5. 安全与合规
- 登录令牌使用 JWT，敏感操作需二次校验（如删除工单）。
- 消息与文件使用 HTTPS + WSS，内部服务间通过 mTLS。
- 审计日志记录关键操作（工单编辑、删除、权限调整）。

## 6. 后续扩展
- 引入 AI 质检建议（基于历史不合格数据训练模型）。
- 支持移动端共享组件库（React Native + Expo），借助 GraphQL 实现数据同步。
- 多语言支持（中文简体 / 英文）。

