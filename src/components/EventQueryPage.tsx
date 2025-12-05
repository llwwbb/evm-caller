import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EventQueryParams, ParsedLog } from '../types';
import { queryEvents, extractEvents, validateBlockRange } from '../utils/eventQuery';
import { saveEventQueryResults, loadEventQueryResults } from '../utils/presetStorage';
import { JsonRpcProvider, Interface } from 'ethers';

interface EventQueryPageProps {
  rpcUrl: string;
  contractAddress: string;
  mergedAbi: string;
  selectedAbiNames: string[];
  selectedAbis: string[];
}

const EventQueryPage: React.FC<EventQueryPageProps> = ({ rpcUrl, contractAddress, mergedAbi, selectedAbiNames, selectedAbis }) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<Array<{ name: string; inputs: any[]; abiName?: string }>>([]);
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

  // 当 selectedAbis 变化时，重新提取事件
  useEffect(() => {
    if (selectedAbis.length > 0 && selectedAbiNames.length > 0) {
      loadEventsFromAbis(selectedAbis, selectedAbiNames);
    } else if (mergedAbi) {
      loadEventsFromAbi(mergedAbi);
    } else {
      setEvents([]);
      setSelectedEvent('');
    }
  }, [selectedAbis, selectedAbiNames, mergedAbi]);

  const loadEventsFromAbis = (abis: string[], abiNames: string[]) => {
    try {
      const allEvents: Array<{ name: string; inputs: any[]; abiName: string }> = [];
      
      abis.forEach((abi, index) => {
        const extractedEvents = extractEvents(abi);
        extractedEvents.forEach(event => {
          allEvents.push({
            ...event,
            abiName: abiNames[index] || `ABI ${index + 1}`
          });
        });
      });
      
      setEvents(allEvents);
      if (allEvents.length > 0) {
        setSelectedEvent(allEvents[0].name);
        updateIndexedParams(allEvents[0]);
      } else {
        setSelectedEvent('');
        setIndexedParams({});
      }
    } catch (err) {
      console.error(t('errors.extractEventsFailed'), err);
      setEvents([]);
    }
  };

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
      console.error(t('errors.extractEventsFailed'), err);
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
      setError(t('eventQuery.configureRpcFirst'));
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
      setError(err instanceof Error ? err.message : t('eventQuery.getLatestBlockFailed'));
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
        setError(t('eventQuery.alreadyLatest'));
        return;
      }
      
      setFromBlock(newFrom.toString());
      setToBlock(newTo.toString());
      setCurrentFromBlock(newFrom);
      setCurrentToBlock(newTo);
      
      await performQuery(newFrom.toString(), newTo.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('eventQuery.getLatestBlockFailed'));
    }
  };

  const handleQuery = async () => {
    if (!fromBlock.trim() || !toBlock.trim()) {
      setError(t('eventQuery.enterBlockRange'));
      return;
    }

    await performQuery(fromBlock, toBlock);
  };

  const performQuery = async (from: string, to: string) => {
    if (!rpcUrl.trim()) {
      setError(t('eventQuery.configureRpcFirst'));
      return;
    }

    if (!contractAddress.trim()) {
      setError(t('eventQuery.configureContractFirst'));
      return;
    }

    if (!mergedAbi) {
      setError(t('eventQuery.selectAbiFirst'));
      return;
    }

    if (!selectedEvent) {
      setError(t('eventQuery.selectEventFirst'));
      return;
    }

    // 验证区块范围
    const validation = validateBlockRange(from, to);
    if (!validation.valid) {
      setError(validation.error || t('eventQuery.blockRangeInvalid'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 过滤空的 indexed 参数
      const filteredIndexedParams: Record<string, any> = {};
      Object.entries(indexedParams).forEach(([key, value]) => {
        if (value.trim()) {
          filteredIndexedParams[key] = value.trim();
        }
      });

      // 找到选中事件对应的 ABI 名称
      const selectedEventObj = events.find(e => e.name === selectedEvent);
      const eventAbiName = selectedEventObj?.abiName || selectedAbiNames.join(', ');

      const params: EventQueryParams = {
        rpcUrl: rpcUrl.trim(),
        contractAddress: contractAddress.trim(),
        abi: mergedAbi,
        eventName: selectedEvent,
        fromBlock: isNaN(Number(from)) ? from : Number(from),
        toBlock: isNaN(Number(to)) ? to : Number(to),
        indexedParams: filteredIndexedParams,
        abiName: eventAbiName,
      };

      const result = await queryEvents(params);

      if (result.success && result.events) {
        // 追加新结果到历史记录（最新的在前面）
        setResults(prev => [...result.events!, ...prev]);
        // 记录当前查询的区块范围
        setCurrentFromBlock(isNaN(Number(from)) ? null : Number(from));
        setCurrentToBlock(isNaN(Number(to)) ? null : Number(to));
        
        // 保存结果
        const updatedResults = [...result.events!, ...results];
        saveEventQueryResults(updatedResults);
      } else {
        setError(result.error || t('errors.queryEventFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.queryEventFailed'));
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

  // 删除单个结果
  const handleDeleteResult = (index: number) => {
    const newResults = results.filter((_, i) => i !== index);
    setResults(newResults);
    saveEventQueryResults(newResults);
    
    // 同时从展开列表中移除
    const newExpanded = new Set(expandedResults);
    newExpanded.delete(index);
    // 调整其他展开项的索引
    const adjustedExpanded = new Set<number>();
    newExpanded.forEach(i => {
      if (i > index) {
        adjustedExpanded.add(i - 1);
      } else if (i < index) {
        adjustedExpanded.add(i);
      }
    });
    setExpandedResults(adjustedExpanded);
  };

  // 清空所有结果
  const handleClearAllResults = () => {
    if (window.confirm(t('eventQuery.confirmClearAll'))) {
      setResults([]);
      setExpandedResults(new Set());
      saveEventQueryResults([]);
    }
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
      const abi = JSON.parse(mergedAbi);
      const iface = new Interface(abi);
      const eventFragment = iface.getEvent(selectedEvent);
      return eventFragment?.topicHash || null;
    } catch (error) {
      console.error(t('errors.getEventTopicFailed'), error);
      return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* 左列：查询参数 + 查询控制 */}
      <div className="flex flex-col overflow-y-auto pr-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">{t('eventQuery.eventQuery')}</h2>

          <div className="space-y-4">
            {/* Event 选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('eventQuery.selectEvent')}
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => handleEventChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                disabled={events.length === 0}
              >
                {events.length === 0 ? (
                  <option value="">{t('eventQuery.noEvents')}</option>
                ) : (
                  events.map((event, index) => (
                    <option key={`${event.name}_${index}`} value={event.name}>
                      {event.name}{event.abiName ? ` (${event.abiName})` : ''}
                    </option>
                  ))
                )}
              </select>
              
              {/* 显示选中事件的 ABI 和 topic */}
              {selectedEvent && (
                <>
                  {events.find(e => e.name === selectedEvent)?.abiName && (
                    <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-md">
                      <span className="text-xs font-medium text-gray-600 block mb-1">{t('eventQuery.fromAbi')}</span>
                      <span className="text-xs text-purple-600 font-medium">
                        {events.find(e => e.name === selectedEvent)?.abiName}
                      </span>
                    </div>
                  )}
                  {getEventTopic() && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                      <span className="text-xs font-medium text-gray-600 block mb-1">Topic Hash:</span>
                      <span className="text-xs text-blue-600 font-mono break-all">
                        {getEventTopic()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 合约地址显示 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('eventQuery.contractAddress')}
              </label>
              <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200 font-mono text-xs text-gray-700">
                {contractAddress || t('eventQuery.notSet')}
              </div>
            </div>

            {/* 快速查询 */}
            <div>
              <button
                onClick={handleQuickQuery}
                disabled={isLoading || !rpcUrl}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {t('eventQuery.quickQuery')}
              </button>
            </div>

            {/* 区块范围 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('eventQuery.blockRange')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={fromBlock}
                  onChange={(e) => setFromBlock(e.target.value)}
                  placeholder={t('eventQuery.fromBlockPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <input
                  type="text"
                  value={toBlock}
                  onChange={(e) => setToBlock(e.target.value)}
                  placeholder={t('eventQuery.toBlockPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Indexed 参数过滤 */}
            {getIndexedInputs().length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('eventQuery.indexedParams')}
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
                        placeholder={t('eventQuery.filterPlaceholder')}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 分隔线 */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-base font-semibold text-gray-700 mb-3">{t('eventQuery.queryControl')}</h3>

              <button
                onClick={handleQuery}
                disabled={isLoading || !mergedAbi}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium mb-3"
              >
                {isLoading ? t('eventQuery.querying') : t('eventQuery.queryEvents')}
              </button>

              {/* 翻页按钮 */}
              {currentFromBlock !== null && currentToBlock !== null && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={handleQueryPrevious}
                    disabled={isLoading || currentFromBlock === 0}
                    className="bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {t('eventQuery.previous1000')}
                  </button>
                  <button
                    onClick={handleQueryNext}
                    disabled={isLoading}
                    className="bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {t('eventQuery.next1000')}
                  </button>
                </div>
              )}

              {!mergedAbi && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-3">
                  <p className="text-sm text-yellow-800">
                    {t('eventQuery.selectAbiHint')}
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-3">
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
                      <span className="text-sm font-medium text-green-800">{t('eventQuery.queryComplete')}</span>
                      <span className="text-2xl font-bold text-green-700">{results.length}</span>
                    </div>
                    <p className="text-xs text-green-700">{t('eventQuery.foundEvents', { count: results.length })}</p>
                  </div>
                </div>
              )}

              {!isLoading && results.length === 0 && fromBlock && toBlock && !error && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">{t('eventQuery.noEventsFound')}</p>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">{t('eventQuery.usageTips')}</h4>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  <li>{t('eventQuery.tip1')}</li>
                  <li>{t('eventQuery.tip2')}</li>
                  <li>{t('eventQuery.tip3')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右列：结果列表 */}
      <div className="flex flex-col overflow-y-auto pr-2">
        {results.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {t('eventQuery.queryResult')}
                <span className="ml-2 text-sm text-gray-500">({results.length})</span>
              </h3>
              <button
                onClick={handleClearAllResults}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors font-medium"
              >
                {t('eventQuery.clearAll')}
              </button>
            </div>

            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={`${result.transactionHash}-${result.logIndex}-${index}`}
                  className="border-2 border-green-200 rounded-lg overflow-hidden bg-green-50 relative group"
                >
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteResult(index);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors opacity-0 group-hover:opacity-100 z-10"
                    title={t('eventQuery.deleteItem')}
                  >
                    ×
                  </button>

                  <div
                    onClick={() => toggleResult(index)}
                    className="px-4 py-3 cursor-pointer hover:bg-green-100 transition-colors"
                  >
                    <div className="flex items-center justify-between pr-8">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-500">
                            Block #{result.blockNumber}
                          </span>
                          <span className="text-xs font-mono text-gray-500">
                            Log #{result.logIndex}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1 font-mono break-all">
                          Tx: {result.transactionHash}
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
                            <span className="text-xs font-medium text-gray-600">{t('eventQuery.eventNameLabel')}</span>
                            <span className="ml-2 text-sm font-semibold text-green-700">
                              {result.parsed.eventName}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">{t('eventQuery.signatureLabel')}</span>
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
                            <span className="text-xs font-medium text-gray-600">{t('eventQuery.contractAddressLabel')}</span>
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
                            <span className="text-xs font-medium text-gray-600 block mb-1">{t('eventQuery.parametersLabel')}</span>
                            <div className="bg-gray-50 p-2 rounded border border-gray-200">
                              <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(result.parsed.args, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-red-600">
                          {result.error || t('eventQuery.parseError')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800">{t('eventQuery.queryResult')}</h3>
            <p className="text-sm text-gray-500 text-center py-8">
              {t('eventQuery.noResults')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventQueryPage;
