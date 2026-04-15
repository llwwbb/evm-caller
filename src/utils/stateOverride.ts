import { JsonRpcProvider, Interface, toBeHex } from 'ethers';
import { StateOverride, CallResult, ParsedParam } from '../types';

/**
 * 状态覆盖执行器
 * 支持 eth_call 和 debug_traceCall 的状态覆盖参数
 */

/**
 * 格式化状态覆盖参数为 RPC 格式
 */
export function formatStateOverrideParams(
  stateOverride: Record<string, StateOverride>
): Record<string, any> {
  const formatted: Record<string, any> = {};
  
  for (const [address, override] of Object.entries(stateOverride)) {
    formatted[address] = {};
    
    if (override.balance !== undefined) {
      // 确保余额是 hex 格式
      formatted[address].balance = override.balance.startsWith('0x') 
        ? override.balance 
        : toBeHex(override.balance);
    }
    
    if (override.nonce !== undefined) {
      // nonce 转换为 hex
      formatted[address].nonce = toBeHex(override.nonce);
    }
    
    if (override.code !== undefined) {
      formatted[address].code = override.code;
    }
    
    if (override.state !== undefined) {
      formatted[address].state = override.state;
    }
    
    if (override.stateDiff !== undefined) {
      formatted[address].stateDiff = override.stateDiff;
    }
  }
  
  return formatted;
}

/**
 * 使用 eth_call 执行带状态覆盖的调用
 */
export async function callWithStateOverride(
  provider: JsonRpcProvider,
  contractAddress: string,
  abi: string | any[],
  functionName: string,
  args: any[],
  blockTag: string | number,
  stateOverride?: Record<string, StateOverride>,
  outputs?: ParsedParam[]
): Promise<CallResult> {
  try {
    console.log('🚀 使用状态覆盖执行 eth_call');
    console.log('合约地址:', contractAddress);
    console.log('函数:', functionName);
    console.log('参数:', args);
    console.log('状态覆盖:', stateOverride);
    
    // 创建接口
    const iface = new Interface(abi);
    
    // 编码函数调用
    const data = iface.encodeFunctionData(functionName, args);
    
    // 准备调用参数
    const transaction = {
      to: contractAddress,
      data,
    };
    
    // 格式化状态覆盖参数
    const formattedOverride = stateOverride 
      ? formatStateOverrideParams(stateOverride)
      : undefined;
    
    // 使用底层 RPC 调用，支持状态覆盖
    let result: string;
    if (formattedOverride) {
      // eth_call 带状态覆盖: [transaction, blockTag, stateOverride]
      result = await provider.send('eth_call', [
        transaction,
        typeof blockTag === 'number' ? toBeHex(blockTag) : blockTag,
        formattedOverride,
      ]);
    } else {
      // 普通 eth_call
      result = await provider.send('eth_call', [
        transaction,
        typeof blockTag === 'number' ? toBeHex(blockTag) : blockTag,
      ]);
    }
    
    console.log('📥 原始返回结果:', result);
    
    // 解码返回值
    const decoded = iface.decodeFunctionResult(functionName, result);
    console.log('✨ 解码后结果:', decoded);
    
    // 格式化结果
    const formattedResult = formatResult(decoded, outputs);
    
    return {
      success: true,
      data: formattedResult,
    };
  } catch (error) {
    console.error('状态覆盖调用失败:', error);
    
    let errorMessage = '调用失败';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // 提取更有用的错误信息
      if (errorMessage.includes('execution reverted')) {
        const revertMatch = errorMessage.match(/reverted:?\s*(.+)/i);
        if (revertMatch) {
          errorMessage = `执行回滚: ${revertMatch[1]}`;
        } else {
          errorMessage = '执行回滚';
        }
      } else if (errorMessage.includes('could not decode result data')) {
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
 * 使用 debug_traceCall 执行带状态覆盖的调用
 * 返回详细的调用追踪信息
 */
export async function debugTraceWithStateOverride(
  provider: JsonRpcProvider,
  contractAddress: string,
  abi: string | any[],
  functionName: string,
  args: any[],
  blockTag: string | number,
  stateOverride?: Record<string, StateOverride>
): Promise<CallResult> {
  try {
    console.log('🔬 使用状态覆盖执行 debug_traceCall');
    
    // 创建接口
    const iface = new Interface(abi);
    
    // 编码函数调用
    const data = iface.encodeFunctionData(functionName, args);
    
    // 准备调用参数
    const transaction = {
      to: contractAddress,
      data,
    };
    
    // 格式化状态覆盖参数
    const formattedOverride = stateOverride 
      ? formatStateOverrideParams(stateOverride)
      : undefined;
    
    // debug_traceCall 参数格式
    const traceConfig: any = {
      tracer: 'callTracer',
      tracerConfig: {
        onlyTopCall: false, // 包含所有子调用
      },
    };
    
    // 添加状态覆盖
    if (formattedOverride) {
      traceConfig.stateOverrides = formattedOverride;
    }
    
    // 执行追踪调用
    const result = await provider.send('debug_traceCall', [
      transaction,
      typeof blockTag === 'number' ? toBeHex(blockTag) : blockTag,
      traceConfig,
    ]);
    
    console.log('📥 追踪结果:', result);
    
    // 解码返回值（如果有）
    let decodedOutput;
    if (result.output && result.output !== '0x') {
      try {
        const decoded = iface.decodeFunctionResult(functionName, result.output);
        decodedOutput = formatResult(decoded);
      } catch (error) {
        console.warn('解码输出失败:', error);
      }
    }
    
    return {
      success: !result.error,
      data: {
        trace: result,
        decoded: decodedOutput,
      },
    };
  } catch (error) {
    console.error('debug_traceCall 失败:', error);
    
    let errorMessage = '追踪调用失败';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (errorMessage.includes('method not found') || errorMessage.includes('not supported')) {
        errorMessage = '当前 RPC 不支持 debug_traceCall 方法（需要 Archive Node）';
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 静态调用（模拟执行）带状态覆盖
 * 用于模拟执行状态修改函数
 */
export async function staticCallWithStateOverride(
  provider: JsonRpcProvider,
  contractAddress: string,
  abi: string | any[],
  functionName: string,
  args: any[],
  blockTag: string | number,
  stateOverride?: Record<string, StateOverride>,
  outputs?: ParsedParam[]
): Promise<CallResult> {
  // staticCall 本质上就是 eth_call，使用相同的实现
  return callWithStateOverride(
    provider,
    contractAddress,
    abi,
    functionName,
    args,
    blockTag,
    stateOverride,
    outputs
  );
}

/**
 * 格式化返回结果为可读格式
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
 * 批量执行多个调用（使用状态覆盖）
 * 注意：每个调用都是独立的，不会互相影响状态
 */
export async function batchCallWithStateOverride(
  provider: JsonRpcProvider,
  calls: Array<{
    contractAddress: string;
    abi: string | any[];
    functionName: string;
    args: any[];
    outputs?: ParsedParam[];
  }>,
  blockTag: string | number,
  stateOverride?: Record<string, StateOverride>
): Promise<Array<CallResult>> {
  const results: Array<CallResult> = [];
  
  for (const call of calls) {
    const result = await callWithStateOverride(
      provider,
      call.contractAddress,
      call.abi,
      call.functionName,
      call.args,
      blockTag,
      stateOverride,
      call.outputs
    );
    results.push(result);
  }
  
  return results;
}



