# 执行计划

## 执行原则

1. **稳扎稳打**：每个步骤完成并验证后再进入下一步
2. **小步提交**：每完成一个功能模块就做好测试
3. **文档同步**：关键决策和技术细节记录在 dev-logs 中
4. **回退安全**：每个步骤可独立验证，出问题时容易定位

## Phase 1 执行步骤

### Step 1: 项目脚手架
- 初始化 Vite + React + TypeScript + Tailwind
- 配置 ESLint/Prettier
- 创建基础目录结构
- 验证: `npm run dev` 启动成功

### Step 2: 类型定义 + 常量 + 状态骨架
- 编写 `src/types/index.ts`
- 编写 `src/lib/constants.ts`
- 搭建 3 个 Zustand store 骨架
- 验证: TypeScript 编译无错误

### Step 3: 房间系统
- 实现 RoomGate 页面
- 房间码生成 / 输入
- WebRTC 连接管理
- 验证: 两个浏览器标签页能建立连接

### Step 4: 双页画布布局
- DualPane 容器
- PageCanvas 无限滚动
- PageHeader 页码+翻页
- 验证: 双页布局正确，独立滚动

### Step 5: 手写引擎
- HandwritingCanvas 组件
- Pointer Events 处理（压感+防误触）
- 笔迹渲染 + 平滑
- 橡皮擦
- 验证: 能写字、能擦除

### Step 6: 基本块系统
- BlockRenderer 分发器
- ParagraphBlock / HeadingBlock / TodoBlock / ImageBlock
- 块级 Canvas 绑定
- 验证: 能添加/编辑/删除块

### Step 7: 实时同步
- Yjs 文档初始化
- y-webrtc 连接
- 笔迹和块内容同步
- 验证: 两个标签页能实时看到对方修改

### Step 8: 涂鸦层 + 大纲
- DoodleLayer 渲染
- 涂鸦开关（全局+单页）
- 左侧大纲 Sidebar
- NotebookPanel 页面列表
- 验证: 涂鸦显示/隐藏正确

### Step 9: 完善收尾
- IndexedDB 自动保存
- 撤销/重做
- 深色模式
- 响应式适配
- 验证: 刷新后数据恢复，主题切换正常
