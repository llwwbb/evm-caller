import { JsonRpcProvider, Contract } from 'ethers';
import { CallResult, RpcConfig, ParsedParam } from '../types';

/**
 * 调用合约的 view 函数
 * @param config - RPC 配置
 * @param abi - 合约 ABI
 * @param functionName - 函数名
 * @param args - 函数参数
 * @param outputs - 函数输出定义（用于格式化带名称的返回值）
 * @returns 调用结果
 */
export async function callViewFunction(
  config: RpcConfig,
  abi: string | any[],
  functionName: string,
  args: any[],
  outputs?: ParsedParam[]
): Promise<CallResult> {
  try {
    console.log('🚀 开始调用函数:', functionName, 'args:', args);
    console.log('📋 outputs 定义:', outputs);
    
    // 创建 provider
    const provider = new JsonRpcProvider(config.rpcUrl);

    // 创建合约实例
    const contract = new Contract(config.contractAddress, abi, provider);

    // 准备 blockTag（默认 'latest'）
    let blockTag: string | number = config.blockTag || 'latest';
    
    // 如果 blockTag 是数字字符串，转换为数字
    if (typeof blockTag === 'string' && /^\d+$/.test(blockTag)) {
      blockTag = parseInt(blockTag, 10);
    }
    
    console.log('🔖 使用区块标识:', blockTag, '类型:', typeof blockTag);

    // 调用函数时指定 blockTag
    const result = await contract[functionName](...args, { blockTag });
    console.log('📥 原始返回结果:', result);
    console.log('🔍 结果类型检查:', {
      hasToArray: typeof result?.toArray === 'function',
      hasToObject: typeof result?.toObject === 'function',
      isArray: Array.isArray(result),
      keys: result && typeof result === 'object' ? Object.keys(result) : []
    });

    // 格式化返回值
    const formattedResult = formatResult(result, outputs);
    console.log('✨ 格式化后结果:', formattedResult);

    return {
      success: true,
      data: formattedResult,
    };
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
 * 格式化返回结果为可读格式
 * @param result - 原始返回结果
 * @param outputs - 函数输出定义（用于命名返回值）
 * @returns 格式化后的结果
 */
function formatResult(result: any, _outputs?: ParsedParam[]): any {
  // 处理 BigInt
  if (typeof result === 'bigint') {
    return result.toString();
  }

  // 处理对象 - 必须在数组检查之前，因为 Result 对象也是数组
  if (result && typeof result === 'object') {
    // 检查是否是 ethers 的 Result 对象（优先级最高）
    if (result.toArray && typeof result.toArray === 'function') {
      console.log('🔍 检测到 Result 对象');
      
      // 尝试使用 toObject() 方法（ethers v6）
      if (result.toObject && typeof result.toObject === 'function') {
        try {
          const obj = result.toObject();
          console.log('✅ 使用 toObject() 成功:', obj);
          
          // 递归格式化对象中的值
          const formatted: any = {};
          for (const key in obj) {
            formatted[key] = formatResult(obj[key]);
          }
          return formatted;
        } catch (error) {
          console.log('⚠️ toObject() 失败，降级处理:', error);
        }
      }
      
      const arr = result.toArray();
      console.log('📦 toArray() 结果:', arr);
      
      // 尝试从 Result 对象中提取命名字段
      const formatted: any = {};
      let hasNamedFields = false;
      
      for (const key in result) {
        if (!isNaN(Number(key))) continue; // 跳过数字索引
        hasNamedFields = true;
        formatted[key] = formatResult(result[key]);
      }
      
      if (hasNamedFields) {
        console.log('✅ 找到命名字段:', Object.keys(formatted));
        return formatted;
      }
      
      console.log('⚠️ 未找到命名字段，返回数组');
      return arr.map((item: any) => formatResult(item));
    }
    
    // 处理普通数组（在 Result 对象检查之后）
    if (Array.isArray(result)) {
      console.log('📦 处理普通数组');
      return result.map(item => formatResult(item));
    }

    // 处理普通对象
    const formatted: any = {};
    for (const key in result) {
      if (!isNaN(Number(key))) continue;
      formatted[key] = formatResult(result[key]);
    }
    return formatted;
  }

  return result;
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

