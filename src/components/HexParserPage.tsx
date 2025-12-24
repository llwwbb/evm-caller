import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DecodedData, HexParserHistory } from '../types';
import {
  autoDetectAndDecode,
  decodeHexAsFunction,
  decodeHexAsEvent,
  decodeHexAsError,
} from '../utils/hexParser';
import {
  saveHexParserResult,
  loadHexParserResult,
  loadHexParserHistory,
  addHexParserHistory,
  deleteHexParserHistory,
  clearHexParserHistory,
} from '../utils/presetStorage';

type DecodeType = 'auto' | 'function' | 'event' | 'error';

interface HexParserPageProps {
  mergedAbi: string;
}

const HexParserPage: React.FC<HexParserPageProps> = ({ mergedAbi }) => {
  const { t } = useTranslation();
  const [hexData, setHexData] = useState('');
  const [parsedHexData, setParsedHexData] = useState(''); // 保存解析时的 hex 数据
  const [decodeType, setDecodeType] = useState<DecodeType>('auto');
  const [result, setResult] = useState<DecodedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HexParserHistory[]>([]);

  // 加载保存的结果和历史记录
  useEffect(() => {
    const saved = loadHexParserResult();
    if (saved) {
      setHexData(saved.hexData || '');
      setParsedHexData(saved.hexData || '');
      setDecodeType(saved.decodeType || 'auto');
      setResult(saved.result || null);
    }
    setHistory(loadHexParserHistory());
  }, []);

  const handleDecode = () => {
    if (!hexData.trim()) {
      setError(t('hexParser.enterHexData'));
      return;
    }

    if (!mergedAbi) {
      setError(t('hexParser.selectAbiFirst'));
      return;
    }

    setError(null);
    setResult(null);
    
    // 保存解析时的 hex 数据
    const trimmedHex = hexData.trim();
    setParsedHexData(trimmedHex);

    try {
      let decoded: DecodedData;

      switch (decodeType) {
        case 'function':
          decoded = decodeHexAsFunction(trimmedHex, mergedAbi);
          break;
        case 'event':
          decoded = decodeHexAsEvent(trimmedHex, mergedAbi);
          break;
        case 'error':
          decoded = decodeHexAsError(trimmedHex, mergedAbi);
          break;
        case 'auto':
        default:
          decoded = autoDetectAndDecode(trimmedHex, mergedAbi);
          break;
      }

      setResult(decoded);
      
      // 保存结果
      saveHexParserResult({
        hexData: trimmedHex,
        decodeType,
        result: decoded,
      });
      
      // 添加到历史记录
      addHexParserHistory({
        hexData: trimmedHex,
        decodeType,
        result: decoded,
        success: true,
      });
      setHistory(loadHexParserHistory());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('hexParser.parseFailed');
      setError(errorMessage);
      
      // 即使失败也添加到历史记录
      addHexParserHistory({
        hexData: trimmedHex,
        decodeType,
        result: null,
        success: false,
      });
      setHistory(loadHexParserHistory());
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'function':
        return t('hexParser.functionCall');
      case 'event':
        return t('hexParser.eventType');
      case 'error':
        return t('hexParser.errorType');
      case 'unknown':
        return t('hexParser.unknownType');
      default:
        return type;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'function':
        return 'bg-blue-100 text-blue-800';
      case 'event':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'unknown':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 从历史记录恢复
  const restoreFromHistory = useCallback((historyItem: HexParserHistory) => {
    setHexData(historyItem.hexData);
    setParsedHexData(historyItem.hexData);
    setDecodeType(historyItem.decodeType);
    setResult(historyItem.result);
    setError(null);
  }, []);

  // 删除历史记录
  const handleDeleteHistory = useCallback((id: string) => {
    deleteHexParserHistory(id);
    setHistory(loadHexParserHistory());
  }, []);

  // 清空历史记录
  const handleClearHistory = useCallback(() => {
    if (window.confirm(t('hexParser.confirmClearHistory') || '确定要清空所有历史记录吗？')) {
      clearHexParserHistory();
      setHistory([]);
    }
  }, [t]);

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* 左列：输入区 */}
      <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">{t('hexParser.title')}</h2>

          <div className="space-y-4">
            {/* Hex 数据输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('hexParser.hexDataLabel')}
              </label>
              <textarea
                value={hexData}
                onChange={(e) => setHexData(e.target.value)}
                placeholder={t('hexParser.hexDataPlaceholder')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            {/* 解析类型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('hexParser.parseTypeLabel')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'auto', label: t('hexParser.autoDetect') },
                  { value: 'function', label: t('hexParser.function') },
                  { value: 'event', label: t('hexParser.event') },
                  { value: 'error', label: t('hexParser.error') },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDecodeType(option.value as DecodeType)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      decodeType === option.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ABI 提示 */}
            {!mergedAbi && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  {t('hexParser.selectAbiHint')}
                </p>
              </div>
            )}

            {mergedAbi && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  {t('hexParser.abiSelected')}
                </p>
              </div>
            )}

            {/* 解析按钮 */}
            <button
              onClick={handleDecode}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              {t('hexParser.parseButton')}
            </button>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右列：解析结果和历史 */}
      <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
        {/* 解析结果 */}
        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800">{t('hexParser.parseResult')}</h3>

            <div className="space-y-4">
              {/* 类型 */}
              <div>
                <span className="text-sm font-medium text-gray-600">{t('hexParser.typeLabel')}</span>
                <span className={`ml-2 px-3 py-1 rounded text-sm font-medium ${getTypeBadgeColor(result.type)}`}>
                  {getTypeLabel(result.type)}
                </span>
              </div>

              {result.type === 'unknown' ? (
                // 无法识别
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-sm text-gray-700">
                    {result.error || t('hexParser.cannotRecognize')}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {t('hexParser.checkFormat')}
                  </p>
                </div>
              ) : (
                <>
                  {/* 名称 */}
                  {result.name && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">{t('hexParser.nameLabel')}</span>
                      <span className="ml-2 text-blue-700 font-mono text-base font-semibold">
                        {result.name}
                      </span>
                    </div>
                  )}

                  {/* 签名 */}
                  {result.signature && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">{t('hexParser.signatureLabel')}</span>
                      <span className="ml-2 text-gray-600 font-mono text-xs">
                        {result.signature}
                      </span>
                    </div>
                  )}

                  {/* 参数 */}
                  {result.args && (
                    <div>
                      <span className="text-sm font-medium text-gray-600 block mb-2">
                        {t('hexParser.parametersLabel')}
                      </span>
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(result.args, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Fragment 详情 */}
                  {result.fragment && (
                    <div>
                      <span className="text-sm font-medium text-gray-600 block mb-2">
                        {t('hexParser.fragmentDetails')}
                      </span>
                      <div className="bg-blue-50 p-4 rounded border border-blue-200">
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">{t('hexParser.nameLabel')}</span>
                            <span className="ml-2 text-gray-800">{result.fragment.name}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">{t('hexParser.typeFragmentLabel')}</span>
                            <span className="ml-2 text-gray-800">{result.fragment.type}</span>
                          </div>
                          {result.fragment.inputs && result.fragment.inputs.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700 block mb-1">{t('hexParser.inputParameters')}</span>
                              <div className="ml-4 space-y-1">
                                {result.fragment.inputs.map((input: any, i: number) => (
                                  <div key={i} className="text-xs font-mono text-gray-700">
                                    • {input.name || `arg${i}`}: {input.type}
                                    {input.indexed && (
                                      <span className="ml-2 px-1 bg-yellow-200 text-yellow-800 rounded text-xs">
                                        indexed
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 原始数据对照 */}
                  <div>
                    <span className="text-sm font-medium text-gray-600 block mb-2">
                      {t('hexParser.rawHexData')}
                    </span>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="text-xs font-mono break-all text-gray-700">
                        {parsedHexData}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 历史记录 */}
        <div className="bg-white rounded-lg shadow-md p-6 flex-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">{t('hexParser.history') || '历史记录'}</h3>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                {t('hexParser.clearHistory') || '清空历史'}
              </button>
            )}
          </div>
          
          {history.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {history.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded border cursor-pointer hover:bg-gray-50 ${
                    item.success ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
                  }`}
                  onClick={() => restoreFromHistory(item)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.decodeType === 'auto' ? 'bg-gray-100 text-gray-700' :
                        item.decodeType === 'function' ? 'bg-blue-100 text-blue-700' :
                        item.decodeType === 'event' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.decodeType === 'auto' ? t('hexParser.autoDetect') :
                         item.decodeType === 'function' ? t('hexParser.function') :
                         item.decodeType === 'event' ? t('hexParser.event') :
                         t('hexParser.error')}
                      </span>
                      <span className={`text-xs ${item.success ? 'text-green-600' : 'text-red-600'}`}>
                        {item.success ? '✓' : '✗'}
                      </span>
                      {item.result && (
                        <span className={`text-xs px-2 py-0.5 rounded ${getTypeBadgeColor(item.result.type)}`}>
                          {getTypeLabel(item.result.type)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">{formatTime(item.timestamp)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 font-mono truncate">
                    {item.hexData.substring(0, 80)}{item.hexData.length > 80 ? '...' : ''}
                  </div>
                  {item.result?.name && (
                    <div className="text-xs text-blue-600 font-mono mt-1">
                      {item.result.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('hexParser.noHistory') || '暂无历史记录'}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HexParserPage;

