# Web3 RPC 调用工具

一个现代化的 Web3 工具，用于快速调用智能合约的 view/pure 函数，无需连接钱包。

## 功能特性

✨ **双格式 ABI 支持**
- JSON ABI 格式（标准格式）
- Solidity 函数签名格式（如 `function name() view returns (string)`）

🚀 **简单易用**
- 无需连接钱包
- 仅支持 view/pure 函数（只读操作）
- 实时结果展示

💾 **预设管理系统**（新功能！）
- **三维独立预设**：RPC URL、合约地址、ABI 完全独立保存
- 可自由组合使用（如：Ethereum 主网 + USDC 合约 + ERC20 ABI）
- 支持保存、编辑、删除预设
- 自动保存上次使用的配置
- 刷新页面后自动恢复
- 数据存储在浏览器本地（localStorage）
- 内置常用预设（Ethereum、BSC、Polygon、ERC20 ABI）

📊 **智能结果格式化**
- 自动识别 ABI 输出中的命名字段
- 有命名输出时，返回 JSON 对象格式（如 `{"balance": "1000", "locked": "500"}`）
- 无命名输出时，返回数组或单个值

🔬 **Debug Trace 调用追踪**（新功能！）
- 使用 `debug_traceTransaction` 解析交易内部调用链
- 树形结构展示所有合约调用（包括 CALL、DELEGATECALL、STATICCALL）
- 自动解析每个调用的 input、output 和 error
- 可视化 Gas 使用情况
- 支持递归展开/折叠查看详情
- 需要 Archive Node 支持（如 Alchemy、Infura）

🎨 **现代化界面**
- 响应式设计，支持移动端
- 清晰的步骤引导
- 美观的 Tailwind CSS 样式

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式方案**: Tailwind CSS
- **Web3 库**: ethers.js v6

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 构建生产版本

```bash
npm run build
```

### 4. 预览生产版本

```bash
npm run preview
```

### 5. 部署到 GitHub Pages

```bash
npm run deploy
```

**详细部署指南请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)**

## 使用指南

### 步骤 1: 配置 RPC 和合约

#### 方式一：使用预设（推荐）

1. **选择 RPC 预设**：从下拉列表选择网络（如"Ethereum 主网"）
2. **选择合约预设**：从下拉列表选择合约（如"USDC"）
3. 点击"验证连接"

#### 方式二：手动输入

1. 输入 RPC URL（如：`https://eth-mainnet.g.alchemy.com/v2/your-api-key`）
2. 输入合约地址（如：`0x...`）
3. 点击"验证连接"

#### 保存为预设

- 输入 RPC URL 后，点击"💾 保存"按钮，给它起个名字
- 输入合约地址后，点击"💾 保存"按钮，保存常用合约
- 点击"⚙️ 管理"按钮可以编辑或删除已保存的预设

### 步骤 2: 输入 ABI

#### 方式一：使用预设

- 从"ABI 预设"下拉列表选择（如"ERC20 标准接口"）

#### 方式二：手动输入

支持两种格式：

**JSON ABI 格式：**
```json
[
  {
    "name": "balanceOf",
    "type": "function",
    "stateMutability": "view",
    "inputs": [{"type": "address", "name": "account"}],
    "outputs": [{"type": "uint256"}]
  }
]
```

**Solidity 函数签名格式：**
```solidity
function name() view returns (string)
function symbol() view returns (string)
function balanceOf(address account) view returns (uint256)
```

保存 ABI：输入或粘贴 ABI 后，点击"💾 保存"按钮保存为预设

### 步骤 3: 调用函数

1. 从解析的函数列表中选择要调用的函数
2. 输入函数参数（如果有）
3. 点击"调用函数"
4. 查看右侧的调用结果

### 预设功能特点

🎯 **三维独立设计**
- RPC URL、合约地址、ABI 三者完全独立
- 可任意组合使用
- 例如：切换不同网络调用同一个合约

♻️ **自动恢复**
- 页面刷新后自动恢复上次使用的配置
- 无需重复输入

📦 **内置预设**
- 首次使用自动创建常用预设：
  - RPC: Ethereum 主网、BSC 主网、Polygon 主网
  - ABI: ERC20 标准接口（name、symbol、decimals、totalSupply、balanceOf）

## 支持的参数类型

- `address` - 以太坊地址（如：0x...）
- `uint256` / `int256` - 整数
- `string` - 字符串
- `bool` - 布尔值（true/false）
- `bytes` - 字节（如：0x...）
- 数组类型（如：`address[]`，使用 JSON 格式）

## 示例

### ERC20 代币合约

**RPC URL**: `https://eth-mainnet.g.alchemy.com/v2/your-api-key`  
**合约地址**: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (USDC)

**ABI (Solidity 格式)**:
```solidity
function name() view returns (string)
function symbol() view returns (string)
function decimals() view returns (uint8)
function totalSupply() view returns (uint256)
function balanceOf(address account) view returns (uint256)
```

## 项目结构

```
evm-caller/
├── src/
│   ├── App.tsx                      # 主应用组件
│   ├── main.tsx                     # 应用入口
│   ├── components/                  # UI 组件
│   │   ├── RpcConfig.tsx            # RPC 配置表单
│   │   ├── FunctionList.tsx         # 函数列表展示
│   │   ├── ResultDisplay.tsx        # 结果显示组件
│   │   ├── TransactionParserPage.tsx # 交易解析页面
│   │   ├── DebugTracePage.tsx       # Debug Trace 调用追踪页面
│   │   ├── HexParserPage.tsx        # Hex 数据解析页面
│   │   ├── EventQueryPage.tsx       # Event 日志查询页面
│   │   └── AbiEncoderPage.tsx       # ABI 编码器页面
│   ├── utils/                       # 工具函数
│   │   ├── abiParser.ts             # ABI 解析逻辑
│   │   ├── rpcCaller.ts             # RPC 调用封装
│   │   ├── transactionParser.ts     # 交易解析工具
│   │   ├── debugTrace.ts            # Debug Trace 工具
│   │   ├── hexParser.ts             # Hex 解析工具
│   │   ├── eventQuery.ts            # Event 查询工具
│   │   └── presetStorage.ts         # 预设存储管理
│   ├── types/                       # TypeScript 类型定义
│   │   └── index.ts
│   └── i18n/                        # 国际化
│       ├── index.ts
│       └── locales/
│           ├── zh.json              # 中文翻译
│           └── en.json              # 英文翻译
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## 命名输出支持

当 ABI 的 `outputs` 包含 `name` 字段时，调用结果会以 JSON 对象格式显示：

**示例 ABI：**
```json
{
  "outputs": [
    {"name": "balance", "type": "uint256"},
    {"name": "locked", "type": "uint256"}
  ]
}
```

**返回结果：**
```json
{
  "balance": "1000000000000000000",
  "locked": "500000000000000000"
}
```

详细示例请参考 [EXAMPLES.md](./EXAMPLES.md)

## 注意事项

- 本工具仅支持 view/pure 函数调用（只读操作）
- 不支持需要签名的交易操作
- 确保 RPC URL 有效且可访问
- 合约地址必须是有效的以太坊地址格式
- 使用 JSON ABI 格式可以保留输出字段的名称

## License

MIT

