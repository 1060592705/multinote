# 技术规格

## 技术栈

| 层面 | 选择 | 版本 |
|------|------|------|
| 框架 | React | ^18.x |
| 语言 | TypeScript | ^5.x |
| 构建 | Vite | ^5.x |
| 样式 | Tailwind CSS | ^3.x |
| Canvas | HTML5 Canvas 2D API | 原生 |
| 实时同步 | Yjs + y-webrtc | ^13.x |
| 本地存储 | Dexie.js (IndexedDB) | ^4.x |
| 状态管理 | Zustand | ^4.x |
| 拖拽 | @dnd-kit/core | ^6.x |
| 图标 | Lucide React | ^0.x |
| 部署 | Vercel / Netlify | 静态托管 |

## 数据模型

参见 `src/types/index.ts`

### 核心实体

- **Notebook**: 笔记本（id, ownerId, name, pages[], timestamps）
- **Page**: 页面（id, pageNumber, blocks[], doodleLayers[], thumbnail）
- **Block**: 内容块（id, type, content, handwriting[], position, style）
- **Stroke**: 笔迹（id, points[], brush, color, size, timestamp）
- **Point**: 采样点（x, y, pressure, timestamp）

### Yjs 映射策略

```
Y.Doc (myNotebook / friendNotebook)
├── pages: Y.Array<Y.Map<Page>>
│   ├── blocks: Y.Array<Y.Map<Block>>
│   │   ├── content: Y.Map / Y.Text
│   │   └── handwriting: Y.Array<Y.Map<Stroke>>
│   └── doodleLayers: Y.Array<Y.Map<Doodle>>
└── currentPageIndex: number (local, not synced)
```

## Canvas 渲染策略

### 块级 Canvas

- 每个 Block 可选挂载一个 `<canvas>` 覆盖层
- Canvas 尺寸与块的实际渲染尺寸一致
- 笔迹坐标相对于块左上角原点
- 块尺寸变化时 Canvas 同步 resize + 重绘

### 笔迹渲染

- 采样点通过 Pointer Events 获取
- 路径平滑：二次贝塞尔曲线（中点插值法）
- 线条宽度 = baseSize + (pressure - 0.5) * sizeVariance
- 钢笔笔刷：圆形笔尖，线性渐变透明度

### 橡皮擦

- 笔画级擦除：点击或划过整条 Stroke → 删除整条
- 高亮已识别笔画（hover 时紫色描边）

## 同步策略

### WebRTC 连接

1. 创建方生成随机房间码（6 位字母数字）
2. 双方通过 y-webrtc 连接公共信令服务器
3. 使用房间码作为信令房间名
4. WebRTC 建立 P2P DataChannel
5. Yjs 通过 DataChannel 同步文档

### 文档隔离

- 每个用户有两个 Y.Doc: 自己的和对方的
- 自己只写入自己的 doc
- 对方的 doc 为只读（通过 awareness 标识）
- 涂鸦写入对方的 doc 的 doodleLayers

### 冲突处理

- Yjs CRDT 自动处理并发写入
- 同一笔画的不同部分自动合并
- 删除操作优先于编辑（墓碑机制）

## 存储策略

### IndexedDB 表设计

```
notebooks: &id, data (JSON blob), updatedAt
```

- 每个笔记本单独存储
- 5 秒防抖自动保存
- 页面加载时优先从 IndexedDB 恢复
- Yjs 连接建立后合并远程数据

### 存储键

- `notebook:my:{userId}` — 我的笔记本
- `notebook:friend:{roomCode}` — 朋友的笔记本缓存
- `settings:{userId}` — 用户设置（主题、默认笔刷等）
- `room:{roomCode}` — 房间信息

## 性能要求

- 页面内块数量：0-200 个块时流畅滚动 (60fps)
- 块级 Canvas 虚拟化：仅渲染视口 ±1 屏的 Canvas
- 笔迹采样频率：60Hz（与 requestAnimationFrame 对齐）
- Canvas 尺寸上限：单块 Canvas ≤ 2000px 高度（超长块分段）
