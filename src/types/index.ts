import { JsonFragment } from 'ethers';

export interface ParsedFunction {
  name: string;
  inputs: ParsedParam[];
  outputs: ParsedParam[];
  stateMutability: string;
  abiName?: string;      // source ABI preset name (filled in App.tsx)
}

export interface ParsedParam {
  name: string;
  type: string;
  internalType?: string;
  components?: ParsedParam[]; // 支持 tuple 类型的嵌套结构
}

export interface FunctionCall {
  functionName: string;
  args: any[];
}

export interface CallResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface RpcConfig {
  rpcUrl: string;
  contractAddress: string;
  blockTag?: string | number; // 区块标识：'latest', 'earliest', 'pending', 或具体区块号
}

export type AbiInput = string | JsonFragment[];

// 预设相关类型
export interface RpcPreset {
  id: string;
  name: string;
  rpcUrl: string;
  chainId?: number;
  createdAt: number;
}

export interface ContractEntry {
  chainId?: number;      // matches RpcPreset.chainId
  address: string;       // mixed-case hex
}

export interface ContractPreset {
  id: string;
  name: string;
  description?: string;
  entries: ContractEntry[];   // length >= 1
  createdAt: number;
}

export interface AbiPreset {
  id: string;
  name: string;
  abi: string;
  createdAt: number;
}

export interface LastUsedConfig {
  rpcUrl?: string;
  contractAddress?: string;
  abi?: string;
  blockTag?: string;
}

export interface CallHistory {
  id: string;
  functionName: string;
  args: any[];
  result: CallResult;
  timestamp: number;
  blockTag?: string | number; // 记录调用时使用的区块标识
  rpcName?: string; // 记录调用时使用的 RPC 名称
}

// Parser 相关类型

// 解析后的日志/事件
export interface ParsedLog {
  logIndex: number;
  blockNumber: number;
  transactionHash: string;
  address: string;
  data: string;
  topics: string[];
  // 解析结果
  parsed?: {
    eventName: string;
    args: any;
    signature: string;
    topic: string; // Event topic hash (topic[0])
    abiName: string; // 使用哪个 ABI 解析的
  };
  // 如果无法解析
  error?: string;
}

// 解析后的交易信息
export interface ParsedTransaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce: number;
  blockNumber: number | null;
  blockHash: string | null;
  timestamp?: number;
  status?: number; // 从 receipt 获取
  // Input data 解析
  inputData: string;
  decodedInput?: {
    functionName: string;
    args: any;
    signature: string;
  };
  // Logs 解析
  logs: ParsedLog[];
}

// Event 查询参数
export interface EventQueryParams {
  rpcUrl: string;
  contractAddress: string;
  abi: string;
  eventName: string;
  fromBlock: number | string;
  toBlock: number | string;
  indexedParams?: Record<string, any>; // indexed 参数过滤
  abiName?: string; // 该事件对应的 ABI 名称
}

// Event 查询结果
export interface EventQueryResult {
  success: boolean;
  events?: ParsedLog[];
  count?: number;
  error?: string;
}

// 通用解码数据
export interface DecodedData {
  type: 'function' | 'event' | 'error' | 'unknown';
  name?: string;
  signature?: string;
  args?: any;
  fragment?: any; // ethers Fragment
  error?: string;
  abiName?: string;
}

// 解析后的事件定义
export interface ParsedEvent {
  name: string;
  inputs: ParsedParam[];
  anonymous?: boolean;
  topicHash?: string;
  signature?: string;
}

// Hex 解析器历史记录
export interface HexParserHistory {
  id: string;
  hexData: string;              // 解析的 hex 数据
  decodeType: 'auto' | 'function' | 'event' | 'error';  // 解析类型
  result: DecodedData | null;   // 解析结果
  success: boolean;              // 是否成功
  timestamp: number;             // 时间戳
}

// ==================== ABI 编码器相关类型 ====================

// 编码模式
export type EncodingMode = 'abi' | 'packed';

// 操作类型
export type OperationType = 'encode' | 'decode';

// 类型定义预设
export interface TypeDefPreset {
  id: string;
  name: string;           // 预设名称，如 "Swap 参数"
  types: string[];        // 类型列表，如 ['uint64', 'uint8', 'address']
  createdAt: number;
}

// ABI 编码器历史记录
export interface AbiEncoderHistory {
  id: string;
  encodingMode: EncodingMode;   // 编码模式
  operationType: OperationType;  // 操作类型
  types: string[];              // 使用的类型定义
  inputValues: string[];        // 输入值（encode 时是各字段的值，decode 时是 hex）
  output: string;               // 输出结果（成功时为结果，失败时为错误信息）
  success: boolean;             // 是否成功
  timestamp: number;            // 时间戳
}

// ==================== Debug Trace 相关类型 ====================

// callTracer 返回的原始结构
export interface CallTrace {
  from: string;
  to?: string;
  gas: string;
  gasUsed: string;
  input: string;
  output?: string;
  error?: string;
  revertReason?: string; // 回滚原因
  value?: string;
  type: 'CALL' | 'DELEGATECALL' | 'STATICCALL' | 'CREATE' | 'CREATE2' | 'SELFDESTRUCT';
  calls?: CallTrace[]; // 嵌套调用
}

// 解析后的 CallTrace 结构
export interface ParsedCallTrace extends CallTrace {
  decodedInput?: {
    functionName: string;
    args: any;
    signature: string;
  };
  decodedOutput?: any; // 解析后的返回值
  decodedError?: {
    errorName?: string;
    args?: any;
    signature?: string;
    message?: string;
  };
  calls?: ParsedCallTrace[]; // 递归嵌套
}

// ==================== 状态覆盖相关类型 ====================

export interface StateOverride {
  balance?: string;                       // hex string
  nonce?: number;
  code?: string;                          // hex string
  state?: Record<string, string>;         // full replacement: slot => value
  stateDiff?: Record<string, string>;     // diff: slot => value
}

export interface AccountOverrideConfig {
  address: string;
  override: StateOverride;
}

export interface StateOverridePreset {
  id: string;
  name: string;
  description?: string;
  accounts: AccountOverrideConfig[];
  createdAt: number;
}

// ==================== 存储槽计算类型 ====================

export interface StorageVariable {
  name: string;
  type: string;                 // e.g. uint256, address, mapping(address => uint256)
  slot: number;                 // base slot
  offset?: number;              // packed storage offset (bytes)
  size?: number;                // variable size (bytes)
}

export interface CalculatedSlot {
  variable: StorageVariable;
  slot: string;                 // final computed slot (hex)
  keys?: any[];                 // mapping/array keys
  value?: string;               // encoded value (hex)
  path?: string;                // human-readable path e.g. balances[0x123…]
}
