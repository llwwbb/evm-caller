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

