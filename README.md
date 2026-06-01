# MultiNote

双人实时协作手写笔记本。两人各自拥有无限长卷笔记本，分享房间码后互相可见并可涂鸦。

## 特性

- 🖊 **手写输入** — HTML5 Canvas，支持钢笔/圆珠笔/荧光笔，压感粗细
- 🔗 **P2P 直连** — WebRTC 点对点连接，无需服务器中转
- 📡 **局域网直连** — 纯 mDNS LAN 模式，零外部服务器，复制粘贴 SDP 即可连接
- ✍ **涂鸦协作** — 在朋友页面上自由涂鸦
- 📝 **块级内容** — Notion 式段落/标题/待办/图片/表格/绘图
- 📱 **响应式** — 桌面双栏 + 手机竖屏
- 🌙 **深色模式** — 跟随系统偏好
- 💾 **本地保存** — IndexedDB 自动持久化，无需登录

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS（黑白灰 + #A78BFA 浅紫） |
| Canvas | HTML5 Canvas 2D（双 Canvas 架构，避免 iPad 书写延迟） |
| 同步 | Yjs + y-webrtc（P2P WebRTC）/ 手动信令（LAN 直连） |
| 存储 | Dexie.js（IndexedDB） |
| 状态 | Zustand（3 stores） |
| 图标 | Lucide React |

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`，创建或加入房间即可。

两个浏览器标签页可模拟双人协作：标签 A 创建房间，标签 B 加入。

## 项目结构

```
src/
├── net/              # 纯网络层（与 UI 无关）
│   ├── signaling.ts  #   局域网 SDP 交换
│   └── room.ts       #   房间码 / 用户 ID 生成
├── sync/             # Yjs 同步层
│   └── yjs-doc.ts    #   Y.Doc 读写 + WebRTC 信令连接
├── engine/           # 渲染引擎
│   └── brush.ts      #   笔刷渲染 + 橡皮擦命中检测
├── state/            # Zustand 状态管理
│   ├── notebook.ts   #   笔记本 store（页面/块/涂鸦/撤销重做）
│   ├── tool.ts       #   工具 store（笔刷/颜色/模式）
│   └── ui.ts         #   UI store（侧栏/缩放/连接状态）
├── storage/          # 本地持久化
│   └── db.ts         #   IndexedDB / Dexie
├── hooks/            # React 桥接层（net/sync/engine → state → UI）
├── components/       # 纯 UI 组件
│   ├── layout/       #   布局（双栏/侧栏/工具栏/缩放）
│   ├── canvas/       #   画布（HandwritingCanvas/PageCanvas/BlockItem）
│   ├── blocks/       #   块渲染器
│   ├── toolbar/      #   添加块
│   └── room/         #   房间系统
├── types/            # 共享类型定义
├── constants.ts      # 全局常量
└── App.tsx           # 入口
```

## 连接模式

| 模式 | 信令 | 适用场景 |
|---|---|---|
| **在线连接** | y-webrtc（公开 STUN/信令服务器） | 任何网络 |
| **局域网直连** | 手动 SDP 交换（复制粘贴） | 同 WiFi，零外部服务器 |

### 局域网直连使用方式

1. 双方进入"创建房间" → 切换到"局域网直连"
2. A 点击"发起连接" → 复制连接码 → 微信发给 B
3. B 点击"接受连接" → 粘贴 A 的连接码 → 复制回传码 → 微信发给 A
4. A 粘贴 B 的回传码 → 完成连接

## 部署

推送到 `debug2` 或 `main` 分支即可触发 GitHub Pages 自动部署。

部署地址: `https://1060592705.github.io/multinote/`

需要在仓库 Settings → Pages → Source 选择 **"GitHub Actions"**。
