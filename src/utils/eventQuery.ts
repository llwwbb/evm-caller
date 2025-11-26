import { JsonRpcProvider, Interface, Log, EventFragment } from 'ethers';
import { EventQueryParams, EventQueryResult, ParsedLog, ParsedEvent } from '../types';

/**
 * 查询指定区块范围内的事件
 */
export async function queryEvents(params: EventQueryParams): Promise<EventQueryResult> {
  try {
    const {
      rpcUrl,
      contractAddress,
      abi,
      eventName,
      fromBlock,
      toBlock,
      indexedParams,
    } = params;

    // 创建 provider 和 interface
    const provider = new JsonRpcProvider(rpcUrl);
    const abiParsed = typeof abi === 'string' ? JSON.parse(abi) : abi;
    const iface = new Interface(abiParsed);

    // 获取事件定义
    const eventFragment = iface.getEvent(eventName);
    if (!eventFragment) {
      return {
        success: false,
        error: `事件 "${eventName}" 在 ABI 中不存在`,
      };
    }

    // 构建过滤器
    const filter = buildEventFilter(
      iface,
      eventFragment,
      contractAddress,
      indexedParams
    );

    // 查询 logs
    const logs = await provider.getLogs({
      address: contractAddress,
      fromBlock,
      toBlock,
      topics: filter.topics,
    });

    // 解析 logs
    const parsedLogs = parseEventLogs(logs as Log[], iface, eventName);

    return {
      success: true,
      events: parsedLogs,
      count: parsedLogs.length,
    };
  } catch (error) {
    console.error('查询事件失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '查询失败',
    };
  }
}

/**
 * 构建事件过滤器
 */
export function buildEventFilter(
  iface: Interface,
  eventFragment: EventFragment,
  contractAddress: string,
  indexedParams?: Record<string, any>
): { address: string; topics: (string | string[] | null)[] } {
  // Topic 0 是事件签名
  const topics: (string | string[] | null)[] = [
    eventFragment.topicHash,
  ];

  // 如果有 indexed 参数，添加到 topics
  if (indexedParams && Object.keys(indexedParams).length > 0) {
    eventFragment.inputs.forEach((input, index) => {
      if (input.indexed) {
        const paramName = input.name;
        if (indexedParams[paramName] !== undefined && indexedParams[paramName] !== '') {
          // 编码参数值
          try {
            const encodedValue = iface.encodeFilterTopics(
              eventFragment,
              [indexedParams[paramName]]
            )[index + 1]; // +1 因为 topic0 是事件签名
            
            topics.push(encodedValue as string);
          } catch (error) {
            console.error(`编码参数 ${paramName} 失败:`, error);
            topics.push(null);
          }
        } else {
          topics.push(null);
        }
      }
    });
  }

  return {
    address: contractAddress,
    topics,
  };
}

/**
 * 解析事件日志
 */
export function parseEventLogs(
  logs: Log[],
  iface: Interface,
  eventName: string
): ParsedLog[] {
  return logs.map((log) => {
    const parsedLog: ParsedLog = {
      logIndex: log.index,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      address: log.address,
      data: log.data,
      topics: log.topics.slice(),
    };

    try {
      const parsed = iface.parseLog({
        topics: log.topics.slice(),
        data: log.data,
      });

      if (parsed && parsed.name === eventName) {
        // 格式化参数
        const args: any = {};
        parsed.fragment.inputs.forEach((input, i) => {
          const value = parsed.args[i];
          args[input.name || `arg${i}`] = formatValue(value);
        });

        parsedLog.parsed = {
          eventName: parsed.name,
          args,
          signature: parsed.signature,
          topic: parsed.topic, // Event topic hash (topic[0])
          abiName: 'Query ABI', // Event 查询使用单个 ABI
        };
      } else {
        parsedLog.error = '事件名称不匹配';
      }
    } catch (error) {
      parsedLog.error = error instanceof Error ? error.message : '解析失败';
    }

    return parsedLog;
  });
}

/**
 * 从 ABI 中提取所有事件定义
 */
export function extractEvents(abi: string): ParsedEvent[] {
  try {
    const abiParsed = typeof abi === 'string' ? JSON.parse(abi) : abi;
    const iface = new Interface(abiParsed);
    
    const events: ParsedEvent[] = [];
    iface.forEachEvent((eventFragment) => {
      events.push({
        name: eventFragment.name,
        inputs: eventFragment.inputs.map((input) => ({
          name: input.name,
          type: input.type,
          indexed: input.indexed,
          internalType: input.baseType,
        })),
        anonymous: eventFragment.anonymous,
      });
    });
    
    return events;
  } catch (error) {
    console.error('提取事件定义失败:', error);
    return [];
  }
}

/**
 * 获取事件的 indexed 参数列表
 */
export function getIndexedParams(eventFragment: EventFragment): Array<{
  name: string;
  type: string;
  index: number;
}> {
  return eventFragment.inputs
    .map((input, index) => ({
      name: input.name,
      type: input.type,
      indexed: input.indexed,
      index,
    }))
    .filter((input) => input.indexed)
    .map(({ name, type, index }) => ({ name, type, index }));
}

/**
 * 验证区块范围
 */
export function validateBlockRange(
  fromBlock: string | number,
  toBlock: string | number
): { valid: boolean; error?: string } {
  // 如果是字符串，检查是否是有效的标签
  const validTags = ['latest', 'earliest', 'pending', 'finalized', 'safe'];
  
  if (typeof fromBlock === 'string' && !validTags.includes(fromBlock)) {
    if (!/^\d+$/.test(fromBlock)) {
      return {
        valid: false,
        error: '起始区块必须是数字或有效标签（latest、earliest 等）',
      };
    }
  }
  
  if (typeof toBlock === 'string' && !validTags.includes(toBlock)) {
    if (!/^\d+$/.test(toBlock)) {
      return {
        valid: false,
        error: '结束区块必须是数字或有效标签（latest、earliest 等）',
      };
    }
  }
  
  // 如果都是数字，检查范围
  const fromNum = typeof fromBlock === 'number' ? fromBlock : parseInt(fromBlock);
  const toNum = typeof toBlock === 'number' ? toBlock : parseInt(toBlock);
  
  if (!isNaN(fromNum) && !isNaN(toNum)) {
    if (fromNum > toNum) {
      return {
        valid: false,
        error: '起始区块不能大于结束区块',
      };
    }
    
    // 检查范围是否过大（避免 RPC 超时）
    const range = toNum - fromNum;
    if (range > 10000) {
      return {
        valid: false,
        error: '区块范围过大（最多 10000 个区块），可能导致查询超时',
      };
    }
  }
  
  return { valid: true };
}

/**
 * 格式化值（处理 BigInt 等特殊类型）
 */
function formatValue(value: any): any {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  
  if (Array.isArray(value)) {
    return value.map(v => formatValue(v));
  }
  
  if (value && typeof value === 'object') {
    // 检查是否是 ethers 的 Result 对象
    if (value.toArray && typeof value.toArray === 'function') {
      const arr = value.toArray();
      
      // 尝试提取命名字段
      const formatted: any = {};
      let hasNamedFields = false;
      
      for (const key in value) {
        if (!isNaN(Number(key))) continue;
        hasNamedFields = true;
        formatted[key] = formatValue(value[key]);
      }
      
      if (hasNamedFields) {
        return formatted;
      }
      
      return arr.map((item: any) => formatValue(item));
    }
    
    // 普通对象
    const formatted: any = {};
    for (const key in value) {
      if (!isNaN(Number(key))) continue;
      formatted[key] = formatValue(value[key]);
    }
    return formatted;
  }
  
  return value;
}

