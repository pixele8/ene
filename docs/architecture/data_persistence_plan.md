# 工小聊 数据持久化迁移计划

> 更新时间：2025-10-03
>
> 目的：定义当前内存原型与未来 PostgreSQL / Redis / 对象存储方案之间的映射关系，为演示模式迁移回 Electron + React 正式框架及联机模式上线奠定基础。

## 1. 仓储抽象
- NestJS 后端引入 `WorkOrdersRepository` 接口，当前由 `InMemoryWorkOrdersRepository` 实现。
- 未来将新增 `PostgresWorkOrdersRepository`，通过 TypeORM/Prisma 连接 PostgreSQL，复用同一接口以避免业务逻辑改动。
- Redis 将承担实时指标缓存与未读消息计数，仓储层将提供读写分离策略：主存 PostgreSQL，Redis 作为加速与事件推送来源。

## 2. 数据表设计草案
| 表名 | 说明 | 关键字段 |
| ---- | ---- | -------- |
| `work_orders` | 工单主表 | `id`, `code`, `title`, `priority`, `status`, `owner_id`, `start_at`, `end_at`, `target_quantity`, `procurement_auto_notify`, `target_factory_id` |
| `work_order_steps` | 工序明细 | `id`, `work_order_id`, `step_code`, `step_name`, `assignee_id`, `expected_quantity`, `completed_quantity`, `defective_quantity`, `estimated_completion_at`, `status` |
| `work_order_messages` | 聊天/系统消息 | `id`, `work_order_id`, `message_type`, `payload`, `created_by`, `created_at` |
| `work_order_progress_logs` | 工序完成记录 | `id`, `work_order_id`, `step_code`, `completed_quantity`, `defective_quantity`, `confirmation_mode`, `confirmed_by`, `confirmed_at` |
| `customer_accesses` | 客户临时账号 | `id`, `work_order_id`, `customer_name`, `company`, `contact_phone`, `login`, `password_hash`, `status`, `created_at`, `confirmed_at` |
| `quick_replies` | 快捷回复 | `id`, `owner_id`, `role`, `content`, `created_at`, `updated_at` |
| `licenses` | 授权激活码 | `id`, `plan`, `status`, `activated_at`, `expires_at`, `suspended_at`, `metadata` |

附件、OCR 结果等大文件统一写入对象存储（MinIO/S3），数据库仅保存引用信息。

## 3. 数据同步流程
1. **演示模式**：继续调用内存实现，所有写入操作通过仓储层回放到内存 Map。
2. **联机模式**：
   - REST 请求进入 `WorkOrdersService`，先写 PostgreSQL，再将变更事件投递到 Redis Stream，用于桌面端 WebSocket 与移动端同步。
   - 读取接口优先访问 Redis 缓存，未命中时回源 PostgreSQL 并回填缓存。
3. **OCR 与附件**：文件上传后触发 OCR 微服务处理，结果 JSON/Excel 存储到对象存储，并向 Redis 发布 `ocr.completed` 事件。

## 4. 迁移节奏
- **阶段 1**：保持 `InMemoryWorkOrdersRepository`，在服务层完成功能迭代；补充仓储接口的集成测试。
- **阶段 2**：实现 `PostgresWorkOrdersRepository` 并引入数据库迁移脚本（Prisma Migrate 或 TypeORM Migration）。同时为 Redis 引入连接工厂。
- **阶段 3**：桌面端 Electron 版本切回 React/Vite，利用同一 REST/WebSocket 契约访问后端，实现演示与联机共享组件。

## 5. 风险与对策
- **网络受限**：保留零依赖演示方案，保证断网环境可验收；同时预置离线缓存策略。
- **数据一致性**：关键写操作使用数据库事务，Redis 仅作缓存，必要时通过消息重放恢复状态。
- **授权安全**：授权码和客户临时账号存储加盐哈希，并记录审计日志，结合 Redis 限流防止暴力破解。

