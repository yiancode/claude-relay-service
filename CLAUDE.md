# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

这个文件为 Claude Code (claude.ai/code) 提供在此代码库中工作的指导。

## 项目概述

Claude Relay Service 是一个功能完整的 AI API 中转服务，支持 Claude 和 Gemini 双平台。提供多账户管理、API Key 认证、代理配置和现代化 Web 管理界面。该服务作为客户端（如 SillyTavern、Claude Code、Gemini CLI）与 AI API 之间的中间件，提供认证、限流、监控等功能。

## 核心架构

### 关键架构概念

- **代理认证流**: 客户端用自建API Key → 验证 → 获取Claude账户OAuth token → 转发到Anthropic
- **Token管理**: 自动监控OAuth token过期并刷新，支持10秒提前刷新策略
- **代理支持**: 每个Claude账户支持独立代理配置，OAuth token交换也通过代理进行
- **数据加密**: 敏感数据（refreshToken, accessToken）使用AES加密存储在Redis

### 主要服务组件

- **claudeRelayService.js**: 核心代理服务，处理请求转发和流式响应
- **claudeAccountService.js**: Claude账户管理，OAuth token刷新和账户选择
- **geminiAccountService.js**: Gemini账户管理，Google OAuth token刷新和账户选择
- **apiKeyService.js**: API Key管理，验证、限流和使用统计
- **oauthHelper.js**: OAuth工具，PKCE流程实现和代理支持

### 认证和代理流程

1. 客户端使用自建API Key（cr\_前缀格式）发送请求
2. authenticateApiKey中间件验证API Key有效性和速率限制
3. claudeAccountService自动选择可用Claude账户
4. 检查OAuth access token有效性，过期则自动刷新（使用代理）
5. 移除客户端API Key，使用OAuth Bearer token转发请求
6. 通过账户配置的代理发送到Anthropic API
7. 流式或非流式返回响应，记录使用统计

### OAuth集成

- **PKCE流程**: 完整的OAuth 2.0 PKCE实现，支持代理
- **自动刷新**: 智能token过期检测和自动刷新机制
- **代理支持**: OAuth授权和token交换全程支持代理配置
- **安全存储**: claudeAiOauth数据加密存储，包含accessToken、refreshToken、scopes

### 多服务架构核心

该服务支持多个AI提供商，每个都有独立的服务层：

- **Claude服务链**:
  - `claudeAccountService.js`: OAuth账户管理和token刷新
  - `claudeRelayService.js`: 请求转发和流式响应处理  
  - `unifiedClaudeScheduler.js`: 账户调度和负载均衡

- **Gemini服务链**:
  - `geminiAccountService.js`: Google OAuth管理
  - `geminiRelayService.js`: Gemini API请求转发
  - `unifiedGeminiScheduler.js`: Gemini账户调度

- **OpenAI兼容层**:
  - `openaiToClaude.js`: OpenAI格式到Claude格式的转换
  - `openaiAccountService.js`: OpenAI账户管理
  - 支持多种OpenAI兼容端点

- **CCR服务链** (Claude Console Relay):
  - `ccrAccountService.js`: CCR账户管理，支持API Key配置
  - `ccrRelayService.js`: CCR请求转发和代理处理
  - 支持用户自定义API URL和代理设置

- **Claude Console服务链**:
  - `claudeConsoleAccountService.js`: Claude Console账户管理
  - `claudeConsoleRelayService.js`: Claude Console API中转
  - 专用的Console API端点支持

- **Bedrock服务链** (AWS Bedrock):
  - `bedrockAccountService.js`: Bedrock账户管理，AWS凭据配置
  - `bedrockRelayService.js`: Bedrock API请求转发
  - 支持AWS Claude模型调用

- **统一认证层**:
  - `apiKeyService.js`: API Key验证、限流、使用统计
  - `middleware/auth.js`: 请求认证中间件
  - 支持客户端限制和速率控制

## 常用命令

### 基本开发命令

````bash
# 安装依赖和初始化
npm install
npm run setup                  # 生成配置和管理员凭据
npm run install:web           # 安装Web界面依赖

# 开发和运行
npm run dev                   # 开发模式（热重载）
npm start                     # 生产模式
npm test                      # 运行测试（注意：当前项目缺少实际测试文件）
npm run lint                  # 代码检查和自动修复（ESLint + Prettier）
npm run lint:check            # 代码检查（不自动修复）
npm run format                # Prettier格式化所有文件
npm run format:check          # 检查格式但不修复

# Web界面开发
cd web/admin-spa
npm run dev                   # 前端开发服务器
npm run build                 # 构建前端
npm run lint                  # 前端代码检查

# Docker部署
docker-compose up -d          # 推荐方式
docker-compose --profile monitoring up -d  # 包含监控
npm run docker:build         # 构建Docker镜像
npm run docker:up            # 启动Docker容器
npm run docker:down          # 停止Docker容器

# 服务管理
npm run service:start:daemon  # 后台启动（推荐）
npm run service:start         # 前台启动
npm run service:status        # 查看服务状态
npm run service:logs          # 查看日志
npm run service:logs:follow   # 实时跟踪日志
npm run service:stop          # 停止服务
npm run service:restart       # 重启服务
npm run service:restart:daemon # 后台重启

# 数据管理和迁移
npm run data:export           # 导出数据
npm run data:import           # 导入数据
npm run data:export:sanitized # 导出脱敏数据
npm run data:debug            # 调试Redis键
npm run migrate:apikey-expiry # 迁移API Key过期时间
npm run migrate:apikey-expiry:dry # 迁移预演（不实际执行）

# 价格和成本管理
npm run update:pricing        # 更新模型价格数据
npm run init:costs            # 初始化成本数据
npm run test:pricing-fallback # 测试价格回退机制

# 系统监控和状态
npm run monitor               # 增强监控脚本
npm run status                # 统一状态检查
npm run status:detail         # 详细状态信息

### 开发环境配置
必须配置的环境变量：
- `JWT_SECRET`: JWT密钥（32字符以上随机字符串）
- `ENCRYPTION_KEY`: 数据加密密钥（32字符固定长度）
- `REDIS_HOST`: Redis主机地址（默认localhost）
- `REDIS_PORT`: Redis端口（默认6379）
- `REDIS_PASSWORD`: Redis密码（可选）

配置文件要求：
- `config/config.js`: 基于 `config/config.example.js` 创建
- 支持多种AI服务的配置：Claude、Gemini、OpenAI、CCR、Bedrock
- 每种服务可配置独立的代理和认证设置

初始化命令：
```bash
cp config/config.example.js config/config.js
cp .env.example .env
npm run setup  # 自动生成密钥并创建管理员账户
````

## Web界面功能

### OAuth账户添加流程

1. **基本信息和代理设置**: 配置账户名称、描述和代理参数
2. **OAuth授权**:
   - 生成授权URL → 用户打开链接并登录Claude Code账号
   - 授权后会显示Authorization Code → 复制并粘贴到输入框
   - 系统自动交换token并创建账户

### 核心管理功能

- **实时仪表板**: 系统统计、账户状态、使用量监控
- **API Key管理**: 创建、配额设置、使用统计查看
- **Claude账户管理**: OAuth账户添加、代理配置、状态监控
- **系统日志**: 实时日志查看，多级别过滤
- **主题系统**: 支持明亮/暗黑模式切换，自动保存用户偏好设置

## 重要端点

### API转发端点（主要客户端接口）

- `POST /api/v1/messages` - Claude API消息处理（支持流式）
- `GET /api/v1/models` - 模型列表（兼容性）
- `GET /api/v1/usage` - 使用统计查询
- `GET /api/v1/key-info` - API Key信息

### 多服务端点（不同AI服务）

- `POST /claude/*` - Claude服务端点
- `POST /gemini/*` - Gemini服务端点  
- `POST /openai/*` - OpenAI兼容端点
- `POST /openai-gemini/*` - OpenAI格式转发到Gemini
- `POST /openai-claude/*` - OpenAI格式转发到Claude
- `POST /azure-openai/*` - Azure OpenAI端点

### OAuth管理端点

- `POST /admin/claude-accounts/generate-auth-url` - 生成OAuth授权URL（含代理）
- `POST /admin/claude-accounts/exchange-code` - 交换authorization code
- `POST /admin/claude-accounts` - 创建OAuth账户
- `GET /admin/claude-accounts` - 获取Claude账户列表
- `POST /admin/gemini-accounts` - 管理Gemini账户

### 系统和管理端点

- `GET /health` - 健康检查
- `GET /web` - Web管理界面
- `GET /admin/dashboard` - 系统概览数据
- `GET /admin/api-keys` - API Key管理
- `POST /admin/api-keys` - 创建新API Key
- `GET /admin/logs` - 实时日志查看
- `GET /api/stats/*` - 统计数据端点

### Webhook端点

- `POST /webhook/*` - Webhook配置和触发端点
- 支持自定义Webhook配置和事件通知

## 故障排除

### OAuth相关问题

1. **代理配置错误**: 检查代理设置是否正确，OAuth token交换也需要代理
2. **授权码无效**: 确保复制了完整的Authorization Code，没有遗漏字符
3. **Token刷新失败**: 检查refreshToken有效性和代理配置

### Gemini Token刷新问题

1. **刷新失败**: 确保 refresh_token 有效且未过期
2. **错误日志**: 查看 `logs/token-refresh-error.log` 获取详细错误信息
3. **测试脚本**: 运行 `node scripts/test-gemini-refresh.js` 测试 token 刷新

### 常见开发问题

1. **Redis连接失败**: 确认Redis服务运行，检查连接配置
2. **管理员登录失败**: 检查init.json同步到Redis，运行npm run setup
3. **API Key格式错误**: 确保使用cr\_前缀格式
4. **代理连接问题**: 验证SOCKS5/HTTP代理配置和认证信息

### 调试工具

- **日志系统**: Winston结构化日志，支持不同级别
  - 日志文件位置：`logs/` 目录
  - 实时查看日志：`tail -f logs/claude-relay-combined.log`
  - 错误日志：`logs/claude-relay-error.log`
  - Token刷新错误：`logs/token-refresh-error.log`
- **CLI工具**: 命令行状态查看和管理
  - 基本用法：`npm run cli` 查看可用命令
  - 状态检查：`npm run cli status`
  - API Key管理：`npm run cli keys list`
  - 账户管理：`npm run cli accounts list`
- **Web界面**: 实时日志查看和系统监控
  - 访问：`http://localhost:3000/web`
  - 实时日志页面查看最新日志条目
- **健康检查**: `/health` 端点提供系统状态
- **测试脚本**: 专用测试脚本用于特定功能验证
  - Gemini刷新测试：`node scripts/test-gemini-refresh.js`

## 开发最佳实践

### 代码格式化要求

- **必须使用 Prettier 格式化所有代码**
  - Prettier配置：无分号、单引号、100字符行宽、2空格缩进
  - ESLint集成：自动修复代码风格问题，支持Node.js和ES2021
- 后端代码（src/）：运行 `npx prettier --write <file>` 格式化
- 前端代码（web/admin-spa/）：已安装 `prettier-plugin-tailwindcss`，运行 `npx prettier --write <file>` 格式化
- 提交前检查格式：`npx prettier --check <file>`
- 格式化所有文件：`npm run format`
- 代码质量检查：`npm run lint` （自动修复）或 `npm run lint:check`（仅检查）

### 前端开发特殊要求

- **响应式设计**: 必须兼容不同设备尺寸（手机、平板、桌面），使用 Tailwind CSS 响应式前缀（sm:、md:、lg:、xl:）
- **暗黑模式兼容**: 项目已集成完整的暗黑模式支持，所有新增/修改的UI组件都必须同时兼容明亮模式和暗黑模式
  - 使用 Tailwind CSS 的 `dark:` 前缀为暗黑模式提供样式
  - 文本颜色：`text-gray-700 dark:text-gray-200`
  - 背景颜色：`bg-white dark:bg-gray-800`
  - 边框颜色：`border-gray-200 dark:border-gray-700`
  - 状态颜色保持一致：`text-blue-500`、`text-green-600`、`text-red-500` 等
- **主题切换**: 使用 `stores/theme.js` 中的 `useThemeStore()` 来实现主题切换功能
- **玻璃态效果**: 保持现有的玻璃态设计风格，在暗黑模式下调整透明度和背景色
- **图标和交互**: 确保所有图标、按钮、交互元素在两种模式下都清晰可见且易于操作

### 代码修改原则

- 对现有文件进行修改时，首先检查代码库的现有模式和风格
- 尽可能重用现有的服务和工具函数，避免重复代码
- 遵循项目现有的错误处理和日志记录模式
- 敏感数据必须使用加密存储（参考 claudeAccountService.js 中的加密实现）

### 测试和质量保证

- **代码质量检查**:
  - 运行 `npm run lint` 进行代码风格检查（使用 ESLint）
  - 运行 `npm run format:check` 检查代码格式
  - 运行 `npm run format` 自动格式化所有文件

- **测试执行**:
  - 运行 `npm test` 执行测试套件（Jest + SuperTest 配置）
  - ⚠️ **重要**: 当前项目缺少实际测试文件，建议补充单元测试和集成测试
  - 测试框架配置：Jest环境已配置，支持Node.js和ES模块
  - 前端测试：在 `web/admin-spa/` 目录下运行前端测试
  - 推荐测试目标：服务层单元测试、API端点集成测试、OAuth流程测试

- **功能验证**:
  - 在修改核心服务后，使用 CLI 工具验证功能：`npm run cli status`
  - 检查日志文件 `logs/claude-relay-*.log` 确认服务正常运行
  - 使用 `/health` 端点验证服务健康状态
  - 测试API端点：`curl http://localhost:3000/health`

- **开发前检查清单**:
  1. 确保Redis服务运行：`redis-cli ping` 应返回 "PONG"
  2. 检查环境变量配置：`.env` 文件包含必需的密钥
  3. 验证配置文件：`config/config.js` 配置正确
  4. 初始化数据：运行 `npm run setup` 如果是首次设置

### 开发工作流

- **功能开发**: 始终从理解现有代码开始，重用已有的服务和模式
- **调试流程**: 
  - 使用 Winston 日志系统（`logs/` 目录）
  - Web 界面实时日志查看（`/admin/logs`）
  - CLI 状态工具（`npm run cli status`）
  - 实时日志跟踪：`npm run service:logs:follow`
- **请求调试**:
  - 查看请求流：检查 `authenticateApiKey` 中间件日志
  - 账户选择：查看 `unifiedClaudeScheduler` 或对应调度器日志
  - 代理配置：检查 `ProxyHelper` 相关日志
  - Token刷新：查看 `tokenRefreshService` 和专用错误日志
- **性能调试**:
  - Redis性能：使用 `redis-cli monitor` 监控Redis操作
  - 连接池状态：检查 `cacheMonitor` 工具输出
  - 内存使用：`npm run monitor` 脚本
  - LRU缓存统计：查看日志中的缓存命中率和清理统计
  - SSE流性能：监控客户端连接数和流处理延迟
- **Redis调试技巧**:
  - `redis-cli --scan --pattern "api_key:*"` - 查看API Key模式
  - `redis-cli --scan --pattern "claude_account:*"` - 查看Claude账户
  - `npm run data:debug` - 使用项目提供的Redis调试工具
- **代码审查**: 关注安全性（加密存储）、性能（异步处理）、错误处理
- **部署前检查**: 运行 lint → 测试 CLI 功能 → 检查日志 → Docker 构建

### 常见开发任务

- **添加新的AI服务支持**:
  1. 创建 `{service}AccountService.js` 和 `{service}RelayService.js`
  2. 实现统一调度器 `unified{Service}Scheduler.js`
  3. 添加路由到 `src/routes/{service}Routes.js`
  4. 更新 `src/app.js` 中的路由注册
  5. 配置加密存储（参考CCR和Bedrock服务的实现）
  6. 添加CLI命令支持（在 `cli/` 目录下）
  7. 更新Web界面管理功能

- **修改认证逻辑**:
  1. 检查 `src/middleware/auth.js` 中的 `authenticateApiKey`
  2. 修改 `src/services/apiKeyService.js` 相关验证逻辑
  3. 测试不同API Key格式和限流功能

- **调整代理配置**:
  1. 修改 `src/utils/proxyHelper.js`
  2. 检查各服务中的代理使用（如 `claudeRelayService.js`）
  3. 测试SOCKS5和HTTP代理支持

### 常见文件位置

- 核心服务逻辑：`src/services/` 目录
- 路由处理：`src/routes/` 目录
- 中间件：`src/middleware/` 目录
- 配置管理：`config/config.js`
- Redis 模型：`src/models/redis.js`
- 工具函数：`src/utils/` 目录
- 前端主题管理：`web/admin-spa/src/stores/theme.js`
- 前端组件：`web/admin-spa/src/components/` 目录
- 前端页面：`web/admin-spa/src/views/` 目录

### 重要架构决策

- 所有敏感数据（OAuth token、refreshToken）都使用 AES 加密存储在 Redis
- 每个 Claude 账户支持独立的代理配置，包括 SOCKS5 和 HTTP 代理
- API Key 使用哈希存储，支持 `cr_` 前缀格式
- 请求流程：API Key 验证 → 账户选择 → Token 刷新（如需）→ 请求转发
- 支持流式和非流式响应，客户端断开时自动清理资源

### 核心数据流和性能优化

- **哈希映射优化**: API Key 验证从 O(n) 优化到 O(1) 查找
- **智能 Usage 捕获**: 从 SSE 流中解析真实的 token 使用数据
- **多维度统计**: 支持按时间、模型、用户的实时使用统计
- **异步处理**: 非阻塞的统计记录和日志写入
- **原子操作**: Redis 管道操作确保数据一致性

### 安全和容错机制

- **多层加密**: API Key 哈希 + OAuth Token AES 加密
- **零信任验证**: 每个请求都需要完整的认证链
- **优雅降级**: Redis 连接失败时的回退机制
- **自动重试**: 指数退避重试策略和错误隔离
- **资源清理**: 客户端断开时的自动清理机制

## 项目特定注意事项

### Redis 数据结构

- **API Keys**: `api_key:{id}` (详细信息) + `api_key_hash:{hash}` (快速查找)
- **Claude 账户**: `claude_account:{id}` (加密的 OAuth 数据)
- **管理员**: `admin:{id}` + `admin_username:{username}` (用户名映射)
- **会话**: `session:{token}` (JWT 会话管理)
- **使用统计**: `usage:daily:{date}:{key}:{model}` (多维度统计)
- **系统信息**: `system_info` (系统状态缓存)

### 流式响应处理

- 支持 SSE (Server-Sent Events) 流式传输
- 自动从流中解析 usage 数据并记录
- 客户端断开时通过 AbortController 清理资源
- 错误时发送适当的 SSE 错误事件
- 流式调试：监控 `claudeRelayService.js` 中的流处理逻辑
- 性能优化：使用LRU缓存减少重复解密操作，连接池管理减少延迟

### CLI 工具使用示例

```bash
# 创建新的 API Key
npm run cli keys create -- --name "MyApp" --limit 1000

# 查看系统状态
npm run cli status

# 管理 Claude 账户
npm run cli accounts list
npm run cli accounts refresh <accountId>

# 管理 CCR 账户
npm run cli ccr list              # 列出CCR账户
npm run cli ccr create -- --name "CCR Account" --url "https://api.example.com"

# 管理 Bedrock 账户 
npm run cli bedrock list          # 列出Bedrock账户
npm run cli bedrock test <accountId>  # 测试Bedrock连接

# 管理员操作
npm run cli admin create -- --username admin2
npm run cli admin reset-password -- --username admin

# 调试和监控
npm run cli redis stats           # Redis统计信息
npm run cli usage summary          # 使用情况汇总
```

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
