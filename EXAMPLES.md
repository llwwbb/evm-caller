# 使用示例

## 带命名输出的函数调用

当 ABI 的 `outputs` 字段包含 `name` 属性时，调用结果会自动以 JSON 对象格式显示，使用输出的名称作为 key。

### 示例 1: getTokenInfo 函数

**ABI 定义：**
```json
{
  "name": "getTokenInfo",
  "type": "function",
  "stateMutability": "view",
  "inputs": [
    {
      "name": "token",
      "type": "address"
    }
  ],
  "outputs": [
    {
      "name": "version",
      "type": "uint256"
    },
    {
      "name": "tokenManager",
      "type": "address"
    },
    {
      "name": "quote",
      "type": "address"
    },
    {
      "name": "lastPrice",
      "type": "uint256"
    },
    {
      "name": "tradingFeeRate",
      "type": "uint256"
    }
  ]
}
```

**调用结果（带名称）：**
```json
{
  "version": "1",
  "tokenManager": "0x1234567890123456789012345678901234567890",
  "quote": "0x0987654321098765432109876543210987654321",
  "lastPrice": "1000000000000000000",
  "tradingFeeRate": "30"
}
```

### 示例 2: 没有命名输出的函数

**ABI 定义：**
```json
{
  "name": "owner",
  "type": "function",
  "stateMutability": "view",
  "inputs": [],
  "outputs": [
    {
      "name": "",
      "type": "address"
    }
  ]
}
```

**调用结果（数组格式）：**
```json
"0x1234567890123456789012345678901234567890"
```

如果只有一个输出且没有名称，直接返回值。

### 示例 3: Solidity 函数签名格式

你也可以使用 Solidity 函数签名格式（但无法指定输出名称）：

```solidity
function owner() view returns (address)
function balanceOf(address account) view returns (uint256)
```

使用 Solidity 格式时，由于没有输出名称，结果会以数组或单个值的形式返回。

### 示例 4: 多个命名输出

**Solidity 签名（推荐使用 JSON ABI 以保留名称）：**
```solidity
function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)
```

如果使用 JSON ABI 并包含输出名称：

**JSON ABI：**
```json
{
  "name": "getReserves",
  "type": "function",
  "stateMutability": "view",
  "inputs": [],
  "outputs": [
    {
      "name": "reserve0",
      "type": "uint112"
    },
    {
      "name": "reserve1",
      "type": "uint112"
    },
    {
      "name": "blockTimestampLast",
      "type": "uint32"
    }
  ]
}
```

**调用结果：**
```json
{
  "reserve0": "1000000000000000000",
  "reserve1": "2000000000000000000",
  "blockTimestampLast": "1700000000"
}
```

## 功能说明

1. **自动识别**：系统会自动检测 outputs 中是否有命名字段
2. **智能格式化**：
   - 有命名输出 → 返回 JSON 对象
   - 无命名输出 → 返回数组或单个值
3. **混合命名**：如果部分输出有名称，部分没有，有名称的使用名称，没有的使用 `output0`, `output1` 等

## 测试合约

你可以使用以下合约测试此功能：

### Uniswap V2 Pair (getReserves)
- **地址**: `0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc` (USDC-WETH on Ethereum)
- **函数**: `getReserves()`
- **返回**: `reserve0`, `reserve1`, `blockTimestampLast`

### ERC20 代币
- **地址**: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` (USDC on Ethereum)
- **函数**: `name()`, `symbol()`, `decimals()`, `totalSupply()`
- **返回**: 单个值（无命名输出）

