# P2P Feature Module

所有 P2P 相关功能已整合到统一的模块中。

## 文件结构

```
src/features/p2p/
├── components/           # P2P UI 组件
│   ├── CodeInput.tsx                  # 6位代码输入组件（带波浪动画）
│   ├── P2PConnectionPanel.tsx         # 完整的连接面板（用于 Chat 和五子棋）
│   └── P2PConnectionSetup.tsx         # 简化的连接设置组件
├── hooks/               # React Hooks
│   └── usePeerConnection.ts           # P2P 连接管理 Hook
├── lib/                 # 核心库
│   ├── p2p.ts                         # P2P 工具函数和类型定义
│   └── p2pCrypto.ts                   # 加密/解密功能（RSA）
├── types/               # TypeScript 类型定义
│   └── peerjs.d.ts                    # PeerJS 库的类型声明
└── config.ts            # P2P 配置（超时等）
```

## 使用方式

### 在页面中使用

```typescript
// 导入组件
import P2PConnectionPanel from "@/features/p2p/components/P2PConnectionPanel";
import { usePeerConnection } from "@/features/p2p/hooks/usePeerConnection";
import { P2P_CONNECT_TIMEOUT_MS } from "@/features/p2p/config";

// 在组件中使用
const { state, connect, send, reinitialize } = usePeerConnection({
  onDataReceived: (data) => {
    // 处理接收到的数据
  },
  onConnected: () => {
    // 连接成功回调
  },
});
```

### 主要功能

1. **CodeInput** - 6位代码输入，支持：
   - 波浪式跳跃动画（连接时）
   - 自动聚焦和粘贴
   - 错误状态处理
   - 只在失败时清空输入

2. **P2PConnectionPanel** - 完整连接面板，包含：
   - 本地 Peer ID 显示和复制
   - 代码输入
   - 连接状态显示
   - 错误处理和重试

3. **usePeerConnection** - 核心 Hook，提供：
   - 自动初始化 PeerJS
   - 连接管理
   - 数据发送/接收
   - 错误处理
   - 加密支持（可选）

## 环境变量

在 `.env.local` 中配置：

```bash
NEXT_PUBLIC_P2P_CONNECT_TIMEOUT_MS=5000
```

## 当前使用位置

- `/chat` - P2P 聊天页面
- `/gomoku` - P2P 五子棋游戏
