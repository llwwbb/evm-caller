import React, { useState, useEffect } from 'react';
import { DecodedData } from '../types';
import {
  autoDetectAndDecode,
  decodeHexAsFunction,
  decodeHexAsEvent,
  decodeHexAsError,
} from '../utils/hexParser';
import { saveHexParserResult, loadHexParserResult } from '../utils/presetStorage';

type DecodeType = 'auto' | 'function' | 'event' | 'error';

interface HexParserPageProps {
  mergedAbi: string;
}

const HexParserPage: React.FC<HexParserPageProps> = ({ mergedAbi }) => {
  const [hexData, setHexData] = useState('');
  const [decodeType, setDecodeType] = useState<DecodeType>('auto');
  const [result, setResult] = useState<DecodedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 加载保存的结果
  useEffect(() => {
    const saved = loadHexParserResult();
    if (saved) {
      setHexData(saved.hexData || '');
      setDecodeType(saved.decodeType || 'auto');
      setResult(saved.result || null);
    }
  }, []);

  const handleDecode = () => {
    if (!hexData.trim()) {
      setError('请输入 Hex 数据');
      return;
    }

    if (!mergedAbi) {
      setError('请在左侧选择至少一个 ABI');
      return;
    }

    setError(null);
    setResult(null);

    try {
      let decoded: DecodedData;

      switch (decodeType) {
        case 'function':
          decoded = decodeHexAsFunction(hexData.trim(), mergedAbi);
          break;
        case 'event':
          decoded = decodeHexAsEvent(hexData.trim(), mergedAbi);
          break;
        case 'error':
          decoded = decodeHexAsError(hexData.trim(), mergedAbi);
          break;
        case 'auto':
        default:
          decoded = autoDetectAndDecode(hexData.trim(), mergedAbi);
          break;
      }

      setResult(decoded);
      
      // 保存结果
      saveHexParserResult({
        hexData: hexData.trim(),
        decodeType,
        result: decoded,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败');
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'function':
        return '函数调用';
      case 'event':
        return '事件';
      case 'error':
        return '错误';
      case 'unknown':
        return '未知类型';
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* 左列：输入区 */}
      <div className="flex flex-col space-y-4 overflow-y-auto pr-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Hex 数据解析</h2>

          <div className="space-y-4">
            {/* Hex 数据输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hex 数据
              </label>
              <textarea
                value={hexData}
                onChange={(e) => setHexData(e.target.value)}
                placeholder="0x..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            {/* 解析类型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                解析类型
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'auto', label: '自动检测' },
                  { value: 'function', label: '函数' },
                  { value: 'event', label: '事件' },
                  { value: 'error', label: '错误' },
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
                  👈 请在左侧选择至少一个 ABI
                </p>
              </div>
            )}

            {mergedAbi && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  ✅ 已选择 ABI（已合并）
                </p>
              </div>
            )}

            {/* 解析按钮 */}
            <button
              onClick={handleDecode}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              解析
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

      {/* 右列：解析结果 */}
      <div className="flex flex-col overflow-y-auto pr-2">
        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-800">解析结果</h3>

            <div className="space-y-4">
              {/* 类型 */}
              <div>
                <span className="text-sm font-medium text-gray-600">类型：</span>
                <span className={`ml-2 px-3 py-1 rounded text-sm font-medium ${getTypeBadgeColor(result.type)}`}>
                  {getTypeLabel(result.type)}
                </span>
              </div>

              {result.type === 'unknown' ? (
                // 无法识别
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-sm text-gray-700">
                    {result.error || '无法识别数据类型'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    提示：请确保 Hex 数据格式正确，并且选择了正确的 ABI
                  </p>
                </div>
              ) : (
                <>
                  {/* 名称 */}
                  {result.name && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">名称：</span>
                      <span className="ml-2 text-blue-700 font-mono text-base font-semibold">
                        {result.name}
                      </span>
                    </div>
                  )}

                  {/* 签名 */}
                  {result.signature && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">签名：</span>
                      <span className="ml-2 text-gray-600 font-mono text-xs">
                        {result.signature}
                      </span>
                    </div>
                  )}

                  {/* 参数 */}
                  {result.args && (
                    <div>
                      <span className="text-sm font-medium text-gray-600 block mb-2">
                        参数：
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
                        Fragment 详情：
                      </span>
                      <div className="bg-blue-50 p-4 rounded border border-blue-200">
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">名称：</span>
                            <span className="ml-2 text-gray-800">{result.fragment.name}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">类型：</span>
                            <span className="ml-2 text-gray-800">{result.fragment.type}</span>
                          </div>
                          {result.fragment.inputs && result.fragment.inputs.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700 block mb-1">输入参数：</span>
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
                      原始 Hex 数据：
                    </span>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="text-xs font-mono break-all text-gray-700">
                        {hexData}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HexParserPage;

