import React, { useState, useEffect } from 'react';
import { ParsedTransaction } from '../types';
import { fetchTransaction, fetchTransactionReceipt, formatTransactionInfo, parseTransactionLogs, decodeInputData } from '../utils/transactionParser';
import { saveTxParserResult, loadTxParserResult } from '../utils/presetStorage';
import { TransactionResponse, TransactionReceipt, Log } from 'ethers';

interface TransactionParserPageProps {
  rpcUrl: string;
  selectedAbis: string[];
  selectedAbiNames: string[];
  mergedAbi: string;
}

type ParseType = 'hex' | 'address' | 'number' | 'text';

// 将 hex data 按 32 bytes 分割
const splitInto32Bytes = (data: string): string[] => {
  const hex = data.startsWith('0x') ? data.slice(2) : data;
  if (!hex || hex === '') return [];
  const chunks: string[] = [];
  for (let i = 0; i < hex.length; i += 64) {
    chunks.push('0x' + hex.slice(i, i + 64).padEnd(64, '0'));
  }
  return chunks;
};

// 解析 32 bytes 数据为不同类型
const parse32Bytes = (chunk: string, type: ParseType): string => {
  const hex = chunk.startsWith('0x') ? chunk.slice(2) : chunk;
  
  switch (type) {
    case 'hex':
      return '0x' + hex;
    
    case 'address':
      // 取后 40 个字符 (20 bytes)
      return '0x' + hex.slice(-40);
    
    case 'number':
      try {
        const bn = BigInt('0x' + hex);
        return bn.toString();
      } catch {
        return 'Invalid number';
      }
    
    case 'text':
      try {
        // 尝试将 hex 解码为 UTF-8 文本
        const bytes = hex.match(/.{2}/g)?.map(b => parseInt(b, 16)) || [];
        // 过滤掉 0x00（padding）
        const filtered = bytes.filter(b => b !== 0);
        const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(filtered));
        // 检查是否有可打印字符
        if (/^[\x20-\x7E]*$/.test(text) && text.length > 0) {
          return text;
        }
        return '(non-printable)';
      } catch {
        return '(decode error)';
      }
    
    default:
      return chunk;
  }
};

const TransactionParserPage: React.FC<TransactionParserPageProps> = ({ rpcUrl, selectedAbis, selectedAbiNames }) => {
  const [txHash, setTxHash] = useState('');
  const [rawTx, setRawTx] = useState<TransactionResponse | null>(null);
  const [rawReceipt, setRawReceipt] = useState<TransactionReceipt | null>(null);
  const [parsedTx, setParsedTx] = useState<ParsedTransaction | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  // 存储每个 log 的每个数据块的解析类型: { logIndex: { chunkIndex: type } }
  const [dataParseTypes, setDataParseTypes] = useState<Record<number, Record<number, ParseType>>>({});
  // 存储每个 log 的每个 topic 的解析类型
  const [topicParseTypes, setTopicParseTypes] = useState<Record<number, Record<number, ParseType>>>({});

  // 加载保存的结果
  useEffect(() => {
    const saved = loadTxParserResult();
    if (saved) {
      setTxHash(saved.txHash || '');
      setParsedTx(saved.parsedTx || null);
    }
  }, []);

  // 当 ABI 变化时，重新解析现有交易
  useEffect(() => {
    const reParse = async () => {
      if (rawTx && rawReceipt && selectedAbis.length > 0) {
        try {
          // 格式化基本信息
          const info = formatTransactionInfo(rawTx, rawReceipt);

          // 解析 input data（尝试所有 ABI）
          let decodedInput = null;
          for (const abi of selectedAbis) {
            const decoded = decodeInputData(rawTx.data, abi);
            if (decoded) {
              decodedInput = decoded;
              break;
            }
          }

          // 解析 logs
          const parsedLogs = parseTransactionLogs(rawReceipt.logs as Log[], selectedAbis, selectedAbiNames);

          // 获取区块时间戳
          let timestamp: number | undefined;
          try {
            if (rawTx.blockNumber && rpcUrl) {
              const provider = new (await import('ethers')).JsonRpcProvider(rpcUrl);
              const block = await provider.getBlock(rawTx.blockNumber);
              timestamp = block?.timestamp;
            }
          } catch (error) {
            console.error('获取区块时间戳失败:', error);
          }

          const parsed: ParsedTransaction = {
            ...info,
            timestamp: timestamp || undefined,
            decodedInput: decodedInput || undefined,
            logs: parsedLogs,
          } as ParsedTransaction;

          setParsedTx(parsed);
          
          // 保存结果
          saveTxParserResult({
            txHash: rawTx.hash,
            parsedTx: parsed,
          });
        } catch (err) {
          console.error('重新解析失败:', err);
        }
      } else if (selectedAbis.length === 0) {
        // 如果没有选择 ABI，清空解析结果
        setParsedTx(null);
      }
    };

    reParse();
  }, [selectedAbis, rawTx, rawReceipt, rpcUrl]);

  const handleFetch = async () => {
    if (!txHash.trim()) {
      setError('请输入交易 Hash');
      return;
    }

    if (!rpcUrl.trim()) {
      setError('请先配置 RPC URL');
      return;
    }

    setIsFetching(true);
    setError(null);
    setParsedTx(null);

    try {
      const [tx, receipt] = await Promise.all([
        fetchTransaction(rpcUrl, txHash.trim()),
        fetchTransactionReceipt(rpcUrl, txHash.trim()),
      ]);
      
      setRawTx(tx);
      setRawReceipt(receipt);
      
      // 如果有选中的 ABI，立即解析
      if (selectedAbis.length > 0) {
        await parseTransactionWithData(tx, receipt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取交易失败');
      setRawTx(null);
      setRawReceipt(null);
    } finally {
      setIsFetching(false);
    }
  };

  const parseTransaction = async () => {
    if (!rawTx || !rawReceipt) return;
    await parseTransactionWithData(rawTx, rawReceipt);
  };

  const parseTransactionWithData = async (tx: TransactionResponse, receipt: TransactionReceipt) => {
    try {
      // 格式化基本信息
      const info = formatTransactionInfo(tx, receipt);

      // 解析 input data（尝试所有 ABI）
      let decodedInput = null;
      for (const abi of selectedAbis) {
        const decoded = decodeInputData(tx.data, abi);
        if (decoded) {
          decodedInput = decoded;
          break;
        }
      }

      // 解析 logs
      const parsedLogs = parseTransactionLogs(receipt.logs as Log[], selectedAbis, selectedAbiNames);

      // 获取区块时间戳
      let timestamp: number | undefined;
      try {
        if (tx.blockNumber && rpcUrl) {
          const provider = new (await import('ethers')).JsonRpcProvider(rpcUrl);
          const block = await provider.getBlock(tx.blockNumber);
          timestamp = block?.timestamp;
        }
      } catch (error) {
        console.error('获取区块时间戳失败:', error);
      }

      const parsed: ParsedTransaction = {
        ...info,
        timestamp: timestamp || undefined,
        decodedInput: decodedInput || undefined,
        logs: parsedLogs,
      } as ParsedTransaction;

      setParsedTx(parsed);
      
      // 保存结果
      saveTxParserResult({
        txHash: tx.hash,
        parsedTx: parsed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败');
    }
  };

  const toggleLog = (index: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '未知';
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  const shortenAddress = (address: string) => {
    if (address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* 左列：输入区 + 交易基本信息 */}
      <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">交易解析</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                交易 Hash
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <button
              onClick={handleFetch}
              disabled={isFetching}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {isFetching ? '获取中...' : '获取交易'}
            </button>

            {rawTx && selectedAbis.length === 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  👈 请在左侧选择至少一个 ABI 以解析交易
                </p>
              </div>
            )}

            {rawTx && selectedAbis.length > 0 && !parsedTx && (
              <button
                onClick={parseTransaction}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                解析交易
              </button>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {rawTx && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  ✅ 交易已获取
                  {selectedAbis.length > 0 && parsedTx && (
                    <span className="ml-2">· 已解析</span>
                  )}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  使用 {selectedAbis.length} 个 ABI
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 交易基本信息 */}
        {parsedTx && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800">交易信息</h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">状态：</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  parsedTx.status === 1 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {parsedTx.status === 1 ? '成功' : '失败'}
                </span>
              </div>

              <div>
                <span className="font-medium text-gray-600">区块号：</span>
                <span className="ml-2 text-gray-800 font-mono">{parsedTx.blockNumber}</span>
              </div>

              <div>
                <span className="font-medium text-gray-600">时间：</span>
                <span className="ml-2 text-gray-800">{formatTimestamp(parsedTx.timestamp)}</span>
              </div>

              <div>
                <span className="font-medium text-gray-600">From：</span>
                <span className="ml-2 text-gray-800 font-mono text-xs" title={parsedTx.from}>
                  {shortenAddress(parsedTx.from)}
                </span>
              </div>

              <div>
                <span className="font-medium text-gray-600">To：</span>
                <span className="ml-2 text-gray-800 font-mono text-xs" title={parsedTx.to || ''}>
                  {parsedTx.to ? shortenAddress(parsedTx.to) : '合约创建'}
                </span>
              </div>

              <div>
                <span className="font-medium text-gray-600">Value：</span>
                <span className="ml-2 text-gray-800 font-mono">
                  {(BigInt(parsedTx.value) / BigInt(10 ** 18)).toString()} ETH
                </span>
              </div>

              <div>
                <span className="font-medium text-gray-600">Gas Limit：</span>
                <span className="ml-2 text-gray-800 font-mono">{parsedTx.gasLimit}</span>
              </div>

              {parsedTx.gasPrice && (
                <div>
                  <span className="font-medium text-gray-600">Gas Price：</span>
                  <span className="ml-2 text-gray-800 font-mono">
                    {(BigInt(parsedTx.gasPrice) / BigInt(10 ** 9)).toString()} Gwei
                  </span>
                </div>
              )}

              <div>
                <span className="font-medium text-gray-600">Nonce：</span>
                <span className="ml-2 text-gray-800 font-mono">{parsedTx.nonce}</span>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <span className="font-medium text-gray-600 block mb-2">Input Data：</span>
                <div className="bg-gray-50 p-2 rounded font-mono text-xs break-all max-h-32 overflow-y-auto">
                  {parsedTx.inputData}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 右列：解析结果 */}
      <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
        {parsedTx && (
          <>
            {/* Input Data 解析 */}
            {parsedTx.decodedInput && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-bold mb-4 text-gray-800">函数调用</h3>
                
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-gray-600">函数：</span>
                    <span className="ml-2 text-blue-700 font-mono text-sm font-semibold">
                      {parsedTx.decodedInput.functionName}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium text-gray-600">签名：</span>
                    <span className="ml-2 text-gray-600 font-mono text-xs">
                      {parsedTx.decodedInput.signature}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium text-gray-600 block mb-2">参数：</span>
                    <div className="bg-gray-50 p-3 rounded">
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(parsedTx.decodedInput.args, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Logs 解析 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold mb-4 text-gray-800">
                事件日志
                <span className="ml-2 text-sm text-gray-500">
                  ({parsedTx.logs.length})
                </span>
              </h3>

              {parsedTx.logs.length === 0 ? (
                <p className="text-sm text-gray-500">此交易没有产生事件日志</p>
              ) : (
                <div className="space-y-3">
                  {parsedTx.logs.map((log, index) => (
                    <div
                      key={index}
                      className={`border-2 rounded-lg overflow-hidden ${
                        log.parsed 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div
                        onClick={() => toggleLog(index)}
                        className="px-4 py-3 cursor-pointer hover:bg-opacity-80 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-500">
                                Log #{log.logIndex}
                              </span>
                              {log.parsed ? (
                                <span className="text-sm font-semibold text-green-800">
                                  {log.parsed.eventName}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500">
                                  未解析
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 font-mono">
                              {log.address}
                            </div>
                          </div>
                          
                          <svg
                            className={`w-5 h-5 text-gray-500 transform transition-transform ${
                              expandedLogs.has(index) ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {expandedLogs.has(index) && (
                        <div className="px-4 pb-4 space-y-3">
                          {log.parsed ? (
                            <>
                              <div>
                                <span className="text-xs font-medium text-gray-600">签名：</span>
                                <span className="ml-2 text-xs text-gray-600 font-mono">
                                  {log.parsed.signature}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-600">Topic：</span>
                                <span className="ml-2 text-xs text-blue-600 font-mono break-all">
                                  {log.parsed.topic}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-600">ABI：</span>
                                <span className="ml-2 text-xs text-purple-600 font-medium">
                                  {log.parsed.abiName}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-gray-600 block mb-1">参数：</span>
                                <div className="bg-white p-2 rounded border border-gray-200">
                                  <pre className="text-xs overflow-x-auto">
                                    {JSON.stringify(log.parsed.args, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              {log.error && (
                                <div className="text-xs text-red-600 mb-2 whitespace-pre-wrap bg-red-50 p-2 rounded border border-red-200">
                                  {log.error}
                                </div>
                              )}
                              
                              {/* Topics 智能解析 */}
                              <div>
                                <span className="text-xs font-medium text-gray-600 block mb-1">
                                  Topics：
                                  <span className="text-gray-400 ml-1">(每个 32 bytes)</span>
                                </span>
                                <div className="bg-white p-2 rounded border border-gray-200 space-y-2">
                                  {log.topics.map((topic, i) => {
                                    const selectedType = topicParseTypes[index]?.[i] || 'hex';
                                    return (
                                      <div key={i} className="border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-xs text-gray-500">[{i}]</span>
                                          {i > 0 && ( // topic[0] 是 event signature，不需要解析
                                            <div className="flex gap-1">
                                              {(['hex', 'address', 'number', 'text'] as ParseType[]).map(type => (
                                                <button
                                                  key={type}
                                                  onClick={() => {
                                                    setTopicParseTypes(prev => ({
                                                      ...prev,
                                                      [index]: { ...prev[index], [i]: type }
                                                    }));
                                                  }}
                                                  className={`px-1.5 py-0.5 text-xs rounded ${
                                                    selectedType === type
                                                      ? 'bg-blue-500 text-white'
                                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                  }`}
                                                >
                                                  {type}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-xs font-mono break-all text-gray-700 pl-4">
                                          {i === 0 ? (
                                            <span className="text-purple-600">{topic}</span>
                                          ) : (
                                            <span className={selectedType === 'address' ? 'text-blue-600' : selectedType === 'number' ? 'text-green-600' : ''}>
                                              {parse32Bytes(topic, selectedType)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Data 智能解析 */}
                              <div>
                                <span className="text-xs font-medium text-gray-600 block mb-1">
                                  Data：
                                  <span className="text-gray-400 ml-1">
                                    ({splitInto32Bytes(log.data).length} × 32 bytes)
                                  </span>
                                </span>
                                {log.data && log.data !== '0x' ? (
                                  <div className="bg-white p-2 rounded border border-gray-200 space-y-2">
                                    {splitInto32Bytes(log.data).map((chunk, i) => {
                                      const selectedType = dataParseTypes[index]?.[i] || 'hex';
                                      return (
                                        <div key={i} className="border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs text-gray-500">[{i}]</span>
                                            <div className="flex gap-1">
                                              {(['hex', 'address', 'number', 'text'] as ParseType[]).map(type => (
                                                <button
                                                  key={type}
                                                  onClick={() => {
                                                    setDataParseTypes(prev => ({
                                                      ...prev,
                                                      [index]: { ...prev[index], [i]: type }
                                                    }));
                                                  }}
                                                  className={`px-1.5 py-0.5 text-xs rounded ${
                                                    selectedType === type
                                                      ? 'bg-blue-500 text-white'
                                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                  }`}
                                                >
                                                  {type}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          <div className="text-xs font-mono break-all pl-4">
                                            <span className={
                                              selectedType === 'address' ? 'text-blue-600' : 
                                              selectedType === 'number' ? 'text-green-600' : 
                                              selectedType === 'text' ? 'text-orange-600' :
                                              'text-gray-700'
                                            }>
                                              {parse32Bytes(chunk, selectedType)}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="bg-white p-2 rounded border border-gray-200 text-xs text-gray-400">
                                    (empty)
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TransactionParserPage;

