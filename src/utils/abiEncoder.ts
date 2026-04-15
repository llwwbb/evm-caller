import { AbiCoder, solidityPacked, getBytes, hexlify, toBeHex } from 'ethers';
import { toDisplay } from './decodedFormat';

/**
 * 编码结果
 */
export interface EncodeResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * 解码结果
 */
export interface DecodeResult {
  success: boolean;
  data?: any[];
  error?: string;
}

/**
 * 获取 Solidity 类型的固定字节长度
 * 返回 -1 表示是动态长度类型
 */
export function getTypeByteLength(type: string): number {
  // 去除空格
  type = type.trim();
  
  // bool: 1 byte in packed, but treated as uint8
  if (type === 'bool') return 1;
  
  // address: 20 bytes
  if (type === 'address') return 20;
  
  // uintN / intN
  const uintMatch = type.match(/^u?int(\d+)$/);
  if (uintMatch) {
    const bits = parseInt(uintMatch[1], 10);
    return bits / 8;
  }
  
  // uint / int (默认 256 位)
  if (type === 'uint' || type === 'int') return 32;
  
  // bytesN (固定长度)
  const bytesNMatch = type.match(/^bytes(\d+)$/);
  if (bytesNMatch) {
    const n = parseInt(bytesNMatch[1], 10);
    if (n >= 1 && n <= 32) return n;
  }
  
  // 动态类型：string, bytes, 动态数组
  if (type === 'string' || type === 'bytes') return -1;
  
  // 固定长度数组：type[N]
  const fixedArrayMatch = type.match(/^(.+)\[(\d+)\]$/);
  if (fixedArrayMatch) {
    const elementType = fixedArrayMatch[1];
    const length = parseInt(fixedArrayMatch[2], 10);
    const elementSize = getTypeByteLength(elementType);
    if (elementSize === -1) return -1; // 元素是动态类型
    return elementSize * length;
  }
  
  // 动态数组：type[]
  if (type.endsWith('[]')) return -1;
  
  // Tuple 类型：(type1,type2,...)
  if (type.startsWith('(') && type.endsWith(')')) {
    const innerTypes = parseTupleTypes(type);
    let totalSize = 0;
    for (const t of innerTypes) {
      const size = getTypeByteLength(t);
      if (size === -1) return -1; // 包含动态类型
      totalSize += size;
    }
    return totalSize;
  }
  
  // 未知类型
  return -1;
}

/**
 * 解析 tuple 内部的类型列表
 * 例如: "(uint256,address,(bool,uint8))" => ["uint256", "address", "(bool,uint8)"]
 */
export function parseTupleTypes(tupleType: string): string[] {
  // 去除外层括号
  const inner = tupleType.slice(1, -1);
  
  const types: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of inner) {
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      if (current.trim()) {
        types.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    types.push(current.trim());
  }
  
  return types;
}

/**
 * 检查类型列表是否全部为固定长度类型
 */
export function areAllTypesFixedLength(types: string[]): boolean {
  return types.every(t => getTypeByteLength(t) !== -1);
}

/**
 * 获取所有动态类型
 */
export function getDynamicTypes(types: string[]): string[] {
  return types.filter(t => getTypeByteLength(t) === -1);
}

/**
 * 将输入值转换为适合编码的格式
 */
export function parseInputValue(value: string, type: string): any {
  value = value.trim();
  type = type.trim();
  
  // bool
  if (type === 'bool') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    throw new Error(`无效的布尔值: ${value}`);
  }
  
  // address
  if (type === 'address') {
    if (!value.startsWith('0x') || value.length !== 42) {
      throw new Error(`无效的地址: ${value}`);
    }
    return value;
  }
  
  // uintN / intN / uint / int
  if (type.match(/^u?int(\d*)$/)) {
    // 支持 hex 或十进制
    if (value.startsWith('0x')) {
      return BigInt(value);
    }
    return BigInt(value);
  }
  
  // bytesN
  const bytesNMatch = type.match(/^bytes(\d+)$/);
  if (bytesNMatch) {
    if (!value.startsWith('0x')) {
      value = '0x' + value;
    }
    return value;
  }
  
  // bytes (动态)
  if (type === 'bytes') {
    if (!value.startsWith('0x')) {
      value = '0x' + value;
    }
    return value;
  }
  
  // string
  if (type === 'string') {
    return value;
  }
  
  // 数组类型
  if (type.endsWith(']')) {
    // 尝试解析 JSON 数组
    try {
      const arr = JSON.parse(value);
      if (!Array.isArray(arr)) {
        throw new Error('不是数组');
      }
      // 获取元素类型
      const elementType = type.replace(/\[\d*\]$/, '');
      return arr.map(v => parseInputValue(String(v), elementType));
    } catch (e) {
      throw new Error(`无效的数组格式: ${value}`);
    }
  }
  
  // Tuple 类型
  if (type.startsWith('(') && type.endsWith(')')) {
    try {
      const arr = JSON.parse(value);
      if (!Array.isArray(arr)) {
        throw new Error('Tuple 值必须是数组');
      }
      const innerTypes = parseTupleTypes(type);
      if (arr.length !== innerTypes.length) {
        throw new Error(`Tuple 元素数量不匹配: 期望 ${innerTypes.length}, 实际 ${arr.length}`);
      }
      return arr.map((v, i) => parseInputValue(String(v), innerTypes[i]));
    } catch (e) {
      if (e instanceof Error && e.message.includes('Tuple')) {
        throw e;
      }
      throw new Error(`无效的 Tuple 格式: ${value}`);
    }
  }
  
  return value;
}

/**
 * 标准 ABI 编码
 */
export function abiEncode(types: string[], values: string[]): EncodeResult {
  try {
    if (types.length !== values.length) {
      return {
        success: false,
        error: `类型数量 (${types.length}) 与值数量 (${values.length}) 不匹配`,
      };
    }
    
    const parsedValues = types.map((type, i) => parseInputValue(values[i], type));
    const coder = AbiCoder.defaultAbiCoder();
    const encoded = coder.encode(types, parsedValues);
    
    return {
      success: true,
      data: encoded,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '编码失败',
    };
  }
}

/**
 * 标准 ABI 解码
 */
export function abiDecode(types: string[], hexData: string): DecodeResult {
  try {
    if (!hexData.startsWith('0x')) {
      hexData = '0x' + hexData;
    }
    
    const coder = AbiCoder.defaultAbiCoder();
    const decoded = coder.decode(types, hexData);

    // toDisplay handles bigint→string and walks Result/array shapes uniformly;
    // AbiEncoder has no named components so tuples remain arrays.
    const result = decoded.map((v) => toDisplay(v));
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '解码失败',
    };
  }
}

/**
 * SolidityPacked 编码 (紧凑编码)
 */
export function packedEncode(types: string[], values: string[]): EncodeResult {
  try {
    if (types.length !== values.length) {
      return {
        success: false,
        error: `类型数量 (${types.length}) 与值数量 (${values.length}) 不匹配`,
      };
    }
    
    const parsedValues = types.map((type, i) => parseInputValue(values[i], type));
    const encoded = solidityPacked(types, parsedValues);
    
    return {
      success: true,
      data: encoded,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '编码失败',
    };
  }
}

/**
 * SolidityPacked 解码 (仅支持固定长度类型)
 */
export function packedDecode(types: string[], hexData: string): DecodeResult {
  try {
    // 检查是否所有类型都是固定长度
    if (!areAllTypesFixedLength(types)) {
      const dynamicTypes = getDynamicTypes(types);
      return {
        success: false,
        error: `Packed 解码不支持动态长度类型: ${dynamicTypes.join(', ')}`,
      };
    }
    
    if (!hexData.startsWith('0x')) {
      hexData = '0x' + hexData;
    }
    
    const bytes = getBytes(hexData);
    const result: any[] = [];
    let offset = 0;
    
    for (const type of types) {
      const size = getTypeByteLength(type);
      if (offset + size > bytes.length) {
        return {
          success: false,
          error: `数据长度不足: 需要 ${offset + size} 字节，实际 ${bytes.length} 字节`,
        };
      }
      
      const slice = bytes.slice(offset, offset + size);
      const value = decodePackedValue(slice, type);
      result.push(value);
      offset += size;
    }
    
    // 检查是否有多余数据
    if (offset < bytes.length) {
      console.warn(`警告: 还有 ${bytes.length - offset} 字节未解析`);
    }
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '解码失败',
    };
  }
}

/**
 * 解码单个 packed 值
 */
function decodePackedValue(bytes: Uint8Array, type: string): any {
  type = type.trim();
  
  // bool
  if (type === 'bool') {
    return bytes[0] !== 0;
  }
  
  // address
  if (type === 'address') {
    return hexlify(bytes);
  }
  
  // uintN
  const uintMatch = type.match(/^uint(\d*)$/);
  if (uintMatch) {
    // 转换为 BigInt
    let value = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
      value = (value << BigInt(8)) | BigInt(bytes[i]);
    }
    return value.toString();
  }
  
  // intN (有符号整数)
  const intMatch = type.match(/^int(\d*)$/);
  if (intMatch) {
    const bits = intMatch[1] ? parseInt(intMatch[1], 10) : 256;
    let value = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
      value = (value << BigInt(8)) | BigInt(bytes[i]);
    }
    // 检查符号位
    const maxPositive = BigInt(1) << BigInt(bits - 1);
    if (value >= maxPositive) {
      value = value - (BigInt(1) << BigInt(bits));
    }
    return value.toString();
  }
  
  // bytesN
  const bytesNMatch = type.match(/^bytes(\d+)$/);
  if (bytesNMatch) {
    return hexlify(bytes);
  }
  
  // 固定长度数组
  const fixedArrayMatch = type.match(/^(.+)\[(\d+)\]$/);
  if (fixedArrayMatch) {
    const elementType = fixedArrayMatch[1];
    const length = parseInt(fixedArrayMatch[2], 10);
    const elementSize = getTypeByteLength(elementType);
    
    const result: any[] = [];
    for (let i = 0; i < length; i++) {
      const slice = bytes.slice(i * elementSize, (i + 1) * elementSize);
      result.push(decodePackedValue(slice, elementType));
    }
    return result;
  }
  
  // Tuple
  if (type.startsWith('(') && type.endsWith(')')) {
    const innerTypes = parseTupleTypes(type);
    const result: any[] = [];
    let offset = 0;
    
    for (const innerType of innerTypes) {
      const size = getTypeByteLength(innerType);
      const slice = bytes.slice(offset, offset + size);
      result.push(decodePackedValue(slice, innerType));
      offset += size;
    }
    return result;
  }
  
  // 默认返回 hex
  return hexlify(bytes);
}

/**
 * 判断 Solidity 类型是否是数值类型 (uint*, int*)
 */
function isNumericType(type: string): boolean {
  return /^u?int(\d*)$/.test(type.trim());
}

/**
 * 判断 Solidity 类型是否应该以 hex 格式输出 (address, bytes, bytesN)
 */
function isHexType(type: string): boolean {
  const t = type.trim();
  if (t === 'address') return true;
  if (t === 'bytes') return true;
  if (/^bytes(\d+)$/.test(t)) return true;
  return false;
}

/**
 * 格式化数值输出（支持 hex 或十进制，根据类型智能输出）
 */
export function formatOutput(value: any, asHex: boolean = false, type?: string): string {
  if (typeof value === 'string') {
    // 如果已经是 hex 格式
    if (value.startsWith('0x')) {
      if (asHex) {
        return value;
      }
      // 非 hex 输出模式：根据类型决定
      // address 和 bytes 类型始终以 hex 输出
      if (type && isHexType(type)) {
        return value;
      }
      // 数值类型转换为十进制
      if (!type || isNumericType(type)) {
        try {
          return BigInt(value).toString();
        } catch {
          return value;
        }
      }
      // 未知类型保留原样
      return value;
    }
    // 如果是数字字符串且需要 hex 输出
    if (asHex && /^-?\d+$/.test(value)) {
      // address 和 bytes 类型的值通常不会是纯数字字符串，但以防万一
      try {
        const bn = BigInt(value);
        return toBeHex(bn);
      } catch {
        return value;
      }
    }
    return value;
  }
  
  if (typeof value === 'bigint') {
    return asHex ? toBeHex(value) : value.toString();
  }
  
  if (typeof value === 'number') {
    return asHex ? toBeHex(BigInt(value)) : value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value.toString();
  }
  
  if (Array.isArray(value)) {
    // 根据类型递归格式化数组元素
    if (type) {
      if (type.startsWith('(') && type.endsWith(')')) {
        // Tuple 类型：每个元素有不同的类型
        const innerTypes = parseTupleTypes(type);
        return JSON.stringify(value.map((v, i) => formatOutput(v, asHex, innerTypes[i])));
      } else if (type.endsWith(']')) {
        // 数组类型：所有元素是同一类型
        const elementType = type.replace(/\[\d*\]$/, '');
        return JSON.stringify(value.map(v => formatOutput(v, asHex, elementType)));
      }
    }
    return JSON.stringify(value.map(v => formatOutput(v, asHex)));
  }
  
  return JSON.stringify(value);
}

/**
 * 获取常用的 Solidity 类型列表
 */
export function getCommonTypes(): string[] {
  return [
    'uint8', 'uint16', 'uint32', 'uint64', 'uint128', 'uint256',
    'int8', 'int16', 'int32', 'int64', 'int128', 'int256',
    'address',
    'bool',
    'bytes1', 'bytes4', 'bytes8', 'bytes16', 'bytes32',
    'bytes',
    'string',
  ];
}

/**
 * 验证类型是否有效
 */
export function isValidType(type: string): boolean {
  type = type.trim();
  
  // 基础类型
  if (['bool', 'address', 'string', 'bytes', 'uint', 'int'].includes(type)) {
    return true;
  }
  
  // uintN / intN
  if (type.match(/^u?int(\d+)$/)) {
    const bits = parseInt(type.match(/\d+/)![0], 10);
    return bits >= 8 && bits <= 256 && bits % 8 === 0;
  }
  
  // bytesN
  if (type.match(/^bytes(\d+)$/)) {
    const n = parseInt(type.match(/\d+/)![0], 10);
    return n >= 1 && n <= 32;
  }
  
  // 数组类型
  if (type.endsWith(']')) {
    const baseType = type.replace(/\[\d*\]$/, '');
    return isValidType(baseType);
  }
  
  // Tuple 类型
  if (type.startsWith('(') && type.endsWith(')')) {
    try {
      const innerTypes = parseTupleTypes(type);
      return innerTypes.length > 0 && innerTypes.every(t => isValidType(t));
    } catch {
      return false;
    }
  }
  
  return false;
}
