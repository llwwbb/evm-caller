import React, { useState, useEffect } from 'react';
import { parseAbi, validateAbiInput } from '../utils/abiParser';
import { ParsedFunction } from '../types';
import {
  saveAbiPreset,
  saveLastAbi,
} from '../utils/presetStorage';

interface AbiInputProps {
  onAbiParsed: (functions: ParsedFunction[], abiString: string) => void;
  disabled?: boolean;
  initialAbi?: string;
  externalAbi?: string; // 外部传入的 ABI（从侧边栏预设选择）
  onPresetsSaved?: () => void;
}

const AbiInput: React.FC<AbiInputProps> = ({ 
  onAbiParsed, 
  disabled = false,
  initialAbi = '',
  externalAbi,
  onPresetsSaved,
}) => {
  const [abiInput, setAbiInput] = useState(initialAbi);
  const [error, setError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [includeStateMutating, setIncludeStateMutating] = useState(false); // 新增：是否包含状态修改函数

  const exampleSolidityAbi = `function name() view returns (string)
function symbol() view returns (string)
function totalSupply() view returns (uint256)
function balanceOf(address account) view returns (uint256)`;

  const exampleJsonAbi = `[
  {
    "name": "name",
    "type": "function",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{"type": "string"}]
  }
]`;

  // 当外部 ABI 变化时，自动更新并解析
  useEffect(() => {
    if (externalAbi && externalAbi !== abiInput) {
      setAbiInput(externalAbi);
      // 自动解析
      setTimeout(() => {
        const validation = validateAbiInput(externalAbi, includeStateMutating);
        if (validation.valid) {
          try {
            const trimmed = externalAbi.trim();
            let parsedInput: any;
            
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
              parsedInput = JSON.parse(trimmed);
            } else {
              parsedInput = trimmed;
            }
            
            const functions = parseAbi(parsedInput, includeStateMutating);
            
            onAbiParsed(functions, externalAbi);
            setError('');
          } catch (err) {
            console.error('自动解析 ABI 失败:', err);
          }
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalAbi, includeStateMutating]); // 添加 includeStateMutating 依赖

  // 自动保存到 localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      if (abiInput) saveLastAbi(abiInput);
    }, 1000);
    return () => clearTimeout(timer);
  }, [abiInput]);

  const handleParse = () => {
    setError('');
    
    const validation = validateAbiInput(abiInput, includeStateMutating);
    if (!validation.valid) {
      setError(validation.error || '输入格式错误');
      return;
    }

    setIsParsing(true);

    try {
      let parsedInput: any;
      
      const trimmed = abiInput.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        parsedInput = JSON.parse(trimmed);
      } else {
        parsedInput = trimmed;
      }

      const functions = parseAbi(parsedInput, includeStateMutating);

      if (functions.length === 0) {
        setError(includeStateMutating ? '未找到有效的函数' : '未找到 view 或 pure 函数');
      } else {
        onAbiParsed(functions, abiInput);
      }
    } catch (err) {
      console.error('解析 ABI 失败:', err);
      setError(err instanceof Error ? err.message : '解析失败');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveAbi = () => {
    if (!abiInput.trim()) {
      alert('请输入 ABI');
      return;
    }

    // 验证 ABI 格式
    const validation = validateAbiInput(abiInput, includeStateMutating);
    if (!validation.valid) {
      alert(`❌ ABI 格式无效: ${validation.error}`);
      return;
    }

    const name = prompt('请为这个 ABI 预设命名：');
    if (!name?.trim()) return;

    try {
      saveAbiPreset(name.trim(), abiInput.trim());
      alert('✅ ABI 预设已保存');
      onPresetsSaved?.();
    } catch (error) {
      console.error('保存 ABI 预设失败:', error);
      alert('❌ 保存失败');
    }
  };

  // 拖拽文件处理
  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    // 检查文件类型
    const validExtensions = ['.json', '.abi', '.txt'];
    const fileName = file.name.toLowerCase();
    const isValidFile = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidFile) {
      setError(`不支持的文件类型。请上传 ${validExtensions.join(', ')} 文件`);
      return;
    }

    try {
      const content = await file.text();
      setAbiInput(content);
      setError('');
    } catch (err) {
      console.error('读取文件失败:', err);
      setError('读取文件失败');
    }
  };

  const fillExampleSolidity = () => {
    setAbiInput(exampleSolidityAbi);
    setError('');
  };

  const fillExampleJson = () => {
    setAbiInput(exampleJsonAbi);
    setError('');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          ② ABI 输入
        </h2>
        <button
          onClick={handleSaveAbi}
          disabled={!abiInput.trim() || disabled}
          className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          💾 保存为预设
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            合约 ABI
          </label>
          <textarea
            value={abiInput}
            onChange={(e) => setAbiInput(e.target.value)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            placeholder="粘贴 JSON ABI 或 Solidity 函数签名，或拖拽 .json/.abi/.txt 文件到此处"
            disabled={disabled}
            className={`w-full min-h-48 px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-y ${
              disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
            } ${
              isDragging ? 'border-purple-500 bg-purple-50 border-2' : 'border-gray-300'
            }`}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2">
              <button
                onClick={fillExampleSolidity}
                disabled={disabled}
                className="text-xs text-blue-600 hover:text-blue-800 underline disabled:text-gray-400 disabled:no-underline"
              >
                示例（Solidity）
              </button>
              <button
                onClick={fillExampleJson}
                disabled={disabled}
                className="text-xs text-blue-600 hover:text-blue-800 underline disabled:text-gray-400 disabled:no-underline"
              >
                示例（JSON）
              </button>
            </div>
            <p className="text-xs text-gray-500">
              支持 JSON ABI 和 Solidity 签名格式
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">❌ {error}</p>
          </div>
        )}

        {/* 新增：状态修改函数选项 */}
        <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <input
            type="checkbox"
            id="includeStateMutating"
            checked={includeStateMutating}
            onChange={(e) => setIncludeStateMutating(e.target.checked)}
            className="w-4 h-4 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
          />
          <label htmlFor="includeStateMutating" className="flex-1 text-sm text-gray-700 cursor-pointer select-none">
            <span className="font-medium">包含状态修改函数</span>
            <span className="text-xs text-gray-600 ml-2">（payable/nonpayable，将以模拟方式调用）</span>
          </label>
          <div className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">
            ⚠️ 模拟调用
          </div>
        </div>

        <button
          onClick={handleParse}
          disabled={!abiInput.trim() || disabled || isParsing}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isParsing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              解析中...
            </>
          ) : (
            '🔍 解析 ABI'
          )}
        </button>
      </div>
    </div>
  );
};

export default AbiInput;
