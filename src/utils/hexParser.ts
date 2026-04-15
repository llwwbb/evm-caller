import { Interface } from 'ethers';
import { DecodedData } from '../types';
import { toDisplay } from './decodedFormat';

/**
 * 将 hex 解析为函数调用
 */
export function decodeHexAsFunction(hex: string, abi: string): DecodedData {
  if (!hex || hex === '0x') {
    return {
      type: 'unknown',
      error: 'Hex 数据为空',
    };
  }

  try {
    const abiParsed = typeof abi === 'string' ? JSON.parse(abi) : abi;
    const iface = new Interface(abiParsed);
    
    const parsed = iface.parseTransaction({ data: hex });
    
    if (!parsed) {
      return {
        type: 'unknown',
        error: '无法解析为函数调用',
      };
    }

    // 格式化参数
    const args: any = {};
    parsed.fragment.inputs.forEach((input, i) => {
      const value = parsed.args[i];
      args[input.name || `arg${i}`] = toDisplay(value, input as any);
    });

    return {
      type: 'function',
      name: parsed.name,
      signature: parsed.signature,
      args,
      fragment: parsed.fragment,
    };
  } catch (error) {
    return {
      type: 'unknown',
      error: error instanceof Error ? error.message : '解析失败',
    };
  }
}

/**
 * 将 hex 解析为事件数据
 */
export function decodeHexAsEvent(hex: string, abi: string): DecodedData {
  if (!hex || hex === '0x') {
    return {
      type: 'unknown',
      error: 'Hex 数据为空',
    };
  }

  try {
    const abiParsed = typeof abi === 'string' ? JSON.parse(abi) : abi;
    const iface = new Interface(abiParsed);
    
    // Event 需要 topics 和 data 分离
    // 假设第一个 topic 是事件签名，剩余是 indexed 参数
    // 这里我们尝试所有可能的事件签名
    
    // 从 hex 中提取可能的 topic0（前 32 字节 + 0x）
    let topics: string[] = [];
    let data: string = hex;
    
    // 如果 hex 足够长，尝试提取 topic
    if (hex.length >= 66) { // 0x + 64 字符
      const possibleTopic = hex.slice(0, 66);
      topics = [possibleTopic];
      data = '0x' + hex.slice(66);
    }

    // 尝试解析（尝试所有可能的事件）
    try {
      const parsed = iface.parseLog({ topics, data });
      
      if (parsed) {
          // 格式化参数
          const args: any = {};
          parsed.fragment.inputs.forEach((input, i) => {
            const value = parsed.args[i];
            args[input.name || `arg${i}`] = toDisplay(value, input as any);
          });

          return {
            type: 'event',
            name: parsed.name,
            signature: parsed.signature,
            args,
            fragment: parsed.fragment,
          };
        }
    } catch (err) {
      // 无法解析
    }

    return {
      type: 'unknown',
      error: '无法解析为事件（可能需要正确的 topics 和 data 分离）',
    };
  } catch (error) {
    return {
      type: 'unknown',
      error: error instanceof Error ? error.message : '解析失败',
    };
  }
}

/**
 * 将 hex 解析为错误数据
 */
export function decodeHexAsError(hex: string, abi: string): DecodedData {
  if (!hex || hex === '0x') {
    return {
      type: 'unknown',
      error: 'Hex 数据为空',
    };
  }

  try {
    const abiParsed = typeof abi === 'string' ? JSON.parse(abi) : abi;
    const iface = new Interface(abiParsed);
    
    // 尝试解析错误
    const parsed = iface.parseError(hex);
    
    if (!parsed) {
      return {
        type: 'unknown',
        error: '无法解析为错误',
      };
    }

    // 格式化参数
    const args: any = {};
    parsed.fragment.inputs.forEach((input, i) => {
      const value = parsed.args[i];
      args[input.name || `arg${i}`] = toDisplay(value, input as any);
    });

    return {
      type: 'error',
      name: parsed.name,
      signature: parsed.signature,
      args,
      fragment: parsed.fragment,
    };
  } catch (error) {
    return {
      type: 'unknown',
      error: error instanceof Error ? error.message : '解析失败',
    };
  }
}

/**
 * 自动检测类型并解析
 * 按顺序尝试：函数 -> 错误 -> 事件
 */
export function autoDetectAndDecode(hex: string, abi: string): DecodedData {
  if (!hex || hex === '0x') {
    return {
      type: 'unknown',
      error: 'Hex 数据为空',
    };
  }

  // 1. 尝试解析为函数调用
  const funcResult = decodeHexAsFunction(hex, abi);
  if (funcResult.type === 'function') {
    return funcResult;
  }

  // 2. 尝试解析为错误
  const errorResult = decodeHexAsError(hex, abi);
  if (errorResult.type === 'error') {
    return errorResult;
  }

  // 3. 尝试解析为事件
  const eventResult = decodeHexAsEvent(hex, abi);
  if (eventResult.type === 'event') {
    return eventResult;
  }

  // 都无法解析
  return {
    type: 'unknown',
    error: '无法识别数据类型（尝试了函数、错误、事件）',
  };
}


/**
 * 从 ABI 中提取所有函数签名
 */
export function extractFunctionSignatures(abi: string): string[] {
  try {
    const abiParsed = typeof abi === 'string' ? JSON.parse(abi) : abi;
    const iface = new Interface(abiParsed);
    
    const signatures: string[] = [];
    iface.forEachFunction((func) => {
      signatures.push(func.format('sighash'));
    });
    
    return signatures;
  } catch (error) {
    console.error('提取函数签名失败:', error);
    return [];
  }
}

/**
 * 从 ABI 中提取所有事件签名
 */
export function extractEventSignatures(abi: string): string[] {
  try {
    const abiParsed = typeof abi === 'string' ? JSON.parse(abi) : abi;
    const iface = new Interface(abiParsed);
    
    const signatures: string[] = [];
    iface.forEachEvent((event) => {
      signatures.push(event.format('sighash'));
    });
    
    return signatures;
  } catch (error) {
    console.error('提取事件签名失败:', error);
    return [];
  }
}

