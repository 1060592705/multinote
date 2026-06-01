# 设计规范

## 配色方案

### 浅色模式

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-primary` | `#FFFFFF` | 主背景 |
| `--bg-secondary` | `#F5F5F5` | 次背景（工具栏、侧栏） |
| `--bg-tertiary` | `#EBEBEB` | 三级背景（hover 态） |
| `--bg-paper` | `#FEFEF8` | 纸张背景 |
| `--border` | `#E0E0E0` | 边框 |
| `--border-light` | `#F0F0F0` | 轻边框 |
| `--text-primary` | `#1A1A1A` | 主文字 |
| `--text-secondary` | `#666666` | 次文字 |
| `--text-tertiary` | `#999999` | 辅助文字 |
| `--accent` | `#A78BFA` | 浅紫强调色 |
| `--accent-hover` | `#8B6FDF` | 强调色悬停 |
| `--accent-light` | `#EDE9FE` | 强调色浅底 |
| `--danger` | `#EF4444` | 危险/删除 |
| `--success` | `#22C55E` | 成功/在线 |

### 深色模式

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-primary` | `#0D0D0D` | 主背景 |
| `--bg-secondary` | `#1A1A1A` | 次背景 |
| `--bg-tertiary` | `#262626` | 三级背景 |
| `--bg-paper` | `#1A1A1A` | 纸张背景 |
| `--border` | `#333333` | 边框 |
| `--border-light` | `#262626` | 轻边框 |
| `--text-primary` | `#F0F0F0` | 主文字 |
| `--text-secondary` | `#999999` | 次文字 |
| `--text-tertiary` | `#666666` | 辅助文字 |
| `--accent` | `#A78BFA` | 浅紫强调色（保持不变） |

## 字体

| 层级 | 字体 | 大小 | 字重 |
|------|------|------|------|
| H1 块 | system-ui | 28px | 700 |
| H2 块 | system-ui | 22px | 600 |
| H3 块 | system-ui | 18px | 600 |
| 正文块 | system-ui | 16px | 400 |
| 辅助文字 | system-ui | 13px | 400 |
| 工具栏标签 | system-ui | 12px | 500 |

## 间距

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-xs` | 4px | 图标内边距 |
| `--space-sm` | 8px | 紧凑间距 |
| `--space-md` | 12px | 常规间距 |
| `--space-lg` | 16px | 块间距 |
| `--space-xl` | 24px | 分区间距（含画布缝隙） |
| `--space-2xl` | 32px | 大分区 |

## 圆角

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 4px | 小按钮/标签 |
| `--radius-md` | 8px | 卡片/面板/块 |
| `--radius-lg` | 12px | 弹窗 |
| `--radius-full` | 9999px | 圆形按钮/指示器 |

## 阴影

| Token | 用途 |
|-------|------|
| `--shadow-sm` | 卡片悬停微阴影 |
| `--shadow-md` | 弹出面板 |
| `--shadow-lg` | 弹窗/对话框 |

## 画布规范

| 参数 | 值 |
|------|-----|
| B5 逻辑宽度 | 720px (@1x) |
| 页面最小高度 | 500px（无内容时） |
| 页面垂直内边距 | 48px (top/bottom) |
| 页面水平内边距 | 40px (left/right) |
| 双页缝隙 | 24px |
| 侧栏宽度（展开） | 280px |
| 侧栏宽度（折叠） | 48px |
| 工具栏高度 | 48px |
| 移动端底栏高度 | 56px |

## 交互动画

| 动画 | 时长 | 缓动 |
|------|------|------|
| 翻页位移 | 0.3s | ease-out |
| 侧栏展开/折叠 | 0.2s | ease-in-out |
| 笔刷切换弹性 | 0.2s | cubic-bezier(0.34, 1.56, 0.64, 1) |
| 按钮 hover | 0.15s | ease |
| 工具提示出现 | 0.15s | ease-out |
| 涂鸦开关切换 | 0.15s | ease |
