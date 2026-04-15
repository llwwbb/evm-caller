import { Interface } from 'ethers';
import { CallTrace, ParsedCallTrace } from '../types';
import { decodeInputData } from './transactionParser';
import { toDisplay } from './decodedFormat';

/**
 * 调用 debug_traceTransaction RPC 方法获取交易调用追踪
 * 使用直接的 HTTP 请求而不是 provider.send，避免 batch call 问题
 * @param rpcUrl - RPC URL
 * @param txHash - 交易哈希
 * @param tracer - 追踪器类型，默认为 callTracer
 * @returns CallTrace 对象
 */
export async function fetchDebugTrace(
  rpcUrl: string,
  txHash: string,
  tracer: 'callTracer' = 'callTracer'
): Promise<CallTrace> {
  try {
    // 使用直接的 fetch 请求，确保是单独调用而非 batch call
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'debug_traceTransaction',
        params: [txHash, { tracer }],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }

    return data.result as CallTrace;
  } catch (error) {
    console.error('Failed to fetch debug trace:', error);
    throw error;
  }
}

/**
 * 递归解析 CallTrace 中的所有 input、output 和 error
 * @param trace - 原始 CallTrace
 * @param abis - ABI 数组
 * @returns 解析后的 ParsedCallTrace
 */
export function parseTraceWithAbi(
  trace: CallTrace,
  abis: string[]
): ParsedCallTrace {
  const parsed: ParsedCallTrace = { ...trace };
  
  // 解析 input
  if (trace.input && trace.input !== '0x' && trace.input.length > 10) {
    for (const abi of abis) {
      const decoded = decodeInputData(trace.input, abi);
      if (decoded) {
        parsed.decodedInput = decoded;
        break;
      }
    }
  }
  
  // 解析 output
  if (trace.output && trace.output !== '0x' && parsed.decodedInput) {
    // 尝试使用已解析的函数信息来解析输出
    try {
      const decodedOutput = decodeOutputData(
        trace.output,
        parsed.decodedInput.functionName,
        abis
      );
      if (decodedOutput !== null) {
        parsed.decodedOutput = decodedOutput;
      }
    } catch (error) {
      console.error('Failed to decode output:', error);
    }
  }
  
  // 解析 error
  if (trace.error) {
    parsed.decodedError = parseErrorData(trace.error, abis);
  }
  
  // 递归处理子调用
  if (trace.calls && trace.calls.length > 0) {
    parsed.calls = trace.calls.map(call => parseTraceWithAbi(call, abis));
  }
  
  return parsed;
}

/**
 * 解析输出数据
 * @param outputData - 原始输出数据
 * @param functionName - 函数名
 * @param abis - ABI 数组
 * @returns 解析后的输出
 */
function decodeOutputData(
  outputData: string,
  functionName: string,
  abis: string[]
): any {
  if (!outputData || outputData === '0x') {
    return null;
  }
  
  for (const abiString of abis) {
    try {
      const abi = typeof abiString === 'string' ? JSON.parse(abiString) : abiString;
      const iface = new Interface(abi);
      
      const fragment = iface.getFunction(functionName);
      if (fragment) {
        const decoded = iface.decodeFunctionResult(fragment, outputData);
        return toDisplay(decoded, fragment.outputs as any);
      }
    } catch (error) {
      // 继续尝试下一个 ABI
      continue;
    }
  }
  
  return null;
}

/**
 * 解析错误数据
 * @param errorData - 错误信息或 revert data
 * @param abis - ABI 数组
 * @returns 解析后的错误信息
 */
function parseErrorData(
  errorData: string,
  abis: string[]
): ParsedCallTrace['decodedError'] {
  // 如果是普通字符串错误消息
  if (!errorData.startsWith('0x')) {
    return {
      message: errorData
    };
  }
  
  // 尝试解析 revert data
  if (errorData.length > 10) {
    // 标准的 Error(string) selector: 0x08c379a0
    if (errorData.startsWith('0x08c379a0')) {
      try {
        const iface = new Interface([
          'error Error(string message)'
        ]);
        const decoded = iface.parseError(errorData);
        if (decoded) {
          return {
            errorName: 'Error',
            args: { message: decoded.args[0] },
            signature: 'Error(string)'
          };
        }
      } catch (e) {
        // 忽略
      }
    }
    
    // 尝试使用提供的 ABI 解析自定义错误
    for (const abiString of abis) {
      try {
        const abi = typeof abiString === 'string' ? JSON.parse(abiString) : abiString;
        const iface = new Interface(abi);
        const decoded = iface.parseError(errorData);
        
        if (decoded) {
          const args: any = {};
          decoded.fragment.inputs.forEach((input, i) => {
            args[input.name || `arg${i}`] = toDisplay(decoded.args[i], input as any);
          });

          return {
            errorName: decoded.name,
            args,
            signature: decoded.signature
          };
        }
      } catch (error) {
        continue;
      }
    }
  }
  
  return {
    message: errorData
  };
}

/**
 * 格式化地址显示（缩略格式）
 * @param address - 完整地址
 * @returns 缩略显示的地址
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * 格式化 Gas 显示
 * @param gas - gas 值（hex 字符串）
 * @returns 格式化后的字符串
 */
export function formatGas(gas: string): string {
  try {
    const gasValue = BigInt(gas);
    return gasValue.toLocaleString();
  } catch {
    return gas;
  }
}

/**
 * 计算 Gas 使用百分比
 * @param gasUsed - 已使用的 gas
 * @param gasLimit - gas 限制
 * @returns 百分比（0-100）
 */
export function calculateGasPercentage(gasUsed: string, gasLimit: string): number {
  try {
    const used = BigInt(gasUsed);
    const limit = BigInt(gasLimit);
    if (limit === BigInt(0)) return 0;
    return Number((used * BigInt(100)) / limit);
  } catch {
    return 0;
  }
}

/**
 * 获取调用类型的图标
 * @param type - 调用类型
 * @returns 图标字符串
 */
export function getCallTypeIcon(type: CallTrace['type']): string {
  const iconMap: Record<CallTrace['type'], string> = {
    'CALL': '📞',
    'DELEGATECALL': '🔀',
    'STATICCALL': '👁️',
    'CREATE': '🆕',
    'CREATE2': '🆕',
    'SELFDESTRUCT': '💥'
  };
  return iconMap[type] || '❓';
}
