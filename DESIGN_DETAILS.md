# 🎨 Quantum Chat - 视觉设计详解

## 配色方案

### 主色调
```css
背景渐变：
  from: slate-950  (#020617)
  via:  purple-950 (#3b0764)
  to:   slate-900  (#0f172a)

强调色：
  cyan-400    (#22d3ee) - 你的 Peer ID
  purple-400  (#c084fc) - 连接输入框
  pink-600    (#db2777) - 发送按钮
  green-400   (#4ade80) - 连接状态
```

### 消息气泡
```css
我的消息：
  background: linear-gradient(to-br, purple-600, pink-600)
  shadow: purple-500/30
  
对方消息：
  background: slate-800/80
  border: cyan-500/20
  shadow: cyan-500/10
```

## 动画效果

### 1. 页面加载动画
```typescript
标题：
  initial: { opacity: 0, y: -30 }
  animate: { opacity: 1, y: 0 }
  duration: 0.8s

连接卡片：
  initial: { opacity: 0, scale: 0.9 }
  animate: { opacity: 1, scale: 1 }
  duration: 0.6s
```

### 2. 消息动画
```typescript
每条消息：
  initial: { opacity: 0, y: 20, scale: 0.8 }
  animate: { opacity: 1, y: 0, scale: 1 }
  duration: 0.4s
  delay: index * 0.05s (错开效果)
```

### 3. 按钮交互
```typescript
hover: scale(1.05)
tap:   scale(0.95)
transition: all 300ms
```

### 4. 背景网格
```css
animation: gridMove 20s linear infinite

@keyframes gridMove {
  0%   { transform: translate(0, 0) }
  100% { transform: translate(50px, 50px) }
}
```

## 粒子系统

### 连接成功粒子
```typescript
数量：50 个
颜色：hsl(160-200, 80%, 60%) - 青绿色系
速度：随机方向，2-6 px/frame
生命周期：1 秒
```

### 消息发送粒子
```typescript
数量：20 个
颜色：hsl(280-320, 70%, 65%) - 紫粉色系
初始位置：屏幕底部 80%
速度：向上 1-4 px/frame
生命周期：1 秒
```

### 粒子渲染
```typescript
Canvas 2D Context
每帧更新：
  - 位置 += 速度
  - 生命值 -= 0.01
  - alpha = 生命值
自动清理：生命值 <= 0
```

## 布局结构

```
┌─────────────────────────────────────┐
│  ← Back Home                        │
│                                     │
│      Quantum Chat                   │  ← 渐变标题
│   Peer-to-Peer Encrypted...        │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Your Peer ID                  │ │
│  │ [━━━━━━━━━━━━━━━━━] [Copy]   │ │
│  │                               │ │
│  │ Connect to Peer               │ │
│  │ [━━━━━━━━━━━━] [Connect]     │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘

连接后：

┌─────────────────────────────────────┐
│  ← Back Home                        │
│                                     │
│      Quantum Chat                   │
│   ● Connected                       │
│                                     │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │  ┌──────────┐                │ │
│  │  │ 对方消息 │                │ │
│  │  └──────────┘                │ │
│  │                 ┌──────────┐ │ │
│  │                 │ 我的消息 │ │ │
│  │                 └──────────┘ │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│  [━━━━━━━━━━━━━━━━] [Send]        │
└─────────────────────────────────────┘
```

## 响应式设计

### 桌面 (≥768px)
- 标题：7xl (72px)
- 卡片内边距：32px
- 消息最大宽度：70%

### 平板 (640-767px)
- 标题：7xl (72px)
- 卡片内边距：24px
- 消息最大宽度：70%

### 手机 (<640px)
- 标题：5xl (48px)
- 卡片内边距：24px
- 消息最大宽度：70%
- 按钮堆叠排列

## 字体层级

```css
h1 (Quantum Chat):
  font-family: 'Orbitron', sans-serif
  font-size: 3rem (mobile) → 4.5rem (desktop)
  font-weight: 700-900
  
副标题:
  font-family: monospace
  font-size: 0.875rem → 1rem
  
输入框/按钮:
  font-family: monospace
  font-size: 0.875rem
  
消息内容:
  font-family: monospace
  font-size: 0.875rem → 1rem
```

## 阴影系统

```css
卡片阴影:
  shadow-2xl + shadow-purple-500/20
  
按钮阴影:
  shadow-lg + shadow-purple-500/50
  
消息阴影:
  我的: shadow-lg + shadow-purple-500/30
  对方: shadow-lg + shadow-cyan-500/10
```

## 模糊效果

```css
卡片背景:
  backdrop-blur-xl (24px)
  
返回按钮:
  backdrop-blur-md (12px)
```

## 自定义滚动条

```css
宽度: 8px
轨道: rgba(15, 23, 42, 0.5)
滑块: rgba(139, 92, 246, 0.5)
滑块悬停: rgba(139, 92, 246, 0.7)
圆角: 4px
```

## 性能优化

- Canvas 使用 requestAnimationFrame
- 粒子自动清理（生命周期结束）
- 消息列表虚拟化（未来可添加）
- 图片懒加载（如需添加头像）

---

这个设计追求**科技感、未来感、流动性**，与首页的复古像素风格形成鲜明对比，为用户提供不同的视觉体验。
