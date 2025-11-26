import React, { useState, useEffect } from 'react';
import { EventQueryParams, ParsedLog } from '../types';
import { queryEvents, extractEvents, validateBlockRange } from '../utils/eventQuery';
import { saveEventQueryResults, loadEventQueryResults } from '../utils/presetStorage';
import { JsonRpcProvider } from 'ethers';

interface EventQueryPageProps {
  rpcUrl: string;
  contractAddress: string;
  mergedAbi: string;
}

const EventQueryPage: React.FC<EventQueryPageProps> = ({ rpcUrl, contractAddress, mergedAbi }) => {
  const [events, setEvents] = useState<Array<{ name: string; inputs: any[] }>>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [fromBlock, setFromBlock] = useState('');
  const [toBlock, setToBlock] = useState('');
  const [currentFromBlock, setCurrentFromBlock] = useState<number | null>(null); // 当前查询的起始块
  const [currentToBlock, setCurrentToBlock] = useState<number | null>(null); // 当前查询的结束块
  const [indexedParams, setIndexedParams] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ParsedLog[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  // 加载保存的结果
  useEffect(() => {
    const saved = loadEventQueryResults();
    if (saved && saved.length > 0) {
      setResults(saved);
    }
  }, []);

  // 当 mergedAbi 变化时，重新提取事件
  useEffect(() => {
    if (mergedAbi) {
      loadEventsFromAbi(mergedAbi);
    } else {
      setEvents([]);
      setSelectedEvent('');
    }
  }, [mergedAbi]);

  const loadEventsFromAbi = (abi: string) => {
    try {
      const extractedEvents = extractEvents(abi);
      setEvents(extractedEvents);
      if (extractedEvents.length > 0) {
        setSelectedEvent(extractedEvents[0].name);
        updateIndexedParams(extractedEvents[0]);
      } else {
        setSelectedEvent('');
        setIndexedParams({});
      }
    } catch (err) {
      console.error('提取事件失败:', err);
      setEvents([]);
    }
  };

  const handleEventChange = (eventName: string) => {
    setSelectedEvent(eventName);
    const event = events.find((e) => e.name === eventName);
    if (event) {
      updateIndexedParams(event);
    }
  };

  const updateIndexedParams = (event: { name: string; inputs: any[] }) => {
    const params: Record<string, string> = {};
    event.inputs.forEach((input) => {
      if (input.indexed) {
        params[input.name] = '';
      }
    });
    setIndexedParams(params);
  };

  const handleIndexedParamChange = (name: string, value: string) => {
    setIndexedParams((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 快速查询最近 1000 个区块
  const handleQuickQuery = async () => {
    if (!rpcUrl.trim()) {
      setError('请先配置 RPC URL');
      return;
    }

    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const latestBlock = await provider.getBlockNumber();
      const from = Math.max(0, latestBlock - 1000);
      
      setFromBlock(from.toString());
      setToBlock(latestBlock.toString());
      setCurrentFromBlock(from);
      setCurrentToBlock(latestBlock);
      
      // 自动触发查询
      await performQuery(from.toString(), latestBlock.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取最新区块失败');
    }
  };

  // 向后查询（更早的区块）
  const handleQueryPrevious = async () => {
    if (currentFromBlock === null) return;
    
    const newTo = currentFromBlock - 1;
    const newFrom = Math.max(0, newTo - 999);
    
    setFromBlock(newFrom.toString());
    setToBlock(newTo.toString());
    setCurrentFromBlock(newFrom);
    setCurrentToBlock(newTo);
    
    await performQuery(newFrom.toString(), newTo.toString());
  };

  // 向前查询（更新的区块）
  const handleQueryNext = async () => {
    if (currentToBlock === null || !rpcUrl.trim()) return;
    
    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const latestBlock = await provider.getBlockNumber();
      
      const newFrom = currentToBlock + 1;
      const newTo = Math.min(latestBlock, newFrom + 999);
      
      if (newFrom > latestBlock) {
        setError('已经是最新区块');
        return;
      }
      
      setFromBlock(newFrom.toString());
      setToBlock(newTo.toString());
      setCurrentFromBlock(newFrom);
      setCurrentToBlock(newTo);
      
      await performQuery(newFrom.toString(), newTo.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取最新区块失败');
    }
  };

  const handleQuery = async () => {
    if (!fromBlock.trim() || !toBlock.trim()) {
      setError('请输入区块范围或使用快速查询');
      return;
    }

    await performQuery(fromBlock, toBlock);
  };

  const performQuery = async (from: string, to: string) => {
    if (!rpcUrl.trim()) {
      setError('请先配置 RPC URL');
      return;
    }

    if (!contractAddress.trim()) {
      setError('请先配置合约地址');
      return;
    }

    if (!mergedAbi) {
      setError('请在左侧选择至少一个 ABI');
      return;
    }

    if (!selectedEvent) {
      setError('请选择事件');
      return;
    }

    // 验证区块范围
    const validation = validateBlockRange(from, to);
    if (!validation.valid) {
      setError(validation.error || '区块范围无效');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      // 过滤空的 indexed 参数
      const filteredIndexedParams: Record<string, any> = {};
      Object.entries(indexedParams).forEach(([key, value]) => {
        if (value.trim()) {
          filteredIndexedParams[key] = value.trim();
        }
      });

      const params: EventQueryParams = {
        rpcUrl: rpcUrl.trim(),
        contractAddress: contractAddress.trim(),
        abi: mergedAbi,
        eventName: selectedEvent,
        fromBlock: isNaN(Number(from)) ? from : Number(from),
        toBlock: isNaN(Number(to)) ? to : Number(to),
        indexedParams: filteredIndexedParams,
      };

      const result = await queryEvents(params);

      if (result.success && result.events) {
        setResults(result.events);
        // 记录当前查询的区块范围
        setCurrentFromBlock(isNaN(Number(from)) ? null : Number(from));
        setCurrentToBlock(isNaN(Number(to)) ? null : Number(to));
        
        // 保存结果
        saveEventQueryResults(result.events);
      } else {
        setError(result.error || '查询失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleResult = (index: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedResults(newExpanded);
  };

  const shortenHash = (hash: string) => {
    if (hash.length < 10) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  // 获取当前选中事件的 indexed 参数
  const getIndexedInputs = () => {
    const event = events.find((e) => e.name === selectedEvent);
    if (!event) return [];
    return event.inputs.filter((input) => input.indexed);
  };

  // 获取当前选中事件的 topic hash
  const getEventTopic = () => {
    if (!mergedAbi || !selectedEvent) return null;
    
    try {
      const { Interface } = require('ethers');
      const abi = JSON.parse(mergedAbi);
      const iface = new Interface(abi);
      const eventFragment = iface.getEvent(selectedEvent);
      return eventFragment?.topicHash || null;
    } catch (error) {
      console.error('获取 event topic 失败:', error);
      return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* 左列：查询参数 */}
      <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Event 查询</h2>

          <div className="space-y-4">
            {/* Event 选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择 Event
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => handleEventChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                disabled={events.length === 0}
              >
                {events.length === 0 ? (
                  <option value="">ABI 中无 Event</option>
                ) : (
                  events.map((event) => (
                    <option key={event.name} value={event.name}>
                      {event.name}
                    </option>
                  ))
                )}
              </select>
              
              {/* 显示选中事件的 topic */}
              {selectedEvent && getEventTopic() && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="text-xs font-medium text-gray-600 block mb-1">Topic Hash:</span>
                  <span className="text-xs text-blue-600 font-mono break-all">
                    {getEventTopic()}
                  </span>
                </div>
              )}
            </div>

            {/* 合约地址显示 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                合约地址
              </label>
              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 font-mono text-xs text-gray-700">
                {contractAddress || '未设置'}
              </div>
            </div>

            {/* 快速查询 */}
            <div>
              <button
                onClick={handleQuickQuery}
                disabled={isLoading || !rpcUrl}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                快速查询最近 1000 个区块
              </button>
            </div>

            {/* 区块范围 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                区块范围
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={fromBlock}
                  onChange={(e) => setFromBlock(e.target.value)}
                  placeholder="起始区块"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <input
                  type="text"
                  value={toBlock}
                  onChange={(e) => setToBlock(e.target.value)}
                  placeholder="结束区块"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Indexed 参数过滤 */}
            {getIndexedInputs().length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Indexed 参数过滤（可选）
                </label>
                <div className="space-y-2">
                  {getIndexedInputs().map((input) => (
                    <div key={input.name}>
                      <label className="block text-xs text-gray-600 mb-1">
                        {input.name} ({input.type})
                      </label>
                      <input
                        type="text"
                        value={indexedParams[input.name] || ''}
                        onChange={(e) => handleIndexedParamChange(input.name, e.target.value)}
                        placeholder={`留空表示不过滤`}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 中列：查询控制 */}
      <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4 text-gray-800">查询控制</h3>

          <button
            onClick={handleQuery}
            disabled={isLoading || !mergedAbi}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium mb-4"
          >
            {isLoading ? '查询中...' : '查询 Events'}
          </button>

          {/* 翻页按钮 */}
          {currentFromBlock !== null && currentToBlock !== null && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={handleQueryPrevious}
                disabled={isLoading || currentFromBlock === 0}
                className="bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                ← 前 1000 块
              </button>
              <button
                onClick={handleQueryNext}
                disabled={isLoading}
                className="bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
              >
                后 1000 块 →
              </button>
            </div>
          )}

          {!mergedAbi && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
              <p className="text-sm text-yellow-800">
                👈 请在左侧选择至少一个 ABI
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-800">查询完成</span>
                  <span className="text-2xl font-bold text-green-700">{results.length}</span>
                </div>
                <p className="text-xs text-green-700">找到 {results.length} 个事件</p>
              </div>
            </div>
          )}

          {!isLoading && results.length === 0 && fromBlock && toBlock && !error && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">在指定区块范围内未找到事件</p>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">使用提示</h4>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>区块范围建议不超过 10000 个区块</li>
              <li>Indexed 参数可以用于精确过滤</li>
              <li>留空 indexed 参数表示不过滤该参数</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 右列：结果列表 */}
      <div className="flex flex-col overflow-y-auto pr-2">
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800">
              查询结果
              <span className="ml-2 text-sm text-gray-500">({results.length})</span>
            </h3>

            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="border-2 border-green-200 rounded-lg overflow-hidden bg-green-50"
                >
                  <div
                    onClick={() => toggleResult(index)}
                    className="px-4 py-3 cursor-pointer hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-500">
                            Block #{result.blockNumber}
                          </span>
                          <span className="text-xs font-mono text-gray-500">
                            Log #{result.logIndex}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1 font-mono">
                          Tx: {shortenHash(result.transactionHash)}
                        </div>
                      </div>
                      
                      <svg
                        className={`w-5 h-5 text-gray-500 transform transition-transform ${
                          expandedResults.has(index) ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {expandedResults.has(index) && (
                    <div className="px-4 pb-4 space-y-3 bg-white">
                      {result.parsed ? (
                        <>
                          <div>
                            <span className="text-xs font-medium text-gray-600">事件名称：</span>
                            <span className="ml-2 text-sm font-semibold text-green-700">
                              {result.parsed.eventName}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">签名：</span>
                            <span className="ml-2 text-xs text-gray-600 font-mono">
                              {result.parsed.signature}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Topic：</span>
                            <span className="ml-2 text-xs text-blue-600 font-mono break-all">
                              {result.parsed.topic}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">合约地址：</span>
                            <span className="ml-2 text-xs font-mono text-gray-700 break-all">
                              {result.address}
                            </span>
                          </div>
                          {result.parsed?.abiName && (
                            <div>
                              <span className="text-xs font-medium text-gray-600">ABI：</span>
                              <span className="ml-2 text-xs text-purple-600 font-medium">
                                {result.parsed.abiName}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-xs font-medium text-gray-600 block mb-1">参数：</span>
                            <div className="bg-gray-50 p-2 rounded border border-gray-200">
                              <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(result.parsed.args, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-red-600">
                          {result.error || '解析失败'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventQueryPage;

