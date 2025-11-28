import { JsonFragment } from 'ethers';

export interface ParsedFunction {
  name: string;
  inputs: ParsedParam[];
  outputs: ParsedParam[];
  stateMutability: string;
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

export interface ContractPreset {
  id: string;
  name: string;
  address: string;
  description?: string;
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
}

// 解析后的事件定义
export interface ParsedEvent {
  name: string;
  inputs: ParsedParam[];
  anonymous?: boolean;
}

