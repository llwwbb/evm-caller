import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ParsedCallTrace, CallTrace } from '../types';
import { 
  fetchDebugTrace, 
  parseTraceWithAbi, 
  formatAddress, 
  formatGas, 
  calculateGasPercentage, 
  getCallTypeIcon 
} from '../utils/debugTrace';

interface DebugTracePageProps {
  rpcUrl: string;
  selectedAbis: string[];
  selectedAbiNames: string[];
}

interface TraceCallNodeProps {
  trace: ParsedCallTrace;
  depth: number;
}

// 递归渲染调用节点
const TraceCallNode: React.FC<TraceCallNodeProps> = ({ trace, depth }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(depth === 0); // 默认展开第一层
  const [showRawInput, setShowRawInput] = useState(false);
  const [showRawOutput, setShowRawOutput] = useState(false);
  
  const hasValue = trace.value && BigInt(trace.value) > BigInt(0);
  const hasError = !!trace.error;
  const hasCalls = trace.calls && trace.calls.length > 0;
  const gasPercentage = calculateGasPercentage(trace.gasUsed, trace.gas);
  
  // 计算缩进
  const indentClass = depth > 0 ? `ml-${Math.min(depth * 4, 12)}` : '';
  
  return (
    <div className={`${indentClass} mb-3`}>
      <div
        className={`border-2 rounded-lg overflow-hidden ${
          hasError 
            ? 'border-red-300 bg-red-50' 
            : trace.decodedInput 
            ? 'border-green-300 bg-green-50' 
            : 'border-gray-300 bg-gray-50'
        }`}
      >
        {/* 节点头部 - 可点击展开/折叠 */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="px-4 py-3 cursor-pointer hover:bg-opacity-80 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                {/* 调用类型图标 */}
                <span className="text-2xl" title={trace.type}>
                  {getCallTypeIcon(trace.type)}
                </span>
                
                {/* From -> To */}
                <div className="flex items-center gap-2 font-mono text-sm">
                  <span className="text-gray-600" title={trace.from}>
                    {formatAddress(trace.from)}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-blue-700 font-semibold" title={trace.to || 'Contract Creation'}>
                    {trace.to ? formatAddress(trace.to) : t('debugTrace.contractCreation')}
                  </span>
                </div>
                
                {/* 函数名（如果已解析） */}
                {trace.decodedInput && (
                  <span className="text-purple-700 font-semibold text-sm">
                    {trace.decodedInput.functionName}()
                  </span>
                )}
                
                {/* Value 标识 */}
                {hasValue && (
                  <span className="text-amber-600 text-sm flex items-center gap-1">
                    💰 {(BigInt(trace.value!) / BigInt(10 ** 18)).toString()} ETH
                  </span>
                )}
                
                {/* Error 标识 */}
                {hasError && (
                  <span className="text-red-600 text-sm font-semibold">
                    ⚠️ {t('debugTrace.reverted')}
                  </span>
                )}
              </div>
              
              {/* Gas 使用情况 */}
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 max-w-xs">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>{t('debugTrace.gasUsage')}</span>
                    <span>
                      {formatGas(trace.gasUsed)} / {formatGas(trace.gas)} ({gasPercentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        gasPercentage > 90 ? 'bg-red-500' : 
                        gasPercentage > 70 ? 'bg-amber-500' : 
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(gasPercentage, 100)}%` }}
                    />
                  </div>
                </div>
                
                {/* 展开/折叠图标 */}
                <svg
                  className={`w-5 h-5 text-gray-500 transform transition-transform flex-shrink-0 ${
                    expanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        {/* 节点详情 - 展开时显示 */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-200">
            {/* Input 数据 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">{t('debugTrace.input')}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRawInput(!showRawInput);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {showRawInput ? t('debugTrace.hideRaw') : t('debugTrace.showRaw')}
                </button>
              </div>
              
              {trace.decodedInput ? (
                <div className="bg-white p-3 rounded border border-gray-200">
                  <div className="mb-2">
                    <span className="text-xs text-gray-600">{t('debugTrace.function')}:</span>
                    <span className="ml-2 text-sm font-mono text-blue-700">
                      {trace.decodedInput.functionName}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-gray-600">{t('debugTrace.signature')}:</span>
                    <span className="ml-2 text-xs font-mono text-gray-600">
                      {trace.decodedInput.signature}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600">{t('debugTrace.parameters')}:</span>
                    <pre className="mt-1 text-xs overflow-x-auto bg-gray-50 p-2 rounded">
                      {JSON.stringify(trace.decodedInput.args, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic">
                  {t('debugTrace.cannotDecode')}
                </div>
              )}
              
              {showRawInput && (
                <div className="mt-2 bg-gray-100 p-2 rounded">
                  <div className="text-xs text-gray-600 mb-1">{t('debugTrace.rawData')}:</div>
                  <div className="text-xs font-mono break-all text-gray-800">
                    {trace.input}
                  </div>
                </div>
              )}
            </div>
            
            {/* Output 数据 */}
            {trace.output && trace.output !== '0x' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">{t('debugTrace.output')}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRawOutput(!showRawOutput);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showRawOutput ? t('debugTrace.hideRaw') : t('debugTrace.showRaw')}
                  </button>
                </div>
                
                {trace.decodedOutput ? (
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(trace.decodedOutput, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic">
                    {t('debugTrace.cannotDecode')}
                  </div>
                )}
                
                {showRawOutput && (
                  <div className="mt-2 bg-gray-100 p-2 rounded">
                    <div className="text-xs text-gray-600 mb-1">{t('debugTrace.rawData')}:</div>
                    <div className="text-xs font-mono break-all text-gray-800">
                      {trace.output}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Error 数据 */}
            {trace.error && (
              <div>
                <span className="text-sm font-semibold text-red-700 block mb-2">
                  {t('debugTrace.error')}
                </span>
                
                {trace.decodedError ? (
                  <div className="bg-red-100 p-3 rounded border border-red-300">
                    {trace.decodedError.errorName && (
                      <div className="mb-2">
                        <span className="text-xs text-red-700">{t('debugTrace.errorName')}:</span>
                        <span className="ml-2 text-sm font-mono text-red-800 font-semibold">
                          {trace.decodedError.errorName}
                        </span>
                      </div>
                    )}
                    {trace.decodedError.signature && (
                      <div className="mb-2">
                        <span className="text-xs text-red-700">{t('debugTrace.signature')}:</span>
                        <span className="ml-2 text-xs font-mono text-red-700">
                          {trace.decodedError.signature}
                        </span>
                      </div>
                    )}
                    {trace.decodedError.args && (
                      <div>
                        <span className="text-xs text-red-700">{t('debugTrace.errorArgs')}:</span>
                        <pre className="mt-1 text-xs overflow-x-auto bg-white p-2 rounded">
                          {JSON.stringify(trace.decodedError.args, null, 2)}
                        </pre>
                      </div>
                    )}
                    {trace.decodedError.message && !trace.decodedError.errorName && (
                      <div className="text-sm text-red-800">
                        {trace.decodedError.message}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-red-100 p-3 rounded border border-red-300">
                    <div className="text-xs font-mono break-all text-red-800">
                      {trace.error}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* 子调用统计 */}
            {hasCalls && (
              <div className="pt-2 border-t border-gray-300">
                <span className="text-xs font-semibold text-gray-600">
                  {t('debugTrace.nestedCalls')}: {trace.calls!.length}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 递归渲染子调用 */}
      {expanded && hasCalls && (
        <div className="mt-2">
          {trace.calls!.map((call, index) => (
            <TraceCallNode key={index} trace={call} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const DebugTracePage: React.FC<DebugTracePageProps> = ({ 
  rpcUrl, 
  selectedAbis, 
  selectedAbiNames 
}) => {
  const { t } = useTranslation();
  const [txHash, setTxHash] = useState('');
  const [rawTrace, setRawTrace] = useState<CallTrace | null>(null);
  const [parsedTrace, setParsedTrace] = useState<ParsedCallTrace | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 当 ABI 变化时，重新解析现有 trace
  useEffect(() => {
    if (rawTrace && selectedAbis.length > 0) {
      try {
        const parsed = parseTraceWithAbi(rawTrace, selectedAbis);
        setParsedTrace(parsed);
      } catch (err) {
        console.error('Failed to parse trace with ABI:', err);
      }
    } else if (rawTrace) {
      // 没有 ABI 时，直接显示原始 trace
      setParsedTrace(rawTrace as ParsedCallTrace);
    }
  }, [selectedAbis, rawTrace]);
  
  const handleFetch = async () => {
    if (!txHash.trim()) {
      setError(t('debugTrace.enterTxHash'));
      return;
    }
    
    if (!rpcUrl.trim()) {
      setError(t('debugTrace.configureRpc'));
      return;
    }
    
    setIsFetching(true);
    setError(null);
    setParsedTrace(null);
    setRawTrace(null);
    
    try {
      const trace = await fetchDebugTrace(rpcUrl, txHash.trim());
      setRawTrace(trace);
      
      // 如果有 ABI，立即解析
      if (selectedAbis.length > 0) {
        const parsed = parseTraceWithAbi(trace, selectedAbis);
        setParsedTrace(parsed);
      } else {
        setParsedTrace(trace as ParsedCallTrace);
      }
    } catch (err) {
      console.error('Failed to fetch trace:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // 提供更友好的错误提示
      if (errorMessage.includes('debug_traceTransaction')) {
        setError(t('debugTrace.rpcNotSupport'));
      } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        setError(t('debugTrace.txNotFound'));
      } else {
        setError(t('debugTrace.fetchFailed') + ': ' + errorMessage);
      }
    } finally {
      setIsFetching(false);
    }
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
      {/* 左侧：输入区 */}
      <div className="lg:col-span-4 flex flex-col space-y-4 overflow-y-auto pr-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            {t('debugTrace.title')}
          </h2>
          
          <p className="text-sm text-gray-600 mb-4">
            {t('debugTrace.description')}
          </p>
          
          <div className="space-y-4">
            {/* RPC 状态 */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-sm">
                <span className="font-medium text-blue-800">RPC:</span>
                <span className="ml-2 text-blue-700 text-xs break-all">
                  {rpcUrl || t('debugTrace.notConfigured')}
                </span>
              </div>
              {selectedAbis.length > 0 && (
                <div className="text-sm mt-2">
                  <span className="font-medium text-blue-800">{t('debugTrace.selectedAbis')}:</span>
                  <span className="ml-2 text-blue-700">
                    {selectedAbis.length} {t('debugTrace.abiCount')}
                  </span>
                </div>
              )}
            </div>
            
            {/* 交易哈希输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('debugTrace.txHash')}
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder={t('debugTrace.txHashPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>
            
            {/* 获取按钮 */}
            <button
              onClick={handleFetch}
              disabled={isFetching}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {isFetching ? t('debugTrace.fetching') : t('debugTrace.fetchTrace')}
            </button>
            
            {/* ABI 提示 */}
            {rawTrace && selectedAbis.length === 0 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  👈 {t('debugTrace.selectAbiHint')}
                </p>
              </div>
            )}
            
            {/* 错误信息 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            
            {/* 成功提示 */}
            {rawTrace && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  ✅ {t('debugTrace.traceFetched')}
                  {selectedAbis.length > 0 && parsedTrace && (
                    <span className="ml-2">· {t('debugTrace.parsed')}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* 使用提示 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-3 text-gray-800">
            {t('debugTrace.usageTips')}
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>{t('debugTrace.tip1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>{t('debugTrace.tip2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>{t('debugTrace.tip3')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">⚠️</span>
              <span>{t('debugTrace.tip4')}</span>
            </li>
          </ul>
        </div>
      </div>
      
      {/* 右侧：调用链展示 */}
      <div className="lg:col-span-8 flex flex-col overflow-y-auto pr-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold mb-4 text-gray-800">
            {t('debugTrace.callChain')}
          </h3>
          
          {parsedTrace ? (
            <div className="space-y-3">
              <TraceCallNode trace={parsedTrace} depth={0} />
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🔬</div>
              <p className="text-gray-500">
                {t('debugTrace.noResult')}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {t('debugTrace.enterTxHashToStart')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugTracePage;
