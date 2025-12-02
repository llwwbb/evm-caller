import React, { useState } from 'react';
import { CallResult } from '../types';

interface ResultDisplayProps {
  results: Array<{
    id: string;
    functionName: string;
    args: any[];
    result: CallResult;
    timestamp: number;
    blockTag?: string | number;
    rpcName?: string;
  }>;
  onClearAll: () => void;
  onDeleteResult: (id: string) => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ results, onClearAll, onDeleteResult }) => {
  const [expandedParams, setExpandedParams] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 处理 BigInt 的 JSON 序列化
  const safeStringify = (obj: any): string => {
    if (typeof obj === 'string') return obj;
    
    return JSON.stringify(obj, (_key, value) => {
      // 将 BigInt 转换为字符串
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }, 2);
  };

  const toggleParams = (id: string) => {
    setExpandedParams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyResult = async (id: string, data: any) => {
    try {
      const text = safeStringify(data);
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">调用结果</h2>
        <p className="text-gray-500 text-center py-8">
          暂无调用结果。请在左侧选择函数并调用。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          调用结果 ({results.length})
        </h2>
        <button
          onClick={onClearAll}
          className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
        >
          🗑️ 清空所有
        </button>
      </div>
      
      <div className="space-y-4">
        {results.map((item) => (
          <div
            key={item.id}
            className={`border rounded-lg p-4 relative ${
              item.result.success
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            {/* 删除按钮 */}
            <button
              onClick={() => onDeleteResult(item.id)}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
              title="删除此结果"
            >
              ×
            </button>

            {/* 函数信息 */}
            <div className="flex items-start justify-between mb-3 pr-8">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">
                    {item.functionName}
                  </h3>
                  {item.args.length > 0 && (
                    <button
                      onClick={() => toggleParams(item.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      {expandedParams.has(item.id) ? '收起参数' : '查看参数'}
                    </button>
                  )}
                </div>
                
                {/* 简短参数显示 */}
                {!expandedParams.has(item.id) && item.args.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1 truncate">
                    参数: {item.args.map((arg) => formatArgDisplay(arg)).join(', ')}
                  </p>
                )}
                
                {/* 展开的完整参数 */}
                {expandedParams.has(item.id) && item.args.length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs font-medium text-gray-700 mb-1">输入参数：</p>
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap break-all font-mono">
                      {safeStringify(item.args)}
                    </pre>
                  </div>
                )}
                
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-gray-500">
                    {new Date(item.timestamp).toLocaleString('zh-CN')}
                  </p>
                  {item.rpcName && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      🌐 RPC: {item.rpcName}
                    </span>
                  )}
                  {item.blockTag && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      🔖 区块: {item.blockTag}
                    </span>
                  )}
                </div>
              </div>
              
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  item.result.success
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {item.result.success ? '成功' : '失败'}
              </span>
            </div>

            {/* 结果内容 */}
            <div className="bg-white rounded-md p-3 border border-gray-200">
              {item.result.success ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">返回值：</p>
                    <button
                      onClick={() => copyResult(item.id, item.result.data)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        copiedId === item.id
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {copiedId === item.id ? '✓ 已复制' : '📋 复制'}
                    </button>
                  </div>
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap break-all font-mono">
                    {formatResultDisplay(item.result.data)}
                  </pre>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-red-700 mb-2">错误信息：</p>
                  <p className="text-sm text-red-600">{item.result.error}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 格式化参数显示
function formatArgDisplay(arg: any): string {
  if (typeof arg === 'string') {
    return arg.length > 20 ? arg.substring(0, 20) + '...' : arg;
  }
  if (typeof arg === 'bigint') {
    return arg.toString();
  }
  if (Array.isArray(arg)) {
    return `[${arg.length} items]`;
  }
  if (typeof arg === 'object') {
    return 'object';
  }
  return String(arg);
}

// 格式化结果显示
function formatResultDisplay(data: any): string {
  if (data === null || data === undefined) {
    return 'null';
  }
  
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '[]';
    }
    return JSON.stringify(data, null, 2);
  }

  if (typeof data === 'object') {
    return JSON.stringify(data, null, 2);
  }

  return String(data);
}

export default ResultDisplay;

