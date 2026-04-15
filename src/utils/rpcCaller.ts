import { JsonRpcProvider, Contract } from 'ethers';
import { CallResult, RpcConfig } from '../types';

/**
 * Call a view function or simulate a state-mutating function. Returns the raw
 * ethers result; callers pass it through toDisplay() with ABI outputs for
 * rendering.
 */
export async function callViewFunction(
  config: RpcConfig,
  abi: string | any[],
  functionName: string,
  args: any[],
  stateMutability?: string
): Promise<CallResult> {
  try {
    const provider = new JsonRpcProvider(config.rpcUrl);
    const contract = new Contract(config.contractAddress, abi, provider);

    let blockTag: string | number = config.blockTag || 'latest';
    if (typeof blockTag === 'string' && /^\d+$/.test(blockTag)) {
      blockTag = parseInt(blockTag, 10);
    }

    const isStateMutating = stateMutability === 'nonpayable' || stateMutability === 'payable';
    const result = isStateMutating
      ? await contract[functionName].staticCall(...args, { blockTag })
      : await contract[functionName](...args, { blockTag });

    return { success: true, data: result };
  } catch (error) {
    console.error('RPC 调用失败:', error);
    
    let errorMessage = '调用失败';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // 提取更有用的错误信息
      if (errorMessage.includes('could not decode result data')) {
        errorMessage = '无法解码返回数据，请检查函数参数是否正确';
      } else if (errorMessage.includes('invalid address')) {
        errorMessage = '无效的合约地址';
      } else if (errorMessage.includes('network')) {
        errorMessage = 'RPC 网络连接失败，请检查 RPC 地址';
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 验证 RPC 连接
 * @param rpcUrl - RPC URL
 * @returns 是否连接成功
 */
export async function validateRpcConnection(rpcUrl: string): Promise<{ valid: boolean; error?: string; chainId?: number }> {
  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const network = await provider.getNetwork();
    
    return {
      valid: true,
      chainId: Number(network.chainId),
    };
  } catch (error) {
    console.error('RPC 连接验证失败:', error);
    
    let errorMessage = 'RPC 连接失败';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * 验证以太坊地址格式
 * @param address - 地址字符串
 * @returns 是否有效
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 解析参数值（根据类型）
 * @param value - 用户输入的值
 * @param type - 参数类型
 * @returns 解析后的值
 */
export function parseParamValue(value: string, type: string): any {
  // 处理空值
  if (!value || value.trim() === '') {
    throw new Error('参数值不能为空');
  }

  const trimmed = value.trim();

  // uint 类型
  if (type.startsWith('uint')) {
    const num = BigInt(trimmed);
    return num;
  }

  // int 类型
  if (type.startsWith('int') && !type.startsWith('interface')) {
    const num = BigInt(trimmed);
    return num;
  }

  // address 类型
  if (type === 'address') {
    if (!isValidAddress(trimmed)) {
      throw new Error('无效的地址格式');
    }
    return trimmed;
  }

  // bool 类型
  if (type === 'bool') {
    const lower = trimmed.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    throw new Error('布尔值必须是 true/false 或 1/0');
  }

  // bytes 类型
  if (type.startsWith('bytes')) {
    if (!trimmed.startsWith('0x')) {
      throw new Error('bytes 类型必须以 0x 开头');
    }
    return trimmed;
  }

  // 数组类型
  if (type.endsWith('[]')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        throw new Error('数组格式不正确');
      }
      return parsed;
    } catch {
      throw new Error('数组格式不正确，请使用 JSON 格式如 ["item1", "item2"]');
    }
  }

  // 默认返回字符串
  return trimmed;
}

