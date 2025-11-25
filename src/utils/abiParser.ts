import { Interface, FunctionFragment } from 'ethers';
import { ParsedFunction, AbiInput } from '../types';

/**
 * 解析 ABI 输入（支持 JSON ABI 和 Solidity 函数签名）
 * @param abiInput - JSON ABI 数组或 Solidity 函数签名字符串
 * @param includeStateMutating - 是否包含状态修改函数（payable/nonpayable）
 * @returns 解析后的函数列表
 */
export function parseAbi(abiInput: AbiInput, includeStateMutating: boolean = false): ParsedFunction[] {
  try {
    let iface: Interface;

    // 判断输入类型
    if (typeof abiInput === 'string') {
      // Solidity 函数签名格式
      // 支持多行输入，每行一个函数
      const lines = abiInput
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // 构造一个临时的 Interface
      const fragments: string[] = [];
      for (const line of lines) {
        // 根据选项决定是否包含状态修改函数
        if (includeStateMutating) {
          // 包含所有 function 声明
          if (line.includes('function')) {
            fragments.push(line);
          }
        } else {
          // 只处理包含 view 或 pure 的函数
          if (line.includes('view') || line.includes('pure')) {
            fragments.push(line);
          }
        }
      }

      if (fragments.length === 0) {
        throw new Error(includeStateMutating ? '未找到有效的函数' : '未找到 view 或 pure 函数');
      }

      iface = new Interface(fragments);
    } else {
      // JSON ABI 格式
      iface = new Interface(abiInput);
    }

    // 提取所有函数
    const functions: ParsedFunction[] = [];
    
    iface.forEachFunction((func: FunctionFragment) => {
      // 根据选项决定是否包含状态修改函数
      const isReadOnly = func.stateMutability === 'view' || func.stateMutability === 'pure';
      const isStateMutating = func.stateMutability === 'nonpayable' || func.stateMutability === 'payable';
      
      if (isReadOnly || (includeStateMutating && isStateMutating)) {
        functions.push({
          name: func.name,
          inputs: func.inputs.map(input => ({
            name: input.name || '',
            type: input.type,
            internalType: input.baseType,
          })),
          outputs: func.outputs ? func.outputs.map(output => ({
            name: output.name || '',
            type: output.type,
            internalType: output.baseType,
          })) : [],
          stateMutability: func.stateMutability,
        });
      }
    });

    if (functions.length === 0) {
      throw new Error(includeStateMutating ? 'ABI 中没有找到有效的函数' : 'ABI 中没有找到 view 或 pure 函数');
    }

    return functions;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`ABI 解析失败: ${error.message}`);
    }
    throw new Error('ABI 解析失败: 未知错误');
  }
}

/**
 * 验证 ABI 输入格式
 * @param abiInput - 用户输入的 ABI 字符串
 * @param includeStateMutating - 是否包含状态修改函数
 * @returns 验证结果和错误信息
 */
export function validateAbiInput(abiInput: string, includeStateMutating: boolean = false): { valid: boolean; error?: string } {
  if (!abiInput || abiInput.trim() === '') {
    return { valid: false, error: 'ABI 不能为空' };
  }

  const trimmed = abiInput.trim();

  // 尝试解析为 JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed) && typeof parsed !== 'object') {
        return { valid: false, error: 'JSON ABI 格式不正确' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'JSON 格式错误' };
    }
  }

  // 检查是否是 Solidity 函数签名
  if (trimmed.includes('function')) {
    if (includeStateMutating) {
      // 如果包含状态修改函数，只要有 function 关键字即可
      return { valid: true };
    } else {
      // 简单验证：检查是否包含 view 或 pure
      if (trimmed.includes('view') || trimmed.includes('pure')) {
        return { valid: true };
      }
      return { valid: false, error: '请确保函数签名包含 view 或 pure 关键字，或勾选"包含状态修改函数"' };
    }
  }

  return { valid: false, error: '无法识别的 ABI 格式（支持 JSON ABI 或 Solidity 函数签名）' };
}

/**
 * 格式化参数类型为用户友好的显示
 * @param type - 参数类型
 * @returns 格式化后的类型字符串
 */
export function formatParamType(type: string): string {
  // 简化显示一些常见类型
  const typeMap: Record<string, string> = {
    'uint256': 'uint256 (整数)',
    'address': 'address (地址)',
    'string': 'string (字符串)',
    'bool': 'bool (布尔值)',
    'bytes': 'bytes (字节)',
  };

  return typeMap[type] || type;
}

