import { keccak256, AbiCoder, toBeHex, zeroPadValue } from 'ethers';
import { StorageVariable, CalculatedSlot } from '../types';

/**
 * 存储槽计算工具
 * 实现 Solidity 存储布局规则
 */

/**
 * 获取类型的存储大小（字节）
 */
export function getTypeSize(type: string): number {
  // uint/int 类型
  const uintMatch = type.match(/^u?int(\d+)?$/);
  if (uintMatch) {
    const bits = uintMatch[1] ? parseInt(uintMatch[1]) : 256;
    return bits / 8;
  }

  // address
  if (type === 'address') return 20;

  // bool
  if (type === 'bool') return 1;

  // bytesN (固定长度)
  const bytesMatch = type.match(/^bytes(\d+)$/);
  if (bytesMatch) {
    return parseInt(bytesMatch[1]);
  }

  // bytes, string, 数组, mapping 都是动态类型，占用一个完整槽位
  if (type === 'bytes' || type === 'string' || type.includes('[]') || type.includes('mapping')) {
    return 32;
  }

  // 默认认为占用完整槽位
  return 32;
}

/**
 * 判断类型是否为动态类型
 */
export function isDynamicType(type: string): boolean {
  return type === 'string' || 
         type === 'bytes' || 
         type.endsWith('[]') || 
         type.includes('mapping');
}

/**
 * 计算简单类型的存储槽
 */
export function calculateSimpleSlot(variable: StorageVariable): CalculatedSlot {
  const slot = toBeHex(variable.slot, 32);
  return {
    variable,
    slot,
    path: variable.name,
  };
}

/**
 * 计算 mapping 的存储槽
 * slot = keccak256(h(key) . baseSlot)
 * 其中 h(key) 对于值类型是左填充到32字节，对于动态类型是 keccak256(key)
 */
export function calculateMappingSlot(
  variable: StorageVariable,
  keys: any[]
): CalculatedSlot {
  if (keys.length === 0) {
    throw new Error('Mapping 类型需要提供至少一个 key');
  }

  // 解析 mapping 类型，例如: mapping(address => uint256) 或 mapping(address => mapping(uint256 => bool))
  const mappingTypeMatch = variable.type.match(/^mapping\s*\(\s*(.+?)\s*=>\s*(.+?)\s*\)$/);
  if (!mappingTypeMatch) {
    throw new Error(`无效的 mapping 类型: ${variable.type}`);
  }

  let currentSlot = toBeHex(variable.slot, 32);
  let keyTypes: string[] = [];
  let path = variable.name;

  // 解析所有层级的 key 类型
  let remainingType = variable.type;
  while (remainingType.startsWith('mapping')) {
    const match = remainingType.match(/^mapping\s*\(\s*(.+?)\s*=>\s*(.+?)\s*\)$/);
    if (!match) break;
    keyTypes.push(match[1]);
    remainingType = match[2].trim();
  }

  if (keys.length > keyTypes.length) {
    throw new Error(`提供的 key 数量 (${keys.length}) 超过了 mapping 的嵌套层数 (${keyTypes.length})`);
  }

  // 逐层计算槽位
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const keyType = keyTypes[i];
    
    // 编码 key
    const encodedKey = encodeKey(key, keyType);
    
    // keccak256(h(key) . slot)
    const concatenated = encodedKey + currentSlot.slice(2); // 移除 0x
    currentSlot = keccak256('0x' + concatenated);
    
    path += `[${formatKeyForPath(key, keyType)}]`;
  }

  return {
    variable,
    slot: currentSlot,
    keys,
    path,
  };
}

/**
 * 计算动态数组的存储槽
 * 数组长度存储在 baseSlot
 * 数组元素存储在 keccak256(baseSlot) + index
 */
export function calculateArraySlot(
  variable: StorageVariable,
  index: number
): CalculatedSlot {
  const baseSlot = toBeHex(variable.slot, 32);
  const arrayStartSlot = keccak256(baseSlot);
  
  // 计算元素槽位
  const elementSlot = BigInt(arrayStartSlot) + BigInt(index);
  const slot = toBeHex(elementSlot, 32);
  
  return {
    variable,
    slot,
    keys: [index],
    path: `${variable.name}[${index}]`,
  };
}

/**
 * 计算固定长度数组的存储槽
 * 固定数组元素连续存储，从 baseSlot 开始
 */
export function calculateFixedArraySlot(
  variable: StorageVariable,
  index: number,
  arrayLength: number
): CalculatedSlot {
  if (index >= arrayLength) {
    throw new Error(`索引 ${index} 超出数组长度 ${arrayLength}`);
  }
  
  const elementSlot = variable.slot + index;
  const slot = toBeHex(elementSlot, 32);
  
  return {
    variable,
    slot,
    keys: [index],
    path: `${variable.name}[${index}]`,
  };
}

/**
 * 编码存储槽的值
 */
export function encodeSlotValue(value: any, type: string): string {
  const abiCoder = AbiCoder.defaultAbiCoder();
  
  try {
    // 对于简单类型，直接编码
    if (type.startsWith('uint') || type.startsWith('int')) {
      // 确保是 BigInt
      const bigIntValue = typeof value === 'bigint' ? value : BigInt(value);
      return zeroPadValue(toBeHex(bigIntValue), 32);
    }
    
    if (type === 'address') {
      return zeroPadValue(value, 32);
    }
    
    if (type === 'bool') {
      return zeroPadValue(value ? '0x01' : '0x00', 32);
    }
    
    if (type.startsWith('bytes')) {
      // bytesN - 固定长度
      const match = type.match(/^bytes(\d+)$/);
      if (match) {
        const length = parseInt(match[1]);
        // bytes 是右填充的
        let hex = value.startsWith('0x') ? value : '0x' + value;
        // 移除 0x
        hex = hex.slice(2);
        // 截断或填充到指定长度
        if (hex.length > length * 2) {
          hex = hex.slice(0, length * 2);
        }
        // 右填充0到32字节
        return '0x' + hex.padEnd(64, '0');
      }
    }
    
    // 使用 ABI 编码器处理其他类型
    const encoded = abiCoder.encode([type], [value]);
    return encoded;
  } catch (error) {
    console.error('编码值失败:', error);
    throw new Error(`无法编码类型 ${type} 的值: ${value}`);
  }
}

/**
 * 解码存储槽的值
 */
export function decodeSlotValue(hexValue: string, type: string): any {
  const abiCoder = AbiCoder.defaultAbiCoder();
  
  try {
    // 确保是 32 字节
    let paddedValue = hexValue.startsWith('0x') ? hexValue : '0x' + hexValue;
    if (paddedValue.length < 66) {
      paddedValue = zeroPadValue(paddedValue, 32);
    }
    
    const decoded = abiCoder.decode([type], paddedValue);
    return decoded[0];
  } catch (error) {
    console.error('解码值失败:', error);
    throw new Error(`无法解码类型 ${type} 的值: ${hexValue}`);
  }
}

/**
 * 编码 mapping key
 */
function encodeKey(key: any, keyType: string): string {
  const abiCoder = AbiCoder.defaultAbiCoder();
  
  // 值类型：左填充到 32 字节
  if (keyType === 'address') {
    return zeroPadValue(key, 32).slice(2); // 移除 0x
  }
  
  if (keyType.startsWith('uint') || keyType.startsWith('int')) {
    const bigIntValue = typeof key === 'bigint' ? key : BigInt(key);
    return zeroPadValue(toBeHex(bigIntValue), 32).slice(2);
  }
  
  if (keyType === 'bool') {
    return zeroPadValue(key ? '0x01' : '0x00', 32).slice(2);
  }
  
  if (keyType.startsWith('bytes')) {
    const match = keyType.match(/^bytes(\d+)$/);
    if (match) {
      // bytesN: 左填充
      return zeroPadValue(key, 32).slice(2);
    } else {
      // bytes (动态): 使用 keccak256
      return keccak256(key).slice(2);
    }
  }
  
  if (keyType === 'string') {
    // string: 使用 keccak256
    const encoded = abiCoder.encode(['string'], [key]);
    return keccak256(encoded).slice(2);
  }
  
  // 默认使用 ABI 编码
  try {
    const encoded = abiCoder.encode([keyType], [key]);
    return zeroPadValue(encoded, 32).slice(2);
  } catch (error) {
    throw new Error(`无法编码 key 类型 ${keyType}: ${key}`);
  }
}

/**
 * 格式化 key 用于路径显示
 */
function formatKeyForPath(key: any, keyType: string): string {
  if (keyType === 'address') {
    return key;
  }
  
  if (keyType === 'string') {
    return `"${key}"`;
  }
  
  if (keyType.startsWith('bytes')) {
    return key;
  }
  
  return String(key);
}

/**
 * 计算 packed storage 的槽位和偏移
 * Solidity 会尝试将多个小于 32 字节的变量打包到一个槽位
 */
export function calculatePackedSlot(
  variables: StorageVariable[],
  targetVariable: StorageVariable
): CalculatedSlot {
  // 找到目标变量的索引
  const targetIndex = variables.findIndex(v => v.name === targetVariable.name);
  if (targetIndex === -1) {
    throw new Error(`找不到变量: ${targetVariable.name}`);
  }
  
  let currentSlot = 0;
  let currentOffset = 0;
  
  for (let i = 0; i <= targetIndex; i++) {
    const variable = variables[i];
    const size = getTypeSize(variable.type);
    
    // 如果是动态类型或超过 32 字节，占用新槽位
    if (isDynamicType(variable.type) || size >= 32) {
      if (currentOffset > 0) {
        currentSlot++;
        currentOffset = 0;
      }
      
      if (i === targetIndex) {
        return {
          variable: targetVariable,
          slot: toBeHex(currentSlot, 32),
          path: targetVariable.name,
        };
      }
      
      currentSlot++;
      continue;
    }
    
    // 如果当前槽位放不下，移到下一个槽位
    if (currentOffset + size > 32) {
      currentSlot++;
      currentOffset = 0;
    }
    
    if (i === targetIndex) {
      return {
        variable: {
          ...targetVariable,
          offset: currentOffset,
          size,
        },
        slot: toBeHex(currentSlot, 32),
        path: targetVariable.name,
      };
    }
    
    currentOffset += size;
  }
  
  throw new Error('无法计算 packed storage 槽位');
}

/**
 * 编码 packed storage 的值
 * 需要读取整个槽位，修改特定偏移的部分，然后写回
 */
export function encodePackedValue(
  currentSlotValue: string,
  value: any,
  type: string,
  offset: number
): string {
  const size = getTypeSize(type);
  
  // 编码新值
  const encodedValue = encodeSlotValue(value, type);
  
  // 将当前槽位值转换为字节数组
  let slotBytes = currentSlotValue.startsWith('0x') ? currentSlotValue.slice(2) : currentSlotValue;
  if (slotBytes.length < 64) {
    slotBytes = slotBytes.padStart(64, '0');
  }
  
  // 将编码值转换为字节数组
  let valueBytes = encodedValue.startsWith('0x') ? encodedValue.slice(2) : encodedValue;
  // 取所需的字节数（从右边，因为是大端序）
  valueBytes = valueBytes.slice(-size * 2);
  
  // 计算位置（Solidity 存储是从右到左填充）
  // offset 是从左开始的字节偏移，需要转换为从右开始
  const rightOffset = 32 - offset - size;
  const startPos = rightOffset * 2;
  
  // 替换对应位置的字节
  const result = 
    slotBytes.slice(0, startPos) + 
    valueBytes + 
    slotBytes.slice(startPos + valueBytes.length);
  
  return '0x' + result;
}

/**
 * 预设的存储变量模板
 */
export const STORAGE_TEMPLATES = {
  ERC20: [
    { name: 'totalSupply', type: 'uint256', slot: 0 },
    { name: 'balances', type: 'mapping(address => uint256)', slot: 1 },
    { name: 'allowances', type: 'mapping(address => mapping(address => uint256))', slot: 2 },
  ],
  ERC721: [
    { name: 'name', type: 'string', slot: 0 },
    { name: 'symbol', type: 'string', slot: 1 },
    { name: 'owners', type: 'mapping(uint256 => address)', slot: 2 },
    { name: 'balances', type: 'mapping(address => uint256)', slot: 3 },
    { name: 'tokenApprovals', type: 'mapping(uint256 => address)', slot: 4 },
    { name: 'operatorApprovals', type: 'mapping(address => mapping(address => bool))', slot: 5 },
  ],
  'Uniswap V2 Pair': [
    { name: 'reserve0', type: 'uint112', slot: 8 },
    { name: 'reserve1', type: 'uint112', slot: 8 },
    { name: 'blockTimestampLast', type: 'uint32', slot: 8 },
  ],
};



