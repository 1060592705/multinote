# CLAUDE.md — MultiNote 项目工作指引

## 项目简介

MultiNote（双人计划本）是一个双人实时协作手写笔记本 Web 应用。两人各自拥有无限长卷笔记本，分享房间码后互相可见对方笔记本、可在上面涂鸦，同时支持 Notion 式块级内容组织和 GoodNotes 式手写体验。

## 核心原则

1. **稳扎稳打**：每个步骤完成并验证后再进入下一步，不一口气做太多
2. **小步提交**：每完成一个功能模块就验证可用性
3. **文档同步**：关键决策和技术细节记录在 `dev-logs/` 中
4. **用户视角**：用户是代码小白，UX 要直观简单

## 标准文件路径

| 文档 | 路径 | 说明 |
|------|------|------|
| 产品需求 | [docs/requirements.md](docs/requirements.md) | 功能清单、用户故事、Phase 划分 |
| 设计规范 | [docs/design-system.md](docs/design-system.md) | 配色、字体、间距、画布参数、动画 |
| 技术规格 | [docs/technical-spec.md](docs/technical-spec.md) | 技术栈、数据模型、同步策略、存储策略 |
| 执行计划 | [docs/execution-plan.md](docs/execution-plan.md) | Phase 1 的 9 步执行路线图 |
| 开发日志 | [dev-logs/](dev-logs/) | 每日开发记录 |
| 详细计划 | [.claude/plans/...](.claude/plans/) | 完整架构计划 |

## 技术栈速查

- **框架**: React 18 + TypeScript + Vite
- **样式**: Tailwind CSS（黑白灰 + #A78BFA 浅紫）
- **Canvas**: HTML5 Canvas 2D API（块级 Canvas）
- **同步**: Yjs + y-webrtc（WebRTC P2P，无需服务器）
- **存储**: Dexie.js（IndexedDB 自动保存）
- **状态**: Zustand（3 个 store：notebook / tool / UI）
- **图标**: Lucide React

## 日常工作流

### 开始新任务前
1. 阅读 [docs/execution-plan.md](docs/execution-plan.md) 确认当前步骤
2. 检查 [dev-logs/](dev-logs/) 最新日志了解上下文
3. 确认上一步已验证通过再开始下一步

### 完成任务后
1. 更新 `dev-logs/YYYY-MM-DD.md`（完成事项 + 待办事项 + 关键决策）
2. 更新 TodoWrite 任务状态
3. 如有重要技术决策，同步更新相关 docs 文件

### 验证方式
- 每个 Step 完成后运行 `npm run dev`
- 关键功能用两个浏览器标签页模拟双人场景
- TypeScript 编译必须零错误

## 项目结构

```
multinote/
├── docs/                # 标准文档
├── dev-logs/            # 开发日志
├── src/
│   ├── types/           # TypeScript 类型
│   ├── lib/             # 工具库（yjs, storage, room, brush-engine）
│   ├── store/           # Zustand 状态管理
│   ├── hooks/           # 自定义 hooks
│   └── components/      # React 组件
│       ├── layout/      # 布局组件
│       ├── canvas/      # 画布组件
│       ├── blocks/      # 内容块组件
│       ├── toolbar/     # 工具栏组件
│       └── room/        # 房间系统组件
├── public/              # 静态资源
└── index.html
```

## 注意事项

- 无需后端服务器，WebRTC P2P 直连
- 无需用户注册/登录
- 纯客户端应用，静态托管即可部署
- 笔迹坐标相对于块原点，块移动时笔迹自动跟随
- 压感仅响应 pen/pen contact 类型的 PointerEvent
- 深色模式跟随系统 `prefers-color-scheme`
