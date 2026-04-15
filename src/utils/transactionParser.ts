import { JsonRpcProvider, TransactionResponse, TransactionReceipt, Interface, Log, EventFragment } from 'ethers';
import { ParsedTransaction, ParsedLog } from '../types';
import { toDisplay } from './decodedFormat';

/**
 * 通过 RPC 获取交易数据
 */
export async function fetchTransaction(
  rpcUrl: string,
  txHash: string
): Promise<TransactionResponse> {
  const provider = new JsonRpcProvider(rpcUrl);
  const tx = await provider.getTransaction(txHash);
  
  if (!tx) {
    throw new Error(`Transaction ${txHash} does not exist`);
  }
  
  return tx;
}

/**
 * 获取交易回执（包含 logs）
 */
export async function fetchTransactionReceipt(
  rpcUrl: string,
  txHash: string
): Promise<TransactionReceipt> {
  const provider = new JsonRpcProvider(rpcUrl);
  const receipt = await provider.getTransactionReceipt(txHash);
  
  if (!receipt) {
    throw new Error(`Transaction receipt ${txHash} does not exist`);
  }
  
  return receipt;
}

/**
 * 使用多个 ABI 解析交易日志
 * 循环尝试每个 ABI，第一个成功解析的即为结果
 */
export function parseTransactionLogs(
  logs: Log[],
  abis: string[],
  abiNames?: string[] // ABI 名称列表，用于显示
): ParsedLog[] {
  return logs.map((log) => {
    const parsedLog: ParsedLog = {
      logIndex: log.index,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      address: log.address,
      data: log.data,
      topics: log.topics.slice(), // 复制数组
    };

    const logTopic0 = log.topics[0]; // 日志的第一个 topic（event signature hash）
    const matchingErrors: { abiName: string; eventName: string; error: string }[] = [];

    // 尝试使用每个 ABI 解析
    for (let i = 0; i < abis.length; i++) {
      const abiString = abis[i];
      const abiName = abiNames?.[i] || `ABI #${i + 1}`;

      try {
        const abi = typeof abiString === 'string' ? JSON.parse(abiString) : abiString;
        const iface = new Interface(abi);

        // 尝试解析 log
        const parsed = iface.parseLog({
          topics: log.topics.slice(),
          data: log.data,
        });

        if (parsed) {
          const args: any = {};
          parsed.fragment.inputs.forEach((input, i) => {
            args[input.name || `arg${i}`] = toDisplay(parsed.args[i], input as any);
          });

          parsedLog.parsed = {
            eventName: parsed.name,
            args,
            signature: parsed.signature,
            topic: parsed.topic, // Event topic hash (topic[0])
            abiName: abiName, // 使用哪个 ABI 解析的
          };

          // 成功解析，跳出循环
          break;
        }
      } catch (error) {
        // 检查是否有 event 的 topic 与日志的 topic[0] 匹配
        try {
          const abi = typeof abiString === 'string' ? JSON.parse(abiString) : abiString;
          const iface = new Interface(abi);
          
          // 遍历 ABI 中的所有 event，检查是否有 topic 匹配
          for (const fragment of iface.fragments) {
            if (EventFragment.isFragment(fragment)) {
              const eventTopic = fragment.topicHash;
              if (eventTopic && eventTopic === logTopic0) {
                // topic 匹配但解析失败，记录错误
                const errorMsg = error instanceof Error ? error.message : String(error);
                matchingErrors.push({
                  abiName,
                  eventName: fragment.name,
                  error: errorMsg,
                });
                break; // 这个 ABI 中已找到匹配的 event
              }
            }
          }
        } catch {
          // 忽略解析 ABI 时的错误
        }
        continue;
      }
    }

    // 如果所有 ABI 都无法解析
    if (!parsedLog.parsed) {
      if (matchingErrors.length > 0) {
        // 有 topic 匹配但解析失败的情况，显示具体错误
        const errorDetails = matchingErrors.map(e => 
          `[${e.abiName}] ${e.eventName}: ${e.error}`
        ).join('\n');
        parsedLog.error = `ABI matching event found but parsing failed:\n${errorDetails}`;
      } else {
        parsedLog.error = 'Cannot parse this log with provided ABIs';
      }
    }

    return parsedLog;
  });
}

/**
 * 解析交易 input data（函数调用）
 */
export function decodeInputData(
  inputData: string,
  abi: string
): { functionName: string; args: any; signature: string } | null {
  if (!inputData || inputData === '0x') {
    return null;
  }

  try {
    const abiParsed = typeof abi === 'string' ? JSON.parse(abi) : abi;
    const iface = new Interface(abiParsed);
    
    const parsed = iface.parseTransaction({ data: inputData });
    
    if (!parsed) {
      return null;
    }

    const args: any = {};
    parsed.fragment.inputs.forEach((input, i) => {
      args[input.name || `arg${i}`] = toDisplay(parsed.args[i], input as any);
    });

    return {
      functionName: parsed.name,
      args,
      signature: parsed.signature,
    };
  } catch (error) {
    console.error('Failed to parse input data:', error);
    return null;
  }
}

/**
 * 格式化交易基本信息
 */
export function formatTransactionInfo(
  tx: TransactionResponse,
  receipt?: TransactionReceipt
): Partial<ParsedTransaction> {
  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: tx.value.toString(),
    gasLimit: tx.gasLimit.toString(),
    gasPrice: tx.gasPrice?.toString(),
    maxFeePerGas: tx.maxFeePerGas?.toString(),
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
    nonce: tx.nonce,
    blockNumber: tx.blockNumber,
    blockHash: tx.blockHash,
    status: receipt?.status ?? undefined,
    inputData: tx.data,
  };
}

/**
 * 完整解析交易（包含基本信息、input data 和 logs）
 */
export async function parseFullTransaction(
  rpcUrl: string,
  txHash: string,
  abis: string[]
): Promise<ParsedTransaction> {
  // 获取交易和回执
  const [tx, receipt] = await Promise.all([
    fetchTransaction(rpcUrl, txHash),
    fetchTransactionReceipt(rpcUrl, txHash),
  ]);

  // 格式化基本信息
  const info = formatTransactionInfo(tx, receipt);

  // 解析 input data（尝试所有 ABI）
  let decodedInput = null;
  for (const abi of abis) {
    const decoded = decodeInputData(tx.data, abi);
    if (decoded) {
      decodedInput = decoded;
      break;
    }
  }

  // 解析 logs
  const parsedLogs = parseTransactionLogs(receipt.logs as Log[], abis);

  // 获取区块时间戳
  let timestamp: number | undefined;
  try {
    if (tx.blockNumber) {
      const provider = new JsonRpcProvider(rpcUrl);
      const block = await provider.getBlock(tx.blockNumber);
      timestamp = block?.timestamp;
    }
  } catch (error) {
    console.error('Failed to get block timestamp:', error);
  }

  return {
    ...info,
    timestamp: timestamp || undefined,
    decodedInput: decodedInput || undefined,
    logs: parsedLogs,
  } as ParsedTransaction;
}

